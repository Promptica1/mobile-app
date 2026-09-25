import Link from "next/link";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";

// Показывается вместо формы, пока не заданы ключи Supabase.
export default function SupabaseMissing() {
  return (
    <AuthShell title="Вход пока не настроен" subtitle="Приложение работает на тестовых данных">
      <FormMessage tone="info">
        Добавьте переменные NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY
        в настройках проекта, чтобы включить регистрацию и вход.
      </FormMessage>
      <Link href="/wardrobe" className="text-center text-sm font-medium underline underline-offset-4">
        Открыть приложение
      </Link>
    </AuthShell>
  );
}
