import type { Metadata, Viewport } from "next";
import TryOnScreen from "@/components/try-on/TryOnScreen";

export const metadata: Metadata = { title: "Примерка — MIRRO" };
// Примерка — единственный экран на чисто белом фоне (как у аватаров).
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function TryOnPage() {
  return <TryOnScreen />;
}
