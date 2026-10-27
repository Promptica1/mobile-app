import { NextResponse, type NextRequest } from "next/server";
import { getStripe, stripeMode } from "@/lib/stripe/client.server";
import { json, stripeDeps } from "@/lib/stripe/context.server";
import { handleStripeEvent, type RawEvent } from "@/lib/stripe/webhook";

// Уведомления Stripe. Подпись проверяем секретом STRIPE_WEBHOOK_SECRET по «сырому» телу запроса.
// Ответ 2xx — Stripe больше не повторяет; ошибка (5xx) — повторит позже, обработка идемпотентна.
// Логи — "STRIPE:".

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const deps = stripeDeps();
  if (!secret || !deps || !stripeMode().available) {
    console.log("STRIPE: webhook not configured");
    return json({ error: "not_configured" }, 503);
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "no_signature" }, 400);

  let event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    console.log("STRIPE: webhook signature check failed");
    return json({ error: "bad_signature" }, 400);
  }

  try {
    const outcome = await handleStripeEvent(deps, event as unknown as RawEvent);
    console.log(`STRIPE: event ${event.type} (${event.id}) → ${outcome}`);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    console.log(`STRIPE: event ${event.type} (${event.id}) failed: ${error instanceof Error ? error.message : String(error)}`);
    return json({ error: "failed" }, 500);
  }
}
