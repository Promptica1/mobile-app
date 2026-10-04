import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export type SettingsRow = { label: string; Icon: LucideIcon; href: string };

export default function SettingsGroup({ rows }: { rows: SettingsRow[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {rows.map(({ label, Icon, href }) => (
        <li key={label}>
          <Link
            href={href}
            className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-subtle"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-subtle">
              <Icon size={18} strokeWidth={1.5} />
            </span>
            <span className="flex-1 text-[15px]">{label}</span>
            <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
