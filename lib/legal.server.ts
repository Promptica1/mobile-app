import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LegalDoc } from "./legal";

// Текст документа из content/legal/<doc>.md.
export function legalText(doc: LegalDoc): string {
  return readFileSync(path.join(process.cwd(), "content", "legal", `${doc}.md`), "utf8");
}

// Редакция документа — короткий отпечаток текста: меняется сама при любой правке текста.
// Записывается вместе с согласием пользователя.
export function legalVersion(doc: LegalDoc): string {
  return createHash("sha256").update(legalText(doc).trim()).digest("hex").slice(0, 12);
}

// Простая разметка: пустая строка — новый абзац, строка с «# » или «## » — заголовок,
// перенос строки внутри абзаца сохраняется, «- » в начале строки — пункт списка,
// **текст** — жирный.
export type LegalBlock = { kind: "h1" | "h2" | "p"; text: string };

export function legalBlocks(doc: LegalDoc): LegalBlock[] {
  return legalText(doc)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): LegalBlock => {
      if (chunk.startsWith("## ")) return { kind: "h2", text: chunk.slice(3).trim() };
      if (chunk.startsWith("# ")) return { kind: "h1", text: chunk.slice(2).trim() };
      return { kind: "p", text: chunk };
    });
}
