import { useState } from "react";
import {
  FILTER_ICONS,
  MOCK_THUMBNAILS,
  TRY_ON_FILTERS,
  type TryOnFilter,
} from "@/lib/tryOn";

const scrollRow =
  "-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function ClothesPicker() {
  const [filter, setFilter] = useState<TryOnFilter>("Верх");
  // Первая вещь в ленте считается надетой.
  const [selected, setSelected] = useState(0);
  const Icon = FILTER_ICONS[filter];

  return (
    <div className="flex flex-col gap-4">
      <div className={scrollRow}>
        {TRY_ON_FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(f);
                setSelected(0);
              }}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                active
                  ? "border-text bg-text text-background"
                  : "border-border bg-surface text-text hover:border-text/30"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className={`${scrollRow} py-0.5`}>
        {MOCK_THUMBNAILS[filter].map((id, i) => (
          <button
            key={id}
            type="button"
            aria-pressed={i === selected}
            aria-label={`Вещь ${i + 1}`}
            onClick={() => setSelected(i)}
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-background transition-shadow ${
              i === selected
                ? "ring-2 ring-lavender"
                : "ring-1 ring-border hover:ring-text/20"
            }`}
          >
            <Icon size={24} strokeWidth={1.25} className="text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
