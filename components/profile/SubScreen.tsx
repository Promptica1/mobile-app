import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

// Экран раздела профиля: стрелка «назад» в Профиль и заголовок. Нижней навигации нет.
export default function SubScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-1 py-4">
        <Link
          href="/profile"
          aria-label="Назад в профиль"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </Link>
        <h1 className="font-serif text-3xl font-medium leading-none tracking-tight">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

// Заглушка «скоро» для разделов, которые появятся позже.
export function ComingSoon({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-lavender/20">{icon}</span>
      <p className="mt-6 font-serif text-3xl font-medium">Скоро</p>
      <p className="mt-2 max-w-[270px] text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
