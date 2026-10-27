// Правила Stripe-тарифов: что входит в каждое предложение и сколько credits когда начисляется.
// Файл без зависимостей — его же проверяют тесты (tests/stripe-rules.test.ts).
// Суммы в долларах — для показа на экране; реальное списание задают цены (Price) в Stripe.

export type Offer = "trial" | "trial_free" | "annual" | "monthly";
export const OFFERS: readonly Offer[] = ["trial", "trial_free", "annual", "monthly"];
export const isOffer = (v: unknown): v is Offer => typeof v === "string" && (OFFERS as readonly string[]).includes(v);

export type OfferInfo = {
  // Цена разового платежа сейчас (триал за $4,99), 0 — нет.
  setupUsd: number;
  // Регулярная цена: за месяц или за год.
  recurringUsd: number;
  interval: "month" | "year";
  trialDays: number;
  // Credits, которые начисляются сразу после оформления.
  startCredits: number;
  // Credits, которые начисляются при каждой оплате продления (баланс сбрасывается до этого числа).
  cycleCredits: number;
  // Годовой план: Stripe списывает раз в год, credits начисляем каждый месяц (по этому числу).
  monthlyGrant: boolean;
};

export const OFFER_INFO: Record<Offer, OfferInfo> = {
  trial: { setupUsd: 4.99, recurringUsd: 9.99, interval: "month", trialDays: 5, startCredits: 15, cycleCredits: 30, monthlyGrant: false },
  trial_free: { setupUsd: 0, recurringUsd: 9.99, interval: "month", trialDays: 3, startCredits: 5, cycleCredits: 30, monthlyGrant: false },
  annual: { setupUsd: 0, recurringUsd: 49.99, interval: "year", trialDays: 0, startCredits: 25, cycleCredits: 25, monthlyGrant: true },
  monthly: { setupUsd: 0, recurringUsd: 9.99, interval: "month", trialDays: 0, startCredits: 30, cycleCredits: 30, monthlyGrant: false },
};

// Какое предложение активно в варианте «триал за $4,99» и в варианте B (бесплатные 3 дня).
export const trialOffer = (freeTrial: boolean): Offer => (freeTrial ? "trial_free" : "trial");
export const isTrialOffer = (o: Offer) => o === "trial" || o === "trial_free";

// Credits при оформлении (checkout.session.completed).
export const creditsOnCheckout = (o: Offer) => OFFER_INFO[o].startCredits;
// Credits при оплате очередного периода (invoice.paid, billing_reason = subscription_cycle).
// Первая оплата после триала — тоже «очередной период»: баланс становится 30.
export const creditsOnCycle = (o: Offer) => OFFER_INFO[o].cycleCredits;

// Годовой план: следующий месячный пакет credits после даты from (месяцы считаем от даты оплаты).
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// Когда начислять следующий месячный пакет годовому плану после даты last. Даты считаем от начала
// оплаченного года (конец периода минус 12 месяцев), поэтому 31-е число не «сползает» на 28-е.
// null — до конца периода пакетов больше нет (следующий придёт вместе с оплатой продления).
export function nextMonthlyGrant(offer: Offer, last: Date, periodEnd: Date | null): Date | null {
  if (!OFFER_INFO[offer].monthlyGrant) return null;
  const anchor = periodEnd ? addMonths(periodEnd, -12) : last;
  for (let k = 1; k <= 12; k++) {
    const next = addMonths(anchor, k);
    if (next <= last) continue;
    return periodEnd && next >= periodEnd ? null : next;
  }
  return null;
}

// Почта для проверки «один триал на человека»: приводим к одному виду, чтобы не обходили
// заглавными буквами, «+метками» и точками в Gmail.
export function normalizeEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  let domain = rawDomain;
  if (domain === "googlemail.com") domain = "gmail.com";
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

// Статус подписки Stripe → наш статус (subscriptions.status).
export type OurStatus = "active" | "canceled" | "past_due" | "expired";
export function mapStatus(stripeStatus: string, cancelAtPeriodEnd: boolean): OurStatus | null {
  switch (stripeStatus) {
    case "trialing":
    case "active":
      // Продление отключено, но оплаченный период ещё идёт — как «отменена» у ЮKassa.
      return cancelAtPeriodEnd ? "canceled" : "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return "expired";
    default:
      // incomplete — оплата ещё не прошла, подписку не включаем.
      return null;
  }
}

// Письмо «триал заканчивается»: за сколько часов до конца триала отправлять (ежедневный cron
// поймает окно 12–36 часов — для 5-дневного триала это 4-й день).
export const TRIAL_REMINDER_HOURS = 36;
// Напоминание о продлении годового плана — за 7 дней.
export const ANNUAL_REMINDER_DAYS = 7;
