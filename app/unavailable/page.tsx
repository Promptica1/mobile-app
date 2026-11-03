import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Нейтральная страница для закрытых регионов (см. lib/region.ts и lib/supabase/proxy.ts): без названий стран
// и платёжных систем. Не индексируется.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("unavailable");
  return { title: "MIRRO", description: t("subtitle"), robots: { index: false, follow: false } };
}

export default async function UnavailablePage() {
  const t = await getTranslations("unavailable");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <p className="font-serif text-xl font-semibold tracking-[0.35em] text-text">MIRRO</p>
      <h1 className="mt-6 font-serif text-[2.5rem] font-medium leading-[1.05] tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">{t("subtitle")}</p>
    </div>
  );
}
