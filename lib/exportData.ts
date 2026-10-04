import { createClient } from "@/lib/supabase/client";

// «Скачать мои данные»: всё, что приложение хранит о пользователе, одним JSON-файлом.
// Фото не вкладываем — они открываются только внутри приложения по временным ссылкам.

async function rows(table: string, columns: string) {
  const { data, error } = await createClient().from(table).select(columns);
  if (error) throw error;
  return data;
}

export async function exportMyData(): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("no session");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) throw error;

  const [items, folders, looks, lookItems] = await Promise.all([
    rows("items", "id, name, category, color, material, brand, comment, is_favorite, created_at"),
    rows("folders", "id, name, created_at"),
    rows("looks", "id, name, folder_id, comment, is_favorite, created_at"),
    rows("look_items", "look_id, item_id"),
  ]);
  // Служебные пути к файлам не нужны пользователю — оставляем только факт наличия.
  const { avatar_path, photo_path, ...profileData } = (profile ?? {}) as Record<string, unknown>;

  const data = {
    exported_at: new Date().toISOString(),
    account: { email: session.user.email, created_at: session.user.created_at },
    profile: { ...profileData, has_avatar: Boolean(avatar_path), has_profile_photo: Boolean(photo_path) },
    items,
    folders,
    looks: looks.map((l) => ({
      ...(l as unknown as Record<string, unknown>),
      item_ids: (lookItems as unknown as { look_id: string; item_id: string }[])
        .filter((li) => li.look_id === (l as unknown as { id: string }).id)
        .map((li) => li.item_id),
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mirro-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
