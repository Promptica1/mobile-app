import { Footprints, Gem, Layers, Shirt, type LucideIcon } from "lucide-react";

export const TRY_ON_FILTERS = [
  "Избранное",
  "Верх",
  "Низ",
  "Верхняя",
  "Обувь",
  "Аксессуары",
] as const;
export type TryOnFilter = (typeof TRY_ON_FILTERS)[number];

// Иконка-заглушка вместо фото вещи для каждой категории.
export const FILTER_ICONS: Record<TryOnFilter, LucideIcon> = {
  Избранное: Shirt,
  Верх: Shirt,
  Низ: Layers,
  Верхняя: Shirt,
  Обувь: Footprints,
  Аксессуары: Gem,
};

export type TryOnItem = { id: string; name: string };

// Тестовые данные: вещи в ленте каждой категории.
export const MOCK_THUMBNAILS: Record<TryOnFilter, TryOnItem[]> = {
  Избранное: [
    { id: "f1", name: "Льняная рубашка" },
    { id: "f2", name: "Белые кеды" },
    { id: "f3", name: "Кожаная сумка" },
  ],
  Верх: [
    { id: "t1", name: "Белая футболка" },
    { id: "t2", name: "Льняная рубашка" },
    { id: "t3", name: "Кашемировый свитер" },
    { id: "t4", name: "Шёлковая блузка" },
    { id: "t5", name: "Полосатый лонгслив" },
    { id: "t6", name: "Чёрная водолазка" },
  ],
  Низ: [
    { id: "b1", name: "Синие джинсы" },
    { id: "b2", name: "Юбка миди" },
    { id: "b3", name: "Льняные брюки" },
    { id: "b4", name: "Чёрные шорты" },
  ],
  Верхняя: [
    { id: "o1", name: "Кожаная куртка" },
    { id: "o2", name: "Тренч" },
    { id: "o3", name: "Шерстяное пальто" },
  ],
  Обувь: [
    { id: "s1", name: "Белые кеды" },
    { id: "s2", name: "Лоферы" },
    { id: "s3", name: "Кожаные ботинки" },
  ],
  Аксессуары: [
    { id: "a1", name: "Кожаная сумка" },
    { id: "a2", name: "Шёлковый платок" },
    { id: "a3", name: "Солнцезащитные очки" },
    { id: "a4", name: "Кожаный ремень" },
  ],
};

export type WornItem = { id: string; name: string; category: string };

// Тестовые данные: что сейчас «надето» на аватар.
export const MOCK_WORN: WornItem[] = [
  { id: "w1", name: "Кожаная куртка", category: "Верхняя одежда" },
  { id: "w2", name: "Белая футболка", category: "Верх" },
  { id: "w3", name: "Синие джинсы", category: "Низ" },
];
