import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BackButton from "@/components/legal/BackButton";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { legalBlocks } from "@/lib/legal.server";

// Публичная оферта и Политика конфиденциальности. Доступны без входа (ссылка из регистрации).
// Текст — из content/legal/<doc>.md, страница собирается заранее при деплое.

const isDoc = (v: string): v is LegalDoc => v === "offer" || v === "privacy";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ doc: "offer" }, { doc: "privacy" }];
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: isDoc(doc) ? `${LEGAL_DOCS[doc].title} — MIRRO` : "MIRRO" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const blocks = legalBlocks(doc);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-1 py-4">
        <BackButton />
        <h1 className="font-serif text-[1.75rem] font-medium leading-tight tracking-tight">{LEGAL_DOCS[doc].title}</h1>
      </header>
      <article className="flex flex-col gap-3 pb-4 text-sm leading-relaxed">
        {blocks.map((b, i) =>
          b.kind === "p" ? (
            <p key={i} className="whitespace-pre-line text-text/80">
              {b.text}
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
