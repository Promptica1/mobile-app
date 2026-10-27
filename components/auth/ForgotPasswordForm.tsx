"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, validateEmail } from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import TextField from "./TextField";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tErr = useTranslations("auth.errors");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email, tErr);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      // На боевом сайте это https://mirro-wardrobe.online/reset-password (адрес должен быть
      // в Supabase → Authentication → URL Configuration → Redirect URLs).
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(authErrorMessage(error, tErr));
    else setSent(true);
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link href="/login" className="font-medium underline underline-offset-4">
          {t("backToLogin")}
        </Link>
      }
    >
      {sent ? (
        <FormMessage tone="info">
          {t("sentBefore")}
          <span className="font-medium">{email.trim()}</span>
          {t("sentAfter")}
        </FormMessage>
      ) : (
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
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <SubmitButton loading={loading}>{loading ? t("sending") : t("submit")}</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
