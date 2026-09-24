import Link from "next/link";
import Silhouette from "@/components/Silhouette";

export default function EmptyWardrobe() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      {/* Пунктирный силуэт человека */}
      <Silhouette variant="dashed" width={96} height={152} className="text-muted" />

      <h2 className="mt-8 font-serif text-3xl font-medium">Ваш гардероб пуст</h2>
      <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-muted">
        Добавьте первую вещь — сфотографируйте или загрузите фото
      </p>
      <Link
        href="/add-item"
        className="mt-8 rounded-full bg-lime px-8 py-3.5 text-sm font-medium text-text transition-transform active:scale-[0.98]"
      >
        Добавить вещь
      </Link>
    </div>
  );
}
