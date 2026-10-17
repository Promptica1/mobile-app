import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getShop, yookassaMode, YooKassaError } from "@/lib/yookassa";

// Проверка подключения к ЮKassa (открыть в браузере, войдя в приложение):
// подходят ли ShopID и ключ друг к другу, какой это магазин и включены ли чеки.
// Секреты не показываются.
export async function GET() {
  if (!getSupabaseEnv()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const mode = yookassaMode();
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim() ?? "";
  const base = {
    shopIdSet: Boolean(shopId),
    shopIdLast4: shopId.slice(-4) || null,
    keyMode: process.env.YOOKASSA_SECRET_KEY?.trim().startsWith("live_") ? "live" : process.env.YOOKASSA_SECRET_KEY ? "test" : null,
    serviceRoleKeySet: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    appUrl: process.env.APP_URL ?? null,
  };
  if (!mode.available) return NextResponse.json({ ok: false, ...base, problem: mode.reason }, { headers: { "Cache-Control": "no-store" } });

  try {
    const shop = await getShop();
    return NextResponse.json(
      {
        ok: true,
        ...base,
        shop: {
          accountIdMatches: shop.account_id === shopId,
          test: shop.test,
          status: shop.status ?? null,
          receiptsEnabled: shop.fiscalization?.enabled ?? shop.fiscalization_enabled ?? null,
          paymentMethods: shop.payment_methods ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const details = e instanceof YooKassaError ? e.details : undefined;
    return NextResponse.json(
      { ok: false, ...base, problem: "yookassa_error", yookassa: details ?? { description: e instanceof Error ? e.message : String(e) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
