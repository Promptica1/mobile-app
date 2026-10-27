import "server-only";
import Stripe from "stripe";
import { isOffer } from "./rules";
import type { StripeApi, StripeCard, StripeSub } from "./types";

// Stripe API. Только сервер: ключи STRIPE_SECRET_KEY и STRIPE_WEBHOOK_SECRET — в переменных
// окружения, в браузер и логи не попадают. Логи — "STRIPE:".
//
// Режим определяется ключом: sk_test_… (или rk_test_…) — тестовый, sk_live_… (rk_live_…) — боевой.

export class StripeConfigError extends Error {
  constructor(public reason: "not_configured" | "bad_key") {
    super(reason);
  }
}

const KEY_RE = /^(sk|rk)_(test|live)_/;

export function stripeIsTest() {
  return !/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
}

// Цены (Price) из Stripe Dashboard: создаются один раз, их id — в переменных окружения.
export const stripePrices = () => ({
  trialSetup: process.env.STRIPE_PRICE_TRIAL_SETUP?.trim() || null, // разово $4,99
  monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY?.trim() || null, // $9,99 в месяц
  annual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL?.trim() || null, // $49,99 в год
});

export function stripeMode() {
  const test = stripeIsTest();
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { available: false, test, reason: "not_configured" } as const;
  if (!KEY_RE.test(key)) return { available: false, test, reason: "bad_key" } as const;
  const p = stripePrices();
  if (!p.monthly || !p.annual || !p.trialSetup) return { available: false, test, reason: "no_prices" } as const;
  return { available: true, test } as const;
}

let cached: { key: string; client: Stripe } | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new StripeConfigError("not_configured");
  if (!KEY_RE.test(key)) throw new StripeConfigError("bad_key");
  if (cached?.key !== key) {
    // STRIPE_API_URL — только для проверок на тестовом стенде (поддельный сервер вместо api.stripe.com).
    const override = process.env.STRIPE_API_URL ? new URL(process.env.STRIPE_API_URL) : null;
    cached = {
      key,
      client: new Stripe(key, {
        timeout: 20_000,
        maxNetworkRetries: 2,
        ...(override
          ? { host: override.hostname, port: override.port, protocol: override.protocol.replace(":", "") as "http" | "https" }
          : {}),
      }),
    };
  }
  return cached.client;
}

const date = (unix: number | null | undefined) => (typeof unix === "number" ? new Date(unix * 1000) : null);

function cardOf(pm: Stripe.PaymentMethod | string | null | undefined): StripeCard | null {
  if (!pm || typeof pm === "string" || !pm.card) return null;
  return { last4: pm.card.last4 ?? null, brand: pm.card.brand ?? null, fingerprint: pm.card.fingerprint ?? null };
}

// Карта подписки: основная карта подписки → основная карта клиента → любая карта клиента.
async function findCard(stripe: Stripe, sub: Stripe.Subscription): Promise<StripeCard | null> {
  const own = cardOf(sub.default_payment_method);
  if (own) return own;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const customer = await stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] });
  if (!("deleted" in customer && customer.deleted)) {
    const viaCustomer = cardOf((customer as Stripe.Customer).invoice_settings?.default_payment_method);
    if (viaCustomer) return viaCustomer;
  }
  const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  return cardOf(list.data[0]);
}

export function mapSubscription(sub: Stripe.Subscription, card: StripeCard | null): StripeSub {
  const item = sub.items.data[0];
  const interval = item?.price?.recurring?.interval;
  const offer = sub.metadata?.offer;
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    startedAt: date(sub.start_date) ?? new Date(),
    periodStart: date(item?.current_period_start),
    periodEnd: date(item?.current_period_end),
    trialEnd: date(sub.trial_end),
    interval: interval === "year" ? "year" : interval === "month" ? "month" : null,
    userId: sub.metadata?.user_id || null,
    offer: isOffer(offer) ? offer : null,
    card,
    live: sub.livemode,
  };
}

export function createStripeApi(stripe: Stripe = getStripe()): StripeApi {
  return {
    async retrieveSubscription(id) {
      const sub = await stripe.subscriptions.retrieve(id, { expand: ["default_payment_method"] });
      return mapSubscription(sub, await findCard(stripe, sub));
    },
    async cancelNow(id) {
      await stripe.subscriptions.cancel(id, { prorate: false });
    },
    async refundLatestCharge(customerId) {
      const charges = await stripe.charges.list({ customer: customerId, limit: 1 });
      const charge = charges.data[0];
      if (!charge || !charge.paid || charge.refunded) return;
      await stripe.refunds.create({ charge: charge.id });
    },
    async applySetupSession(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });
      const intent = session.setup_intent;
      const pm = intent && typeof intent !== "string" ? intent.payment_method : null;
      const pmId = typeof pm === "string" ? pm : pm?.id;
      const subscriptionId = session.metadata?.subscription_id;
      if (!pmId || !subscriptionId) return null;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      await stripe.subscriptions.update(subscriptionId, { default_payment_method: pmId });
      if (customerId) await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } });
      return { subscriptionId };
    },
  };
}
