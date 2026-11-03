import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANS, RU_TRIAL, formatPrice, getPlan } from "../lib/plans.ts";

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
