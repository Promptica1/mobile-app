import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapStatus, OFFER_INFO, type Offer } from "./rules";
import type { Store, StripeSub, SubscriptionRef, TrialClaim } from "./types";

// Запись в нашу базу (сервисный ключ). Все изменения credits и триала — через SQL-функции
// (supabase/migrations/20261015120000_stripe.sql), они атомарны и не дают начислить дважды.
export function createStore(admin: SupabaseClient): Store {
  return {
    async userEmail(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      return error ? null : data.user?.email || null;
    },
    async saveCustomer(userId, customerId) {
      const { error } = await admin.from("stripe_customers").upsert({ user_id: userId, customer_id: customerId }, { onConflict: "user_id" });
      if (error) throw new Error(`save customer: ${error.message}`);
    },
    async subscriptionRef(userId): Promise<SubscriptionRef> {
      const { data, error } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id, status, plan")
        .eq("user_id", userId)
        .maybeSingle<{ stripe_subscription_id: string | null; status: string; plan: string }>();
      if (error) throw new Error(`subscription ref: ${error.message}`);
      return data ? { stripeSubscriptionId: data.stripe_subscription_id, status: data.status, plan: data.plan } : null;
    },
    async userBySubscription(subscriptionId) {
      const { data } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle<{ user_id: string }>();
      return data?.user_id ?? null;
    },
    async upsertSubscription(userId: string, sub: StripeSub, offer: Offer, creditsNextGrantAt: Date | null) {
      const status = mapStatus(sub.status, sub.cancelAtPeriodEnd);
      if (!status) return;
      const now = new Date().toISOString();
      const row: Record<string, unknown> = {
        user_id: userId,
        plan: "premium",
        status,
        provider: "stripe",
        current_period_end: sub.periodEnd?.toISOString() ?? null,
        stripe_customer_id: sub.customerId,
        stripe_subscription_id: sub.id,
        offer,
        billing_interval: sub.interval ?? OFFER_INFO[offer].interval,
        is_trial: sub.status === "trialing",
        trial_end: sub.trialEnd?.toISOString() ?? null,
        credits_next_grant_at: creditsNextGrantAt?.toISOString() ?? null,
        card_last4: sub.card?.last4 ?? null,
        card_type: sub.card?.brand ?? null,
        yookassa_payment_method_id: null,
        test: !sub.live,
        updated_at: now,
      };
      if (status === "canceled") row.canceled_at = now;
      else if (status === "active") row.canceled_at = null;
      const { data: existing } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle<{ stripe_subscription_id: string | null }>();
      // Новая подписка (или первая) — запоминаем начало; для той же подписки начало не трогаем.
      if (existing?.stripe_subscription_id !== sub.id) row.started_at = sub.startedAt.toISOString();
      const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(`subscription upsert: ${error.message}`);
    },
    async claimTrial(userId, emailHash, subscriptionId, fingerprint): Promise<TrialClaim> {
      const { data, error } = await admin.rpc("claim_trial", {
        p_user: userId,
        p_email_hash: emailHash,
        p_subscription_id: subscriptionId,
        p_fingerprint: fingerprint,
      });
      if (error) throw new Error(`claim trial: ${error.message}`);
      return data as TrialClaim;
    },
    async grantCredits(key, userId, source, credits) {
      const { data, error } = await admin.rpc("grant_credits", { p_key: key, p_user: userId, p_source: source, p_credits: credits });
      if (error) throw new Error(`grant credits: ${error.message}`);
      return data === true;
    },
    async expireCredits(userId) {
      const { error } = await admin.rpc("expire_credits", { p_user: userId });
      if (error) throw new Error(`expire credits: ${error.message}`);
    },
  };
}
