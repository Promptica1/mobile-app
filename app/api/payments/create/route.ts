import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPaidPlan, planDescription, planPrice } from "@/lib/billing.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createPayment, YooKassaError } from "@/lib/yookassa";

// Создаёт платёж в ЮKassa для тарифа и возвращает ссылку на страницу оплаты ЮKassa.
// Сумма и описание — только с сервера; браузер присылает лишь id тарифа. Логи — "YK:".

const fail = (reason: string, status: number) => {
  console.log(`YK: create error = ${reason} (HTTP ${status})`);
  return NextResponse.json({ error: reason }, { status });
};

export async function POST(request: NextRequest) {
  if (!getSupabaseEnv()) return fail("not_configured", 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);

  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  const plan = body?.plan;
  if (!isPaidPlan(plan)) return fail("bad_plan", 400);

  const admin = createAdminClient();
  if (!admin) return fail("not_configured", 503);

  // Уже оформлен этот же тариф и он действует (в т.ч. отменённый до конца периода —
  // его можно возобновить без оплаты) — второй раз не списываем.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle<{ plan: string; status: string; current_period_end: string | null }>();
  if (sub?.plan === plan && (sub.status === "active" || sub.status === "canceled") && sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
    return fail("already_subscribed", 409);
  }

  // Наш номер заказа: по нему вернёмся с оплаты и найдём платёж.
  const orderId = randomUUID();
  const amount = planPrice(plan);
  const { error: insertError } = await admin
    .from("payments")
    .insert({ id: orderId, user_id: user.id, plan, amount, status: "pending", test: true });
  if (insertError) {
    console.log(`YK: payments insert failed: ${insertError.message}`);
    return fail("db_failed", 500);
  }

  const base = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
  try {
    const payment = await createPayment({
      amount,
      description: planDescription(plan),
      returnUrl: `${base}/profile/subscription/result?order=${orderId}`,
      metadata: { user_id: user.id, plan, order_id: orderId },
      // Новый ключ на каждый заказ: повтор этого же запроса не создаст второй платёж.
      idempotenceKey: orderId,
    });
    const url = payment.confirmation?.confirmation_url;
    if (!url) throw new YooKassaError("failed", "no confirmation_url");
    await admin
      .from("payments")
      .update({ yookassa_payment_id: payment.id, status: payment.status, test: payment.test, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    console.log(`YK: payment created ${payment.id} for order ${orderId}, plan = ${plan}, test = ${payment.test}`);
    return NextResponse.json({ confirmationUrl: url, orderId });
  } catch (error) {
    const reason = error instanceof YooKassaError ? error.reason : "failed";
    console.log(`YK: create failed (${reason}): ${error instanceof Error ? error.message : String(error)}`);
    await admin
      .from("payments")
      .update({ status: "canceled", cancellation_reason: `create_${reason}`, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return fail(reason, reason === "failed" ? 502 : 503);
  }
}
