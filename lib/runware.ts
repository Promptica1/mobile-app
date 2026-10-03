import "server-only";

// Вырезание одной вещи с фото через генеративную модель Runware.
// Этот модуль работает только на сервере: "server-only" не даст подключить его
// в браузерный код, а RUNWARE_API_KEY без префикса NEXT_PUBLIC_ в браузер не попадает.
//
// REST API Runware: POST https://api.runware.ai/v1, тело — JSON-массив задач,
// авторизация — заголовок "Authorization: Bearer <ключ>".
// Задача imageInference: фото передаётся в inputs.referenceImages, задание — в positivePrompt.

const API_URL = process.env.RUNWARE_API_URL || "https://api.runware.ai/v1";
// По умолчанию Nano Banana 2 (google:4@3). Другую модель можно задать
// переменной RUNWARE_GARMENT_MODEL, например Nano Banana Pro — google:4@2.
const DEFAULT_MODEL = "google:4@3";
// Квадратная карточка, как в каталоге.
const OUTPUT_SIZE = 1024;
// Генерация занимает 10–30 с; после лимита сохраняем исходное фото.
export const TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

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

// Подсказка для модели: что именно вырезать (по категории, которую выбрал пользователь).
const GARMENT_HINTS: Record<string, string> = {
  Верх: "upper-body garment (the t-shirt, shirt, blouse, sweatshirt, hoodie or sweater)",
  Низ: "lower-body garment (the pants, jeans, shorts or skirt)",
  "Верхняя одежда": "outerwear (the coat, jacket, trench or puffer)",
  Обувь: "pair of shoes",
  Аксессуары: "main accessory (the bag, hat, belt, scarf or jewelry)",
};

export function garmentPrompt(category: string) {
  const garment = GARMENT_HINTS[category] ?? "main clothing item";
  return (
    `From this photo, extract ONLY the ${garment} that the person is wearing. ` +
    "Output a clean product photo of just that single item by itself, ghost-mannequin / flat-lay style, " +
    "centered, fully visible, on a plain pure white background. Keep its real color, pattern, print, " +
    "texture, details and shape exactly as in the photo. Remove the person, body parts, the background, " +
    "and all other clothing and objects. No text, no watermark."
  );
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
  const task = tasks[0] as { taskType: string; model?: string };
  log(`sending to Runware, url = ${API_URL}, task = ${task.taskType}${task.model ? `, model = ${task.model}` : ""}`);
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

// Ошибка из-за размеров (у модели может быть свой список допустимых размеров).
const isSizeError = (res: RunwareResponse) =>
  res.status === 400 && res.errors.some((e) => /width|height|dimension|size|resolution/i.test(`${e.parameter} ${e.message}`));

async function readImage(result: RunwareResult, signal: AbortSignal): Promise<Buffer | null> {
  if (result.imageBase64Data) return Buffer.from(result.imageBase64Data, "base64");
  if (result.imageDataURI) return Buffer.from(result.imageDataURI.split(",")[1] ?? "", "base64");
  if (result.imageURL) {
    const res = await fetch(result.imageURL, { signal, cache: "no-store" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

async function run(image: Buffer, mimeType: string, category: string, signal: AbortSignal) {
  const base = {
    taskType: "imageInference",
    model: process.env.RUNWARE_GARMENT_MODEL || DEFAULT_MODEL,
    positivePrompt: garmentPrompt(category),
    inputs: { referenceImages: [`data:${mimeType};base64,${image.toString("base64")}`] },
    numberResults: 1,
    outputType: "base64Data",
    outputFormat: "JPG",
  };

  let taskUUID = crypto.randomUUID();
  let res = await call([{ ...base, taskUUID, width: OUTPUT_SIZE, height: OUTPUT_SIZE }], signal);
  if (isSizeError(res)) {
    // Модель не приняла 1024×1024 — пусть выберет размер сама.
    log("retrying without width/height");
    taskUUID = crypto.randomUUID();
    res = await call([{ ...base, taskUUID }], signal);
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

  const out = await readImage(result, signal);
  if (!out || out.length === 0) throw new RunwareError("failed", "Runware не вернул изображение");
  return out;
}

// Принимает фото и категорию вещи, возвращает изображение одной вещи на белом фоне.
export async function extractGarment(image: Buffer, mimeType: string, category: string): Promise<Buffer> {
  if (!isRunwareConfigured()) throw new RunwareError("not_configured", "RUNWARE_API_KEY не задан");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    return await run(image, mimeType, category, signal);
  } catch (error) {
    if (signal.aborted) {
      log("timeout");
      throw new RunwareError("timeout", `Runware не ответил за ${TIMEOUT_MS / 1000} с`);
    }
    throw error;
  }
}
