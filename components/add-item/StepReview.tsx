import { ChevronDown, LoaderCircle, RefreshCw, Shirt } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import Photo from "@/components/ui/Photo";
import { SaveItemError } from "@/lib/items";
import { CATEGORIES, type NewWardrobeItem } from "@/lib/wardrobe";

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
  photoUrl: string | null;
  preparing: boolean;
  photoError: string;
  onRetake: () => void;
  onSubmit: (item: NewWardrobeItem) => Promise<void>;
};

// Пустая строка в необязательном поле сохраняется как null.
const orNull = (value: string) => value.trim() || null;

export default function StepReview({ photoUrl, preparing, photoError, onRetake, onSubmit }: Props) {
  // AI пока не подключён: поля заполняет пользователь, категория — первая по умолчанию.
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Добавьте название вещи — так её будет проще найти.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        category,
        color: orNull(color),
        material: orNull(material),
        brand: orNull(brand),
        comment: orNull(comment),
      });
    } catch (err) {
      setError(
        err instanceof SaveItemError && err.stage === "upload"
          ? "Не получилось загрузить фото. Проверьте интернет и попробуйте ещё раз."
          : "Не получилось сохранить вещь. Проверьте интернет и попробуйте ещё раз.",
      );
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-1 flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div className="flex gap-4">
        <div className="flex aspect-[3/4] w-32 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface p-2">
          {preparing ? (
            <LoaderCircle size={24} strokeWidth={1.5} className="animate-spin text-lavender" />
          ) : photoUrl ? (
            <Photo src={photoUrl} alt="Фото вещи" />
          ) : (
            <Shirt size={44} strokeWidth={1} className="text-muted" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <Field label="Название">
            <input
              value={name}
              onChange={(e) => {
                setError("");
                setName(e.target.value);
              }}
              placeholder="Например, тренч"
              className={`${rowClass} outline-none placeholder:text-muted`}
            />
          </Field>
        </div>
      </div>

      {photoError && <FormMessage tone="error">{photoError}</FormMessage>}
      <Button variant="secondary" onClick={onRetake} disabled={saving || preparing}>
        <RefreshCw size={18} strokeWidth={1.75} />
        Загрузить другое фото
      </Button>

      <div className="flex flex-col gap-4">
        <Field label="Категория">
          <SelectRow value={category} onChange={setCategory} options={[...CATEGORIES]} />
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

      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="mt-2">
        <SubmitButton loading={saving}>
          {saving ? "Сохраняем…" : "Добавить в гардероб"}
        </SubmitButton>
      </div>
    </form>
  );
}
