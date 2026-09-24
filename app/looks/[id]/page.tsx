import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LookDetail from "@/components/look-detail/LookDetail";
import { MOCK_LOOKS, getLook } from "@/lib/looks";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return MOCK_LOOKS.map((look) => ({ id: look.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const look = getLook((await params).id);
  return { title: `${look?.name ?? "Образ"} — Digital Wardrobe` };
}

// Отдельный маршрут вне группы (tabs) — поэтому здесь нет нижней навигации.
export default async function LookPage({ params }: Props) {
  const look = getLook((await params).id);
  if (!look) notFound();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <LookDetail look={look} />
    </div>
  );
}
