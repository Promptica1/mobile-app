import { ChevronDown, RefreshCw, Shirt, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

const CATEGORIES = ["Верхняя одежда", "Верх", "Низ", "Обувь", "Аксессуары"];
const COLORS: Record<string, string> = {
  Чёрный: "#2c2c2a",
  Белый: "#ffffff",
  Бежевый: "#d9c7ae",
  Серый: "#a3a09b",
  Синий: "#4a5f8c",
  Коричневый: "#7a5a43",
};
const MATERIALS = ["Кожа", "Хлопок", "Лён", "Шерсть", "Кашемир", "Деним", "Синтетика"];

function Field({
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

const rowClass =
  "flex h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-[15px] transition-colors focus-within:border-lavender";

function SelectRow({
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

type Props = {
  onRetake: () => void;
  onSubmit: () => void;
};

export default function StepReview({ onRetake, onSubmit }: Props) {
  // Значения «распознаны AI» — пока тестовые.
  const [name, setName] = useState("Кожаная куртка");
  const [category, setCategory] = useState("Верхняя одежда");
  const [color, setColor] = useState("Чёрный");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [comment, setComment] = useState("");

  return (
    <form
      className="flex flex-1 flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex gap-4">
        <div className="flex aspect-[3/4] w-32 shrink-0 items-center justify-center rounded-card border border-border bg-surface">
          <Shirt size={44} strokeWidth={1} className="text-muted" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <Field label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${rowClass} outline-none`}
            />
          </Field>
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-lavender/25 px-3 py-1.5 text-xs font-medium">
            <Sparkles size={13} strokeWidth={1.75} />
            Распознано AI
          </span>
        </div>
      </div>

      <Button variant="secondary" onClick={onRetake}>
        <RefreshCw size={18} strokeWidth={1.75} />
        Загрузить другое фото
      </Button>

      <div className="flex flex-col gap-4">
        <Field label="Категория">
          <SelectRow value={category} onChange={setCategory} options={CATEGORIES} />
        </Field>
        <Field label="Цвет" optional>
          <SelectRow
            value={color}
            onChange={setColor}
            options={Object.keys(COLORS)}
            placeholder="Не выбран"
            prefix={
              color && (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: COLORS[color] }}
                />
              )
            }
          />
        </Field>
        <Field label="Материал" optional>
          <SelectRow
            value={material}
            onChange={setMaterial}
            options={MATERIALS}
            placeholder="Не выбран"
          />
        </Field>
        <Field label="Бренд" optional>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Например, Zara"
            className={`${rowClass} outline-none placeholder:text-muted`}
          />
        </Field>
        <Field label="Комментарий" optional>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Заметка к вещи…"
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-4 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
          />
        </Field>
      </div>

      <Button variant="lime" type="submit" className="mt-2">
        Добавить в гардероб
      </Button>
    </form>
  );
}
