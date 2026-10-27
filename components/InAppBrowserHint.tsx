"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, X } from "lucide-react";
import { androidChromeIntent, detectInApp } from "@/lib/inapp-browser";

const DISMISS_KEY = "mirro_inapp_hint_dismissed";

// Данные браузера читаем через useSyncExternalStore: на сервере их нет (пустая подсказка), в браузере — настоящие.
const noopSubscribe = () => () => {};
const listeners = new Set<() => void>();
let dismissedInMemory = false;
const subscribeDismissed = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const getDismissed = () => {
  if (dismissedInMemory) return true;
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};
const dismiss = () => {
  dismissedInMemory = true;
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // sessionStorage недоступен — скрываем до перезагрузки страницы
  }
  listeners.forEach((l) => l());
};

// Подсказка во встроенном браузере соцсетей: для оплаты в одно касание откройте сайт в Safari / Chrome.
// Показывать только там, где оплата идёт через Stripe. Не блокирует оплату: её можно сделать здесь формой карты.
export default function InAppBrowserHint({ className = "" }: { className?: string }) {
  const t = useTranslations("inApp");
  const ua = useSyncExternalStore(noopSubscribe, () => navigator.userAgent, () => "");
  const href = useSyncExternalStore(noopSubscribe, () => window.location.href, () => "");
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissed, () => true);
  const info = detectInApp(ua);

  if (!info.app || dismissed) return null;
  const android = info.os === "android";
  return (
    <aside role="note" className={`flex gap-3 rounded-2xl bg-lime/40 px-4 py-3 text-xs leading-relaxed ${className}`}>
      <ExternalLink size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{t(android ? "titleChrome" : "titleSafari")}</p>
        <p className="mt-1 text-text/80">{t("steps")}</p>
        <p className="mt-0.5 text-text/60">{t("canPayHere")}</p>
        {android && href && (
          <a
            href={androidChromeIntent(href)}
            className="mt-2 inline-flex h-9 items-center rounded-full bg-text px-4 text-xs font-medium text-background"
          >
            {t("openChrome")}
          </a>
        )}
      </div>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={dismiss}
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text/60 hover:bg-text/10"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </aside>
  );
}
