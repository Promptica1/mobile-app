import { plural } from "./plural";

// Категории вещей — одни и те же для фильтров гардероба и формы добавления.
export const CATEGORIES = [
  "Верх",
  "Низ",
  "Платья",
  "Комбинезоны",
  "Верхняя одежда",
  "Обувь",
  "Головной убор",
  "Аксессуары",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Цельные вещи на всё тело: надеваются вместо отдельных верха и низа (одна за раз).
export const FULL_BODY_CATEGORIES: readonly string[] = ["Платья", "Комбинезоны"];
export const isFullBody = (category: string) => FULL_BODY_CATEGORIES.includes(category);
// Верх и низ, которые цельная вещь заменяет.
export const SEPARATES_CATEGORIES: readonly string[] = ["Верх", "Низ"];

// Порядок вещей в задании для примерки: основа образа → слои поверх → обувь и детали.
export const OUTFIT_ORDER: readonly string[] = [
  "Платья",
  "Комбинезоны",
  "Верх",
  "Низ",
  "Верхняя одежда",
  "Обувь",
  "Головной убор",
  "Аксессуары",
];
// Неизвестная категория (на всякий случай) — в конец.
export const outfitRank = (category: string) => {
  const i = OUTFIT_ORDER.indexOf(category);
  return i === -1 ? OUTFIT_ORDER.length : i;
};

// Строка таблицы items (см. supabase/migrations).
export type WardrobeItem = {
  id: string;
  name: string;
  category: string;
  color: string | null;
  material: string | null;
  brand: string | null;
  comment: string | null;
  image_url: string | null;
  is_favorite: boolean;
  created_at: string;
  // Не колонка базы: временная ссылка на фото из закрытого бакета (см. lib/items.ts).
  photo_url?: string | null;
};

export type NewWardrobeItem = Pick<
  WardrobeItem,
  "name" | "category" | "color" | "material" | "brand" | "comment"
>;

export const FILTERS = ["Все", "Избранное", ...CATEGORIES] as const;
export type Filter = (typeof FILTERS)[number];

// Тестовые данные — показываются, только пока Supabase не настроен.
const mock = (id: string, name: string, category: Category, is_favorite: boolean): WardrobeItem => ({
  id,
  name,
  category,
  is_favorite,
  color: null,
  material: null,
  brand: null,
  comment: null,
  image_url: null,
  created_at: new Date(2026, 0, 20 - Number(id)).toISOString(),
});

export const MOCK_ITEMS: WardrobeItem[] = [
  mock("1", "Льняная рубашка", "Верх", true),
  mock("2", "Прямые джинсы", "Низ", false),
  mock("3", "Кашемировый свитер", "Верх", false),
  mock("4", "Белые кеды", "Обувь", true),
  mock("5", "Юбка миди", "Низ", false),
  mock("6", "Кожаная сумка", "Аксессуары", true),
  mock("7", "Тренч", "Верхняя одежда", false),
  mock("8", "Лоферы", "Обувь", false),
];

export function formatItemCount(n: number): string {
  return plural(n, ["вещь", "вещи", "вещей"]);
}
