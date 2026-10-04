import type { Metadata } from "next";
import Plans from "@/components/profile/Plans";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Подписка — Digital Wardrobe" };

export default function SubscriptionPage() {
  return (
    <SubScreen title="Подписка">
      <Plans />
    </SubScreen>
  );
}
