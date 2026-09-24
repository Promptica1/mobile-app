import { Footprints, Layers, Shirt, type LucideIcon } from "lucide-react";

export const TRY_ON_FILTERS = ["Верх", "Низ", "Обувь", "Верхняя"] as const;
export type TryOnFilter = (typeof TRY_ON_FILTERS)[number];

// Иконка-заглушка вместо фото вещи для каждой категории.
export const FILTER_ICONS: Record<TryOnFilter, LucideIcon> = {
  Верх: Shirt,
  Низ: Layers,
  Обувь: Footprints,
  Верхняя: Shirt,
};

// Тестовые данные: сколько вещей показывать в ленте каждой категории.
export const MOCK_THUMBNAILS: Record<TryOnFilter, string[]> = {
  Верх: ["t1", "t2", "t3", "t4", "t5", "t6"],
  Низ: ["b1", "b2", "b3", "b4"],
  Обувь: ["s1", "s2", "s3"],
  Верхняя: ["o1", "o2", "o3"],
};

export type WornItem = { id: string; name: string; category: string };

// Тестовые данные: что сейчас «надето» на аватар.
export const MOCK_WORN: WornItem[] = [
  { id: "w1", name: "Кожаная куртка", category: "Верхняя одежда" },
  { id: "w2", name: "Белая футболка", category: "Верх" },
  { id: "w3", name: "Синие джинсы", category: "Низ" },
];
