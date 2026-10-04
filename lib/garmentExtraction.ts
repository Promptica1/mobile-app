import { compressImage } from "./image";
import { announceTokensFrom } from "./tokens";

// Отправляем фото и тип вещи на наш сервер (/api/extract-garment), сервер
// обращается к генеративной модели Runware. Ключ Runware хранится только на сервере.

// Модели достаточно 1024 px — так запрос остаётся лёгким.
const PROCESS_MAX_SIDE = 1024;
// Сервер ждёт Runware до 90 с; браузер — с небольшим запасом,
// чтобы «Обработка» никогда не крутилась бесконечно.
const CLIENT_TIMEOUT_MS = 100_000;

// Сколько раз можно запустить AI-вырезание для одной добавляемой вещи
// (первая попытка + повторы через «Загрузить другое фото»). Каждая попытка платная.
export const MAX_EXTRACTION_ATTEMPTS = 3;

// noTokens — токены бета-доступа закончились, вырезание не запускалось.
export type ProcessedPhoto = { blob: Blob; extracted: boolean; noTokens?: boolean };

class NoTokensError extends Error {}

async function requestGarment(photo: Blob, category: string): Promise<Blob> {
  const input = await compressImage(photo, { maxSide: PROCESS_MAX_SIDE });
  const form = new FormData();
  form.append("image", input, "photo.jpg");
  form.append("category", category);
  const res = await fetch("/api/extract-garment", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
  });
  if (res.status === 402) throw new NoTokensError();
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`extract-garment ${res.status}`);
  }
  announceTokensFrom(res);
  // Вещь уже на белом фоне — сохраняем как JPEG, он легче.
  return compressImage(await res.blob(), { maxSide: 1600 });
}

// Никогда не падает: при любой ошибке возвращает исходное (уже сжатое) фото.
export async function processPhoto(original: Blob, category: string): Promise<ProcessedPhoto> {
  try {
    return { blob: await requestGarment(original, category), extracted: true };
  } catch (error) {
    return { blob: original, extracted: false, noTokens: error instanceof NoTokensError };
  }
}
