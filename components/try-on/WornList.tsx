import { ChevronDown, Shirt, X } from "lucide-react";
import Photo from "@/components/ui/Photo";
import { CATEGORY_ICONS } from "@/lib/tryOn";
import type { WardrobeItem } from "@/lib/wardrobe";

type Props = {
  items: WardrobeItem[];
  onRemove: (item: WardrobeItem) => void;
  onClose: () => void;
};

export default function WornList({ items, onRemove, onClose }: Props) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClose}
        className="flex items-center justify-between pb-3"
      >
        <span className="font-serif text-xl font-medium">Надето на вас</span>
        <ChevronDown size={20} strokeWidth={1.5} className="text-muted" />
      </button>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Пока ничего не выбрано</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const Icon = CATEGORY_ICONS[item.category] ?? Shirt;
            const icon = <Icon size={20} strokeWidth={1.25} className="text-muted" />;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background p-1 ring-1 ring-border">
                  {item.photo_url ? <Photo src={item.photo_url} alt="" fallback={icon} /> : icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block text-xs text-muted">{item.category}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={`Снять: ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-pink/15 text-pink transition-colors hover:bg-pink/25"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
