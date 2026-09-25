"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, validateEmail } from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "./FormMessage";
import SubmitButton from "./SubmitButton";
import TextField from "./TextField";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmail(email);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) setError(authErrorMessage(error));
    else setSent(true);
  }

  return (
    <AuthShell
      title="Восстановим доступ"
      subtitle="Пришлём ссылку для нового пароля"
      footer={
        <Link href="/login" className="font-medium underline underline-offset-4">
          Вернуться ко входу
        </Link>
      }
    >
      {sent ? (
        <FormMessage tone="info">
          Если аккаунт с адресом <span className="font-medium">{email.trim()}</span> существует,
          мы отправили на него письмо со ссылкой.
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
          <SubmitButton loading={loading}>{loading ? "Отправляем…" : "Отправить ссылку"}</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
