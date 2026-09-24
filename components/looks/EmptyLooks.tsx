import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function EmptyLooks() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <span className="flex h-28 w-28 items-center justify-center rounded-full bg-lavender/20">
        <Sparkles size={40} strokeWidth={1.25} />
      </span>
      <h2 className="mt-8 font-serif text-3xl font-medium">Здесь будут ваши образы</h2>
      <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-muted">
        Соберите первый образ на аватаре и сохраните его сюда
      </p>
      <Link
        href="/try-on"
        className="mt-8 rounded-full bg-lime px-8 py-3.5 text-sm font-medium text-text transition-transform active:scale-[0.98]"
      >
        Создать образ
      </Link>
    </div>
  );
}
