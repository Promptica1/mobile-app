import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { legalVersion } from "@/lib/legal.server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Регистрация — MIRRO" };

export default function SignupPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <SignupForm privacyVersion={legalVersion("privacy")} />;
}
