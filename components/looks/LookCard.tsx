import Link from "next/link";
import { Heart } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import Photo from "@/components/ui/Photo";
import type { Look } from "@/lib/looks";

type Props = {
  look: Look;
  onToggleFavorite: (look: Look) => void;
};

export default function LookCard({ look, onToggleFavorite }: Props) {
  const placeholder = <Silhouette variant="filled" className="h-full w-full px-6 py-[12%] text-text/15" />;
  return (
    <article className="relative">
      {/* Вся карточка ведёт на страницу образа; сердечко лежит поверх ссылки */}
      <Link
        href={`/looks/${look.id}`}
        aria-label={`Открыть образ «${look.name}»`}
        className="absolute inset-0 z-[1] rounded-card"
      />
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-card border border-border bg-gradient-to-b from-beige to-[#e9dfd2]">
        {look.photo_url ? (
          <Photo src={look.photo_url} alt={look.name} fallback={placeholder} />
        ) : (
          placeholder
        )}
        <button
          type="button"
          onClick={() => onToggleFavorite(look)}
          aria-label={look.is_favorite ? "Убрать из избранного" : "В избранное"}
          aria-pressed={look.is_favorite}
          className="absolute right-2.5 top-2.5 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-surface/85 backdrop-blur-sm"
        >
          <Heart
            size={15}
            strokeWidth={1.75}
            className={look.is_favorite ? "fill-pink text-pink" : "text-muted"}
          />
        </button>
      </div>
      <h3 className="mt-2.5 truncate text-sm font-medium">{look.name}</h3>
    </article>
  );
}
