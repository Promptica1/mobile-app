import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OnboardingForm from "@/components/auth/OnboardingForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import type { Profile } from "@/lib/profile";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Создайте профиль — Digital Wardrobe" };

export default async function OnboardingPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("name, gender, age_range")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return (
    <OnboardingForm
      userId={user.id}
      initial={data ?? { name: null, gender: null, age_range: null }}
    />
  );
}
