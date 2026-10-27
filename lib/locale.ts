import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";

// Выбрать язык: сервер ставит cookie и (для вошедшего пользователя) пишет язык в профиль.
// Дальше страницу нужно перерисовать (router.refresh()).
export async function saveLocale(locale: Locale): Promise<void> {
  const res = await fetch("/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!res.ok) throw new Error("locale_failed");
}

// Язык, который пользователь явно выбрал на этом устройстве (cookie), или null.
export function readLocaleCookie(): Locale | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : null;
}
