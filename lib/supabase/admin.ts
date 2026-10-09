import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

// Служебный клиент с сервисным ключом: обходит RLS. Только на сервере и только для записей,
// которые нельзя доверить браузеру (подписки и платежи после проверки в ЮKassa).
// Ключ SUPABASE_SERVICE_ROLE_KEY — без NEXT_PUBLIC_, в браузер не попадает и не логируется.
export function createAdminClient() {
  const env = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) return null;
  return createClient(env.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
