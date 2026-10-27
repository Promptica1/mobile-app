import type { AuthError } from "@supabase/supabase-js";

// Перевод по ключу: сюда передаётся t из useTranslations("auth.errors") (или getTranslations на сервере).
export type Translate = (key: string, values?: Record<string, string | number>) => string;

// Коды ошибок Supabase, для которых есть понятный текст (messages/*.json → auth.errors.<код>).
const KNOWN_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "weak_password",
  "email_address_invalid",
  "validation_failed",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "same_password",
  "signup_disabled",
]);

// Понятные сообщения вместо технических ошибок Supabase.
export function authErrorMessage(error: AuthError | Error | null | undefined, t: Translate): string {
  if (!error) return "";
  const code = "code" in error ? (error.code as string | undefined) : undefined;
  if (code === "email_exists") return t("user_already_exists");
  if (code && KNOWN_CODES.has(code)) return t(code);
  if (/fetch|network/i.test(error.message)) return t("network");
  return t("generic");
}

// Разрешаем переход только на внутренние страницы приложения.
export function safeNextPath(next: string | null | undefined, fallback = "/wardrobe") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

// Собственная проверка полей — чтобы подсказки были на языке приложения,
// а не во всплывающих окнах браузера на языке системы.
export function validateEmail(email: string, t: Translate): string {
  if (!email.trim()) return t("emailRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t("email_address_invalid");
  return "";
}

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, t: Translate): string {
  if (password.length < MIN_PASSWORD_LENGTH) return t("passwordShort", { min: MIN_PASSWORD_LENGTH });
  return "";
}
