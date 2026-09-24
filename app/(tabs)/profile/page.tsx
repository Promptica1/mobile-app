import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";

export const metadata: Metadata = { title: "Профиль — Digital Wardrobe" };

export default function ProfilePage() {
  return <PageTitle>Профиль</PageTitle>;
}
