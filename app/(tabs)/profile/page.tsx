import type { Metadata } from "next";
import ProfileScreen from "@/components/profile/ProfileScreen";
import { MOCK_PROFILE, type Profile } from "@/lib/profile";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Профиль — Digital Wardrobe" };

async function loadProfile(): Promise<{ profile: Profile; userId: string | null }> {
  const mock = { profile: MOCK_PROFILE, userId: null };
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
  return data ? { profile: data, userId: user.id } : mock;
}

export default async function ProfilePage() {
  const { profile, userId } = await loadProfile();
  return <ProfileScreen profile={profile} userId={userId} />;
}
