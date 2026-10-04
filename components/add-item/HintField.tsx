import { Field, rowClass } from "@/components/wardrobe/ItemFields";

// Сервер обрезает уточнение до того же лимита (lib/runware.ts → GARMENT_HINT_MAX).
const HINT_MAX = 200;

// «Уточнение для AI»: попадает в задание для модели при вырезании вещи.
// Не путать с «Комментарием» — тот только для себя и на генерацию не влияет.
export default function HintField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label="Уточнение для AI" optional>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={HINT_MAX}
        disabled={disabled}
        placeholder="Например: без лишних пуговиц"
        className={`${rowClass} outline-none placeholder:text-muted disabled:opacity-60`}
      />
      <span className="mt-1.5 block px-1 text-xs leading-relaxed text-muted">
        Подскажите AI, как точнее вырезать вещь: без лишних пуговиц · широкий крой · заправленная
        рубашка · оверсайз · приталенный · длинные рукава
      </span>
    </Field>
  );
}
