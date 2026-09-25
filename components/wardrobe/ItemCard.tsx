import { Footprints, Gem, Heart, Layers, Shirt, type LucideIcon } from "lucide-react";
import Photo from "@/components/ui/Photo";
import type { WardrobeItem } from "@/lib/wardrobe";

// Иконка-заглушка, пока у вещей нет фото.
const placeholderIcon: Record<string, LucideIcon> = {
  Верх: Shirt,
  Низ: Layers,
  "Верхняя одежда": Shirt,
  Обувь: Footprints,
  Аксессуары: Gem,
};

type Props = {
  item: WardrobeItem;
  onToggleFavorite: (item: WardrobeItem) => void;
};

export default function ItemCard({ item, onToggleFavorite }: Props) {
  const Icon = placeholderIcon[item.category] ?? Shirt;
  const placeholder = (
    <div className="absolute inset-3 flex items-center justify-center rounded-2xl bg-background">
      <Icon size={28} strokeWidth={1.25} className="text-muted" />
    </div>
  );

  return (
    <article>
      <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface">
        {/* Фото вещи; у вещей без фото (и если ссылка не открылась) — заглушка */}
        {item.photo_url ? (
          <div className="absolute inset-2">
            <Photo src={item.photo_url} alt={item.name} fallback={placeholder} />
          </div>
        ) : (
          placeholder
        )}
        <button
          type="button"
          onClick={() => onToggleFavorite(item)}
          aria-label={item.is_favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={item.is_favorite}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface/90 backdrop-blur-sm"
        >
          <Heart
            size={15}
            strokeWidth={1.75}
            className={item.is_favorite ? "fill-pink text-pink" : "text-muted"}
          />
        </button>
      </div>
      <h3 className="mt-2.5 truncate text-sm font-medium">{item.name}</h3>
      <p className="text-xs text-muted">{item.category}</p>
    </article>
  );
}

// Мягкая «заготовка» карточки, пока вещи загружаются.
export function ItemCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="aspect-square rounded-card border border-border bg-surface" />
      <div className="mt-2.5 h-3.5 w-3/4 rounded-full bg-border/70" />
      <div className="mt-2 h-3 w-1/3 rounded-full bg-border/50" />
    </div>
  );
}
