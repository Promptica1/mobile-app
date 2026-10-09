import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { periodEnd } from "./billing.server";
import type { YooKassaPayment } from "./yookassa";

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
  source: "return" | "webhook",
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

    // Тот же тариф ещё действует — продлеваем от его конца, иначе — месяц с сегодняшнего дня.
    const { data: current } = await admin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", row.user_id)
      .maybeSingle<{ plan: string; status: string; current_period_end: string | null }>();
    const currentEnd = current?.current_period_end ? new Date(current.current_period_end) : null;
    const extendFrom =
      current?.plan === row.plan && current.status === "active" && currentEnd && currentEnd > now ? currentEnd : now;
    const end = periodEnd(extendFrom);

    const { error: subError } = await admin.from("subscriptions").upsert(
      {
        user_id: row.user_id,
        plan: row.plan,
        status: "active",
        started_at: extendFrom === now ? now.toISOString() : undefined,
        current_period_end: end.toISOString(),
        yookassa_payment_method_id: method?.saved ? method.id : null,
        card_last4: method?.card?.last4 ?? null,
        card_type: method?.card?.card_type ?? null,
        last_payment_id: row.id,
        test: payment.test,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );
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
    // Подтверждённый платёж отменой не перезаписываем.
    await admin
      .from("payments")
      .update({ status: "canceled", cancellation_reason: reason, updated_at: now.toISOString() })
      .eq("id", row.id)
      .neq("status", "succeeded");
    console.log(`YK[${source}]: payment ${payment.id} canceled: ${reason}`);
    return { kind: "canceled", reason };
  }

  await admin
    .from("payments")
    .update({ status: payment.status, updated_at: now.toISOString() })
    .eq("id", row.id)
    .neq("status", "succeeded");
  return { kind: "pending" };
}
