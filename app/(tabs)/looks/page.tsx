import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LooksScreen from "@/components/looks/LooksScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("looks")} — MIRRO` };
}

export default function LooksPage() {
  return <LooksScreen />;
}
