import type { Metadata } from "next";
import ProfileScreen from "@/components/profile/ProfileScreen";
import { MOCK_PROFILE, type Profile } from "@/lib/profile";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Профиль — Digital Wardrobe" };

async function loadProfile(): Promise<Profile> {
  if (!getSupabaseEnv()) return MOCK_PROFILE;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return MOCK_PROFILE;
  const { data } = await supabase
    .from("profiles")
    .select("name, gender, age_range")
    .eq("id", user.id)
    .maybeSingle<Profile>();
  return data ?? MOCK_PROFILE;
}

export default async function ProfilePage() {
  return <ProfileScreen profile={await loadProfile()} />;
}
