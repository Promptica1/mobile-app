import { NextResponse, type NextRequest } from "next/server";
import { RunwareError, extractGarment } from "@/lib/runware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/wardrobe";

// Серверный маршрут: браузер присылает фото и тип вещи, сервер с ключом
// RUNWARE_API_KEY просит генеративную модель Runware вырезать одну вещь
// и возвращает картинку. Ключ в браузер не попадает.
// Все строки логов начинаются с "RB:" — по ним удобно искать в логах Vercel.

// Генерация дольше обычного запроса: даём функции до 2 минут.
export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fail = (reason: string, status: number) => {
  console.log(`RB: error = ${reason} (HTTP ${status})`);
  return NextResponse.json({ error: reason }, { status });
};

const sniffType = (b: Buffer) =>
  b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b.subarray(8, 12).toString() === "WEBP" ? "image/webp" : "image/jpeg";

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
  const category = String(form?.get("category") ?? "");
  if (!(file instanceof Blob) || !ALLOWED_TYPES.includes(file.type)) return fail("bad_image", 400);
  if (file.size > MAX_BYTES) return fail("too_large", 413);
  if (!(CATEGORIES as readonly string[]).includes(category)) return fail("bad_category", 400);
  console.log(`RB: image ${file.type}, ${Math.round(file.size / 1024)} KB, category = ${category}`);

  try {
    const image = await extractGarment(Buffer.from(await file.arrayBuffer()), file.type, category);
    console.log(`RB: success, image ${Math.round(image.length / 1024)} KB`);
    return new NextResponse(new Uint8Array(image), {
      headers: { "Content-Type": sniffType(image), "Cache-Control": "no-store" },
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
