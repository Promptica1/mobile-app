import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/client.server";
import { currentUser, json, stripeDeps } from "@/lib/stripe/context.server";
import { applyCheckout, parseSession, type RawEvent } from "@/lib/stripe/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Возврат со страницы оплаты Stripe: проверяем сессию в Stripe (а не верим браузеру) и применяем её
// тем же кодом, что и webhook. Повторный вызов ничего не дублирует.

export async function GET(request: NextRequest) {
  if (!getSupabaseEnv()) return json({ error: "not_configured" }, 503);
  const user = await currentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const sessionId = request.nextUrl.searchParams.get("session") ?? "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json({ error: "bad_order" }, 400);
  const deps = stripeDeps();
  const admin = createAdminClient();
  if (!deps || !admin) return json({ error: "not_configured" }, 503);

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return json({ error: "not_found" }, 404);
  }
  const info = parseSession(session as unknown as RawEvent["data"]["object"]);
  if (info.userId !== user.id) return json({ error: "not_found" }, 404);
  if (session.status === "expired") return json({ status: "canceled", reason: "expired" });
  if (session.status !== "complete") return json({ status: "pending" });

  let outcome;
  try {
    outcome = await applyCheckout(deps, info);
  } catch (error) {
    console.log(`STRIPE[return]: apply failed: ${error instanceof Error ? error.message : String(error)}`);
    return json({ error: "failed" }, 502);
  }
  if (outcome === "trial_rejected") return json({ status: "canceled", reason: "trial_used" });
  if (outcome === "pending") return json({ status: "pending" });

  const { data: sub } = await admin
    .from("subscriptions")
    .select("offer, is_trial, trial_end, current_period_end, card_last4")
    .eq("user_id", user.id)
    .eq("provider", "stripe")
    .maybeSingle<{ offer: string | null; is_trial: boolean; trial_end: string | null; current_period_end: string | null; card_last4: string | null }>();
  if (!sub) return json({ status: "pending" });
  return json({
    status: "succeeded",
    plan: "premium",
    planName: "Premium",
    offer: sub.offer,
    trial: sub.is_trial,
    trialEnd: sub.trial_end,
    cardLast4: sub.card_last4,
    periodEnd: sub.current_period_end,
  });
}
