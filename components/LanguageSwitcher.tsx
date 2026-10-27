"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import Sheet from "@/components/ui/Sheet";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { saveLocale } from "@/lib/locale";

// Список языков: нажатие сохраняет выбор и перерисовывает страницу на новом языке.
export function LanguageList({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("profile.language");
  const router = useRouter();
  const current = useLocale();
  const [busy, setBusy] = useState<Locale | null>(null);
  const [error, setError] = useState(false);

  const choose = async (locale: Locale) => {
    if (busy) return;
    if (locale === current) return onDone?.();
    setBusy(locale);
    setError(false);
    try {
      await saveLocale(locale);
      router.refresh();
      onDone?.();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <button
              type="button"
              onClick={() => choose(locale)}
              disabled={busy !== null}
              aria-pressed={locale === current}
              lang={locale}
              className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px] transition-colors hover:bg-subtle disabled:opacity-60"
            >
              {LOCALE_NAMES[locale]}
              {locale === current && <Check size={18} strokeWidth={2} className="text-lavender" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs leading-relaxed text-muted">{t("hint")}</p>
      {error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {t("saveError")}
        </p>
      )}
    </div>
  );
}

export function LanguageSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("profile.language");
  return (
    <Sheet title={t("title")} onClose={onClose}>
      <LanguageList onDone={onClose} />
    </Sheet>
  );
}

// Маленький переключатель для экранов входа: «Русский · English».
export function LanguageLinks() {
  const router = useRouter();
  const current = useLocale();
  return (
    <nav aria-label="Language" className="flex items-center justify-center gap-3 text-xs text-muted">
      {LOCALES.map((locale, i) => (
        <span key={locale} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden>·</span>}
          <button
            type="button"
            lang={locale}
            aria-current={locale === current ? "true" : undefined}
            onClick={async () => {
              if (locale === current) return;
              try {
                await saveLocale(locale);
                router.refresh();
              } catch {}
            }}
            className={locale === current ? "font-medium text-text" : "underline-offset-4 hover:text-text hover:underline"}
          >
            {LOCALE_NAMES[locale]}
          </button>
        </span>
      ))}
    </nav>
  );
}
