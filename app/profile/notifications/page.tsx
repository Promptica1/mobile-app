import type { Metadata } from "next";
import { Bell } from "lucide-react";
import SubScreen, { ComingSoon } from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Уведомления — Digital Wardrobe" };

export default function NotificationsPage() {
  return (
    <SubScreen title="Уведомления">
      <ComingSoon
        icon={<Bell size={36} strokeWidth={1.25} />}
        text="Скоро здесь можно будет настроить напоминания и подборки образов."
      />
    </SubScreen>
  );
}
