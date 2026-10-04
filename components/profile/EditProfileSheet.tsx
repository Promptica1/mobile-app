"use client";

import { useState } from "react";
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
  const [name, setName] = useState(profile.name ?? "");
  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const { busy, error, setError, run } = useSubmit(() => onSave({ name: name.trim(), gender }));

  return (
    <Sheet title="Профиль" onClose={onClose} locked={busy}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Введите имя.");
          if (!gender) return setError("Выберите пол — так образы подберутся точнее.");
          run();
        }}
        className="flex flex-col gap-5"
      >
        <TextField
          label="Имя"
          value={name}
          onChange={(v) => {
            setError("");
            setName(v);
          }}
          placeholder="Как к вам обращаться"
        />
        <Pills
          label="Пол"
          options={GENDERS}
          value={gender}
          onChange={(v) => {
            setError("");
            setGender(v);
          }}
        />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="flex flex-col gap-2">
          <SubmitButton loading={busy}>Сохранить</SubmitButton>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-12 rounded-full text-[15px] text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </form>
    </Sheet>
  );
}
