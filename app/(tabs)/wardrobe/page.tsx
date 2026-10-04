import type { Metadata } from "next";
import WardrobeScreen from "@/components/wardrobe/WardrobeScreen";

export const metadata: Metadata = { title: "Гардероб — MIRRO" };

export default function WardrobePage() {
  return <WardrobeScreen />;
}
