import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("forgot")} — MIRRO` };
}

export default function ForgotPasswordPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <ForgotPasswordForm />;
}
