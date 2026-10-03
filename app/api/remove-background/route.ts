import { NextResponse, type NextRequest } from "next/server";
import { RunwareError, isRunwareConfigured, removeBackground } from "@/lib/runware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Серверный маршрут: браузер присылает фото, сервер с ключом RUNWARE_API_KEY
// обращается к Runware и возвращает PNG без фона. Ключ в браузер не попадает.

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fail = (reason: string, status: number) =>
  NextResponse.json({ error: reason }, { status });

export async function POST(request: NextRequest) {
  // Платным ключом пользуются только вошедшие пользователи.
  if (!getSupabaseEnv()) return fail("not_configured", 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);

  if (!isRunwareConfigured()) return fail("not_configured", 503);

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob) || !ALLOWED_TYPES.includes(file.type)) return fail("bad_image", 400);
  if (file.size > MAX_BYTES) return fail("too_large", 413);

  try {
    const png = await removeBackground(Buffer.from(await file.arrayBuffer()), file.type);
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Подробности — только в логах сервера; клиенту — короткий код.
    console.error("remove-background:", error instanceof Error ? error.message : error);
    if (error instanceof RunwareError && error.reason === "not_configured") {
      return fail("not_configured", 503);
    }
    return fail("failed", 502);
  }
}
