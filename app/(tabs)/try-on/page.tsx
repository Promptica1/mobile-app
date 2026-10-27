import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import TryOnScreen from "@/components/try-on/TryOnScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("tryOn")} — MIRRO` };
}
// Примерка — единственный экран на чисто белом фоне (как у аватаров).
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function TryOnPage() {
  return <TryOnScreen />;
}
