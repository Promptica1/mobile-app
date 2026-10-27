import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronRight, EyeOff, Lock, Sparkles } from "lucide-react";
import DeleteAccount from "@/components/profile/DeleteAccount";
import ExportData from "@/components/profile/ExportData";
import SubScreen from "@/components/profile/SubScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: `${t("privacy")} — MIRRO` };
}

const POINTS = [
  { Icon: Sparkles, key: "p1" },
  { Icon: Lock, key: "p2" },
  { Icon: EyeOff, key: "p3" },
] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("profile.privacyPage");
  const tLegal = await getTranslations("legal");
  return (
    <SubScreen title={t("title")}>
      <ul className="flex flex-col gap-3">
        {POINTS.map(({ Icon, key }) => (
          <li key={key} className="flex gap-3.5 rounded-card border border-border bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender/20">
              <Icon size={18} strokeWidth={1.5} />
            </span>
            <span>
              <span className="block text-[15px] font-medium">{t(`${key}Title`)}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{t(`${key}Text`)}</span>
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <h2 className="px-1 text-sm font-medium">{t("yourData")}</h2>
        <p className="mb-3 mt-1 px-1 text-sm leading-relaxed text-muted">
          {t("yourDataText")}
        </p>
        <ExportData />
        <Link
          href="/legal/privacy"
          className="mt-3 flex items-center justify-between rounded-card border border-border bg-surface px-4 py-4 text-[15px] transition-colors hover:bg-subtle"
        >
          {tLegal("privacy")}
          <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
        </Link>
      </section>

      <section className="mt-auto pt-10">
        <h2 className="px-1 text-sm font-medium">{t("deleteTitle")}</h2>
        <p className="mb-4 mt-1 px-1 text-sm leading-relaxed text-muted">
          {t("deleteText")}
        </p>
        <DeleteAccount />
      </section>
    </SubScreen>
  );
}
