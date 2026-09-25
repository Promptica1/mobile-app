import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

// Клиент Supabase для клиентских компонентов ("use client").
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
