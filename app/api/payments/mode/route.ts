import { NextResponse } from "next/server";
import { yookassaMode } from "@/lib/yookassa";

// Можно ли сейчас оплатить (ключи заданы) и тестовый ли это магазин. Секретов не раскрывает.
// reason — почему оплата недоступна (для проверки настроек): not_configured / bad_key / no_service_key.
export async function GET() {
  const mode = yookassaMode();
  const serviceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const available = mode.available && serviceKey;
  const reason = "reason" in mode ? mode.reason : serviceKey ? undefined : "no_service_key";
  return NextResponse.json({ available, test: mode.test, reason }, { headers: { "Cache-Control": "no-store" } });
}
