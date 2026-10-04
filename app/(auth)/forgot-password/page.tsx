import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Восстановление пароля — MIRRO" };

export default function ForgotPasswordPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <ForgotPasswordForm />;
}
