import { Heart } from "lucide-react";
import { FILTERS, type Filter } from "@/lib/wardrobe";

type Props = {
  selected: Filter;
  onSelect: (filter: Filter) => void;
};

export default function CategoryFilters({ selected, onSelect }: Props) {
  return (
    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((filter) => {
        const active = filter === selected;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onSelect(filter)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
              active
                ? "border-text bg-text text-background"
                : "border-border bg-surface text-text hover:border-text/30"
            }`}
          >
            {filter === "Избранное" && (
              <Heart size={14} strokeWidth={1.75} className="fill-pink text-pink" />
            )}
            {filter}
          </button>
        );
      })}
    </div>
  );
}
