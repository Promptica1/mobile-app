import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import WardrobeScreen from "@/components/wardrobe/WardrobeScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("wardrobe")} — MIRRO` };
}

export default function WardrobePage() {
  return <WardrobeScreen />;
}
