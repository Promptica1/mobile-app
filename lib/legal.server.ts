import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE } from "@/i18n/config";
import type { LegalDoc } from "./legal";

const LEGAL_DIR = () => path.join(process.cwd(), "content", "legal");

// Какой файл показывать: перевод content/legal/<документ>.<язык>.md, если он есть и не пуст
// (его проверяет юрист), иначе русский оригинал content/legal/<документ>.md.
function legalFile(doc: LegalDoc, locale: string): { text: string; translated: boolean } {
  if (locale !== DEFAULT_LOCALE) {
    try {
      const text = readFileSync(path.join(LEGAL_DIR(), `${doc}.${locale}.md`), "utf8");
      if (text.trim()) return { text, translated: true };
    } catch {
      // перевода нет — покажем русский текст
    }
  }
  return { text: readFileSync(path.join(LEGAL_DIR(), `${doc}.md`), "utf8"), translated: false };
}

// Текст документа на языке пользователя (или русский, если перевода нет).
export const legalText = (doc: LegalDoc, locale: string = DEFAULT_LOCALE): string => legalFile(doc, locale).text;

// Редакция документа — короткий отпечаток текста: меняется сама при любой правке текста.
// Записывается вместе с согласием пользователя (у перевода своя редакция).
export function legalVersion(doc: LegalDoc, locale: string = DEFAULT_LOCALE): string {
  return createHash("sha256").update(legalText(doc, locale).trim()).digest("hex").slice(0, 12);
}

// Простая разметка: пустая строка — новый абзац, строка с «# » или «## » — заголовок,
// перенос строки внутри абзаца сохраняется, «- » в начале строки — пункт списка,
// **текст** — жирный.
export type LegalBlock = { kind: "h1" | "h2" | "p"; text: string };

// translated: false — показан русский оригинал (перевода нет), страница предупредит об этом.
export function legalBlocks(doc: LegalDoc, locale: string = DEFAULT_LOCALE): { blocks: LegalBlock[]; translated: boolean } {
  const { text, translated } = legalFile(doc, locale);
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): LegalBlock => {
      if (chunk.startsWith("## ")) return { kind: "h2", text: chunk.slice(3).trim() };
      if (chunk.startsWith("# ")) return { kind: "h1", text: chunk.slice(2).trim() };
      return { kind: "p", text: chunk };
    });
  return { blocks, translated };
}
