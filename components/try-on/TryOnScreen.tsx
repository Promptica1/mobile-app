"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ellipsis, Layers } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import Photo from "@/components/ui/Photo";
import { fetchAvatar, hasAvatarSupport, type Avatar } from "@/lib/avatar";
import { MOCK_WORN, type WornItem } from "@/lib/tryOn";
import ActionsMenu from "./ActionsMenu";
import AvatarSetup from "./AvatarSetup";
import BottomSheet from "./BottomSheet";
import ClothesPicker from "./ClothesPicker";
import WornList from "./WornList";

// «Пропустить пока»: не предлагаем создать аватар до конца сессии браузера.
const SKIP_KEY = "dw:avatar-setup-skipped";
const wasSkipped = () => {
  try {
    return sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};
const markSkipped = () => {
  try {
    sessionStorage.setItem(SKIP_KEY, "1");
  } catch {
    // ignore
  }
};

export default function TryOnScreen() {
  // Нижняя панель: выбор одежды (picker) или список надетого (layers).
  const [panel, setPanel] = useState<"picker" | "layers">("picker");
  const [menuOpen, setMenuOpen] = useState(false);
  const [worn, setWorn] = useState<WornItem[]>(MOCK_WORN);
  const [toast, setToast] = useState<string | null>(null);
  // Аватар: undefined — ещё загружается.
  const [avatar, setAvatar] = useState<Avatar | undefined>(undefined);
  const [setup, setSetup] = useState<"create" | "update" | null>(null);

  useEffect(() => {
    fetchAvatar().then(
      (a) => {
        setAvatar(a);
        // Аватара нет — сразу предлагаем создать, если не пропустили в этой сессии.
        if (!a.path && hasAvatarSupport() && !wasSkipped()) setSetup("create");
      },
      () => setAvatar({ path: null, url: null, heightCm: null, weightKg: null }),
    );
  }, []);

  const closeSetup = useCallback(() => {
    if (setup === "create") markSkipped();
    setSetup(null);
  }, [setup]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const layersOpen = panel === "layers";

  // Нижняя панель: развёрнута (выбор вещей) или свёрнута (аватар почти на весь экран).
  const [sheetOpen, setSheetOpen] = useState(true);
  // Высота панели — аватар занимает всё, что над ней, и плавно растёт при сворачивании.
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleLayers = () => {
    setPanel(layersOpen ? "picker" : "layers");
    setSheetOpen(true);
  };

  return (
    // Экран закреплён между верхом окна и нижней навигацией (4.5rem + 1px рамки).
    <div className="fixed inset-x-0 top-0 bottom-[calc(4.5rem+1px+env(safe-area-inset-bottom))] mx-auto w-full max-w-[430px] overflow-hidden bg-background">
      {/* Аватар всегда во всю ширину и на одном месте: фон совпадает с фоном приложения,
          а развёрнутая панель просто ложится поверх его нижней части.
          Область — от заголовка до свёрнутой панели (~7rem); my-auto центрирует аватар,
          а если он выше области, прижимает к верху (низ уходит под панель). */}
      <div className="absolute inset-x-0 bottom-[7rem] top-[calc(3rem+env(safe-area-inset-top))] flex flex-col">
        {avatar?.url ? (
          <div className="my-auto w-full shrink-0">
            <Photo
              src={avatar.url}
              alt="Ваш аватар"
              fit="width"
              fallback={<Silhouette variant="filled" className="h-[70vh] w-full px-10 py-6 text-text/15" />}
            />
          </div>
        ) : (
          <Silhouette
            variant="filled"
            className={`h-full w-full px-10 py-6 text-text/15 ${avatar === undefined ? "animate-pulse" : ""}`}
          />
        )}
        {avatar && !avatar.path && setup === null && hasAvatarSupport() && (
          <button
            type="button"
            onClick={() => setSetup("create")}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/90 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition-colors hover:bg-surface"
          >
            Создать аватар
          </button>
        )}
      </div>

      {/* Заголовок и меню поверх аватара */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-start justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
        <h1 className="font-serif text-3xl font-medium leading-none tracking-tight drop-shadow-[0_1px_8px_rgba(250,248,246,0.9)]">
          Примерка
        </h1>
        <div className="relative">
          <button
            type="button"
            aria-label="Действия"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={`relative z-40 flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
              menuOpen
                ? "border-text bg-text text-background"
                : "border-border/70 bg-surface/75 text-text"
            }`}
          >
            <Ellipsis size={20} strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <ActionsMenu
              hasAvatar={Boolean(avatar?.path)}
              onClose={() => setMenuOpen(false)}
              onClearAll={() => setWorn([])}
              onAvatar={() => {
                if (!hasAvatarSupport()) return setToast("Аватар недоступен в тестовом режиме");
                setSetup(avatar?.path ? "update" : "create");
              }}
            />
          )}
        </div>
      </header>

      {toast && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-text px-4 py-2 text-sm text-background transition-[bottom] duration-300"
          style={{ bottom: sheetHeight + 12 }}
        >
          {toast}
        </div>
      )}

      {setup && avatar && (
        <AvatarSetup
          mode={setup}
          current={avatar}
          onDone={(a) => {
            setAvatar(a);
            setSetup(null);
            setToast(setup === "update" ? "Аватар обновлён" : "Аватар готов");
          }}
          onClose={closeSetup}
        />
      )}

      <BottomSheet
        ref={sheetRef}
        expanded={sheetOpen}
        onExpandedChange={setSheetOpen}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              aria-label="Надетые вещи"
              aria-pressed={layersOpen && sheetOpen}
              onClick={toggleLayers}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                layersOpen && sheetOpen ? "bg-lavender text-text" : "bg-lavender/30 text-text"
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
        }
      >
        {layersOpen ? (
          <WornList
            items={worn}
            onRemove={(id) => setWorn((prev) => prev.filter((item) => item.id !== id))}
            onClose={() => setPanel("picker")}
          />
        ) : (
          <ClothesPicker />
        )}
      </BottomSheet>
    </div>
  );
}
