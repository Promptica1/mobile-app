import "server-only";
import { cookies, headers } from "next/headers";
import { resolveProvider, TELEGRAM_COOKIE, type Provider } from "./payment-provider";

// Провайдер для текущего запроса: страна по IP (заголовок Vercel) + пометка «мы в Telegram».
export async function getPaymentProvider(): Promise<Provider> {
  const country = (await headers()).get("x-vercel-ip-country");
  const telegram = (await cookies()).get(TELEGRAM_COOKIE)?.value === "1";
  return resolveProvider({ country, telegram });
}
