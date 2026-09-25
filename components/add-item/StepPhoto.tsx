import { Camera, ImageIcon, Lightbulb, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function StepPhoto({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <button
        type="button"
        onClick={onNext}
        className="flex aspect-[4/3.4] w-full flex-col items-center justify-center rounded-card border-[1.5px] border-dashed border-text/20 bg-surface/60 px-6 text-center transition-colors hover:border-lavender"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender/20">
          <ImageIcon size={26} strokeWidth={1.5} />
        </span>
        <span className="mt-5 font-medium">Добавьте фото вещи</span>
        <span className="mt-1.5 text-sm text-muted">
          Один предмет одежды на светлом фоне
        </span>
      </button>

      <div className="flex flex-col gap-3">
        <Button variant="lavender" onClick={onNext}>
          <Camera size={20} strokeWidth={1.75} />
          Сделать фото
        </Button>
        <Button variant="secondary" onClick={onNext}>
          <Upload size={20} strokeWidth={1.75} />
          Загрузить из галереи
        </Button>
      </div>

      <div className="flex gap-3 rounded-2xl bg-beige p-4">
        <Lightbulb size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <p className="text-sm leading-relaxed">
          <span className="font-medium">Совет:</span> снимайте вещь на однотонном
          фоне — так AI распознает её точнее
        </p>
      </div>
    </div>
  );
}
