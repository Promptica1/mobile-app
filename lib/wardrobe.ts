// Категории вещей — одни и те же для фильтров гардероба и формы добавления.
// В коде и в базе категория — это КЛЮЧ (language-independent); название берётся из переводов
// (messages/*.json → categories.<ключ>). Так категорию не нужно «переводить» при смене языка,
// а AI, если он будет определять категорию, возвращает ключ.
export const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "jumpsuit",
  "outerwear",
  "shoes",
  "headwear",
  "accessories",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Старые вещи в базе хранят русское название — читаем их как ключи (SQL-миграция не обязательна).
const LEGACY_RU: Record<string, Category> = {
  Верх: "top",
  Низ: "bottom",
  Платья: "dress",
  Комбинезоны: "jumpsuit",
  "Верхняя одежда": "outerwear",
  Обувь: "shoes",
  "Головной убор": "headwear",
  Аксессуары: "accessories",
};

// Ключ категории из любого значения (ключ, старое русское название); null — не распознано.
export function toCategory(value: unknown): Category | null {
  if (typeof value !== "string") return null;
  if ((CATEGORIES as readonly string[]).includes(value)) return value as Category;
  return LEGACY_RU[value] ?? null;
}

// Цвета и материалы — тоже ключи (названия — в messages/*.json: colors.<ключ>, materials.<ключ>).
// Старые вещи хранят русские названия — toColor/toMaterial приводят их к ключам;
// значение, которого нет в списке, остаётся как есть (показывается как написано).
export const COLOR_KEYS = ["black", "white", "beige", "gray", "blue", "brown"] as const;
export const MATERIAL_KEYS = ["leather", "cotton", "linen", "wool", "cashmere", "denim", "synthetic"] as const;
const LEGACY_COLORS: Record<string, string> = {
  Чёрный: "black",
  Белый: "white",
  Бежевый: "beige",
  Серый: "gray",
  Синий: "blue",
  Коричневый: "brown",
};
const LEGACY_MATERIALS: Record<string, string> = {
  Кожа: "leather",
  Хлопок: "cotton",
  Лён: "linen",
  Шерсть: "wool",
  Кашемир: "cashmere",
  Деним: "denim",
  Синтетика: "synthetic",
};
export const toColor = (value: string | null) => (value ? (LEGACY_COLORS[value] ?? value) : value);
export const toMaterial = (value: string | null) => (value ? (LEGACY_MATERIALS[value] ?? value) : value);

// Цельные вещи на всё тело: надеваются вместо отдельных верха и низа (одна за раз).
export const FULL_BODY_CATEGORIES: readonly string[] = ["dress", "jumpsuit"];
export const isFullBody = (category: string) => FULL_BODY_CATEGORIES.includes(category);
// Верх и низ, которые цельная вещь заменяет.
export const SEPARATES_CATEGORIES: readonly string[] = ["top", "bottom"];

// Порядок вещей в задании для примерки: основа образа → слои поверх → обувь и детали.
export const OUTFIT_ORDER: readonly string[] = [
  "dress",
  "jumpsuit",
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "headwear",
  "accessories",
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
  category: Category;
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

export const FILTERS = ["all", "favorites", ...CATEGORIES] as const;
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
  mock("1", "Льняная рубашка", "top", true),
  mock("2", "Прямые джинсы", "bottom", false),
  mock("3", "Кашемировый свитер", "top", false),
  mock("4", "Белые кеды", "shoes", true),
  mock("5", "Юбка миди", "bottom", false),
  mock("6", "Кожаная сумка", "accessories", true),
  mock("7", "Тренч", "outerwear", false),
  mock("8", "Лоферы", "shoes", false),
];


