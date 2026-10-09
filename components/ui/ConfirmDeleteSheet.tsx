"use client";

import { LoaderCircle } from "lucide-react";
import FormMessage from "@/components/ui/FormMessage";
import Sheet from "@/components/ui/Sheet";
import { useSubmit } from "./useSubmit";

// Подтверждение удаления: красная кнопка «Удалить» и «Отмена».
export default function ConfirmDeleteSheet({
  title,
  text,
  confirmLabel = "Удалить",
  busyLabel,
  cancelLabel = "Отмена",
  errorText = "Не получилось удалить. Проверьте интернет и попробуйте ещё раз.",
  onDelete,
  onClose,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  errorText?: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { busy, error, run } = useSubmit(onDelete, errorText);
  return (
    <Sheet title={title} onClose={onClose} locked={busy}>
      <p className="-mt-2 text-sm leading-relaxed text-muted">{text}</p>
      {error && (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-danger text-[15px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-12 rounded-full text-[15px] text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </Sheet>
  );
}
