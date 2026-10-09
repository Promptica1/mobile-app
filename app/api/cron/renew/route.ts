import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { planDescription, planPrice } from "@/lib/billing.server";
import { markRenewalFailed, settlePayment, waitForFinal, type PaymentRow } from "@/lib/payments.server";
import { RENEWAL_GRACE_DAYS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRecurringPayment, getPayment, YooKassaError } from "@/lib/yookassa";

// Ежедневное автопродление подписок (расписание — в vercel.json, раз в сутки).
// Находит подписки, у которых закончился оплаченный период, и списывает плату
// с сохранённой карты. Отменённые подписки не списываются.
//
// Защита от двойного списания:
// - в базе уникальный индекс «одно активное автосписание на пользователя и период»;
// - Idempotence-Key в ЮKassa = id нашего заказа;
// - подтверждение (здесь или через webhook) применяется ровно один раз (applyPayment).
//
// Автосписание создаётся без участия пользователя: payment_method_id сохранённой карты,
// capture: true, без confirmation (никаких редиректов и 3-D Secure). ЮKassa обычно сразу
// отвечает «pending» и через пару секунд переводит платёж в succeeded — поэтому ждём финальный
// статус здесь же, а если не дождались — его применит webhook или следующий запуск cron
// (в начале каждого запуска досверяем все незавершённые автосписания).
//
// Вызывать может только Vercel Cron: заголовок Authorization: Bearer <CRON_SECRET>.
// Логи — "YK[cron]:".

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;
// Повторная попытка после неудачи — не чаще раза в ~сутки.
const RETRY_AFTER_MS = 20 * 60 * 60 * 1000;

type DueSub = {
  user_id: string;
  plan: "premium" | "premium_plus";
  status: "active" | "past_due";
  current_period_end: string;
  yookassa_payment_method_id: string | null;
  last_renewal_attempt_at: string | null;
};

type Result = "renewed" | "pending" | "failed" | "skipped" | "expired" | "error";

// Сколько ждём финальный статус одного списания и всего запуска (лимит функции — 60 с).
const WAIT_PER_CHARGE_MS = 12_000;
const RUN_BUDGET_MS = 45_000;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("YK[cron]: CRON_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const now = new Date();
  const nowIso = now.toISOString();

  const deadline = Date.now() + RUN_BUDGET_MS;

  // Сначала досверяем незавершённые автосписания прошлых запусков (если webhook не дошёл).
  const settled = await settlePendingRenewals(admin);

  // Отменённые подписки, у которых закончился период, и неоплаченные дольше льготного срока — закрываем.
  const graceLimit = new Date(now.getTime() - RENEWAL_GRACE_DAYS * DAY).toISOString();
  await admin.from("subscriptions").update({ status: "expired", updated_at: nowIso }).eq("status", "canceled").lte("current_period_end", nowIso);
  await admin.from("subscriptions").update({ status: "expired", updated_at: nowIso }).eq("status", "past_due").lte("current_period_end", graceLimit);

  const { data: due, error } = await admin
    .from("subscriptions")
    .select("user_id, plan, status, current_period_end, yookassa_payment_method_id, last_renewal_attempt_at")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", nowIso)
    .limit(200);
  if (error) {
    console.log(`YK[cron]: db error: ${error.message}`);
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }

  const summary: Record<Result, number> = { renewed: 0, pending: 0, failed: 0, skipped: 0, expired: 0, error: 0 };
  for (const sub of (due ?? []) as DueSub[]) {
    let result: Result;
    try {
      result = await renew(admin, sub, now, deadline);
    } catch (e) {
      console.log(`YK[cron]: user ${sub.user_id} error: ${e instanceof Error ? e.message : String(e)}`);
      result = "error";
    }
    summary[result] += 1;
  }
  console.log(`YK[cron]: done, due = ${due?.length ?? 0}, settled earlier = ${settled}, ${JSON.stringify(summary)}`);
  return NextResponse.json({ ok: true, due: due?.length ?? 0, settledEarlier: settled, ...summary });
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const resultOf = (kind: string): Result =>
  kind === "activated" || kind === "already_active" ? "renewed" : kind === "pending" ? "pending" : "failed";

async function renew(admin: Admin, sub: DueSub, now: Date, deadline: number): Promise<Result> {
  const nowIso = now.toISOString();
  // Без сохранённой карты продлить нельзя — подписка заканчивается.
  if (!sub.yookassa_payment_method_id) {
    await admin.from("subscriptions").update({ status: "expired", updated_at: nowIso }).eq("user_id", sub.user_id);
    console.log(`YK[cron]: user ${sub.user_id} has no saved card → expired`);
    return "expired";
  }
  if (sub.last_renewal_attempt_at && now.getTime() - new Date(sub.last_renewal_attempt_at).getTime() < RETRY_AFTER_MS) {
    return "skipped";
  }

  const orderId = randomUUID();
  const amount = planPrice(sub.plan);
  const { error: insertError } = await admin.from("payments").insert({
    id: orderId,
    user_id: sub.user_id,
    plan: sub.plan,
    amount,
    status: "pending",
    test: true,
    kind: "renewal",
    renewal_for: sub.current_period_end,
  });
  if (insertError) {
    // 23505 — за этот период списание уже идёт или прошло. Досверяем его с ЮKassa (на случай,
    // если webhook потерялся), но второй раз не списываем.
    if (insertError.code === "23505") return checkExisting(admin, sub);
    throw new Error(`payments insert: ${insertError.message}`);
  }
  await admin.from("subscriptions").update({ last_renewal_attempt_at: nowIso }).eq("user_id", sub.user_id);

  const row: PaymentRow = {
    id: orderId,
    user_id: sub.user_id,
    plan: sub.plan,
    amount,
    status: "pending",
    yookassa_payment_id: null,
    kind: "renewal",
    renewal_for: sub.current_period_end,
  };
  let payment;
  try {
    payment = await createRecurringPayment({
      amount,
      description: planDescription(sub.plan),
      paymentMethodId: sub.yookassa_payment_method_id,
      metadata: { user_id: sub.user_id, plan: sub.plan, order_id: orderId, kind: "renewal" },
      idempotenceKey: orderId,
    });
  } catch (e) {
    const reason = e instanceof YooKassaError ? e.reason : "failed";
    console.log(`YK[cron]: charge request failed for user ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    await admin
      .from("payments")
      .update({ status: "canceled", cancellation_reason: `create_${reason}`, updated_at: nowIso })
      .eq("id", orderId);
    await markRenewalFailed(admin, sub.user_id, sub.current_period_end, "cron");
    return "failed";
  }
  await admin.from("payments").update({ yookassa_payment_id: payment.id, updated_at: nowIso }).eq("id", orderId);
  row.yookassa_payment_id = payment.id;
  console.log(`YK[cron]: charge ${payment.id} for user ${sub.user_id}, plan = ${sub.plan}, status = ${payment.status}`);

  if (payment.confirmation) {
    // Для автосписания подтверждение пользователя не должно требоваться. Если банк всё же его
    // запросил — платёж отменится по таймауту, и это засчитается как неудачная попытка.
    console.log(`YK[cron]: charge ${payment.id} unexpectedly requires confirmation (${payment.confirmation.type})`);
  }
  // Ждём, пока ЮKassa завершит списание (обычно 1–3 секунды).
  try {
    payment = await waitForFinal(payment, Math.min(WAIT_PER_CHARGE_MS, deadline - Date.now()));
  } catch (e) {
    console.log(`YK[cron]: status check failed for ${payment.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const outcome = await settlePayment(admin, row, payment, "cron");
  console.log(`YK[cron]: charge ${payment.id} → ${payment.status} (${outcome.kind})`);
  return resultOf(outcome.kind); // pending — завершит webhook или следующий запуск
}

// Незавершённые автосписания (pending / waiting_for_capture): спрашиваем ЮKassa и применяем.
async function settlePendingRenewals(admin: Admin): Promise<number> {
  const { data: rows } = await admin
    .from("payments")
    .select("*")
    .eq("kind", "renewal")
    .in("status", ["pending", "waiting_for_capture"])
    .limit(100);
  let done = 0;
  for (const row of ((rows ?? []) as PaymentRow[]).filter((r) => r.yookassa_payment_id)) {
    try {
      const payment = await getPayment(row.yookassa_payment_id as string);
      const outcome = await settlePayment(admin, row, payment, "cron");
      console.log(`YK[cron]: pending renewal ${payment.id} → ${payment.status} (${outcome.kind})`);
      if (outcome.kind !== "pending") done += 1;
    } catch (e) {
      console.log(`YK[cron]: pending renewal check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return done;
}

async function checkExisting(admin: Admin, sub: DueSub): Promise<Result> {
  const { data: row } = await admin
    .from("payments")
    .select("*")
    .eq("user_id", sub.user_id)
    .eq("kind", "renewal")
    .eq("renewal_for", sub.current_period_end)
    .in("status", ["pending", "waiting_for_capture"])
    .maybeSingle<PaymentRow>();
  if (!row?.yookassa_payment_id) return "skipped";
  try {
    const payment = await getPayment(row.yookassa_payment_id);
    const outcome = await settlePayment(admin, row, payment, "cron");
    return outcome.kind === "activated" ? "renewed" : "skipped";
  } catch {
    return "skipped";
  }
}
