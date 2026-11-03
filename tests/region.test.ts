import assert from "node:assert/strict";
import { test } from "node:test";
import { stripRuOnly } from "../i18n/ru-only.ts";
import { isAllowlisted, isBlockedCountry, parseAllowlist } from "../lib/region.ts";

test("закрытые регионы: Россия и Беларусь, регистр не важен, нет заголовка — пускаем", () => {
  for (const c of ["RU", "ru", "BY", " by "]) assert.equal(isBlockedCountry(c), true, c);
  for (const c of ["US", "DE", "KZ", "UA", "", null, undefined]) assert.equal(isBlockedCountry(c), false, String(c));
});

test("ALLOWLIST_EMAILS: адреса через запятую, пробелы и регистр не важны", () => {
  const list = parseAllowlist(" Admin@Example.com, qa@example.com ,,");
  assert.deepEqual(list, ["admin@example.com", "qa@example.com"]);
  assert.equal(isAllowlisted("ADMIN@example.com", list), true);
  assert.equal(isAllowlisted("qa@example.com", list), true);
  assert.equal(isAllowlisted("other@example.com", list), false);
  assert.equal(isAllowlisted(null, list), false);
  assert.equal(isAllowlisted("", list), false);
  assert.equal(isAllowlisted("admin@example.com", parseAllowlist(undefined)), false);
});

test("тексты ЮKassa и русских документов убираются из сообщений, остальное не трогается", async () => {
  const en = (await import("../messages/en.json", { with: { type: "json" } })).default as Record<string, unknown>;
  const stripped = JSON.stringify(stripRuOnly(en as never));
  for (const word of ["YooKassa", "rubles", "SBP", "Russian", "Russia", "Belarus", "₽"]) {
    assert.ok(!stripped.includes(word), `в английских сообщениях осталось «${word}»`);
  }
  assert.ok(stripped.includes("Start trial for"), "обычные тексты на месте");
  assert.ok(JSON.stringify(en).includes("YooKassa"), "исходный файл не изменён");
});
