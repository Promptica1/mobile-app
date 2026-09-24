"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MOCK_LOOKS, formatLookCount, type Look, type LookFilter } from "@/lib/looks";
import EmptyLooks from "./EmptyLooks";
import LookCard from "./LookCard";
import LookFilters from "./LookFilters";

export default function LooksScreen() {
  const [looks, setLooks] = useState<Look[]>(MOCK_LOOKS);
  // Фильтр пока только визуальный — список не фильтруется.
  const [filter, setFilter] = useState<LookFilter>("Все");

  const toggleFavorite = (id: string) =>
    setLooks((prev) =>
      prev.map((look) =>
        look.id === id ? { ...look, favorite: !look.favorite } : look,
      ),
    );

  const isEmpty = looks.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      {/* Шапка и фильтры остаются на месте при прокрутке */}
      <header className="sticky top-0 z-10 -mx-6 bg-background px-6 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-4xl font-medium leading-none tracking-tight">
              Образы
            </h1>
            <p className="mt-1.5 text-sm text-muted">{formatLookCount(looks.length)}</p>
          </div>
          {/* Новый образ собирается в Примерке */}
          <Link
            href="/try-on"
            aria-label="Создать образ"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-text transition-transform active:scale-95"
          >
            <Plus size={22} strokeWidth={1.75} />
          </Link>
        </div>

        {!isEmpty && (
          <div className="mt-5">
            <LookFilters selected={filter} onSelect={setFilter} />
          </div>
        )}
      </header>

      {isEmpty ? (
        <EmptyLooks />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2">
          {looks.map((look) => (
            <LookCard key={look.id} look={look} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}
