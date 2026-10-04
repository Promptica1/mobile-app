"use client";

import { forwardRef, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  // Содержимое, которое видно только в развёрнутом состоянии.
  children: ReactNode;
  // Нижний ряд кнопок — виден всегда.
  footer: ReactNode;
};

// На сколько пикселей нужно потянуть ручку, чтобы панель переключилась.
const DRAG_THRESHOLD = 36;
// Короткое касание без движения — это нажатие (переключить).
const TAP_SLOP = 6;

// Полупрозрачная нижняя панель «Примерки»: тянется или нажимается за ручку.
const BottomSheet = forwardRef<HTMLElement, Props>(function BottomSheet(
  { expanded, onExpandedChange, children, footer },
  ref,
) {
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    start.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const dy = e.clientY - start.current;
    // Панель следует за пальцем: вниз — когда развёрнута, немного вверх — когда свёрнута.
    setDrag(expanded ? Math.max(0, dy) : Math.max(-40, Math.min(0, dy)));
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const dy = e.clientY - start.current;
    start.current = null;
    setDrag(0);
    if (Math.abs(dy) <= TAP_SLOP) onExpandedChange(!expanded);
    else if (dy < -DRAG_THRESHOLD) onExpandedChange(true);
    else if (dy > DRAG_THRESHOLD) onExpandedChange(false);
  };

  return (
    <section
      ref={ref}
      aria-label="Выбор вещей"
      style={{ transform: `translateY(${drag}px)` }}
      className={`absolute inset-x-0 bottom-0 z-20 rounded-t-[1.75rem] border-t border-border/70 bg-surface/80 px-4 pb-3 shadow-[0_-12px_32px_-18px_rgba(44,44,42,0.25)] backdrop-blur-xl ${
        drag === 0 ? "transition-transform duration-300" : ""
      }`}
    >
      <button
        type="button"
        aria-label={expanded ? "Свернуть панель" : "Развернуть панель"}
        aria-expanded={expanded}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDrag(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onExpandedChange(!expanded);
          }
        }}
        className="flex w-full touch-none flex-col items-center pb-2 pt-2.5"
      >
        <span className="h-1 w-10 rounded-full bg-text/20" />
        <span
          className={`overflow-hidden text-xs text-muted transition-all duration-300 ${
            expanded ? "max-h-0 opacity-0" : "mt-2 max-h-5 opacity-100"
          }`}
        >
          Потяните вверх, чтобы выбрать вещи
        </span>
      </button>

      {/* Плавно раскрывается/сворачивается по высоте */}
      {/* -mx-4/px-4: ленты категорий и превью листаются до самого края панели */}
      <div
        className={`-mx-4 grid transition-[grid-template-rows,opacity] duration-300 ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-3">{children}</div>
        </div>
      </div>

      {footer}
    </section>
  );
});

export default BottomSheet;
