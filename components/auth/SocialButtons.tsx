"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import FormMessage from "@/components/ui/FormMessage";
import { SHOW_APPLE_LOGIN, SHOW_GOOGLE_LOGIN } from "@/lib/features";
import { LEGAL_DOCS } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 1.43c0 1.14-.5 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8C4 18.38 2.97 15.57 2.97 12.92c0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.62 0 2.89.06 4.38 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.95 4.45z" />
    </svg>
  );
}

// Внутри Telegram (Mini App) открывается встроенный браузер — Google запрещает в нём вход
// («disallowed_useragent»). Там предлагаем войти по почте или открыть сайт в обычном браузере.
function inTelegram() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { TelegramWebviewProxy?: unknown; Telegram?: { WebApp?: { initData?: string } } };
  return Boolean(w.TelegramWebviewProxy || w.Telegram?.WebApp?.initData || /Telegram/i.test(navigator.userAgent));
}

type Props = {
  // Куда вести после входа (по умолчанию — гардероб; новых пользователей приложение само отправит в анкету).
  next?: string;
  // Редакция политики конфиденциальности — запишем согласие, если аккаунт создаётся через Google.
  privacyVersion: string;
  // На экране регистрации согласие даётся галочкой: без неё Google не открываем.
  consent?: { agreed: boolean; onMissing: () => void };
};

export default function SocialButtons({ next = "/wardrobe", privacyVersion, consent }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [telegram, setTelegram] = useState(false);

  async function google() {
    setMessage(null);
    if (consent && !consent.agreed) return consent.onMissing();
    if (inTelegram()) return setTelegram(true);
    setBusy(true);
    const params = new URLSearchParams({ next, consent: privacyVersion });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params}`,
        queryParams: { prompt: "select_account" },
      },
    });
    // При успехе браузер уже уходит на страницу Google.
    if (error) {
      setMessage({ tone: "error", text: "Не получилось открыть вход через Google. Попробуйте ещё раз." });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        или
        <span className="h-px flex-1 bg-border" />
      </div>
      {SHOW_GOOGLE_LOGIN && (
        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-medium transition-colors hover:border-text/30 disabled:opacity-60"
        >
          {busy ? <LoaderCircle size={18} strokeWidth={2} className="animate-spin" /> : <GoogleIcon />}
          Продолжить с Google
        </button>
      )}
      {SHOW_APPLE_LOGIN && (
        <button
          type="button"
          onClick={() => setMessage({ tone: "info", text: "Вход через Apple скоро появится" })}
          className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-medium transition-colors hover:border-text/30"
        >
          <AppleIcon />
          Продолжить с Apple
        </button>
      )}
      {!consent && (
        <p className="px-2 text-center text-xs leading-relaxed text-muted">
          Продолжая с Google, я принимаю{" "}
          <Link href={LEGAL_DOCS.privacy.href} target="_blank" className="text-text underline underline-offset-2">
            Политику конфиденциальности
          </Link>
        </p>
      )}
      {telegram && (
        <FormMessage tone="info">
          Google не разрешает вход внутри Telegram. Войдите по почте или{" "}
          <a href={`${window.location.origin}/login`} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
            откройте MIRRO в браузере
          </a>
          .
        </FormMessage>
      )}
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    </div>
  );
}
