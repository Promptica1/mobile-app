import { useState } from "react";
import Link from "next/link";
import { Check, Heart, Plus, Search, Shirt } from "lucide-react";
import Photo from "@/components/ui/Photo";
import type { WardrobeItem } from "@/lib/wardrobe";
import {
  CATEGORY_ICONS,
  FILTER_CATEGORY,
  TRY_ON_FILTERS,
  type Selection,
  type TryOnFilter,
} from "@/lib/tryOn";

const scrollRow =
  "-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type Props = {
  // undefined — гардероб ещё загружается, null — не удалось загрузить.
  items: WardrobeItem[] | null | undefined;
  selection: Selection;
  onToggle: (item: WardrobeItem) => void;
};

// Та же высота, что у ленты превью, — панель не прыгает.
const rowMessage = "flex h-[4.25rem] items-center justify-center text-sm text-muted";

export default function ClothesPicker({ items, selection, onToggle }: Props) {
  const [filter, setFilter] = useState<TryOnFilter>("Все");
  const [query, setQuery] = useState("");

  // Категория + поиск по названию, как в «Гардеробе».
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = (items ?? []).filter(
    (item) =>
      (filter === "Все" ||
        (filter === "Избранное" ? item.is_favorite : item.category === FILTER_CATEGORY[filter])) &&
      item.name.toLowerCase().includes(normalizedQuery),
  );

  let row: React.ReactNode;
  if (items === undefined) {
    row = (
      <div className={`${scrollRow} py-1`} aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-border/60" />
        ))}
      </div>
    );
  } else if (items === null) {
    row = <p className={rowMessage}>Не удалось загрузить гардероб</p>;
  } else if (items.length === 0) {
    row = (
      <div className={`${rowMessage} gap-3`}>
        В гардеробе пока пусто
        <Link
          href="/add-item"
          className="flex items-center gap-1 rounded-full bg-lavender/30 px-3 py-1.5 text-sm font-medium text-text"
        >
          <Plus size={14} strokeWidth={2} />
          Добавить вещь
        </Link>
      </div>
    );
  } else if (visibleItems.length === 0) {
    row = (
      <p className={rowMessage}>
        {normalizedQuery
          ? "Ничего не найдено"
          : filter === "Избранное"
            ? "Нет избранных вещей"
            : "В этой категории пока нет вещей"}
      </p>
    );
  } else {
    row = (
      <div className={`${scrollRow} py-1`}>
        {visibleItems.map((item) => {
          const active = selection[item.category]?.id === item.id;
          const Icon = CATEGORY_ICONS[item.category] ?? Shirt;
          const icon = <Icon size={22} strokeWidth={1.25} className="text-muted" />;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              aria-label={item.name}
              title={item.name}
              onClick={() => onToggle(item)}
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-background p-1.5 transition-shadow ${
                active ? "ring-2 ring-lavender" : "ring-1 ring-border hover:ring-text/20"
              }`}
            >
              {item.photo_url ? <Photo src={item.photo_url} alt="" fallback={icon} /> : icon}
              {active && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-lavender text-text ring-2 ring-surface">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={scrollRow}>
        {TRY_ON_FILTERS.map((f) => {
          const active = f === filter;
          // Точка — в этой категории уже что-то выбрано.
          const picked = f !== "Все" && f !== "Избранное" && Boolean(selection[FILTER_CATEGORY[f]]);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
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
              {picked && <span className="h-1.5 w-1.5 rounded-full bg-lavender" aria-label="выбрано" />}
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

      {row}
    </div>
  );
}
