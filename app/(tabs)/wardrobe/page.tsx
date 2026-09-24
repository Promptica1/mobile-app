import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";

export const metadata: Metadata = { title: "Гардероб — Digital Wardrobe" };

export default function WardrobePage() {
  return <PageTitle>Гардероб</PageTitle>;
}
