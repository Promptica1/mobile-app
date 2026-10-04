import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { plural } from "./plural";
import { TRYONS_BUCKET } from "./tryOn";

// Образы и папки пользователя. RLS в базе сама ограничивает доступ своими строками.
// Картинка образа — готовая примерка из бакета tryons (looks.image_url хранит путь),
// поэтому при сохранении ничего не генерируется заново.

const COLUMNS = "id, name, folder_id, comment, is_favorite, image_url, created_at";
const SIGNED_URL_TTL = 60 * 60;

export type Look = {
  id: string;
  name: string;
  folder_id: string | null;
  comment: string | null;
  is_favorite: boolean;
  image_url: string | null;
  created_at: string;
  // Временная ссылка на картинку.
  photo_url: string | null;
};

export type Folder = { id: string; name: string };

export const hasLooksSupport = () => getSupabaseEnv() !== null;

export function formatLookCount(n: number): string {
  return plural(n, ["образ", "образа", "образов"]);
}

export const NAME_MAX = 40;

async function withPhotos(rows: Omit<Look, "photo_url">[]): Promise<Look[]> {
  const paths = rows.map((l) => l.image_url).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await createClient().storage.from(TRYONS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    data?.forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }
  return rows.map((l) => ({ ...l, photo_url: l.image_url ? (signed.get(l.image_url) ?? null) : null }));
}

export async function fetchLooks(): Promise<Look[]> {
  if (!hasLooksSupport()) return [];
  const { data, error } = await createClient()
    .from("looks")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return withPhotos(data);
}

// Образ и id его вещей; null — образа нет (удалён или чужой).
export async function fetchLook(id: string): Promise<{ look: Look; itemIds: string[] } | null> {
  if (!hasLooksSupport()) return null;
  const supabase = createClient();
  const [{ data, error }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("looks").select(COLUMNS).eq("id", id).maybeSingle<Omit<Look, "photo_url">>(),
    supabase.from("look_items").select("item_id").eq("look_id", id),
  ]);
  if (error || linksError) throw error ?? linksError;
  if (!data) return null;
  const [look] = await withPhotos([data]);
  return { look, itemIds: (links ?? []).map((l) => l.item_id as string) };
}

export async function fetchFolders(): Promise<Folder[]> {
  if (!hasLooksSupport()) return [];
  const { data, error } = await createClient()
    .from("folders")
    .select("id, name")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export class FolderExistsError extends Error {}

export async function createFolder(name: string, existing: Folder[]): Promise<Folder> {
  const clean = name.trim().slice(0, NAME_MAX);
  if (existing.some((f) => f.name.toLowerCase() === clean.toLowerCase())) throw new FolderExistsError();
  const id = crypto.randomUUID();
  const { error } = await createClient().from("folders").insert({ id, name: clean });
  if (error) throw error;
  return { id, name: clean };
}

// «Образ 001», «Образ 002»…: следующий номер после самого большого и не меньше числа образов.
export async function nextLookName(): Promise<string> {
  const fallback = "Образ 001";
  if (!hasLooksSupport()) return fallback;
  const { data, error } = await createClient().from("looks").select("name");
  if (error || !data) return fallback;
  const max = data.reduce((m, { name }) => {
    const n = /^Образ (\d+)$/.exec(name)?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, data.length);
  return `Образ ${String(max + 1).padStart(3, "0")}`;
}

export async function saveLook(input: {
  name: string;
  folderId: string | null;
  imagePath: string;
  itemIds: string[];
}): Promise<string> {
  const supabase = createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("looks").insert({
    id,
    name: input.name.trim().slice(0, NAME_MAX),
    folder_id: input.folderId,
    is_favorite: false,
    image_url: input.imagePath,
  });
  if (error) throw error;
  const { error: linkError } = await supabase
    .from("look_items")
    .insert(input.itemIds.map((item_id) => ({ look_id: id, item_id })));
  if (linkError) {
    // Без вещей образ неполный — откатываем.
    await supabase.from("looks").delete().eq("id", id);
    throw linkError;
  }
  return id;
}

export async function updateLook(
  id: string,
  patch: Partial<Pick<Look, "name" | "comment" | "is_favorite" | "folder_id">>,
): Promise<void> {
  const { error } = await createClient().from("looks").update(patch).eq("id", id);
  if (error) throw error;
}

// Картинку не удаляем: это кэш примерки, она пригодится при повторе того же набора.
export async function deleteLook(id: string): Promise<void> {
  const { error } = await createClient().from("looks").delete().eq("id", id);
  if (error) throw error;
}
