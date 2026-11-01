import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_STATE, RESHOW_AFTER_MS, parseState, pickVariant, shouldAutoShow, type PwaState } from "../lib/pwa.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000;
const base = { variant: "ios" as const, telegram: false };

test("вариант окна по окружению", () => {
  const env = { standalone: false, telegram: false, inApp: false, os: "other" as const, hasPrompt: false };
  assert.equal(pickVariant({ ...env, standalone: true, os: "ios" }), "installed");
  assert.equal(pickVariant({ ...env, inApp: true, os: "ios" }), "inapp");
  assert.equal(pickVariant({ ...env, telegram: true, os: "android", hasPrompt: true }), "inapp");
  assert.equal(pickVariant({ ...env, os: "android", hasPrompt: true }), "native");
  assert.equal(pickVariant({ ...env, os: "ios" }), "ios");
  assert.equal(pickVariant({ ...env, os: "android" }), "android");
  assert.equal(pickVariant(env), "other");
});

test("первый показ: после оплаты, после первого образа; повторные триггеры в тот же день молчат", () => {
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment" }), true);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "look" }), true);
  const once: PwaState = { ...EMPTY_STATE, shown: [T0] };
  assert.equal(shouldAutoShow(once, T0 + 1000, { ...base, trigger: "payment" }), false);
  assert.equal(shouldAutoShow(once, T0 + 2 * DAY, { ...base, trigger: "open" }), false);
});

test("второй показ — через 3 дня, если не установлено; третьего нет", () => {
  const once: PwaState = { ...EMPTY_STATE, shown: [T0] };
  assert.equal(shouldAutoShow(once, T0 + RESHOW_AFTER_MS - 1, { ...base, trigger: "open" }), false);
  assert.equal(shouldAutoShow(once, T0 + RESHOW_AFTER_MS, { ...base, trigger: "open" }), true);
  assert.equal(shouldAutoShow(once, T0 + RESHOW_AFTER_MS, { ...base, trigger: "payment" }), true);
  const twice: PwaState = { ...EMPTY_STATE, shown: [T0, T0 + 4 * DAY] };
  assert.equal(shouldAutoShow(twice, T0 + 30 * DAY, { ...base, trigger: "open" }), false);
  assert.equal(shouldAutoShow(twice, T0 + 30 * DAY, { ...base, trigger: "payment" }), false);
});

test("«открытие приложения» для первого показа — только для пользователей ЮKassa (после регистрации)", () => {
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "open" }), false);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "open", signupFirstShow: true }), true);
});

test("не показываем: установлено, Telegram, нет смысла (Android без окна, компьютер), приложение уже с главного экрана", () => {
  assert.equal(shouldAutoShow({ ...EMPTY_STATE, installed: true }, T0, { ...base, trigger: "payment" }), false);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment", telegram: true }), false);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment", variant: "installed" }), false);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment", variant: "android" }), false);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment", variant: "other" }), false);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment", variant: "native" }), true);
  assert.equal(shouldAutoShow(EMPTY_STATE, T0, { ...base, trigger: "payment", variant: "inapp" }), true);
});

test("триггер «образ» срабатывает только для первого образа на устройстве", () => {
  assert.equal(shouldAutoShow({ ...EMPTY_STATE, lookSeen: true }, T0, { ...base, trigger: "look" }), false);
});

test("хранилище: битые данные не ломают приложение", () => {
  assert.deepEqual(parseState(null), EMPTY_STATE);
  assert.deepEqual(parseState("{oops"), EMPTY_STATE);
  assert.deepEqual(parseState('{"shown":[1,"x",2,3],"installed":true,"lookSeen":1}'), { shown: [1, 2], installed: true, lookSeen: false });
});
