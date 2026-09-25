import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { MOCK_ITEMS, type NewWardrobeItem, type WardrobeItem } from "./wardrobe";

// Работа с таблицей items и фото в Storage из браузера. RLS в базе и в Storage
// сам ограничивает доступ данными текущего пользователя.

const COLUMNS =
  "id, name, category, color, material, brand, comment, image_url, is_favorite, created_at";

// Закрытый бакет с фото вещей: <id пользователя>/<id вещи>.jpg
export const ITEMS_BUCKET = "items";
// Подписанная ссылка на фото живёт час — при следующем открытии гардероба выдаётся новая.
const SIGNED_URL_TTL = 60 * 60;

const hasSupabase = () => getSupabaseEnv() !== null;

// Ошибка с указанием этапа — чтобы показать пользователю понятное сообщение.
export class SaveItemError extends Error {
  constructor(public stage: "upload" | "save") {
    super(stage === "upload" ? "Не удалось загрузить фото" : "Не удалось сохранить вещь");
  }
}

export async function fetchItems(): Promise<WardrobeItem[]> {
  if (!hasSupabase()) return MOCK_ITEMS;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("items")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Одним запросом получаем временные ссылки на все фото.
  const paths = data.map((item) => item.image_url).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage
      .from(ITEMS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    urls?.forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }
  // Если ссылку получить не удалось, карточка просто покажет заглушку.
  return data.map((item) => ({
    ...item,
    photo_url: item.image_url ? (signed.get(item.image_url) ?? null) : null,
  }));
}

export async function createItem(item: NewWardrobeItem, photo: Blob | null): Promise<void> {
  if (!hasSupabase()) return;
  const supabase = createClient();

  const id = crypto.randomUUID();
  let imagePath: string | null = null;

  if (photo) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new SaveItemError("upload");
    imagePath = `${session.user.id}/${id}.jpg`;
    const { error } = await supabase.storage
      .from(ITEMS_BUCKET)
      .upload(imagePath, photo, { contentType: "image/jpeg", upsert: false });
    if (error) throw new SaveItemError("upload");
  }

  const { error } = await supabase
    .from("items")
    .insert({ id, ...item, image_url: imagePath, is_favorite: false });
  if (error) {
    // Строка не сохранилась — удаляем уже загруженное фото, чтобы не копился мусор.
    if (imagePath) await supabase.storage.from(ITEMS_BUCKET).remove([imagePath]);
    throw new SaveItemError("save");
  }
}

export async function setItemFavorite(id: string, isFavorite: boolean): Promise<void> {
  if (!hasSupabase()) return;
  const { error } = await createClient()
    .from("items")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw error;
}
