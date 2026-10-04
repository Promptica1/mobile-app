"use client";

import Link from "next/link";
import { Check, ChevronRight, Info, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { CURRENT_PLAN, PAYMENT_SOON, PLANS, formatPrice, type Plan } from "@/lib/plans";

// Оформление подключим вместе с ЮKassa — пока кнопка показывает заглушку.
const STYLES: Record<Plan["id"], { card: string; muted: string; check: string }> = {
  free: { card: "border border-border bg-surface", muted: "text-muted", check: "bg-subtle text-text" },
  premium: {
    card: "border border-lavender/40 bg-gradient-to-br from-lavender/35 via-surface to-lime/45",
    muted: "text-text/60",
    check: "bg-surface/80 text-text",
  },
  premium_plus: { card: "bg-text text-background", muted: "text-background/60", check: "bg-lime text-text" },
};

function PlanCard({ plan, onSubscribe }: { plan: Plan; onSubscribe: () => void }) {
  const s = STYLES[plan.id];
  const current = plan.id === CURRENT_PLAN;
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
      </p>

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

      {paid && (
        <button
          type="button"
          onClick={onSubscribe}
          className="mt-6 h-12 w-full rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
        >
          Оформить за {formatPrice(plan.price)}
        </button>
      )}
    </article>
  );
}

export default function Plans() {
  const toast = useToast();
  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm leading-relaxed text-muted">
        Токены тратятся на добавление вещи, примерку и создание аватара. Повтор сохранённого образа —
        бесплатно.
      </p>

      {PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} onSubscribe={() => toast.show(PAYMENT_SOON)} />
      ))}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted">
        <Info size={14} strokeWidth={1.75} />
        Оплата появится в ближайшее время.
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
