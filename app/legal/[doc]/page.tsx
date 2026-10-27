import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import BackButton from "@/components/legal/BackButton";
import type { LegalDoc } from "@/lib/legal";
import { legalBlocks } from "@/lib/legal.server";

// Публичная оферта и Политика конфиденциальности. Доступны без входа (ссылка из регистрации).
// Текст — из content/legal/<doc>.md, страница собирается заранее при деплое.

// **жирный** внутри строки.
function inline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold text-text">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

const isDoc = (v: string): v is LegalDoc => v === "offer" || v === "privacy";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ doc: "offer" }, { doc: "privacy" }];
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const t = await getTranslations("legal");
  return { title: isDoc(doc) ? `${t(doc)} — MIRRO` : "MIRRO" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const t = await getTranslations("legal");
  const { blocks, translated } = legalBlocks(doc, await getLocale());
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-1 py-4">
        <BackButton />
        <h1 className="font-serif text-[1.75rem] font-medium leading-tight tracking-tight">{t(doc)}</h1>
      </header>
      {/* Перевода документа ещё нет — показан русский оригинал, предупреждаем об этом. */}
      {!translated && (await getLocale()) !== "ru" && (
        <p className="mb-4 rounded-2xl bg-lavender/20 px-4 py-3 text-xs leading-relaxed">{t("onlyRussian")}</p>
      )}
      <article className="flex flex-col gap-3 pb-4 text-sm leading-relaxed">
        {blocks.map((b, i) =>
          b.kind === "p" ? (
            <p key={i} className="text-text/80">
              {b.text.split("\n").map((line, j) =>
                line.startsWith("- ") ? (
                  <span key={j} className="flex gap-2 pl-1">
                    <span aria-hidden>•</span>
                    <span>{inline(line.slice(2))}</span>
                  </span>
                ) : (
                  <span key={j} className="block">
                    {inline(line)}
                  </span>
                ),
              )}
            </p>
          ) : (
            <h2 key={i} className={`font-medium text-text ${b.kind === "h1" ? "mt-4 text-lg" : "mt-3 text-[15px]"}`}>
              {b.text}
            </h2>
          ),
        )}
      </article>
    </div>
  );
}
