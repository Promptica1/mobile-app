"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { isLocale } from "@/i18n/config";
import { readLocaleCookie, saveLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Сводит язык устройства и язык профиля (раз за открытие приложения, только для вошедших):
// - на устройстве язык выбран явно (cookie) → профиль подстраивается под него;
// - явного выбора нет, а в профиле язык есть (выбрали на другом устройстве) → берём его;
// - нигде ничего нет → записываем в профиль тот язык, что определился по телефону.
// Без колонки profiles.locale (SQL ещё не запущен) ничего не делает.
export default function LocaleSync() {
  const router = useRouter();
  const current = useLocale();

  useEffect(() => {
    if (!getSupabaseEnv()) return;
    let alive = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !alive) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", session.user.id)
        .maybeSingle<{ locale: string | null }>();
      if (error || !data || !alive) return;
      const saved = isLocale(data.locale) ? data.locale : null;
      const chosen = readLocaleCookie();
      const target = chosen ?? saved ?? (isLocale(current) ? current : null);
      if (!target) return;
      if (saved === target && session.user.user_metadata?.locale === target && chosen === target) return;
      try {
        await saveLocale(target);
        if (target !== current && alive) router.refresh();
      } catch {
        // Не критично: язык синхронизируется при следующем открытии.
      }
    })();
    return () => {
      alive = false;
    };
  }, [current, router]);

  return null;
}
