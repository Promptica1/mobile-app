import "server-only";
import type { createClient } from "@/lib/supabase/server";

// Токены бета-доступа на сервере: проверка до генерации и списание после успеха.
// Баланс меняется только функцией spend_token() в базе — из браузера его не изменить.

type Supabase = Awaited<ReturnType<typeof createClient>>;

// То же имя заголовка читает браузер (lib/tokens.ts).
export const TOKENS_HEADER = "X-Tokens-Left";

// Баланс пользователя; null — токены ещё не настроены (SQL не запущен): не блокируем.
export async function tokenBalance(supabase: Supabase, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tokens_balance")
    .eq("id", userId)
    .maybeSingle<{ tokens_balance: number }>();
  if (error || !data) {
    console.log(`TK: balance unavailable (${error?.message ?? "no profile"}) — not enforced`);
    return null;
  }
  return data.tokens_balance;
}

// Списать 1 токен после успешной генерации. Возвращает новый баланс (или null).
export async function spendToken(supabase: Supabase): Promise<number | null> {
  const { data, error } = await supabase.rpc("spend_token");
  if (error) {
    console.log(`TK: spend failed (${error.message})`);
    return null;
  }
  console.log(`TK: spent 1, left = ${data ?? "-"}`);
  return typeof data === "number" ? data : null;
}

export const tokensHeaders = (left: number | null): Record<string, string> =>
  left === null ? {} : { [TOKENS_HEADER]: String(left) };
