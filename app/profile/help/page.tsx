import type { Metadata } from "next";
import { CircleHelp } from "lucide-react";
import SubScreen, { ComingSoon } from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Помощь и поддержка — Digital Wardrobe" };

export default function HelpPage() {
  return (
    <SubScreen title="Помощь">
      <ComingSoon
        icon={<CircleHelp size={36} strokeWidth={1.25} />}
        text="Здесь появятся ответы на частые вопросы и связь с поддержкой."
      />
    </SubScreen>
  );
}
