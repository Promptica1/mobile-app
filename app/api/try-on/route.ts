import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { RunwareError, tryOnOutfit, type TryOnGarment } from "@/lib/runware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { spendToken, tokenBalance } from "@/lib/tokens.server";

// Примерка: браузер присылает только id выбранных вещей. Сервер сам берёт аватар
// и фото вещей из хранилища от имени пользователя (RLS — только свои), проверяет
// кэш и при необходимости просит Nano Banana одеть аватар. Логи начинаются с "TO:".

export const maxDuration = 120;

const MAX_ITEMS = 5;
const TRYONS_BUCKET = "tryons";
const SIGNED_URL_TTL = 60 * 60;

const fail = (reason: string, status: number) => {
  console.log(`TO: error = ${reason} (HTTP ${status})`);
  return NextResponse.json({ error: reason }, { status });
};

const sniffType = (b: Buffer) =>
  b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b.subarray(8, 12).toString() === "WEBP" ? "image/webp" : "image/jpeg";

// Ключ кэша: тот же аватар + тот же набор вещей (порядок не важен).
function comboKey(avatarPath: string, itemIds: string[]) {
  return createHash("sha256")
    .update(`${avatarPath}|${[...itemIds].sort().join(",")}`)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(request: NextRequest) {
  console.log("TO: route hit");
  if (!getSupabaseEnv()) return fail("supabase_not_configured", 503);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized", 401);

  const body = (await request.json().catch(() => null)) as { itemIds?: unknown } | null;
  const ids = Array.isArray(body?.itemIds) ? [...new Set(body.itemIds.filter((x): x is string => typeof x === "string"))] : [];
  if (ids.length === 0 || ids.length > MAX_ITEMS) return fail("bad_items", 400);

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle<{ avatar_path: string | null }>();
  const avatarPath = profile?.avatar_path;
  if (!avatarPath) return fail("no_avatar", 409);

  const key = comboKey(avatarPath, ids);
  const signed = async (path: string) =>
    (await supabase.storage.from(TRYONS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL)).data?.signedUrl ?? null;

  // 1. Кэш: этот набор на этом аватаре уже примеряли — отдаём без генерации.
  const { data: cached } = await supabase
    .from("try_on_results")
    .select("image_path")
    .eq("combo_key", key)
    .maybeSingle<{ image_path: string }>();
  if (cached) {
    const url = await signed(cached.image_path);
    if (url) {
      console.log(`TO: cache hit ${key}`);
      return NextResponse.json({ url, path: cached.image_path, cached: true, comboKey: key });
    }
  }

  // 2. Вещи пользователя (RLS вернёт только свои) — у каждой должно быть фото.
  const { data: items } = await supabase
    .from("items")
    .select("id, name, category, image_url")
    .in("id", ids);
  if (!items || items.length !== ids.length) return fail("items_not_found", 400);
  if (items.some((i) => !i.image_url)) return fail("item_without_photo", 400);

  if (!process.env.RUNWARE_API_KEY) return fail("not_configured", 503);

  // Токены бета-доступа: повтор из кэша (выше) бесплатный, новая примерка — 1 токен.
  const balance = await tokenBalance(supabase, user.id);
  if (balance !== null && balance <= 0) return fail("no_tokens", 402);

  const download = async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw new Error(`download ${bucket}/${path}`);
    const buf = Buffer.from(await data.arrayBuffer());
    return { data: buf, mimeType: sniffType(buf) };
  };

  try {
    const avatar = await download("avatars", avatarPath);
    // Порядок как в образе: верх, низ, верхняя одежда, обувь, аксессуары.
    const order = ["Верх", "Низ", "Верхняя одежда", "Обувь", "Аксессуары"];
    const sorted = [...items].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    const garments: TryOnGarment[] = await Promise.all(
      sorted.map(async (i) => ({ ...(await download("items", i.image_url as string)), category: i.category, name: i.name })),
    );
    console.log(`TO: generating ${key}, items = ${sorted.map((i) => i.category).join(" + ")}`);

    const image = await tryOnOutfit(avatar, garments);

    // 3. Сохраняем результат в кэш.
    const path = `${user.id}/${key}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(TRYONS_BUCKET)
      .upload(path, image, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw new Error(`upload: ${uploadError.message}`);
    const { error: saveError } = await supabase.from("try_on_results").upsert(
      { user_id: user.id, combo_key: key, avatar_path: avatarPath, item_ids: [...ids].sort(), image_path: path },
      { onConflict: "user_id,combo_key" },
    );
    if (saveError) console.log(`TO: cache row not saved: ${saveError.message}`);

    const url = await signed(path);
    if (!url) throw new Error("signed url");
    console.log(`TO: success ${key}, image ${Math.round(image.length / 1024)} KB`);
    // Пользователь получил новую примерку — только теперь списываем токен.
    const tokens = await spendToken(supabase);
    return NextResponse.json({ url, path, cached: false, comboKey: key, tokens });
  } catch (error) {
    console.log(`TO: error = ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof RunwareError && error.reason !== "failed") {
      return NextResponse.json({ error: error.reason }, { status: error.reason === "timeout" ? 504 : 503 });
    }
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
