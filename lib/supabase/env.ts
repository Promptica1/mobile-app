// Ключи Supabase берутся только из переменных окружения — в коде их нет.
// Переменные NEXT_PUBLIC_* встраиваются в сборку, поэтому после их изменения
// в Vercel нужен новый деплой.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY (см. .env.local.example).",
    );
  }
  return env;
}
