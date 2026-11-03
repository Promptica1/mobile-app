import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { RU_ENABLED } from "@/lib/features";
import { DEFAULT_LOCALE, LOCALE_COOKIE, detectLocale, isLocale, type Locale } from "./config";
import { stripRuOnly } from "./ru-only";

// Язык запроса: выбор пользователя (cookie) → язык телефона (Accept-Language) → русский.
// Адреса страниц от языка не зависят (/profile, а не /en/profile) — приложение открывается
// и в браузере, и в Telegram по одним и тем же ссылкам.
// RU_ENABLED выключен — всегда английский: cookie, Accept-Language и язык профиля игнорируются.
export async function resolveLocale(): Promise<Locale> {
  if (!RU_ENABLED) return "en";
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return detectLocale((await headers()).get("accept-language"));
}

type Messages = { [key: string]: string | Messages };

// Недостающие строки берём из русского файла — приложение не покажет пустое место.
function withFallback(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      typeof value === "object" && typeof current === "object" ? withFallback(current, value) : value;
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  if (!RU_ENABLED) {
    // Только английский файл (без запасных русских строк) и без текстов экранов ЮKassa.
    return { locale, messages: stripRuOnly((await import("../messages/en.json")).default as Messages) };
  }
  const base = (await import(`../messages/${DEFAULT_LOCALE}.json`)).default as Messages;
  const messages =
    locale === DEFAULT_LOCALE
      ? base
      : withFallback(base, (await import(`../messages/${locale}.json`)).default as Messages);
  return { locale, messages };
});
