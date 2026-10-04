import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// Поля формы вещи — общие для «Добавить вещь» и карточки вещи.

export const COLORS: Record<string, string> = {
  Чёрный: "#2c2c2a",
  Белый: "#ffffff",
  Бежевый: "#d9c7ae",
  Серый: "#a3a09b",
  Синий: "#4a5f8c",
  Коричневый: "#7a5a43",
};
export const MATERIALS = ["Кожа", "Хлопок", "Лён", "Шерсть", "Кашемир", "Деним", "Синтетика"];

export function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 px-1 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted">необязательно</span>}
      </span>
      {children}
    </label>
  );
}

export const rowClass =
  "flex h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-[15px] transition-colors focus-within:border-lavender";

export function SelectRow({
  value,
  onChange,
  options,
  placeholder,
  prefix,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  prefix?: ReactNode;
}) {
  return (
    <div className={`relative ${rowClass}`}>
      {prefix}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-full w-full appearance-none bg-transparent pr-8 outline-none ${value ? "" : "text-muted"}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {/* Значение не из списка (сохранено раньше) тоже показываем. */}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-4 text-muted"
      />
    </div>
  );
}
