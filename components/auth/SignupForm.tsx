"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  validateEmail,
  validateNewPassword,
} from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";
import { SHOW_SOCIAL_LOGIN } from "@/lib/features";
import { LEGAL_DOCS } from "@/lib/legal";
import SocialButtons from "./SocialButtons";
import SubmitButton from "@/components/ui/SubmitButton";
import TextField from "./TextField";

// privacyVersion — редакция политики, с которой соглашается пользователь (записывается в базу).
export default function SignupForm({ privacyVersion }: { privacyVersion: string }) {
  const router = useRouter();
  const t = useTranslations("auth.signup");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Если в Supabase включено подтверждение почты — просим открыть письмо.
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const invalid = validateEmail(email, tErr) || validateNewPassword(password, tErr);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!agreed) {
      setError(tErr("consentRequired"));
      return;
    }
    setLoading(true);

    const cleanEmail = email.trim();
    const { data, error } = await createClient().auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        // Согласие с политикой: база запишет его (с временем сервера) при создании аккаунта.
        data: { privacy_accepted: true, privacy_version: privacyVersion, locale },
      },
    });

    if (error) {
      setError(authErrorMessage(error, tErr));
      setLoading(false);
      return;
    }
    // Строку в profiles создаёт триггер в базе (см. supabase/migrations).
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }
    // Supabase не сообщает явно, что адрес занят: у такого пользователя нет identities.
    if (data.user && data.user.identities?.length === 0) {
      setError(tErr("emailTaken"));
    } else {
      setSentTo(cleanEmail);
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          <span className="text-muted">{t("haveAccount")}</span>
          <Link href="/login" className="font-medium underline underline-offset-4">
            {t("signIn")}
          </Link>
        </>
      }
    >
      {sentTo ? (
        <FormMessage tone="info">
          {t("sentBefore")}
          <span className="font-medium">{sentTo}</span>
          {t("sentAfter")}
        </FormMessage>
      ) : (
        <>
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
            <TextField
              label={t("password")}
              password
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              helper={t("passwordHelper", { min: MIN_PASSWORD_LENGTH })}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="flex cursor-pointer items-start gap-2.5 px-1 text-xs leading-relaxed text-muted">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked) setError("");
                }}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-text"
              />
              <span>
                {t("agree")}{" "}
                <Link
                  href={LEGAL_DOCS.privacy.href}
                  target="_blank"
                  className="text-text underline underline-offset-2"
                >
                  {t("privacy")}
                </Link>
              </span>
            </label>
            {error && <FormMessage tone="error">{error}</FormMessage>}
            <SubmitButton loading={loading}>
              {loading ? t("creating") : t("submit")}
            </SubmitButton>
          </form>
          {SHOW_SOCIAL_LOGIN && (
            <SocialButtons
              next="/onboarding"
              privacyVersion={privacyVersion}
              consent={{
                agreed,
                onMissing: () => setError(tErr("consentRequired")),
              }}
            />
          )}
        </>
      )}
    </AuthShell>
  );
}
