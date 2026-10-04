import type { Metadata } from "next";
import ManageSubscription from "@/components/profile/ManageSubscription";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Управление подпиской — MIRRO" };

export default function ManageSubscriptionPage() {
  return (
    <SubScreen title="Моя подписка" backHref="/profile/subscription">
      <ManageSubscription />
    </SubScreen>
  );
}
