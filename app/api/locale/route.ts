import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Выбор языка: ставит cookie (язык этого устройства) и, если пользователь вошёл, сохраняет
// язык в профиле (profiles.locale) и в данных входа (user_metadata.locale) — по нему выбирается
// язык писем Supabase. Если базы или колонки нет, язык всё равно переключается через cookie.

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = body?.locale;
  if (!isLocale(locale)) return NextResponse.json({ error: "bad_locale" }, { status: 400 });

  let saved = false;
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id);
      saved = !error;
      if (error) console.log(`LOCALE: profile not updated (${error.message})`);
      const admin = createAdminClient();
      if (admin && user.user_metadata?.locale !== locale) {
        const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...user.user_metadata, locale },
        });
        if (metaError) console.log(`LOCALE: metadata not updated (${metaError.message})`);
      }
    }
  }

  const res = NextResponse.json({ ok: true, saved }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
