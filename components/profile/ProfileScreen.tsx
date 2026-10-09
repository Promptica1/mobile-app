"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleHelp,
  Info,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { fetchSubscription, isActive, subscriptionNote, type Subscription } from "@/lib/billing";
import { formatPrice, getPlan } from "@/lib/plans";
import { genderLabel, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import type { Tokens } from "@/lib/tokens";
import EditProfileSheet from "./EditProfileSheet";
import ProfilePhoto from "./ProfilePhoto";
import LogoutButton from "./LogoutButton";
import SettingsGroup from "./SettingsGroup";
import TokensCard from "./TokensCard";

type Props = {
  profile: Profile;
  // null — тестовый режим без Supabase: изменения только на экране.
  userId: string | null;
  // Фото профиля (не аватар): путь в бакете и временная ссылка.
  photo: { path: string | null; url: string | null };
  // Токены бета-доступа; null — не настроены.
  tokens: Tokens | null;
};

export default function ProfileScreen({ profile: initial, userId, photo, tokens }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  useEffect(() => {
    fetchSubscription().then(setSubscription, () => setSubscription(null));
  }, []);
  const activeSub = subscription && isActive(subscription) ? subscription : null;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveProfile = async (patch: Pick<Profile, "name" | "gender">) => {
    if (userId) {
      const { error } = await createClient().from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
    }
    setProfile((prev) => ({ ...prev, ...patch }));
    setEditing(false);
    setToast("Профиль сохранён");
    // Обновляем серверные данные, чтобы при возврате на экран имя было новым.
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <h1 className="font-serif text-4xl font-medium leading-none tracking-tight">
        Профиль
      </h1>

      <section className="flex items-center gap-4">
        <ProfilePhoto
          path={photo.path}
          url={photo.url}
          enabled={Boolean(userId)}
          onMessage={setToast}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{profile.name}</p>
          <p className="text-sm text-muted">{genderLabel(profile.gender)}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Редактировать профиль"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
        >
          <Pencil size={18} strokeWidth={1.5} className="text-muted" />
        </button>
      </section>

      {tokens && <TokensCard tokens={tokens} plan={activeSub ? activeSub.plan : null} />}

      {/* Карточка тарифа целиком ведёт на экран «Подписка» (или «Моя подписка», если она есть) */}
      <Link
        href={activeSub ? "/profile/subscription/manage" : "/profile/subscription"}
        aria-label={activeSub ? "Моя подписка" : "Подписка: выбрать тариф"}
        className="block rounded-card bg-gradient-to-br from-lavender/45 via-background to-lime/60 p-5 transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-medium leading-tight">
            {activeSub ? `MIRRO ${getPlan(activeSub.plan).name}` : "Бесплатный план"}
          </h2>
          <span className="rounded-full bg-text px-2.5 py-1 text-[10px] font-semibold tracking-wider text-background">
            {activeSub ? (activeSub.test ? "TEST" : "PRO") : "FREE"}
          </span>
        </div>
        <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-text/70">
          {activeSub?.current_period_end
            ? subscriptionNote(activeSub)
            : `Больше токенов, вещей и папки для образов — от ${formatPrice(getPlan("premium").price)}/мес`}
        </p>
        <span className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-text text-[15px] font-medium text-background">
          {activeSub ? "Управлять подпиской" : "Перейти на Premium"}
        </span>
      </Link>

      <SettingsGroup
        rows={[
          { label: "Мой аватар", Icon: UserRound, href: "/profile/avatar" },
          { label: "Приватность и данные", Icon: ShieldCheck, href: "/profile/privacy" },
          { label: "Помощь и поддержка", Icon: CircleHelp, href: "/profile/help" },
          { label: "О приложении", Icon: Info, href: "/profile/about" },
        ]}
      />

      <LogoutButton />

      {editing && (
        <EditProfileSheet profile={profile} onSave={saveProfile} onClose={() => setEditing(false)} />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
