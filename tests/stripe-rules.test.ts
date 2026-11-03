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
  assert.equal(creditsOnCheckout("annual"), 60);
  assert.equal(creditsOnCheckout("monthly"), 60);
  // Триал → Premium: после первой оплаты $12,99 баланс становится 60 в месяц (не накапливается).
  assert.equal(creditsOnCycle("trial"), 60);
  assert.equal(creditsOnCycle("trial_free"), 60);
  assert.equal(creditsOnCycle("monthly"), 60);
  assert.equal(creditsOnCycle("annual"), 60);
});

test("тарифы: цены и сроки", () => {
  assert.equal(OFFER_INFO.trial.setupUsd, 3.99);
  assert.equal(OFFER_INFO.trial.trialDays, 7);
  assert.equal(OFFER_INFO.trial.recurringUsd, 12.99);
  assert.equal(OFFER_INFO.trial.startCredits, 15);
  assert.equal(OFFER_INFO.monthly.recurringUsd, 12.99);
  assert.equal(OFFER_INFO.monthly.startCredits, 60);
  assert.equal(OFFER_INFO.trial_free.setupUsd, 0);
  assert.equal(OFFER_INFO.trial_free.trialDays, 3);
  assert.equal(OFFER_INFO.annual.recurringUsd, 99);
  assert.equal(OFFER_INFO.trial_free.trialDays, 3); // вариант B не менялся
  assert.equal(OFFER_INFO.trial_free.startCredits, 5);
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

test("провайдер оплаты (RU_ENABLED включён): Россия, Беларусь и Telegram — ЮKassa, остальные — Stripe", () => {
  assert.equal(resolveProvider({ country: "RU" }, true), "yookassa");
  assert.equal(resolveProvider({ country: "ru" }, true), "yookassa");
  assert.equal(resolveProvider({ country: "BY" }, true), "yookassa"); // Беларусь — вместе с Россией
  assert.equal(resolveProvider({ country: "by" }, true), "yookassa");
  assert.equal(resolveProvider({ country: "KZ" }, true), "stripe");
  assert.equal(resolveProvider({ country: "UA" }, true), "stripe");
  assert.equal(resolveProvider({ country: "US" }, true), "stripe");
  assert.equal(resolveProvider({ country: "DE" }, true), "stripe");
  assert.equal(resolveProvider({ country: "US", telegram: true }, true), "yookassa"); // бот всегда ЮKassa
  assert.equal(resolveProvider({ country: null }, true), "yookassa"); // страна неизвестна — как раньше
  assert.equal(resolveProvider({}, true), "yookassa");
  assert.equal(currencyOf("stripe"), "USD");
  assert.equal(currencyOf("yookassa"), "RUB");
});

test("письма на английском и с нужными суммами", () => {
  const url = "https://example.com/manage";
  const trial = purchaseMail({ offer: "trial", periodEnd: null, trialEnd: new Date("2026-11-05T10:00:00Z") }, url);
  assert.match(trial.subject, /trial/i);
  assert.match(trial.text, /\$3\.99/);
  assert.match(trial.text, /7-day trial/);
  assert.match(trial.text, /\$12\.99\/month/);
  assert.match(trial.text, /November 5, 2026/);
  assert.ok(trial.html.includes(url));
  assert.doesNotMatch(trial.text + trial.html, /[А-Яа-я]/);
  assert.match(purchaseMail({ offer: "annual", periodEnd: new Date("2027-10-27T00:00:00Z"), trialEnd: null }, url).text, /\$99\/year/);
  assert.match(trialEndingMail({ trialEnd: new Date("2026-11-05T10:00:00Z") }, url).text, /\$12\.99\/month/);
  assert.match(annualReminderMail({ renewsOn: new Date("2027-10-27T00:00:00Z") }, url).subject, /7 days/);
});

test("напоминание о продлении года: русский для ЮKassa (рубли) и английский по умолчанию", () => {
  const url = "https://example.com/manage";
  const ru = annualReminderMail({ renewsOn: new Date("2027-11-10T00:00:00Z"), price: "10\u00a0990\u00a0₽", locale: "ru" }, url);
  assert.equal(ru.subject, "Годовая подписка MIRRO продлится через 7 дней");
  assert.match(ru.text, /10\u00a0990\u00a0₽/);
  assert.match(ru.text, /10 ноября 2027/);
  assert.match(ru.html, /Управление подпиской/);
  assert.ok(ru.html.includes(url));
  const en = annualReminderMail({ renewsOn: new Date("2027-11-10T00:00:00Z"), price: "₽10,990", locale: "en" }, url);
  assert.match(en.subject, /7 days/);
  assert.match(en.text, /₽10,990\/year/);
  assert.doesNotMatch(en.text, /[А-Яа-я]/);
});

test("провайдер оплаты (RU_ENABLED выключен, по умолчанию): весь трафик — Stripe", () => {
  for (const country of ["RU", "BY", "ru", "US", "DE", null, undefined]) {
    assert.equal(resolveProvider({ country }, false), "stripe");
    assert.equal(resolveProvider({ country, telegram: true }, false), "stripe");
  }
  assert.equal(resolveProvider({}, false), "stripe");
});
