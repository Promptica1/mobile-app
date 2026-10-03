import { Check, LoaderCircle, Minus, Shirt } from "lucide-react";
import Photo from "@/components/ui/Photo";

export type ProcessingPhase = "removing" | "done" | "fallback";

type Props = { photoUrl: string | null; phase: ProcessingPhase };

type Status = "done" | "active" | "pending" | "skipped";

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green text-surface">
        <Check size={14} strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "active") {
    return <LoaderCircle size={24} strokeWidth={2} className="animate-spin text-lavender" />;
  }
  if (status === "skipped") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-border text-muted">
        <Minus size={14} strokeWidth={2.5} />
      </span>
    );
  }
  return <span className="h-6 w-6 rounded-full border-2 border-border" />;
}

export default function StepProcessing({ photoUrl, phase }: Props) {
  const removing = phase === "removing";
  const steps: { label: string; status: Status }[] = [
    { label: "Фото загружено", status: "done" },
    removing
      ? { label: "Вырезаем вещь…", status: "active" }
      : phase === "done"
        ? { label: "Вещь вырезана", status: "done" }
        : { label: "Оставили исходное фото", status: "skipped" },
    { label: "Готовим карточку вещи", status: removing ? "pending" : "done" },
  ];

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="relative mt-4 flex aspect-square w-56 items-center justify-center overflow-hidden rounded-card border border-border bg-surface">
        {photoUrl ? (
          <div className="absolute inset-3">
            <Photo src={photoUrl} alt="Фото вещи" />
          </div>
        ) : (
          <Shirt size={72} strokeWidth={0.9} className="text-muted" />
        )}
        {removing && (
          <span className="absolute inset-x-6 h-px animate-scan bg-lavender shadow-[0_0_12px_2px] shadow-lavender/60" />
        )}
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {removing ? "AI вырезает вещь…" : phase === "done" ? "готово" : "сохраним исходное фото"}
      </p>

      <ul className="mt-10 flex w-full flex-col gap-4 rounded-card border border-border bg-surface p-5">
        {steps.map(({ label, status }) => (
          <li key={label} className="flex items-center gap-3">
            <StatusIcon status={status} />
            <span className={`text-[15px] ${status === "pending" || status === "skipped" ? "text-muted" : ""}`}>
              {label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-muted">Обычно это занимает 10–30 секунд</p>
    </div>
  );
}
