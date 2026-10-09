import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "./plans";
import { getPlan } from "./plans";

// Тарифы, которые можно оплатить, и их цены — только с сервера (браузеру сумму не доверяем).
export type PaidPlanId = Exclude<PlanId, "free">;
export const isPaidPlan = (v: unknown): v is PaidPlanId => v === "premium" || v === "premium_plus";
export const planPrice = (id: PaidPlanId) => getPlan(id).price;
// Название платежа — оно же позиция в чеке («Подписка MIRRO Premium» / «Подписка MIRRO Premium+»).
export const planDescription = (id: PaidPlanId) => `Подписка MIRRO ${getPlan(id).name}`;
// Позиция чека для докупки токенов (когда появится оплата пакетов).
export const TOKEN_PACK_DESCRIPTION = "Пакет токенов MIRRO";

// Почта пользователя для чека — при автосписании пользователя рядом нет, берём из аккаунта.
export async function userEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email || null;
}

// Подписка действует месяц с момента оплаты.
export function periodEnd(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}
