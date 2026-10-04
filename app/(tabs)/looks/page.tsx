import type { Metadata } from "next";
import LooksScreen from "@/components/looks/LooksScreen";

export const metadata: Metadata = { title: "Образы — MIRRO" };

export default function LooksPage() {
  return <LooksScreen />;
}
