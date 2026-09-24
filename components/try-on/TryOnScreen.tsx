"use client";

import { useEffect, useState } from "react";
import { Ellipsis, Layers } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import { MOCK_WORN, type WornItem } from "@/lib/tryOn";
import ActionsMenu from "./ActionsMenu";
import ClothesPicker from "./ClothesPicker";
import WornList from "./WornList";

export default function TryOnScreen() {
  // Нижняя панель: выбор одежды (picker) или список надетого (layers).
  const [panel, setPanel] = useState<"picker" | "layers">("picker");
  const [menuOpen, setMenuOpen] = useState(false);
  const [worn, setWorn] = useState<WornItem[]>(MOCK_WORN);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const layersOpen = panel === "layers";

  return (
    // Экран занимает ровно высоту окна над нижней навигацией.
    <div className="flex h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] flex-col gap-4 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <header className="relative flex items-center justify-between">
        <h1 className="font-serif text-4xl font-medium leading-none tracking-tight">
          Примерка
        </h1>
        <button
          type="button"
          aria-label="Действия"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={`relative z-40 flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors ${
            menuOpen
              ? "border-text bg-text text-background"
              : "border-border bg-surface text-text"
          }`}
        >
          <Ellipsis size={22} strokeWidth={1.75} />
        </button>
        {menuOpen && (
          <ActionsMenu
            onClose={() => setMenuOpen(false)}
            onClearAll={() => setWorn([])}
          />
        )}
      </header>

      {/* Аватар пользователя — пока серый силуэт */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-card bg-gradient-to-b from-beige to-[#e9dfd2]">
        <Silhouette variant="filled" className="h-[82%] w-auto text-text/15" />
        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-text px-4 py-2 text-sm text-background">
            {toast}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        {layersOpen ? (
          <WornList
            items={worn}
            onRemove={(id) => setWorn((prev) => prev.filter((item) => item.id !== id))}
            onClose={() => setPanel("picker")}
          />
        ) : (
          <ClothesPicker />
        )}

        <div className="flex gap-3">
          <button
            type="button"
            aria-label="Надетые вещи"
            aria-pressed={layersOpen}
            onClick={() => setPanel(layersOpen ? "picker" : "layers")}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
              layersOpen ? "bg-lavender text-text" : "bg-lavender/30 text-text"
            }`}
          >
            <Layers size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setToast("Сохранение образов — скоро")}
            className="h-12 flex-1 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
          >
            Сохранить образ
          </button>
        </div>
      </section>
    </div>
  );
}
