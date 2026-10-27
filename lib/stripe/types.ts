import type { Offer } from "./rules.ts";

// Нормализованные данные Stripe и зависимости обработчика. Так логика не привязана к версии SDK
// и проверяется тестами на заглушках (tests/stripe-webhook.test.ts).

export type StripeCard = { last4: string | null; brand: string | null; fingerprint: string | null };

export type StripeSub = {
  id: string;
  customerId: string;
  status: string; // trialing / active / past_due / canceled / unpaid / incomplete …
  cancelAtPeriodEnd: boolean;
  startedAt: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  trialEnd: Date | null;
  interval: "month" | "year" | null;
  userId: string | null; // metadata.user_id, который мы кладём при создании Checkout
  offer: Offer | null; // metadata.offer
  card: StripeCard | null;
  live: boolean;
};

export type SessionInfo = {
  id: string;
  mode: string; // subscription / setup / payment
  paymentStatus: string; // paid / unpaid / no_payment_required
  subscriptionId: string | null;
  customerId: string | null;
  userId: string | null;
  metadata: Record<string, string>;
};

export type InvoiceInfo = {
  id: string;
  billingReason: string | null; // subscription_create / subscription_cycle / …
  subscriptionId: string | null;
};

export type TrialClaim = "ok" | "user_used" | "email_used" | "card_used";

export interface StripeApi {
  retrieveSubscription(id: string): Promise<StripeSub>;
  // Отменить подписку сразу (триал отклонён).
  cancelNow(id: string): Promise<void>;
  // Вернуть деньги за последний платёж клиента (разовые $4,99 за триал).
  refundLatestCharge(customerId: string): Promise<void>;
  // Смена карты: платёжный способ из Checkout (setup) становится основным у подписки.
  applySetupSession(sessionId: string): Promise<{ subscriptionId: string } | null>;
}

export type SubscriptionRef = { stripeSubscriptionId: string | null; status: string; plan: string } | null;

export interface Store {
  userEmail(userId: string): Promise<string | null>;
  saveCustomer(userId: string, customerId: string): Promise<void>;
  subscriptionRef(userId: string): Promise<SubscriptionRef>;
  userBySubscription(subscriptionId: string): Promise<string | null>;
  upsertSubscription(userId: string, sub: StripeSub, offer: Offer, creditsNextGrantAt: Date | null): Promise<void>;
  claimTrial(userId: string, emailHash: string, subscriptionId: string, fingerprint: string | null): Promise<TrialClaim>;
  grantCredits(key: string, userId: string, source: string, credits: number): Promise<boolean>;
  expireCredits(userId: string): Promise<void>;
}

export type PurchaseMail = { offer: Offer; periodEnd: Date | null; trialEnd: Date | null };
export interface Mailer {
  purchase(to: string, info: PurchaseMail): Promise<void>;
}

export type Deps = { api: StripeApi; store: Store; mailer: Mailer; now?: () => Date; log?: (msg: string) => void };
