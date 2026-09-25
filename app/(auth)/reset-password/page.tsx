import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Новый пароль — Digital Wardrobe" };

export default function ResetPasswordPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <ResetPasswordForm />;
}
