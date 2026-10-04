import type { Metadata } from "next";
import MyAvatar from "@/components/profile/MyAvatar";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Мой аватар — MIRRO" };

export default function AvatarPage() {
  return (
    <SubScreen title="Мой аватар">
      <MyAvatar />
    </SubScreen>
  );
}
