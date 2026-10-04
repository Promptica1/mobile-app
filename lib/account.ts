import { createClient } from "@/lib/supabase/client";
import { compressImage } from "./image";
import { PROFILE_PHOTOS_BUCKET } from "./profile";

// Фото профиля (не аватар) и удаление аккаунта — из браузера от имени пользователя.
// RLS в базе и в Storage пускает только в свои строки и свою папку <id пользователя>/.

// Все бакеты, где лежат файлы пользователя: при удалении аккаунта чистим каждый.
const USER_BUCKETS = ["items", "avatars", "tryons", PROFILE_PHOTOS_BUCKET];
const SIGNED_URL_TTL = 60 * 60;
const PAGE = 1000;

async function currentUserId() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.user.id ?? null;
}

export class ProfilePhotoError extends Error {}

// Сжимаем, загружаем новым файлом, записываем путь в профиль и удаляем прежнее фото.
export async function uploadProfilePhoto(file: File, previousPath: string | null) {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new ProfilePhotoError("no session");
  const blob = await compressImage(file, { maxSide: 640, quality: 0.85 });
  const path = `${userId}/photo-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw new ProfilePhotoError("upload");
  const { error: saveError } = await supabase.from("profiles").update({ photo_path: path }).eq("id", userId);
  if (saveError) {
    await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([path]);
    throw new ProfilePhotoError("save");
  }
  if (previousPath) await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([previousPath]);
  const { data } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return { path, url: data?.signedUrl ?? URL.createObjectURL(blob) };
}

// Все файлы в папке пользователя (с вложенными папками), постранично.
async function listFiles(bucket: string, prefix: string): Promise<string[]> {
  const storage = createClient().storage.from(bucket);
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    for (const entry of data) {
      const full = `${prefix}/${entry.name}`;
      // У папок нет id — заходим внутрь.
      if (entry.id === null) paths.push(...(await listFiles(bucket, full)));
      else paths.push(full);
    }
    if (data.length < PAGE) return paths;
  }
}

async function removeAllFiles(userId: string) {
  for (const bucket of USER_BUCKETS) {
    // Удаляем, пока папка не опустеет: list после remove вернёт следующую порцию.
    for (let round = 0; round < 50; round++) {
      const paths = await listFiles(bucket, userId);
      if (paths.length === 0) break;
      for (let i = 0; i < paths.length; i += PAGE) {
        const { error } = await createClient().storage.from(bucket).remove(paths.slice(i, i + PAGE));
        if (error) throw error;
      }
    }
  }
}

// 1) удаляем все файлы пользователя через Storage API; 2) функция в базе проверяет,
// что файлов не осталось, и удаляет все строки и сам аккаунт; 3) выходим.
export async function deleteAccount(): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error("no session");
  await removeAllFiles(userId);
  let { error } = await supabase.rpc("delete_my_account");
  if (error?.message.includes("storage_not_empty")) {
    // Файл мог появиться в последний момент (например, закончилась примерка) — ещё раз.
    await removeAllFiles(userId);
    ({ error } = await supabase.rpc("delete_my_account"));
  }
  if (error) throw error;
  // Аккаунта уже нет — просто стираем сессию в браузере.
  await supabase.auth.signOut({ scope: "local" });
}
