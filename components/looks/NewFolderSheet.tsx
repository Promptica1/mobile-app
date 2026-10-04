"use client";

import { useState } from "react";
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
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Введите название папки.");
    setError("");
    setSaving(true);
    try {
      onCreated(await createFolder(name, folders));
    } catch (err) {
      setError(
        err instanceof FolderExistsError
          ? "Папка с таким названием уже есть."
          : "Не получилось создать папку. Проверьте интернет и попробуйте ещё раз.",
      );
      setSaving(false);
    }
  };

  return (
    <Sheet title="Новая папка" onClose={onClose} locked={saving}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <TextField
          label="Название папки"
          value={name}
          onChange={setName}
          placeholder="Например, Отпуск"
          autoFocus
        />
        <p className="-mt-2 px-1 text-xs leading-relaxed text-muted">
          Складывайте образы по поводам: отпуск, работа, праздники. Папку можно выбрать при
          сохранении образа.
        </p>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={saving}>Создать папку</SubmitButton>
      </form>
    </Sheet>
  );
}
