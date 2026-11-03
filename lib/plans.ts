// Тарифы подписки (ЮKassa, рубли). Цены везде показываем через formatPrice.
// Для Stripe (доллары) — отдельные предложения в lib/stripe/rules.ts.

export type PlanId = "free" | "premium";

// Тексты тарифов (название, описание, список возможностей) — в переводах: plans.<id>.*
// (name, tagline, f1…fN, badge). Здесь только числа и устойчивые поля.
export type Plan = {
  id: PlanId;
  // Фирменное название платного тарифа (одинаково на всех языках, идёт в платёж и чек).
  name: string;
  // Цена в рублях за месяц (0 — бесплатно).
  price: number;
  // Сколько credits (токенов) даёт тариф: обновляются каждый период и не накапливаются.
  tokens: number;
  // Сколько пунктов в списке возможностей (plans.<id>.f1…fN).
  features: number;
  // Есть ли плашка «Популярный» (plans.<id>.badge).
  badge?: boolean;
};

export const PLANS: Plan[] = [
  { id: "free", name: "Free", price: 0, tokens: 10, features: 3 },
  { id: "premium", name: "Premium", price: 1499, tokens: 60, features: 4, badge: true },
];

// Старые значения из базы (например, снятый тариф «premium_plus») читаем как Premium.
export const getPlan = (id: string): Plan => PLANS.find((p) => p.id === id) ?? (PLANS.find((p) => p.id === "premium") as Plan);

export type BillingInterval = "month" | "year";

// Годовой Premium в ЮKassa: платится раз в год, credits начисляются каждый месяц (баланс сбрасывается до tokens).
export const RU_ANNUAL = { price: 10990 } as const;
export const priceFor = (id: string, interval: BillingInterval = "month") => (interval === "year" ? RU_ANNUAL.price : getPlan(id).price);
// На сколько процентов год дешевле двенадцати месяцев по месячной цене (для подписи на экране).
export const ruAnnualSavingPercent = () => Math.round((1 - RU_ANNUAL.price / (getPlan("premium").price * 12)) * 100);

// Триал в ЮKassa: отдельный платёж с сохранением карты, через TRIAL_DAYS дней — автосписание цены Premium.
// Доступен только тому, у кого никогда не было ни оплаты, ни триала (правило проверяет база).
export const RU_TRIAL = { price: 399, days: 7, credits: 15 } as const;

// 1499 → «1499 ₽», 10990 → «10 990 ₽» (ru, с неразрывными пробелами) / «₽1,499» (en), 0 → «0 ₽».
export function formatPrice(rubles: number, locale = "ru"): string {
  const n = Math.round(rubles);
  // 5 и более цифр читаются лучше с пробелом: «10 990 ₽» (неразрывные пробелы).
  if (locale === "ru") return `${n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") : n}\u00a0₽`;
  return `₽${n.toLocaleString(locale)}`;
}

// Если автосписание не прошло — доступ сохраняется ещё столько дней, пока пробуем списать снова.
export const RENEWAL_GRACE_DAYS = 3;
