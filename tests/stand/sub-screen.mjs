// Экран «Subscription» у человека с тарифом (Stripe): активная, отменённая (Resume), пробный период.
// Запуск после стенда (см. README): node tests/stand/sub-screen.mjs [папка_для_скриншотов]  (нужен playwright; PLAYWRIGHT_PATH — путь к нему)
import crypto from "node:crypto";
import pg from "pg";
import Stripe from "stripe";

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const APP = "http://localhost:3100", ST = "http://localhost:54600";
const SHOTS = process.argv[2];
const db = new pg.Pool({ host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5499), user: process.env.PGUSER ?? "postgres", database: process.env.PGDATABASE ?? "app" });
const q = async (sql, a) => (await db.query(sql, a)).rows;
let pass = 0, failed = 0;
const ok = (c, name, extra = "") => { if (c) pass++; else failed++; console.log(`  ${c ? "✓" : "✗"} ${name} ${c ? "" : extra}`); };
const run = Date.now();
const stripe = new Stripe("sk_test_abc");
const post = (url, body) => fetch(url, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());

const mk = async (tag) => {
  const email = `${tag}-${run}@example.com`;
  const [u] = await q("insert into auth.users (email) values ($1) returning id", [email]);
  await q("update profiles set name='Anna', gender='female' where id=$1", [u.id]);
  const session = { access_token: `tok-${u.id}`, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user: { id: u.id, email, aud: "authenticated" } };
  return { id: u.id, email, cookie: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
};
const call = async (u, method, path, body) => {
  const res = await fetch(APP + path, { method, redirect: "manual", headers: { cookie: u ? `sb-localhost-auth-token=${u.cookie}` : "", "content-type": "application/json", "x-vercel-ip-country": "US" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const webhook = async (type, object) => {
  const payload = JSON.stringify({ id: `evt_${crypto.randomUUID().slice(0, 8)}`, object: "event", type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
  return fetch(APP + "/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
};
// Подписка Stripe через настоящий поток стенда: Checkout → оплата → webhook.
let fp = 0;
const subscribe = async (u, offer) => {
  const chk = await call(u, "POST", "/api/stripe/checkout", { offer, consent: true });
  const sess = (await fetch(ST + "/__state").then((r) => r.json())).sessions.at(-1);
  const done = await post(ST + "/__complete", { session: sess.id, fingerprint: `fp_sub_${run}_${fp++}`, interval: offer === "annual" ? "year" : "month", paymentStatus: "paid" });
  await webhook("checkout.session.completed", { id: sess.id, mode: "subscription", payment_status: "paid", subscription: done.subscription, customer: sess.customer, client_reference_id: u.id, metadata: { user_id: u.id, offer } });
  if (!chk.json?.url) throw new Error("checkout failed " + JSON.stringify(chk));
  return done.subscription;
};

const b = await chromium.launch();
const open = async (u, name) => {
  const ctx = await b.newContext({ locale: "en-US", viewport: { width: 375, height: 800 }, deviceScaleFactor: 2, extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
  await ctx.addCookies([{ name: "sb-localhost-auth-token", value: u.cookie, url: APP }]);
  const p = await ctx.newPage();
  await p.goto(APP + "/profile/subscription", { waitUntil: "load" });
  await p.waitForSelector('a[href="/profile/subscription/manage"]', { timeout: 15000 });
  await p.waitForTimeout(600);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/sub-${name}.png` });
  return { ctx, p };
};
const text = (p) => p.evaluate(() => document.body.innerText);
const INTRO = /Pick how you.d like to start/;

console.log("[Активная подписка]");
const active = await mk("active");
await subscribe(active, "monthly");
{
  const { ctx, p } = await open(active, "active");
  const t = await text(p);
  ok(/Your plan is Premium — renews on [A-Z][a-z]+ \d{1,2}, \d{4}/.test(t), "статус: «Your plan is Premium — renews on <дата>»", t.slice(0, 300));
  ok(!INTRO.test(t), "верхней подписи «Pick how you'd like to start…» нет");
  ok(!/Resume subscription/.test(t), "кнопки Resume нет");
  ok((await p.locator('a:has-text("Manage subscription")').count()) === 1, "одна кнопка «Manage subscription»");
  await ctx.close();
}

console.log("[Отменённая подписка]");
const canceled = await mk("canceled");
const canceledSub = await subscribe(canceled, "monthly");
{
  const cancelResult = await call(canceled, "POST", "/api/stripe/subscription", { action: "cancel" });
  ok(cancelResult.status === 200, "подписка отменена (доступ остаётся)");
  const { ctx, p } = await open(canceled, "canceled");
  const t = await text(p);
  ok(/Your plan is Premium, canceled — access until [A-Z][a-z]+ \d{1,2}, \d{4}/.test(t), "статус: «…canceled — access until <дата>»", t.slice(0, 300));
  ok(!INTRO.test(t), "верхней подписи нет");
  const resume = p.locator('button:has-text("Resume subscription")');
  ok((await resume.count()) === 1, "кнопка «Resume subscription» есть");
  const yR = (await resume.boundingBox())?.y, yM = (await p.locator('a:has-text("Manage subscription")').boundingBox())?.y;
  ok(yR !== undefined && yM !== undefined && yR < yM, "Resume стоит над Manage subscription", `${yR} ${yM}`);
  const before = await q("select status, current_period_end from subscriptions where user_id=$1", [canceled.id]);
  const mockBefore = await fetch(ST + "/__state").then((r) => r.json());
  await resume.click();
  await p.waitForSelector("text=Subscription resumed", { timeout: 10000 }).catch(() => null);
  const t2 = await text(p);
  ok(/Subscription resumed/.test(t2), "после успеха: «Subscription resumed»");
  await p.waitForFunction(() => /renews on/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => null);
  const t3 = await text(p);
  ok(/Your plan is Premium — renews on/.test(t3) && !/canceled/.test(t3), "статус обновился: «…renews on <дата>»", t3.slice(0, 200));
  ok((await resume.count()) === 0, "кнопка Resume исчезла");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/sub-resumed.png` });
  const after = await q("select status, current_period_end from subscriptions where user_id=$1", [canceled.id]);
  ok(before[0].status === "canceled" && after[0].status === "active", "в базе: canceled → active");
  ok(new Date(after[0].current_period_end).getTime() === new Date(before[0].current_period_end).getTime(), "период не менялся");
  const mockAfter = await fetch(ST + "/__state").then((r) => r.json());
  ok(JSON.stringify(mockAfter.sessions.length) === JSON.stringify(mockBefore.sessions.length), "новых платёжных сессий нет (без нового платежа)");
  await ctx.close();
}

console.log("[Пробный период]");
const trial = await mk("trial");
await subscribe(trial, "trial");
{
  const { ctx, p } = await open(trial, "trial");
  const t = await text(p);
  ok(/Your trial ends on [A-Z][a-z]+ \d{1,2}, \d{4}\. Then Premium at \$12\.99\/month/.test(t), "статус: «Your trial ends on <дата>. Then Premium at $12.99/month»", t.slice(0, 300));
  ok(!/Your plan is/.test(t), "обычной строки «Your plan is…» у триала нет");
  ok(!INTRO.test(t) && !/Resume subscription/.test(t), "ни подписи, ни Resume");
  await ctx.close();
}

console.log("[Возобновление: безопасность]");
{
  const noSub = await mk("nosub");
  const r1 = await call(noSub, "POST", "/api/stripe/subscription", { action: "resume" });
  ok(r1.status === 404, "у человека без подписки возобновить нельзя (404)", String(r1.status));
  const r2 = await call(null, "POST", "/api/stripe/subscription", { action: "resume" });
  ok(r2.status === 401 || r2.status === 307, "без входа — нельзя", String(r2.status));
  // чужую подписку возобновить нельзя: запрос всегда про подписку самого вошедшего
  const stranger = await call(noSub, "POST", "/api/stripe/subscription", { action: "resume", subscriptionId: canceledSub });
  ok(stranger.status === 404, "id чужой подписки в запросе игнорируется", String(stranger.status));
  const stillActive = (await q("select status from subscriptions where user_id=$1", [canceled.id]))[0];
  ok(stillActive.status === "active", "чужая подписка не затронута");
}

console.log("[Предложения для тех, у кого тарифа нет]");
{
  const fresh = await mk("fresh");
  const { ctx, p } = await (async () => {
    const ctx = await b.newContext({ locale: "en-US", viewport: { width: 375, height: 800 }, extraHTTPHeaders: { "x-vercel-ip-country": "US" } });
    await ctx.addCookies([{ name: "sb-localhost-auth-token", value: fresh.cookie, url: APP }]);
    const p = await ctx.newPage();
    await p.goto(APP + "/profile/subscription", { waitUntil: "load" });
    await p.waitForTimeout(2500);
    return { ctx, p };
  })();
  const t = await text(p);
  ok(INTRO.test(t) && /Start trial for/.test(t), "без тарифа подпись и предложения на месте");
  await ctx.close();
}

await b.close();
await db.end();
console.log(`\nИтого: ${pass} прошло, ${failed} не прошло`);
process.exit(failed ? 1 : 0);
