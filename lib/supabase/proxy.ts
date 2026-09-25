import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Обновляет сессию пользователя (токен в cookies) при каждом запросе.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  // Пока ключи не заданы, приложение работает как раньше — без Supabase.
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Не добавляйте код между созданием клиента и этим вызовом:
  // он проверяет и при необходимости обновляет токен.
  await supabase.auth.getUser();

  return response;
}
