"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, FlaskConical, Info, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import {
  checkoutErrorText,
  CheckoutError,
  fetchPaymentMode,
  fetchSubscription,
  formatDate,
  isActive,
  startCheckout,
  type Subscription,
} from "@/lib/billing";
import { PAYMENT_SOON, PLANS, formatPrice, type Plan, type PlanId } from "@/lib/plans";

// «Оформить» создаёт платёж на сервере и уводит на страницу оплаты ЮKassa.
const STYLES: Record<Plan["id"], { card: string; muted: string; check: string }> = {
  free: { card: "border border-border bg-surface", muted: "text-muted", check: "bg-subtle text-text" },
  premium: {
    card: "border border-lavender/40 bg-gradient-to-br from-lavender/35 via-surface to-lime/45",
    muted: "text-text/60",
    check: "bg-surface/80 text-text",
  },
  premium_plus: { card: "bg-text text-background", muted: "text-background/60", check: "bg-lime text-text" },
};

function PlanCard({
  plan,
  current,
  busy,
  disabled,
  onSubscribe,
}: {
  plan: Plan;
  current: boolean;
  busy: boolean;
  disabled: boolean;
  onSubscribe: () => void;
}) {
  const s = STYLES[plan.id];
  const paid = plan.price > 0;
  return (
    <article className={`relative rounded-card p-5 ${s.card}`} aria-label={`Тариф ${plan.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.75rem] font-medium leading-none">{plan.name}</h2>
          <p className={`mt-1.5 text-xs ${s.muted}`}>{plan.tagline}</p>
        </div>
        {current ? (
          <span className="shrink-0 rounded-full bg-lavender/30 px-2.5 py-1 text-[11px] font-medium">
            Текущий тариф
          </span>
        ) : plan.badge ? (
          <span className="shrink-0 rounded-full bg-text px-2.5 py-1 text-[11px] font-medium text-background">
            {plan.badge}
          </span>
        ) : plan.id === "premium_plus" ? (
          <Sparkles size={18} strokeWidth={1.5} className="shrink-0 text-lime" aria-hidden />
        ) : null}
      </div>

      <p className="mt-5 flex items-baseline gap-1">
        <span className="font-serif text-[2.5rem] font-medium leading-none tracking-tight">
          {formatPrice(plan.price)}
        </span>
        {paid && <span className={`text-sm ${s.muted}`}>/мес</span>}
        {plan.usd && <span className={`ml-1.5 text-sm ${s.muted}`}>≈ ${plan.usd}</span>}
      </p>
      {paid && <p className={`mt-1.5 text-xs ${s.muted}`}>Оплата в рублях</p>}

      <ul className="mt-5 flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[15px]">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${s.check}`}>
              <Check size={12} strokeWidth={2.5} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      {paid &&
        (current ? (
          <Link
            href="/profile/subscription/manage"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface text-[15px] font-medium text-text"
          >
            Управлять подпиской
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSubscribe}
            disabled={disabled}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
            {busy ? "Переходим к оплате…" : `Оформить за ${formatPrice(plan.price)}`}
          </button>
        ))}
    </article>
  );
}

export default function Plans() {
  const toast = useToast();
  // undefined — загружается.
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [mode, setMode] = useState<{ available: boolean; test: boolean } | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);

  useEffect(() => {
    fetchSubscription().then(setSub, () => setSub(null));
    fetchPaymentMode().then(setMode);
  }, []);

  const currentPlan: PlanId = sub && isActive(sub) ? sub.plan : "free";

  const subscribe = async (plan: Plan) => {
    if (plan.id === "free" || busy) return;
    if (mode && !mode.available) return toast.show(PAYMENT_SOON);
    setBusy(plan.id);
    try {
      await startCheckout(plan.id);
      // Дальше браузер уходит на страницу оплаты — кнопку не возвращаем.
    } catch (e) {
      toast.show(checkoutErrorText(e instanceof CheckoutError ? e.reason : "failed"));
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm leading-relaxed text-muted">
        Токены тратятся на добавление вещи, примерку и создание аватара. Повтор сохранённого образа —
        бесплатно.
      </p>

      {mode?.test && mode.available && (
        <p className="flex gap-2.5 rounded-2xl bg-lime/40 px-4 py-3 text-xs leading-relaxed">
          <FlaskConical size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-semibold">Тестовый режим.</b> Оплата проходит тестовыми картами ЮKassa —
            настоящие деньги не списываются.
          </span>
        </p>
      )}

      {sub && isActive(sub) && sub.current_period_end && (
        <p className="px-1 text-sm">
          Ваш тариф — <b className="font-semibold">{PLANS.find((p) => p.id === sub.plan)?.name}</b>, действует до{" "}
          {formatDate(sub.current_period_end)}.
        </p>
      )}

      {PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          current={sub !== undefined && plan.id === currentPlan}
          busy={busy === plan.id}
          disabled={busy !== null || sub === undefined}
          onSubscribe={() => subscribe(plan)}
        />
      ))}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted">
        {mode?.available ? <Lock size={13} strokeWidth={1.75} /> : <Info size={14} strokeWidth={1.75} />}
        {mode?.available
          ? "Оплата на защищённой странице ЮKassa. Карта сохраняется для продления подписки."
          : "Оплата появится в ближайшее время."}
      </p>

      <Link
        href="/profile/subscription/manage"
        className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
      >
        Управление подпиской
        <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
      </Link>

      {toast.node}
    </div>
  );
}
