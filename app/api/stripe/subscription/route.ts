import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/client.server";
import { appBase, currentUser, json, stripeDeps } from "@/lib/stripe/context.server";
import { applyCheckout, parseSession, syncSubscription, type RawEvent } from "@/lib/stripe/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Управление подпиской Stripe: отмена и возобновление продления, смена и удаление карты.
// Отмена НЕ отключает доступ: подписка действует до конца оплаченного периода, дальше не списываем.
// Логи — "STRIPE:".

type Row = { stripe_subscription_id: string | null; stripe_customer_id: string | null; current_period_end: string | null; card_last4: string | null };

export async function POST(request: NextRequest) {
  if (!getSupabaseEnv()) return json({ error: "not_configured" }, 503);
  const user = await currentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const deps = stripeDeps();
  const admin = createAdminClient();
  if (!deps || !admin) return json({ error: "not_configured" }, 503);

  const body = (await request.json().catch(() => null)) as { action?: unknown; sessionId?: unknown } | null;
  const action = body?.action;
  if (action !== "cancel" && action !== "resume" && action !== "unlink_card" && action !== "change_card" && action !== "finish_card_change") {
    return json({ error: "bad_action" }, 400);
  }

  const { data: row } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, current_period_end, card_last4")
    .eq("user_id", user.id)
    .eq("provider", "stripe")
    .maybeSingle<Row>();
  if (!row?.stripe_subscription_id || !row.stripe_customer_id) return json({ error: "not_found" }, 404);
  const subId = row.stripe_subscription_id;
  const customerId = row.stripe_customer_id;
  const stripe = getStripe();

  try {
    if (action === "cancel") {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    } else if (action === "resume") {
      // Возобновить можно, пока период не закончился и есть карта, с которой списывать.
      if (!row.current_period_end || new Date(row.current_period_end) <= new Date()) return json({ error: "expired" }, 409);
      if (!row.card_last4) return json({ error: "no_card" }, 409);
      await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
    } else if (action === "unlink_card") {
      // Без карты продлевать нечем: отключаем продление (доступ — до конца периода) и удаляем карты клиента.
      await stripe.subscriptions.update(subId, { cancel_at_period_end: true, default_payment_method: "" });
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: "" } }).catch(() => null);
      const cards = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 20 });
      for (const pm of cards.data) await stripe.paymentMethods.detach(pm.id);
    } else if (action === "change_card") {
      const base = appBase(request);
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        customer: customerId,
        currency: "usd",
        allowed_payment_method_types: ["card"],
        metadata: { user_id: user.id, subscription_id: subId },
        success_url: `${base}/profile/subscription/manage?card_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/profile/subscription/manage`,
      });
      if (!session.url) throw new Error("no session url");
      return json({ url: session.url });
    } else {
      // Возврат со страницы смены карты: применяем её так же, как webhook (повтор безопасен).
      const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
      if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json({ error: "bad_order" }, 400);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const info = parseSession(session as unknown as RawEvent["data"]["object"]);
      if (info.userId !== user.id || info.metadata.subscription_id !== subId || session.status !== "complete") {
        return json({ error: "not_found" }, 404);
      }
      await applyCheckout(deps, info);
      return json({ ok: true });
    }
    await syncSubscription(deps, subId);
  } catch (error) {
    console.log(`STRIPE: subscription action ${String(action)} failed: ${error instanceof Error ? error.message : String(error)}`);
    return json({ error: "failed" }, 502);
  }

  const { data: after } = await admin
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", user.id)
    .maybeSingle<{ current_period_end: string | null }>();
  console.log(`STRIPE: subscription ${subId} action ${String(action)} done for user ${user.id}`);
  return json({ ok: true, periodEnd: after?.current_period_end ?? null });
}
