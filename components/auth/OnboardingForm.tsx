"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AGE_RANGES, GENDERS, type AgeRange, type Gender, type Profile } from "@/lib/profile";
import AuthShell from "./AuthShell";
import FormMessage from "./FormMessage";
import SubmitButton from "./SubmitButton";
import TextField from "./TextField";

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`rounded-full border px-5 py-2.5 text-sm transition-colors ${
                active
                  ? "border-text bg-text text-background"
                  : "border-border bg-surface text-text hover:border-text/30"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type Props = { userId: string; initial: Profile };

export default function OnboardingForm({ userId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [gender, setGender] = useState<Gender | null>(initial.gender);
  const [age, setAge] = useState<AgeRange | null>(initial.age_range);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Подсказку об ошибке убираем, как только пользователь начал исправлять.
  function withClearError<T>(setter: (value: T) => void) {
    return (value: T) => {
      setError("");
      setter(value);
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !gender || !age) {
      setError("Заполните имя, пол и возраст — это нужно, чтобы подобрать образы под вас.");
      return;
    }
    setLoading(true);

    const { error } = await createClient()
      .from("profiles")
      .upsert({ id: userId, name: name.trim(), gender, age_range: age });

    if (error) {
      setError("Не получилось сохранить профиль. Попробуйте ещё раз.");
      setLoading(false);
      return;
    }
    router.replace("/wardrobe");
    router.refresh();
  }

  return (
    <AuthShell title="Создайте профиль" subtitle="Расскажите немного о себе">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <TextField
          label="Имя"
          autoComplete="given-name"
          placeholder="Как вас зовут?"
          value={name}
          onChange={(e) => withClearError(setName)(e.target.value)}
        />
        <Pills label="Пол" options={GENDERS} value={gender} onChange={withClearError(setGender)} />
        <Pills label="Возраст" options={AGE_RANGES} value={age} onChange={withClearError(setAge)} />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={loading}>{loading ? "Сохраняем…" : "Продолжить"}</SubmitButton>
      </form>
    </AuthShell>
  );
}
