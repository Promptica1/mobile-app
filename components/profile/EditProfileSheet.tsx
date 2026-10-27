"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import TextField from "@/components/looks/TextField";
import FormMessage from "@/components/ui/FormMessage";
import Pills from "@/components/ui/Pills";
import Sheet from "@/components/ui/Sheet";
import SubmitButton from "@/components/ui/SubmitButton";
import { useSubmit } from "@/components/ui/useSubmit";
import { GENDERS, type Gender, type Profile } from "@/lib/profile";

type Props = {
  profile: Profile;
  onSave: (patch: Pick<Profile, "name" | "gender">) => Promise<void>;
  onClose: () => void;
};

export default function EditProfileSheet({ profile, onSave, onClose }: Props) {
  const t = useTranslations("profile.edit_");
  const tCommon = useTranslations("common");
  const tGender = useTranslations("gender");
  const genderOptions = GENDERS.map((g) => ({ value: g.value, label: tGender(g.value) }));
  const [name, setName] = useState(profile.name ?? "");
  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const { busy, error, setError, run } = useSubmit(() => onSave({ name: name.trim(), gender }));

  return (
    <Sheet title={t("title")} onClose={onClose} locked={busy}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError(t("nameRequired"));
          if (!gender) return setError(t("genderRequired"));
          run();
        }}
        className="flex flex-col gap-5"
      >
        <TextField
          label={t("name")}
          value={name}
          onChange={(v) => {
            setError("");
            setName(v);
          }}
          placeholder={t("namePlaceholder")}
        />
        <Pills
          label={t("gender")}
          options={genderOptions}
          value={gender}
          onChange={(v) => {
            setError("");
            setGender(v);
          }}
        />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="flex flex-col gap-2">
          <SubmitButton loading={busy}>{tCommon("save")}</SubmitButton>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-12 rounded-full text-[15px] text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {tCommon("cancel")}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
