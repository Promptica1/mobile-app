import "server-only";
import type { PlanId } from "./plans";
import { getPlan } from "./plans";

// Тарифы, которые можно оплатить, и их цены — только с сервера (браузеру сумму не доверяем).
export type PaidPlanId = Exclude<PlanId, "free">;
export const isPaidPlan = (v: unknown): v is PaidPlanId => v === "premium" || v === "premium_plus";
export const planPrice = (id: PaidPlanId) => getPlan(id).price;
export const planDescription = (id: PaidPlanId) => `Подписка MIRRO ${getPlan(id).name}`;

// Подписка действует месяц с момента оплаты.
export function periodEnd(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}
