import "server-only";

// Генеративные задачи Runware: вырезание одной вещи с фото и создание аватара.
// Этот модуль работает только на сервере: "server-only" не даст подключить его
// в браузерный код, а RUNWARE_API_KEY без префикса NEXT_PUBLIC_ в браузер не попадает.
//
// REST API Runware: POST https://api.runware.ai/v1, тело — JSON-массив задач,
// авторизация — заголовок "Authorization: Bearer <ключ>".
// Задача imageInference: фото передаётся в inputs.referenceImages, задание — в positivePrompt.

const API_URL = process.env.RUNWARE_API_URL || "https://api.runware.ai/v1";
// По умолчанию Nano Banana 2 (google:4@3). Другую модель можно задать
// переменными RUNWARE_GARMENT_MODEL (вещи) и RUNWARE_AVATAR_MODEL (аватар),
// например Nano Banana Pro — google:4@2.
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

// Уточнение пользователя для AI: одна строка, без кавычек, не длиннее лимита.
export const GARMENT_HINT_MAX = 200;
export const cleanHint = (hint: string | null | undefined) =>
  (hint ?? "").replace(/[\r\n"«»]+/g, " ").replace(/\s+/g, " ").trim().slice(0, GARMENT_HINT_MAX);

export function garmentPrompt(category: string, hint?: string | null) {
  const userHint = cleanHint(hint);
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
    // Уточнение от пользователя (обычно по-русски) — помогает исправить ошибки AI.
    userHint
      ? `Additional instructions from the user about this item (may be in Russian) — follow them carefully ` +
        `when extracting and rendering the item, as long as they do not conflict with the rules above: "${userHint}".`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
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

type GenerateOptions = {
  prompt: string;
  // Фото-референсы (JPEG/PNG/WebP).
  images: { data: Buffer; mimeType: string }[];
  width: number;
  height: number;
  model?: string;
};

async function run({ prompt, images, width, height, model }: GenerateOptions, signal: AbortSignal) {
  const base = {
    taskType: "imageInference",
    model: model || process.env.RUNWARE_GARMENT_MODEL || DEFAULT_MODEL,
    positivePrompt: prompt,
    inputs: {
      referenceImages: images.map((i) => `data:${i.mimeType};base64,${i.data.toString("base64")}`),
    },
    numberResults: 1,
    outputType: "base64Data",
    outputFormat: "JPG",
  };

  let taskUUID = crypto.randomUUID();
  let res = await call([{ ...base, taskUUID, width, height }], signal);
  if (isSizeError(res)) {
    // Модель не приняла размер — пусть выберет его сама.
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

// Генерация картинки по фото-референсам с общим лимитом времени.
async function generateImage(options: GenerateOptions): Promise<Buffer> {
  if (!isRunwareConfigured()) throw new RunwareError("not_configured", "RUNWARE_API_KEY не задан");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    return await run(options, signal);
  } catch (error) {
    if (signal.aborted) {
      log("timeout");
      throw new RunwareError("timeout", `Runware не ответил за ${TIMEOUT_MS / 1000} с`);
    }
    throw error;
  }
}

// Принимает фото и категорию вещи, возвращает изображение одной вещи на белом фоне.
export function extractGarment(
  image: Buffer,
  mimeType: string,
  category: string,
  hint?: string | null,
): Promise<Buffer> {
  return generateImage({
    prompt: garmentPrompt(category, hint),
    images: [{ data: image, mimeType }],
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
  });
}

// ── Аватар для «Примерки» ──────────────────────────────────────────────

// Вертикальный кадр в полный рост (3:4).
const AVATAR_WIDTH = 896;
const AVATAR_HEIGHT = 1200;

export type AvatarParams = {
  hasFullBody: boolean;
  heightCm?: number | null;
  weightKg?: number | null;
  gender?: "female" | "male" | null;
};

export function avatarPrompt({ hasFullBody, heightCm, weightKg, gender }: AvatarParams) {
  const person = gender === "female" ? "woman" : gender === "male" ? "man" : "person";
  const body = [
    heightCm ? `height about ${heightCm} cm` : "",
    weightKg ? `weight about ${weightKg} kg` : "",
  ].filter(Boolean);
  return [
    `Create a photorealistic full-body portrait of the SAME ${person} shown in the reference photo${hasFullBody ? "s" : ""}.`,
    "Reference image 1 is a selfie: keep exactly their face, facial features, skin tone, hair color, " +
      "hairstyle and overall likeness — it must be clearly recognizable as the same person.",
    hasFullBody
      ? "Reference image 2 is a full-body photo of the same person: match their real body shape, build and proportions from it."
      : "Infer natural, realistic body proportions that match the person in the selfie.",
    body.length ? `Body proportions should correspond to ${body.join(" and ")}.` : "",
    "Pose: the whole body from head to toe fully in frame with feet visible, standing straight and facing the camera, " +
      "neutral relaxed pose, arms relaxed slightly away from the body, calm neutral expression, eyes looking at the camera.",
    "Clothing: plain simple fitted basics only — a plain fitted light beige crew-neck top and plain fitted light beige " +
      "shorts or leggings, no logos, no prints; barefoot.",
    "Background: clean seamless soft off-white studio background (#FAF8F6), soft even studio lighting, " +
      "sharp focus, realistic skin texture, natural proportions, centered composition.",
    "Exactly one person. No accessories, no jewelry, no bag, no phone, no glasses, no text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

// Принимает селфи и (необязательно) фото в полный рост, возвращает аватар в полный рост.
export function createAvatar(
  selfie: { data: Buffer; mimeType: string },
  fullBody: { data: Buffer; mimeType: string } | null,
  params: Omit<AvatarParams, "hasFullBody">,
): Promise<Buffer> {
  return generateImage({
    prompt: avatarPrompt({ ...params, hasFullBody: Boolean(fullBody) }),
    images: fullBody ? [selfie, fullBody] : [selfie],
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT,
    model: process.env.RUNWARE_AVATAR_MODEL,
  });
}

// ── Примерка: аватар в выбранных вещах ─────────────────────────────────

// Как называть вещь в задании по категории гардероба.
const TRY_ON_ROLES: Record<string, string> = {
  Верх: "top (worn on the upper body)",
  Низ: "bottoms (worn on the lower body)",
  "Верхняя одежда": "outerwear (worn as the outer layer over the top)",
  Обувь: "shoes (worn on the feet)",
  Аксессуары: "accessory",
};

export type TryOnGarment = { data: Buffer; mimeType: string; category: string; name: string };

export function tryOnPrompt(garments: Pick<TryOnGarment, "category" | "name">[]) {
  const list = garments
    .map((g, i) => `reference image ${i + 2} — ${TRY_ON_ROLES[g.category] ?? "clothing item"} ("${g.name}")`)
    .join("; ");
  const hasOuter = garments.some((g) => g.category === "Верхняя одежда");
  const hasShoes = garments.some((g) => g.category === "Обувь");
  return [
    "Reference image 1 is a full-body photo of a person (the avatar).",
    `The other reference images are clothing items to put on this person: ${list}.`,
    "Generate the SAME person from image 1 now WEARING all of these items together as one complete, realistic outfit.",
    "Keep exactly the same face, facial features, skin tone, hair, body shape and proportions, the same pose and camera angle, " +
      "and the same plain soft off-white studio background and lighting as in image 1.",
    "Each item must keep its real color, pattern, print, logos, fabric texture and design exactly as in its reference image, " +
      "and be properly fitted to the body with natural folds, drape and realistic shadows.",
    "Correct layering: " +
      (hasOuter ? "the outerwear is worn over the top; " : "") +
      "the top is tucked in or left untucked as looks natural for its style; the bottoms sit naturally at the waist.",
    "Items that are not provided stay as the plain basics from image 1" + (hasShoes ? "" : " (keep the feet as in image 1)") + ".",
    "Full body from head to toe fully in frame with the feet visible, centered. Exactly one person, photorealistic. " +
      "No extra accessories or items, no text, no watermark.",
  ].join(" ");
}

// Аватар (первая картинка) + вещи → тот же человек в этом образе, в полный рост.
export function tryOnOutfit(
  avatar: { data: Buffer; mimeType: string },
  garments: TryOnGarment[],
): Promise<Buffer> {
  return generateImage({
    prompt: tryOnPrompt(garments),
    images: [avatar, ...garments.map((g) => ({ data: g.data, mimeType: g.mimeType }))],
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT,
    model: process.env.RUNWARE_TRYON_MODEL,
  });
}
