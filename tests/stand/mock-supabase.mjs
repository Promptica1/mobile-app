// Тестовый стенд: поддельный Supabase поверх настоящей Postgres (с реальными миграциями приложения).
// REST (PostgREST-подмножество) → SQL, /auth/v1/user и /auth/v1/admin/users — поверх auth.users.
import http from "node:http";
import pg from "pg";

const pool = new pg.Pool({ host: process.env.PGHOST ?? "/tmp", port: Number(process.env.PGPORT ?? 5499), user: process.env.PGUSER ?? "postgres", database: process.env.PGDATABASE ?? "app" });
const ID = /^[a-z_][a-z0-9_]*$/;
const id = (s) => { if (!ID.test(s)) throw new Error(`bad identifier ${s}`); return `"${s}"`; };

const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", ...extra });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const pgError = (e) => {
  const map = { "23505": 409, "23503": 409, "23514": 400, "42883": 404, "42703": 400, "42P01": 404 };
  const status = map[e.code] ?? 400;
  return [status, { code: e.code === "42883" ? "PGRST202" : e.code, message: e.message, details: e.detail ?? null, hint: null }];
};

function where(params, startIdx, values) {
  const conds = [];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = /^(not\.)?(eq|neq|lt|lte|gt|gte|is|in)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, neg, op, val] = m;
    let c;
    if (op === "is") c = `${id(k)} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`;
    else if (op === "in") {
      const items = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      values.push(items);
      c = `${id(k)}::text = any($${values.length}::text[])`;
    } else {
      values.push(val);
      const sym = { eq: "=", neq: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=" }[op];
      c = `${id(k)} ${sym} $${values.length}`;
    }
    conds.push(neg ? `not (${c})` : c);
  }
  return conds.length ? ` where ${conds.join(" and ")}` : "";
}

async function rest(req, res, url, body) {
  const path = url.pathname.replace("/rest/v1/", "");
  const params = [...url.searchParams.entries()];
  const prefer = req.headers.prefer ?? "";
  const wantRep = prefer.includes("return=representation");
  const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  const respond = (rows, status = 200) => {
    if (single) {
      if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `Results contain ${rows.length} rows` });
      return send(res, status, rows[0]);
    }
    return send(res, status, rows);
  };
  try {
    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      const args = body ? JSON.parse(body) : {};
      const keys = Object.keys(args);
      const sql = `select public.${id(fn)}(${keys.map((k, i) => `${id(k)} => $${i + 1}`).join(", ")}) as r`;
      const r = await pool.query(sql, keys.map((k) => args[k]));
      return send(res, 200, r.rows[0]?.r ?? null);
    }
    const table = `public.${id(path)}`;
    if (req.method === "GET" || req.method === "HEAD") {
      const sel = url.searchParams.get("select");
      const cols = !sel || sel === "*" ? "*" : sel.split(",").map((c) => id(c.trim())).join(", ");
      const values = [];
      let sql = `select ${cols} from ${table}${where(params, 1, values)}`;
      const order = url.searchParams.get("order");
      if (order) sql += ` order by ${order.split(",").map((o) => { const [c, d] = o.split("."); return `${id(c)} ${d === "desc" ? "desc" : "asc"}`; }).join(", ")}`;
      if (url.searchParams.get("limit")) sql += ` limit ${Number(url.searchParams.get("limit"))}`;
      const r = await pool.query(sql, values);
      return respond(r.rows);
    }
    const data = body ? JSON.parse(body) : null;
    if (req.method === "POST") {
      const arr = Array.isArray(data) ? data : [data];
      const cols = [...new Set(arr.flatMap((o) => Object.keys(o)))];
      let sql = `insert into ${table} (${cols.map(id).join(", ")}) select ${cols.map(id).join(", ")} from jsonb_populate_recordset(null::${table}, $1::jsonb)`;
      if (prefer.includes("resolution=merge-duplicates")) {
        const conflict = (url.searchParams.get("on_conflict") ?? "").split(",").filter(Boolean);
        sql += ` on conflict (${conflict.map(id).join(", ")}) do update set ${cols.filter((c) => !conflict.includes(c)).map((c) => `${id(c)} = excluded.${id(c)}`).join(", ")}`;
      } else if (prefer.includes("resolution=ignore-duplicates")) sql += " on conflict do nothing";
      if (wantRep) sql += " returning *";
      const r = await pool.query(sql, [JSON.stringify(arr)]);
      return wantRep ? respond(r.rows, 201) : send(res, 201);
    }
    if (req.method === "PATCH") {
      const cols = Object.keys(data);
      const values = [JSON.stringify(data)];
      const w = where(params, 2, values);
      let sql = `update ${table} t set ${cols.map((c) => `${id(c)} = r.${id(c)}`).join(", ")} from jsonb_populate_record(null::${table}, $1::jsonb) r${w.replaceAll(/"([a-z_]+)"/g, (m, c) => `t."${c}"`)}`;
      if (wantRep) sql += " returning t.*";
      const r = await pool.query(sql, values);
      return wantRep ? respond(r.rows) : send(res, 204);
    }
    if (req.method === "DELETE") {
      const values = [];
      let sql = `delete from ${table}${where(params, 1, values)}`;
      if (wantRep) sql += " returning *";
      const r = await pool.query(sql, values);
      return wantRep ? respond(r.rows) : send(res, 204);
    }
    send(res, 405, { message: "method" });
  } catch (e) {
    const [status, err] = pgError(e);
    console.log(`MOCK-SB error: ${req.method} ${url.pathname}${url.search} → ${e.message}`);
    send(res, status, err);
  }
}

const userJson = (row) => ({ id: row.id, aud: "authenticated", role: "authenticated", email: row.email, app_metadata: {}, user_metadata: row.raw_user_meta_data ?? {}, created_at: row.created_at });

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, "http://x");
  let body = "";
  for await (const chunk of req) body += chunk;
  if (url.pathname.startsWith("/rest/v1/")) return rest(req, res, url, body);
  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const m = /^Bearer tok-([0-9a-f-]{36})$/.exec(req.headers.authorization ?? "");
    if (!m) return send(res, 401, { code: 401, msg: "bad token" });
    const r = await pool.query("select * from auth.users where id = $1", [m[1]]);
    return r.rows[0] ? send(res, 200, userJson(r.rows[0])) : send(res, 401, { code: 401, msg: "no user" });
  }
  const adm = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(url.pathname);
  if (adm) {
    if (req.method === "GET") {
      const r = await pool.query("select * from auth.users where id = $1", [adm[1]]);
      return r.rows[0] ? send(res, 200, userJson(r.rows[0])) : send(res, 404, { msg: "not found" });
    }
    if (req.method === "PUT") {
      const b = JSON.parse(body || "{}");
      if (b.user_metadata) await pool.query("update auth.users set raw_user_meta_data = $2::jsonb where id = $1", [adm[1], JSON.stringify(b.user_metadata)]);
      const r = await pool.query("select * from auth.users where id = $1", [adm[1]]);
      return send(res, 200, userJson(r.rows[0]));
    }
  }
  send(res, 404, { message: `mock: ${req.method} ${url.pathname}` });
}).listen(54321, () => console.log("mock supabase on :54321"));
