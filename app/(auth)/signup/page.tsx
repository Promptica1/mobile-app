import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SignupForm from "@/components/auth/SignupForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getLocale } from "next-intl/server";
import { legalVersion } from "@/lib/legal.server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("signup")} — MIRRO` };
}

export default async function SignupPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <SignupForm privacyVersion={legalVersion("privacy", await getLocale())} />;
}
