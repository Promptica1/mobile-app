import { NextResponse, type NextRequest } from "next/server";
import { periodEnd } from "@/lib/billing.server";
import { getPlan } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getPayment, YooKassaError } from "@/lib/yookassa";

// Возврат с оплаты: проверяем платёж в ЮKassa (а не верим браузеру) и при успехе
// оформляем подписку и запоминаем сохранённую карту. Повторный вызов ничего не дублирует.

type Row = {
  id: string;
  user_id: string;
  plan: "premium" | "premium_plus";
  amount: number | string;
  status: string;
  yookassa_payment_id: string | null;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  if (!getSupabaseEnv()) return json({ error: "not_configured" }, 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const order = request.nextUrl.searchParams.get("order") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(order)) return json({ error: "bad_order" }, 400);
  const admin = createAdminClient();
  if (!admin) return json({ error: "not_configured" }, 503);

  const { data: row } = await admin
    .from("payments")
    .select("id, user_id, plan, amount, status, yookassa_payment_id")
    .eq("id", order)
    .eq("user_id", user.id)
    .maybeSingle<Row>();
  if (!row) return json({ error: "not_found" }, 404);

  const planName = getPlan(row.plan).name;
  // Уже подтверждён ранее — отвечаем из базы.
  if (row.status === "succeeded") {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("card_last4, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle<{ card_last4: string | null; current_period_end: string | null }>();
    return json({ status: "succeeded", plan: row.plan, planName, cardLast4: sub?.card_last4 ?? null, periodEnd: sub?.current_period_end ?? null });
  }
  if (!row.yookassa_payment_id) return json({ status: "canceled", reason: "create_failed", planName });

  let payment;
  try {
    payment = await getPayment(row.yookassa_payment_id);
  } catch (error) {
    console.log(`YK: status check failed: ${error instanceof Error ? error.message : String(error)}`);
    return json({ error: error instanceof YooKassaError ? error.reason : "failed" }, 502);
  }

  // Платёж должен быть именно этим заказом этого пользователя на ту же сумму.
  const amountOk = Number(payment.amount.value) === Number(row.amount) && payment.amount.currency === "RUB";
  const ownerOk = payment.metadata?.order_id === row.id && payment.metadata?.user_id === user.id;
  if (!amountOk || !ownerOk || !payment.test) {
    console.log(`YK: payment ${payment.id} mismatch (amount ${amountOk}, owner ${ownerOk}, test ${payment.test})`);
    return json({ error: "mismatch" }, 409);
  }

  const now = new Date();
  if (payment.status === "succeeded" && payment.paid) {
    const method = payment.payment_method;
    const savedMethodId = method?.saved ? method.id : null;
    await admin
      .from("payments")
      .update({ status: "succeeded", payment_method_id: method?.id ?? null, paid_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", row.id);
    const end = periodEnd(now);
    const { error: subError } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: row.plan,
        status: "active",
        started_at: now.toISOString(),
        current_period_end: end.toISOString(),
        yookassa_payment_method_id: savedMethodId,
        card_last4: method?.card?.last4 ?? null,
        card_type: method?.card?.card_type ?? null,
        last_payment_id: row.id,
        test: payment.test,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subError) console.log(`YK: subscription upsert failed: ${subError.message}`);
    console.log(`YK: payment ${payment.id} succeeded, plan = ${row.plan}, card saved = ${Boolean(savedMethodId)}`);
    return json({ status: "succeeded", plan: row.plan, planName, cardLast4: method?.card?.last4 ?? null, periodEnd: end.toISOString() });
  }

  if (payment.status === "canceled") {
    const reason = payment.cancellation_details?.reason ?? "unknown";
    await admin
      .from("payments")
      .update({ status: "canceled", cancellation_reason: reason, updated_at: now.toISOString() })
      .eq("id", row.id);
    console.log(`YK: payment ${payment.id} canceled: ${reason}`);
    return json({ status: "canceled", reason, planName });
  }

  // pending / waiting_for_capture — пользователь ещё не закончил оплату или банк думает.
  await admin.from("payments").update({ status: payment.status, updated_at: now.toISOString() }).eq("id", row.id);
  return json({ status: "pending", planName });
}
