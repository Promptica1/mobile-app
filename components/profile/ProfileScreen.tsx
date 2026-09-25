import {
  Bell,
  Camera,
  CircleHelp,
  Info,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { genderLabel, type Profile } from "@/lib/profile";
import LogoutButton from "./LogoutButton";
import SettingsGroup from "./SettingsGroup";

export default function ProfileScreen({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <h1 className="font-serif text-4xl font-medium leading-none tracking-tight">
        Профиль
      </h1>

      <section className="flex items-center gap-4">
        <div className="relative shrink-0">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-beige">
            <UserRound size={28} strokeWidth={1.25} className="text-text/40" />
          </span>
          <button
            type="button"
            aria-label="Сменить фото"
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-lime"
          >
            <Camera size={12} strokeWidth={2} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{profile.name}</p>
          <p className="text-sm text-muted">{genderLabel(profile.gender)}</p>
        </div>
        <button
          type="button"
          aria-label="Редактировать профиль"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
        >
          <Pencil size={18} strokeWidth={1.5} className="text-muted" />
        </button>
      </section>

      <section className="rounded-card bg-gradient-to-br from-lavender/45 via-background to-lime/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-medium leading-tight">Бесплатный план</h2>
          <span className="rounded-full bg-text px-2.5 py-1 text-[10px] font-semibold tracking-wider text-background">
            FREE
          </span>
        </div>
        <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-text/70">
          Расширьте гардероб, аватар и образы без ограничений
        </p>
        <button
          type="button"
          className="mt-5 h-12 w-full rounded-full bg-text text-[15px] font-medium text-background transition-transform active:scale-[0.98]"
        >
          Перейти на Premium
        </button>
      </section>

      <SettingsGroup
        rows={[
          { label: "Мой аватар", Icon: UserRound },
          { label: "Уведомления", Icon: Bell },
          { label: "Приватность и данные", Icon: ShieldCheck },
        ]}
      />
      <SettingsGroup
        rows={[
          { label: "Помощь и поддержка", Icon: CircleHelp },
          { label: "О приложении", Icon: Info },
        ]}
      />

      <LogoutButton />
    </div>
  );
}
