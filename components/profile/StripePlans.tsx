"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, FlaskConical, Info, LoaderCircle, Lock } from "lucide-react";
import InAppBrowserHint from "@/components/InAppBrowserHint";
import { useToast } from "@/components/ui/useToast";
import {
  formatUsd,
  changeStripeRenewal,
  checkoutErrorText,
  CheckoutError,
  fetchPaymentMode,
  fetchSubscription,
  formatDate,
  isActive,
  startStripeCheckout,
  type PaymentMode,
  type StripeOffer,
  type Subscription,
} from "@/lib/billing";
import { LEGAL_DOCS } from "@/lib/legal";
import { planScreenView } from "@/lib/subscription-view";
import { yearlyPricing } from "@/lib/plans";
import { OFFER_INFO } from "@/lib/stripe/rules";
import { FeatureList, PricePill, QuietNote, YearlyCard } from "./PlanParts";

// Экран тарифов для пользователей вне России: Stripe, доллары. Валюту задаёт платёжная система —
// пересчёта по курсу нет. Количество credits в рекламе не пишем, только строкой «Includes N try-ons and looks».
type Props = {
  // Можно ли этому человеку взять триал (его уже брали с этим аккаунтом или почтой — нельзя).
  trialAvailable: boolean;
  // Какой триал сейчас предлагается: false — $4,99 на 5 дней, true — бесплатные 3 дня.
  freeTrial: boolean;
};

function OfferCard({
  offer,
  primary,
  busy,
  disabled,
  onChoose,
}: {
  offer: StripeOffer;
  primary: boolean;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const t = useTranslations(`stripe.offers.${offer}`);
  const tp = useTranslations("stripe");
  const tPlan = useTranslations("plans.premium");
  const locale = useLocale();
  const info = OFFER_INFO[offer];
  // Все суммы и сроки в текстах берутся из lib/stripe/rules.ts — меняются в одном месте.
  const values = {
    setup: formatUsd(info.setupUsd, locale),
    price: formatUsd(info.recurringUsd, locale),
    days: info.trialDays,
  };
  const trial = offer === "trial" || offer === "trial_free";

  if (offer === "annual") {
    // «Подписка на год»: главная цена — неделя, ниже — годовая сумма; выгода считается из цен.
    const { perWeek, savingPercent } = yearlyPricing(info.recurringUsd, OFFER_INFO.monthly.recurringUsd, "USD");
    return (
      <YearlyCard
        title={t("title")}
        weekly={formatUsd(perWeek, locale)}
        weeklyUnit={t("perWeek")}
        billed={t("billed", values)}
        badge={t("badge", { percent: savingPercent })}
        features={[tp("includesMonthly", { n: info.startCredits }), tPlan("f2"), tPlan("f3")]}
        note={t("note", values)}
        action={
          <button
            type="button"
            onClick={onChoose}
            disabled={disabled}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-semibold text-text transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
            {busy ? tp("redirecting") : t("cta", values)}
          </button>
        }
      />
    );
  }

  return (
    <article
      className={`relative rounded-card p-5 ${
        primary
          ? "border border-lavender/40 bg-gradient-to-br from-lavender/35 via-surface to-lime/45"
          : "border border-border bg-surface"
      }`}
      aria-label={t("title", values)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.75rem] font-medium leading-none">{t("title", values)}</h2>
          <p className="mt-1.5 text-xs text-muted">{t("tagline")}</p>
        </div>
        {primary && (
          <span className="shrink-0 rounded-full bg-text px-2.5 py-1 text-[11px] font-medium text-background">{tp("bestStart")}</span>
        )}
      </div>

      <PricePill
        amount={offer === "trial_free" ? tp("free") : trial ? values.setup : values.price}
        unit={t("priceNote", values)}
      />

      <FeatureList
        items={[tp(trial ? "includes" : "includesMonthly", { n: info.startCredits }), tPlan("f2"), tPlan("f3")]}
        tone="bg-surface/80"
      />

      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
      >
        {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
        {busy ? tp("redirecting") : t("cta", values)}
      </button>
      {/* Условия продления — под кнопкой: «Then $12.99/month. You can cancel at any time.» */}
      <QuietNote>{t("note", values)}</QuietNote>
    </article>
  );
}

export default function StripePlans({ trialAvailable, freeTrial }: Props) {
  const toast = useToast();
  const t = useTranslations("stripe");
  const tSub = useTranslations("subscription");
  const tErrors = useTranslations("billing.errors");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [busy, setBusy] = useState<StripeOffer | null>(null);

  useEffect(() => {
    fetchSubscription().then(setSub, () => setSub(null));
    fetchPaymentMode().then(setMode);
  }, []);

  const choose = async (offer: StripeOffer) => {
    if (busy) return;
    if (mode && !mode.available) return toast.show(tErrors("not_configured"));
    setBusy(offer);
    try {
      await startStripeCheckout(offer);
      // Дальше браузер уходит на страницу оплаты — кнопку не возвращаем.
    } catch (e) {
      toast.show(checkoutErrorText(e instanceof CheckoutError ? e.reason : "failed", null, null, tErrors));
      setBusy(null);
    }
  };

  const active = sub && isActive(sub) ? sub : null;
  const trial: StripeOffer = freeTrial ? "trial_free" : "trial";
  const offers: StripeOffer[] = trialAvailable ? [trial, "annual"] : ["monthly", "annual"];
  const disabled = busy !== null || sub === undefined;
  const view = planScreenView(sub, Boolean(active));
  const [resuming, setResuming] = useState(false);

  // Возобновить продление: тот же серверный вызов, что и в «Manage subscription» (cancel_at_period_end = false,
  // без нового платежа до конца оплаченного периода). Статус обновляем с сервера.
  const resume = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      await changeStripeRenewal("resume");
      setSub((s) => (s ? { ...s, status: "active" } : s));
      fetchSubscription().then((fresh) => fresh && setSub(fresh), () => null);
      toast.show(tSub("resumed"));
    } catch {
      toast.show(tSub("resumeError"));
    }
    setResuming(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <InAppBrowserHint />
      {view.showIntro && <p className="px-1 text-sm leading-relaxed text-muted">{t("intro")}</p>}

      {mode?.test && mode.available && (
        <p className="flex gap-2.5 rounded-2xl bg-lime/40 px-4 py-3 text-xs leading-relaxed">
          <FlaskConical size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-semibold">{tSub("testTitle")}</b> {t("testText")}
          </span>
        </p>
      )}

      {active ? (
        <>
          <p className="px-1 text-sm">
            {view.state === "trial" ? (
              // Пробный период: «Your trial ends on <дата>. Then Premium at $12.99/month» (сумма — из lib/stripe/rules.ts).
              tSub("yourTrial", {
                date: formatDate(active.trial_end ?? active.current_period_end ?? "", locale),
                plan: tPlans(`${active.plan}.name`),
                price: formatUsd(OFFER_INFO[active.offer && active.offer !== "annual" ? active.offer : "trial"].recurringUsd, locale),
              })
            ) : (
              <>
            {tSub("yourPlan")}
            <b className="font-semibold">{tPlans(`${active.plan}.name`)}</b>
            {active.current_period_end
              ? active.status === "canceled"
                ? tSub("yourPlanCanceled", { date: formatDate(active.current_period_end, locale) })
                : active.status === "past_due"
                  ? tSub("yourPlanPastDue")
                  : tSub("yourPlanActive", { date: formatDate(active.current_period_end, locale) })
              : ""}
              </>
            )}
          </p>
          {view.showResume && (
            <button
              type="button"
              onClick={resume}
              disabled={resuming}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-semibold text-text transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {resuming && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
              {tSub("resumeButton")}
            </button>
          )}
          <Link
            href="/profile/subscription/manage"
            className={`flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium ${
              view.showResume ? "border border-border bg-surface text-text" : "bg-text text-background"
            }`}
          >
            {tSub("manageButton")}
          </Link>
        </>
      ) : (
        offers.map((offer, i) => (
          <OfferCard
            key={offer}
            offer={offer}
            primary={i === 0 && trialAvailable}
            busy={busy === offer}
            disabled={disabled}
            onChoose={() => choose(offer)}
          />
        ))
      )}


      {!active && (
        <p className="px-2 text-center text-xs leading-relaxed text-muted">
          {tSub("agreePrefix")}{" "}
          <Link href={LEGAL_DOCS.offer.href} className="text-text underline underline-offset-2">
            {tSub("offer")}
          </Link>{" "}
          {tSub("and")}{" "}
          <Link href={LEGAL_DOCS.privacy.href} className="text-text underline underline-offset-2">
            {tSub("privacy")}
          </Link>
        </p>
      )}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted">
        {mode?.available ? <Lock size={13} strokeWidth={1.75} /> : <Info size={14} strokeWidth={1.75} />}
        {mode?.available ? t("secure") : tSub("soon")}
      </p>

      {!active && (
        <Link
          href="/profile/subscription/manage"
          className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
        >
          {tSub("manage")}
          <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
        </Link>
      )}

      {toast.node}
    </div>
  );
}
