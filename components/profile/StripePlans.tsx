"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronRight, FlaskConical, Info, LoaderCircle, Lock } from "lucide-react";
import InAppBrowserHint from "@/components/InAppBrowserHint";
import { useToast } from "@/components/ui/useToast";
import {
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
import { OFFER_INFO } from "@/lib/stripe/rules";

// Экран тарифов для пользователей вне России: Stripe, доллары. Валюту задаёт платёжная система —
// пересчёта по курсу нет. Количество credits в рекламе не пишем, только строкой «Includes N try-ons and looks».
type Props = {
  // Можно ли этому человеку взять триал (его уже брали с этим аккаунтом или почтой — нельзя).
  trialAvailable: boolean;
  // Какой триал сейчас предлагается: false — $4,99 на 5 дней, true — бесплатные 3 дня.
  freeTrial: boolean;
};

const usd = (n: number) => `$${n.toFixed(2)}`;

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
  const info = OFFER_INFO[offer];
  const trial = offer === "trial" || offer === "trial_free";
  return (
    <article
      className={`relative rounded-card p-5 ${
        primary
          ? "border border-lavender/40 bg-gradient-to-br from-lavender/35 via-surface to-lime/45"
          : "border border-border bg-surface"
      }`}
      aria-label={t("title")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.75rem] font-medium leading-none">{t("title")}</h2>
          <p className="mt-1.5 text-xs text-muted">{t("tagline")}</p>
        </div>
        {primary && (
          <span className="shrink-0 rounded-full bg-text px-2.5 py-1 text-[11px] font-medium text-background">{tp("bestStart")}</span>
        )}
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="font-serif text-[2.5rem] font-medium leading-none tracking-tight">
          {offer === "trial_free" ? tp("free") : usd(trial ? info.setupUsd : info.recurringUsd)}
        </span>
        <span className="text-sm text-muted">{t("priceNote")}</span>
      </p>
      {offer === "annual" && <p className="mt-1.5 text-xs font-medium text-text/70">{t("save")}</p>}

      <ul className="mt-5 flex flex-col gap-2.5">
        {[
          tp(trial ? "includes" : "includesMonthly", { n: info.startCredits }),
          tPlan("f2"),
          tPlan("f3"),
        ].map((text) => (
          <li key={text} className="flex items-center gap-2.5 text-[15px]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface/80 text-text">
              <Check size={12} strokeWidth={2.5} />
            </span>
            {text}
          </li>
        ))}
      </ul>

      {/* Условия продления — до оплаты, рядом с кнопкой. */}
      <p className="mt-5 text-xs leading-relaxed text-text/70">{t("note")}</p>

      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
      >
        {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
        {busy ? tp("redirecting") : t("cta")}
      </button>
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

  return (
    <div className="flex flex-col gap-4">
      <InAppBrowserHint />
      <p className="px-1 text-sm leading-relaxed text-muted">{t("intro")}</p>

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
            {tSub("yourPlan")}
            <b className="font-semibold">{tPlans(`${active.plan}.name`)}</b>
            {active.current_period_end
              ? active.status === "canceled"
                ? tSub("yourPlanCanceled", { date: formatDate(active.current_period_end, locale) })
                : active.status === "past_due"
                  ? tSub("yourPlanPastDue")
                  : tSub("yourPlanActive", { date: formatDate(active.current_period_end, locale) })
              : ""}
          </p>
          <Link
            href="/profile/subscription/manage"
            className="flex h-12 w-full items-center justify-center rounded-full bg-text text-[15px] font-medium text-background"
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

      {!active && !trialAvailable && sub !== undefined && <p className="px-1 text-xs leading-relaxed text-muted">{t("trialUsed")}</p>}

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
