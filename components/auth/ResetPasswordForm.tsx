"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, authErrorMessage, validateNewPassword } from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import TextField from "./TextField";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const invalid = validateNewPassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(authErrorMessage(error));
      setLoading(false);
      return;
    }
    router.replace("/wardrobe");
    router.refresh();
  }

  return (
    <AuthShell title="Новый пароль" subtitle="Придумайте пароль для входа">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Пароль"
          password
          autoComplete="new-password"
          helper={`Минимум ${MIN_PASSWORD_LENGTH} символов`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={loading}>{loading ? "Сохраняем…" : "Сохранить пароль"}</SubmitButton>
      </form>
    </AuthShell>
  );
}
