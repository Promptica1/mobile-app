import { useTranslations } from "next-intl";
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
  const t = useTranslations("addItem.hint");
  return (
    <Field label={t("label")} optional>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={HINT_MAX}
        disabled={disabled}
        placeholder={t("placeholder")}
        className={`${rowClass} outline-none placeholder:text-muted disabled:opacity-60`}
      />
      <span className="mt-1.5 block px-1 text-xs leading-relaxed text-muted">
        {t("examples")}
      </span>
    </Field>
  );
}
