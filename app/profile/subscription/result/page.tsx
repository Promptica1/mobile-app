import type { Metadata } from "next";
import PaymentResult from "@/components/profile/PaymentResult";
import SubScreen from "@/components/profile/SubScreen";

export const metadata: Metadata = { title: "Оплата — MIRRO" };

type Props = { searchParams: Promise<{ order?: string }> };

// Сюда ЮKassa возвращает пользователя после оплаты (?order=<наш номер заказа>).
export default async function PaymentResultPage({ searchParams }: Props) {
  const { order } = await searchParams;
  return (
    <SubScreen title="Оплата" backHref="/profile/subscription">
      <PaymentResult order={order ?? null} />
    </SubScreen>
  );
}
