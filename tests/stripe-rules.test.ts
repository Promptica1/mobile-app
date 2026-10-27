import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveProvider, currencyOf } from "../lib/payment-provider.ts";
import {
  addMonths,
  creditsOnCheckout,
  creditsOnCycle,
  mapStatus,
  nextMonthlyGrant,
  normalizeEmail,
  OFFER_INFO,
  trialOffer,
} from "../lib/stripe/rules.ts";
import { purchaseMail, trialEndingMail, annualReminderMail } from "../lib/email/templates.ts";

test("credits: что начисляется при оформлении и при продлении", () => {
  assert.equal(creditsOnCheckout("trial"), 15);
  assert.equal(creditsOnCheckout("trial_free"), 5);
  assert.equal(creditsOnCheckout("annual"), 25);
  assert.equal(creditsOnCheckout("monthly"), 30);
  // Триал → Premium: после первой оплаты $9,99 баланс становится 30 в месяц.
  assert.equal(creditsOnCycle("trial"), 30);
  assert.equal(creditsOnCycle("trial_free"), 30);
  assert.equal(creditsOnCycle("monthly"), 30);
  assert.equal(creditsOnCycle("annual"), 25);
});

test("тарифы: цены и сроки", () => {
  assert.equal(OFFER_INFO.trial.setupUsd, 4.99);
  assert.equal(OFFER_INFO.trial.trialDays, 5);
  assert.equal(OFFER_INFO.trial.recurringUsd, 9.99);
  assert.equal(OFFER_INFO.trial_free.setupUsd, 0);
  assert.equal(OFFER_INFO.trial_free.trialDays, 3);
  assert.equal(OFFER_INFO.annual.recurringUsd, 49.99);
  assert.equal(OFFER_INFO.annual.interval, "year");
  assert.equal(trialOffer(false), "trial");
  assert.equal(trialOffer(true), "trial_free");
});

test("годовой план: месячные пакеты credits идут по датам до конца года", () => {
  const start = new Date("2026-01-31T10:00:00Z");
  const end = new Date("2027-01-31T10:00:00Z");
  const dates: Date[] = [];
  let next = nextMonthlyGrant("annual", start, end);
  while (next) {
    dates.push(next);
    next = nextMonthlyGrant("annual", next, end);
  }
  // 11 пакетов после первого (при оплате), последний — за месяц до продления.
  assert.equal(dates.length, 11);
  assert.equal(dates[0].toISOString(), "2026-02-28T10:00:00.000Z"); // 31 января + месяц = конец февраля
  assert.ok(dates.at(-1)! < end);
  // Не годовой план — месячных пакетов нет.
  assert.equal(nextMonthlyGrant("monthly", start, end), null);
  assert.equal(nextMonthlyGrant("trial", start, end), null);
});

test("addMonths не перескакивает через конец месяца", () => {
  assert.equal(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(addMonths(new Date("2026-12-15T00:00:00Z"), 1).toISOString(), "2027-01-15T00:00:00.000Z");
});

test("почта для проверки триала приводится к одному виду", () => {
  assert.equal(normalizeEmail("  Anna@Example.COM "), "anna@example.com");
  assert.equal(normalizeEmail("anna+trial2@example.com"), "anna@example.com");
  assert.equal(normalizeEmail("a.n.n.a@gmail.com"), "anna@gmail.com");
  assert.equal(normalizeEmail("a.nna+x@googlemail.com"), "anna@gmail.com");
  // Точки в других почтовых сервисах значимы.
  assert.equal(normalizeEmail("a.nna@example.com"), "a.nna@example.com");
});

test("статусы Stripe → наши", () => {
  assert.equal(mapStatus("trialing", false), "active");
  assert.equal(mapStatus("active", false), "active");
  assert.equal(mapStatus("active", true), "canceled"); // отмена продления: доступ до конца периода
  assert.equal(mapStatus("trialing", true), "canceled");
  assert.equal(mapStatus("past_due", false), "past_due");
  assert.equal(mapStatus("canceled", false), "expired");
  assert.equal(mapStatus("unpaid", false), "expired");
  assert.equal(mapStatus("incomplete", false), null);
});

test("провайдер оплаты: Россия, Беларусь и Telegram — ЮKassa, остальные — Stripe", () => {
  assert.equal(resolveProvider({ country: "RU" }), "yookassa");
  assert.equal(resolveProvider({ country: "ru" }), "yookassa");
  assert.equal(resolveProvider({ country: "BY" }), "yookassa"); // Беларусь — вместе с Россией
  assert.equal(resolveProvider({ country: "by" }), "yookassa");
  assert.equal(resolveProvider({ country: "KZ" }), "stripe");
  assert.equal(resolveProvider({ country: "UA" }), "stripe");
  assert.equal(resolveProvider({ country: "US" }), "stripe");
  assert.equal(resolveProvider({ country: "DE" }), "stripe");
  assert.equal(resolveProvider({ country: "US", telegram: true }), "yookassa"); // бот всегда ЮKassa
  assert.equal(resolveProvider({ country: null }), "yookassa"); // страна неизвестна — как раньше
  assert.equal(resolveProvider({}), "yookassa");
  assert.equal(currencyOf("stripe"), "USD");
  assert.equal(currencyOf("yookassa"), "RUB");
});

test("письма на английском и с нужными суммами", () => {
  const url = "https://example.com/manage";
  const trial = purchaseMail({ offer: "trial", periodEnd: null, trialEnd: new Date("2026-11-05T10:00:00Z") }, url);
  assert.match(trial.subject, /trial/i);
  assert.match(trial.text, /\$4\.99/);
  assert.match(trial.text, /\$9\.99\/month/);
  assert.match(trial.text, /November 5, 2026/);
  assert.ok(trial.html.includes(url));
  assert.doesNotMatch(trial.text + trial.html, /[А-Яа-я]/);
  assert.match(purchaseMail({ offer: "annual", periodEnd: new Date("2027-10-27T00:00:00Z"), trialEnd: null }, url).text, /\$49\.99\/year/);
  assert.match(trialEndingMail({ trialEnd: new Date("2026-11-05T10:00:00Z") }, url).text, /\$9\.99\/month/);
  assert.match(annualReminderMail({ renewsOn: new Date("2027-10-27T00:00:00Z") }, url).subject, /7 days/);
});
