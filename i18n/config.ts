// Языки приложения. Добавить язык: положить messages/<код>.json и дописать код сюда
// (и название языка в LOCALE_NAMES). Всё остальное подхватится само.

export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// Язык по умолчанию — русский. Он же запасной: если в другом языке не хватает строки,
// показывается русская.
export const DEFAULT_LOCALE: Locale = "ru";

// Название языка на нём самом — для переключателя.
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
};

// Cookie с выбранным языком. Есть только после явного выбора пользователя:
// нет cookie — язык определяется по телефону (заголовок Accept-Language).
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

// Язык по заголовку Accept-Language («en-US,en;q=0.9,ru;q=0.8» → "en").
// Берём первый из поддерживаемых языков в порядке предпочтения телефона.
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}
