import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { MOCK_ITEMS, type NewWardrobeItem, type WardrobeItem } from "./wardrobe";

// Работа с таблицей items из браузера. RLS в базе сам ограничивает
// выборку вещами текущего пользователя, а user_id при вставке
// подставляется по умолчанию (auth.uid()).

const COLUMNS =
  "id, name, category, color, material, brand, comment, image_url, is_favorite, created_at";

const hasSupabase = () => getSupabaseEnv() !== null;

export async function fetchItems(): Promise<WardrobeItem[]> {
  if (!hasSupabase()) return MOCK_ITEMS;
  const { data, error } = await createClient()
    .from("items")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createItem(item: NewWardrobeItem): Promise<void> {
  if (!hasSupabase()) return;
  const { error } = await createClient()
    .from("items")
    .insert({ ...item, image_url: null, is_favorite: false });
  if (error) throw error;
}

export async function setItemFavorite(id: string, isFavorite: boolean): Promise<void> {
  if (!hasSupabase()) return;
  const { error } = await createClient()
    .from("items")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw error;
}
