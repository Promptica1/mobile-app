// Режим «только английский, только Stripe» (RU_ENABLED выключен — сборка по умолчанию), против стенда.
// Запуск: node tests/stand/closed.mjs [папка_для_скриншотов]; для скриншотов нужен playwright (PLAYWRIGHT_PATH).
import pg from "pg";
const APP = "http://localhost:3100";
const SHOTS = process.argv[2];
const db = new pg.Pool({ host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5499), user: process.env.PGUSER ?? "postgres", database: process.env.PGDATABASE ?? "app" });
const q = async (sql, a) => (await db.query(sql, a)).rows;
let pass = 0, failed = 0;
const ok = (c, name, extra = "") => { if (c) pass++; else failed++; console.log(`  ${c ? "✓" : "✗"} ${name} ${c ? "" : extra}`); };
const run = Date.now();
const mk = async (email) => {
  const u = (await q("insert into auth.users (email) values ($1) on conflict (email) do update set email = excluded.email returning id", [email]))[0];
  await q("update profiles set name='Anna', gender='female', locale='ru' where id=$1", [u.id]);
  return { ...u, cookie: `sb-localhost-auth-token=base64-${Buffer.from(JSON.stringify({ access_token: `tok-${u.id}`, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user: { id: u.id, email, aud: "authenticated" } })).toString("base64url")}` };
};
const get = (path, { cookie = "", country, lang = "ru-RU,ru;q=0.9", method = "GET", body } = {}) =>
  fetch(APP + path, { method, redirect: "manual", headers: { cookie, "accept-language": lang, ...(country ? { "x-vercel-ip-country": country } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const BANNED = /Russia|Belarus|YooKassa|ruble|₽|СБП|\bMir\b/i;
const CYR = /[А-Яа-яЁё]/;
const visible = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

const user = await mk(`closed-${run}@example.com`);
const staff = await mk("staff@example.com");

console.log("[Язык: всегда английский]");
{
  const r = await get("/login", { cookie: "NEXT_LOCALE=ru", country: "US" });
  const html = await r.text();
  ok(/<html lang="en"/.test(html), "html lang=en при cookie=ru, Accept-Language=ru");
  ok(!CYR.test(visible(html)) && /Sign in|Log in|Welcome/i.test(visible(html)), "на странице входа нет русского текста");
  ok(!/Русский|English/.test(visible(html)), "переключателя языка на странице входа нет");
  const p = await (await get("/profile", { cookie: user.cookie, country: "US" })).text();
  ok(/<html lang="en"/.test(p) && !CYR.test(visible(p)), "у пользователя с profiles.locale=ru интерфейс английский, без кириллицы");
  ok(!/>Language</.test(p), "в профиле нет строки «Язык»");
  const l = await get("/api/locale", { cookie: user.cookie, country: "US", method: "POST", body: { locale: "ru" } });
  ok(l.status === 404, "POST /api/locale → 404", String(l.status));
}

console.log("[Платежи: только Stripe]");
{
  for (const country of ["RU", "BY", "US", "DE", undefined]) {
    if (country === "RU" || country === "BY") continue; // из этих стран приложение закрыто, см. ниже
    const m = await (await get("/api/payments/mode", { cookie: user.cookie, country })).json();
    ok(m.provider === "stripe" && m.currency === "USD", `провайдер при стране ${country ?? "неизвестна"}: Stripe, USD`, JSON.stringify(m));
  }
  const tg = await (await get("/api/payments/mode", { cookie: user.cookie + "; mirro_tg=1", country: "US" })).json();
  ok(tg.provider === "stripe", "cookie Telegram провайдера не меняет");
  const sub = await (await get("/profile/subscription", { cookie: user.cookie, country: "US" })).text();
  ok(/\$/.test(visible(sub)) && !BANNED.test(sub) && !CYR.test(visible(sub)), "экран тарифов: доллары, без рублей и русского");
  for (const [method, path, body] of [["POST", "/api/payments/create", { plan: "premium", consent: true }], ["GET", "/api/payments/status?order=x"], ["POST", "/api/payments/webhook", { event: "payment.succeeded" }], ["GET", "/api/payments/check"], ["POST", "/api/subscription", { action: "cancel" }]]) {
    const r = await get(path, { cookie: user.cookie, country: "US", method, body });
    ok(r.status === 404, `${method} ${path.split("?")[0]} → 404`, String(r.status));
  }
  const cron = await get("/api/cron/renew", { country: "US" });
  ok(cron.status === 404, "cron продления ЮKassa → 404", String(cron.status));
  const cron2 = await fetch(APP + "/api/cron/renew", { headers: { authorization: "Bearer cron-secret", "x-vercel-ip-country": "US" } });
  ok(cron2.status === 404, "cron продления с верным секретом → 404 (ничего не делает)", String(cron2.status));
}

console.log("[Закрытые регионы]");
{
  for (const country of ["RU", "BY", "ru"]) {
    for (const path of ["/", "/login", "/signup", "/wardrobe", "/legal/privacy"]) {
      const r = await get(path, { country, cookie: user.cookie });
      const html = await r.text();
      ok(r.status === 403 && /MIRRO isn’t available in your region yet|MIRRO isn't available in your region yet/.test(html), `${country} ${path} → нейтральная страница`, `${r.status}`);
      ok(!BANNED.test(visible(html)) && !CYR.test(visible(html)), `${country} ${path}: в тексте нет названий стран, платёжных систем и русского`);
    }
  }
  const api = await get("/api/try-on", { country: "RU", cookie: user.cookie, method: "POST", body: {} });
  ok(api.status === 403, "API из закрытого региона → 403", String(api.status));
  const home = await get("/login", { country: "US" });
  ok(home.status === 200, "из США страница входа открывается");
  const none = await get("/login", {});
  ok(none.status === 200, "страна неизвестна (локально) — пускаем");
  // Серверные вызовы не блокируются регионом
  const hook = await get("/api/stripe/webhook", { country: "RU", method: "POST", body: {} });
  ok(hook.status !== 403, "webhook Stripe не блокируется регионом", String(hook.status));
  // Служебный вход
  const staffLogin = await get("/login?staff=1", { country: "RU" });
  ok(staffLogin.status === 200, "/login?staff=1 открывает форму входа");
  const setCookie = staffLogin.headers.get("set-cookie") ?? "";
  ok(/mirro_staff=1/.test(setCookie), "ставится служебная cookie");
  const staffCookie = "mirro_staff=1";
  const allowed = await get("/wardrobe", { country: "RU", cookie: `${staff.cookie}; ${staffCookie}` });
  ok(allowed.status === 200, "адрес из ALLOWLIST_EMAILS (с другим регистром) пускают из закрытого региона", String(allowed.status));
  const denied = await get("/wardrobe", { country: "RU", cookie: `${user.cookie}; ${staffCookie}` });
  ok(denied.status === 403, "вошедшего не из списка — нейтральная страница", String(denied.status));
  const denied2 = await get("/login", { country: "RU", cookie: `${user.cookie}; ${staffCookie}` });
  ok(denied2.status === 403, "и на странице входа тоже", String(denied2.status));
  const noStaff = await get("/wardrobe", { country: "RU", cookie: staff.cookie });
  ok(noStaff.status === 403, "без служебного входа даже адрес из списка видит нейтральную страницу (вход — только через /login?staff=1)", String(noStaff.status));
}

console.log("[Документы]");
{
  for (const doc of ["offer", "privacy"]) {
    for (const lang of ["ru-RU,ru;q=0.9", "en-US"]) {
      const html = await (await get(`/legal/${doc}`, { country: "US", cookie: lang.startsWith("ru") ? "NEXT_LOCALE=ru" : "", lang })).text();
      ok(/This document is being finalized and will be available before launch/.test(html), `/legal/${doc} (${lang}): «This document is being finalized…»`);
      ok(!CYR.test(visible(html)) && !BANNED.test(visible(html)), `/legal/${doc} (${lang}): русского текста нет`);
    }
  }
}

console.log("[Прочее]");
{
  const mf = await (await get("/manifest.webmanifest", { country: "US" })).text();
  ok(!BANNED.test(mf) && !CYR.test(mf), "manifest без запрещённых слов и русского");
  const off = await (await fetch(APP + "/offline.html")).text();
  ok(/var RU_ENABLED = false/.test(off), "offline.html: русский выключен");
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const r = await get(path, { country: "US" });
    ok(r.status === 404 || !BANNED.test(await r.text()), `${path}: нет или без запрещённых слов`);
  }
  // Все страницы после входа: нет запрещённых слов и кириллицы (в том числе в данных страницы с переводами)
  for (const path of ["/wardrobe", "/profile", "/profile/subscription", "/profile/about", "/profile/help", "/profile/privacy", "/profile/avatar", "/looks", "/try-on", "/add-item"]) {
    const r = await get(path, { cookie: user.cookie, country: "US" });
    const html = await r.text();
    ok(r.status < 400 && !BANNED.test(html) && !CYR.test(html), `${path}: страница без запрещённых слов и кириллицы`, `${r.status} ${(html.match(BANNED) || html.match(CYR) || [""])[0]}`);
  }
}

if (SHOTS) {
  const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
  const b = await chromium.launch();
  const shot = async (name, path, { cookie, country = "US", w = 375, h = 800, full = false }) => {
    const ctx = await b.newContext({ locale: "ru-RU", viewport: { width: w, height: h }, deviceScaleFactor: 2, extraHTTPHeaders: { "x-vercel-ip-country": country, "Accept-Language": "ru-RU,ru;q=0.9" } });
    if (cookie) await ctx.addCookies(cookie.split("; ").map((c) => { const i = c.indexOf("="); return { name: c.slice(0, i), value: c.slice(i + 1), url: APP }; }));
    const p = await ctx.newPage();
    await p.goto(APP + path, { waitUntil: "load" });
    await p.waitForTimeout(2200);
    await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
    await ctx.close();
  };
  await shot("home", "/wardrobe", { cookie: user.cookie });
  await shot("login", "/login", {});
  await shot("plans", "/profile/subscription", { cookie: user.cookie, full: true });
  await shot("unavailable", "/", { country: "RU" });
  await shot("legal", "/legal/privacy", {});
  await b.close();
}
await db.end();
console.log(`\nИтого: ${pass} прошло, ${failed} не прошло`);
process.exit(failed ? 1 : 0);
