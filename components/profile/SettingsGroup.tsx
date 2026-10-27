import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

// Либо ссылка (href), либо действие (onClick, например открыть панель); value — текущее значение справа.
export type SettingsRow = { label: string; Icon: LucideIcon; href?: string; onClick?: () => void; value?: string };

export default function SettingsGroup({ rows }: { rows: SettingsRow[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {rows.map(({ label, Icon, href, onClick, value }) => {
        const cls = "flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-subtle";
        const content = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle">
              <Icon size={18} strokeWidth={1.5} />
            </span>
            <span className="flex-1 text-[15px]">{label}</span>
            {value && <span className="text-sm text-muted">{value}</span>}
            <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
          </>
        );
        return (
          <li key={label}>
            {href ? (
              <Link href={href} className={cls}>
                {content}
              </Link>
            ) : (
              <button type="button" onClick={onClick} className={cls}>
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
