// Установка на главный экран в настоящем Chromium: файлы, service worker, окно установки, когда показывать.
// Запуск после стенда (см. README): node tests/stand/pwa.mjs  (нужен playwright; PLAYWRIGHT_PATH — путь, если он не в node_modules)
import crypto from "node:crypto";
import pg from "pg";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
import Stripe from "stripe";
const APP = "http://localhost:3100", ST = "http://localhost:54600";
const db = new pg.Pool({ host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5499), user: process.env.PGUSER ?? "postgres", database: process.env.PGDATABASE ?? "app" });
const q = async (sql, a) => (await db.query(sql, a)).rows;
const stripe = new Stripe("sk_test_abc");
let pass = 0, failed = 0;
const ok = (c, name, extra = "") => { if (c) pass++; else failed++; console.log(`  ${c ? "✓" : "✗"} ${name} ${c ? "" : extra}`); };
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  igIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.30.109 (iPhone15,2; iOS 17_5; en_US)",
  igAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.30.109 Android (34/14)",
  tg: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Telegram-Android/10.14.5",
};
const mkUser = async (tag) => {
  const u = (await q("insert into auth.users (email) values ($1) returning id", [`${tag}-${Date.now()}@example.com`]))[0];
  await q("update profiles set name='Anna', gender='female' where id=$1", [u.id]);
  return { ...u, cookie: `base64-${Buffer.from(JSON.stringify({ access_token: `tok-${u.id}`, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user: { id: u.id, email: "x@example.com", aud: "authenticated" } })).toString("base64url")}` };
};
const b = await chromium.launch();
async function page(ua, user, { country = "RU", lang = "en-US", init, w = 390, h = 844 } = {}) {
  const ctx = await b.newContext({ userAgent: ua, locale: lang, viewport: { width: w, height: h }, serviceWorkers: "allow", extraHTTPHeaders: { "x-vercel-ip-country": country, "Accept-Language": lang } });
  if (user) await ctx.addCookies([{ name: "sb-localhost-auth-token", value: user.cookie, url: APP }]);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  return { ctx, p };
}
const FAKE_PROMPT = `window.__prompted = 0; window.addEventListener('DOMContentLoaded', () => setTimeout(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }, 300));`;
const sheet = (p) => p.locator("[role=dialog]");

console.log("\n[Файлы установки] открыты без входа");
for (const path of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/apple-touch-icon.png", "/favicon.ico", "/icon.png"]) {
  const r = await fetch(APP + path, { redirect: "manual" });
  ok(r.status === 200, `${path} → ${r.status}`);
}

console.log("\n[Chrome] установка возможна, service worker работает");
{
  const { ctx, p } = await page(UA.android, null, { country: "US" });
  await p.goto(APP + "/login", { waitUntil: "load" });
  const swState = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; for (let i = 0; i < 30 && r.active?.state !== "activated"; i++) await new Promise((x) => setTimeout(x, 100)); return r.active?.state; });
  ok(swState === "activated", "service worker активирован", String(swState));
  const cdp = await ctx.newCDPSession(p);
  const inst = await cdp.send("Page.getInstallabilityErrors");
  ok(inst.installabilityErrors.length === 0, "Chrome не видит ошибок установки (manifest и иконки)", JSON.stringify(inst.installabilityErrors));
  const man = await cdp.send("Page.getAppManifest");
  ok(man.errors.length === 0 && man.url.endsWith("manifest.webmanifest"), "manifest читается без ошибок", JSON.stringify(man.errors));
  // офлайн
  await ctx.setOffline(true);
  await p.goto(APP + "/login", { waitUntil: "load" }).catch(() => {});
  const text = await p.evaluate(() => document.body.innerText);
  ok(/offline/i.test(text) && /MIRRO/.test(text), "без сети — офлайн-заглушка MIRRO", text.slice(0, 80));
  await p.screenshot({ path: "/tmp/pwa_offline.png" });
  await ctx.setOffline(false);
  // SW не лезет в API / чужие адреса / POST
  await p.goto(APP + "/login", { waitUntil: "load" });
  const cached = await p.evaluate(async () => { const keys = await caches.keys(); const all = []; for (const k of keys) for (const r of await (await caches.open(k)).keys()) all.push(new URL(r.url).pathname); return all; });
  ok(cached.every((x) => x === "/offline.html" || x.startsWith("/icons/") || x.startsWith("/_next/static/")), "в кэше только заглушка, иконки и статика", JSON.stringify(cached.filter((x) => !(x === "/offline.html" || x.startsWith("/icons/") || x.startsWith("/_next/static/")))));
  ok(!cached.some((x) => x.startsWith("/api") || x.startsWith("/login") || x.includes("auth")), "API, вход и оплата в кэш не попадают");
  await ctx.close();
}

console.log("\n[Вход, Stripe, ЮKassa при работающем service worker]");
{
  const u = await mkUser("sw");
  const { ctx, p } = await page(UA.android, u, { country: "US" });
  await p.goto(APP + "/profile/subscription", { waitUntil: "load" });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload({ waitUntil: "load" });
  ok((await p.evaluate(() => navigator.serviceWorker.controller !== null)), "страницы идут через service worker");
  ok(await p.getByRole("button", { name: /Start trial/ }).isEnabled(), "экран тарифов Stripe открывается, кнопка оплаты активна");
  // создание Checkout из браузера (POST) через SW
  const res = await p.evaluate(() => fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: "trial", consent: true }) }).then(async (r) => ({ s: r.status, j: await r.json() })));
  ok(res.s === 200 && /54600\/c\/cs_test/.test(res.j.url), "Stripe Checkout создаётся из браузера", JSON.stringify(res));
  // переход на чужой адрес (страница оплаты) не перехватывается
  await p.goto(res.j.url, { waitUntil: "load" }).catch(() => {});
  ok(p.url().startsWith("http://localhost:54600/c/"), "переход на страницу оплаты Stripe работает", p.url());
  // ЮKassa: Россия
  const ru = await page(UA.android, u, { country: "RU", lang: "ru-RU" });
  await ru.p.goto(APP + "/profile/subscription", { waitUntil: "load" });
  await ru.p.evaluate(() => navigator.serviceWorker.ready);
  await ru.p.reload({ waitUntil: "load" });
  const yk = await ru.p.evaluate(() => fetch("/api/payments/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "premium", consent: true }) }).then(async (r) => ({ s: r.status, j: await r.json() })));
  ok(yk.s === 200 && /54500\/pay\//.test(yk.j.confirmationUrl), "платёж ЮKassa создаётся при работающем service worker", JSON.stringify(yk));
  await ru.p.goto(yk.j.confirmationUrl, { waitUntil: "load" }).catch(() => {});
  ok(ru.p.url().startsWith("http://localhost:54500/pay/"), "переход на страницу оплаты ЮKassa работает");
  await ctx.close(); await ru.ctx.close();
}

console.log("\n[Окно установки] профиль: iPhone, Android, встроенные браузеры, установлено");
async function openProfileInstall(ua, opts = {}) {
  const u = await mkUser("prof");
  const { ctx, p } = await page(ua, u, opts);
  await p.goto(APP + "/profile", { waitUntil: "load" });
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /Add to home screen|На главный экран/ }).click();
  await p.waitForTimeout(500);
  return { ctx, p };
}
{
  const { ctx, p } = await openProfileInstall(UA.ios, { country: "US" });
  const t = await sheet(p).innerText();
  ok(/Add MIRRO to your home screen/.test(t) && /Tap Share/.test(t) && /Add to Home Screen/.test(t) && /Tap Add/.test(t) && /Got it/.test(t), "iPhone: 3 шага и «Got it»", t.replace(/\n+/g, " | ").slice(0, 200));
  ok((await sheet(p).locator("ol li svg").count()) >= 3, "у шагов есть иконки");
  await p.screenshot({ path: "/tmp/pwa_ios.png" });
  await p.getByRole("button", { name: "Got it" }).click();
  ok((await sheet(p).count()) === 0, "«Got it» закрывает окно");
  await ctx.close();
}
{
  const { ctx, p } = await page(UA.android, await mkUser("an"), { init: FAKE_PROMPT, country: "US" });
  await p.goto(APP + "/profile", { waitUntil: "load" });
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: /Add to home screen/ }).click();
  await p.waitForTimeout(400);
  ok((await p.evaluate(() => window.__prompted)) === 1 && (await sheet(p).count()) === 0, "Android Chrome: пункт профиля сразу вызывает системное окно установки");
  await ctx.close();
}
{
  const { ctx, p } = await openProfileInstall(UA.android, { country: "US" }); // Chrome без beforeinstallprompt
  const t = await sheet(p).innerText();
  ok(/Install app or Add to Home screen/.test(t), "Android без системного окна: ручная инструкция", t.replace(/\n+/g, " | ").slice(0, 160));
  await ctx.close();
}
{
  const { ctx, p } = await openProfileInstall(UA.igIos, { country: "US" });
  const t = await sheet(p).innerText();
  ok(/Open in Safari to add MIRRO to your home screen/.test(t) && /Tap •••\s*→\s*Open in browser/.test(t), "Instagram на iPhone: «Open in Safari…» и «Tap ••• → Open in browser»", t.replace(/\n+/g, " | ").slice(0, 200));
  ok(!/Tap Share/.test(t), "вместо туториала — экран про внешний браузер");
  await p.screenshot({ path: "/tmp/pwa_inapp_ios.png" });
  await ctx.close();
}
{
  const { ctx, p } = await openProfileInstall(UA.igAndroid, { country: "US", lang: "ru-RU" });
  const t = await sheet(p).innerText();
  const link = await sheet(p).locator("a").first().getAttribute("href");
  ok(/Откройте в Chrome, чтобы добавить MIRRO на главный экран/.test(t) && /Нажмите ••• → Открыть в браузере/.test(t), "Instagram на Android (русский): тексты", t.replace(/\n+/g, " | ").slice(0, 200));
  ok(link?.startsWith("intent://localhost:3100/profile#Intent;scheme=http;package=com.android.chrome"), "кнопка «Открыть в Chrome» с intent-ссылкой", link ?? "");
  await p.screenshot({ path: "/tmp/pwa_inapp_android_ru.png" });
  await ctx.close();
}
{
  const { ctx, p } = await openProfileInstall(UA.tg, { country: "US" });
  const t = await sheet(p).innerText();
  ok(/Open in Chrome to add MIRRO/.test(t), "Telegram: тоже «откройте в браузере»");
  await ctx.close();
}
{
  const standalone = `const orig = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : orig(q);`;
  const { ctx, p } = await openProfileInstall(UA.ios, { country: "US", init: standalone });
  ok(/already on your home screen/.test(await sheet(p).innerText()), "открыто с главного экрана: «MIRRO is already on your home screen»");
  await ctx.close();
}

console.log("\n[Когда показывать само]");
const stripePaid = async () => {
  const u = await mkUser("paid");
  const call = (path, body) => fetch(APP + path, { method: "POST", headers: { cookie: `sb-localhost-auth-token=${u.cookie}`, "content-type": "application/json", "x-vercel-ip-country": "US" }, body: JSON.stringify(body) }).then((r) => r.json());
  await call("/api/stripe/checkout", { offer: "monthly", consent: true });
  const s = (await fetch(ST + "/__state").then((r) => r.json())).sessions.at(-1);
  const d = await fetch(ST + "/__complete", { method: "POST", body: JSON.stringify({ session: s.id, fingerprint: "fp_" + Date.now(), interval: "month", paymentStatus: "paid" }) }).then((r) => r.json());
  const payload = JSON.stringify({ id: "evt_" + crypto.randomUUID().slice(0, 6), object: "event", type: "checkout.session.completed", data: { object: { id: s.id, mode: "subscription", payment_status: "paid", subscription: d.subscription, customer: s.customer, client_reference_id: u.id, metadata: { user_id: u.id, offer: "monthly" } } } });
  await fetch(APP + "/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" }) }, body: payload });
  return { u, sessionId: s.id };
};
{
  const { u, sessionId } = await stripePaid();
  const { ctx, p } = await page(UA.ios, u, { country: "US" });
  await p.goto(`${APP}/profile/subscription/result?stripe_session=${sessionId}`, { waitUntil: "load" });
  await p.waitForTimeout(3200);
  ok((await sheet(p).count()) === 1 && /Tap Share/.test(await sheet(p).innerText()), "после первой оплаты (Stripe) окно с туториалом появляется само");
  await p.screenshot({ path: "/tmp/pwa_after_payment_ios.png" });
  await p.getByRole("button", { name: "Got it" }).click();
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(3200);
  ok((await sheet(p).count()) === 0, "после перезагрузки в тот же день второй раз не показывает");
  // через 3 дня — второй раз, на открытии приложения
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("mirro_pwa")); s.shown = [Date.now() - 4 * 86400e3]; localStorage.setItem("mirro_pwa", JSON.stringify(s)); });
  await p.goto(APP + "/wardrobe", { waitUntil: "load" });
  await p.waitForTimeout(5200);
  ok((await sheet(p).count()) === 1, "через 3 дня без установки окно показывается ещё раз");
  await p.getByRole("button", { name: "Got it" }).click();
  await p.goto(APP + "/looks", { waitUntil: "load" }); await p.waitForTimeout(5200);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("mirro_pwa")); console.log(s.shown.length); s.shown = [Date.now() - 10 * 86400e3, Date.now() - 5 * 86400e3]; localStorage.setItem("mirro_pwa", JSON.stringify(s)); });
  await p.goto(APP + "/wardrobe", { waitUntil: "load" }); await p.waitForTimeout(5200);
  ok((await sheet(p).count()) === 0, "третьего показа нет");
  await ctx.close();
}
{
  // пользователь ЮKassa (Россия): после регистрации, т.е. при первом открытии приложения
  const u = await mkUser("ykreg");
  const { ctx, p } = await page(UA.ios, u, { country: "RU", lang: "ru-RU" });
  await p.goto(APP + "/wardrobe", { waitUntil: "load" });
  await p.waitForTimeout(5200);
  const t = (await sheet(p).count()) ? await sheet(p).innerText() : "";
  ok(/Добавьте MIRRO на главный экран/.test(t) && /Понятно/.test(t), "пользователь ЮKassa: окно после регистрации (первое открытие), на русском", t.slice(0, 120));
  await p.screenshot({ path: "/tmp/pwa_signup_ru.png" });
  await ctx.close();
  // Stripe-пользователь при первом открытии НЕ видит окно (ждём оплату / образ)
  const u2 = await mkUser("strreg");
  const s = await page(UA.ios, u2, { country: "US" });
  await s.p.goto(APP + "/wardrobe", { waitUntil: "load" });
  await s.p.waitForTimeout(5200);
  ok((await sheet(s.p).count()) === 0, "пользователь Stripe при первом открытии окно не видит (ждёт оплату или первый образ)");
  await s.ctx.close();
  // Telegram и standalone — никогда
  const tg = await page(UA.tg, await mkUser("tg"), { country: "RU" });
  await tg.p.goto(APP + "/wardrobe", { waitUntil: "load" }); await tg.p.waitForTimeout(5200);
  ok((await sheet(tg.p).count()) === 0, "в Telegram Mini App окно само не появляется");
  await tg.ctx.close();
  const standalone = `const orig = window.matchMedia.bind(window); window.matchMedia = (q) => /display-mode/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : orig(q);`;
  const st = await page(UA.ios, await mkUser("sa"), { country: "RU", init: standalone });
  await st.p.goto(APP + "/wardrobe", { waitUntil: "load" }); await st.p.waitForTimeout(5200);
  ok((await sheet(st.p).count()) === 0, "из главного экрана (standalone) окно само не появляется");
  await st.ctx.close();
}
await b.close(); await db.end();
console.log(`\nИтого: ${pass} прошло, ${failed} не прошло`);
process.exit(failed ? 1 : 0);
