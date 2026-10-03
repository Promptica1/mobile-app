// Подготовка фото в браузере: уменьшаем, учитываем поворот из EXIF и
// перекодируем, чтобы снимки с телефона (5–15 МБ) весили сотни килобайт.

type Options = {
  maxSide?: number;
  type?: "image/jpeg" | "image/webp";
  quality?: number;
  // Для JPEG прозрачность заменяется белым; для вырезанных вещей оставляем прозрачной.
  keepTransparency?: boolean;
};

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // Учитываем поворот из EXIF, иначе фото с телефона может лечь боком.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Некоторые браузеры не умеют decode для части форматов — пробуем через <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(
  file: Blob,
  { maxSide = 1600, type = "image/jpeg", quality = 0.85, keepTransparency = false }: Options = {},
): Promise<Blob> {
  const image = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  if (!keepTransparency) {
    // Белая подложка: у PNG с прозрачностью фон не станет чёрным.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  if ("close" in image) image.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось сжать фото"))),
      type,
      quality,
    ),
  );
}
