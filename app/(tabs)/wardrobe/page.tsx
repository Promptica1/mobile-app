import type { Metadata } from "next";
import WardrobeScreen from "@/components/wardrobe/WardrobeScreen";

export const metadata: Metadata = { title: "Гардероб — Digital Wardrobe" };

export default function WardrobePage() {
  return <WardrobeScreen />;
}
