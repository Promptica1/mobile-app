import { plural } from "./plural";

// Категории вещей — одни и те же для фильтров гардероба и формы добавления.
export const CATEGORIES = ["Верх", "Низ", "Верхняя одежда", "Обувь", "Аксессуары"] as const;
export type Category = (typeof CATEGORIES)[number];

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
