import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Страницы, доступные без входа.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth"];
// С этих страниц вошедшего пользователя сразу отправляем в приложение.
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Обновляет сессию пользователя (токен в cookies) и защищает страницы приложения.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  // Пока ключи не заданы, приложение работает как раньше — без входа, на тестовых данных.
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/login" && pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    const redirect = NextResponse.redirect(url);
    // Переносим обновлённые cookies сессии, чтобы не потерять вход.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !matches(pathname, PUBLIC_PATHS)) return redirectTo("/login");
  if (user && matches(pathname, GUEST_ONLY_PATHS)) return redirectTo("/wardrobe");

  return response;
}
