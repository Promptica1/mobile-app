import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import OnboardingForm from "@/components/auth/OnboardingForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import type { Profile } from "@/lib/profile";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("onboarding")} — MIRRO` };
}

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
      initial={{
        name: null,
        gender: null,
        age_range: null,
        ...data,
        // Вход через Google: подставляем имя из аккаунта Google, его можно поменять.
        ...(!data?.name && googleName(user.user_metadata) ? { name: googleName(user.user_metadata) } : {}),
      }}
    />
  );
}

function googleName(meta: Record<string, unknown> | undefined) {
  const name = meta?.given_name ?? meta?.full_name ?? meta?.name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 40) : null;
}
