import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

// Клиент Supabase для серверных компонентов, Server Actions и Route Handlers.
// Создавайте новый клиент на каждый запрос — не храните его в глобальной переменной.
export async function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Вызов из серверного компонента: там cookies менять нельзя.
          // Сессию в этом случае обновляет proxy.ts.
        }
      },
    },
  });
}
