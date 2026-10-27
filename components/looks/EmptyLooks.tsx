import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export default function EmptyLooks() {
  const t = useTranslations("looks");
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <span className="flex h-28 w-28 items-center justify-center rounded-full bg-lavender/20">
        <Sparkles size={40} strokeWidth={1.25} />
      </span>
      <h2 className="mt-8 font-serif text-3xl font-medium">{t("emptyTitle")}</h2>
      <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-muted">
        {t("emptyText")}
      </p>
      <Link
        href="/try-on"
        className="mt-8 rounded-full bg-lime px-8 py-3.5 text-sm font-medium text-text transition-transform active:scale-[0.98]"
      >
        {t("create")}
      </Link>
    </div>
  );
}
