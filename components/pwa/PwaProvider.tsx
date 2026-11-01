"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { detectInApp } from "@/lib/inapp-browser";
import { EMPTY_STATE, parseState, pickVariant, shouldAutoShow, type PwaState, type Trigger, type Variant } from "@/lib/pwa";
import { inTelegram } from "@/lib/telegram";
import InstallSheet from "./InstallSheet";

// Установка на главный экран: ловит системное окно Chrome (beforeinstallprompt), решает, что показать
// в этом браузере, и когда показывать само (после оплаты, регистрации, первого образа — один раз,
// затем ещё раз через 3 дня). Заодно регистрирует service worker (только в проде).

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type Ctx = {
  // Показать окно по событию (само решает, пора ли).
  request: (trigger: Trigger, options?: { signupFirstShow?: boolean }) => void;
  // Пункт «На главный экран» в профиле: системное окно (если есть) или туториал.
  openSheet: () => void;
};
const PwaContext = createContext<Ctx>({ request: () => {}, openSheet: () => {} });
export const usePwa = () => useContext(PwaContext);

const STORAGE_KEY = "mirro_pwa";
const readState = (): PwaState => {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY_STATE;
  }
};
const writeState = (state: PwaState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // хранилище недоступно (приватный режим) — просто не запоминаем
  }
};

// Приложение открыто с главного экрана (а не во вкладке браузера).
const standaloneNow = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const subscribeStandalone = (cb: () => void) => {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

export default function PwaProvider({ children }: { children: ReactNode }) {
  const standalone = useSyncExternalStore(subscribeStandalone, standaloneNow, () => false);
  const ua = useSyncExternalStore(noopSubscribe, () => navigator.userAgent, () => "");
  const telegram = useSyncExternalStore(noopSubscribe, inTelegram, () => false);
  const href = useSyncExternalStore(noopSubscribe, () => window.location.href, () => "");
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  const detected = detectInApp(ua);
  const variant: Variant = pickVariant({
    standalone,
    telegram,
    inApp: detected.app !== null,
    os: detected.os,
    hasPrompt: prompt !== null,
  });

  // Актуальные значения для request(): вызывается из таймеров, где замыкание устарело бы.
  const latest = useRef({ variant, telegram });
  useEffect(() => {
    latest.current = { variant, telegram };
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // оставляем окно на наш момент, а не на мини-панель Chrome
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      writeState({ ...readState(), installed: true });
      setPrompt(null);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Открыто с главного экрана — значит установлено: больше не напоминаем.
  useEffect(() => {
    if (standalone) writeState({ ...readState(), installed: true });
  }, [standalone]);

  // Service worker — только в проде и только там, где он поддерживается.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  const request = useCallback<Ctx["request"]>((trigger, options) => {
    const { variant: v, telegram: tg } = latest.current;
    const state = readState();
    const now = Date.now();
    const show = shouldAutoShow(state, now, { trigger, variant: v, telegram: tg, signupFirstShow: options?.signupFirstShow });
    const next: PwaState = { ...state, lookSeen: state.lookSeen || trigger === "look" };
    if (show) next.shown = [...state.shown, now];
    if (show || next.lookSeen !== state.lookSeen) writeState(next);
    if (show) setOpen(true);
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    setPrompt(null); // событие одноразовое
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") writeState({ ...readState(), installed: true });
    } catch {
      // окно не открылось — ничего страшного, остаётся ручная инструкция
    }
    setOpen(false);
  }, [prompt]);

  const openSheet = useCallback(() => {
    if (prompt) void install();
    else setOpen(true);
  }, [prompt, install]);

  const value = useMemo(() => ({ request, openSheet }), [request, openSheet]);

  return (
    <PwaContext.Provider value={value}>
      {children}
      {open && <InstallSheet variant={variant} os={detected.os} href={href} onInstall={install} onClose={() => setOpen(false)} />}
    </PwaContext.Provider>
  );
}
