import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Настройки уведомлений: хранятся в profiles.notification_settings (jsonb).
// Отправку уведомлений подключим позже — сейчас сохраняем выбор пользователя.

export const NOTIFICATION_OPTIONS = [
  { key: "looks_ready", title: "Образ готов", text: "Когда закончилась примерка или создан аватар", on: true },
  { key: "tokens_low", title: "Токены заканчиваются", text: "Когда осталось меньше 5 токенов", on: true },
  { key: "weekly_ideas", title: "Идеи образов", text: "Подборка образов из вашего гардероба раз в неделю", on: true },
  { key: "reminders", title: "Напоминания", text: "Добавить новые вещи и обновить аватар", on: false },
  { key: "news", title: "Новости и акции", text: "Новые функции и специальные предложения", on: false },
] as const;

export type NotificationKey = (typeof NOTIFICATION_OPTIONS)[number]["key"];
export type NotificationSettings = Record<NotificationKey, boolean>;

const DEFAULTS = Object.fromEntries(NOTIFICATION_OPTIONS.map((o) => [o.key, o.on])) as NotificationSettings;

async function userId() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.user.id ?? null;
}

// null — тестовый режим без Supabase.
export async function fetchNotificationSettings(): Promise<NotificationSettings | null> {
  if (!getSupabaseEnv()) return null;
  const id = await userId();
  if (!id) return null;
  const { data, error } = await createClient()
    .from("profiles")
    .select("notification_settings")
    .eq("id", id)
    .maybeSingle<{ notification_settings: Partial<NotificationSettings> | null }>();
  if (error) throw error;
  return { ...DEFAULTS, ...(data?.notification_settings ?? {}) };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const id = await userId();
  if (!id) throw new Error("no session");
  const { error } = await createClient()
    .from("profiles")
    .update({ notification_settings: settings })
    .eq("id", id);
  if (error) throw error;
}
