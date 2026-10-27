// Какой платёжной системой платит пользователь: Россия и Беларусь — ЮKassa (рубли), остальные
// страны — Stripe (доллары). Мини-приложение Telegram всегда платит через ЮKassa.
// Ручного переключателя нет. Страна неизвестна (локально, нет заголовка) — ЮKassa, как раньше.

export type Provider = "yookassa" | "stripe";

// Страны, которые платят через ЮKassa.
export const YOOKASSA_COUNTRIES = ["RU", "BY"] as const;

export function resolveProvider({ country, telegram }: { country?: string | null; telegram?: boolean }): Provider {
  if (telegram) return "yookassa";
  const c = country?.trim().toUpperCase();
  if (!c) return "yookassa";
  return (YOOKASSA_COUNTRIES as readonly string[]).includes(c) ? "yookassa" : "stripe";
}

// Валюту задаёт провайдер: пересчёта по курсу нет.
export const currencyOf = (p: Provider) => (p === "stripe" ? "USD" : "RUB");

// Cookie, которую ставит приложение внутри Telegram (см. components/TelegramMark.tsx).
export const TELEGRAM_COOKIE = "mirro_tg";
