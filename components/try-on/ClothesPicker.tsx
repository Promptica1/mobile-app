import { useState } from "react";
import { Heart, Search } from "lucide-react";
import {
  FILTER_ICONS,
  MOCK_THUMBNAILS,
  TRY_ON_FILTERS,
  type TryOnFilter,
} from "@/lib/tryOn";

const scrollRow =
  "-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function ClothesPicker() {
  const [filter, setFilter] = useState<TryOnFilter>("Верх");
  const [query, setQuery] = useState("");
  // Первая вещь категории считается надетой.
  const [selectedId, setSelectedId] = useState(MOCK_THUMBNAILS.Верх[0].id);
  const Icon = FILTER_ICONS[filter];

  // Поиск по названию внутри выбранной категории.
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = MOCK_THUMBNAILS[filter].filter((item) =>
    item.name.toLowerCase().includes(normalizedQuery),
  );

  return (
    <div className="flex flex-col gap-3">
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
                setSelectedId(MOCK_THUMBNAILS[f][0].id);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                active
                  ? "border-text bg-text text-background"
                  : "border-border bg-surface text-text hover:border-text/30"
              }`}
            >
              {f === "Избранное" && (
                <Heart size={14} strokeWidth={1.75} className="fill-pink text-pink" />
              )}
              {f}
            </button>
          );
        })}
      </div>

      <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3.5 transition-colors focus-within:border-lavender">
        <Search size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск вещи"
          aria-label="Поиск вещи"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      {visibleItems.length === 0 ? (
        // Та же высота, что у ленты, — панель не прыгает.
        <p className="flex h-[3.75rem] items-center justify-center text-sm text-muted">
          Ничего не найдено
        </p>
      ) : (
        <div className={`${scrollRow} py-0.5`}>
          {visibleItems.map((item) => {
            const active = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                aria-label={item.name}
                title={item.name}
                onClick={() => setSelectedId(item.id)}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-background transition-shadow ${
                  active ? "ring-2 ring-lavender" : "ring-1 ring-border hover:ring-text/20"
                }`}
              >
                <Icon size={22} strokeWidth={1.25} className="text-muted" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
