"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Shirt, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { COLORS, Field, SelectRow, rowClass } from "@/components/wardrobe/ItemFields";
import { Button } from "@/components/ui/Button";
import ConfirmDeleteSheet from "@/components/ui/ConfirmDeleteSheet";
import FormMessage from "@/components/ui/FormMessage";
import Photo from "@/components/ui/Photo";
import ZoomablePhoto from "@/components/ui/PhotoZoom";
import SubmitButton from "@/components/ui/SubmitButton";
import { deleteItem, fetchItem, setItemFavorite, updateItem } from "@/lib/items";
import { CATEGORY_ICONS } from "@/lib/tryOn";
import { CATEGORIES, COLOR_KEYS, MATERIAL_KEYS, toCategory, type NewWardrobeItem, type WardrobeItem } from "@/lib/wardrobe";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "missing" }
  | { status: "ready"; item: WardrobeItem };

// Поля формы — строки; пустое необязательное поле сохраняется как null.
type Form = Record<keyof NewWardrobeItem, string>;
const toForm = (i: WardrobeItem): Form => ({
  name: i.name,
  category: i.category,
  color: i.color ?? "",
  material: i.material ?? "",
  brand: i.brand ?? "",
  comment: i.comment ?? "",
});
const orNull = (v: string) => v.trim() || null;

export default function ItemDetail({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations("itemDetail");
  const tCategories = useTranslations("categories");
  const tColors = useTranslations("colors");
  const tMaterials = useTranslations("materials");
  const [state, setState] = useState<State>({ status: "loading" });
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchItem(id).then(
      (item) => {
        if (!item) return setState({ status: "missing" });
        setForm(toForm(item));
        setState({ status: "ready", item });
      },
      () => setState({ status: "error" }),
    );
  }, [id]);
  useEffect(load, [load]);
  const retry = () => {
    setState({ status: "loading" });
    load();
  };

  useEffect(() => {
    if (state.status === "ready") document.title = `${state.item.name} — MIRRO`;
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const back = (
    <Link
      href="/wardrobe"
      aria-label={t("backToWardrobe")}
      className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
    >
      <ArrowLeft size={22} strokeWidth={1.5} />
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div aria-busy>
        <header className="py-4">{back}</header>
        <div className="flex flex-col gap-5" aria-hidden>
          <div className="aspect-square animate-pulse rounded-card bg-border/60" />
          <div className="h-14 animate-pulse rounded-2xl bg-border/60" />
          <div className="h-14 animate-pulse rounded-2xl bg-border/60" />
        </div>
      </div>
    );
  }

  if (state.status !== "ready" || !form) {
    const missing = state.status === "missing";
    return (
      <div className="flex flex-1 flex-col">
        <header className="py-4">{back}</header>
        <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          <p className="font-serif text-3xl font-medium">
            {missing ? t("missingTitle") : t("loadErrorTitle")}
          </p>
          <p className="mt-2 text-sm text-muted">
            {missing ? t("missingText") : t("loadErrorText")}
          </p>
          {missing ? (
            <Link href="/wardrobe" className="mt-6 rounded-full bg-lime px-6 py-3 text-sm font-medium">
              {t("toWardrobe")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={retry}
              className="mt-6 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:border-text/30"
            >
              {t("retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { item } = state;
  const setItem = (patch: Partial<WardrobeItem>) =>
    setState((prev) => (prev.status === "ready" ? { ...prev, item: { ...prev.item, ...patch } } : prev));
  const set = (key: keyof Form) => (value: string) => {
    setError("");
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  // Кнопка «Сохранить» активна, только если что-то изменилось.
  const saved = toForm(item);
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k].trim() !== saved[k].trim());

  const toggleFavorite = async () => {
    const next = !item.is_favorite;
    setItem({ is_favorite: next });
    try {
      await setItemFavorite(item.id, next);
    } catch {
      setItem({ is_favorite: !next });
      setToast(t("favoriteError"));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t("nameRequired"));
    const fields: NewWardrobeItem = {
      name: form.name.trim(),
      category: toCategory(form.category) ?? item.category,
      color: orNull(form.color),
      material: orNull(form.material),
      brand: orNull(form.brand),
      comment: orNull(form.comment),
    };
    setSaving(true);
    setError("");
    try {
      await updateItem(item.id, fields);
      setItem(fields);
      setForm(toForm({ ...item, ...fields }));
      setToast(t("saved"));
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const Icon = CATEGORY_ICONS[item.category] ?? Shirt;
  const placeholder = <Icon size={56} strokeWidth={1} className="text-muted" />;

  return (
    <>
      <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 py-4">
        {back}
        <h1 className="truncate text-center font-serif text-3xl font-medium leading-none">{item.name}</h1>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={item.is_favorite ? t("favoriteRemove") : t("favoriteAdd")}
          aria-pressed={item.is_favorite}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink/15 transition-colors hover:bg-pink/25"
        >
          <Heart size={20} strokeWidth={1.75} className={item.is_favorite ? "fill-pink text-pink" : "text-pink"} />
        </button>
      </header>

      <form className="flex flex-col gap-5" onSubmit={handleSave} noValidate>
        {/* Нажатие на фото открывает его крупно */}
        <ZoomablePhoto
          src={item.photo_url ?? null}
          alt={item.name}
          className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-card border border-border bg-surface p-6"
        >
          {item.photo_url ? <Photo src={item.photo_url} alt={item.name} fallback={placeholder} /> : placeholder}
        </ZoomablePhoto>

        <div className="flex flex-col gap-4">
          <Field label={t("name")}>
            <input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              maxLength={60}
              placeholder={t("namePlaceholder")}
              className={`${rowClass} outline-none placeholder:text-muted`}
            />
          </Field>
          <Field label={t("category")}>
            <SelectRow value={form.category} onChange={set("category")} options={CATEGORIES} labelFor={(v) => (tCategories.has(v) ? tCategories(v) : v)} />
          </Field>
          <Field label={t("color")} optional>
            <SelectRow
              value={form.color}
              onChange={set("color")}
              options={COLOR_KEYS}
              labelFor={(v) => (tColors.has(v) ? tColors(v) : v)}
              placeholder={t("notChosen")}
              prefix={
                COLORS[form.color] && (
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: COLORS[form.color] }}
                  />
                )
              }
            />
          </Field>
          <Field label={t("material")} optional>
            <SelectRow value={form.material} onChange={set("material")} options={MATERIAL_KEYS} labelFor={(v) => (tMaterials.has(v) ? tMaterials(v) : v)} placeholder={t("notChosen")} />
          </Field>
          <Field label={t("brand")} optional>
            <input
              value={form.brand}
              onChange={(e) => set("brand")(e.target.value)}
              maxLength={60}
              placeholder={t("brandPlaceholder")}
              className={`${rowClass} outline-none placeholder:text-muted`}
            />
          </Field>
          <Field label={t("comment")} optional>
            <textarea
              value={form.comment}
              onChange={(e) => set("comment")(e.target.value)}
              maxLength={500}
              placeholder={t("commentPlaceholder")}
              rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-4 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
            />
          </Field>
        </div>

        {error && <FormMessage tone="error">{error}</FormMessage>}

        <div className="mt-1 flex flex-col gap-3">
          {dirty ? (
            <SubmitButton loading={saving}>{saving ? t("saving") : t("saveChanges")}</SubmitButton>
          ) : (
            <Button variant="lime" type="submit" disabled>
              {t("noChanges")}
            </Button>
          )}
          <Button variant="secondary" className="text-danger!" onClick={() => setConfirmDelete(true)} disabled={saving}>
            <Trash2 size={18} strokeWidth={1.75} />
            {t("delete")}
          </Button>
        </div>
      </form>

      {confirmDelete && (
        <ConfirmDeleteSheet
          title={t("deleteTitle")}
          text={t("deleteText", { name: item.name })}
          onClose={() => setConfirmDelete(false)}
          onDelete={async () => {
            await deleteItem(item);
            router.replace("/wardrobe");
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background"
        >
          {toast}
        </div>
      )}
    </>
  );
}
