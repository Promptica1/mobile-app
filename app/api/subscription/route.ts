import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Отмена и возобновление автопродления. Отмена НЕ отключает доступ: подписка действует
// до конца оплаченного периода, просто дальше не списываем. Пишет только сервер.

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
  if (action !== "cancel" && action !== "resume") return json({ error: "bad_action" }, 400);

  const now = new Date().toISOString();
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
