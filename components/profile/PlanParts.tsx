import type { ReactNode } from "react";
import { Check } from "lucide-react";

// Общий вид карточек тарифов для рублей (ЮKassa) и долларов (Stripe): цена — главный элемент.

// Цена в отдельной лаймовой плашке: самая крупная строка карточки (semibold) и мелкая подпись рядом, в одну строку.
// Цвета фиксированные: лайм и тёмный текст одинаковы в светлой и тёмной теме.
export function PricePill({ amount, unit, className = "mt-4" }: { amount: string; unit?: string; className?: string }) {
  return (
    <div className={`flex items-baseline gap-2 whitespace-nowrap rounded-[18px] bg-[#D8F27F] px-5 py-4 text-[#1F1F1F] ${className}`}>
      <span className="font-serif text-[2.75rem] font-semibold leading-none tracking-tight">{amount}</span>
      {unit && <span className="text-[15px] font-medium">{unit}</span>}
    </div>
  );
}

// Условия под кнопкой: тихий второстепенный текст (13 px, обычное начертание, тёмно-серый с контрастом не ниже 4.5:1, по центру).
export function QuietNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-center text-[13px] font-normal leading-snug text-[#5C5A57]">{children}</p>;
}

export function FeatureList({ items, tone = "bg-subtle" }: { items: string[]; tone?: string }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {items.map((text) => (
        <li key={text} className="flex items-center gap-2.5 text-[15px]">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text ${tone}`}>
            <Check size={12} strokeWidth={2.5} />
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

// Карточка «Подписка на год»: выделена сильнее остальных (акцентная рамка и фон, яркий бейдж выгоды),
// главная цена — стоимость за неделю, ниже — сколько реально списывается и когда.
export function YearlyCard({
  title,
  weekly,
  weeklyUnit,
  billed,
  badge,
  features,
  note,
  currentLabel,
  action,
}: {
  title: string;
  weekly: string;
  weeklyUnit: string;
  billed: string;
  badge: string;
  features: string[];
  note?: string;
  // Подпись «Текущий тариф», если эта подписка уже оформлена.
  currentLabel?: string;
  // Кнопка оплаты или ссылка «Моя подписка» — логику задаёт экран.
  action: ReactNode;
}) {
  return (
    <article
      aria-label={title}
      className="relative mt-3 rounded-card border-2 border-lavender bg-gradient-to-br from-lime/45 via-surface to-lavender/40 p-5 pt-6 shadow-[0_14px_34px_-18px_rgba(120,100,200,0.55)]"
    >
      <span className="absolute -top-3.5 right-4 rounded-full bg-lime px-3.5 py-1.5 text-[13px] font-bold leading-none text-text shadow-[0_4px_12px_-4px_rgba(90,120,0,0.6)] ring-4 ring-background">
        {badge}
      </span>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-[1.75rem] font-semibold leading-none">{title}</h2>
        {currentLabel && (
          <span className="shrink-0 rounded-full bg-lavender/40 px-2.5 py-1 text-[11px] font-medium">{currentLabel}</span>
        )}
      </div>
      <PricePill amount={weekly} unit={weeklyUnit} />
      <FeatureList items={features} tone="bg-surface/80" />
      {action}
      {note && <QuietNote>{billed}. {note}</QuietNote>}
    </article>
  );
}
