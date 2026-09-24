export type Category = "Верх" | "Низ" | "Обувь" | "Аксессуары";

export type WardrobeItem = {
  id: string;
  name: string;
  category: Category;
  favorite: boolean;
};

export const FILTERS = [
  "Все",
  "Избранное",
  "Верх",
  "Низ",
  "Обувь",
  "Аксессуары",
] as const;

export type Filter = (typeof FILTERS)[number];

/*
 * Тестовые данные, пока нет настоящего хранилища.
 * Чтобы увидеть ПУСТОЙ экран гардероба, замените массив на пустой:
 *   export const MOCK_ITEMS: WardrobeItem[] = [];
 */
export const MOCK_ITEMS: WardrobeItem[] = [
  { id: "1", name: "Льняная рубашка", category: "Верх", favorite: true },
  { id: "2", name: "Прямые джинсы", category: "Низ", favorite: false },
  { id: "3", name: "Кашемировый свитер", category: "Верх", favorite: false },
  { id: "4", name: "Белые кеды", category: "Обувь", favorite: true },
  { id: "5", name: "Юбка миди", category: "Низ", favorite: false },
  { id: "6", name: "Кожаная сумка", category: "Аксессуары", favorite: true },
  { id: "7", name: "Тренч", category: "Верх", favorite: false },
  { id: "8", name: "Лоферы", category: "Обувь", favorite: false },
];

// 1 вещь, 2 вещи, 5 вещей, 21 вещь…
export function formatItemCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "вещей";
  if (mod10 === 1 && mod100 !== 11) word = "вещь";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    word = "вещи";
  return `${n} ${word}`;
}
