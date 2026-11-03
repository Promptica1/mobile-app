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

// Триал в ЮKassa: отдельный платёж с сохранением карты, через TRIAL_DAYS дней — автосписание цены Premium.
// Доступен только тому, у кого никогда не было ни оплаты, ни триала (правило проверяет база).
export const RU_TRIAL = { price: 399, days: 7, credits: 15 } as const;

// 1499 → «1499 ₽» (ru, с неразрывным пробелом) / «₽1,499» (en), 0 → «0 ₽».
export function formatPrice(rubles: number, locale = "ru"): string {
  const n = Math.round(rubles);
  if (locale === "ru") return `${n}\u00a0₽`;
  return `₽${n.toLocaleString(locale)}`;
}

// Если автосписание не прошло — доступ сохраняется ещё столько дней, пока пробуем списать снова.
export const RENEWAL_GRACE_DAYS = 3;
