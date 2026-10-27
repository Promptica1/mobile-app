import { NextResponse, type NextRequest } from "next/server";
import { emailConfigured, sendAnnualReminder, sendTrialEnding } from "@/lib/email.server";
import { createStore } from "@/lib/stripe/store.server";
import { ANNUAL_REMINDER_DAYS, creditsOnCycle, nextMonthlyGrant, TRIAL_REMINDER_HOURS } from "@/lib/stripe/rules";
import { createAdminClient } from "@/lib/supabase/admin";

// Ежедневные задачи Stripe-подписок (расписание — в vercel.json):
// 1. годовой план: Stripe списывает раз в год, а credits начисляем каждый месяц (баланс сбрасывается до 25);
// 2. письмо «триал скоро закончится» (за ~1,5 суток — для 5-дневного триала это 4-й день);
// 3. письмо «годовой план продлится через 7 дней».
// Вызывать может только Vercel Cron: заголовок Authorization: Bearer <CRON_SECRET>. Логи — "STRIPE[cron]:".

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOUR = 60 * 60 * 1000;

type Row = {
  user_id: string;
  stripe_subscription_id: string;
  status: string;
  offer: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  credits_next_grant_at: string | null;
  trial_email_sent_at: string | null;
  renewal_reminder_for: string | null;
};

const COLUMNS =
  "user_id, stripe_subscription_id, status, offer, current_period_end, trial_end, credits_next_grant_at, trial_email_sent_at, renewal_reminder_for";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.log("STRIPE[cron]: CRON_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const store = createStore(admin);
  const now = new Date();
  const result = { creditGrants: 0, trialEmails: 0, annualEmails: 0, errors: 0 };

  // 1. Месячные credits годового плана.
  const { data: due } = await admin
    .from("subscriptions")
    .select(COLUMNS)
    .eq("provider", "stripe")
    .eq("offer", "annual")
    .in("status", ["active", "canceled"])
    .lte("credits_next_grant_at", now.toISOString())
    .gt("current_period_end", now.toISOString())
    .returns<Row[]>();
  for (const sub of due ?? []) {
    try {
      let next = new Date(sub.credits_next_grant_at as string);
      const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
      const key = `annual:${sub.stripe_subscription_id}:${next.toISOString().slice(0, 10)}`;
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
      console.log(`STRIPE[cron]: credit grant failed for ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
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
        console.log(`STRIPE[cron]: trial email failed for ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Годовой план продлится через 7 дней (только если продление не отключено).
    const { data: annual } = await admin
      .from("subscriptions")
      .select(COLUMNS)
      .eq("provider", "stripe")
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
        if (await sendAnnualReminder(email, new Date(end))) {
          await admin.from("subscriptions").update({ renewal_reminder_for: end }).eq("user_id", sub.user_id);
          result.annualEmails++;
        }
      } catch (e) {
        result.errors++;
        console.log(`STRIPE[cron]: renewal reminder failed for ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  console.log(`STRIPE[cron]: ${JSON.stringify({ ...result, emailReady })}`);
  return NextResponse.json({ ...result, emailReady });
}
