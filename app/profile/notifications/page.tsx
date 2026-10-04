import type { Metadata } from "next";
import NotificationSettings from "@/components/profile/NotificationSettings";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Уведомления — Digital Wardrobe" };

export default function NotificationsPage() {
  return (
    <SubScreen title="Уведомления">
      <NotificationSettings />
    </SubScreen>
  );
}
