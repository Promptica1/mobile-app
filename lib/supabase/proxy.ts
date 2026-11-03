import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { RU_ENABLED } from "../features";
import { isAllowlisted, isBlockedCountry, parseAllowlist, STAFF_COOKIE } from "../region";
import { getSupabaseEnv } from "./env";

// Страницы, доступные без входа. Webhook ЮKassa, webhook Stripe и ежедневный cron приходят без сессии:
// webhook ЮKassa проверяется повторным запросом платежа в API ЮKassa, webhook Stripe — подписью
// STRIPE_WEBHOOK_SECRET, cron — секретом CRON_SECRET.
// /legal — оферта и политика: открываются и до регистрации.
// /reset-password — ссылка из письма: сессия восстановления появляется уже на самой странице.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth", "/api/payments/webhook", "/api/stripe/webhook", "/api/cron", "/legal", "/unavailable"];
// С этих страниц вошедшего пользователя сразу отправляем в приложение.
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

// Закрытый регион (RU_ENABLED выключен): запросы между серверами (Stripe, cron) пропускаем, всем остальным
// показываем нейтральную страницу. Служебный вход — /login?staff=1: он открывает форму входа, а доступ к приложению
// даёт только адрес из ALLOWLIST_EMAILS.
const REGION_EXEMPT_PATHS = ["/api/stripe/webhook", "/api/payments/webhook", "/api/cron", "/unavailable"];
const STAFF_AUTH_PATHS = ["/login", "/auth", "/forgot-password", "/reset-password"];

function unavailable(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unavailable" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/unavailable";
  url.search = "";
  return NextResponse.rewrite(url, { status: 403, headers: { "Cache-Control": "no-store" } });
}

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Обновляет сессию пользователя (токен в cookies) и защищает страницы приложения.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const closedRegion =
    !RU_ENABLED &&
    isBlockedCountry(request.headers.get("x-vercel-ip-country")) &&
    !matches(request.nextUrl.pathname, REGION_EXEMPT_PATHS);
  if (closedRegion) {
    const staff = request.cookies.get(STAFF_COOKIE)?.value === "1";
    const staffEntry = request.nextUrl.pathname === "/login" && request.nextUrl.searchParams.get("staff") === "1";
    if (!staff && !staffEntry) return unavailable(request);
    if (!matches(request.nextUrl.pathname, STAFF_AUTH_PATHS)) {
      // Без входа в закрытом регионе доступна только форма входа; вошедшего проверим по списку ниже.
      if (!getSupabaseEnv()) return unavailable(request);
    }
    if (staffEntry) response.cookies.set(STAFF_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  }

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

  if (closedRegion && !isAllowlisted(user?.email, parseAllowlist(process.env.ALLOWLIST_EMAILS))) {
    // Не из списка: открыта только форма входа, всё остальное (в том числе после входа) — нейтральная страница.
    if (!matches(pathname, STAFF_AUTH_PATHS) || user) return unavailable(request);
  }

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
