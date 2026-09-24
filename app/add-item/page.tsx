import type { Metadata } from "next";
import AddItemFlow from "@/components/add-item/AddItemFlow";

export const metadata: Metadata = { title: "Добавить вещь — Digital Wardrobe" };

// Отдельный маршрут вне группы (tabs) — поэтому здесь нет нижней навигации.
export default function AddItemPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <AddItemFlow />
    </div>
  );
}
