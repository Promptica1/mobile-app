"use client";

import { useEffect } from "react";
import { Check, ImageIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import Photo from "@/components/ui/Photo";

// Примеры фото лежат в public/onboarding/ (квадратные, 1:1).
// alt — ключ подписи в messages (addItem.tips.<ключ>).
const GOOD = [
  { src: "/onboarding/good-single.jpg", alt: "goodSingle" },
  { src: "/onboarding/good-worn.jpg", alt: "goodWorn" },
] as const;
const BAD = [
  { src: "/onboarding/bad-many.jpg", alt: "badMany" },
  { src: "/onboarding/bad-cluttered.jpg", alt: "badCluttered" },
] as const;

function Example({ src, alt }: { src: string; alt: string }) {
  // Пока файла нет — мягкая заглушка, экран не ломается.
  const placeholder = (
    <div className="flex h-full w-full items-center justify-center bg-beige">
      <ImageIcon size={24} strokeWidth={1.25} className="text-muted" />
    </div>
  );
  return (
    <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-surface">
      <Photo src={src} alt={alt} className="object-cover" fallback={placeholder} />
    </div>
  );
}

function Section({
  tone,
  title,
  caption,
  images,
}: {
  tone: "good" | "bad";
  title: string;
  caption: string;
  images: readonly { src: string; alt: string }[];
}) {
  const t = useTranslations("addItem.tips");
  const good = tone === "good";
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            good ? "bg-lime text-text" : "bg-danger/12 text-danger"
          }`}
        >
          {good ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
        </span>
        <h3 className={`text-[15px] font-medium ${good ? "" : "text-danger"}`}>{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {images.map((img) => (
          <Example key={img.src} src={img.src} alt={t(img.alt)} />
        ))}
      </div>
      <p className="mt-2.5 px-1 text-sm text-muted">{caption}</p>
    </section>
  );
}

export default function PhotoTips({ onClose }: { onClose: () => void }) {
  const t = useTranslations("addItem.tips");
  const tCommon = useTranslations("common");
  // Закрытие по Escape на компьютере.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-tips-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
          >
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>
        <h2 id="photo-tips-title" className="font-serif text-4xl font-medium leading-tight tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("subtitle")}</p>

        <div className="mt-8 flex flex-col gap-8">
          <Section tone="good" title={t("good")} caption={t("goodCaption")} images={GOOD} />
          <Section
            tone="bad"
            title={t("bad")}
            caption={t("badCaption")}
            images={BAD}
          />
        </div>

        <div className="mt-auto pt-8">
          <Button variant="lime" onClick={onClose}>
            {t("gotIt")}
          </Button>
        </div>
      </div>
    </div>
  );
}
