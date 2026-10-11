"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    const invalid = validateEmail(email) || validateNewPassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!agreed) {
      setError("Подтвердите согласие с Политикой конфиденциальности.");
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
        data: { privacy_accepted: true, privacy_version: privacyVersion },
      },
    });

    if (error) {
      setError(authErrorMessage(error));
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
      setError("Этот email уже зарегистрирован. Попробуйте войти.");
    } else {
      setSentTo(cleanEmail);
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Соберите свои образы, не открывая шкаф"
      subtitle="Создайте аккаунт за минуту"
      footer={
        <>
          <span className="text-muted">Уже есть аккаунт? </span>
          <Link href="/login" className="font-medium underline underline-offset-4">
            Войти
          </Link>
        </>
      }
    >
      {sentTo ? (
        <FormMessage tone="info">
          Мы отправили письмо на <span className="font-medium">{sentTo}</span>. Перейдите по
          ссылке в письме, чтобы подтвердить почту, — и продолжим.
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
              label="Пароль"
              password
              autoComplete="new-password"
              placeholder="Придумайте пароль"
              helper={`Минимум ${MIN_PASSWORD_LENGTH} символов`}
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
                Регистрируясь, я принимаю{" "}
                <Link
                  href={LEGAL_DOCS.privacy.href}
                  target="_blank"
                  className="text-text underline underline-offset-2"
                >
                  Политику конфиденциальности
                </Link>
              </span>
            </label>
            {error && <FormMessage tone="error">{error}</FormMessage>}
            <SubmitButton loading={loading}>
              {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
            </SubmitButton>
          </form>
          {SHOW_SOCIAL_LOGIN && <SocialButtons />}
        </>
      )}
    </AuthShell>
  );
}
