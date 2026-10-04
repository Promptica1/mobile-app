"use client";

import Link from "next/link";
import { useTokens } from "@/lib/tokens";

// Небольшой индикатор оставшихся токенов. Ведёт в Профиль, где подробности.
export default function TokenPill({ className = "" }: { className?: string }) {
  const tokens = useTokens();
  if (!tokens) return null;
  const empty = tokens.balance <= 0;
  return (
    <Link
      href="/profile"
      aria-label={`Осталось токенов: ${tokens.balance}`}
      title="Токены тестового доступа"
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-3 text-xs font-medium tabular-nums backdrop-blur-md transition-colors hover:border-text/30 ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${empty ? "bg-pink" : "bg-lime ring-1 ring-text/15"}`} />
      {tokens.balance}
    </Link>
  );
}
