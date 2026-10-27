import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Plans from "@/components/profile/Plans";
import StripePlans from "@/components/profile/StripePlans";
import SubScreen from "@/components/profile/SubScreen";
import { STRIPE_FREE_TRIAL } from "@/lib/features";
import { getPaymentProvider } from "@/lib/payment-provider.server";
import { emailHash } from "@/lib/stripe/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("subscription")} — MIRRO` };
}

// Можно ли этому человеку взять триал. Не удалось проверить — показываем триал: окончательно
// решает сервер при оплате (и по карте — после неё).
async function trialAvailable(): Promise<boolean> {
  if (!getSupabaseEnv()) return true;
  const admin = createAdminClient();
  if (!admin) return true;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user?.email) return true;
  const { data, error } = await admin.rpc("trial_available", { p_user: user.id, p_email_hash: emailHash(user.email) });
  return error ? true : data === true;
}

// Россия и Telegram — ЮKassa (рубли), остальные страны — Stripe (доллары). Переключателя нет.
export default async function SubscriptionPage() {
  const t = await getTranslations("pages");
  const provider = await getPaymentProvider();
  return (
    <SubScreen title={t("subscription")}>
      {provider === "stripe" ? <StripePlans trialAvailable={await trialAvailable()} freeTrial={STRIPE_FREE_TRIAL} /> : <Plans />}
    </SubScreen>
  );
}
