import { useTranslations } from "next-intl";
import { getPlan, type PlanId } from "@/lib/plans";
import type { Tokens } from "@/lib/tokens";

// Сколько токенов осталось и на что тратятся.
// Premium / Premium+ — «осталось X из 50 / 150» (столько начисляется каждый оплаченный месяц).
// Бесплатный тариф — просто остаток: стартовые 10 токенов не пополняются.
export default function TokensCard({ tokens, plan }: { tokens: Tokens; plan: PlanId | null }) {
  const t = useTranslations("profile.tokens");
  const monthly = plan && plan !== "free" ? getPlan(plan).tokens : null;
  const share = monthly ? Math.min(1, tokens.balance / monthly) : 0;
  const empty = tokens.balance <= 0;
  const bold = (chunks: React.ReactNode) => <span className="font-semibold tabular-nums">{chunks}</span>;
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-label={t("title")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl font-medium leading-tight">{t("title")}</h2>
        <span className="text-xs text-muted">
          {monthly ? t("planPaid", { name: getPlan(plan as PlanId).name }) : t("planFree")}
        </span>
      </div>
      {monthly ? (
        <>
          <p className="mt-3 text-[15px]">{t.rich("leftOf", { count: tokens.balance, monthly, b: bold })}</p>
          <div
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-subtle"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={monthly}
            aria-valuenow={tokens.balance}
            aria-label={t("aria", { count: tokens.balance })}
          >
            <div
              className={`h-full rounded-full ${empty ? "bg-pink" : "bg-lime"}`}
              style={{ width: `${share * 100}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-[15px]">{t.rich("leftFree", { count: tokens.balance, b: bold })}</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {empty && (
          <span className="mb-1 block font-medium text-text">{monthly ? t("emptyPaid") : t("emptyFree")}</span>
        )}
        {monthly && <span className="mb-1 block">{t("monthly", { monthly })}</span>}
        {t("spend")}
      </p>
    </section>
  );
}
