"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Sheet from "@/components/ui/Sheet";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import { createFolder, FolderExistsError, type Folder } from "@/lib/looks";
import TextField from "./TextField";

type Props = {
  folders: Folder[];
  onCreated: (folder: Folder) => void;
  onClose: () => void;
};

export default function NewFolderSheet({ folders, onCreated, onClose }: Props) {
  const t = useTranslations("looks.folder");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError(t("nameRequired"));
    setError("");
    setSaving(true);
    try {
      onCreated(await createFolder(name, folders));
    } catch (err) {
      setError(
        err instanceof FolderExistsError
          ? t("exists")
          : t("createError"),
      );
      setSaving(false);
    }
  };

  return (
    <Sheet title={t("title")} onClose={onClose} locked={saving}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <TextField
          label={t("name")}
          value={name}
          onChange={setName}
          placeholder={t("placeholder")}
          autoFocus
        />
        <p className="-mt-2 px-1 text-xs leading-relaxed text-muted">
          {t("hint")}
        </p>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={saving}>{t("submit")}</SubmitButton>
      </form>
    </Sheet>
  );
}
