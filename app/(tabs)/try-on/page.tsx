import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";

export const metadata: Metadata = { title: "Примерка — Digital Wardrobe" };

export default function TryOnPage() {
  return <PageTitle>Примерка</PageTitle>;
}
