import { createHash } from "node:crypto";
import {
  addMonths,
  creditsOnCheckout,
  creditsOnCycle,
  isOffer,
  isTrialOffer,
  mapStatus,
  nextMonthlyGrant,
  normalizeEmail,
  OFFER_INFO,
  type Offer,
} from "./rules.ts";
import type { Deps, InvoiceInfo, SessionInfo, StripeSub } from "./types.ts";

// События Stripe → действия в нашей базе. Все действия идемпотентны: Stripe повторяет доставку,
// а возврат пользователя с оплаты (/api/stripe/status) применяет тот же код ещё раз.
//
// checkout.session.completed — подписка оформлена: триал занимается за человеком (проверка карты и почты),
//                              начисляются стартовые credits, уходит письмо о покупке; смена карты (setup).
// invoice.paid               — оплачен очередной период: credits сбрасываются до числа тарифа.
// invoice.payment_failed     — списание не прошло: подписка получает статус past_due.
// customer.subscription.updated / deleted — отмена продления, смена статуса, окончание подписки
//                              (при окончании оставшиеся credits обнуляются).

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const idOf = (v: unknown): string | null => str(v) ?? str(obj(v).id);

export type RawEvent = { id: string; type: string; data: { object: Raw } };

export const parseSession = (o: Raw): SessionInfo => {
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(o.metadata))) if (typeof v === "string") metadata[k] = v;
  return {
    id: String(o.id),
    mode: String(o.mode ?? ""),
    paymentStatus: String(o.payment_status ?? ""),
    subscriptionId: idOf(o.subscription),
    customerId: idOf(o.customer),
    userId: metadata.user_id ?? str(o.client_reference_id),
    metadata,
  };
};

export const parseInvoice = (o: Raw): InvoiceInfo => ({
  id: String(o.id),
  billingReason: str(o.billing_reason),
  // Новые версии API: invoice.parent.subscription_details.subscription; старые: invoice.subscription.
  subscriptionId: idOf(obj(obj(o.parent).subscription_details).subscription) ?? idOf(o.subscription),
});

export const emailHash = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex");

export type Outcome =
  | "ignored"
  | "pending"
  | "activated"
  | "already_applied"
  | "trial_rejected"
  | "setup_applied"
  | "synced"
  | "expired"
  | "other_subscription";

const now = (d: Deps) => (d.now ?? (() => new Date()))();
const log = (d: Deps, msg: string) => (d.log ?? ((m: string) => console.log(`STRIPE: ${m}`)))(msg);

// Можно ли записать эту подписку Stripe в строку пользователя: строки нет, она бесплатная/закончилась,
// или это та же подписка. Чужая (другая действующая) подписка не затирается устаревшим событием.
async function canApply(d: Deps, userId: string, sub: StripeSub) {
  const ref = await d.store.subscriptionRef(userId);
  if (!ref || ref.plan === "free" || ref.status === "expired" || !ref.stripeSubscriptionId) return true;
  return ref.stripeSubscriptionId === sub.id;
}

async function resolveUser(d: Deps, sub: StripeSub): Promise<string | null> {
  return sub.userId ?? (await d.store.userBySubscription(sub.id));
}

// Записать актуальное состояние подписки (читаем из Stripe, а не верим порядку событий).
async function sync(d: Deps, sub: StripeSub, creditsNextGrantAt?: Date | null): Promise<{ userId: string; offer: Offer } | null> {
  const userId = await resolveUser(d, sub);
  const offer = sub.offer;
  if (!userId || !offer) {
    log(d, `subscription ${sub.id}: no user/offer in metadata — ignored`);
    return null;
  }
  if (mapStatus(sub.status, sub.cancelAtPeriodEnd) === null) return null;
  if (!(await canApply(d, userId, sub))) {
    log(d, `subscription ${sub.id}: user ${userId} has another subscription — ignored`);
    return null;
  }
  const next =
    creditsNextGrantAt !== undefined
      ? creditsNextGrantAt
      : nextMonthlyGrant(offer, sub.periodStart ?? now(d), sub.periodEnd);
  await d.store.upsertSubscription(userId, sub, offer, next);
  return { userId, offer };
}

export async function applyCheckout(d: Deps, s: SessionInfo): Promise<Outcome> {
  if (s.mode === "setup") {
    const res = await d.api.applySetupSession(s.id);
    if (!res) return "ignored";
    const sub = await d.api.retrieveSubscription(res.subscriptionId);
    await sync(d, sub);
    log(d, `card changed for subscription ${sub.id}`);
    return "setup_applied";
  }
  if (s.mode !== "subscription" || !s.subscriptionId) return "ignored";
  if (s.paymentStatus !== "paid" && s.paymentStatus !== "no_payment_required") return "pending";

  const sub = await d.api.retrieveSubscription(s.subscriptionId);
  const userId = sub.userId ?? s.userId;
  const offer = sub.offer ?? (isOffer(s.metadata.offer) ? s.metadata.offer : null);
  if (!userId || !offer) {
    log(d, `session ${s.id}: no user/offer — ignored`);
    return "ignored";
  }
  const withIds: StripeSub = { ...sub, userId, offer };
  if (s.customerId || sub.customerId) await d.store.saveCustomer(userId, sub.customerId || (s.customerId as string));

  // Один триал на человека: по аккаунту, почте и отпечатку карты. Не прошёл — отменяем и возвращаем деньги.
  if (isTrialOffer(offer)) {
    const email = await d.store.userEmail(userId);
    const hash = email ? emailHash(email) : createHash("sha256").update(`user:${userId}`).digest("hex");
    const claim = await d.store.claimTrial(userId, hash, sub.id, sub.card?.fingerprint ?? null);
    if (claim !== "ok") {
      log(d, `trial rejected for user ${userId}: ${claim} — canceling ${sub.id} and refunding`);
      await d.api.cancelNow(sub.id);
      await d.api.refundLatestCharge(sub.customerId);
      return "trial_rejected";
    }
  }

  if (!(await canApply(d, userId, withIds))) return "other_subscription";
  const next = nextMonthlyGrant(offer, now(d), sub.periodEnd);
  await d.store.upsertSubscription(userId, withIds, offer, next);
  const granted = await d.store.grantCredits(`checkout:${s.id}`, userId, "checkout", creditsOnCheckout(offer));
  log(d, `checkout ${s.id}: user ${userId}, offer ${offer}, credits ${granted ? `set ${creditsOnCheckout(offer)}` : "already granted"}`);
  if (!granted) return "already_applied";

  const email = await d.store.userEmail(userId);
  if (email) {
    try {
      await d.mailer.purchase(email, { offer, periodEnd: sub.periodEnd, trialEnd: sub.trialEnd });
    } catch (e) {
      log(d, `purchase email failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return "activated";
}

export async function applyInvoicePaid(d: Deps, inv: InvoiceInfo): Promise<Outcome> {
  if (!inv.subscriptionId) return "ignored";
  const sub = await d.api.retrieveSubscription(inv.subscriptionId);
  const next =
    inv.billingReason === "subscription_cycle"
      ? nextMonthlyGrant(sub.offer ?? "monthly", sub.periodStart ?? now(d), sub.periodEnd)
      : undefined;
  const res = await sync(d, sub, next);
  if (!res) return "ignored";
  // Первая оплата (subscription_create) — credits уже начислил checkout.session.completed.
  if (inv.billingReason !== "subscription_cycle") return "synced";
  const credits = creditsOnCycle(res.offer);
  const granted = await d.store.grantCredits(`invoice:${inv.id}`, res.userId, "invoice", credits);
  log(d, `invoice ${inv.id}: user ${res.userId}, credits ${granted ? `set ${credits}` : "already granted"}`);
  return granted ? "activated" : "already_applied";
}

// Прочитать подписку из Stripe и записать в базу (после наших действий: отмена, смена карты).
export async function syncSubscription(d: Deps, subscriptionId: string): Promise<boolean> {
  return (await sync(d, await d.api.retrieveSubscription(subscriptionId))) !== null;
}

export async function handleStripeEvent(d: Deps, event: RawEvent): Promise<Outcome> {
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      return applyCheckout(d, parseSession(o));
    case "invoice.paid":
      return applyInvoicePaid(d, parseInvoice(o));
    case "invoice.payment_failed": {
      const inv = parseInvoice(o);
      if (!inv.subscriptionId) return "ignored";
      return (await sync(d, await d.api.retrieveSubscription(inv.subscriptionId))) ? "synced" : "ignored";
    }
    case "customer.subscription.updated": {
      const id = str(o.id);
      if (!id) return "ignored";
      return (await sync(d, await d.api.retrieveSubscription(id))) ? "synced" : "ignored";
    }
    case "customer.subscription.deleted": {
      const id = str(o.id);
      if (!id) return "ignored";
      const sub = await d.api.retrieveSubscription(id);
      const userId = await resolveUser(d, sub);
      if (!userId) return "ignored";
      const ref = await d.store.subscriptionRef(userId);
      // Закончилась не текущая подписка пользователя (например, отклонённый триал) — его credits не трогаем.
      if (ref?.stripeSubscriptionId !== sub.id || !sub.offer) return "other_subscription";
      await d.store.upsertSubscription(userId, { ...sub, status: "canceled", cancelAtPeriodEnd: false }, sub.offer, null);
      await d.store.expireCredits(userId);
      log(d, `subscription ${sub.id} ended: user ${userId}, credits zeroed`);
      return "expired";
    }
    default:
      return "ignored";
  }
}

export { addMonths, OFFER_INFO };
