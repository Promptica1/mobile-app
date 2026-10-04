import { Check, Folder, FolderPlus, LayoutGrid } from "lucide-react";
import type { Folder as FolderRow } from "@/lib/looks";

type Props = {
  folders: FolderRow[];
  // null — «Все образы» (без папки).
  value: string | null;
  onChange: (folderId: string | null) => void;
  onNewFolder: () => void;
};

const pill =
  "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors";

// Выбор папки для образа: «Все образы», папки пользователя и «Новая папка».
export default function FolderPicker({ folders, value, onChange, onNewFolder }: Props) {
  const options = [{ id: null, name: "Все образы" }, ...folders];
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Папка">
      {options.map(({ id, name }) => {
        const active = id === value;
        const Icon = active ? Check : id === null ? LayoutGrid : Folder;
        return (
          <button
            key={id ?? "all"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={`${pill} ${
              active
                ? "border-text bg-text text-background"
                : "border-border bg-subtle text-text hover:border-text/30"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            <span className="max-w-[12rem] truncate">{name}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onNewFolder}
        className={`${pill} border-dashed border-text/25 text-muted hover:border-text/40 hover:text-text`}
      >
        <FolderPlus size={14} strokeWidth={1.75} />
        Новая папка
      </button>
    </div>
  );
}
