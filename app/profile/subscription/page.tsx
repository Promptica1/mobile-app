import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Plans from "@/components/profile/Plans";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("subscription")} — MIRRO` };
}

export default async function SubscriptionPage() {
  const t = await getTranslations("pages");
  return (
    <SubScreen title={t("subscription")}>
      <Plans />
    </SubScreen>
  );
}
