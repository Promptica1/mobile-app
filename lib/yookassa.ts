import "server-only";

// ЮKassa REST API (https://yookassa.ru/developers/api). Только сервер: shopId и секретный ключ
// берутся из переменных окружения YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY и никогда не уходят
// в браузер и логи. Логи начинаются с "YK:".
//
// Этап 1 — ТОЛЬКО тестовый режим: секретный ключ должен начинаться с "test_".

const API_URL = process.env.YOOKASSA_API_URL ?? "https://api.yookassa.ru/v3";
const TIMEOUT_MS = 20_000;

export class YooKassaError extends Error {
  constructor(public reason: "not_configured" | "live_not_allowed" | "failed", message?: string) {
    super(message ?? reason);
  }
}

function credentials() {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secret = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secret) throw new YooKassaError("not_configured");
  // Боевые ключи на этом этапе не принимаем — чтобы случайно не списать реальные деньги.
  if (!secret.startsWith("test_")) throw new YooKassaError("live_not_allowed");
  return "Basic " + Buffer.from(`${shopId}:${secret}`).toString("base64");
}

export const yookassaMode = () => {
  try {
    credentials();
    return { available: true, test: true } as const;
  } catch (e) {
    return { available: false, test: true, reason: (e as YooKassaError).reason } as const;
  }
};

export type YooKassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  test: boolean;
  amount: { value: string; currency: string };
  description?: string;
  metadata?: Record<string, string>;
  confirmation?: { type: string; confirmation_url?: string };
  payment_method?: {
    id: string;
    type: string;
    saved: boolean;
    card?: { last4?: string; card_type?: string };
  };
  cancellation_details?: { party: string; reason: string };
};

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, idempotenceKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: credentials(), "Content-Type": "application/json" };
  if (idempotenceKey) headers["Idempotence-Key"] = idempotenceKey;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new YooKassaError("failed", `network: ${e instanceof Error ? e.message : String(e)}`);
  }
  const data = (await res.json().catch(() => null)) as (T & { type?: string; code?: string; description?: string }) | null;
  if (!res.ok || !data || data.type === "error") {
    throw new YooKassaError("failed", `HTTP ${res.status} ${data?.code ?? ""} ${data?.description ?? ""}`.trim());
  }
  return data;
}

// Первый платёж подписки: списание сразу (capture) и сохранение карты для будущих автосписаний.
export function createPayment(input: {
  amount: number;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  idempotenceKey: string;
}): Promise<YooKassaPayment> {
  return call<YooKassaPayment>(
    "POST",
    "/payments",
    {
      amount: { value: input.amount.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: input.returnUrl },
      payment_method_data: { type: "bank_card" },
      save_payment_method: true,
      description: input.description,
      metadata: input.metadata,
    },
    input.idempotenceKey,
  );
}

export function getPayment(id: string): Promise<YooKassaPayment> {
  if (!/^[\w-]{10,64}$/.test(id)) throw new YooKassaError("failed", "bad payment id");
  return call<YooKassaPayment>("GET", `/payments/${encodeURIComponent(id)}`);
}
