import type { Metadata } from "next";
import LooksScreen from "@/components/looks/LooksScreen";

export const metadata: Metadata = { title: "Образы — Digital Wardrobe" };

export default function LooksPage() {
  return <LooksScreen />;
}
