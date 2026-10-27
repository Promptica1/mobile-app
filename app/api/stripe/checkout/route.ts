import type { NextRequest } from "next/server";
import { resolveLocale } from "@/i18n/request";
import { STRIPE_FREE_TRIAL } from "@/lib/features";
import { legalVersion } from "@/lib/legal.server";
import { getPaymentProvider } from "@/lib/payment-provider.server";
import { getStripe, stripeMode, stripePrices } from "@/lib/stripe/client.server";
import { appBase, currentUser, json } from "@/lib/stripe/context.server";
import { isOffer, isTrialOffer, OFFER_INFO, trialOffer, type Offer } from "@/lib/stripe/rules";
import { emailHash } from "@/lib/stripe/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Создаёт страницу оплаты Stripe Checkout (подписка + Stripe Tax) и возвращает ссылку на неё.
// Сумма и цены — только с сервера (Price из Stripe); браузер присылает лишь название предложения.
// Логи — "STRIPE:".

const fail = (reason: string, status: number) => {
  console.log(`STRIPE: checkout error = ${reason} (HTTP ${status})`);
  return json({ error: reason }, status);
};

// Что видит пользователь на странице оплаты рядом с кнопкой.
const SUBMIT_NOTE: Record<Offer, string> = {
  trial: "After the trial your subscription renews at $9.99/month. You can cancel at any time.",
  trial_free: "After the free trial your subscription renews at $9.99/month. You can cancel at any time.",
  annual: "Your subscription renews every year at $49.99. You can cancel at any time.",
  monthly: "Your subscription renews every month at $9.99. You can cancel at any time.",
};

export async function POST(request: NextRequest) {
  if (!getSupabaseEnv()) return fail("not_configured", 503);
  const user = await currentUser();
  if (!user) return fail("unauthorized", 401);
  if ((await getPaymentProvider()) !== "stripe") return fail("wrong_provider", 409);

  const body = (await request.json().catch(() => null)) as { offer?: unknown; consent?: unknown } | null;
  const offer = body?.offer;
  if (!isOffer(offer)) return fail("bad_offer", 400);
  // Предлагается один вид триала — тот, что включён флагом.
  if (isTrialOffer(offer) && offer !== trialOffer(STRIPE_FREE_TRIAL)) return fail("bad_offer", 400);
  if (body?.consent !== true) return fail("consent_required", 400);

  const admin = createAdminClient();
  const mode = stripeMode();
  if (!admin || !mode.available) return fail("not_configured", 503);
  if (!user.email) return fail("no_email", 400);

  // Уже есть действующая подписка (любого провайдера) — вторую не оформляем.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle<{ plan: string; status: string; current_period_end: string | null }>();
  if (sub && sub.plan !== "free" && sub.status !== "expired" && sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
    return fail("already_subscribed", 409);
  }

  // Один триал на человека: по аккаунту и почте (карту проверим после ввода, в webhook).
  if (isTrialOffer(offer)) {
    const { data: available, error } = await admin.rpc("trial_available", { p_user: user.id, p_email_hash: emailHash(user.email) });
    if (error) {
      console.log(`STRIPE: trial_available failed: ${error.message}`);
      return fail("trial_check_failed", 500);
    }
    if (available !== true) return fail("trial_used", 409);
  }

  const stripe = getStripe();
  const prices = stripePrices();
  const info = OFFER_INFO[offer];
  const base = appBase(request);

  const lineItems =
    offer === "trial"
      ? [
          { price: prices.trialSetup as string, quantity: 1 },
          { price: prices.monthly as string, quantity: 1 },
        ]
      : [{ price: (offer === "annual" ? prices.annual : prices.monthly) as string, quantity: 1 }];

  const createSession = async (customer: string) =>
    stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: lineItems,
      subscription_data: {
        ...(info.trialDays > 0 ? { trial_period_days: info.trialDays } : {}),
        metadata: { user_id: user.id, offer },
      },
      metadata: { user_id: user.id, offer },
      // Карта обязательна и для бесплатного триала (вариант B).
      payment_method_collection: "always",
      // Без экрана выбора способа: карта и Link. Apple Pay и Google Pay — часть «карты»: на подходящем
      // устройстве Stripe сам показывает кнопку кошелька сверху (оплата в одно касание), иначе — форма карты.
      // Кошельки включаются в Stripe Dashboard → Settings → Payment methods.
      allowed_payment_method_types: ["card", "link"],
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      custom_text: { submit: { message: SUBMIT_NOTE[offer] } },
      success_url: `${base}/profile/subscription/result?stripe_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/profile/subscription`,
    });

  const customerFor = async (create: boolean) => {
    if (!create) {
      const { data } = await admin.from("stripe_customers").select("customer_id").eq("user_id", user.id).maybeSingle<{ customer_id: string }>();
      if (data?.customer_id) return data.customer_id;
    }
    const customer = await stripe.customers.create({ email: user.email as string, metadata: { user_id: user.id } });
    await admin.from("stripe_customers").upsert({ user_id: user.id, customer_id: customer.id }, { onConflict: "user_id" });
    return customer.id;
  };

  try {
    let session;
    try {
      session = await createSession(await customerFor(false));
    } catch (e) {
      // Клиент из другого режима (тест → боевой) в Stripe не найден — создаём заново.
      if ((e as { code?: string }).code !== "resource_missing") throw e;
      session = await createSession(await customerFor(true));
    }
    if (!session.url) throw new Error("no session url");

    // Доказательство согласия с офертой и политикой.
    const locale = await resolveLocale();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;
    const { error: consentError } = await admin.from("legal_consents").insert(
      (["offer", "privacy"] as const).map((document) => ({
        user_id: user.id,
        document,
        version: legalVersion(document, locale),
        context: "payment",
        ip,
        user_agent: userAgent,
      })),
    );
    if (consentError) console.log(`LEGAL: consent insert failed: ${consentError.message}`);

    console.log(`STRIPE: checkout ${session.id} for user ${user.id}, offer = ${offer}, test = ${mode.test}`);
    return json({ url: session.url });
  } catch (error) {
    console.log(`STRIPE: checkout create failed: ${error instanceof Error ? error.message : String(error)}`);
    return fail("failed", 502);
  }
}

