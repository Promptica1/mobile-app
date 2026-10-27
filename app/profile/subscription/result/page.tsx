import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PaymentResult from "@/components/profile/PaymentResult";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("pay")} — MIRRO` };
}

type Props = { searchParams: Promise<{ order?: string; stripe_session?: string }> };

// Сюда возвращают пользователя после оплаты: ЮKassa — ?order=<наш номер заказа>, Stripe — ?stripe_session=<сессия>.
export default async function PaymentResultPage({ searchParams }: Props) {
  const { order, stripe_session: stripeSession } = await searchParams;
  const t = await getTranslations("pages");
  return (
    <SubScreen title={t("pay")} backHref="/profile/subscription">
      <PaymentResult order={order ?? null} stripeSession={stripeSession ?? null} />
    </SubScreen>
  );
}
