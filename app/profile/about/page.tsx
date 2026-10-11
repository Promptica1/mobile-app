import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Shirt } from "lucide-react";
import SubScreen from "@/components/profile/SubScreen";
import { LEGAL_DOCS } from "@/lib/legal";
import pkg from "@/package.json";

export const metadata: Metadata = { title: "О приложении — MIRRO" };

export default function AboutPage() {
  return (
    <SubScreen title="О приложении">
      <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-lavender/60 to-lime/70">
          <Shirt size={40} strokeWidth={1.25} />
        </span>
        <p className="mt-6 font-serif text-4xl font-semibold tracking-[0.25em]">MIRRO</p>
        <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-muted">
          Цифровой гардероб: сохраняйте вещи и примеряйте образы на своём AI-аватаре
        </p>
        <p className="mt-6 rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-muted">
          Версия {pkg.version}
        </p>
      </div>
      <nav aria-label="Документы" className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {[LEGAL_DOCS.offer, LEGAL_DOCS.privacy].map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="flex items-center justify-between px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
          >
            {d.title}
            <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
          </Link>
        ))}
      </nav>
    </SubScreen>
  );
}
