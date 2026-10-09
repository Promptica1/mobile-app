// Тарифы подписки. Оплата (ЮKassa) и реальные лимиты подключатся позже —
// сейчас это только витрина. Цены везде показываем через formatPrice.

export type PlanId = "free" | "premium" | "premium_plus";

export type Plan = {
  id: PlanId;
  name: string;
  // Цена в рублях за месяц (0 — бесплатно).
  price: number;
  // Примерная цена в долларах — только для справки, списание всегда в рублях.
  usd?: number;
  // Сколько токенов даёт тариф (для «Осталось токенов: X из N»).
  tokens: number;
  tagline: string;
  features: string[];
  badge?: string;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Бесплатный",
    price: 0,
    tokens: 10,
    tagline: "Чтобы познакомиться с приложением",
    features: ["10 токенов (разово)", "До 15 вещей", "Базовый гардероб и примерка"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 1499,
    usd: 15,
    tokens: 50,
    tagline: "Для тех, кто собирает образы каждую неделю",
    features: ["50 токенов в месяц", "До 150 вещей", "Папки для образов", "Докуп токенов"],
    badge: "Популярный",
  },
  {
    id: "premium_plus",
    name: "Premium+",
    price: 2499,
    usd: 25,
    tokens: 150,
    tagline: "Весь гардероб и максимум примерок",
    features: [
      "150 токенов в месяц",
      "Безлимит вещей",
      "Папки для образов",
      "Докуп токенов",
      "Приоритетная генерация",
    ],
  },
];

export const getPlan = (id: PlanId) => PLANS.find((p) => p.id === id) as Plan;


// 1499 → «1.499₽», 0 → «0₽»: точка — разделитель тысяч.
export function formatPrice(rubles: number): string {
  return `${String(Math.round(rubles)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}₽`;
}

export const PAYMENT_SOON = "Оплата скоро будет доступна";
