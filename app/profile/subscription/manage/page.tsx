import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ManageSubscription from "@/components/profile/ManageSubscription";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("manage")} — MIRRO` };
}

export default async function ManageSubscriptionPage() {
  const t = await getTranslations("pages");
  return (
    <SubScreen title={t("manageHeader")} backHref="/profile/subscription">
      <ManageSubscription />
    </SubScreen>
  );
}
