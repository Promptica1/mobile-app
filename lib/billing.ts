import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Translate } from "./auth/errors";
import { SBP } from "./payment-method";
import { RENEWAL_GRACE_DAYS, type PlanId } from "./plans";

// Оплата подписки в браузере: только запросы к нашему серверу и чтение своей подписки.
// Создание платежа и проверка оплаты — на сервере (ключи ЮKassa в браузер не попадают).

export type Subscription = {
  plan: PlanId;
  // active — продлится сам; canceled — отменена, доступ до конца периода;
  // past_due — автосписание не прошло, пробуем снова; expired — закончилась.
  status: "active" | "canceled" | "past_due" | "expired";
  current_period_end: string | null;
  card_last4: string | null;
  card_type: string | null;
  test: boolean;
};

// null — подписки нет (бесплатный тариф) или таблица ещё не создана.
export async function fetchSubscription(): Promise<Subscription | null> {
  if (!getSupabaseEnv()) return null;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, card_last4, card_type, test")
    .eq("user_id", session.user.id)
    .maybeSingle<Subscription>();
  if (error || !data || data.plan === "free") return null;
  return data;
}

// Есть ли доступ к тарифу прямо сейчас. Если списание не прошло — ещё RENEWAL_GRACE_DAYS дней.
export function isActive(s: Subscription | null) {
  if (!s?.current_period_end || s.status === "expired") return false;
  const end = new Date(s.current_period_end).getTime();
  const grace = s.status === "past_due" ? RENEWAL_GRACE_DAYS * 24 * 60 * 60 * 1000 : 0;
  return end + grace > Date.now();
}

// Сохранён ли способ оплаты для продления: карта (есть цифры) или СБП.
export const isSbp = (s: Subscription | null) => s?.card_type === SBP;
export const hasSavedMethod = (s: Subscription | null) => Boolean(s?.card_last4) || isSbp(s);

// Короткая строка о состоянии подписки для профиля и экрана тарифов (t — useTranslations("billing")).
export function subscriptionNote(s: Subscription, t: Translate, locale = "ru") {
  const date = s.current_period_end ? formatDate(s.current_period_end, locale) : "";
  if (s.status === "canceled") return t("noteCanceled", { date });
  if (s.status === "past_due") return t("notePastDue");
  return t("noteActive", { date });
}

// Отмена автопродления (доступ сохраняется до конца оплаченного периода) и возобновление.
export async function changeAutoRenew(action: "cancel" | "resume" | "unlink_card"): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  } catch {
    throw new Error("network");
  }
  const data = (await res.json().catch(() => null)) as { periodEnd?: string | null; error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? "failed");
  return data?.periodEnd ?? null;
}

export async function fetchPaymentMode(): Promise<{ available: boolean; test: boolean }> {
  try {
    const res = await fetch("/api/payments/mode", { cache: "no-store" });
    if (!res.ok) return { available: false, test: true };
    return await res.json();
  } catch {
    return { available: false, test: true };
  }
}

export class CheckoutError extends Error {
  // code/parameter — ответ ЮKassa, если платёж отклонила она.
  constructor(
    public reason: string,
    public code?: string | null,
    public parameter?: string | null,
  ) {
    super(reason);
  }
}

// Создаёт платёж на сервере и уводит на страницу оплаты ЮKassa.
export async function startCheckout(plan: Exclude<PlanId, "free">): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Пользователь видел строку «Оформляя подписку, я принимаю Оферту и Политику…» рядом с кнопкой.
      body: JSON.stringify({ plan, consent: true }),
    });
  } catch {
    throw new CheckoutError("network");
  }
  const data = (await res.json().catch(() => null)) as
    | { confirmationUrl?: string; error?: string; code?: string | null; parameter?: string | null }
    | null;
  if (!res.ok || !data?.confirmationUrl) throw new CheckoutError(data?.error ?? "failed", data?.code, data?.parameter);
  window.location.assign(data.confirmationUrl);
}

// Коды ошибок ЮKassa, для которых есть перевод (billing.errors.yk_<код>).
const YOOKASSA_CODES = new Set([
  "invalid_credentials",
  "forbidden",
  "invalid_request",
  "not_supported",
  "too_many_requests",
  "internal_server_error",
]);
const CHECKOUT_CODES = new Set([
  "not_configured",
  "bad_key",
  "already_subscribed",
  "unauthorized",
  "no_email",
  "consent_required",
  "no_card",
  "network",
]);

// t — useTranslations("billing.errors"). Код ошибки ЮKassa в скобках помогает быстро найти причину.
export function checkoutErrorText(reason: string, code: string | null | undefined, parameter: string | null | undefined, t: Translate) {
  if (reason === "yookassa") {
    const text = t(code && YOOKASSA_CODES.has(code) ? `yk_${code}` : "yk_default");
    const ref = [code, parameter].filter(Boolean).join(", ");
    return ref ? t("yk_withRef", { text, ref }) : t("yk_noRef", { text });
  }
  return t(CHECKOUT_CODES.has(reason) ? reason : "generic");
}

export type PaymentResult =
  | { status: "succeeded"; plan: PlanId; planName: string; cardLast4: string | null; periodEnd: string | null }
  | { status: "canceled"; reason: string; planName: string }
  | { status: "pending"; planName: string }
  | { status: "error"; error: string };

export async function checkPayment(order: string): Promise<PaymentResult> {
  try {
    const res = await fetch(`/api/payments/status?order=${encodeURIComponent(order)}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.status) return { status: "error", error: data?.error ?? "failed" };
    return data as PaymentResult;
  } catch {
    return { status: "error", error: "network" };
  }
}

// Причины отмены платежа ЮKassa → понятный текст (billing.cancel.<причина>; t — useTranslations("billing.cancel")).
const CANCEL_CODES = new Set([
  "expired_on_confirmation",
  "insufficient_funds",
  "card_expired",
  "invalid_card_number",
  "invalid_csc",
  "3d_secure_failed",
  "call_issuer",
  "issuer_unavailable",
  "payment_method_limit_exceeded",
  "payment_method_restricted",
  "fraud_suspected",
  "country_forbidden",
  "general_decline",
  "canceled_by_merchant",
  "internal_timeout",
  "create_failed",
]);
export const cancelReasonText = (reason: string, t: Translate) => t(CANCEL_CODES.has(reason) ? reason : "default");

// «18 ноября 2026» (ru) / «November 18, 2026» (en).
export const formatDate = (iso: string, locale = "ru") =>
  new Date(iso)
    .toLocaleDateString(locale === "ru" ? "ru-RU" : locale, { day: "numeric", month: "long", year: "numeric" })
    .replace(/\s*г\.$/, "");
