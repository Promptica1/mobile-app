import crypto from "node:crypto";
import pg from "pg";
import Stripe from "stripe";

const APP = "http://localhost:3100", YK = "http://localhost:54500", ST = "http://localhost:54600", MAIL = "http://localhost:54700";
const db = new pg.Pool({ host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5499), user: process.env.PGUSER ?? "postgres", database: process.env.PGDATABASE ?? "app" });
const q = async (sql, args) => (await db.query(sql, args)).rows;
let pass = 0, failed = 0;
const ok = (cond, name, extra = "") => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, `(got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

async function newUser(email) {
  const [u] = await q("insert into auth.users (email) values ($1) returning id", [email]);
  return { id: u.id, email };
}
function cookie(u) {
  const session = { access_token: `tok-${u.id}`, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user: { id: u.id, email: u.email, aud: "authenticated" } };
  return `sb-localhost-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}
const call = async (u, method, path, body, country = "US") => {
  const res = await fetch(APP + path, { method, redirect: "manual", headers: { cookie: cookie(u), "content-type": "application/json", "x-vercel-ip-country": country }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
};
const post = (url, body) => fetch(url, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
const stripe = new Stripe("sk_test_abc");
const webhook = async (type, object, { badSig = false } = {}) => {
  const payload = JSON.stringify({ id: `evt_${crypto.randomUUID().slice(0, 8)}`, object: "event", type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: badSig ? "whsec_wrong" : "whsec_test_secret" });
  const res = await fetch(APP + "/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
  return { status: res.status, json: await res.json().catch(() => null), payload: JSON.parse(payload) };
};
const balance = async (u) => (await q("select tokens_balance b, tokens_total t from profiles where id = $1", [u.id]))[0];
const subRow = async (u) => (await q("select * from subscriptions where user_id = $1", [u.id]))[0];
const stState = () => fetch(ST + "/__state").then((r) => r.json());
const mails = () => fetch(MAIL + "/__mails").then((r) => r.json());
const run = Date.now();

// ═══════════════════════════ ЮKassa: оплата работает как раньше ═══════════════════════════
console.log("\n[ЮKassa] первая оплата → подписка → токены → повторная оплата → автопродление");
{
  const u = await newUser(`ru-${run}@example.com`);
  const before = await balance(u);
  eq(before.b, 10, "новый пользователь: 10 токенов");

  const noConsent = await call(u, "POST", "/api/payments/create", { plan: "premium" }, "RU");
  eq(noConsent.status, 400, "без согласия платёж не создаётся");
  const created = await call(u, "POST", "/api/payments/create", { plan: "premium", consent: true }, "RU");
  ok(created.status === 200 && /localhost:54500\/pay\//.test(created.json?.confirmationUrl ?? ""), "создан платёж ЮKassa со ссылкой на оплату", JSON.stringify(created.json));
  const order = created.json?.orderId;
  const [pay] = await q("select plan, amount::float a, currency, status from payments where id = $1", [order]);
  eq([pay.plan, pay.a, pay.currency, pay.status], ["premium", 1499, "RUB", "pending"], "сумма 1499 ₽, статус pending");
  const yk = (await fetch(YK + "/__payments").then((r) => r.json())).filter((p) => p.metadata?.order_id === order);
  eq(yk[0]._body.amount, { value: "1499.00", currency: "RUB" }, "в ЮKassa ушло 1499.00 RUB");
  ok(yk[0]._receipt?.items?.[0]?.description === "Подписка MIRRO Premium", "позиция чека — «Подписка MIRRO Premium» по-русски");
  eq((await q("select count(*)::int c from legal_consents where payment_id = $1", [order]))[0].c, 2, "записаны согласия с офертой и политикой");

  const pending = await call(u, "GET", `/api/payments/status?order=${order}`, null, "RU");
  eq(pending.json?.status, "pending", "до оплаты статус pending");
  await post(YK + "/__settle", { id: yk[0].id, result: "success" });
  const done = await call(u, "GET", `/api/payments/status?order=${order}`, null, "RU");
  ok(done.json?.status === "succeeded" && done.json?.cardLast4 === "4477", "после оплаты: succeeded, карта •••• 4477", JSON.stringify(done.json));
  const sub = await subRow(u);
  eq([sub.plan, sub.status, sub.provider], ["premium", "active", "yookassa"], "подписка Premium активна (provider = yookassa)");
  eq((await balance(u)).b, 50, "начислено 50 токенов (как раньше)");
  await call(u, "GET", `/api/payments/status?order=${order}`, null, "RU");
  eq((await balance(u)).b, 50, "повторная проверка не начисляет второй раз");

  const again = await call(u, "POST", "/api/payments/create", { plan: "premium", consent: true }, "RU");
  eq(again.json?.error, "already_subscribed", "второй раз тот же тариф не оформляется");

  // автопродление (cron): период закончился
  await q("update subscriptions set current_period_end = now() - interval '1 hour' where user_id = $1", [u.id]);
  await q("update profiles set tokens_balance = 4 where id = $1", [u.id]);
  const cron = await fetch(APP + "/api/cron/renew", { headers: { authorization: "Bearer cron-secret" } });
  ok(cron.status === 200, "cron автопродления отработал", String(cron.status));
  const after = await subRow(u);
  ok(new Date(after.current_period_end) > new Date(), "период продлён");
  eq((await balance(u)).b, 50, "при продлении баланс сброшен до 50");

  // отмена и возобновление
  const cancel = await call(u, "POST", "/api/subscription", { action: "cancel" }, "RU");
  eq([cancel.status, (await subRow(u)).status], [200, "canceled"], "отмена продления ЮKassa");
  const resume = await call(u, "POST", "/api/subscription", { action: "resume" }, "RU");
  eq([resume.status, (await subRow(u)).status], [200, "active"], "возобновление ЮKassa");

  // подписка Stripe поверх ЮKassa/наоборот не оформляется
  const crossBlock = await call(u, "POST", "/api/stripe/checkout", { offer: "annual", consent: true }, "US");
  eq(crossBlock.json?.error, "already_subscribed", "поверх действующей подписки Stripe не оформляется");

  // неудачная оплата
  const u2 = await newUser(`ru2-${run}@example.com`);
  const c2 = await call(u2, "POST", "/api/payments/create", { plan: "premium_plus", consent: true }, "RU");
  const yk2 = (await fetch(YK + "/__payments").then((r) => r.json())).find((p) => p.metadata.order_id === c2.json.orderId);
  await post(YK + "/__settle", { id: yk2.id, result: "fail" });
  const failedRes = await call(u2, "GET", `/api/payments/status?order=${c2.json.orderId}`, null, "RU");
  eq(failedRes.json?.status, "canceled", "отклонённый платёж: canceled");
  eq((await balance(u2)).b, 10, "при отказе токены не начисляются");
  eq(await subRow(u2), undefined, "при отказе подписка не создаётся");
}

// ═══════════════════════════ Выбор провайдера ═══════════════════════════
console.log("\n[Провайдер] страна → ЮKassa / Stripe");
{
  const u = await newUser(`prov-${run}@example.com`);
  const mode = async (country, extra = {}) => (await fetch(APP + "/api/payments/mode", { headers: { cookie: cookie(u) + (extra.cookie ?? ""), "x-vercel-ip-country": country } })).json();
  eq((await mode("RU")).provider, "yookassa", "Россия → ЮKassa");
  eq((await mode("RU")).currency, "RUB", "валюта ЮKassa — RUB");
  const us = await mode("US");
  eq([us.provider, us.currency, us.available], ["stripe", "USD", true], "США → Stripe, USD, доступно");
  eq((await mode("DE")).provider, "stripe", "Германия → Stripe");
  eq((await mode("US", { cookie: "; mirro_tg=1" })).provider, "yookassa", "Telegram → всегда ЮKassa");
  const wrong = await call(u, "POST", "/api/stripe/checkout", { offer: "annual", consent: true }, "RU");
  eq(wrong.json?.error, "wrong_provider", "из России Stripe-оплата не создаётся");
  const tg = await fetch(APP + "/api/stripe/checkout", { method: "POST", headers: { cookie: cookie(u) + "; mirro_tg=1", "content-type": "application/json", "x-vercel-ip-country": "US" }, body: JSON.stringify({ offer: "annual", consent: true }) });
  eq((await tg.json()).error, "wrong_provider", "из Telegram Stripe-оплата не создаётся");
}

// ═══════════════════════════ Stripe ═══════════════════════════
console.log("\n[Stripe] триал $4,99: оформление → credits → письмо → повтор webhook");
const anna = await newUser(`Anna.${run}@Example.com`);
let annaSub;
{
  const u = anna;
  eq((await call(u, "POST", "/api/stripe/checkout", { offer: "annual" }, "US")).json?.error, "consent_required", "без согласия Checkout не создаётся");
  eq((await call(u, "POST", "/api/stripe/checkout", { offer: "trial_free", consent: true }, "US")).json?.error, "bad_offer", "вариант B выключен флагом → trial_free отклонён");
  eq((await call(u, "POST", "/api/stripe/checkout", { offer: "gold", consent: true }, "US")).json?.error, "bad_offer", "неизвестное предложение отклонено");
  const unauth = await fetch(APP + "/api/stripe/checkout", { method: "POST", redirect: "manual", headers: { "x-vercel-ip-country": "US" }, body: "{}" });
  ok(unauth.status === 307 || unauth.status === 401, "без входа Checkout недоступен", String(unauth.status));

  const chk = await call(u, "POST", "/api/stripe/checkout", { offer: "trial", consent: true }, "US");
  ok(chk.status === 200 && /localhost:54600\/c\/cs_test/.test(chk.json?.url ?? ""), "создана страница оплаты Stripe", JSON.stringify(chk.json));
  const state = await stState();
  const sess = state.sessions.at(-1);
  eq(sess.mode, "subscription", "Checkout в режиме подписки");
  const items = Object.values(sess.params.line_items).map((x) => x.price);
  eq(items, ["price_setup", "price_monthly"], "позиции: разовые $4,99 + подписка $9,99");
  eq(sess.params.subscription_data.trial_period_days, "5", "триал 5 дней");
  eq(sess.params.automatic_tax.enabled, "true", "включён Stripe Tax");
  eq(sess.params.payment_method_collection, "always", "карта обязательна");
  ok(/\$9\.99\/month/.test(sess.params.custom_text.submit.message) && /cancel at any time/i.test(sess.params.custom_text.submit.message), "на странице оплаты: после триала $9,99 в месяц, отмена в любой момент");
  eq(sess.metadata.user_id, u.id, "в сессии user_id");
  eq((await q("select count(*)::int c from legal_consents where user_id = $1 and context = 'payment'", [u.id]))[0].c, 2, "записаны согласия");

  // покупатель оплатил
  const done = await post(ST + "/__complete", { session: sess.id, fingerprint: "fp_anna", interval: "month", paymentStatus: "paid" });
  annaSub = done.subscription;
  const wh = await webhook("checkout.session.completed", { id: sess.id, mode: "subscription", payment_status: "paid", subscription: annaSub, customer: sess.customer, client_reference_id: u.id, metadata: { user_id: u.id, offer: "trial" } });
  eq([wh.status, wh.json?.outcome], [200, "activated"], "webhook checkout.session.completed → activated");
  eq(await balance(u), { b: 15, t: 15 }, "начислено 15 credits");
  const sub = await subRow(u);
  eq([sub.provider, sub.plan, sub.status, sub.offer, sub.is_trial, sub.card_last4], ["stripe", "premium", "active", "trial", true, "4242"], "подписка: Stripe/Premium/триал/карта 4242");
  ok(sub.trial_end && Math.abs(new Date(sub.trial_end) - Date.now() - 5 * 86400e3) < 60e3, "триал заканчивается через 5 дней");
  eq((await q("select count(*)::int c from trial_claims where user_id = $1", [u.id]))[0].c, 1, "триал занят за человеком");
  const m1 = await mails();
  eq([m1.length, m1[0]?.to?.[0]], [1, u.email], "письмо о покупке отправлено");
  ok(/trial/i.test(m1[0]?.subject ?? "") && /\$4\.99/.test(m1[0]?.text ?? "") && !/[А-Яа-я]/.test(m1[0]?.text ?? ""), "письмо на английском, указано $4.99");
  ok(m1[0]?.auth === "Bearer re_test" && m1[0]?.from.includes("MIRRO"), "письмо ушло через Resend с ключом из окружения");

  await db.query("update profiles set tokens_balance = 9 where id = $1", [u.id]);
  const again = await webhook("checkout.session.completed", wh.payload.data.object);
  eq(again.json?.outcome, "already_applied", "повтор webhook → already_applied");
  eq((await balance(u)).b, 9, "повтор не пополняет credits");
  eq((await mails()).length, 1, "повтор не шлёт второе письмо");

  const status = await call(u, "GET", `/api/stripe/status?session=${sess.id}`, null, "US");
  ok(status.json?.status === "succeeded" && status.json?.trial === true && status.json?.cardLast4 === "4242", "экран результата: триал начался", JSON.stringify(status.json));
  const bad = await webhook("checkout.session.completed", wh.payload.data.object, { badSig: true });
  eq(bad.status, 400, "webhook с неверной подписью отклонён (400)");
}

console.log("\n[Stripe] один триал на человека");
{
  // тот же человек, другой аккаунт, почта с +меткой и точками — до оплаты отказ
  const alias = await newUser(`anna.${run}+second@example.com`);
  const pre = await call(alias, "POST", "/api/stripe/checkout", { offer: "trial", consent: true }, "US");
  eq([pre.status, pre.json?.error], [409, "trial_used"], "та же почта (алиас): триал недоступен ещё до оплаты");
  // страница тарифов для такого человека не предлагает триал
  const page = await fetch(APP + "/profile/subscription", { headers: { cookie: cookie(alias), "x-vercel-ip-country": "US" } }).then((r) => r.text());
  ok(!/5-day trial/.test(page) && /Premium/.test(page), "на экране тарифов триала нет, есть обычный Premium");
  // можно взять обычный Premium без триала
  const monthly = await call(alias, "POST", "/api/stripe/checkout", { offer: "monthly", consent: true }, "US");
  eq(monthly.status, 200, "Premium без триала доступен");

  // другая почта, но та же карта
  const other = await newUser(`other-${run}@example.com`);
  const chk = await call(other, "POST", "/api/stripe/checkout", { offer: "trial", consent: true }, "US");
  eq(chk.status, 200, "другая почта: Checkout создаётся");
  const sess = (await stState()).sessions.at(-1);
  const done = await post(ST + "/__complete", { session: sess.id, fingerprint: "fp_anna", interval: "month", paymentStatus: "paid" });
  const wh = await webhook("checkout.session.completed", { id: sess.id, mode: "subscription", payment_status: "paid", subscription: done.subscription, customer: sess.customer, client_reference_id: other.id, metadata: { user_id: other.id, offer: "trial" } });
  eq(wh.json?.outcome, "trial_rejected", "та же карта: триал отклонён");
  const st = await stState();
  ok(st.subs.find((s) => s.id === done.subscription)?.status === "canceled", "подписка отклонённого триала отменена в Stripe");
  eq(st.refunds.length, 1, "деньги за триал возвращены");
  eq(await balance(other), { b: 10, t: 10 }, "credits не начислены");
  eq(await subRow(other), undefined, "подписка в базе не создана");
  const del = await webhook("customer.subscription.deleted", { id: done.subscription });
  eq(del.json?.outcome, "other_subscription", "событие об отменённом дубле не трогает чужие данные");

  // новый человек с новой картой — триал есть
  const fresh = await newUser(`fresh-${run}@example.com`);
  const c2 = await call(fresh, "POST", "/api/stripe/checkout", { offer: "trial", consent: true }, "US");
  const s2 = (await stState()).sessions.at(-1);
  const d2 = await post(ST + "/__complete", { session: s2.id, fingerprint: "fp_fresh", interval: "month", paymentStatus: "paid" });
  const w2 = await webhook("checkout.session.completed", { id: s2.id, mode: "subscription", payment_status: "paid", subscription: d2.subscription, customer: s2.customer, client_reference_id: fresh.id, metadata: { user_id: fresh.id, offer: "trial" } });
  eq([c2.status, w2.json?.outcome, (await balance(fresh)).b], [200, "activated", 15], "новый человек и новая карта: триал выдан, 15 credits");
}

console.log("\n[Stripe] продление: credits сбрасываются; отмена; карта; окончание");
{
  const u = anna;
  // конец триала: первая оплата $9,99
  const t = Math.floor(Date.now() / 1000);
  await post(ST + "/__sub", { id: annaSub, patch: { status: "active", period_start: t, period_end: t + 30 * 86400, trial_end: null } });
  const inv = { id: "in_cycle1", billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: annaSub } } };
  const r1 = await webhook("invoice.paid", inv);
  eq([r1.json?.outcome, (await balance(u)).b], ["activated", 30], "invoice.paid после триала: баланс 30 (неиспользованное сгорело)");
  eq((await subRow(u)).is_trial, false, "триал закончился, подписка обычная");
  await db.query("update profiles set tokens_balance = 12 where id = $1", [u.id]);
  eq((await webhook("invoice.paid", inv)).json?.outcome, "already_applied", "повтор invoice.paid не начисляет");
  eq((await balance(u)).b, 12, "баланс не тронут повтором");
  const first = await webhook("invoice.paid", { id: "in_create1", billing_reason: "subscription_create", parent: { subscription_details: { subscription: annaSub } } });
  eq([first.json?.outcome, (await balance(u)).b], ["synced", 12], "счёт subscription_create credits не начисляет");

  // отмена продления в один тап
  const cancel = await call(u, "POST", "/api/stripe/subscription", { action: "cancel" }, "US");
  eq(cancel.status, 200, "отмена продления: один запрос");
  let sub = await subRow(u);
  eq(sub.status, "canceled", "статус canceled, доступ до конца периода");
  ok(new Date(sub.current_period_end) > new Date(), "оплаченный период ещё идёт");
  eq((await balance(u)).b, 12, "при отмене credits не трогаем");
  const resume = await call(u, "POST", "/api/stripe/subscription", { action: "resume" }, "US");
  eq([resume.status, (await subRow(u)).status], [200, "active"], "возобновление продления");

  // смена карты
  const change = await call(u, "POST", "/api/stripe/subscription", { action: "change_card" }, "US");
  ok(change.status === 200 && /localhost:54600\/c\/cs_test/.test(change.json?.url ?? ""), "смена карты: ссылка на Checkout (setup)");
  const csess = (await stState()).sessions.at(-1);
  eq([csess.mode, csess.metadata.subscription_id], ["setup", annaSub], "сессия смены карты привязана к подписке");

  // удаление карты
  const unlink = await call(u, "POST", "/api/stripe/subscription", { action: "unlink_card" }, "US");
  eq(unlink.status, 200, "удаление сохранённой карты");
  sub = await subRow(u);
  eq([sub.status, sub.card_last4], ["canceled", null], "карты нет, продление отключено");
  ok(new Date(sub.current_period_end) > new Date(), "доступ сохраняется до конца периода");
  eq((await call(u, "POST", "/api/stripe/subscription", { action: "resume" }, "US")).json?.error, "no_card", "без карты возобновить нельзя");

  // окончание подписки
  await post(ST + "/__sub", { id: annaSub, patch: { status: "canceled" } });
  const end = await webhook("customer.subscription.deleted", { id: annaSub });
  eq([end.json?.outcome, (await balance(u)).b], ["expired", 0], "подписка закончилась: credits обнулены");
  eq((await subRow(u)).status, "expired", "статус expired");
}

console.log("\n[Stripe] Premium annual: 25 credits в месяц, cron, письма");
{
  const u = await newUser(`year-${run}@example.com`);
  const chk = await call(u, "POST", "/api/stripe/checkout", { offer: "annual", consent: true }, "US");
  const s = (await stState()).sessions.at(-1);
  eq(Object.values(s.params.line_items).map((x) => x.price), ["price_annual"], "годовая цена");
  eq(s.params.subscription_data.trial_period_days, undefined, "у годового плана нет триала");
  const d = await post(ST + "/__complete", { session: s.id, fingerprint: "fp_year", interval: "year", paymentStatus: "paid" });
  const w = await webhook("checkout.session.completed", { id: s.id, mode: "subscription", payment_status: "paid", subscription: d.subscription, customer: s.customer, client_reference_id: u.id, metadata: { user_id: u.id, offer: "annual" } });
  eq([chk.status, w.json?.outcome, (await balance(u)).b], [200, "activated", 25], "годовой план: 25 credits");
  let sub = await subRow(u);
  eq([sub.billing_interval, sub.is_trial], ["year", false], "интервал — год");
  const next = new Date(sub.credits_next_grant_at);
  ok(Math.abs(next - Date.now() - 30 * 86400e3) < 3 * 86400e3, "следующий месячный пакет — примерно через месяц", String(sub.credits_next_grant_at));

  // cron: наступил срок месячного пакета
  await db.query("update profiles set tokens_balance = 3 where id = $1", [u.id]);
  await db.query("update subscriptions set credits_next_grant_at = now() - interval '1 hour' where user_id = $1", [u.id]);
  const cron1 = await fetch(APP + "/api/cron/stripe", { headers: { authorization: "Bearer cron-secret" } }).then((r) => r.json());
  eq((await balance(u)).b, 25, "cron: месячный пакет, баланс сброшен до 25");
  ok(cron1.creditGrants >= 1, "cron сообщил о начислении", JSON.stringify(cron1));
  sub = await subRow(u);
  ok(new Date(sub.credits_next_grant_at) > new Date(), "дата следующего пакета сдвинута");
  await db.query("update profiles set tokens_balance = 7 where id = $1", [u.id]);
  await fetch(APP + "/api/cron/stripe", { headers: { authorization: "Bearer cron-secret" } });
  eq((await balance(u)).b, 7, "повторный запуск cron в тот же день не начисляет второй раз");
  eq((await fetch(APP + "/api/cron/stripe")).status, 401, "cron без секрета закрыт");

  // письмо за 7 дней до продления года
  await fetch(MAIL + "/__reset");
  await db.query("update subscriptions set current_period_end = now() + interval '6 days 12 hours' where user_id = $1", [u.id]);
  const cron2 = await fetch(APP + "/api/cron/stripe", { headers: { authorization: "Bearer cron-secret" } }).then((r) => r.json());
  const m = await mails();
  ok(cron2.annualEmails === 1 && m.length === 1 && /annual plan renews in 7 days/i.test(m[0].subject) && /\$49\.99\/year/.test(m[0].text), "письмо о продлении годового плана за 7 дней ($49.99/year)", JSON.stringify(cron2));
  await fetch(APP + "/api/cron/stripe", { headers: { authorization: "Bearer cron-secret" } });
  eq((await mails()).length, 1, "второе напоминание за то же продление не отправляется");
}

console.log("\n[Stripe] письмо на 4-й день триала");
{
  const u = await newUser(`trialmail-${run}@example.com`);
  await db.query("insert into subscriptions (user_id, plan, status, provider, stripe_subscription_id, offer, is_trial, trial_end, current_period_end) values ($1,'premium','active','stripe','sub_x1','trial',true, now() + interval '30 hours', now() + interval '30 hours')", [u.id]);
  const u2 = await newUser(`trialmail2-${run}@example.com`);
  await db.query("insert into subscriptions (user_id, plan, status, provider, stripe_subscription_id, offer, is_trial, trial_end, current_period_end) values ($1,'premium','active','stripe','sub_x2','trial',true, now() + interval '3 days', now() + interval '3 days')", [u2.id]);
  await fetch(MAIL + "/__reset");
  await fetch(APP + "/api/cron/stripe", { headers: { authorization: "Bearer cron-secret" } }).then((r) => r.json());
  const m = await mails();
  eq(m.filter((x) => x.to[0] === u.email).length, 1, "за ~30 часов до конца триала письмо отправлено");
  ok(/trial ends/i.test(m.find((x) => x.to[0] === u.email)?.subject ?? "") && /\$9\.99\/month/.test(m.find((x) => x.to[0] === u.email)?.text ?? ""), "в письме: триал заканчивается, потом $9.99/month");
  eq(m.filter((x) => x.to[0] === u2.email).length, 0, "за 3 дня до конца письма ещё нет");
  await fetch(APP + "/api/cron/stripe", { headers: { authorization: "Bearer cron-secret" } });
  eq((await mails()).filter((x) => x.to[0] === u.email).length, 1, "письмо отправляется один раз");
}

console.log("\n[Stripe] платёж не прошёл");
{
  const u = await newUser(`pastdue-${run}@example.com`);
  await call(u, "POST", "/api/stripe/checkout", { offer: "monthly", consent: true }, "US");
  const s = (await stState()).sessions.at(-1);
  const d = await post(ST + "/__complete", { session: s.id, fingerprint: "fp_pd", interval: "month", paymentStatus: "paid" });
  await webhook("checkout.session.completed", { id: s.id, mode: "subscription", payment_status: "paid", subscription: d.subscription, customer: s.customer, client_reference_id: u.id, metadata: { user_id: u.id, offer: "monthly" } });
  eq((await balance(u)).b, 30, "Premium без триала: 30 credits");
  await post(ST + "/__sub", { id: d.subscription, patch: { status: "past_due" } });
  const f = await webhook("invoice.payment_failed", { id: "in_fail", billing_reason: "subscription_cycle", parent: { subscription_details: { subscription: d.subscription } } });
  eq([f.json?.outcome, (await subRow(u)).status], ["synced", "past_due"], "invoice.payment_failed → past_due");
}

console.log("\n[Stripe] смена карты");
{
  const u = await newUser(`card-${run}@example.com`);
  await call(u, "POST", "/api/stripe/checkout", { offer: "monthly", consent: true }, "US");
  const s = (await stState()).sessions.at(-1);
  const d = await post(ST + "/__complete", { session: s.id, fingerprint: "fp_old", last4: "4242", interval: "month", paymentStatus: "paid" });
  await webhook("checkout.session.completed", { id: s.id, mode: "subscription", payment_status: "paid", subscription: d.subscription, customer: s.customer, client_reference_id: u.id, metadata: { user_id: u.id, offer: "monthly" } });
  eq((await subRow(u)).card_last4, "4242", "старая карта 4242");
  const ch = await call(u, "POST", "/api/stripe/subscription", { action: "change_card" }, "US");
  const cs = (await stState()).sessions.at(-1);
  eq(ch.status, 200, "ссылка на смену карты");
  await post(ST + "/__complete_setup", { session: cs.id, last4: "1111", fingerprint: "fp_new" });
  const fin = await call(u, "POST", "/api/stripe/subscription", { action: "finish_card_change", sessionId: cs.id }, "US");
  eq(fin.status, 200, "возврат со страницы смены карты");
  const sub = await subRow(u);
  eq([sub.card_last4, sub.card_type], ["1111", "mastercard"], "новая карта 1111 сохранена в подписке");
  const other = await newUser(`card2-${run}@example.com`);
  eq((await call(other, "POST", "/api/stripe/subscription", { action: "finish_card_change", sessionId: cs.id }, "US")).status, 404, "чужую сессию смены карты применить нельзя");
  const w2 = await webhook("checkout.session.completed", { id: cs.id, mode: "setup", customer: cs.customer, metadata: cs.metadata });
  eq(w2.json?.outcome, "setup_applied", "webhook смены карты тоже безопасен");
}

console.log(`\nИтого: ${pass} прошло, ${failed} не прошло`);
await db.end();
process.exit(failed ? 1 : 0);
