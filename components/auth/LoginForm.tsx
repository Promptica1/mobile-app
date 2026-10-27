"use client";

import { CircleCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, safeNextPath, validateEmail } from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";
import { SHOW_SOCIAL_LOGIN } from "@/lib/features";
import SocialButtons from "./SocialButtons";
import SubmitButton from "@/components/ui/SubmitButton";
import TextField from "./TextField";

export default function LoginForm({
  next,
  linkError,
  oauthError,
  accountDeleted,
  passwordChanged,
  privacyVersion,
}: {
  next?: string;
  linkError?: boolean;
  oauthError?: boolean;
  accountDeleted?: boolean;
  passwordChanged?: boolean;
  privacyVersion: string;
}) {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const tErr = useTranslations("auth.errors");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    linkError ? tErr("linkExpired") : oauthError ? tErr("googleFailed") : "",
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email, tErr) || (password ? "" : tErr("passwordRequired"));
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(authErrorMessage(error, tErr));
      setLoading(false);
      return;
    }
    router.replace(safeNextPath(next));
    router.refresh();
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          <span className="text-muted">{t("noAccount")}</span>
          <Link href="/signup" className="font-medium underline underline-offset-4">
            {t("signUp")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <TextField
            label={t("password")}
            password
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 flex justify-end px-1">
            <Link href="/forgot-password" className="text-sm text-muted underline-offset-4 hover:underline">
              {t("forgot")}
            </Link>
          </div>
        </div>
        {passwordChanged && !error && (
          <FormMessage tone="info" icon={CircleCheck}>{t("passwordChanged")}</FormMessage>
        )}
        {accountDeleted && !error && (
          <FormMessage tone="info" icon={CircleCheck}>{t("accountDeleted")}</FormMessage>
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={loading}>{loading ? t("signingIn") : t("submit")}</SubmitButton>
      </form>
      {SHOW_SOCIAL_LOGIN && <SocialButtons next={safeNextPath(next)} privacyVersion={privacyVersion} />}
    </AuthShell>
  );
}
