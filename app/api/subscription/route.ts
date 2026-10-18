import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Отмена и возобновление автопродления и отвязка карты. Отмена НЕ отключает доступ: подписка
// действует до конца оплаченного периода, просто дальше не списываем. Пишет только сервер.
// Отвязка карты: платёжный токен удаляется из нашей базы (карта исчезает из системы),
// автопродление отключается, доступ сохраняется до конца оплаченного периода.

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!getSupabaseEnv()) return json({ error: "not_configured" }, 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const admin = createAdminClient();
  if (!admin) return json({ error: "not_configured" }, 503);

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== "cancel" && action !== "resume" && action !== "unlink_card") return json({ error: "bad_action" }, 400);

  const now = new Date().toISOString();

  if (action === "unlink_card") {
    const { data: unlinked, error: unlinkError } = await admin
      .from("subscriptions")
      .update({ yookassa_payment_method_id: null, card_last4: null, card_type: null, updated_at: now })
      .eq("user_id", user.id)
      .select("current_period_end");
    if (unlinkError) {
      console.log(`YK: card unlink failed: ${unlinkError.message}`);
      return json({ error: "failed" }, 500);
    }
    if (!unlinked || unlinked.length === 0) return json({ error: "not_found" }, 404);
    // Без карты продлевать нечем: отменяем автопродление (доступ — до конца периода).
    await admin
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: now, updated_at: now })
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"]);
    console.log(`YK: card unlinked for user ${user.id}`);
    return json({ ok: true, periodEnd: (unlinked[0] as { current_period_end: string | null }).current_period_end });
  }

  if (action === "resume") {
    // Возобновить можно только с привязанной картой — иначе списывать нечем.
    const { data: current } = await admin
      .from("subscriptions")
      .select("yookassa_payment_method_id")
      .eq("user_id", user.id)
      .maybeSingle<{ yookassa_payment_method_id: string | null }>();
    if (current && !current.yookassa_payment_method_id) return json({ error: "no_card" }, 409);
  }

  const { data, error } =
    action === "cancel"
      ? await admin
          .from("subscriptions")
          .update({ status: "canceled", canceled_at: now, updated_at: now })
          .eq("user_id", user.id)
          .in("status", ["active", "past_due"])
          .select("current_period_end")
      : await admin
          .from("subscriptions")
          .update({ status: "active", canceled_at: null, updated_at: now })
          .eq("user_id", user.id)
          .eq("status", "canceled")
          .gt("current_period_end", now)
          .select("current_period_end");
  if (error) {
    console.log(`YK: subscription ${action} failed: ${error.message}`);
    return json({ error: "failed" }, 500);
  }
  if (!data || data.length === 0) return json({ error: "not_found" }, 404);
  console.log(`YK: subscription ${action} for user ${user.id}`);
  return json({ ok: true, periodEnd: (data[0] as { current_period_end: string | null }).current_period_end });
}
