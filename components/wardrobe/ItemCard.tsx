import { Footprints, Gem, Heart, Layers, Shirt } from "lucide-react";
import type { Category, WardrobeItem } from "@/lib/wardrobe";

const placeholderIcon: Record<Category, typeof Shirt> = {
  Верх: Shirt,
  Низ: Layers,
  Обувь: Footprints,
  Аксессуары: Gem,
};

type Props = {
  item: WardrobeItem;
  onToggleFavorite: (id: string) => void;
};

export default function ItemCard({ item, onToggleFavorite }: Props) {
  const Icon = placeholderIcon[item.category];

  return (
    <article>
      <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface">
        {/* Заглушка вместо фото вещи */}
        <div className="absolute inset-3 flex items-center justify-center rounded-2xl bg-background">
          <Icon size={28} strokeWidth={1.25} className="text-muted" />
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(item.id)}
          aria-label={item.favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={item.favorite}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface/90 backdrop-blur-sm"
        >
          <Heart
            size={15}
            strokeWidth={1.75}
            className={item.favorite ? "fill-pink text-pink" : "text-muted"}
          />
        </button>
      </div>
      <h3 className="mt-2.5 truncate text-sm font-medium">{item.name}</h3>
      <p className="text-xs text-muted">{item.category}</p>
    </article>
  );
}
