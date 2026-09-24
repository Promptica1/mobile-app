import { plural } from "./plural";

export type Look = {
  id: string;
  name: string;
  favorite: boolean;
};

export const LOOK_FILTERS = [
  { label: "Все", kind: "all" },
  { label: "Избранное", kind: "favorite" },
  { label: "Франция", kind: "folder" },
  { label: "Работа", kind: "folder" },
] as const;

export type LookFilter = (typeof LOOK_FILTERS)[number]["label"];

/*
 * Тестовые данные, пока нет настоящего хранилища.
 * Чтобы увидеть ПУСТОЙ экран образов, замените массив на пустой:
 *   export const MOCK_LOOKS: Look[] = [];
 */
export const MOCK_LOOKS: Look[] = [
  { id: "1", name: "Офис", favorite: true },
  { id: "2", name: "Образ 002", favorite: false },
  { id: "3", name: "Свидание", favorite: true },
  { id: "4", name: "Образ 004", favorite: false },
  { id: "5", name: "Прогулка по Парижу", favorite: false },
  { id: "6", name: "Образ 006", favorite: true },
];

export function formatLookCount(n: number): string {
  return plural(n, ["образ", "образа", "образов"]);
}

export function getLook(id: string): Look | undefined {
  return MOCK_LOOKS.find((look) => look.id === id);
}

export type LookPiece = { id: string; name: string; kind: "tshirt" | "jacket" | "jeans" | "shoes" };

// Тестовые данные: из каких вещей состоит образ (пока одинаково для всех образов).
export const MOCK_LOOK_PIECES: LookPiece[] = [
  { id: "p1", name: "Белая футболка", kind: "tshirt" },
  { id: "p2", name: "Кожаная куртка", kind: "jacket" },
  { id: "p3", name: "Синие джинсы", kind: "jeans" },
  { id: "p4", name: "Белые кеды", kind: "shoes" },
];
