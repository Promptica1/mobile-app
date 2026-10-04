"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Токены бета-доступа в браузере: только показ. Проверка и списание — на сервере.

export const NO_TOKENS_MESSAGE = "Токены закончились. Это тестовый доступ.";
export const TOKENS_HEADER = "X-Tokens-Left";
const EVENT = "dw:tokens";

export type Tokens = { balance: number; total: number };

// null — токены не настроены (тестовый режим или SQL ещё не запущен): ничего не показываем.
export async function fetchTokens(): Promise<Tokens | null> {
  if (!getSupabaseEnv()) return null;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("tokens_balance, tokens_total")
    .eq("id", session.user.id)
    .maybeSingle<{ tokens_balance: number; tokens_total: number }>();
  if (error || !data) return null;
  return { balance: data.tokens_balance, total: data.tokens_total };
}

// Сервер сообщил новый баланс после генерации — обновляем все индикаторы на экране.
export function announceTokens(balance: number | null | undefined) {
  if (typeof balance !== "number") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: balance }));
}

export function announceTokensFrom(res: Response) {
  const value = res.headers.get(TOKENS_HEADER);
  if (value !== null && value !== "") announceTokens(Number(value));
}

// undefined — загружается, null — не показываем.
export function useTokens(): Tokens | null | undefined {
  const [tokens, setTokens] = useState<Tokens | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetchTokens().then(
      (t) => alive && setTokens(t),
      () => alive && setTokens(null),
    );
    const onChange = (e: Event) => {
      const balance = (e as CustomEvent<number>).detail;
      setTokens((prev) => (prev ? { ...prev, balance } : prev));
    };
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  return tokens;
}
