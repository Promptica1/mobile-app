import { NextResponse, type NextRequest } from "next/server";
import { emailConfigured, sendAnnualReminder, sendTrialEnding } from "@/lib/email.server";
import { formatPrice, RU_ANNUAL } from "@/lib/plans";
import { createStore } from "@/lib/stripe/store.server";
import { ANNUAL_REMINDER_DAYS, creditsOnCycle, nextMonthlyGrant, OFFER_INFO, TRIAL_REMINDER_HOURS } from "@/lib/stripe/rules";
import { createAdminClient } from "@/lib/supabase/admin";

// Ежедневные задачи подписок (расписание — в vercel.json), для Stripe и годового плана ЮKassa:
// 1. годовой план: платёж раз в год, а credits начисляем каждый месяц (баланс сбрасывается до 60);
// 2. письмо «триал скоро закончится» (за ~1,5 суток; только Stripe);
// 3. письмо «годовой план продлится через 7 дней» (Stripe — в долларах, ЮKassa — в рублях; язык по профилю);
// 4. хранение: удаляются записи о триале (хэш почты, отпечаток карты) удалённых аккаунтов старше 12 месяцев —
//    как написано в политике. Записи действующих аккаунтов не трогаются.
// Вызывать может только Vercel Cron: заголовок Authorization: Bearer <CRON_SECRET>. Логи — "SUBS[cron]:".

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOUR = 60 * 60 * 1000;

type Row = {
  user_id: string;
  stripe_subscription_id: string | null;
  provider: string | null;
  status: string;
  offer: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  credits_next_grant_at: string | null;
  trial_email_sent_at: string | null;
  renewal_reminder_for: string | null;
};

// Язык профиля (profiles.locale, появляется после SQL языков); нет колонки — null.
async function profileLocale(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("locale").eq("id", userId).maybeSingle<{ locale: string | null }>();
  return data?.locale ?? null;
}

const COLUMNS =
  "user_id, stripe_subscription_id, provider, status, offer, current_period_end, trial_end, credits_next_grant_at, trial_email_sent_at, renewal_reminder_for";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("SUBS[cron]: CRON_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const store = createStore(admin);
  const now = new Date();
  const result = { creditGrants: 0, trialEmails: 0, annualEmails: 0, trialClaimsPurged: 0, errors: 0 };

  // 1. Месячные credits годового плана.
  const { data: due } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .eq("offer", "annual")
    .in("status", ["active", "canceled"])
    .lte("credits_next_grant_at", now.toISOString())
    .gt("current_period_end", now.toISOString())
    .returns<Row[]>();
  for (const sub of due ?? []) {
    try {
      let next = new Date(sub.credits_next_grant_at as string);
      const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
      const key = `annual:${sub.stripe_subscription_id ?? sub.user_id}:${next.toISOString().slice(0, 10)}`;
      if (await store.grantCredits(key, sub.user_id, "cron", creditsOnCycle("annual"))) result.creditGrants++;
      // Следующий пакет — на ближайшую будущую дату (пропущенные месяцы не накапливаем).
      let following = nextMonthlyGrant("annual", next, end);
      while (following && following <= now) {
        next = following;
        following = nextMonthlyGrant("annual", next, end);
      }
      await admin
        .from("subscriptions")
        .update({ credits_next_grant_at: following?.toISOString() ?? null })
        .eq("user_id", sub.user_id);
    } catch (e) {
      result.errors++;
      console.log(`SUBS[cron]: credit grant failed for ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const emailReady = emailConfigured();

  // 2. Триал скоро закончится.
  if (emailReady) {
    const { data: trials } = await admin
      .from("subscriptions")
      .select(COLUMNS)
      .eq("provider", "stripe")
      .eq("is_trial", true)
      .eq("status", "active")
      .is("trial_email_sent_at", null)
      .gt("trial_end", now.toISOString())
      .lte("trial_end", new Date(now.getTime() + TRIAL_REMINDER_HOURS * HOUR).toISOString())
      .returns<Row[]>();
    for (const sub of trials ?? []) {
      try {
        const email = await store.userEmail(sub.user_id);
        if (!email || !sub.trial_end) continue;
        if (await sendTrialEnding(email, new Date(sub.trial_end))) {
          await admin.from("subscriptions").update({ trial_email_sent_at: now.toISOString() }).eq("user_id", sub.user_id);
          result.trialEmails++;
        }
      } catch (e) {
        result.errors++;
        console.log(`SUBS[cron]: trial email failed for ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Годовой план продлится через 7 дней (только если продление не отключено).
    const { data: annual } = await admin
      .from("subscriptions")
      .select(COLUMNS)
      .eq("offer", "annual")
      .eq("status", "active")
      .gt("current_period_end", now.toISOString())
      .lte("current_period_end", new Date(now.getTime() + ANNUAL_REMINDER_DAYS * 24 * HOUR).toISOString())
      .returns<Row[]>();
    for (const sub of annual ?? []) {
      try {
        const end = sub.current_period_end;
        if (!end || (sub.renewal_reminder_for && new Date(sub.renewal_reminder_for).getTime() === new Date(end).getTime())) continue;
        const email = await store.userEmail(sub.user_id);
        if (!email) continue;
        // Сумма и язык письма: Stripe — доллары (английский по умолчанию), ЮKassa — рубли (русский по умолчанию);
        // если человек выбрал язык в профиле, пишем на нём.
        const stripe = sub.provider === "stripe";
        const locale = (await profileLocale(admin, sub.user_id)) ?? (stripe ? "en" : "ru");
        const price = stripe ? `$${OFFER_INFO.annual.recurringUsd}` : formatPrice(RU_ANNUAL.price, locale === "ru" ? "ru" : "en");
        if (await sendAnnualReminder(email, new Date(end), { price, locale: locale === "ru" ? "ru" : "en" })) {
          await admin.from("subscriptions").update({ renewal_reminder_for: end }).eq("user_id", sub.user_id);
          result.annualEmails++;
        }
      } catch (e) {
        result.errors++;
        console.log(`SUBS[cron]: renewal reminder failed for ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 4. Срок хранения записей о триале (SQL purge_trial_claims, см. миграцию 20261105120000).
  const { data: purged, error: purgeError } = await admin.rpc("purge_trial_claims");
  if (purgeError) console.log(`SUBS[cron]: purge_trial_claims failed (${purgeError.message})`);
  else result.trialClaimsPurged = typeof purged === "number" ? purged : 0;

  console.log(`SUBS[cron]: ${JSON.stringify({ ...result, emailReady })}`);
  return NextResponse.json({ ...result, emailReady });
}
