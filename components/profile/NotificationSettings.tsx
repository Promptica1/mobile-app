"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/useToast";
import {
  NOTIFICATION_OPTIONS,
  fetchNotificationSettings,
  saveNotificationSettings,
  type NotificationKey,
  type NotificationSettings as Settings,
} from "@/lib/notifications";

export default function NotificationSettings() {
  // undefined — загружаются, null — ошибка загрузки.
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined);
  const [demo, setDemo] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    fetchNotificationSettings().then(
      (s) => {
        if (s) return setSettings(s);
        // Тестовый режим без Supabase: показываем значения по умолчанию, не сохраняем.
        setDemo(true);
        setSettings(Object.fromEntries(NOTIFICATION_OPTIONS.map((o) => [o.key, o.on])) as Settings);
      },
      () => setSettings(null),
    );
  }, []);
  useEffect(load, [load]);

  // Переключатель меняется сразу; если сохранить не вышло — возвращаем как было.
  const toggle = async (key: NotificationKey, value: boolean) => {
    if (!settings) return;
    const prev = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (demo) return;
    try {
      await saveNotificationSettings(next);
    } catch {
      setSettings(prev);
      toast.show("Не получилось сохранить. Попробуйте ещё раз.");
    }
  };

  if (settings === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
        <p className="text-[15px] font-medium">Не удалось загрузить настройки</p>
        <p className="mt-1.5 text-sm text-muted">Проверьте интернет и попробуйте ещё раз</p>
        <button
          type="button"
          onClick={() => {
            setSettings(undefined);
            load();
          }}
          className="mt-6 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:border-text/30"
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-sm leading-relaxed text-muted">
        Выберите, о чём вам сообщать. Настройки сохраняются сразу.
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {NOTIFICATION_OPTIONS.map((o) => (
          <li key={o.key} className="flex items-center gap-4 px-4 py-4">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]">{o.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{o.text}</span>
            </span>
            {settings ? (
              <Switch checked={settings[o.key]} onChange={(v) => toggle(o.key, v)} label={o.title} />
            ) : (
              <span className="h-7 w-12 shrink-0 animate-pulse rounded-full bg-border/70" aria-hidden />
            )}
          </li>
        ))}
      </ul>

      <p className="flex gap-2.5 rounded-2xl bg-lavender/20 px-4 py-3 text-xs leading-relaxed">
        <BellRing size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        Сейчас мы сохраняем ваш выбор — сами уведомления начнут приходить в одном из ближайших обновлений.
      </p>

      {toast.node}
    </div>
  );
}
