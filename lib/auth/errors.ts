import type { AuthError } from "@supabase/supabase-js";

// Понятные сообщения вместо технических ошибок Supabase.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Неверный email или пароль. Проверьте и попробуйте ещё раз.",
  email_not_confirmed: "Почта ещё не подтверждена — откройте письмо от нас и перейдите по ссылке.",
  user_already_exists: "Этот email уже зарегистрирован. Попробуйте войти.",
  email_exists: "Этот email уже зарегистрирован. Попробуйте войти.",
  weak_password: "Пароль слишком простой. Добавьте цифры или буквы разного регистра.",
  email_address_invalid: "Похоже, в email опечатка. Проверьте адрес.",
  validation_failed: "Проверьте, правильно ли заполнены поля.",
  over_email_send_rate_limit: "Слишком много писем за короткое время. Подождите минуту и попробуйте снова.",
  over_request_rate_limit: "Слишком много попыток. Подождите минуту и попробуйте снова.",
  same_password: "Новый пароль должен отличаться от старого.",
  signup_disabled: "Регистрация сейчас недоступна.",
};

export function authErrorMessage(error: AuthError | Error | null | undefined): string {
  if (!error) return "";
  const code = "code" in error ? (error.code as string | undefined) : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (/fetch|network/i.test(error.message)) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.";
  }
  return "Что-то пошло не так. Попробуйте ещё раз чуть позже.";
}

// Разрешаем переход только на внутренние страницы приложения.
export function safeNextPath(next: string | null | undefined, fallback = "/wardrobe") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

// Собственная проверка полей — чтобы подсказки всегда были на русском,
// а не во всплывающих окнах браузера на языке системы.
export function validateEmail(email: string): string {
  if (!email.trim()) return "Введите email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Похоже, в email опечатка. Проверьте адрес.";
  return "";
}

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`;
  }
  return "";
}
