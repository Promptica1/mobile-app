"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, LoaderCircle, PersonStanding, RefreshCw, X } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import FormMessage from "@/components/ui/FormMessage";
import Photo from "@/components/ui/Photo";
import SubmitButton from "@/components/ui/SubmitButton";
import { AvatarError, createAvatar, type Avatar } from "@/lib/avatar";
import { compressImage } from "@/lib/image";

type Picked = { blob: Blob; url: string };

type Props = {
  // create — первый раз (есть «Пропустить пока»), update — пересоздание из меню.
  mode: "create" | "update";
  current: Avatar;
  onDone: (avatar: Avatar) => void;
  onClose: () => void;
};

const ERRORS: Record<AvatarError["stage"], string> = {
  generate: "Не получилось создать аватар. Попробуйте ещё раз чуть позже или с другим селфи.",
  upload: "Аватар создан, но не сохранился. Проверьте интернет и попробуйте ещё раз.",
  save: "Аватар создан, но не сохранился. Проверьте интернет и попробуйте ещё раз.",
};

function PhotoSlot({
  label,
  hint,
  icon: Icon,
  photo,
  onPick,
}: {
  label: string;
  hint: string;
  icon: typeof Camera;
  photo: Picked | null;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onPick(file);
  };
  return (
    <div>
      <input ref={input} type="file" accept="image/*" hidden onChange={handleChange} aria-label={label} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={photo ? `${label}: заменить фото` : `${label}: добавить фото`}
        className={`relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-card px-3 text-center transition-colors ${
          photo
            ? "border border-border bg-surface"
            : "border-[1.5px] border-dashed border-text/20 bg-surface/60 hover:border-lavender"
        }`}
      >
        {photo ? (
          <>
            <Photo src={photo.url} alt={label} className="object-cover" />
            <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 backdrop-blur-sm">
              <RefreshCw size={14} strokeWidth={1.75} />
            </span>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender/20">
              <Icon size={22} strokeWidth={1.5} />
            </span>
            <span className="mt-3 text-sm font-medium">{label}</span>
          </>
        )}
      </button>
      <p className="mt-1.5 px-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-4 transition-colors focus-within:border-lavender">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="—"
          className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        <span className="text-sm text-muted">{unit}</span>
      </span>
    </label>
  );
}

export default function AvatarSetup({ mode, current, onDone, onClose }: Props) {
  const [selfie, setSelfie] = useState<Picked | null>(null);
  const [fullBody, setFullBody] = useState<Picked | null>(null);
  const [height, setHeight] = useState(current.heightCm ? String(current.heightCm) : "");
  const [weight, setWeight] = useState(current.weightKg ? String(current.weightKg) : "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Освобождаем память превью.
  useEffect(() => () => void (selfie && URL.revokeObjectURL(selfie.url)), [selfie]);
  useEffect(() => () => void (fullBody && URL.revokeObjectURL(fullBody.url)), [fullBody]);

  const pick = (set: (p: Picked) => void) => async (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Это не похоже на фото. Выберите картинку.");
      return;
    }
    try {
      const blob = await compressImage(file);
      set({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Не получилось открыть это фото. Попробуйте другое.");
    }
  };

  const handleCreate = async () => {
    if (!selfie) {
      setError("Добавьте селфи — без него AI не сможет создать аватар.");
      return;
    }
    const h = height ? Number(height) : null;
    const w = weight ? Number(weight) : null;
    if (h !== null && (h < 100 || h > 230)) {
      setError("Рост — от 100 до 230 см. Или оставьте поле пустым.");
      return;
    }
    if (w !== null && (w < 30 || w > 250)) {
      setError("Вес — от 30 до 250 кг. Или оставьте поле пустым.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const avatar = await createAvatar({
        selfie: selfie.blob,
        fullBody: fullBody?.blob ?? null,
        heightCm: h,
        weightKg: w,
        previousPath: current.path,
      });
      onDone(avatar);
    } catch (err) {
      setError(err instanceof AvatarError ? ERRORS[err.stage] : ERRORS.generate);
      setCreating(false);
    }
  };

  // Рендерим поверх всего приложения (в т.ч. нижней навигации) через портал.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-setup-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex h-10 justify-end">
          {mode === "update" && !creating && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
            >
              <X size={22} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <h2 id="avatar-setup-title" className="font-serif text-4xl font-medium leading-tight tracking-tight">
          {mode === "update" ? "Обновите аватар" : "Создайте аватар"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          AI соберёт вашу цифровую копию, чтобы примерять на неё одежду
        </p>

        {creating ? (
          <div className="flex flex-1 flex-col items-center pt-8" aria-live="polite">
            <div className="relative flex aspect-[3/4] w-48 items-center justify-center overflow-hidden rounded-card bg-gradient-to-b from-beige to-[#e9dfd2] px-8 py-6">
              <Silhouette variant="filled" className="h-full w-full text-text/15" />
              <span className="absolute inset-x-5 h-px animate-scan bg-lavender shadow-[0_0_12px_2px] shadow-lavender/60" />
            </div>
            <p className="mt-6 flex items-center gap-2 text-[15px] font-medium">
              <LoaderCircle size={18} strokeWidth={2} className="animate-spin text-lavender" />
              AI создаёт ваш аватар…
            </p>
            <p className="mt-2 text-center text-xs text-muted">Обычно это занимает 10–40 секунд</p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3">
              <PhotoSlot
                label="Селфи"
                hint="Обязательно · лицо крупно, при дневном свете"
                icon={Camera}
                photo={selfie}
                onPick={pick(setSelfie)}
              />
              <PhotoSlot
                label="В полный рост"
                hint="Необязательно · так аватар будет точнее"
                icon={PersonStanding}
                photo={fullBody}
                onPick={pick(setFullBody)}
              />
            </div>

            <fieldset>
              <legend className="mb-2 flex items-baseline gap-2 px-1 text-sm font-medium">
                Параметры <span className="text-xs font-normal text-muted">необязательно</span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Рост" unit="см" value={height} onChange={setHeight} />
                <NumberField label="Вес" unit="кг" value={weight} onChange={setWeight} />
              </div>
            </fieldset>

            {error && <FormMessage tone="error">{error}</FormMessage>}

            <div className="flex flex-col gap-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
              >
                <SubmitButton loading={creating}>
                  {mode === "update" ? "Обновить аватар" : "Создать аватар"}
                </SubmitButton>
              </form>
              {mode === "create" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mx-auto py-1 text-sm text-muted underline-offset-4 hover:text-text hover:underline"
                >
                  Пропустить пока
                </button>
              )}
              <p className="px-2 text-center text-xs leading-relaxed text-muted">
                Фото отправляются AI-сервису только для создания аватара и не сохраняются в
                приложении — хранится лишь готовый аватар.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
