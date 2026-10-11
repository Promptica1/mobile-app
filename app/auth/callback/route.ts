import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/errors";

// Сюда ведут ссылки из писем Supabase (подтверждение почты, сброс пароля) и возврат
// после входа через Google. Меняем одноразовый код на сессию и отправляем пользователя дальше.
// Строку профиля новому пользователю создаёт триггер базы (как при регистрации по почте),
// а без имени приложение само отправит его в анкету (/onboarding).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  // Возврат после входа через Google (кнопка добавляет в адрес consent).
  const oauth = searchParams.has("consent");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (oauth && data.user) await recordGoogleConsent(request, data.user.id, searchParams.get("consent"));
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${oauth || searchParams.has("error") ? "oauth" : "link"}`);
}

// Перед входом через Google пользователь видел «Продолжая с Google, я принимаю Политику…»
// (на регистрации — ставил галочку). Записываем согласие один раз — при первом входе.
async function recordGoogleConsent(request: NextRequest, userId: string, version: string | null) {
  const admin = createAdminClient();
  if (!admin || !version || !/^[0-9a-f]{12}$/.test(version)) return;
  const { data: existing, error } = await admin
    .from("legal_consents")
    .select("id")
    .eq("user_id", userId)
    .eq("document", "privacy")
    .eq("context", "signup")
    .limit(1);
  if (error || (existing && existing.length > 0)) return;
  const { error: insertError } = await admin.from("legal_consents").insert({
    user_id: userId,
    document: "privacy",
    version,
    context: "signup",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
  });
  if (insertError) console.log(`LEGAL: google consent insert failed: ${insertError.message}`);
}
