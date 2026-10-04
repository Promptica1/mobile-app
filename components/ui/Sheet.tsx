"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Пока идёт сохранение, закрыть нельзя.
  locked?: boolean;
};

// Открытые панели по порядку: Escape закрывает только верхнюю.
const stack: symbol[] = [];

// Модальная нижняя панель поверх всего приложения (в т.ч. нижней навигации).
export default function Sheet({ title, onClose, children, locked = false }: Props) {
  const titleId = useId();

  // Актуальные onClose/locked без перерегистрации: иначе панель «перепрыгнет» наверх стека.
  const latest = useRef({ onClose, locked });
  useEffect(() => {
    latest.current = { onClose, locked };
  });

  useEffect(() => {
    const me = Symbol();
    stack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !latest.current.locked && stack.at(-1) === me) latest.current.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(me), 1);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Закрыть"
        tabIndex={-1}
        onClick={() => !locked && onClose()}
        className="absolute inset-0 animate-fade-in cursor-default bg-text/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90dvh] w-full max-w-[430px] animate-sheet-up overflow-y-auto rounded-t-[1.75rem] bg-surface px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_-18px_rgba(44,44,42,0.35)]"
      >
        <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-text/15" />
        <h2 id={titleId} className="mb-5 font-serif text-[1.75rem] font-medium leading-tight">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
