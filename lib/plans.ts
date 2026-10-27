// Тарифы подписки. Цены везде показываем через formatPrice.

export type PlanId = "free" | "premium" | "premium_plus";

// Тексты тарифов (название, описание, список возможностей) — в переводах: plans.<id>.*
// (name, tagline, f1…fN, badge). Здесь только числа и устойчивые поля.
export type Plan = {
  id: PlanId;
  // Фирменное название платного тарифа (одинаково на всех языках, идёт в платёж и чек).
  name: string;
  // Цена в рублях за месяц (0 — бесплатно).
  price: number;
  // Примерная цена в долларах — только для справки, списание всегда в рублях.
  usd?: number;
  // Сколько токенов даёт тариф (для «Осталось токенов: X из N»).
  tokens: number;
  // Сколько пунктов в списке возможностей (plans.<id>.f1…fN).
  features: number;
  // Есть ли плашка «Популярный» (plans.<id>.badge).
  badge?: boolean;
};

export const PLANS: Plan[] = [
  { id: "free", name: "Free", price: 0, tokens: 10, features: 3 },
  { id: "premium", name: "Premium", price: 1499, usd: 15, tokens: 50, features: 4, badge: true },
  { id: "premium_plus", name: "Premium+", price: 2499, usd: 25, tokens: 150, features: 5 },
];

export const getPlan = (id: PlanId) => PLANS.find((p) => p.id === id) as Plan;

// 1499 → «1.499₽» (ru) / «₽1,499» (en), 0 → «0₽»: разделитель тысяч по языку.
export function formatPrice(rubles: number, locale = "ru"): string {
  const n = Math.round(rubles);
  if (locale === "ru") return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}₽`;
  return `₽${n.toLocaleString(locale)}`;
}

// Если автосписание не прошло — доступ сохраняется ещё столько дней, пока пробуем списать снова.
export const RENEWAL_GRACE_DAYS = 3;
