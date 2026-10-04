import { Folder, Heart, Plus } from "lucide-react";
import type { Folder as FolderRow } from "@/lib/looks";

// "all", "favorite" или id папки.
export type LookFilter = string;

type Props = {
  folders: FolderRow[];
  selected: LookFilter;
  onSelect: (filter: LookFilter) => void;
  onNewFolder: () => void;
};

const pill =
  "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors";

export default function LookFilters({ folders, selected, onSelect, onNewFolder }: Props) {
  const options = [
    { id: "all", label: "Все", kind: "all" },
    { id: "favorite", label: "Избранное", kind: "favorite" },
    ...folders.map((f) => ({ id: f.id, label: f.name, kind: "folder" })),
  ];
  return (
    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map(({ id, label, kind }) => {
        const active = id === selected;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={active}
            className={`${pill} ${
              active
                ? "border-text bg-text text-background"
                : "border-border bg-surface text-text hover:border-text/30"
            }`}
          >
            {kind === "favorite" && (
              <Heart size={14} strokeWidth={1.75} className="fill-pink text-pink" />
            )}
            {kind === "folder" && <Folder size={14} strokeWidth={1.75} />}
            <span className="max-w-[10rem] truncate">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onNewFolder}
        className={`${pill} border-dashed border-text/25 text-muted hover:border-text/40 hover:text-text`}
      >
        <Plus size={14} strokeWidth={1.75} />
        Папка
      </button>
    </div>
  );
}
