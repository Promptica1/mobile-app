// Иконки приложения из логотипа scripts/icons/logo.jpg (квадрат). Запуск: node scripts/generate-icons.mjs
// Создаёт: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, public/apple-touch-icon.png,
// app/icon.png, app/favicon.ico. Нужен пакет sharp (уже есть в зависимостях Next.js).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "scripts/icons/logo.jpg");
const out = (p) => path.join(root, p);

const square = (size) => sharp(src).resize(size, size, { fit: "cover" }).png().toBuffer();

// Maskable: ОС обрезает иконку маской (круг, «squircle»), поэтому логотип занимает центральные 80%,
// а поля — зеркальное продолжение его краёв (без белых рамок и швов).
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const pad = Math.floor((size - inner) / 2);
  const logo = await sharp(src).resize(inner, inner, { fit: "cover" }).png().toBuffer();
  return sharp(logo)
    .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, extendWith: "mirror" })
    .png()
    .toBuffer();
}

// Favicon 16–48 px: надпись MIRRO целиком не читается, берём крупный фрагмент с буквой «M».
async function faviconPng(size) {
  const meta = await sharp(src).metadata();
  const k = meta.width / 1080;
  const side = Math.round(168 * k);
  return sharp(src)
    .extract({ left: Math.round(314 * k - side / 2), top: Math.round(545 * k - side / 2), width: side, height: side })
    .resize(size, size)
    .ensureAlpha() // сборщик Next.js читает ICO только с PNG в формате RGBA
    .png()
    .toBuffer();
}

// ICO с PNG внутри (поддерживают все современные браузеры).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

writeFileSync(out("public/icons/icon-192.png"), await square(192));
writeFileSync(out("public/icons/icon-512.png"), await square(512));
writeFileSync(out("public/icons/icon-maskable-512.png"), await maskable(512));
writeFileSync(out("public/apple-touch-icon.png"), await square(180));
writeFileSync(out("app/icon.png"), await square(192));
writeFileSync(out("app/favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await faviconPng(size) })))));
console.log("icons generated");
