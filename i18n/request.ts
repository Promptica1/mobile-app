import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, detectLocale, isLocale, type Locale } from "./config";

// Язык запроса: выбор пользователя (cookie) → язык телефона (Accept-Language) → русский.
// Адреса страниц от языка не зависят (/profile, а не /en/profile) — приложение открывается
// и в браузере, и в Telegram по одним и тем же ссылкам.
export async function resolveLocale(): Promise<Locale> {
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
  const base = (await import(`../messages/${DEFAULT_LOCALE}.json`)).default as Messages;
  const messages =
    locale === DEFAULT_LOCALE
      ? base
      : withFallback(base, (await import(`../messages/${locale}.json`)).default as Messages);
  return { locale, messages };
});
