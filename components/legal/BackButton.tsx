"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

// Документ открывают из регистрации, профиля и тарифов — возвращаемся туда, откуда пришли.
export default function BackButton() {
  const router = useRouter();
  const t = useTranslations("common");
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/profile"))}
      aria-label={t("back")}
      className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-border/50"
    >
      <ArrowLeft size={22} strokeWidth={1.5} />
    </button>
  );
}
