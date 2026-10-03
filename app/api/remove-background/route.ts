import { NextResponse, type NextRequest } from "next/server";
import { RunwareError, removeBackground } from "@/lib/runware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Серверный маршрут: браузер присылает фото, сервер с ключом RUNWARE_API_KEY
// обращается к Runware и возвращает PNG без фона. Ключ в браузер не попадает.
// Все строки логов начинаются с "RB:" — по ним удобно искать в логах Vercel.

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fail = (reason: string, status: number) => {
  console.log(`RB: error = ${reason} (HTTP ${status})`);
  return NextResponse.json({ error: reason }, { status });
};

export async function POST(request: NextRequest) {
  console.log("RB: route hit");
  // Только факт наличия и длина ключа — само значение никогда не логируем.
  const keyLength = process.env.RUNWARE_API_KEY?.length ?? 0;
  console.log(`RB: has key = ${keyLength > 0}`);
  console.log(`RB: key length = ${keyLength}`);

  // Платным ключом пользуются только вошедшие пользователи.
  if (!getSupabaseEnv()) return fail("supabase_not_configured", 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob) || !ALLOWED_TYPES.includes(file.type)) return fail("bad_image", 400);
  if (file.size > MAX_BYTES) return fail("too_large", 413);
  console.log(`RB: image ${file.type}, ${Math.round(file.size / 1024)} KB`);

  try {
    const png = await removeBackground(Buffer.from(await file.arrayBuffer()), file.type);
    console.log(`RB: success, png ${Math.round(png.length / 1024)} KB`);
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Подробности — только в логах сервера; клиенту — короткий код.
    console.log(`RB: error = ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof RunwareError && error.reason !== "failed") {
      return NextResponse.json({ error: error.reason }, { status: error.reason === "timeout" ? 504 : 503 });
    }
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
