import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronRight, Shirt } from "lucide-react";
import SubScreen from "@/components/profile/SubScreen";
import { LEGAL_DOCS } from "@/lib/legal";
import pkg from "@/package.json";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("about")} — MIRRO` };
}

export default async function AboutPage() {
  const t = await getTranslations("profile.about");
  const tLegal = await getTranslations("legal");
  return (
    <SubScreen title={t("title")}>
      <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-lavender/60 to-lime/70">
          <Shirt size={40} strokeWidth={1.25} />
        </span>
        <p className="mt-6 font-serif text-4xl font-semibold tracking-[0.25em]">MIRRO</p>
        <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-muted">
          {t("tagline")}
        </p>
        <p className="mt-6 rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-muted">
          {t("version", { version: pkg.version })}
        </p>
      </div>
      <nav aria-label={tLegal("docs")} className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {(["offer", "privacy"] as const).map((doc) => (
          <Link
            key={doc}
            href={LEGAL_DOCS[doc].href}
            className="flex items-center justify-between px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
          >
            {tLegal(doc)}
            <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
          </Link>
        ))}
      </nav>
    </SubScreen>
  );
}
