import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import MyAvatar from "@/components/profile/MyAvatar";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("avatar")} — MIRRO` };
}

export default async function AvatarPage() {
  const t = await getTranslations("pages");
  return (
    <SubScreen title={t("avatar")}>
      <MyAvatar />
    </SubScreen>
  );
}
