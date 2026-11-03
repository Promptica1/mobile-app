import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHash } from "./stripe/webhook";
import type { YooKassaPayment } from "./yookassa";

// Правило «триал только тому, у кого никогда не было ни оплаты, ни триала» — одно для ЮKassa и Stripe.
// Проверка по аккаунту, нормализованной почте и (где возможно) отпечатку карты; сама логика — в SQL
// (supabase/migrations/20261103120000_tariffs.sql), здесь только вызовы.

// ЮKassa не отдаёт отпечаток карты, поэтому строим его сами: шесть первых и четыре последние цифры
// и срок действия. СБП и способы без карты отпечатка не имеют (проверка остаётся по аккаунту и почте).
export function ykCardFingerprint(method: YooKassaPayment["payment_method"]): string | null {
  const card = method?.card;
  if (!card?.first6 || !card.last4 || !card.expiry_month || !card.expiry_year) return null;
  return `yk_${createHash("sha256").update(`${card.first6}|${card.last4}|${card.expiry_month}|${card.expiry_year}`).digest("hex")}`;
}

export const hashFor = (email: string | null, userId: string) =>
  email ? emailHash(email) : createHash("sha256").update(`user:${userId}`).digest("hex");

// Можно ли показывать триал. Не удалось проверить (например, SQL ещё не запущен) — false: лучше не показать
// триал, чем предложить его тому, кому он не положен. Окончательно решает сервер при оплате.
export async function isTrialAvailable(admin: SupabaseClient, user: { id: string; email?: string | null }): Promise<boolean> {
  const { data, error } = await admin.rpc("trial_available", { p_user: user.id, p_email_hash: hashFor(user.email ?? null, user.id) });
  return error ? false : data === true;
}

// После оплаты без триала: человек уже платил, триал ему больше не положен (в т.ч. с новой почтой-алиасом и картой).
export async function recordPayer(admin: SupabaseClient, user: { id: string; email?: string | null }, ref: string, fingerprint: string | null) {
  const { error } = await admin.rpc("record_payer", {
    p_user: user.id,
    p_email_hash: hashFor(user.email ?? null, user.id),
    p_ref: ref,
    p_fingerprint: fingerprint,
  });
  if (error) console.log(`TRIAL: record_payer failed (${error.message})`);
}
