import type { Metadata } from "next";
import Help from "@/components/profile/Help";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Помощь и поддержка — Digital Wardrobe" };

export default function HelpPage() {
  return (
    <SubScreen title="Помощь">
      <Help />
    </SubScreen>
  );
}
