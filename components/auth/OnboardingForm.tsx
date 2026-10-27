"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { AGE_RANGES, GENDERS, type AgeRange, type Gender, type Profile } from "@/lib/profile";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import Pills from "@/components/ui/Pills";
import TextField from "./TextField";

type Props = { userId: string; initial: Profile };

export default function OnboardingForm({ userId, initial }: Props) {
  const router = useRouter();
  const t = useTranslations("auth.onboarding");
  const tGender = useTranslations("gender");
  const genderOptions = GENDERS.map((g) => ({ value: g.value, label: tGender(g.value) }));
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
      setError(t("required"));
      return;
    }
    setLoading(true);

    const { error } = await createClient()
      .from("profiles")
      .upsert({ id: userId, name: name.trim(), gender, age_range: age });

    if (error) {
      setError(t("saveError"));
      setLoading(false);
      return;
    }
    router.replace("/wardrobe");
    router.refresh();
  }

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <TextField
          label={t("name")}
          autoComplete="given-name"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => withClearError(setName)(e.target.value)}
        />
        <Pills label={t("gender")} options={genderOptions} value={gender} onChange={withClearError(setGender)} />
        <Pills label={t("age")} options={AGE_RANGES} value={age} onChange={withClearError(setAge)} />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={loading}>{loading ? t("saving") : t("submit")}</SubmitButton>
      </form>
    </AuthShell>
  );
}
