import { NextResponse } from "next/server";
import { yookassaMode } from "@/lib/yookassa";

// Можно ли сейчас оплатить (ключи заданы) и что это тестовый режим. Секретов не раскрывает.
export async function GET() {
  const mode = yookassaMode();
  const available = mode.available && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json({ available, test: true }, { headers: { "Cache-Control": "no-store" } });
}
