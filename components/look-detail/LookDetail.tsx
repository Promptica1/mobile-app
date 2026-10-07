"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Folder,
  FolderPlus,
  Heart,
  Pencil,
  Shirt,
  Trash2,
  WandSparkles,
} from "lucide-react";
import Silhouette from "@/components/Silhouette";
import { Button } from "@/components/ui/Button";
import Photo from "@/components/ui/Photo";
import { fetchItemsByIds } from "@/lib/items";
import {
  deleteLook,
  fetchFolders,
  fetchLook,
  updateLook,
  type Folder as FolderRow,
  type Look,
} from "@/lib/looks";
import { CATEGORY_ICONS } from "@/lib/tryOn";
import type { WardrobeItem } from "@/lib/wardrobe";
import ConfirmDeleteSheet from "@/components/ui/ConfirmDeleteSheet";
import { MoveSheet, RenameSheet } from "./LookSheets";

// Вещи в ленте — в порядке слоёв образа.
const ORDER = [
  "Головной убор",
  "Верхняя одежда",
  "Платья",
  "Комбинезоны",
  "Верх",
  "Низ",
  "Обувь",
  "Аксессуары",
];

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "missing" }
  | { status: "ready"; look: Look; itemIds: string[]; items: WardrobeItem[]; folders: FolderRow[] };

export default function LookDetail({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [sheet, setSheet] = useState<"rename" | "move" | "delete" | null>(null);
  const [comment, setComment] = useState("");
  const [commentStatus, setCommentStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchLook(id)
      .then(async (found) => {
        if (!found) return setState({ status: "missing" });
        const [items, folders] = await Promise.all([
          fetchItemsByIds(found.itemIds),
          fetchFolders(),
        ]);
        items.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
        setComment(found.look.comment ?? "");
        setState({ status: "ready", ...found, items, folders });
      })
      .catch(() => setState({ status: "error" }));
  }, [id]);
  useEffect(load, [load]);
  const retry = () => {
    setState({ status: "loading" });
    load();
  };

  useEffect(() => {
    if (state.status === "ready") document.title = `${state.look.name} — MIRRO`;
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const back = (
    <Link
      href="/looks"
      aria-label="Назад к образам"
      className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
    >
      <ArrowLeft size={22} strokeWidth={1.5} />
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div aria-busy>
        <header className="py-4">{back}</header>
        <div className="flex flex-col gap-6" aria-hidden>
          <div className="mx-auto h-8 w-1/2 animate-pulse rounded-full bg-border/60" />
          <div className="aspect-[3/4] animate-pulse rounded-card bg-border/60" />
        </div>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <div className="flex flex-1 flex-col">
        <header className="py-4">{back}</header>
        <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          <p className="font-serif text-3xl font-medium">
            {state.status === "missing" ? "Образ не найден" : "Не удалось загрузить образ"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {state.status === "missing"
              ? "Возможно, его уже удалили"
              : "Проверьте интернет и попробуйте ещё раз"}
          </p>
          {state.status === "error" ? (
            <button
              type="button"
              onClick={retry}
              className="mt-6 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:border-text/30"
            >
              Повторить
            </button>
          ) : (
            <Link href="/looks" className="mt-6 rounded-full bg-lime px-6 py-3 text-sm font-medium">
              Ко всем образам
            </Link>
          )}
        </div>
      </div>
    );
  }

  const { look, itemIds, items, folders } = state;
  const folderName = folders.find((f) => f.id === look.folder_id)?.name;
  const patch = (values: Partial<Look>) =>
    setState((prev) => (prev.status === "ready" ? { ...prev, look: { ...prev.look, ...values } } : prev));

  const toggleFavorite = async () => {
    patch({ is_favorite: !look.is_favorite });
    try {
      await updateLook(look.id, { is_favorite: !look.is_favorite });
    } catch {
      patch({ is_favorite: look.is_favorite });
      setToast("Не получилось сохранить. Попробуйте ещё раз.");
    }
  };

  // Комментарий сохраняется, когда поле теряет фокус.
  const saveComment = async () => {
    const value = comment.trim() || null;
    if (value === (look.comment ?? null)) return;
    setCommentStatus("saving");
    try {
      await updateLook(look.id, { comment: value });
      patch({ comment: value });
      setCommentStatus("saved");
    } catch {
      setCommentStatus("error");
    }
  };

  const placeholder = <Silhouette variant="filled" className="h-full w-full px-10 py-[8%] text-text/15" />;

  return (
    <>
      <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 py-4">
        {back}
        <button
          type="button"
          onClick={() => setSheet("rename")}
          className="flex min-w-0 items-center justify-center gap-2"
          aria-label={`Переименовать образ «${look.name}»`}
        >
          <h1 className="truncate font-serif text-3xl font-medium leading-none">{look.name}</h1>
          <Pencil size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={look.is_favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={look.is_favorite}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink/15 transition-colors hover:bg-pink/25"
        >
          <Heart
            size={20}
            strokeWidth={1.75}
            className={look.is_favorite ? "fill-pink text-pink" : "text-pink"}
          />
        </button>
      </header>

      <div className="flex flex-col gap-6">
        <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-card border border-border bg-gradient-to-b from-beige to-[#e9dfd2]">
          {look.photo_url ? (
            <Photo src={look.photo_url} alt={`Образ «${look.name}»`} fallback={placeholder} />
          ) : (
            placeholder
          )}
          {folderName && (
            <span className="absolute bottom-3 left-3 flex max-w-[70%] items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              <Folder size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{folderName}</span>
            </span>
          )}
        </div>

        <section>
          <h2 className="mb-2.5 px-1 text-sm font-medium">В образе</h2>
          {items.length === 0 ? (
            <p className="px-1 text-sm text-muted">Вещи этого образа удалены из гардероба</p>
          ) : (
            <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] ?? Shirt;
                const icon = <Icon size={22} strokeWidth={1.25} className="text-muted" />;
                return (
                  <span
                    key={item.id}
                    title={item.name}
                    aria-label={item.name}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface p-1.5"
                  >
                    {item.photo_url ? <Photo src={item.photo_url} alt="" fallback={icon} /> : icon}
                  </span>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2.5 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-medium">Комментарий</h2>
            <span className={`text-xs ${commentStatus === "error" ? "text-danger" : "text-muted"}`} aria-live="polite">
              {{ "": "", saving: "Сохраняем…", saved: "Сохранено", error: "Не сохранилось" }[commentStatus]}
            </span>
          </div>
          <textarea
            rows={2}
            maxLength={500}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setCommentStatus("");
            }}
            onBlur={saveComment}
            placeholder="Добавить комментарий"
            aria-label="Комментарий к образу"
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
          />
        </section>

        <div className="flex flex-col gap-3">
          {/* Вещи образа надеваются на аватар в Примерке */}
          <Button
            variant="lime"
            disabled={items.length === 0}
            onClick={() => router.push(`/try-on?items=${items.map((i) => i.id).join(",")}`)}
          >
            <WandSparkles size={19} strokeWidth={1.75} />
            Изменить образ
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setSheet("move")}>
              <FolderPlus size={18} strokeWidth={1.75} />В папку
            </Button>
            <Button variant="secondary" className="text-danger!" onClick={() => setSheet("delete")}>
              <Trash2 size={18} strokeWidth={1.75} />
              Удалить
            </Button>
          </div>
          {items.length < itemIds.length && items.length > 0 && (
            <p className="text-center text-xs text-muted">Часть вещей этого образа удалена из гардероба</p>
          )}
        </div>
      </div>

      {sheet === "rename" && (
        <RenameSheet
          name={look.name}
          onClose={() => setSheet(null)}
          onSave={async (name) => {
            await updateLook(look.id, { name });
            patch({ name });
            setSheet(null);
          }}
        />
      )}
      {sheet === "move" && (
        <MoveSheet
          folders={folders}
          current={look.folder_id}
          onClose={() => setSheet(null)}
          onFolderCreated={(folder) =>
            setState((prev) =>
              prev.status === "ready" ? { ...prev, folders: [...prev.folders, folder] } : prev,
            )
          }
          onMove={async (folderId) => {
            await updateLook(look.id, { folder_id: folderId });
            patch({ folder_id: folderId });
            setSheet(null);
            setToast(folderId ? "Образ перемещён в папку" : "Образ перемещён во «Все образы»");
          }}
        />
      )}
      {sheet === "delete" && (
        <ConfirmDeleteSheet
          title="Удалить образ?"
          text={`Образ «${look.name}» удалится насовсем. Вещи останутся в гардеробе.`}
          onClose={() => setSheet(null)}
          onDelete={async () => {
            await deleteLook(look.id);
            router.replace("/looks");
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background"
        >
          {toast}
        </div>
      )}
    </>
  );
}
