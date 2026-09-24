import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function SearchField({ value, onChange }: Props) {
  return (
    <label className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-surface px-4 transition-colors focus-within:border-lavender">
      <Search size={18} strokeWidth={1.5} className="shrink-0 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск по гардеробу"
        aria-label="Поиск по гардеробу"
        className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Очистить поиск"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-border/70 text-text/70"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </label>
  );
}
