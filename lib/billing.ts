import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
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

// Короткая строка о состоянии подписки для профиля и экрана тарифов.
export function subscriptionNote(s: Subscription) {
  const date = s.current_period_end ? formatDate(s.current_period_end) : "";
  if (s.status === "canceled") return `Подписка отменена, доступ до ${date}`;
  if (s.status === "past_due") return "Не удалось списать оплату — попробуем ещё раз";
  return `Подписка активна до ${date}`;
}

// Отмена автопродления (доступ сохраняется до конца оплаченного периода) и возобновление.
export async function changeAutoRenew(action: "cancel" | "resume"): Promise<string | null> {
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
  constructor(public reason: string) {
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
      body: JSON.stringify({ plan }),
    });
  } catch {
    throw new CheckoutError("network");
  }
  const data = (await res.json().catch(() => null)) as { confirmationUrl?: string; error?: string } | null;
  if (!res.ok || !data?.confirmationUrl) throw new CheckoutError(data?.error ?? "failed");
  window.location.assign(data.confirmationUrl);
}

export const CHECKOUT_ERRORS: Record<string, string> = {
  not_configured: "Оплата временно недоступна. Попробуйте чуть позже.",
  live_not_allowed: "Оплата временно недоступна. Попробуйте чуть позже.",
  already_subscribed: "Этот тариф у вас уже оформлен.",
  unauthorized: "Войдите в аккаунт, чтобы оформить подписку.",
};
export const checkoutErrorText = (reason: string) =>
  CHECKOUT_ERRORS[reason] ?? "Не получилось перейти к оплате. Проверьте интернет и попробуйте ещё раз.";

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

// Причины отмены платежа ЮKassa → понятный текст.
const CANCEL_REASONS: Record<string, string> = {
  expired_on_confirmation: "Время на оплату истекло.",
  insufficient_funds: "На карте недостаточно средств.",
  card_expired: "Срок действия карты истёк.",
  invalid_card_number: "Неверный номер карты.",
  invalid_csc: "Неверный CVC-код.",
  "3d_secure_failed": "Не пройдено подтверждение 3-D Secure.",
  call_issuer: "Банк отклонил оплату. Обратитесь в банк, выпустивший карту.",
  issuer_unavailable: "Банк временно недоступен. Попробуйте позже.",
  payment_method_limit_exceeded: "Превышен лимит по карте.",
  payment_method_restricted: "Операции по этой карте ограничены.",
  fraud_suspected: "Платёж отклонён системой безопасности.",
  country_forbidden: "Оплата картой этой страны недоступна.",
  general_decline: "Банк отклонил оплату.",
  canceled_by_merchant: "Платёж отменён.",
  internal_timeout: "Технический сбой. Попробуйте ещё раз.",
  create_failed: "Не получилось создать платёж.",
};
export const cancelReasonText = (reason: string) =>
  CANCEL_REASONS[reason] ?? "Оплата была отменена или не прошла.";

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, "");
