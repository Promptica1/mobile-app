"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderPlus, Heart, Pencil, Trash2, WandSparkles } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import { Button } from "@/components/add-item/buttons";
import { MOCK_LOOK_PIECES, type Look } from "@/lib/looks";
import PieceIcon from "./PieceIcon";

export default function LookDetail({ look }: { look: Look }) {
  const router = useRouter();
  // Избранное пока меняется только на этом экране.
  const [favorite, setFavorite] = useState(look.favorite);

  return (
    <>
      <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 py-4">
        <Link
          href="/looks"
          aria-label="Назад к образам"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </Link>

        {/* Переименование подключим позже */}
        <button
          type="button"
          className="flex min-w-0 items-center justify-center gap-2"
          aria-label={`Переименовать образ «${look.name}»`}
        >
          <h1 className="truncate font-serif text-3xl font-medium leading-none">
            {look.name}
          </h1>
          <Pencil size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
        </button>

        <button
          type="button"
          onClick={() => setFavorite((f) => !f)}
          aria-label={favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={favorite}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink/15 transition-colors hover:bg-pink/25"
        >
          <Heart
            size={20}
            strokeWidth={1.75}
            className={favorite ? "fill-pink text-pink" : "text-pink"}
          />
        </button>
      </header>

      <div className="flex flex-col gap-6">
        {/* Аватар в образе — пока силуэт */}
        <div className="flex aspect-[3/3.6] items-center justify-center rounded-card bg-gradient-to-b from-beige to-[#e9dfd2] px-10 py-[8%]">
          <Silhouette variant="filled" className="h-full w-full text-text/15" />
        </div>

        <section>
          <h2 className="mb-2.5 px-1 text-sm font-medium">В образе</h2>
          <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {MOCK_LOOK_PIECES.map((piece) => (
              <span
                key={piece.id}
                title={piece.name}
                aria-label={piece.name}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface"
              >
                <PieceIcon kind={piece.kind} />
              </span>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2.5 px-1 text-sm font-medium">Комментарий</h2>
          <textarea
            rows={2}
            placeholder="Добавить комментарий"
            aria-label="Комментарий к образу"
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
          />
        </section>

        <div className="flex flex-col gap-3">
          <Button variant="lime" onClick={() => router.push("/try-on")}>
            <WandSparkles size={19} strokeWidth={1.75} />
            Изменить образ
          </Button>
          {/* Папки и удаление подключим позже */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary">
              <FolderPlus size={18} strokeWidth={1.75} />В папку
            </Button>
            <Button variant="secondary" className="text-danger!">
              <Trash2 size={18} strokeWidth={1.75} />
              Удалить
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
