"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, CreditCard, Crown, Eye, FlaskConical, Plus } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { fetchSubscription, formatDate, isActive, type Subscription } from "@/lib/billing";
import { getPlan, formatPrice, PAYMENT_SOON } from "@/lib/plans";
import { useTokens } from "@/lib/tokens";

// Реальная подписка из базы. Если её нет — предпросмотр (тариф Premium, дата условная).
// Докуп токенов и отмена подписки появятся на следующих этапах.
const NEXT_STAGE = "Появится в ближайшем обновлении";

function renewalDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, "");
}

export default function ManageSubscription() {
  const toast = useToast();
  const tokens = useTokens();
  // undefined — загружается.
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  useEffect(() => {
    fetchSubscription().then(setSub, () => setSub(null));
  }, []);
  const real = sub && isActive(sub) ? sub : null;
  const plan = getPlan(real ? real.plan : "premium");
  if (sub === undefined) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <div className="h-56 animate-pulse rounded-card bg-border/60" />
        <div className="h-40 animate-pulse rounded-card bg-border/60" />
      </div>
    );
  }
  const left = Math.min(tokens?.balance ?? plan.tokens, plan.tokens);
  const share = left / plan.tokens;

  return (
    <div className="flex flex-col gap-4">
      {real ? (
        real.test && (
          <p className="flex items-center gap-2 rounded-2xl bg-lime/40 px-4 py-3 text-xs leading-relaxed">
            <FlaskConical size={15} strokeWidth={1.75} className="shrink-0" />
            Тестовая подписка: оплачена тестовой картой ЮKassa.
          </p>
        )
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-lavender/20 px-4 py-3 text-xs leading-relaxed">
          <Eye size={15} strokeWidth={1.75} className="shrink-0" />
          Предпросмотр: так экран будет выглядеть после оформления подписки.
        </p>
      )}

      <section className="rounded-card border border-lavender/40 bg-gradient-to-br from-lavender/35 via-surface to-lime/45 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-text text-lime">
            <Crown size={18} strokeWidth={1.75} />
          </span>
          <span className="text-xs text-text/60">Подписка активна</span>
        </div>
        <h2 className="mt-4 font-serif text-[2rem] font-medium leading-none">Ваш тариф: {plan.name}</h2>
        <p className="mt-2 text-sm text-text/70">
          {formatPrice(plan.price)}/мес · {plan.tokens} токенов каждый месяц
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3">
          <CalendarDays size={18} strokeWidth={1.5} className="shrink-0" />
          <span className="text-sm">
            <span className="block text-xs text-text/60">{real ? "Действует до" : "Следующее продление"}</span>
            <span className="font-medium" suppressHydrationWarning>
              {real?.current_period_end ? formatDate(real.current_period_end) : renewalDate()}
            </span>
          </span>
        </div>
        {real?.card_last4 && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3">
            <CreditCard size={18} strokeWidth={1.5} className="shrink-0" />
            <span className="text-sm">
              <span className="block text-xs text-text/60">Карта для продления</span>
              <span className="font-medium">
                {real.card_type ? `${real.card_type} ` : ""}•••• {real.card_last4}
              </span>
            </span>
          </div>
        )}
      </section>

      <section className="rounded-card border border-border bg-surface p-5" aria-label="Токены">
        <p className="text-[15px]">
          Осталось токенов: <span className="font-semibold tabular-nums">{left}</span> из{" "}
          <span className="tabular-nums">{plan.tokens}</span>
        </p>
        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-subtle"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={plan.tokens}
          aria-valuenow={left}
        >
          <div className="h-full rounded-full bg-lime" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="mt-2.5 text-xs text-muted">Токены обновляются в день продления подписки.</p>
        <button
          type="button"
          onClick={() => toast.show(real ? NEXT_STAGE : PAYMENT_SOON)}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2} />
          Докупить токены
        </button>
      </section>

      <Link
        href="/profile/subscription"
        className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
      >
        Сменить тариф
        <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
      </Link>

      <button
        type="button"
        onClick={() => toast.show(real ? NEXT_STAGE : "Управление подпиской появится вместе с оплатой")}
        className="mx-auto mt-2 py-2 text-sm text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
      >
        Отменить подписку
      </button>

      {toast.node}
    </div>
  );
}
