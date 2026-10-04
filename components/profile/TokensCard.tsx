import { plural } from "@/lib/plural";
import type { Tokens } from "@/lib/tokens";

// Подробно о токенах бета-доступа: сколько осталось и на что тратятся.
export default function TokensCard({ tokens }: { tokens: Tokens }) {
  const share = tokens.total > 0 ? Math.min(1, tokens.balance / tokens.total) : 0;
  const empty = tokens.balance <= 0;
  return (
    <section className="rounded-card border border-border bg-surface p-5" aria-label="Токены">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl font-medium leading-tight">Токены</h2>
        <span className="text-xs text-muted">тестовый доступ</span>
      </div>
      <p className="mt-3 text-[15px]">
        Осталось токенов: <span className="font-semibold tabular-nums">{tokens.balance}</span> из{" "}
        <span className="tabular-nums">{tokens.total}</span>
      </p>
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tokens.total}
        aria-valuenow={tokens.balance}
        aria-label={`Осталось ${plural(tokens.balance, ["токен", "токена", "токенов"])}`}
      >
        <div
          className={`h-full rounded-full ${empty ? "bg-pink" : "bg-lime"}`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {empty && <span className="mb-1 block font-medium text-text">Токены закончились. Это тестовый доступ.</span>}
        Токен тратится на примерку, добавление вещи и создание аватара. Повтор сохранённого образа —
        бесплатно.
      </p>
    </section>
  );
}
