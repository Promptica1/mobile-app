"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import FolderPicker from "@/components/looks/FolderPicker";
import NewFolderSheet from "@/components/looks/NewFolderSheet";
import TextField from "@/components/looks/TextField";
import FormMessage from "@/components/ui/FormMessage";
import Sheet from "@/components/ui/Sheet";
import SubmitButton from "@/components/ui/SubmitButton";
import type { Folder } from "@/lib/looks";

const SAVE_ERROR = "Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.";

// Общая логика: кнопка ждёт сохранения, при ошибке показываем сообщение и не закрываем.
function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch {
      setError(SAVE_ERROR);
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

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

export function DeleteSheet({
  name,
  onDelete,
  onClose,
}: {
  name: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { busy, error, run } = useSubmit(onDelete);
  return (
    <Sheet title="Удалить образ?" onClose={onClose} locked={busy}>
      <p className="-mt-2 text-sm leading-relaxed text-muted">
        Образ «{name}» удалится насовсем. Вещи останутся в гардеробе.
      </p>
      {error && (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-danger text-[15px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
          Удалить
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-12 rounded-full text-[15px] text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          Отмена
        </button>
      </div>
    </Sheet>
  );
}
