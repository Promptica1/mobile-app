"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Ellipsis, Layers, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Silhouette from "@/components/Silhouette";
import Photo from "@/components/ui/Photo";
import { fetchAvatar, hasAvatarSupport, type Avatar } from "@/lib/avatar";
import { fetchItems } from "@/lib/items";
import { announceTokens, NO_TOKENS_MESSAGE } from "@/lib/tokens";
import {
  findCachedTryOn,
  selectedItems,
  selectionKey,
  tryOn,
  TryOnError,
  type Selection,
  type TryOnResult,
} from "@/lib/tryOn";
import type { WardrobeItem } from "@/lib/wardrobe";
import { PREV_PATH_KEY } from "@/components/BottomNav";
import TokenPill from "@/components/TokenPill";
import ActionsMenu from "./ActionsMenu";
import AvatarSetup from "./AvatarSetup";
import BottomSheet from "./BottomSheet";
import ClothesPicker from "./ClothesPicker";
import SaveLookSheet from "./SaveLookSheet";
import WornList from "./WornList";

// Средний цвет по краям картинки (верхняя строка и боковые столбцы).
function sampleEdgeColor(img: HTMLImageElement): string | null {
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < size; y++) {
      for (const x of y === 0 ? Array.from({ length: size }, (_, i) => i) : [0, size - 1]) {
        const i = (y * size + x) * 4;
        r += px[i];
        g += px[i + 1];
        b += px[i + 2];
        n++;
      }
    }
    return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  } catch {
    // Картинку нельзя прочитать (CORS) — остаётся фон приложения.
    return null;
  }
}

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
  const [toast, setToast] = useState<string | null>(null);
  // Вещи из гардероба: undefined — загружаются, null — ошибка.
  const [items, setItems] = useState<WardrobeItem[] | null | undefined>(undefined);
  // Выбранные вещи — по одной в каждой категории.
  const [selection, setSelection] = useState<Selection>({});
  // Готовые примерки: ключ набора (аватар + вещи) → ссылка на картинку.
  const [results, setResults] = useState<Record<string, TryOnResult>>({});
  // Сохранённые в «Образы» наборы: ключ набора → id образа.
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  useEffect(() => {
    fetchItems().then(
      (list) => {
        setItems(list);
        // «Изменить образ» открывает Примерку как /try-on?items=id1,id2 — надеваем эти вещи.
        const ids = new URLSearchParams(window.location.search).get("items")?.split(",") ?? [];
        if (ids.length === 0) return;
        const preset: Selection = {};
        list.filter((i) => ids.includes(i.id)).forEach((i) => (preset[i.category] = i));
        setSelection(preset);
        window.history.replaceState(null, "", "/try-on");
        if (Object.keys(preset).length < ids.length) setToast("Часть вещей образа удалена из гардероба");
      },
      () => setItems(null),
    );
  }, []);

  const picked = useMemo(() => selectedItems(selection), [selection]);
  const avatarPath = avatar?.path ?? null;
  const comboKey = avatarPath && picked.length > 0 ? selectionKey(avatarPath, selection) : null;
  const result = comboKey ? results[comboKey] : undefined;
  const resultUrl = result?.url;
  const savedLookId = comboKey ? saved[comboKey] : undefined;

  // Этот набор уже примеряли раньше (в т.ч. в прошлые визиты) — показываем сразу, без генерации.
  const checked = useRef(new Set<string>());
  useEffect(() => {
    if (!comboKey || !avatarPath || checked.current.has(comboKey) || !hasAvatarSupport()) return;
    checked.current.add(comboKey);
    const ids = comboKey.slice(avatarPath.length + 1).split(",");
    findCachedTryOn(avatarPath, ids).then(
      (found) => found && setResults((prev) => ({ ...prev, [comboKey]: found })),
      () => checked.current.delete(comboKey),
    );
  }, [comboKey, avatarPath]);

  // Новая вещь в категории заменяет прежнюю, повторное нажатие — снимает.
  const toggleItem = (item: WardrobeItem) => {
    if (!item.image_url && hasAvatarSupport()) {
      setToast("Без фото вещь не примерить");
      return;
    }
    setSelection((prev) => ({
      ...prev,
      [item.category]: prev[item.category]?.id === item.id ? undefined : item,
    }));
  };
  const removeItem = (item: WardrobeItem) =>
    setSelection((prev) => ({ ...prev, [item.category]: undefined }));

  const runTryOn = async () => {
    if (!hasAvatarSupport()) return setToast("Примерка недоступна в тестовом режиме");
    if (!avatarPath) return setSetup("create");
    if (!comboKey || generating) return;
    setGenerating(true);
    try {
      const found = await tryOn(picked.map((i) => i.id));
      setResults((prev) => ({ ...prev, [comboKey]: found }));
      announceTokens(found.tokens);
    } catch (err) {
      const reason = err instanceof TryOnError ? err.reason : "failed";
      if (reason === "no_avatar") setSetup("create");
      else if (reason === "no_tokens") setToast(NO_TOKENS_MESSAGE);
      else if (reason === "items_not_found" || reason === "item_without_photo")
        setToast("Одна из вещей недоступна. Обновите страницу и попробуйте снова.");
      else setToast("Не получилось примерить. Попробуйте ещё раз чуть позже.");
    } finally {
      setGenerating(false);
    }
  };

  const closeSetup = useCallback(() => {
    if (setup === "create") markSkipped();
    setSetup(null);
  }, [setup]);

  useEffect(() => {
    if (!toast) return;
    // Длинные сообщения (ошибки) висят дольше.
    const timer = setTimeout(() => setToast(null), toast.length > 30 ? 4000 : 2000);
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

  // «←»: на предыдущий экран приложения, а если «Примерку» открыли напрямую — в Гардероб.
  const router = useRouter();
  const goBack = () => {
    let prev: string | null = null;
    try {
      prev = sessionStorage.getItem(PREV_PATH_KEY);
    } catch {
      // ignore
    }
    if (prev && prev !== "/try-on") router.back();
    else router.push("/wardrobe");
  };

  // Цвет фона по краям картинки аватара — им закрашиваем экран вокруг него.
  const [edgeColor, setEdgeColor] = useState<string | null>(null);

  const toggleLayers = () => {
    setPanel(layersOpen ? "picker" : "layers");
    setSheetOpen(true);
  };

  return (
    // Полноэкранный режим: нижней навигации здесь нет.
    <div
      className="fixed inset-0 mx-auto w-full max-w-[430px] overflow-hidden bg-background transition-colors duration-500"
      style={edgeColor ? { backgroundColor: edgeColor } : undefined}
    >
      {/* Аватар целиком (от головы до ног) во всей области между заголовком и панелью:
          панель никогда не закрывает ноги. Если места по высоте мало, аватар уменьшается,
          а боковые поля закрашены цветом фона самой картинки — белых полос не видно. */}
      <div
        className="absolute inset-x-0 top-[calc(3.25rem+env(safe-area-inset-top))] flex items-center justify-center transition-[bottom] duration-300"
        style={{ bottom: sheetHeight }}
      >
        {resultUrl ? (
          <Photo
            key={resultUrl}
            src={resultUrl}
            alt="Аватар в образе"
            crossOrigin="anonymous"
            onLoad={(img) => setEdgeColor(sampleEdgeColor(img))}
            className="animate-fade-in"
            fallback={avatar?.url ? <Photo src={avatar.url} alt="Ваш аватар" /> : null}
          />
        ) : avatar?.url ? (
          <Photo
            src={avatar.url}
            alt="Ваш аватар"
            crossOrigin="anonymous"
            onLoad={(img) => setEdgeColor(sampleEdgeColor(img))}
            fallback={<Silhouette variant="filled" className="h-full w-full px-10 py-6 text-text/15" />}
          />
        ) : (
          <Silhouette
            variant="filled"
            className={`h-full w-full px-10 py-6 text-text/15 ${avatar === undefined ? "animate-pulse" : ""}`}
          />
        )}
        {generating && (
          <div className="absolute inset-0 flex items-end justify-center bg-background/35 pb-6" aria-live="polite">
            <span className="absolute inset-x-10 h-px animate-scan bg-lavender shadow-[0_0_12px_2px] shadow-lavender/60" />
            <div className="flex flex-col items-center rounded-2xl bg-surface/90 px-5 py-3 shadow-sm backdrop-blur-md">
              <p className="flex items-center gap-2 text-[15px] font-medium">
                <LoaderCircle size={18} strokeWidth={2} className="animate-spin text-lavender" />
                Примеряем образ…
              </p>
              <p className="mt-0.5 text-xs text-muted">Обычно это занимает 10–40 секунд</p>
            </div>
          </div>
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
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            aria-label="Назад"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-surface/60"
          >
            <ArrowLeft size={22} strokeWidth={1.5} />
          </button>
          <h1 className="font-serif text-3xl font-medium leading-none tracking-tight drop-shadow-[0_1px_8px_rgba(255,255,255,0.9)]">
            Примерка
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <TokenPill />
          <div className="relative">
            <button
              type="button"
              aria-label="Действия"
              aria-expanded={menuOpen}
              disabled={generating}
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
                onClearAll={() => setSelection({})}
                onAvatar={() => {
                  if (!hasAvatarSupport()) return setToast("Аватар недоступен в тестовом режиме");
                  setSetup(avatar?.path ? "update" : "create");
                }}
              />
            )}
          </div>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="absolute left-1/2 z-30 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background transition-[bottom] duration-300"
          style={{ bottom: sheetHeight + 12 }}
        >
          {toast}
        </div>
      )}

      {saving && comboKey && result && (
        <SaveLookSheet
          itemIds={picked.map((i) => i.id)}
          imagePath={result.path}
          onClose={() => setSaving(false)}
          onSaved={(lookId) => {
            setSaved((prev) => ({ ...prev, [comboKey]: lookId }));
            setSaving(false);
            setToast("Образ сохранён в «Образы»");
          }}
        />
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
            {/* Результат для этого набора уже на экране — можно сохранять, иначе — примерить. */}
            {savedLookId ? (
              <Link
                href={`/looks/${savedLookId}`}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-surface text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
              >
                <Check size={18} strokeWidth={2} />
                Сохранён · открыть
              </Link>
            ) : resultUrl ? (
              <button
                type="button"
                onClick={() => setSaving(true)}
                className="h-12 flex-1 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
              >
                Сохранить образ
              </button>
            ) : (
              <button
                type="button"
                onClick={runTryOn}
                disabled={picked.length === 0 || generating}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {generating && <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />}
                {generating ? "Примеряем…" : picked.length === 0 ? "Выберите вещи" : "Примерить"}
              </button>
            )}
          </div>
        }
      >
        {/* Пока идёт примерка, набор не меняем. */}
        <div inert={generating} className={generating ? "opacity-50 transition-opacity" : "transition-opacity"}>
          {layersOpen ? (
            <WornList items={picked} onRemove={removeItem} onClose={() => setPanel("picker")} />
          ) : (
            <ClothesPicker items={items} selection={selection} onToggle={toggleItem} />
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
