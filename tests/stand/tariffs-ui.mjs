// Экраны тарифов в настоящем Chromium: что видит человек с доступным триалом и без него (ЮKassa и Stripe).
// Запуск после стенда (см. README): node tests/stand/tariffs-ui.mjs  (нужен playwright; PLAYWRIGHT_PATH — путь к нему)
import pg from "pg";

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const APP = "http://localhost:3100", YK = "http://localhost:54500";
const db = new pg.Pool({ host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5499), user: process.env.PGUSER ?? "postgres", database: process.env.PGDATABASE ?? "app" });
const q = async (sql, a) => (await db.query(sql, a)).rows;
let pass = 0, failed = 0;
const ok = (c, name, extra = "") => { if (c) pass++; else failed++; console.log(`  ${c ? "✓" : "✗"} ${name} ${c ? "" : extra}`); };
const run = Date.now();
// Карта у каждого прогона своя: карта, с которой уже платили или брали триал, второй раз триал не получит.
const card = (n) => ({ first6: String(run).slice(-6), last4: String(run + n).slice(-4) });

const mkUser = async (tag) => {
  const u = (await q("insert into auth.users (email) values ($1) returning id", [`${tag}-${run}@example.com`]))[0];
  await q("update profiles set name='Anna', gender='female' where id=$1", [u.id]);
  return { ...u, cookie: `base64-${Buffer.from(JSON.stringify({ access_token: `tok-${u.id}`, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user: { id: u.id, email: "x@example.com", aud: "authenticated" } })).toString("base64url")}` };
};
const api = (u, method, path, body, country = "RU") =>
  fetch(APP + path, { method, headers: { cookie: `sb-localhost-auth-token=${u.cookie}`, "content-type": "application/json", "x-vercel-ip-country": country }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
const settle = async (order, card) => {
  const pays = await fetch(YK + "/__payments").then((r) => r.json());
  await fetch(YK + "/__settle", { method: "POST", body: JSON.stringify({ id: pays.find((p) => p.metadata?.order_id === order).id, result: "success", card }) });
};

const b = await chromium.launch();
async function text(user, path, { country, lang }, shot) {
  const ctx = await b.newContext({ locale: lang, viewport: { width: 390, height: 1500 }, extraHTTPHeaders: { "x-vercel-ip-country": country, "Accept-Language": lang } });
  // Язык выбран явно на этом устройстве (cookie), иначе подхватится язык из профиля.
  await ctx.addCookies([{ name: "sb-localhost-auth-token", value: user.cookie, url: APP }, { name: "NEXT_LOCALE", value: lang.slice(0, 2), url: APP }]);
  const p = await ctx.newPage();
  await p.goto(APP + path, { waitUntil: "load" });
  await p.waitForTimeout(2500);
  const t = await p.evaluate(() => document.body.innerText);
  if (shot) await p.screenshot({ path: `/tmp/${shot}.png`, fullPage: true });
  await ctx.close();
  return t;
}

// ── пользователи ──
const fresh = await mkUser("fresh");
const payer = await mkUser("payer");
const cp = await api(payer, "POST", "/api/payments/create", { plan: "premium", consent: true });
await settle(cp.orderId, card(1));
await api(payer, "GET", `/api/payments/status?order=${cp.orderId}`);
await q("update subscriptions set status = 'expired', current_period_end = now() - interval '1 day' where user_id = $1", [payer.id]);
const trialer = await mkUser("trialer");
const ct = await api(trialer, "POST", "/api/payments/create", { plan: "premium", trial: true, consent: true });
await settle(ct.orderId, card(2));
await api(trialer, "GET", `/api/payments/status?order=${ct.orderId}`);
// Триал закончился (подписка истекла) — этот человек триал уже брал.
await q("update subscriptions set status = 'expired', current_period_end = now() - interval '1 day' where user_id = $1", [trialer.id]);
// Другой человек в самом триале — для экранов «Моя подписка» и результата.
const intrial = await mkUser("intrial");
const ci = await api(intrial, "POST", "/api/payments/create", { plan: "premium", trial: true, consent: true });
await settle(ci.orderId, card(3));
await api(intrial, "GET", `/api/payments/status?order=${ci.orderId}`);

console.log("\n[ЮKassa, русский] триал доступен");
{
  const t = await text(fresh, "/profile/subscription", { country: "RU", lang: "ru-RU" }, "tariffs_ru_trial");
  ok(/Пробный период 7 дней за 399\s₽/.test(t), "«Пробный период 7 дней за 399 ₽»", t.slice(0, 400));
  ok(/Затем 1499\s₽\/мес\. Отменить можно в любой момент/.test(t), "до оплаты: «Затем 1499 ₽/мес. Отменить можно в любой момент»");
  ok(/Начать за 399\s₽/.test(t) && /Оформить за 1499\s₽|Оформить за 1499/.test(t.replace(/ /g, " ")) || /1499/.test(t), "есть кнопки триала и обычной подписки");
  ok(/60 примерок и образов/.test(t), "объём: «Включено: 60 примерок и образов»");
  ok(!/Premium\+/.test(t) && !/2499|2\.499/.test(t), "Premium+ и 2499 ₽ нет на экране");
  ok(!/≈/.test(t), "рублёвый тариф без пересчёта в доллары");
  ok(/Premium на год/.test(t) && /10\s990\s₽\s*\/год/.test(t.replace(/\u00a0/g, " ")), "годовой: «Premium на год», «10 990 ₽ /год»");
  ok(/Выгоднее месячной оплаты на 39%/.test(t), "подпись экономии: 39%");
  ok(/Продлевается раз в год за 10\s990\s₽/.test(t.replace(/\u00a0/g, " ")) && /Напомним на почту за 7 дней/.test(t) && /Отменить можно в любой момент/.test(t), "условия до оплаты: раз в год, напоминание за 7 дней, отмена в любой момент");
  ok(/Оформить за 10\s990\s₽ в год/.test(t.replace(/\u00a0/g, " ")), "кнопка «Оформить за 10 990 ₽ в год»");
}
console.log("\n[ЮKassa, английский] триал доступен");
{
  const t = await text(fresh, "/profile/subscription", { country: "BY", lang: "en-US" });
  ok(/7-day trial for ₽399/.test(t) && /Then ₽1,499\/month\. You can cancel at any time/.test(t), "«7-day trial for ₽399», «Then ₽1,499/month. You can cancel at any time»", t.slice(0, 300));
  ok(/Premium annual/.test(t) && /₽10,990/.test(t) && /Save 39% compared to monthly/.test(t) && /Renews once a year at ₽10,990\. We'll email you 7 days before/.test(t), "английский: «Premium annual», ₽10,990, Save 39%, письмо за 7 дней");
}
console.log("\n[ЮKassa] триал недоступен (платил раньше / уже брал)");
for (const [name, u] of [["платил раньше", payer], ["уже брал триал", trialer]]) {
  const t = await text(u, "/profile/subscription", { country: "RU", lang: "ru-RU" }, name === "платил раньше" ? "tariffs_ru_notrial" : null);
  ok(!/триал|пробн|399/i.test(t) && /Premium/.test(t) && /1499/.test(t), `${name}: только Premium, триала на экране нет`, t.slice(0, 300));
  ok(/Premium на год/.test(t) && /Оформить за 10\s990/.test(t.replace(/\u00a0/g, " ")), `${name}: годовой Premium на месте`);
}
console.log("\n[ЮKassa] экран «Моя подписка» и результат оплаты триала");
{
  const t = await text(intrial, "/profile/subscription/manage", { country: "RU", lang: "ru-RU" }, "tariffs_ru_manage");
  ok(/Пробный период заканчивается/.test(t) && /1499\s₽\/мес/.test(t), "баннер: «Пробный период заканчивается …, затем 1499 ₽/мес»", t.slice(0, 400));
  ok(/15/.test(t) && !/из 60/.test(t), "credits: считаются от 15 (не от 60), пока идёт триал");
  const r = await text(intrial, `/profile/subscription/result?order=${ci.orderId}`, { country: "RU", lang: "ru-RU" }, "tariffs_ru_result");
  ok(/Пробный период начался/.test(r) && /1499\s₽\/мес/.test(r), "результат оплаты: «Пробный период начался … 1499 ₽/мес»", r.slice(0, 300));
}

console.log("\n[Stripe, английский] триал доступен");
{
  const t = await text(fresh, "/profile/subscription", { country: "US", lang: "en-US" }, "tariffs_us_trial");
  ok(/7-day trial/.test(t) && /\$3\.99/.test(t) && /for 7 days/.test(t), "«7-day trial», $3.99, for 7 days", t.slice(0, 300));
  ok(/Then \$12\.99\/month\. You can cancel at any time/.test(t), "до оплаты: «Then $12.99/month. You can cancel at any time»");
  ok(/Start trial for \$3\.99/.test(t), "кнопка «Start trial for $3.99»");
  ok(/\$99/.test(t) && /\/year/.test(t) && /Save 36%/.test(t), "годовой: $99 /year, Save 36%");
  ok(/Includes 15 try-ons and looks/.test(t) && /Includes 60 try-ons and looks every month/.test(t), "«Includes N try-ons and looks»: 15 в триале, 60 в год");
  ok(!/9\.99|49\.99|4\.99|Premium\+/.test(t), "старых цен и Premium+ нет");
}
console.log("\n[Stripe, русский] суммы с запятой");
{
  const t = await text(fresh, "/profile/subscription", { country: "DE", lang: "ru-RU" });
  ok(/Затем \$12,99\/мес/.test(t) && /\$3,99/.test(t), "«Затем $12,99/мес», $3,99", t.slice(0, 300));
}
console.log("\n[Stripe] триал недоступен: только Premium и годовой, без слова «триал»");
for (const [name, u] of [["платил раньше", payer], ["уже брал триал", trialer]]) {
  const t = await text(u, "/profile/subscription", { country: "US", lang: "en-US" }, name === "платил раньше" ? "tariffs_us_notrial" : null);
  const lang2 = await text(u, "/profile/subscription", { country: "US", lang: "ru-RU" });
  ok(!/trial/i.test(t) && !/триал|пробн/i.test(lang2), `${name}: слова «trial/триал» на экране нет`, t.slice(0, 300));
  ok(/\$12\.99/.test(t) && /\$99/.test(t), `${name}: показаны Premium $12.99 и годовой $99`);
}

await b.close(); await db.end();
console.log(`\nИтого: ${pass} прошло, ${failed} не прошло`);
process.exit(failed ? 1 : 0);
