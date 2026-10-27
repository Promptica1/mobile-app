import { NextResponse } from "next/server";
import { currencyOf } from "@/lib/payment-provider";
import { getPaymentProvider } from "@/lib/payment-provider.server";
import { stripeMode } from "@/lib/stripe/client.server";
import { yookassaMode } from "@/lib/yookassa";

// Можно ли сейчас оплатить (ключи заданы), тестовый ли режим и какой провайдер у этого пользователя:
// Россия, Беларусь и Telegram — ЮKassa (RUB), остальные — Stripe (USD). Секретов не раскрывает.
// reason — почему оплата недоступна (для проверки настроек): not_configured / bad_key / no_service_key / no_prices.
export async function GET() {
  const provider = await getPaymentProvider();
  const mode = provider === "stripe" ? stripeMode() : yookassaMode();
  const serviceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const available = mode.available && serviceKey;
  const reason = "reason" in mode ? mode.reason : serviceKey ? undefined : "no_service_key";
  return NextResponse.json(
    { available, test: mode.test, reason, provider, currency: currencyOf(provider) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
