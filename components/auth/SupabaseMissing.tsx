import Link from "next/link";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";

// Показывается вместо формы, пока не заданы ключи Supabase.
export default function SupabaseMissing() {
  return (
    <AuthShell title="Вход пока не настроен" subtitle="Приложение работает на тестовых данных">
      {/* Для разработчика: нужны переменные окружения из .env.local.example. */}
      <FormMessage tone="info">
        Регистрация и вход временно недоступны. Попробуйте зайти чуть позже.
      </FormMessage>
      <Link href="/wardrobe" className="text-center text-sm font-medium underline underline-offset-4">
        Открыть приложение
      </Link>
    </AuthShell>
  );
}
