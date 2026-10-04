import { Camera, ImageIcon, Lightbulb, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Photo from "@/components/ui/Photo";
import { CATEGORIES } from "@/lib/wardrobe";

type Props = {
  photoUrl: string | null;
  category: string | null;
  onCategory: (category: string) => void;
  preparing: boolean;
  error: string;
  onCamera: () => void;
  onGallery: () => void;
  onNext: () => void;
};

export default function StepPhoto({
  photoUrl,
  category,
  onCategory,
  preparing,
  error,
  onCamera,
  onGallery,
  onNext,
}: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <button
        type="button"
        onClick={onGallery}
        disabled={preparing}
        aria-label={photoUrl ? "Выбрать другое фото" : "Добавить фото из галереи"}
        className={`relative flex aspect-[4/3.4] w-full flex-col items-center justify-center overflow-hidden rounded-card px-6 text-center transition-colors ${
          photoUrl
            ? "border border-border bg-surface p-4"
            : "border-[1.5px] border-dashed border-text/20 bg-surface/60 hover:border-lavender"
        }`}
      >
        {preparing ? (
          <>
            <LoaderCircle size={28} strokeWidth={1.5} className="animate-spin text-lavender" />
            <span className="mt-4 text-sm text-muted">Готовим фото…</span>
          </>
        ) : photoUrl ? (
          <Photo src={photoUrl} alt="Выбранное фото вещи" />
        ) : (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender/20">
              <ImageIcon size={26} strokeWidth={1.5} />
            </span>
            <span className="mt-5 font-medium">Добавьте фото вещи</span>
            <span className="mt-1.5 text-sm text-muted">Один предмет одежды на светлом фоне</span>
          </>
        )}
      </button>

      {error && <FormMessage tone="error">{error}</FormMessage>}

      {/* Тип вещи подсказывает AI, что именно вырезать с фото */}
      {photoUrl && !preparing && (
        <fieldset>
          <legend className="mb-1 px-1 text-sm font-medium">Что добавляем?</legend>
          <p className="mb-3 px-1 text-xs text-muted">Вырежем с фото только эту вещь</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCategory(c)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    active
                      ? "border-text bg-text text-background"
                      : "border-border bg-surface text-text hover:border-text/30"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-3">
        {photoUrl ? (
          <>
            <Button variant="lime" onClick={onNext} disabled={preparing || !category}>
              {category ? "Продолжить" : "Выберите, что добавляем"}
            </Button>
            <Button variant="secondary" onClick={onGallery} disabled={preparing}>
              <RefreshCw size={18} strokeWidth={1.75} />
              Выбрать другое фото
            </Button>
          </>
        ) : (
          <>
            <Button variant="lavender" onClick={onCamera} disabled={preparing}>
              <Camera size={20} strokeWidth={1.75} />
              Сделать фото
            </Button>
            <Button variant="secondary" onClick={onGallery} disabled={preparing}>
              <Upload size={20} strokeWidth={1.75} />
              Загрузить из галереи
            </Button>
          </>
        )}
      </div>

      <div className="flex gap-3 rounded-2xl bg-beige p-4">
        <Lightbulb size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <p className="text-sm leading-relaxed">
          <span className="font-medium">Совет:</span> снимайте так, чтобы вещь было
          хорошо видно — желательно одну, без других похожих вещей в кадре. Так AI
          вырежет её точнее
        </p>
      </div>
    </div>
  );
}
