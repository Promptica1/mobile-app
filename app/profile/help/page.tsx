import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Help from "@/components/profile/Help";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("help")} — MIRRO` };
}

export default async function HelpPage() {
  const t = await getTranslations("pages");
  return (
    <SubScreen title={t("helpHeader")}>
      <Help />
    </SubScreen>
  );
}
