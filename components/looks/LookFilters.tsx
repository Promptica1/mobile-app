import { Folder, Heart, Plus } from "lucide-react";
import { LOOK_FILTERS, type LookFilter } from "@/lib/looks";

type Props = {
  selected: LookFilter;
  onSelect: (filter: LookFilter) => void;
};

const pill =
  "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors";

export default function LookFilters({ selected, onSelect }: Props) {
  return (
    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LOOK_FILTERS.map(({ label, kind }) => {
        const active = label === selected;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(label)}
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
            {label}
          </button>
        );
      })}
      {/* Создание папки подключим позже */}
      <button
        type="button"
        className={`${pill} border-dashed border-text/25 text-muted hover:border-text/40 hover:text-text`}
      >
        <Plus size={14} strokeWidth={1.75} />
        Папка
      </button>
    </div>
  );
}
