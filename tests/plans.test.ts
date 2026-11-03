import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANS, RU_ANNUAL, RU_TRIAL, formatPrice, getPlan, priceFor, yearlyPricing } from "../lib/plans.ts";

test("тарифы ЮKassa: Free и один Premium, Premium+ убран", () => {
  assert.deepEqual(PLANS.map((p) => p.id), ["free", "premium"]);
  assert.equal(getPlan("premium").price, 1499);
  assert.equal(getPlan("premium").tokens, 60);
  assert.equal(getPlan("free").tokens, 10);
  assert.ok(!JSON.stringify(PLANS).includes("premium_plus"));
});

test("старое значение «premium_plus» из базы читается как Premium, а не ломает экран", () => {
  assert.equal(getPlan("premium_plus").id, "premium");
  assert.equal(getPlan("что-то ещё").price, 1499);
});

test("триал ЮKassa: 399 ₽ на 7 дней, 15 credits", () => {
  assert.deepEqual({ ...RU_TRIAL }, { price: 399, days: 7, credits: 15 });
});

test("цена в рублях: «1499 ₽» (ru) и «₽1,499» (en)", () => {
  assert.equal(formatPrice(1499, "ru"), "1499\u00a0₽");
  assert.equal(formatPrice(399, "ru"), "399\u00a0₽");
  assert.equal(formatPrice(1499, "en"), "₽1,499");
});

test("годовой Premium ЮKassa: 10 990 ₽ в год, цена по периоду", () => {
  assert.equal(RU_ANNUAL.price, 10990);
  assert.equal(priceFor("premium"), 1499);
  assert.equal(priceFor("premium", "month"), 1499);
  assert.equal(priceFor("premium", "year"), 10990);
  assert.equal(getPlan("premium").tokens, 60); // и в год — 60 credits каждый месяц
});

test("цена: «10 990 ₽» (ru) и «₽10,990» (en)", () => {
  assert.equal(formatPrice(10990, "ru"), "10\u00a0990\u00a0₽");
  assert.equal(formatPrice(10990, "en"), "₽10,990");
  assert.equal(formatPrice(1499, "ru"), "1499\u00a0₽");
});

test("годовая подписка: неделя = год / 52 (центы для $, рубли для ₽), выгода считается из цен", () => {
  assert.deepEqual(yearlyPricing(99, 12.99, "USD"), { perWeek: 1.9, savingPercent: 36 }); // 99 / 52 = 1.9038…
  assert.deepEqual(yearlyPricing(RU_ANNUAL.price, getPlan("premium").price, "RUB"), { perWeek: 211, savingPercent: 39 }); // 211.35…
  // Цифры следуют за тарифами, а не зашиты: другая цена — другой результат.
  assert.deepEqual(yearlyPricing(104, 10, "USD"), { perWeek: 2, savingPercent: 13 });
  assert.deepEqual(yearlyPricing(52000, 5000, "RUB"), { perWeek: 1000, savingPercent: 13 });
  assert.equal(yearlyPricing(120, 10, "USD").savingPercent, 0); // год по цене двенадцати месяцев — выгоды нет
});
