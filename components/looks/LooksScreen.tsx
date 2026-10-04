"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import TokenPill from "@/components/TokenPill";
import {
  fetchFolders,
  fetchLooks,
  formatLookCount,
  updateLook,
  type Folder,
  type Look,
} from "@/lib/looks";
import EmptyLooks from "./EmptyLooks";
import LookCard from "./LookCard";
import LookFilters, { type LookFilter } from "./LookFilters";
import NewFolderSheet from "./NewFolderSheet";

export default function LooksScreen() {
  // undefined — загружаются, null — ошибка загрузки.
  const [looks, setLooks] = useState<Look[] | null | undefined>(undefined);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filter, setFilter] = useState<LookFilter>("all");
  const [newFolder, setNewFolder] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchLooks(), fetchFolders()]).then(
      ([l, f]) => {
        setLooks(l);
        setFolders(f);
      },
      () => setLooks(null),
    );
  }, []);
  useEffect(load, [load]);
  const retry = () => {
    setLooks(undefined);
    load();
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Сердечко меняется сразу, а при ошибке сохранения возвращается обратно.
  const toggleFavorite = async (look: Look) => {
    const flip = (value: boolean) =>
      setLooks((prev) => prev?.map((l) => (l.id === look.id ? { ...l, is_favorite: value } : l)));
    flip(!look.is_favorite);
    try {
      await updateLook(look.id, { is_favorite: !look.is_favorite });
    } catch {
      flip(look.is_favorite);
      setToast("Не получилось сохранить. Попробуйте ещё раз.");
    }
  };

  const visible = (looks ?? []).filter((l) =>
    filter === "all" ? true : filter === "favorite" ? l.is_favorite : l.folder_id === filter,
  );
  const isEmpty = looks?.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      {/* Шапка и фильтры остаются на месте при прокрутке */}
      <header className="sticky top-0 z-10 -mx-6 bg-background px-6 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-4xl font-medium leading-none tracking-tight">
              Образы
            </h1>
            <p className="mt-1.5 h-5 text-sm text-muted">
              {looks ? formatLookCount(looks.length) : looks === undefined ? "Загружаем…" : ""}
            </p>
          </div>
          {/* Новый образ собирается в Примерке */}
          <div className="flex items-center gap-2.5">
            <TokenPill />
            <Link
              href="/try-on"
              aria-label="Создать образ"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-text transition-transform active:scale-95"
            >
              <Plus size={22} strokeWidth={1.75} />
            </Link>
          </div>
        </div>

        {looks && !isEmpty && (
          <div className="mt-5">
            <LookFilters
              folders={folders}
              selected={filter}
              onSelect={setFilter}
              onNewFolder={() => setNewFolder(true)}
            />
          </div>
        )}
      </header>

      {looks === undefined ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] animate-pulse rounded-card bg-border/60" />
              <div className="mt-2.5 h-4 w-2/3 animate-pulse rounded-full bg-border/60" />
            </div>
          ))}
        </div>
      ) : looks === null ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <p className="text-[15px] font-medium">Не удалось загрузить образы</p>
          <p className="mt-1.5 text-sm text-muted">Проверьте интернет и попробуйте ещё раз</p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:border-text/30"
          >
            Повторить
          </button>
        </div>
      ) : isEmpty ? (
        <EmptyLooks />
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {filter === "favorite"
            ? "Отметьте сердечком образы, которые нравятся больше всего"
            : "В этой папке пока нет образов"}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2">
          {visible.map((look) => (
            <LookCard key={look.id} look={look} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}

      {newFolder && (
        <NewFolderSheet
          folders={folders}
          onClose={() => setNewFolder(false)}
          onCreated={(folder) => {
            setFolders((prev) => [...prev, folder]);
            setFilter(folder.id);
            setNewFolder(false);
            setToast(`Папка «${folder.name}» создана`);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
