import { compressImage } from "./image";

// Отправляем фото на наш сервер (/api/remove-background), сервер обращается
// к Runware. Ключ Runware хранится только на сервере.

// Для удаления фона достаточно 1024 px — так запрос и ответ остаются лёгкими.
const PROCESS_MAX_SIDE = 1024;

export type ProcessedPhoto = { blob: Blob; cutout: boolean };

async function requestCutout(photo: Blob): Promise<Blob> {
  const input = await compressImage(photo, { maxSide: PROCESS_MAX_SIDE });
  const form = new FormData();
  form.append("image", input, "photo.jpg");
  const res = await fetch("/api/remove-background", { method: "POST", body: form });
  if (!res.ok || res.headers.get("content-type") !== "image/png") {
    throw new Error(`remove-background ${res.status}`);
  }
  const png = await res.blob();
  // Сохраняем прозрачность. WebP заметно легче PNG; если браузер не умеет
  // кодировать WebP (старый Safari), оставляем PNG.
  const webp = await compressImage(png, {
    maxSide: PROCESS_MAX_SIDE,
    type: "image/webp",
    quality: 0.9,
    keepTransparency: true,
  });
  return webp.type === "image/webp" ? webp : png;
}

// Никогда не падает: при любой ошибке возвращает исходное (уже сжатое) фото.
export async function processPhoto(original: Blob): Promise<ProcessedPhoto> {
  try {
    return { blob: await requestCutout(original), cutout: true };
  } catch {
    return { blob: original, cutout: false };
  }
}
