import { createLucideIcon, Footprints, Gem, Layers, PersonStanding, Shirt, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category, WardrobeItem } from "./wardrobe";

export const TRY_ON_FILTERS = [
  "Все",
  "Избранное",
  "Верх",
  "Низ",
  "Платья",
  "Комбинезоны",
  "Верхняя",
  "Обувь",
  "Головной убор",
  "Аксессуары",
] as const;
export type TryOnFilter = (typeof TRY_ON_FILTERS)[number];

// Короткая подпись фильтра → категория вещи в базе.
export const FILTER_CATEGORY: Record<Exclude<TryOnFilter, "Все" | "Избранное">, Category> = {
  Верх: "Верх",
  Низ: "Низ",
  Платья: "Платья",
  Комбинезоны: "Комбинезоны",
  Верхняя: "Верхняя одежда",
  Обувь: "Обувь",
  "Головной убор": "Головной убор",
  Аксессуары: "Аксессуары",
};

// В lucide нет платья и шляпы — рисуем в том же стиле (24×24, линия).
const Dress = createLucideIcon("dress", [
  ["path", { d: "M9 2v3l-1.5 3L5 21h14L16.5 8 15 5V2", key: "body" }],
  ["path", { d: "M7.5 8h9", key: "waist" }],
]);
const Hat = createLucideIcon("hat", [
  ["path", { d: "M2 17c0 1.7 4.5 3 10 3s10-1.3 10-3-4.5-3-10-3-10 1.3-10 3", key: "brim" }],
  ["path", { d: "M6 15.5V10a6 6 0 0 1 12 0v5.5", key: "crown" }],
]);

// Иконка-заглушка, если у вещи нет фото.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Верх: Shirt,
  Низ: Layers,
  Платья: Dress,
  Комбинезоны: PersonStanding,
  "Верхняя одежда": Shirt,
  Обувь: Footprints,
  "Головной убор": Hat,
  Аксессуары: Gem,
};

// Выбранные для примерки вещи: не больше одной в каждой категории.
export type Selection = Partial<Record<string, WardrobeItem>>;

// Порядок слоёв в списке «Надето на вас».
const LAYER_ORDER = [
  "Головной убор",
  "Верхняя одежда",
  "Платья",
  "Комбинезоны",
  "Верх",
  "Низ",
  "Обувь",
  "Аксессуары",
];
export const selectedItems = (s: Selection) =>
  Object.values(s)
    .filter((i): i is WardrobeItem => Boolean(i))
    .sort((a, b) => LAYER_ORDER.indexOf(a.category) - LAYER_ORDER.indexOf(b.category));

// Ключ набора для кэша в браузере: аватар + id вещей без учёта порядка.
export const selectionKey = (avatarPath: string, s: Selection) =>
  `${avatarPath}|${selectedItems(s)
    .map((i) => i.id)
    .sort()
    .join(",")}`;

// url — временная ссылка для показа, path — файл в бакете tryons (для сохранения образа).
export type TryOnResult = { url: string; path: string; cached: boolean; tokens?: number | null };

export class TryOnError extends Error {
  constructor(public reason: string) {
    super(`try-on ${reason}`);
  }
}

// Закрытый бакет с готовыми примерками: <id пользователя>/<ключ набора>.jpg
export const TRYONS_BUCKET = "tryons";
const SIGNED_URL_TTL = 60 * 60;

// Тот же ключ, что считает сервер (/api/try-on): sha256 от «аватар|id вещей по порядку».
async function comboKey(avatarPath: string, itemIds: string[]) {
  const bytes = new TextEncoder().encode(`${avatarPath}|${[...itemIds].sort().join(",")}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Этот набор на этом аватаре уже примеряли? Тогда показываем сразу, без генерации.
export async function findCachedTryOn(avatarPath: string, itemIds: string[]): Promise<TryOnResult | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("try_on_results")
    .select("image_path")
    .eq("combo_key", await comboKey(avatarPath, itemIds))
    .maybeSingle<{ image_path: string }>();
  if (!data) return null;
  const { data: signed } = await supabase.storage
    .from(TRYONS_BUCKET)
    .createSignedUrl(data.image_path, SIGNED_URL_TTL);
  return signed?.signedUrl ? { url: signed.signedUrl, path: data.image_path, cached: true } : null;
}

// Сервер ждёт Runware до 90 с, браузер — с запасом.
const CLIENT_TIMEOUT_MS = 110_000;

// Генерация (или готовый результат из кэша) идёт на сервере — ключ Runware только там.
export async function tryOn(itemIds: string[]): Promise<TryOnResult> {
  let res: Response;
  try {
    res = await fetch("/api/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds }),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch {
    throw new TryOnError("network");
  }
  const data = (await res.json().catch(() => null)) as
    | { url?: string; path?: string; cached?: boolean; tokens?: number | null; error?: string }
    | null;
  if (!res.ok || !data?.url || !data.path) throw new TryOnError(data?.error ?? "failed");
  return { url: data.url, path: data.path, cached: Boolean(data.cached), tokens: data.tokens };
}
