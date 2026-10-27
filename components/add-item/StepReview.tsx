import { Info, LoaderCircle, RefreshCw, Shirt, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import ZoomablePhoto from "@/components/ui/PhotoZoom";
import HintField from "./HintField";
import { useState, type FormEvent } from "react";
import { COLORS, Field, SelectRow, rowClass } from "@/components/wardrobe/ItemFields";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import Photo from "@/components/ui/Photo";
import { SaveItemError } from "@/lib/items";
import { CATEGORIES, COLOR_KEYS, MATERIAL_KEYS, toCategory, type Category, type NewWardrobeItem } from "@/lib/wardrobe";

type Props = {
  photoUrl: string | null;
  preparing: boolean;
  photoError: string;
  notice: string;
  category: Category;
  onCategoryChange: (category: Category) => void;
  // Сколько ещё раз можно запустить AI-вырезание с другим фото.
  retriesLeft: number;
  onRetake: () => void;
  // Уточнение для AI и повторное вырезание с ним (того же фото).
  hint: string;
  onHintChange: (hint: string) => void;
  onRegenerate: () => void;
  onSubmit: (item: NewWardrobeItem) => Promise<void>;
};

// Пустая строка в необязательном поле сохраняется как null.
const orNull = (value: string) => value.trim() || null;

export default function StepReview({
  photoUrl,
  preparing,
  photoError,
  notice,
  category,
  onCategoryChange,
  retriesLeft,
  onRetake,
  hint,
  onHintChange,
  onRegenerate,
  onSubmit,
}: Props) {
  const t = useTranslations("addItem.review");
  const tCategories = useTranslations("categories");
  const tColors = useTranslations("colors");
  const tMaterials = useTranslations("materials");
  // Категория приходит с шага 1, остальные поля заполняет пользователь.
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
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
          ? t("uploadError")
          : t("saveError"),
      );
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-1 flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div className="flex gap-4">
        {/* Нажатие на фото открывает его крупно */}
        <ZoomablePhoto
          src={preparing ? null : photoUrl}
          alt={t("photoAlt")}
          className="flex aspect-[3/4] w-32 shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-surface p-2"
        >
          {preparing ? (
            <LoaderCircle size={24} strokeWidth={1.5} className="animate-spin text-lavender" />
          ) : photoUrl ? (
            <Photo src={photoUrl} alt={t("photoAlt")} />
          ) : (
            <Shirt size={44} strokeWidth={1} className="text-muted" />
          )}
        </ZoomablePhoto>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <Field label={t("name")}>
            <input
              value={name}
              onChange={(e) => {
                setError("");
                setName(e.target.value);
              }}
              placeholder={t("namePlaceholder")}
              className={`${rowClass} outline-none placeholder:text-muted`}
            />
          </Field>
        </div>
      </div>

      {photoError && <FormMessage tone="error">{photoError}</FormMessage>}
      {notice && !photoError && (
        <FormMessage tone="info" icon={Info}>
          {notice}
        </FormMessage>
      )}
      {retriesLeft > 0 ? (
        <div className="flex flex-col gap-3">
          <HintField value={hint} onChange={onHintChange} disabled={saving || preparing} />
          <Button variant="secondary" onClick={onRegenerate} disabled={saving || preparing}>
            <WandSparkles size={18} strokeWidth={1.75} />
            {hint.trim() ? t("regenerateWithHint") : t("regenerate")}
          </Button>
          <Button variant="secondary" onClick={onRetake} disabled={saving || preparing}>
            <RefreshCw size={18} strokeWidth={1.75} />
            {t("uploadAnother")}
          </Button>
          <p className="text-center text-xs text-muted">
            {t("triesLeft", { count: retriesLeft })}
          </p>
        </div>
      ) : (
        <FormMessage tone="info" icon={Info}>
          {t("triesOver")}
        </FormMessage>
      )}

      <div className="flex flex-col gap-4">
        <Field label={t("category")}>
          <SelectRow value={category} onChange={(v) => { const c = toCategory(v); if (c) onCategoryChange(c); }} options={CATEGORIES} labelFor={(v) => tCategories(v)} />
        </Field>
        <Field label={t("color")} optional>
          <SelectRow
            value={color}
            onChange={setColor}
            options={COLOR_KEYS}
            labelFor={(v) => (tColors.has(v) ? tColors(v) : v)}
            placeholder={t("notChosen")}
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
        <Field label={t("material")} optional>
          <SelectRow
            value={material}
            onChange={setMaterial}
            options={MATERIAL_KEYS}
            labelFor={(v) => (tMaterials.has(v) ? tMaterials(v) : v)}
            placeholder={t("notChosen")}
          />
        </Field>
        <Field label={t("brand")} optional>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder={t("brandPlaceholder")}
            className={`${rowClass} outline-none placeholder:text-muted`}
          />
        </Field>
        <Field label={t("comment")} optional>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("commentPlaceholder")}
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-4 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
          />
        </Field>
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="mt-2">
        <SubmitButton loading={saving}>
          {saving ? t("saving") : t("submit")}
        </SubmitButton>
      </div>
    </form>
  );
}
