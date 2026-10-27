"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { LEGAL_DOCS } from "@/lib/legal";
import { Check, ChevronRight, FlaskConical, Info, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import {
  checkoutErrorText,
  CheckoutError,
  fetchPaymentMode,
  fetchSubscription,
  formatDate,
  hasSavedMethod,
  isActive,
  startCheckout,
  type Subscription,
} from "@/lib/billing";
import { PLANS, formatPrice, type Plan, type PlanId } from "@/lib/plans";

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
  renewByHand,
  busy,
  disabled,
  onSubscribe,
}: {
  plan: Plan;
  current: boolean;
  // Тариф действует, но карта не привязана: продлить можно оплатой вручную.
  renewByHand: boolean;
  busy: boolean;
  disabled: boolean;
  onSubscribe: () => void;
}) {
  const s = STYLES[plan.id];
  const t = useTranslations("subscription");
  const tPlan = useTranslations(`plans.${plan.id}`);
  const locale = useLocale();
  const paid = plan.price > 0;
  return (
    <article className={`relative rounded-card p-5 ${s.card}`} aria-label={t("planAria", { name: tPlan("name") })}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.75rem] font-medium leading-none">{tPlan("name")}</h2>
          <p className={`mt-1.5 text-xs ${s.muted}`}>{tPlan("tagline")}</p>
        </div>
        {current ? (
          <span className="shrink-0 rounded-full bg-lavender/30 px-2.5 py-1 text-[11px] font-medium">
            {t("currentBadge")}
          </span>
        ) : plan.badge ? (
          <span className="shrink-0 rounded-full bg-text px-2.5 py-1 text-[11px] font-medium text-background">
            {tPlan("badge")}
          </span>
        ) : plan.id === "premium_plus" ? (
          <Sparkles size={18} strokeWidth={1.5} className="shrink-0 text-lime" aria-hidden />
        ) : null}
      </div>

      <p className="mt-5 flex items-baseline gap-1">
        <span className="font-serif text-[2.5rem] font-medium leading-none tracking-tight">
          {formatPrice(plan.price, locale)}
        </span>
        {paid && <span className={`text-sm ${s.muted}`}>{t("perMonth")}</span>}
        {plan.usd && <span className={`ml-1.5 text-sm ${s.muted}`}>≈ ${plan.usd}</span>}
      </p>
      {paid && <p className={`mt-1.5 text-xs ${s.muted}`}>{t("paidInRub")}</p>}

      <ul className="mt-5 flex flex-col gap-2.5">
        {Array.from({ length: plan.features }, (_, i) => `f${i + 1}`).map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[15px]">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${s.check}`}>
              <Check size={12} strokeWidth={2.5} />
            </span>
            {tPlan(f)}
          </li>
        ))}
      </ul>

      {paid &&
        (current && !renewByHand ? (
          <Link
            href="/profile/subscription/manage"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface text-[15px] font-medium text-text"
          >
            {t("manageButton")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSubscribe}
            disabled={disabled}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
            {busy ? t("redirecting") : t(current ? "renew" : "subscribe", { price: formatPrice(plan.price, locale) })}
          </button>
        ))}
    </article>
  );
}

export default function Plans() {
  const toast = useToast();
  const t = useTranslations("subscription");
  const tBilling = useTranslations("billing");
  const tErrors = useTranslations("billing.errors");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
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
    if (mode && !mode.available) return toast.show(tBilling("paymentSoon"));
    setBusy(plan.id);
    try {
      await startCheckout(plan.id);
      // Дальше браузер уходит на страницу оплаты — кнопку не возвращаем.
    } catch (e) {
      toast.show(e instanceof CheckoutError ? checkoutErrorText(e.reason, e.code, e.parameter, tErrors) : checkoutErrorText("failed", null, null, tErrors));
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm leading-relaxed text-muted">
        {t("intro")}
      </p>

      {mode?.test && mode.available && (
        <p className="flex gap-2.5 rounded-2xl bg-lime/40 px-4 py-3 text-xs leading-relaxed">
          <FlaskConical size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-semibold">{t("testTitle")}</b> {t("testText")}
          </span>
        </p>
      )}

      {sub && isActive(sub) && sub.current_period_end && (
        <p className="px-1 text-sm">
          {t("yourPlan")}
          <b className="font-semibold">{tPlans(`${sub.plan}.name`)}</b>
          {sub.status === "canceled"
            ? t("yourPlanCanceled", { date: formatDate(sub.current_period_end, locale) })
            : sub.status === "past_due"
              ? t("yourPlanPastDue")
              : t("yourPlanActive", { date: formatDate(sub.current_period_end, locale) })}
        </p>
      )}

      {PLANS.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          current={sub !== undefined && plan.id === currentPlan}
          renewByHand={Boolean(sub && isActive(sub) && !hasSavedMethod(sub))}
          busy={busy === plan.id}
          disabled={busy !== null || sub === undefined}
          onSubscribe={() => subscribe(plan)}
        />
      ))}

      <p className="px-2 text-center text-xs leading-relaxed text-muted">
        {t("agreePrefix")}{" "}
        <Link href={LEGAL_DOCS.offer.href} className="text-text underline underline-offset-2">
          {t("offer")}
        </Link>{" "}
        {t("and")}{" "}
        <Link href={LEGAL_DOCS.privacy.href} className="text-text underline underline-offset-2">
          {t("privacy")}
        </Link>
      </p>

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-muted">
        {mode?.available ? <Lock size={13} strokeWidth={1.75} /> : <Info size={14} strokeWidth={1.75} />}
        {mode?.available
          ? t("secure")
          : t("soon")}
      </p>

      <Link
        href="/profile/subscription/manage"
        className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
      >
        {t("manage")}
        <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
      </Link>

      {toast.node}
    </div>
  );
}
