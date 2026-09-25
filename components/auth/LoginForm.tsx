"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, safeNextPath, validateEmail } from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "./FormMessage";
import SocialButtons from "./SocialButtons";
import SubmitButton from "./SubmitButton";
import TextField from "./TextField";

export default function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    linkError ? "Ссылка из письма устарела или уже использована. Войдите или запросите новую." : "",
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email) || (password ? "" : "Введите пароль.");
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
      setError(authErrorMessage(error));
      setLoading(false);
      return;
    }
    router.replace(safeNextPath(next));
    router.refresh();
  }

  return (
    <AuthShell
      title="Соберём новый образ вместе?"
      subtitle="Войдите в свой гардероб"
      footer={
        <>
          <span className="text-muted">Нет аккаунта? </span>
          <Link href="/signup" className="font-medium underline underline-offset-4">
            Зарегистрироваться
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
            label="Пароль"
            password
            autoComplete="current-password"
            placeholder="Ваш пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 flex justify-end px-1">
            <Link href="/forgot-password" className="text-sm text-muted underline-offset-4 hover:underline">
              Забыли пароль?
            </Link>
          </div>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={loading}>{loading ? "Входим…" : "Войти"}</SubmitButton>
      </form>
      <SocialButtons />
    </AuthShell>
  );
}
