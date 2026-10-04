"use client";

import { useState } from "react";
import { useSubmit } from "@/components/ui/useSubmit";
import FolderPicker from "@/components/looks/FolderPicker";
import NewFolderSheet from "@/components/looks/NewFolderSheet";
import TextField from "@/components/looks/TextField";
import FormMessage from "@/components/ui/FormMessage";
import Sheet from "@/components/ui/Sheet";
import SubmitButton from "@/components/ui/SubmitButton";
import type { Folder } from "@/lib/looks";

export function RenameSheet({
  name,
  onSave,
  onClose,
}: {
  name: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(name);
  const { busy, error, setError, run } = useSubmit(() => onSave(value.trim()));
  return (
    <Sheet title="Название образа" onClose={onClose} locked={busy}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return setError("Введите название образа.");
          run();
        }}
        className="flex flex-col gap-4"
      >
        <TextField label="Название" value={value} onChange={setValue} autoFocus />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={busy}>Сохранить</SubmitButton>
      </form>
    </Sheet>
  );
}

export function MoveSheet({
  folders: initialFolders,
  current,
  onMove,
  onFolderCreated,
  onClose,
}: {
  folders: Folder[];
  current: string | null;
  onMove: (folderId: string | null) => Promise<void>;
  onFolderCreated: (folder: Folder) => void;
  onClose: () => void;
}) {
  const [folders, setFolders] = useState(initialFolders);
  const [value, setValue] = useState(current);
  const [newFolder, setNewFolder] = useState(false);
  const { busy, error, run } = useSubmit(() => onMove(value));
  return (
    <>
      <Sheet title="В папку" onClose={onClose} locked={busy}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex flex-col gap-5"
        >
          <FolderPicker
            folders={folders}
            value={value}
            onChange={setValue}
            onNewFolder={() => setNewFolder(true)}
          />
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <SubmitButton loading={busy}>Переместить</SubmitButton>
        </form>
      </Sheet>
      {newFolder && (
        <NewFolderSheet
          folders={folders}
          onClose={() => setNewFolder(false)}
          onCreated={(folder) => {
            setFolders((prev) => [...prev, folder]);
            setValue(folder.id);
            onFolderCreated(folder);
            setNewFolder(false);
          }}
        />
      )}
    </>
  );
}
