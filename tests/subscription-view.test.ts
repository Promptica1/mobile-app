import assert from "node:assert/strict";
import { test } from "node:test";
import { planScreenView } from "../lib/subscription-view.ts";

const sub = (over: Record<string, unknown> = {}) =>
  ({ plan: "premium", status: "active", current_period_end: "2099-01-01T00:00:00Z", card_last4: "4242", card_type: "visa", test: true, provider: "stripe", offer: "monthly", is_trial: false, ...over }) as never;

test("нет подписки (или доступ закончился): предложения и верхняя подпись, без Resume", () => {
  for (const [s, access] of [[null, false], [undefined, false], [sub({ status: "expired" }), false], [sub(), false]] as const) {
    const v = planScreenView(s, access);
    assert.deepEqual(v, { state: "none", showIntro: true, showResume: false });
  }
});

test("действующая подписка: подписи «Pick how you'd like to start…» нет, Resume нет", () => {
  const v = planScreenView(sub(), true);
  assert.equal(v.state, "active");
  assert.equal(v.showIntro, false);
  assert.equal(v.showResume, false);
});

test("пробный период: как действующая — без подписи и без Resume", () => {
  const v = planScreenView(sub({ is_trial: true, offer: "trial" }), true);
  assert.equal(v.state, "trial");
  assert.equal(v.showIntro, false);
  assert.equal(v.showResume, false);
});

test("отменённая, но ещё действующая: подписи нет, Resume показывается", () => {
  const v = planScreenView(sub({ status: "canceled" }), true);
  assert.equal(v.state, "canceled");
  assert.equal(v.showIntro, false);
  assert.equal(v.showResume, true);
});

test("отменённая триальная подписка тоже получает Resume", () => {
  assert.equal(planScreenView(sub({ status: "canceled", is_trial: true }), true).showResume, true);
});

test("Resume только у отменённой: ни active, ни trial, ни past_due, ни expired его не получают", () => {
  for (const status of ["active", "past_due", "expired"] as const) {
    for (const is_trial of [false, true]) {
      assert.equal(planScreenView(sub({ status, is_trial }), true).showResume, false, `${status} trial=${is_trial}`);
    }
  }
});

test("отменённая без сохранённой карты: Resume не показываем (возобновлять нечем — карту добавляют в Manage subscription)", () => {
  const v = planScreenView(sub({ status: "canceled", card_last4: null }), true);
  assert.equal(v.showResume, false);
  assert.equal(v.showIntro, false);
});

test("отменённая, у которой доступ уже закончился: это обычный экран предложений", () => {
  assert.deepEqual(planScreenView(sub({ status: "canceled" }), false), { state: "none", showIntro: true, showResume: false });
});
