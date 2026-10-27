import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ItemDetail from "@/components/item-detail/ItemDetail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("item")} — MIRRO` };
}

// Отдельный маршрут вне группы (tabs) — поэтому здесь нет нижней навигации.
// Вещь загружается в браузере от имени пользователя (RLS — только свои).
export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <ItemDetail id={id} />
    </div>
  );
}
