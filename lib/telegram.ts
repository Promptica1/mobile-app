import { TELEGRAM_COOKIE } from "./payment-provider";

// Открыто ли приложение внутри Telegram (Mini App): оттуда оплата всегда идёт через ЮKassa.
export function inTelegram(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { TelegramWebviewProxy?: unknown; Telegram?: { WebApp?: { initData?: string } } };
  return Boolean(
    w.TelegramWebviewProxy ||
      w.Telegram?.WebApp?.initData ||
      /Telegram/i.test(navigator.userAgent) ||
      window.location.hash.includes("tgWebAppData"),
  );
}

// Запомнить «мы в Telegram» для сервера (он выбирает платёжную систему по cookie).
export function markTelegram() {
  if (!inTelegram()) return;
  try {
    document.cookie = `${TELEGRAM_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    // cookie недоступны — останется выбор по стране
  }
}
