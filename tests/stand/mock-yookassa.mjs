import http from "node:http";
const payments = new Map();
let n = 0;
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let body = ""; for await (const c of req) body += c;
  const b = body ? JSON.parse(body) : {};
  if (req.method === "POST" && url.pathname === "/v3/payments") {
    const key = req.headers["idempotence-key"];
    const existing = [...payments.values()].find((p) => p._key === key);
    if (existing) return send(res, 200, existing);
    const id = `2f${String(++n).padStart(8, "0")}-000f-5000-8000-1a2b3c4d5e6f`;
    const auto = Boolean(b.payment_method_id);
    const p = { id, status: "pending", paid: false, test: true, amount: b.amount, description: b.description, metadata: b.metadata, _key: key, _auto: auto, _receipt: b.receipt, _body: b,
      confirmation: auto ? undefined : { type: "redirect", confirmation_url: `http://localhost:54500/pay/${id}` } };
    payments.set(id, p);
    return send(res, 200, p);
  }
  const m = /^\/v3\/payments\/([\w-]+)$/.exec(url.pathname);
  if (req.method === "GET" && m) {
    const p = payments.get(m[1]);
    if (!p) return send(res, 404, { type: "error", code: "not_found", description: "no" });
    if (p._auto && p.status === "pending") settle(p, "success"); // автосписание проходит сразу
    return send(res, 200, p);
  }
  if (url.pathname === "/__settle") { const p = payments.get(b.id); settle(p, b.result, b.method); return send(res, 200, p); }
  if (url.pathname === "/__payments") return send(res, 200, [...payments.values()]);
  send(res, 404, { type: "error", code: "not_found", description: url.pathname });
}).listen(54500, () => console.log("mock yookassa on :54500"));
function settle(p, result, method = "bank_card") {
  if (result === "success") {
    p.status = "succeeded"; p.paid = true;
    p.payment_method = method === "sbp" ? { id: "pm-sbp-1", type: "sbp", saved: true } : { id: "pm-card-1234", type: "bank_card", saved: true, card: { last4: "4477", card_type: "MasterCard" } };
  } else { p.status = "canceled"; p.cancellation_details = { party: "yoo_money", reason: "insufficient_funds" }; }
}
