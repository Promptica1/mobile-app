import { NextResponse, type NextRequest } from "next/server";
import { applyPayment, type PaymentRow } from "@/lib/payments.server";
import { getPlan } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getPayment, YooKassaError } from "@/lib/yookassa";

// Возврат с оплаты: проверяем платёж в ЮKassa (а не верим браузеру) и при успехе
// оформляем подписку и запоминаем сохранённую карту. Повторный вызов ничего не дублирует.

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
    .maybeSingle<PaymentRow>();
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

  let outcome;
  try {
    outcome = await applyPayment(admin, row, payment, "return");
  } catch (error) {
    console.log(`YK[return]: apply failed: ${error instanceof Error ? error.message : String(error)}`);
    return json({ error: "failed" }, 502);
  }

  switch (outcome.kind) {
    case "mismatch":
      return json({ error: "mismatch" }, 409);
    case "activated":
    case "already_active": {
      // Подписку мог включить и webhook — отвечаем по данным из базы.
      const { data: sub } = await admin
        .from("subscriptions")
        .select("card_last4, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle<{ card_last4: string | null; current_period_end: string | null }>();
      return json({ status: "succeeded", plan: row.plan, planName, cardLast4: sub?.card_last4 ?? null, periodEnd: sub?.current_period_end ?? null });
    }
    case "canceled":
      return json({ status: "canceled", reason: outcome.reason, planName });
    default:
      return json({ status: "pending", planName });
  }
}
