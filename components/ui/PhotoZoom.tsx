"use client";

/* eslint-disable @next/next/no-img-element -- фото по подписанным и blob:-ссылкам */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Фото на весь экран: закрывается по нажатию, крестику или Escape.
export function PhotoZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть фото"
        className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/90 backdrop-blur-sm"
      >
        <X size={20} strokeWidth={1.75} />
      </button>
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>,
    document.body,
  );
}

// Обёртка: нажатие на фото открывает его крупно.
export default function ZoomablePhoto({
  src,
  alt,
  className = "",
  children,
}: {
  src: string | null;
  alt: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!src) return <div className={className}>{children}</div>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть фото крупно"
        className={`cursor-zoom-in ${className}`}
      >
        {children}
      </button>
      {open && <PhotoZoom src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
