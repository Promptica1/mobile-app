import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PaymentResult from "@/components/profile/PaymentResult";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("pay")} — MIRRO` };
}

type Props = { searchParams: Promise<{ order?: string }> };

// Сюда ЮKassa возвращает пользователя после оплаты (?order=<наш номер заказа>).
export default async function PaymentResultPage({ searchParams }: Props) {
  const { order } = await searchParams;
  const t = await getTranslations("pages");
  return (
    <SubScreen title={t("pay")} backHref="/profile/subscription">
      <PaymentResult order={order ?? null} />
    </SubScreen>
  );
}
