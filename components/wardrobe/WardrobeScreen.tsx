"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fetchItems, setItemFavorite } from "@/lib/items";
import { formatItemCount, type Filter, type WardrobeItem } from "@/lib/wardrobe";
import CategoryFilters from "./CategoryFilters";
import EmptyWardrobe from "./EmptyWardrobe";
import ItemCard, { ItemCardSkeleton } from "./ItemCard";
import SearchField from "./SearchField";

type LoadState = "loading" | "ready" | "error";

export default function WardrobeScreen() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [status, setStatus] = useState<LoadState>("loading");
  const [filter, setFilter] = useState<Filter>("Все");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchItems().then(
        (data) => {
          setItems(data);
          setStatus("ready");
        },
        () => setStatus("error"),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setStatus("loading");
    load();
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Сердечко меняется сразу, а если сохранить не удалось — возвращаем как было.
  const toggleFavorite = async (item: WardrobeItem) => {
    const next = !item.is_favorite;
    const apply = (value: boolean) =>
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_favorite: value } : i)),
      );
    apply(next);
    try {
      await setItemFavorite(item.id, next);
    } catch {
      apply(!next);
      setToast("Не получилось сохранить. Попробуйте ещё раз.");
    }
  };

  const isLoading = status === "loading";
  const isEmpty = status === "ready" && items.length === 0;

  // Поиск по названию работает внутри выбранной категории.
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    const matchesFilter =
      filter === "Все" ||
      (filter === "Избранное" ? item.is_favorite : item.category === filter);
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
            <p className="mt-1.5 h-5 text-sm text-muted">
              {status === "ready" && formatItemCount(items.length)}
              {isLoading && <span className="inline-block h-3 w-16 animate-pulse rounded-full bg-border/70 align-middle" />}
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

        {status === "ready" && !isEmpty && (
          <div className="mt-5 flex flex-col gap-4">
            <SearchField value={query} onChange={setQuery} />
            <CategoryFilters selected={filter} onSelect={setFilter} />
          </div>
        )}
      </header>

      {isLoading && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2" aria-busy="true" aria-label="Загружаем гардероб">
          {Array.from({ length: 4 }, (_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="max-w-[260px] text-sm leading-relaxed text-muted">
            Не получилось загрузить гардероб. Проверьте интернет и попробуйте ещё раз.
          </p>
          <button
            type="button"
            onClick={retry}
            className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm font-medium transition-colors hover:border-text/30"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {isEmpty && <EmptyWardrobe />}

      {status === "ready" && !isEmpty &&
        (visibleItems.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Ничего не найдено</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2">
            {visibleItems.map((item) => (
              <ItemCard key={item.id} item={item} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        ))}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto w-fit max-w-[calc(100%-3rem)] rounded-full bg-text px-4 py-2.5 text-center text-sm text-background"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
