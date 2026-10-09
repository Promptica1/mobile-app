import { plural } from "@/lib/plural";
import { getPlan, type PlanId } from "@/lib/plans";
import type { Tokens } from "@/lib/tokens";

// Сколько токенов осталось и на что тратятся.
// Premium / Premium+ — «осталось X из 50 / 150» (столько начисляется каждый оплаченный месяц).
// Бесплатный тариф — просто остаток: стартовые 10 токенов не пополняются.
export default function TokensCard({ tokens, plan }: { tokens: Tokens; plan: PlanId | null }) {
  const monthly = plan && plan !== "free" ? getPlan(plan).tokens : null;
  const share = monthly ? Math.min(1, tokens.balance / monthly) : 0;
  const empty = tokens.balance <= 0;
  const left = plural(tokens.balance, ["токен", "токена", "токенов"]);
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-label="Токены">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl font-medium leading-tight">Токены</h2>
        <span className="text-xs text-muted">{monthly ? `тариф ${getPlan(plan as PlanId).name}` : "бесплатный тариф"}</span>
      </div>
      {monthly ? (
        <>
          <p className="mt-3 text-[15px]">
            Осталось <span className="font-semibold tabular-nums">{tokens.balance}</span> из{" "}
            <span className="tabular-nums">{monthly}</span>
          </p>
          <div
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-subtle"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={monthly}
            aria-valuenow={tokens.balance}
            aria-label={`Осталось ${left}`}
          >
            <div
              className={`h-full rounded-full ${empty ? "bg-pink" : "bg-lime"}`}
              style={{ width: `${share * 100}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-[15px]">
          Осталось <span className="font-semibold tabular-nums">{tokens.balance}</span>{" "}
          {left.slice(String(tokens.balance).length + 1)}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {empty && (
          <span className="mb-1 block font-medium text-text">
            {monthly ? "Токены закончились — новые придут в день продления подписки." : "Токены закончились. Больше токенов — с подпиской Premium."}
          </span>
        )}
        {monthly && <span className="mb-1 block">Каждый месяц баланс обновляется до {monthly}, остаток не переносится.</span>}
        Токен тратится на примерку, добавление вещи и создание аватара. Повтор сохранённого образа —
        бесплатно.
      </p>
    </section>
  );
}
