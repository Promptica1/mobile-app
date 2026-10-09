import { NextResponse, type NextRequest } from "next/server";
import { applyPayment, type PaymentRow } from "@/lib/payments.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, YooKassaError } from "@/lib/yookassa";

// Уведомления ЮKassa (webhook): включают подписку, даже если пользователь закрыл вкладку
// и не вернулся в приложение. Адрес публичный (вход не нужен), поэтому телу запроса
// НЕ доверяем: берём из него только id платежа и заново запрашиваем платёж у ЮKassa
// по API с нашим секретным ключом. Применение идемпотентно (см. lib/payments.server.ts).
//
// Ответ 200 — «принято, больше не присылать». Ответ 5xx — временная ошибка, ЮKassa
// повторит уведомление позже. Логи — "YK[webhook]:".

const HANDLED = new Set(["payment.succeeded", "payment.canceled", "payment.waiting_for_capture"]);

const ok = () => NextResponse.json({ ok: true });
const retryLater = (reason: string) => {
  console.log(`YK[webhook]: temporary error, ask to retry: ${reason}`);
  return NextResponse.json({ error: "retry" }, { status: 500 });
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body = (await request.json().catch(() => null)) as
    | { type?: string; event?: string; object?: { id?: unknown } }
    | null;
  const event = body?.event ?? "";
  const paymentId = typeof body?.object?.id === "string" ? body.object.id : "";
  console.log(`YK[webhook]: event = ${event || "-"}, payment = ${paymentId || "-"}, from ${ip}`);

  // Чужие и неизвестные уведомления просто подтверждаем — обрабатывать нечего.
  if (body?.type !== "notification" || !HANDLED.has(event) || !/^[\w-]{10,64}$/.test(paymentId)) return ok();

  const admin = createAdminClient();
  if (!admin) return retryLater("service role key not configured");

  // Проверка подлинности: настоящий статус платежа — только из API ЮKassa.
  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (error) {
    if (error instanceof YooKassaError && error.reason === "failed" && /HTTP 404/.test(error.message)) {
      console.log(`YK[webhook]: payment ${paymentId} not found in YooKassa — ignore`);
      return ok();
    }
    return retryLater(error instanceof Error ? error.message : String(error));
  }

  // Наш заказ — по id платежа ЮKassa (и сверка с metadata внутри applyPayment).
  const { data: row, error } = await admin
    .from("payments")
    .select("*")
    .eq("yookassa_payment_id", payment.id)
    .maybeSingle<PaymentRow>();
  if (error) return retryLater(`db: ${error.message}`);
  if (!row) {
    console.log(`YK[webhook]: no order for payment ${payment.id} (order_id in metadata = ${payment.metadata?.order_id ?? "-"}) — ignore`);
    return ok();
  }

  try {
    const outcome = await applyPayment(admin, row, payment, "webhook");
    console.log(`YK[webhook]: payment ${payment.id} → ${outcome.kind}`);
    return ok();
  } catch (e) {
    return retryLater(e instanceof Error ? e.message : String(e));
  }
}
