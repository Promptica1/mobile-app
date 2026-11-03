import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Plans from "@/components/profile/Plans";
import StripePlans from "@/components/profile/StripePlans";
import SubScreen from "@/components/profile/SubScreen";
import { STRIPE_FREE_TRIAL } from "@/lib/features";
import { getPaymentProvider } from "@/lib/payment-provider.server";
import { isTrialAvailable } from "@/lib/trial.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("subscription")} — MIRRO` };
}

// Триал только тому, у кого никогда не было ни оплаты (любого тарифа), ни триала: аккаунт и нормализованная
// почта (карту проверяет сервер после ввода). Нет проверки (демо без базы) — триал не показываем.
async function trialAvailable(): Promise<boolean> {
  if (!getSupabaseEnv()) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return false;
  return isTrialAvailable(admin, user);
}

// Россия и Telegram — ЮKassa (рубли), остальные страны — Stripe (доллары). Переключателя нет.
export default async function SubscriptionPage() {
  const t = await getTranslations("pages");
  const provider = await getPaymentProvider();
  const trial = await trialAvailable();
  return (
    <SubScreen title={t("subscription")}>
      {provider === "stripe" ? <StripePlans trialAvailable={trial} freeTrial={STRIPE_FREE_TRIAL} /> : <Plans trialAvailable={trial} />}
    </SubScreen>
  );
}
