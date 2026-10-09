"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, ChevronRight, CreditCard, Crown, Eye, FlaskConical, LoaderCircle, Plus } from "lucide-react";
import ConfirmDeleteSheet from "@/components/ui/ConfirmDeleteSheet";
import { useToast } from "@/components/ui/useToast";
import { changeAutoRenew, fetchSubscription, formatDate, isActive, type Subscription } from "@/lib/billing";
import { getPlan, formatPrice, PAYMENT_SOON, RENEWAL_GRACE_DAYS } from "@/lib/plans";
import { useTokens } from "@/lib/tokens";

// Реальная подписка из базы. Если её нет — предпросмотр (тариф Premium, дата условная).
// Отмена — только автопродления: доступ сохраняется до конца оплаченного периода.
// Докуп токенов появится на следующем этапе.
const NEXT_STAGE = "Появится в ближайшем обновлении";

function renewalDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, "");
}

// Если списание не прошло, доступ держим ещё RENEWAL_GRACE_DAYS дней.
function accessUntil(s: Subscription) {
  const end = new Date(s.current_period_end as string);
  if (s.status === "past_due") end.setDate(end.getDate() + RENEWAL_GRACE_DAYS);
  return end.toISOString();
}

export default function ManageSubscription() {
  const toast = useToast();
  const tokens = useTokens();
  // undefined — загружается.
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [resuming, setResuming] = useState(false);
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
  const status = real?.status ?? "active";
  const endDate = real?.current_period_end ? formatDate(real.current_period_end) : "";

  const cancel = async () => {
    const end = await changeAutoRenew("cancel");
    setSub((s) => (s ? { ...s, status: "canceled", current_period_end: end ?? s.current_period_end } : s));
    setConfirming(false);
  };
  const resume = async () => {
    setResuming(true);
    try {
      await changeAutoRenew("resume");
      setSub((s) => (s ? { ...s, status: "active" } : s));
      toast.show("Автопродление снова включено");
    } catch {
      toast.show("Не получилось. Проверьте интернет и попробуйте ещё раз.");
    }
    setResuming(false);
  };

  const left = real ? (tokens?.balance ?? 0) : plan.tokens;
  const share = Math.min(1, left / plan.tokens);

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
          <span className="text-xs text-text/60">
            {status === "canceled" ? "Подписка отменена" : status === "past_due" ? "Ожидает оплаты" : "Подписка активна"}
          </span>
        </div>
        <h2 className="mt-4 font-serif text-[2rem] font-medium leading-none">Ваш тариф: {plan.name}</h2>
        <p className="mt-2 text-sm text-text/70">
          {formatPrice(plan.price)}/мес · {plan.tokens} токенов каждый месяц
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3">
          <CalendarDays size={18} strokeWidth={1.5} className="shrink-0" />
          <span className="text-sm">
            <span className="block text-xs text-text/60">
              {!real ? "Следующее продление" : status === "active" ? "Продлится автоматически" : "Доступ до"}
            </span>
            <span className="font-medium" suppressHydrationWarning>
              {real?.current_period_end ? formatDate(accessUntil(real)) : renewalDate()}
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

      {status === "canceled" && (
        <div className="rounded-card border border-border bg-surface p-5" role="status">
          <p className="text-[15px] leading-relaxed">
            Подписка отменена. Доступ сохранится до <b className="font-semibold">{endDate}</b>, продления не будет.
          </p>
          <button
            type="button"
            onClick={resume}
            disabled={resuming}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-text text-[15px] font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {resuming && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
            Возобновить подписку
          </button>
        </div>
      )}
      {status === "past_due" && (
        <p className="flex gap-2.5 rounded-2xl bg-pink/15 px-4 py-3 text-sm leading-relaxed" role="status">
          <AlertCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-pink" />
          Не удалось списать оплату с карты. Доступ пока сохранён — попробуем списать ещё раз завтра.
          Проверьте баланс карты или оформите тариф заново.
        </p>
      )}

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
        <p className="mt-2.5 text-xs text-muted">
          {status === "canceled"
            ? "Новых начислений не будет — оставшиеся токены сохранятся."
            : `В день продления баланс обновляется до ${plan.tokens}, остаток не переносится.`}
        </p>
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

      {status !== "canceled" && (
        <button
          type="button"
          onClick={() => (real ? setConfirming(true) : toast.show("Управление подпиской появится вместе с оплатой"))}
          className="mx-auto mt-2 py-2 text-sm text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
        >
          Отменить подписку
        </button>
      )}

      {confirming && real && (
        <ConfirmDeleteSheet
          title="Отменить подписку?"
          text={`Автопродление отключится. Доступ к ${plan.name} сохранится до ${endDate}, после этого деньги списываться не будут.`}
          confirmLabel="Отменить подписку"
          busyLabel="Отменяем…"
          cancelLabel="Оставить подписку"
          errorText="Не получилось отменить. Проверьте интернет и попробуйте ещё раз."
          onDelete={cancel}
          onClose={() => setConfirming(false)}
        />
      )}

      {toast.node}
    </div>
  );
}
