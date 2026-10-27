"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, CalendarDays, ChevronRight, CreditCard, Crown, Eye, FlaskConical, LoaderCircle, Plus } from "lucide-react";
import ConfirmDeleteSheet from "@/components/ui/ConfirmDeleteSheet";
import { useToast } from "@/components/ui/useToast";
import {
  changeAutoRenew,
  changeStripeRenewal,
  fetchSubscription,
  finishCardChange,
  formatDate,
  formatUsd,
  hasSavedMethod,
  isActive,
  isSbp,
  isStripeSub,
  startCardChange,
  type Subscription,
} from "@/lib/billing";
import { OFFER_INFO } from "@/lib/stripe/rules";
import { getPlan, formatPrice, RENEWAL_GRACE_DAYS } from "@/lib/plans";
import { useTokens } from "@/lib/tokens";

// Реальная подписка из базы. Если её нет — предпросмотр (тариф Premium, дата условная).
// Отмена — только автопродления: доступ сохраняется до конца оплаченного периода.
// Докуп токенов появится на следующем этапе.
function renewalDate(locale: string) {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return formatDate(d.toISOString(), locale);
}

// Если списание не прошло, доступ держим ещё RENEWAL_GRACE_DAYS дней.
function accessUntil(s: Subscription) {
  const end = new Date(s.current_period_end as string);
  if (s.status === "past_due") end.setDate(end.getDate() + RENEWAL_GRACE_DAYS);
  return end.toISOString();
}

export default function ManageSubscription() {
  const toast = useToast();
  const t = useTranslations("subscription.manageScreen");
  const tBilling = useTranslations("billing");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
  const tokens = useTokens();
  // undefined — загружается.
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [changingCard, setChangingCard] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const cardSession = url.searchParams.get("card_session");
    // Вернулись со страницы смены карты (Stripe): применяем новую карту и убираем параметр из адреса.
    if (cardSession) {
      window.history.replaceState(null, "", url.pathname);
      finishCardChange(cardSession)
        .then(() => toast.show(t("stripeCardUpdated")))
        .catch(() => toast.show(t("stripeCardError")))
        .finally(() => fetchSubscription().then(setSub, () => setSub(null)));
      return;
    }
    fetchSubscription().then(setSub, () => setSub(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const cardSaved = hasSavedMethod(real);
  const sbp = isSbp(real);
  const stripe = isStripeSub(real);
  // Как назвать сохранённый способ оплаты: «•••• 4477» для карты, «Оплата через СБП» для СБП.
  const methodText = sbp
    ? t("payViaSbp")
    : `${real?.card_type ? `${real.card_type} ` : ""}•••• ${real?.card_last4}`;
  const endDate = real?.current_period_end ? formatDate(real.current_period_end, locale) : "";
  const planName = tPlans(`${plan.id}.name`);

  // Stripe: отмена продления в один тап, без окна подтверждения — доступ остаётся до конца периода.
  const cancelStripe = async () => {
    try {
      const end = await changeStripeRenewal("cancel");
      setSub((s) => (s ? { ...s, status: "canceled", current_period_end: end ?? s.current_period_end } : s));
      toast.show(t("stripeCanceled", { date: formatDate(end ?? real?.current_period_end ?? "", locale) }));
    } catch {
      toast.show(t("cancelError"));
    }
  };
  const changeCard = async () => {
    setChangingCard(true);
    try {
      await startCardChange();
    } catch {
      toast.show(t("stripeCardError"));
      setChangingCard(false);
    }
  };

  const cancel = async () => {
    const end = await changeAutoRenew("cancel");
    setSub((s) => (s ? { ...s, status: "canceled", current_period_end: end ?? s.current_period_end } : s));
    setConfirming(false);
  };
  const unlinkCard = async () => {
    const end = await (stripe ? changeStripeRenewal("unlink_card") : changeAutoRenew("unlink_card"));
    setSub((s) =>
      s
        ? {
            ...s,
            card_last4: null,
            card_type: null,
            status: s.status === "active" || s.status === "past_due" ? "canceled" : s.status,
            current_period_end: end ?? s.current_period_end,
          }
        : s,
    );
    setUnlinking(false);
    toast.show(sbp ? t("toastUnlinkedMethod") : t("toastUnlinkedCard"));
  };
  const resume = async () => {
    setResuming(true);
    try {
      await (stripe ? changeStripeRenewal("resume") : changeAutoRenew("resume"));
      setSub((s) => (s ? { ...s, status: "active" } : s));
      toast.show(t("toastResumed"));
    } catch {
      toast.show(t("toastResumeError"));
    }
    setResuming(false);
  };

  // Для Stripe «из N» — сколько credits дал последний платёж (профиль хранит это число).
  const total = stripe && tokens ? tokens.total || plan.tokens : plan.tokens;
  const left = real ? (tokens?.balance ?? 0) : plan.tokens;
  const share = total > 0 ? Math.min(1, left / total) : 0;
  const offerInfo = stripe && real?.offer ? OFFER_INFO[real.offer] : null;

  return (
    <div className="flex flex-col gap-4">
      {real ? (
        real.test && (
          <p className="flex items-center gap-2 rounded-2xl bg-lime/40 px-4 py-3 text-xs leading-relaxed">
            <FlaskConical size={15} strokeWidth={1.75} className="shrink-0" />
            {stripe ? t("stripeTestBanner") : t("testBanner")}
          </p>
        )
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-lavender/20 px-4 py-3 text-xs leading-relaxed">
          <Eye size={15} strokeWidth={1.75} className="shrink-0" />
          {t("preview")}
        </p>
      )}

      {stripe && real?.is_trial && real.trial_end && (
        <p className="rounded-2xl bg-lavender/20 px-4 py-3 text-xs leading-relaxed">
          {t("stripeTrialBanner", { date: formatDate(real.trial_end, locale), price: formatUsd(OFFER_INFO.monthly.recurringUsd) })}
        </p>
      )}

      <section className="rounded-card border border-lavender/40 bg-gradient-to-br from-lavender/35 via-surface to-lime/45 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-text text-lime">
            <Crown size={18} strokeWidth={1.75} />
          </span>
          <span className="text-xs text-text/60">
            {status === "canceled" ? t("statusCanceled") : status === "past_due" ? t("statusPastDue") : t("statusActive")}
          </span>
        </div>
        <h2 className="mt-4 font-serif text-[2rem] font-medium leading-none">{t("yourPlan", { name: planName })}</h2>
        <p className="mt-2 text-sm text-text/70">
          {offerInfo
            ? t(offerInfo.interval === "year" ? "stripePlanYear" : "stripePlanMonth", { price: formatUsd(offerInfo.recurringUsd) })
            : t("planLine", { price: formatPrice(plan.price, locale), tokens: plan.tokens })}
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface/70 px-4 py-3">
          <CalendarDays size={18} strokeWidth={1.5} className="shrink-0" />
          <span className="text-sm">
            <span className="block text-xs text-text/60">
              {!real ? t("nextRenewal") : status === "active" && cardSaved ? t("renewsAuto") : t("accessUntil")}
            </span>
            <span className="font-medium" suppressHydrationWarning>
              {real?.current_period_end ? formatDate(accessUntil(real), locale) : renewalDate(locale)}
            </span>
          </span>
        </div>
        {real && (
          <div className="mt-2 rounded-2xl bg-surface/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <CreditCard size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block text-xs text-text/60">
                  {sbp ? t("methodTitle") : t("cardTitle")}
                </span>
                <span className="font-medium">{cardSaved ? methodText : t("notLinked")}</span>
              </span>
            </div>
            {stripe && (
              <button
                type="button"
                onClick={changeCard}
                disabled={changingCard}
                className="ml-[30px] mt-1.5 mr-4 text-xs font-medium text-text/70 underline underline-offset-4 transition-colors hover:text-text disabled:opacity-60"
              >
                {cardSaved ? t("stripeChangeCard") : t("stripeAddCard")}
              </button>
            )}
            {cardSaved && (
              <button
                type="button"
                onClick={() => setUnlinking(true)}
                className="ml-[30px] mt-1.5 text-xs font-medium text-text/70 underline underline-offset-4 transition-colors hover:text-danger"
              >
                {sbp ? t("unlinkMethod") : t("unlinkCard")}
              </button>
            )}
          </div>
        )}
      </section>

      {status === "canceled" && (
        <div className="rounded-card border border-border bg-surface p-5" role="status">
          <p className="text-[15px] leading-relaxed">
            {cardSaved ? t("canceledPrefix") : t("autoRenewOff")}
            {t.rich("accessKept", { date: endDate, b: (chunks) => <b className="font-semibold">{chunks}</b> })}
          </p>
          {cardSaved ? (
            <button
              type="button"
              onClick={resume}
              disabled={resuming}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-text text-[15px] font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {resuming && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
              {t("resume")}
            </button>
          ) : stripe ? (
            <button
              type="button"
              onClick={changeCard}
              disabled={changingCard}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-text text-[15px] font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {t("stripeAddCard")}
            </button>
          ) : (
            <Link
              href="/profile/subscription"
              className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-text text-[15px] font-medium text-background transition-transform active:scale-[0.98]"
            >
              {t("renewSub")}
            </Link>
          )}
        </div>
      )}
      {status === "past_due" && (
        <p className="flex gap-2.5 rounded-2xl bg-pink/15 px-4 py-3 text-sm leading-relaxed" role="status">
          <AlertCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-pink" />
          {t("pastDue")}
        </p>
      )}

      <section className="rounded-card border border-border bg-surface p-5" aria-label={t("tokensLabel")}>
        <p className="text-[15px]">
          {t.rich("tokensLeft", {
            left,
            total,
            b: (chunks) => <span className="font-semibold tabular-nums">{chunks}</span>,
          })}
        </p>
        <div
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-subtle"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={left}
        >
          <div className="h-full rounded-full bg-lime" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="mt-2.5 text-xs text-muted">
          {status === "canceled"
            ? t("noNewTokens")
            : t(real?.is_trial && stripe ? "stripeCreditsResetTrial" : offerInfo?.monthlyGrant ? "stripeCreditsResetYearly" : "tokensReset", { total })}
        </p>
        <button
          type="button"
          onClick={() => toast.show(real ? t("nextStage") : tBilling("paymentSoon"))}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2} />
          {t("buyTokens")}
        </button>
      </section>

      {!stripe && (
        <Link
          href="/profile/subscription"
          className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
        >
          {t("changePlan")}
          <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
        </Link>
      )}

      {status !== "canceled" && (
        <button
          type="button"
          onClick={() => (real ? (stripe ? cancelStripe() : setConfirming(true)) : toast.show(t("manageSoon")))}
          className="mx-auto mt-2 py-2 text-sm text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
        >
          {t("cancelSub")}
        </button>
      )}

      {unlinking && real && (
        <ConfirmDeleteSheet
          title={sbp ? t("unlinkTitleMethod") : t("unlinkTitleCard")}
          text={
            sbp
              ? t("unlinkTextMethod", { plan: planName, date: endDate })
              : t("unlinkTextCard", { card: methodText, plan: planName, date: endDate })
          }
          confirmLabel={sbp ? t("unlinkMethod") : t("unlinkCard")}
          busyLabel={t("unlinkBusy")}
          cancelLabel={sbp ? t("keepMethod") : t("keepCard")}
          errorText={t("unlinkError")}
          onDelete={unlinkCard}
          onClose={() => setUnlinking(false)}
        />
      )}

      {confirming && real && (
        <ConfirmDeleteSheet
          title={t("cancelTitle")}
          text={t("cancelText", { plan: planName, date: endDate })}
          confirmLabel={t("cancelSub")}
          busyLabel={t("cancelBusy")}
          cancelLabel={t("keepSub")}
          errorText={t("cancelError")}
          onDelete={cancel}
          onClose={() => setConfirming(false)}
        />
      )}

      {toast.node}
    </div>
  );
}
