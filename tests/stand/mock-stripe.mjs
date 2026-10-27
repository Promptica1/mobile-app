// Поддельный Stripe API (подмножество, которое использует приложение) + поддельный Resend.
import http from "node:http";

const db = { customers: new Map(), sessions: new Map(), subs: new Map(), pms: new Map(), charges: [], refunds: [], calls: [] };
let n = 0;
const nid = (p) => `${p}_${String(++n).padStart(6, "0")}`;
const now = () => Math.floor(Date.now() / 1000);
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

// form-urlencoded с вложенностью a[b][0][c]=v → объект
function parseForm(s) {
  const out = {};
  for (const [k, v] of new URLSearchParams(s)) {
    const parts = k.replace(/\]/g, "").split("[");
    let o = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) o[p] = v;
      else o = o[p] ??= {};
    });
  }
  return out;
}

function subObject(s) {
  const pm = s.pm ? db.pms.get(s.pm) : null;
  return {
    id: s.id, object: "subscription", customer: s.customer, status: s.status, cancel_at_period_end: s.cancel_at_period_end,
    start_date: s.start, trial_end: s.trial_end ?? null, metadata: s.metadata, livemode: false,
    default_payment_method: pm ? { id: pm.id, object: "payment_method", card: pm.card } : null,
    items: { object: "list", data: [{ price: { id: s.price, recurring: { interval: s.interval } }, current_period_start: s.period_start, current_period_end: s.period_end }] },
  };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let body = ""; for await (const c of req) body += c;
  const f = parseForm(body || url.search.slice(1));
  db.calls.push(`${req.method} ${url.pathname}`);
  const p = url.pathname;
  let m;

  // ── управление из теста ──
  if (p === "/__complete") { // покупатель оплатил Checkout картой
    const b = JSON.parse(body);
    const s = db.sessions.get(b.session);
    const pm = { id: nid("pm"), card: { last4: b.last4 ?? "4242", brand: "visa", fingerprint: b.fingerprint } };
    db.pms.set(pm.id, { ...pm, customer: s.customer });
    const sid = nid("sub");
    const interval = b.interval ?? "month";
    const trialDays = Number(s.params.subscription_data?.trial_period_days ?? 0);
    const t = now();
    const sub = { id: sid, customer: s.customer, status: trialDays ? "trialing" : "active", cancel_at_period_end: false, start: t, period_start: t,
      period_end: trialDays ? t + trialDays * 86400 : t + (interval === "year" ? 365 : 30) * 86400, trial_end: trialDays ? t + trialDays * 86400 : null,
      metadata: s.params.subscription_data?.metadata ?? {}, pm: pm.id, interval, price: "price_x" };
    db.subs.set(sid, sub);
    if (!b.noCharge) db.charges.push({ id: nid("ch"), customer: s.customer, paid: true, refunded: false, amount: trialDays ? 499 : 999 });
    s.status = "complete"; s.payment_status = b.paymentStatus ?? "paid"; s.subscription = sid;
    return send(res, 200, { subscription: sid });
  }
  if (p === "/__complete_setup") { // покупатель ввёл новую карту на странице смены карты
    const b = JSON.parse(body);
    const s = db.sessions.get(b.session);
    const pm = { id: nid("pm"), card: { last4: b.last4, brand: "mastercard", fingerprint: b.fingerprint } };
    db.pms.set(pm.id, { ...pm, customer: s.customer });
    s.status = "complete"; s.setup_intent = { id: nid("seti"), object: "setup_intent", payment_method: pm.id };
    return send(res, 200, { pm: pm.id });
  }
  if (p === "/__sub") { // поменять подписку (имитация событий Stripe)
    const b = JSON.parse(body); Object.assign(db.subs.get(b.id), b.patch); return send(res, 200, subObject(db.subs.get(b.id)));
  }
  if (p === "/__state") return send(res, 200, { subs: [...db.subs.values()], sessions: [...db.sessions.values()], charges: db.charges, refunds: db.refunds, calls: db.calls, customers: [...db.customers.values()] });

  // ── Stripe API ──
  if (req.method === "POST" && p === "/v1/customers") { const c = { id: nid("cus"), object: "customer", email: f.email, metadata: f.metadata ?? {}, invoice_settings: { default_payment_method: null } }; db.customers.set(c.id, c); return send(res, 200, c); }
  if ((m = /^\/v1\/customers\/(\w+)$/.exec(p))) {
    const c = db.customers.get(m[1]);
    if (!c) return send(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such customer" } });
    if (req.method === "POST") { if (f.invoice_settings) c.invoice_settings = { default_payment_method: f.invoice_settings.default_payment_method || null }; }
    return send(res, 200, c);
  }
  if (req.method === "GET" && p === "/v1/payment_methods") {
    const data = [...db.pms.values()].filter((x) => x.customer === f.customer).map((x) => ({ id: x.id, object: "payment_method", card: x.card }));
    return send(res, 200, { object: "list", data, has_more: false, url: p });
  }
  if ((m = /^\/v1\/payment_methods\/(\w+)\/detach$/.exec(p))) { db.pms.delete(m[1]); return send(res, 200, { id: m[1], object: "payment_method" }); }
  if (req.method === "POST" && p === "/v1/checkout/sessions") {
    const customer = f.customer;
    if (customer && !db.customers.has(customer)) return send(res, 400, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such customer" } });
    const s = { id: nid("cs_test"), object: "checkout.session", mode: f.mode, customer, status: "open", payment_status: "unpaid", metadata: f.metadata ?? {}, client_reference_id: f.client_reference_id ?? null, subscription: null, setup_intent: null, params: f };
    s.url = `http://localhost:54600/c/${s.id}`;
    db.sessions.set(s.id, s);
    return send(res, 200, s);
  }
  if ((m = /^\/v1\/checkout\/sessions\/(\w+)$/.exec(p)) && req.method === "GET") {
    const s = db.sessions.get(m[1]); if (!s) return send(res, 404, { error: { code: "resource_missing", message: "no" } });
    const out = { ...s }; delete out.params; return send(res, 200, out);
  }
  if ((m = /^\/v1\/subscriptions\/(\w+)$/.exec(p))) {
    const s = db.subs.get(m[1]); if (!s) return send(res, 404, { error: { code: "resource_missing", message: "no" } });
    if (req.method === "POST") {
      if ("cancel_at_period_end" in f) s.cancel_at_period_end = f.cancel_at_period_end === "true";
      if ("default_payment_method" in f) s.pm = f.default_payment_method || null;
    }
    if (req.method === "DELETE") s.status = "canceled";
    return send(res, 200, subObject(s));
  }
  if (req.method === "GET" && p === "/v1/charges") { const data = db.charges.filter((c) => c.customer === f.customer).reverse().slice(0, Number(f.limit ?? 10)); return send(res, 200, { object: "list", data, has_more: false, url: p }); }
  if (req.method === "POST" && p === "/v1/refunds") { const c = db.charges.find((x) => x.id === f.charge); c.refunded = true; db.refunds.push(c.id); return send(res, 200, { id: nid("re"), object: "refund", charge: c.id, status: "succeeded" }); }
  send(res, 404, { error: { type: "invalid_request_error", message: `mock: ${req.method} ${p}` } });
}).listen(54600, () => console.log("mock stripe on :54600"));

// ── Resend ──
const mails = [];
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  if (req.url === "/__mails") return send(res, 200, mails);
  if (req.url === "/__reset") { mails.length = 0; return send(res, 200, {}); }
  if (req.method === "POST" && req.url === "/emails") { const b = JSON.parse(body); mails.push({ to: b.to, subject: b.subject, from: b.from, auth: req.headers.authorization, text: b.text }); return send(res, 200, { id: "mail_1" }); }
  send(res, 404, {});
}).listen(54700, () => console.log("mock resend on :54700"));
