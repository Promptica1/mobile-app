"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  MOCK_ITEMS,
  formatItemCount,
  type Filter,
  type WardrobeItem,
} from "@/lib/wardrobe";
import CategoryFilters from "./CategoryFilters";
import EmptyWardrobe from "./EmptyWardrobe";
import ItemCard from "./ItemCard";
import SearchField from "./SearchField";

export default function WardrobeScreen() {
  const [items, setItems] = useState<WardrobeItem[]>(MOCK_ITEMS);
  const [filter, setFilter] = useState<Filter>("Все");
  const [query, setQuery] = useState("");

  const toggleFavorite = (id: string) =>
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, favorite: !item.favorite } : item,
      ),
    );

  const isEmpty = items.length === 0;

  // Поиск по названию работает внутри выбранной категории.
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    const matchesFilter =
      filter === "Все" ||
      (filter === "Избранное" ? item.favorite : item.category === filter);
    return matchesFilter && item.name.toLowerCase().includes(normalizedQuery);
  });

  return (
    <div className="flex flex-1 flex-col">
      {/* Шапка и фильтры остаются на месте при прокрутке */}
      <header className="sticky top-0 z-10 -mx-6 bg-background px-6 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-4xl font-medium leading-none tracking-tight">
              Гардероб
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {formatItemCount(items.length)}
            </p>
          </div>
          <Link
            href="/add-item"
            aria-label="Добавить вещь"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lavender text-text transition-transform active:scale-95"
          >
            <Plus size={22} strokeWidth={1.75} />
          </Link>
        </div>

        {!isEmpty && (
          <div className="mt-5 flex flex-col gap-4">
            <SearchField value={query} onChange={setQuery} />
            <CategoryFilters selected={filter} onSelect={setFilter} />
          </div>
        )}
      </header>

      {isEmpty ? (
        <EmptyWardrobe />
      ) : visibleItems.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Ничего не найдено</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2">
          {visibleItems.map((item) => (
            <ItemCard key={item.id} item={item} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}
