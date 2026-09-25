import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Регистрация — Digital Wardrobe" };

export default function SignupPage() {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  return <SignupForm />;
}
