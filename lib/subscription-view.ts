import type { Subscription } from "./billing.ts";

// Что показывает экран «Subscription» человеку, у которого уже есть тариф (только отображение, логики оплаты тут нет).
//  none      — тарифа нет: показываем предложения (с подписью «Pick how you'd like to start…»);
//  trial     — идёт пробный период;
//  active    — действующая подписка, продлится сама;
//  canceled  — отменена, но доступ ещё идёт (до конца оплаченного периода);
//  past_due  — списание не прошло, пробуем снова.
export type PlanScreenState = "none" | "trial" | "active" | "canceled" | "past_due";

export type PlanScreenView = {
  state: PlanScreenState;
  // Верхняя подпись «Pick how you'd like to start…» — только пока тарифа нет; вместо неё — строка статуса.
  showIntro: boolean;
  // «Resume subscription» — только у отменённой подписки с идущим доступом и сохранённой картой
  // (без карты возобновлять нечем: человек добавляет её в «Manage subscription»).
  showResume: boolean;
};

// hasAccess — действует ли подписка прямо сейчас (isActive из lib/billing.ts).
export function planScreenView(sub: Subscription | null | undefined, hasAccess: boolean): PlanScreenView {
  if (!sub || !hasAccess) return { state: "none", showIntro: true, showResume: false };
  if (sub.status === "canceled") return { state: "canceled", showIntro: false, showResume: Boolean(sub.card_last4) };
  if (sub.status === "past_due") return { state: "past_due", showIntro: false, showResume: false };
  return { state: sub.is_trial ? "trial" : "active", showIntro: false, showResume: false };
}
