import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";

// Показывается вместо формы, пока не заданы ключи Supabase.
export default async function SupabaseMissing() {
  const t = await getTranslations("auth.missing");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      {/* Для разработчика: нужны переменные окружения из .env.local.example. */}
      <FormMessage tone="info">{t("text")}</FormMessage>
      <Link href="/wardrobe" className="text-center text-sm font-medium underline underline-offset-4">
        {t("open")}
      </Link>
    </AuthShell>
  );
}
