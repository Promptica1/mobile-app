import type { Metadata } from "next";
import TryOnScreen from "@/components/try-on/TryOnScreen";

export const metadata: Metadata = { title: "Примерка — Digital Wardrobe" };

export default function TryOnPage() {
  return <TryOnScreen />;
}
