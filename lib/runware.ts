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
// noun — как назвать вещь в задании; examples — что к ней относится, чтобы модель
// не перепутала её с соседней одеждой.
const GARMENT_HINTS: Record<string, { noun: string; examples: string; where: string }> = {
  Верх: {
    noun: "top",
    examples: "t-shirt, shirt, blouse, sweatshirt, hoodie, sweater or top",
    where: "on the upper body; not the jacket or coat worn over it",
  },
  Низ: {
    noun: "bottoms",
    examples: "pants, jeans, trousers, shorts or skirt",
    where: "on the lower body",
  },
  "Верхняя одежда": {
    noun: "outerwear piece",
    examples: "coat, jacket, trench, blazer, puffer or parka",
    where: "as the outermost layer",
  },
  Обувь: {
    noun: "pair of shoes",
    examples: "sneakers, boots, loafers, heels or sandals",
    where: "on the feet",
  },
  Аксессуары: {
    noun: "accessory",
    examples: "bag, hat, cap, belt, scarf, sunglasses or jewelry",
    where: "worn or carried",
  },
};

export function garmentPrompt(category: string) {
  const h = GARMENT_HINTS[category] ?? {
    noun: "clothing item",
    examples: "garment",
    where: "on the body",
  };
  return [
    `Task: extract ONLY the ${h.noun} (${h.examples}) currently WORN by the main person in the photo (${h.where}).`,
    `If no one is wearing it, use the single most prominent ${h.noun} in the center of the photo instead.`,
    "Ignore everything else: all other clothing on the person, other people, garments on hangers or racks, " +
      "clothes lying around or hanging in the background, furniture, plants, mirrors, phones and the background itself.",
    `Output: a clean standalone e-commerce product photo of just that single ${h.noun}, ` +
      "ghost-mannequin style for clothing (flat-lay for shoes and accessories), front view, centered, " +
      "fully visible with nothing cropped, on a plain pure white background with a soft natural shadow.",
    "Preserve the real item exactly: the same color and shade, pattern, print, logos, text, fabric texture, " +
      "seams, buttons, zippers, length and fit. If part of it is hidden, reconstruct the hidden part " +
      "consistently with what is visible. Do not invent new details or change the style.",
    "No person, no skin, no hands, no hanger, no mannequin, no extra items, no added text or watermark.",
  ].join(" ");
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
