import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { handleStripeEvent, emailHash, type RawEvent } from "../lib/stripe/webhook.ts";
import type { Deps, Store, StripeApi, StripeSub, SubscriptionRef, TrialClaim } from "../lib/stripe/types.ts";
import type { Offer } from "../lib/stripe/rules.ts";

// Обработчик webhook на заглушках Stripe и базы. Заглушка базы повторяет правила SQL-функций
// (их саму проверяет supabase/tests/stripe_credits_trial.sql на настоящей Postgres).

const NOW = new Date("2026-11-01T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

type Db = {
  emails: Record<string, string>;
  rows: Map<string, { sub: StripeSub; offer: Offer; next: Date | null }>;
  balance: Map<string, number>;
  grants: Set<string>;
  claims: { userId: string; emailHash: string; sub: string; fp: string | null }[];
  canceled: string[];
  refunded: string[];
  mails: { to: string; offer: Offer }[];
  customers: Record<string, string>;
};

let db: Db;
let stripeSubs: Map<string, StripeSub>;
let deps: Deps;

function makeSub(over: Partial<StripeSub> & { id: string }): StripeSub {
  return {
    customerId: "cus_1",
    status: "trialing",
    cancelAtPeriodEnd: false,
    startedAt: NOW,
    periodStart: NOW,
    periodEnd: day(5),
    trialEnd: day(5),
    interval: "month",
    userId: "u1",
    offer: "trial",
    card: { last4: "4242", brand: "visa", fingerprint: "fp_A" },
    live: false,
    ...over,
  };
}

beforeEach(() => {
  db = { emails: { u1: "Anna@Example.com", u2: "anna+2@example.com", u3: "other@example.com" }, rows: new Map(), balance: new Map(), grants: new Set(), claims: [], canceled: [], refunded: [], mails: [], customers: {} };
  stripeSubs = new Map();
  for (const u of ["u1", "u2", "u3"]) db.balance.set(u, 10);

  const api: StripeApi = {
    async retrieveSubscription(id) {
      const s = stripeSubs.get(id);
      if (!s) throw new Error(`no sub ${id}`);
      return s;
    },
    async cancelNow(id) {
      db.canceled.push(id);
      const s = stripeSubs.get(id);
      if (s) stripeSubs.set(id, { ...s, status: "canceled" });
    },
    async refundLatestCharge(customerId) {
      db.refunded.push(customerId);
    },
    async applySetupSession() {
      return { subscriptionId: "sub_1" };
    },
  };
  const store: Store = {
    async userEmail(u) {
      return db.emails[u] ?? null;
    },
    async saveCustomer(u, c) {
      db.customers[u] = c;
    },
    async subscriptionRef(u): Promise<SubscriptionRef> {
      const r = db.rows.get(u);
      return r ? { stripeSubscriptionId: r.sub.id, status: r.sub.status === "canceled" ? "expired" : "active", plan: "premium" } : null;
    },
    async userBySubscription(id) {
      for (const [u, r] of db.rows) if (r.sub.id === id) return u;
      return null;
    },
    async upsertSubscription(u, sub, offer, next) {
      db.rows.set(u, { sub, offer, next });
    },
    async claimTrial(userId, hash, subId, fp): Promise<TrialClaim> {
      if (db.claims.some((c) => c.sub === subId)) return "ok";
      if (db.claims.some((c) => c.userId === userId)) return "user_used";
      if (db.claims.some((c) => c.emailHash === hash)) return "email_used";
      if (fp && db.claims.some((c) => c.fp === fp)) return "card_used";
      db.claims.push({ userId, emailHash: hash, sub: subId, fp });
      return "ok";
    },
    async grantCredits(key, u, _s, credits) {
      if (db.grants.has(key)) return false;
      db.grants.add(key);
      db.balance.set(u, credits);
      return true;
    },
    async expireCredits(u) {
      db.balance.set(u, 0);
    },
  };
  deps = {
    api,
    store,
    mailer: { async purchase(to, info) { db.mails.push({ to, offer: info.offer }); } },
    now: () => NOW,
    log: () => {},
  };
});

const checkout = (id: string, sub: string, extra: Record<string, unknown> = {}): RawEvent => ({
  id: `evt_${id}`,
  type: "checkout.session.completed",
  data: { object: { id, mode: "subscription", payment_status: "paid", subscription: sub, customer: "cus_1", client_reference_id: "u1", metadata: { user_id: "u1", offer: "trial" }, ...extra } },
});
const invoicePaid = (id: string, sub: string, reason: string): RawEvent => ({
  id: `evt_${id}`,
  type: "invoice.paid",
  data: { object: { id, billing_reason: reason, parent: { subscription_details: { subscription: sub } } } },
});
const subEvent = (type: string, id: string): RawEvent => ({ id: `evt_${type}_${id}`, type, data: { object: { id } } });

test("триал $4,99: при оформлении 15 credits, письмо уходит один раз", async () => {
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  assert.equal(await handleStripeEvent(deps, checkout("cs_1", "sub_1")), "activated");
  assert.equal(db.balance.get("u1"), 15);
  assert.equal(db.mails.length, 1);
  assert.equal(db.rows.get("u1")?.offer, "trial");
  assert.equal(db.customers.u1, "cus_1");
  // Stripe повторил доставку — ничего не меняется.
  db.balance.set("u1", 11); // успел потратить 4
  assert.equal(await handleStripeEvent(deps, checkout("cs_1", "sub_1")), "already_applied");
  assert.equal(db.balance.get("u1"), 11);
  assert.equal(db.mails.length, 1);
});

test("вариант B: бесплатные 3 дня дают 5 credits", async () => {
  stripeSubs.set("sub_b", makeSub({ id: "sub_b", offer: "trial_free", trialEnd: day(3), periodEnd: day(3) }));
  await handleStripeEvent(deps, checkout("cs_b", "sub_b", { metadata: { user_id: "u1", offer: "trial_free" } }));
  assert.equal(db.balance.get("u1"), 5);
});

test("после триала первая оплата $9,99 сбрасывает баланс до 30; повтор webhook не начисляет второй раз", async () => {
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  await handleStripeEvent(deps, checkout("cs_1", "sub_1"));
  db.balance.set("u1", 3); // за триал потратил почти всё
  stripeSubs.set("sub_1", makeSub({ id: "sub_1", status: "active", trialEnd: day(5), periodStart: day(5), periodEnd: day(35) }));
  assert.equal(await handleStripeEvent(deps, invoicePaid("in_2", "sub_1", "subscription_cycle")), "activated");
  assert.equal(db.balance.get("u1"), 30, "30, а не 3+30: неиспользованное сгорает");
  db.balance.set("u1", 12);
  assert.equal(await handleStripeEvent(deps, invoicePaid("in_2", "sub_1", "subscription_cycle")), "already_applied");
  assert.equal(db.balance.get("u1"), 12);
  assert.equal(db.rows.get("u1")?.sub.status, "active");
});

test("первый счёт подписки (subscription_create) credits не начисляет — это делает checkout", async () => {
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  await handleStripeEvent(deps, checkout("cs_1", "sub_1"));
  db.balance.set("u1", 9);
  assert.equal(await handleStripeEvent(deps, invoicePaid("in_1", "sub_1", "subscription_create")), "synced");
  assert.equal(db.balance.get("u1"), 9);
});

test("Premium annual: 25 credits при оплате, дальше — месячные пакеты по cron, в продление снова 25", async () => {
  stripeSubs.set("sub_a", makeSub({ id: "sub_a", offer: "annual", status: "active", interval: "year", trialEnd: null, periodStart: NOW, periodEnd: day(365) }));
  await handleStripeEvent(deps, checkout("cs_a", "sub_a", { metadata: { user_id: "u1", offer: "annual" } }));
  assert.equal(db.balance.get("u1"), 25);
  assert.equal(db.rows.get("u1")?.next?.toISOString(), "2026-12-01T12:00:00.000Z", "следующий пакет — через месяц");
  // Через год Stripe списывает продление.
  stripeSubs.set("sub_a", makeSub({ id: "sub_a", offer: "annual", status: "active", interval: "year", trialEnd: null, periodStart: day(365), periodEnd: day(730) }));
  db.balance.set("u1", 1);
  await handleStripeEvent(deps, invoicePaid("in_y2", "sub_a", "subscription_cycle"));
  assert.equal(db.balance.get("u1"), 25);
});

test("один триал на человека: тот же человек с другой почтой-алиасом и той же картой получает отказ и возврат денег", async () => {
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  assert.equal(await handleStripeEvent(deps, checkout("cs_1", "sub_1")), "activated");

  // Другой аккаунт, но та же почта с «+меткой» — отказ.
  stripeSubs.set("sub_2", makeSub({ id: "sub_2", userId: "u2", customerId: "cus_2", card: { last4: "1111", brand: "visa", fingerprint: "fp_B" } }));
  assert.equal(emailHash(db.emails.u1), emailHash(db.emails.u2));
  const r1 = await handleStripeEvent(deps, checkout("cs_2", "sub_2", { customer: "cus_2", client_reference_id: "u2", metadata: { user_id: "u2", offer: "trial" } }));
  assert.equal(r1, "trial_rejected");
  assert.deepEqual(db.canceled, ["sub_2"]);
  assert.deepEqual(db.refunded, ["cus_2"]);
  assert.equal(db.balance.get("u2"), 10, "credits не начислены");
  assert.equal(db.rows.has("u2"), false, "подписка не создана");

  // Другая почта, но та же карта — тоже отказ.
  stripeSubs.set("sub_3", makeSub({ id: "sub_3", userId: "u3", customerId: "cus_3" })); // fingerprint fp_A, как у первого
  const r2 = await handleStripeEvent(deps, checkout("cs_3", "sub_3", { customer: "cus_3", client_reference_id: "u3", metadata: { user_id: "u3", offer: "trial" } }));
  assert.equal(r2, "trial_rejected");
  assert.equal(db.balance.get("u3"), 10);
  assert.equal(db.rows.has("u3"), false);
});

test("один триал на человека: новый человек с новой картой и почтой получает триал", async () => {
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  await handleStripeEvent(deps, checkout("cs_1", "sub_1"));
  stripeSubs.set("sub_3", makeSub({ id: "sub_3", userId: "u3", customerId: "cus_3", card: { last4: "5555", brand: "mastercard", fingerprint: "fp_C" } }));
  const r = await handleStripeEvent(deps, checkout("cs_3", "sub_3", { customer: "cus_3", client_reference_id: "u3", metadata: { user_id: "u3", offer: "trial" } }));
  assert.equal(r, "activated");
  assert.equal(db.balance.get("u3"), 15);
});

test("отклонённый триал не обнуляет credits действующей подписки пользователя", async () => {
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  await handleStripeEvent(deps, checkout("cs_1", "sub_1"));
  // Второй триал того же пользователя (две вкладки Checkout): отклонён, подписка отменена.
  stripeSubs.set("sub_dup", makeSub({ id: "sub_dup", card: { last4: "9999", brand: "visa", fingerprint: "fp_Z" } }));
  assert.equal(await handleStripeEvent(deps, checkout("cs_dup", "sub_dup")), "trial_rejected");
  db.balance.set("u1", 7);
  // Stripe присылает customer.subscription.deleted по отменённой дубликат-подписке.
  assert.equal(await handleStripeEvent(deps, subEvent("customer.subscription.deleted", "sub_dup")), "other_subscription");
  assert.equal(db.balance.get("u1"), 7, "credits основной подписки целы");
  assert.equal(db.rows.get("u1")?.sub.id, "sub_1");
});

test("отмена продления: доступ остаётся, credits не трогаем; окончание подписки обнуляет credits", async () => {
  stripeSubs.set("sub_m", makeSub({ id: "sub_m", offer: "monthly", status: "active", trialEnd: null, periodEnd: day(30) }));
  await handleStripeEvent(deps, checkout("cs_m", "sub_m", { metadata: { user_id: "u1", offer: "monthly" } }));
  assert.equal(db.balance.get("u1"), 30);
  db.balance.set("u1", 18);

  stripeSubs.set("sub_m", makeSub({ id: "sub_m", offer: "monthly", status: "active", cancelAtPeriodEnd: true, trialEnd: null, periodEnd: day(30) }));
  assert.equal(await handleStripeEvent(deps, subEvent("customer.subscription.updated", "sub_m")), "synced");
  assert.equal(db.balance.get("u1"), 18);

  stripeSubs.set("sub_m", makeSub({ id: "sub_m", offer: "monthly", status: "canceled", trialEnd: null, periodEnd: day(30) }));
  assert.equal(await handleStripeEvent(deps, subEvent("customer.subscription.deleted", "sub_m")), "expired");
  assert.equal(db.balance.get("u1"), 0);
});

test("неудачное списание переводит подписку в past_due", async () => {
  stripeSubs.set("sub_m", makeSub({ id: "sub_m", offer: "monthly", status: "active", trialEnd: null }));
  await handleStripeEvent(deps, checkout("cs_m", "sub_m", { metadata: { user_id: "u1", offer: "monthly" } }));
  stripeSubs.set("sub_m", makeSub({ id: "sub_m", offer: "monthly", status: "past_due", trialEnd: null }));
  const e: RawEvent = { id: "evt_f", type: "invoice.payment_failed", data: { object: { id: "in_f", billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: "sub_m" } } } } };
  assert.equal(await handleStripeEvent(deps, e), "synced");
  assert.equal(db.rows.get("u1")?.sub.status, "past_due");
});

test("лишние события и неоплаченные сессии игнорируются", async () => {
  assert.equal(await handleStripeEvent(deps, { id: "e", type: "charge.succeeded", data: { object: {} } }), "ignored");
  stripeSubs.set("sub_1", makeSub({ id: "sub_1" }));
  assert.equal(await handleStripeEvent(deps, checkout("cs_u", "sub_1", { payment_status: "unpaid" })), "pending");
  assert.equal(db.balance.get("u1"), 10);
});
