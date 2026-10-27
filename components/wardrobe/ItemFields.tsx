"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

// Поля формы вещи — общие для «Добавить вещь» и карточки вещи.

// Цвет по ключу (см. COLOR_KEYS в lib/wardrobe.ts) — для кружка рядом с названием.
export const COLORS: Record<string, string> = {
  black: "#2c2c2a",
  white: "#ffffff",
  beige: "#d9c7ae",
  gray: "#a3a09b",
  blue: "#4a5f8c",
  brown: "#7a5a43",
};

export function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("fields");
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 px-1 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted">{t("optional")}</span>}
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
  labelFor,
  placeholder,
  prefix,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  // Как показать значение: по умолчанию как есть, для ключей — перевод.
  labelFor?: (value: string) => string;
  placeholder?: string;
  prefix?: ReactNode;
}) {
  const label = labelFor ?? ((v: string) => v);
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
        {value && !options.includes(value) && <option value={value}>{label(value)}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
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
