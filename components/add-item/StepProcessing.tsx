"use client";

import { useEffect } from "react";
import { Check, LoaderCircle, Shirt } from "lucide-react";

// Имитация обработки: через PROCESSING_MS переходим к шагу 3.
const PROCESSING_MS = 2000;

const steps = [
  { label: "Фон удалён", status: "done" },
  { label: "Определяем категорию…", status: "active" },
  { label: "Распознаём цвет и материал", status: "pending" },
] as const;

export default function StepProcessing({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, PROCESSING_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="relative mt-4 flex aspect-square w-56 items-center justify-center overflow-hidden rounded-card border border-border bg-surface">
        <Shirt size={72} strokeWidth={0.9} className="text-muted" />
        <span className="absolute inset-x-6 h-px animate-scan bg-lavender shadow-[0_0_12px_2px] shadow-lavender/60" />
      </div>
      <p className="mt-4 text-sm text-muted">анализируем фото…</p>

      <ul className="mt-10 flex w-full flex-col gap-4 rounded-card border border-border bg-surface p-5">
        {steps.map(({ label, status }) => (
          <li key={label} className="flex items-center gap-3">
            {status === "done" && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green text-surface">
                <Check size={14} strokeWidth={2.5} />
              </span>
            )}
            {status === "active" && (
              <LoaderCircle
                size={24}
                strokeWidth={2}
                className="animate-spin text-lavender"
              />
            )}
            {status === "pending" && (
              <span className="h-6 w-6 rounded-full border-2 border-border" />
            )}
            <span
              className={`text-[15px] ${status === "pending" ? "text-muted" : ""}`}
            >
              {label}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-muted">
        Обычно это занимает несколько секунд
      </p>
    </div>
  );
}
