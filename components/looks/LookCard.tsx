import { Heart } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import type { Look } from "@/lib/looks";

type Props = {
  look: Look;
  onToggleFavorite: (id: string) => void;
};

export default function LookCard({ look, onToggleFavorite }: Props) {
  return (
    <article>
      <div className="relative flex aspect-[3/4.2] items-center justify-center overflow-hidden rounded-card bg-gradient-to-b from-beige to-[#e9dfd2] px-6 py-[12%]">
        {/* Заглушка: аватар в образе */}
        <Silhouette variant="filled" className="h-full w-full text-text/15" />
        <button
          type="button"
          onClick={() => onToggleFavorite(look.id)}
          aria-label={look.favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={look.favorite}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface/85 backdrop-blur-sm"
        >
          <Heart
            size={15}
            strokeWidth={1.75}
            className={look.favorite ? "fill-pink text-pink" : "text-muted"}
          />
        </button>
      </div>
      <h3 className="mt-2.5 truncate text-sm font-medium">{look.name}</h3>
    </article>
  );
}
