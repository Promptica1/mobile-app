import type { Metadata } from "next";
import LookDetail from "@/components/look-detail/LookDetail";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Образ — Digital Wardrobe" };

// Отдельный маршрут вне группы (tabs) — поэтому здесь нет нижней навигации.
// Образ загружается в браузере от имени пользователя (RLS — только свои).
export default async function LookPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <LookDetail id={id} />
    </div>
  );
}
