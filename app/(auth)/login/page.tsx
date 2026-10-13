import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import SupabaseMissing from "@/components/auth/SupabaseMissing";
import { legalVersion } from "@/lib/legal.server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Вход — MIRRO" };

type Props = { searchParams: Promise<{ next?: string; error?: string; deleted?: string; reset?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (!getSupabaseEnv()) return <SupabaseMissing />;
  const { next, error, deleted, reset } = await searchParams;
  return (
    <LoginForm
      next={next}
      linkError={error === "link"}
      oauthError={error === "oauth"}
      accountDeleted={deleted === "1"}
      passwordChanged={reset === "1"}
      privacyVersion={legalVersion("privacy")}
    />
  );
}
