import "server-only";

// Удаление фона через Runware. Этот модуль работает только на сервере:
// "server-only" не даст случайно подключить его в браузерный код,
// а RUNWARE_API_KEY без префикса NEXT_PUBLIC_ в браузер не попадает.

const API_URL = process.env.RUNWARE_API_URL || "https://api.runware.ai/v1";
// Модель по умолчанию — Bria RMBG 2.0. Другую (например, Ideogram Background
// Remover) можно задать переменной RUNWARE_BG_MODEL, указав её AIR-идентификатор.
const DEFAULT_MODEL = "runware:110@1";
const TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 1_500;

export class RunwareError extends Error {
  constructor(
    public reason: "not_configured" | "failed",
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

async function call(tasks: object[], signal: AbortSignal): Promise<RunwareResult[]> {
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
  const json = (await res.json().catch(() => null)) as {
    data?: RunwareResult[];
    errors?: { message?: string; code?: string }[];
  } | null;
  if (!res.ok || !json || json.errors?.length) {
    const detail = json?.errors?.[0];
    throw new RunwareError("failed", `Runware ${res.status}: ${detail?.code ?? ""} ${detail?.message ?? ""}`.trim());
  }
  return json.data ?? [];
}

async function readImage(result: RunwareResult, signal: AbortSignal): Promise<Buffer | null> {
  if (result.imageBase64Data) return Buffer.from(result.imageBase64Data, "base64");
  if (result.imageDataURI) return Buffer.from(result.imageDataURI.split(",")[1] ?? "", "base64");
  if (result.imageURL) {
    const res = await fetch(result.imageURL, { signal, cache: "no-store" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

// Принимает фото (JPEG/PNG), возвращает PNG с прозрачным фоном.
export async function removeBackground(image: Buffer, mimeType: string): Promise<Buffer> {
  if (!isRunwareConfigured()) {
    throw new RunwareError("not_configured", "RUNWARE_API_KEY не задан");
  }
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const taskUUID = crypto.randomUUID();

  const [first] = await call(
    [
      {
        taskType: "removeBackground",
        taskUUID,
        model: process.env.RUNWARE_BG_MODEL || DEFAULT_MODEL,
        inputImage: `data:${mimeType};base64,${image.toString("base64")}`,
        outputType: "base64Data",
        // Прозрачность сохраняется только в PNG.
        outputFormat: "PNG",
      },
    ],
    signal,
  );

  let result = first;
  // Некоторые модели отвечают не сразу — тогда спрашиваем результат по taskUUID.
  while (!result?.imageBase64Data && !result?.imageDataURI && !result?.imageURL) {
    if (result?.status === "error") throw new RunwareError("failed", "Runware: задача завершилась с ошибкой");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const polled = await call([{ taskType: "getResponse", taskUUID }], signal);
    result = polled.find((r) => r.taskUUID === taskUUID) ?? polled[0];
  }

  const png = await readImage(result, signal);
  if (!png || png.length === 0) throw new RunwareError("failed", "Runware не вернул изображение");
  return png;
}
