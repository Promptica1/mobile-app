import { NextResponse, type NextRequest } from "next/server";
import { RunwareError, createAvatar } from "@/lib/runware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Серверный маршрут: браузер присылает селфи (обязательно), фото в полный рост
// (необязательно) и рост/вес. Сервер с ключом RUNWARE_API_KEY просит Nano Banana
// создать аватар в полный рост и возвращает картинку. Ключ в браузер не попадает.
// Логи начинаются с "AV:".

export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fail = (reason: string, status: number) => {
  console.log(`AV: error = ${reason} (HTTP ${status})`);
  return NextResponse.json({ error: reason }, { status });
};

const isImage = (v: unknown): v is Blob =>
  v instanceof Blob && ALLOWED_TYPES.includes(v.type) && v.size <= MAX_BYTES;

// Число в разумных пределах или null.
const intInRange = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

export async function POST(request: NextRequest) {
  console.log("AV: route hit");
  console.log(`AV: has key = ${Boolean(process.env.RUNWARE_API_KEY)}`);

  // Платным ключом пользуются только вошедшие пользователи.
  if (!getSupabaseEnv()) return fail("supabase_not_configured", 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);

  const form = await request.formData().catch(() => null);
  const selfie = form?.get("selfie");
  const fullBody = form?.get("fullBody");
  if (!isImage(selfie)) return fail("bad_selfie", 400);
  if (fullBody && !isImage(fullBody)) return fail("bad_full_body", 400);
  const heightCm = intInRange(form?.get("height") ?? null, 100, 230);
  const weightKg = intInRange(form?.get("weight") ?? null, 30, 250);

  // Пол из профиля помогает модели не ошибиться с фигурой.
  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .maybeSingle<{ gender: "female" | "male" | null }>();

  console.log(
    `AV: selfie ${Math.round(selfie.size / 1024)} KB, full body = ${Boolean(fullBody)}, ` +
      `height = ${heightCm ?? "-"}, weight = ${weightKg ?? "-"}`,
  );

  try {
    const image = await createAvatar(
      { data: Buffer.from(await selfie.arrayBuffer()), mimeType: selfie.type },
      fullBody instanceof Blob
        ? { data: Buffer.from(await fullBody.arrayBuffer()), mimeType: fullBody.type }
        : null,
      { heightCm, weightKg, gender: profile?.gender ?? null },
    );
    console.log(`AV: success, image ${Math.round(image.length / 1024)} KB`);
    return new NextResponse(new Uint8Array(image), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.log(`AV: error = ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof RunwareError && error.reason !== "failed") {
      return NextResponse.json({ error: error.reason }, { status: error.reason === "timeout" ? 504 : 503 });
    }
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
