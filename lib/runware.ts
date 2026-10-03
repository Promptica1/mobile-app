import "server-only";

// Удаление фона через Runware. Этот модуль работает только на сервере:
// "server-only" не даст случайно подключить его в браузерный код,
// а RUNWARE_API_KEY без префикса NEXT_PUBLIC_ в браузер не попадает.
//
// REST API Runware: POST https://api.runware.ai/v1, тело — JSON-массив задач,
// авторизация — заголовок "Authorization: Bearer <ключ>".

const API_URL = process.env.RUNWARE_API_URL || "https://api.runware.ai/v1";
// Модель по умолчанию — Bria RMBG 2.0. Другую (например, Ideogram Background
// Remover) можно задать переменной RUNWARE_BG_MODEL, указав её AIR-идентификатор.
const DEFAULT_MODEL = "runware:110@1";
// Общий лимит на всю работу с Runware; после него — исходное фото.
const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_500;

// Диагностика в логах Vercel. Ключ не логируется — только факт наличия и длина.
const log = (message: string) => console.log(`RB: ${message}`);

export class RunwareError extends Error {
  constructor(
    public reason: "not_configured" | "timeout" | "failed",
    message: string,
  ) {
    super(message);
  }
}

export function isRunwareConfigured() {
  return Boolean(process.env.RUNWARE_API_KEY);
}

type RunwareResult = {
  taskUUID?: string;
  status?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  imageURL?: string;
};
type RunwareResponse = {
  status: number;
  data: RunwareResult[];
  errors: { message?: string; code?: string; parameter?: string }[];
};

async function call(tasks: object[], signal: AbortSignal): Promise<RunwareResponse> {
  log(`sending to Runware, url = ${API_URL}, task = ${(tasks[0] as { taskType: string }).taskType}`);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNWARE_API_KEY}`,
    },
    body: JSON.stringify(tasks),
    signal,
    cache: "no-store",
  });
  const text = await res.text();
  log(`Runware status = ${res.status}, body = ${text.slice(0, 300)}`);
  let json: { data?: RunwareResult[]; errors?: RunwareResponse["errors"] } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // не JSON — разберёмся ниже по статусу
  }
  return { status: res.status, data: json?.data ?? [], errors: json?.errors ?? [] };
}

const hasImage = (r?: RunwareResult) =>
  Boolean(r?.imageBase64Data || r?.imageDataURI || r?.imageURL);

const describe = (res: RunwareResponse) => {
  const e = res.errors[0];
  return `Runware ${res.status}: ${e?.code ?? ""} ${e?.parameter ?? ""} ${e?.message ?? ""}`.trim();
};

// Ошибка из-за формата параметров (а не из-за ключа, баланса или сервера Runware).
const isParameterError = (res: RunwareResponse) =>
  res.status === 400 &&
  res.errors.some((e) => /param|input|image|unsupported|invalid|missing|required/i.test(`${e.code} ${e.parameter} ${e.message}`));

async function readImage(result: RunwareResult, signal: AbortSignal): Promise<Buffer | null> {
  if (result.imageBase64Data) return Buffer.from(result.imageBase64Data, "base64");
  if (result.imageDataURI) return Buffer.from(result.imageDataURI.split(",")[1] ?? "", "base64");
  if (result.imageURL) {
    const res = await fetch(result.imageURL, { signal, cache: "no-store" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

async function run(image: Buffer, mimeType: string, signal: AbortSignal): Promise<Buffer> {
  const dataUri = `data:${mimeType};base64,${image.toString("base64")}`;
  const base = {
    taskType: "removeBackground",
    model: process.env.RUNWARE_BG_MODEL || DEFAULT_MODEL,
    outputType: "base64Data",
    // Прозрачность сохраняется только в PNG.
    outputFormat: "PNG",
  };

  // Текущий формат API — изображение внутри inputs.image. Если Runware
  // отклонит его как неверный параметр, пробуем прежний формат inputImage.
  let taskUUID = crypto.randomUUID();
  let res = await call([{ ...base, taskUUID, inputs: { image: dataUri } }], signal);
  if (isParameterError(res)) {
    log("retrying with legacy inputImage format");
    taskUUID = crypto.randomUUID();
    res = await call([{ ...base, taskUUID, inputImage: dataUri }], signal);
  }
  if (res.status >= 400 || res.errors.length) throw new RunwareError("failed", describe(res));

  let result = res.data.find((r) => r.taskUUID === taskUUID) ?? res.data[0];
  // Ждём результат, только если Runware явно сообщил, что задача ещё в работе.
  while (!hasImage(result)) {
    const status = result?.status;
    if (status !== "processing" && status !== "pending") {
      throw new RunwareError("failed", `Runware не вернул изображение (status = ${status ?? "нет"})`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const polled = await call([{ taskType: "getResponse", taskUUID }], signal);
    if (polled.status >= 400 || polled.errors.length) throw new RunwareError("failed", describe(polled));
    result = polled.data.find((r) => r.taskUUID === taskUUID) ?? polled.data[0];
  }

  const png = await readImage(result, signal);
  if (!png || png.length === 0) throw new RunwareError("failed", "Runware не вернул изображение");
  return png;
}

// Принимает фото (JPEG/PNG/WebP), возвращает PNG с прозрачным фоном.
export async function removeBackground(image: Buffer, mimeType: string): Promise<Buffer> {
  if (!isRunwareConfigured()) throw new RunwareError("not_configured", "RUNWARE_API_KEY не задан");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    return await run(image, mimeType, signal);
  } catch (error) {
    if (signal.aborted) {
      log("timeout");
      throw new RunwareError("timeout", `Runware не ответил за ${TIMEOUT_MS / 1000} с`);
    }
    throw error;
  }
}
