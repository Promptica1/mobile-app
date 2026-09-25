import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Вход — Digital Wardrobe" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  const { next, error } = await searchParams;
  return <LoginForm next={next} linkError={error === "link"} />;
}
