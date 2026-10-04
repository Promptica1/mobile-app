import type { Metadata } from "next";
import ProfileScreen from "@/components/profile/ProfileScreen";
import { MOCK_PROFILE, PROFILE_PHOTOS_BUCKET, type Profile } from "@/lib/profile";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Профиль — Digital Wardrobe" };

type Loaded = {
  profile: Profile;
  userId: string | null;
  photo: { path: string | null; url: string | null };
};

async function loadProfile(): Promise<Loaded> {
  const mock = { profile: MOCK_PROFILE, userId: null, photo: { path: null, url: null } };
  if (!getSupabaseEnv()) return mock;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return mock;
  const { data } = await supabase
    .from("profiles")
    .select("name, gender, age_range")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (!data) return mock;

  // Фото профиля — отдельным запросом: если SQL с колонкой photo_path ещё не запущен,
  // профиль всё равно открывается, просто без фото.
  const { data: photoRow } = await supabase
    .from("profiles")
    .select("photo_path")
    .eq("id", user.id)
    .maybeSingle<{ photo_path: string | null }>();
  const path = photoRow?.photo_path ?? null;
  const url = path
    ? ((await supabase.storage.from(PROFILE_PHOTOS_BUCKET).createSignedUrl(path, 60 * 60)).data?.signedUrl ?? null)
    : null;
  return { profile: data, userId: user.id, photo: { path, url } };
}

export default async function ProfilePage() {
  const { profile, userId, photo } = await loadProfile();
  return <ProfileScreen profile={profile} userId={userId} photo={photo} />;
}
