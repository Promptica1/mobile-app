import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { periodEnd } from "./billing.server";
import { getPlan } from "./plans";
import { capturePayment, getPayment, type YooKassaPayment } from "./yookassa";

// Применение платежа ЮKassa к нашей базе. Общий код для двух путей:
// возврата пользователя в приложение (/api/payments/status) и уведомления ЮKassa (webhook).
// Идемпотентно: подписка включается ровно один раз, сколько бы раз ни пришло подтверждение.

export type PaymentRow = {
  id: string;
  user_id: string | null;
  plan: "premium" | "premium_plus";
  amount: number | string;
  status: string;
  yookassa_payment_id: string | null;
  // Есть после SQL автопродления: initial — первая оплата, renewal — автосписание за период,
  // который заканчивался в renewal_for.
  kind?: "initial" | "renewal";
  renewal_for?: string | null;
};

export type ApplyOutcome =
  | { kind: "activated"; periodEnd: string }
  | { kind: "already_active" }
  | { kind: "canceled"; reason: string }
  | { kind: "pending" }
  | { kind: "mismatch" };

// Платёж должен быть именно этим заказом, этого пользователя, на ту же сумму и тестовым.
export function paymentMatchesRow(payment: YooKassaPayment, row: PaymentRow) {
  const amountOk = Number(payment.amount.value) === Number(row.amount) && payment.amount.currency === "RUB";
  const ownerOk = payment.metadata?.order_id === row.id && Boolean(row.user_id) && payment.metadata?.user_id === row.user_id;
  const planOk = payment.metadata?.plan === row.plan;
  return amountOk && ownerOk && planOk && payment.test === true;
}

export async function applyPayment(
  admin: SupabaseClient,
  row: PaymentRow,
  payment: YooKassaPayment,
  source: "return" | "webhook" | "cron",
): Promise<ApplyOutcome> {
  if (!paymentMatchesRow(payment, row)) {
    console.log(`YK[${source}]: payment ${payment.id} does not match order ${row.id}`);
    return { kind: "mismatch" };
  }
  const now = new Date();

  if (payment.status === "succeeded" && payment.paid) {
    const method = payment.payment_method;
    // Атомарно «забираем» платёж: обновится только если он ещё не был подтверждён.
    // Второй путь (webhook или возврат) получит пустой ответ и ничего не продлит повторно.
    const { data: claimed, error: claimError } = await admin
      .from("payments")
      .update({
        status: "succeeded",
        payment_method_id: method?.id ?? null,
        paid_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", row.id)
      .neq("status", "succeeded")
      .select("id");
    if (claimError) throw new Error(`claim: ${claimError.message}`);
    if (!claimed || claimed.length === 0) {
      console.log(`YK[${source}]: payment ${payment.id} already applied — skip`);
      return { kind: "already_active" };
    }

    // Токены тарифа за этот оплаченный период: баланс = 50 / 150 (остаток не переносится).
    // Раньше продления подписки: если продление упадёт, повтор не начислит токены второй раз.
    try {
      await grantPlanTokens(admin, row, source);
    } catch (e) {
      await admin.from("payments").update({ status: row.status, updated_at: now.toISOString() }).eq("id", row.id);
      throw e;
    }

    // Подписка сейчас. Колонки автопродления есть, если у платежа есть поле kind (SQL выполнен).
    const renewal = row.kind === "renewal" && Boolean(row.renewal_for);
    const { data: current } = await admin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", row.user_id)
      .maybeSingle<{ plan: string; status: string; current_period_end: string | null }>();
    const currentEnd = current?.current_period_end ? new Date(current.current_period_end) : null;
    const samePlan = current?.plan === row.plan;
    let extendFrom: Date;
    if (renewal) {
      // Автопродление: следующий месяц начинается ровно с конца оплаченного периода.
      const due = new Date(row.renewal_for as string);
      extendFrom = samePlan && currentEnd && currentEnd > due ? currentEnd : due;
    } else {
      // Тот же тариф ещё действует (в т.ч. отменённый) — продлеваем от его конца, иначе — с сегодняшнего дня.
      extendFrom =
        samePlan && (current?.status === "active" || current?.status === "canceled") && currentEnd && currentEnd > now
          ? currentEnd
          : now;
    }
    const end = periodEnd(extendFrom);

    const update: Record<string, unknown> = {
      user_id: row.user_id,
      plan: row.plan,
      // Отменил, пока шло списание, — продление не включаем снова.
      status: renewal && current?.status === "canceled" ? "canceled" : "active",
      current_period_end: end.toISOString(),
      last_payment_id: row.id,
      test: payment.test,
      updated_at: now.toISOString(),
    };
    if (!renewal && extendFrom === now) update.started_at = now.toISOString();
    // Карту перезаписываем только сохранённой (при автосписании это та же карта).
    if (!renewal || method?.saved) {
      update.yookassa_payment_method_id = method?.saved ? method.id : null;
      update.card_last4 = method?.card?.last4 ?? null;
      update.card_type = method?.card?.card_type ?? null;
    }
    if (row.kind !== undefined) {
      update.renewal_failures = 0;
      if (!renewal) update.canceled_at = null;
    }
    const { error: subError } = await admin.from("subscriptions").upsert(update, { onConflict: "user_id" });
    if (subError) {
      // Возвращаем платёж в прежний статус, чтобы следующая попытка (повтор webhook) применила его.
      await admin.from("payments").update({ status: row.status, updated_at: now.toISOString() }).eq("id", row.id);
      throw new Error(`subscription upsert: ${subError.message}`);
    }
    console.log(`YK[${source}]: payment ${payment.id} applied, plan = ${row.plan}, until ${end.toISOString()}, card saved = ${Boolean(method?.saved)}`);
    return { kind: "activated", periodEnd: end.toISOString() };
  }

  if (payment.status === "canceled") {
    const reason = payment.cancellation_details?.reason ?? "unknown";
    // Подтверждённый или уже отменённый платёж не трогаем — так неудача считается один раз.
    const { data: changed } = await admin
      .from("payments")
      .update({ status: "canceled", cancellation_reason: reason, updated_at: now.toISOString() })
      .eq("id", row.id)
      .in("status", ["pending", "waiting_for_capture"])
      .select("id");
    console.log(`YK[${source}]: payment ${payment.id} canceled: ${reason}`);
    if (row.kind === "renewal" && row.renewal_for && changed && changed.length > 0) {
      await markRenewalFailed(admin, row.user_id as string, row.renewal_for, source);
    }
    return { kind: "canceled", reason };
  }

  await admin
    .from("payments")
    .update({ status: payment.status, updated_at: now.toISOString() })
    .eq("id", row.id)
    .neq("status", "succeeded");
  return { kind: "pending" };
}

// Автосписание не прошло: доступ не отключаем сразу — статус past_due, завтра попробуем снова
// (до RENEWAL_GRACE_DAYS дней). Только если период всё ещё не продлён и подписку не отменили.
export async function markRenewalFailed(admin: SupabaseClient, userId: string, renewalFor: string, source: string) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, current_period_end, renewal_failures")
    .eq("user_id", userId)
    .maybeSingle<{ status: string; current_period_end: string | null; renewal_failures: number | null }>();
  if (!sub || !["active", "past_due"].includes(sub.status)) return;
  if (sub.current_period_end && new Date(sub.current_period_end) > new Date(renewalFor)) return;
  const failures = (sub.renewal_failures ?? 0) + 1;
  await admin
    .from("subscriptions")
    .update({ status: "past_due", renewal_failures: failures, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  console.log(`YK[${source}]: renewal failed for user ${userId}, attempt ${failures} → past_due`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Автосписание ЮKassa обычно сразу отвечает «pending» и через секунду-другую переводит платёж
// в succeeded/canceled. Ждём финальный статус до maxMs, опрашивая API.
export async function waitForFinal(payment: YooKassaPayment, maxMs: number): Promise<YooKassaPayment> {
  const deadline = Date.now() + maxMs;
  let current = payment;
  while (current.status === "pending" && Date.now() < deadline) {
    await sleep(1500);
    current = await getPayment(current.id);
  }
  return current;
}

// Довести платёж до конца и применить к базе: если он ждёт подтверждения — подтверждаем (capture),
// затем applyPayment. Используют cron, webhook и возврат в приложение.
export async function settlePayment(
  admin: SupabaseClient,
  row: PaymentRow,
  payment: YooKassaPayment,
  source: "return" | "webhook" | "cron",
): Promise<ApplyOutcome> {
  let current = payment;
  if (current.status === "waiting_for_capture" && paymentMatchesRow(current, row)) {
    console.log(`YK[${source}]: payment ${current.id} waiting_for_capture → capture`);
    current = await capturePayment(current.id, current.amount, `capture-${row.id}`);
  }
  return applyPayment(admin, row, current, source);
}

// Начисление токенов тарифа (модель «сброс»). Идемпотентно в базе: один платёж — одно начисление.
async function grantPlanTokens(admin: SupabaseClient, row: PaymentRow, source: string) {
  const tokens = getPlan(row.plan).tokens;
  const { data, error } = await admin.rpc("grant_plan_tokens", {
    p_payment_id: row.id,
    p_user_id: row.user_id,
    p_plan: row.plan,
    p_tokens: tokens,
  });
  if (error) {
    // SQL с начислением ещё не выполнен — подписку всё равно включаем, токены не трогаем.
    if (error.code === "PGRST202" || error.code === "42883") {
      console.log(`TOKENS[${source}]: grant_plan_tokens not installed — skip`);
      return;
    }
    throw new Error(`grant tokens: ${error.message}`);
  }
  console.log(`TOKENS[${source}]: user ${row.user_id}, plan = ${row.plan}, payment ${row.id} → ${data ? `set ${tokens}` : "already granted"}`);
}
