// Доступ по региону (когда RU_ENABLED выключен): посетителям из этих стран показываем нейтральную страницу
// «недоступно в вашем регионе». Страну задаёт заголовок x-vercel-ip-country; нет заголовка (локально) — пускаем.
export const BLOCKED_COUNTRIES = ["RU", "BY"] as const;

export function isBlockedCountry(country: string | null | undefined): boolean {
  const c = country?.trim().toUpperCase();
  return Boolean(c) && (BLOCKED_COUNTRIES as readonly string[]).includes(c as string);
}

// Список адресов (администраторы и тестовые аккаунты), которым доступ оставлен: переменная ALLOWLIST_EMAILS,
// адреса через запятую, регистр не важен.
export function parseAllowlist(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlisted(email: string | null | undefined, list: string[]): boolean {
  const e = email?.trim().toLowerCase();
  return Boolean(e) && list.includes(e as string);
}

// Cookie «служебный вход»: ставит /login?staff=1. Она только открывает форму входа посетителю из закрытого
// региона — доступ к приложению всё равно даёт лишь адрес из списка.
export const STAFF_COOKIE = "mirro_staff";
