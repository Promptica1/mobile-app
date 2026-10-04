"use client";

import { useEffect, useState } from "react";
import FolderPicker from "@/components/looks/FolderPicker";
import NewFolderSheet from "@/components/looks/NewFolderSheet";
import TextField from "@/components/looks/TextField";
import FormMessage from "@/components/ui/FormMessage";
import Sheet from "@/components/ui/Sheet";
import SubmitButton from "@/components/ui/SubmitButton";
import { fetchFolders, nextLookName, saveLook, type Folder } from "@/lib/looks";

type Props = {
  itemIds: string[];
  // Путь готовой примерки в бакете tryons — образ ссылается на неё, без новой генерации.
  imagePath: string;
  onSaved: (lookId: string) => void;
  onClose: () => void;
};

export default function SaveLookSheet({ itemIds, imagePath, onSaved, onClose }: Props) {
  const [name, setName] = useState("");
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Название по умолчанию — следующий номер; пользователь может его изменить.
    nextLookName().then((n) => setName((current) => current || n));
    fetchFolders().then(setFolders, () => setFolders([]));
  }, []);

  const submit = async () => {
    if (!name.trim()) return setError("Введите название образа.");
    setError("");
    setSaving(true);
    try {
      onSaved(await saveLook({ name, folderId, imagePath, itemIds }));
    } catch {
      setError("Не получилось сохранить образ. Проверьте интернет и попробуйте ещё раз.");
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet title="Сохранить образ" onClose={onClose} locked={saving}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5"
        >
          <TextField label="Название" value={name} onChange={setName} placeholder="Образ 001" />

          <div>
            <span className="mb-2 block px-1 text-sm font-medium">Сохранить в</span>
            {folders === null ? (
              <div className="flex gap-2" aria-hidden>
                {[28, 20, 24].map((w) => (
                  <span key={w} className="h-9 animate-pulse rounded-full bg-border/60" style={{ width: `${w * 4}px` }} />
                ))}
              </div>
            ) : (
              <FolderPicker
                folders={folders}
                value={folderId}
                onChange={setFolderId}
                onNewFolder={() => setNewFolder(true)}
              />
            )}
          </div>

          {error && <FormMessage tone="error">{error}</FormMessage>}

          <div className="flex flex-col gap-2">
            <SubmitButton loading={saving}>Сохранить</SubmitButton>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-12 rounded-full text-[15px] text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </form>
      </Sheet>

      {newFolder && folders && (
        <NewFolderSheet
          folders={folders}
          onClose={() => setNewFolder(false)}
          onCreated={(folder) => {
            // Возвращаемся к сохранению — новая папка уже выбрана.
            setFolders((prev) => [...(prev ?? []), folder]);
            setFolderId(folder.id);
            setNewFolder(false);
          }}
        />
      )}
    </>
  );
}
