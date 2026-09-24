import { ChevronRight, type LucideIcon } from "lucide-react";

export type SettingsRow = { label: string; Icon: LucideIcon };

// Разделы настроек подключим позже — пока строки только визуальные.
export default function SettingsGroup({ rows }: { rows: SettingsRow[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {rows.map(({ label, Icon }) => (
        <li key={label}>
          <button
            type="button"
            className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-background"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background">
              <Icon size={18} strokeWidth={1.5} />
            </span>
            <span className="flex-1 text-[15px]">{label}</span>
            <ChevronRight size={18} strokeWidth={1.5} className="text-muted" />
          </button>
        </li>
      ))}
    </ul>
  );
}
