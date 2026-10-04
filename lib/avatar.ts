import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { compressImage } from "./image";
import { announceTokensFrom } from "./tokens";

// Аватар для «Примерки»: генерирует сервер (/api/create-avatar, ключ Runware только там),
// а браузер сохраняет результат в закрытый бакет avatars и записывает путь в профиль.

export const AVATARS_BUCKET = "avatars";
const SIGNED_URL_TTL = 60 * 60;
// Модели достаточно 1024 px; сервер ждёт генерацию до 90 с, браузер — с запасом.
const INPUT_MAX_SIDE = 1024;
const CLIENT_TIMEOUT_MS = 110_000;

export type Avatar = {
  path: string | null;
  url: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export class AvatarError extends Error {
  constructor(public stage: "generate" | "upload" | "save" | "no_tokens") {
    super(`avatar ${stage}`);
  }
}

export const hasAvatarSupport = () => getSupabaseEnv() !== null;

async function currentUserId() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.user.id ?? null;
}

async function signedUrl(path: string) {
  const { data } = await createClient().storage.from(AVATARS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export async function fetchAvatar(): Promise<Avatar> {
  const empty: Avatar = { path: null, url: null, heightCm: null, weightKg: null };
  if (!hasAvatarSupport()) return empty;
  const userId = await currentUserId();
  if (!userId) return empty;
  const { data, error } = await createClient()
    .from("profiles")
    .select("avatar_path, height_cm, weight_kg")
    .eq("id", userId)
    .maybeSingle<{ avatar_path: string | null; height_cm: number | null; weight_kg: number | null }>();
  if (error) throw error;
  const path = data?.avatar_path ?? null;
  return {
    path,
    url: path ? await signedUrl(path) : null,
    heightCm: data?.height_cm ?? null,
    weightKg: data?.weight_kg ?? null,
  };
}

export type AvatarInput = {
  selfie: Blob;
  fullBody: Blob | null;
  heightCm: number | null;
  weightKg: number | null;
  previousPath: string | null;
};

export async function createAvatar(input: AvatarInput): Promise<Avatar> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new AvatarError("save");

  // 1. Генерация на сервере (стоит 1 токен бета-доступа).
  let generated: Blob;
  let noTokens = false;
  try {
    const form = new FormData();
    form.append("selfie", await compressImage(input.selfie, { maxSide: INPUT_MAX_SIDE }), "selfie.jpg");
    if (input.fullBody) {
      form.append("fullBody", await compressImage(input.fullBody, { maxSide: INPUT_MAX_SIDE }), "full-body.jpg");
    }
    if (input.heightCm) form.append("height", String(input.heightCm));
    if (input.weightKg) form.append("weight", String(input.weightKg));
    const res = await fetch("/api/create-avatar", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    if (res.status === 402) noTokens = true;
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(String(res.status));
    announceTokensFrom(res);
    generated = await compressImage(await res.blob(), { maxSide: 1600 });
  } catch {
    throw new AvatarError(noTokens ? "no_tokens" : "generate");
  }

  // 2. Новый файл с уникальным именем — старая подписанная ссылка не покажет устаревший аватар.
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, generated, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw new AvatarError("upload");

  // 3. Запоминаем аватар (и параметры) в профиле.
  const { error: saveError } = await supabase
    .from("profiles")
    .update({ avatar_path: path, height_cm: input.heightCm, weight_kg: input.weightKg })
    .eq("id", userId);
  if (saveError) {
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
    throw new AvatarError("save");
  }

  // 4. Старый аватар больше не нужен.
  if (input.previousPath && input.previousPath !== path) {
    await supabase.storage.from(AVATARS_BUCKET).remove([input.previousPath]);
  }

  return { path, url: await signedUrl(path), heightCm: input.heightCm, weightKg: input.weightKg };
}
