import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("reset")} — MIRRO` };
}

export default function ResetPasswordPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <ResetPasswordForm />;
}
