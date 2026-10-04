"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import Silhouette from "@/components/Silhouette";
import AvatarSetup from "@/components/try-on/AvatarSetup";
import { Button } from "@/components/ui/Button";
import Photo from "@/components/ui/Photo";
import { fetchAvatar, hasAvatarSupport, type Avatar } from "@/lib/avatar";

// «Мой аватар»: посмотреть текущий аватар и создать/обновить его тем же экраном, что в Примерке.
export default function MyAvatar() {
  // undefined — загружается, null — ошибка.
  const [avatar, setAvatar] = useState<Avatar | null | undefined>(undefined);
  const [setup, setSetup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAvatar().then(setAvatar, () => setAvatar(null));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (avatar === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
        <p className="text-[15px] font-medium">Не удалось загрузить аватар</p>
        <p className="mt-1.5 text-sm text-muted">Проверьте интернет и попробуйте ещё раз</p>
        <button
          type="button"
          onClick={() => {
            setAvatar(undefined);
            load();
          }}
          className="mt-6 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium transition-colors hover:border-text/30"
        >
          Повторить
        </button>
      </div>
    );
  }

  const silhouette = (
    <Silhouette
      variant="filled"
      className={`h-full w-full px-10 py-[8%] text-text/15 ${avatar === undefined ? "animate-pulse" : ""}`}
    />
  );
  const has = Boolean(avatar?.path);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-card bg-gradient-to-b from-beige to-[#e9dfd2]">
        {avatar?.url ? <Photo src={avatar.url} alt="Ваш аватар" fit="cover" fallback={silhouette} /> : silhouette}
      </div>

      {avatar && (
        <>
          <p className="px-1 text-center text-sm leading-relaxed text-muted">
            {has
              ? "На этот аватар вы примеряете одежду. Новые образы будут собираться на обновлённом аватаре, а сохранённые останутся как есть."
              : "Аватара пока нет. Создайте его по селфи — и примеряйте вещи из гардероба."}
            {(avatar.heightCm || avatar.weightKg) && (
              <span className="mt-1 block">
                {[avatar.heightCm && `Рост ${avatar.heightCm} см`, avatar.weightKg && `вес ${avatar.weightKg} кг`]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            )}
          </p>
          <Button
            variant="lime"
            onClick={() => (hasAvatarSupport() ? setSetup(true) : setToast("Аватар недоступен в тестовом режиме"))}
          >
            {has ? <RefreshCw size={18} strokeWidth={1.75} /> : <Sparkles size={18} strokeWidth={1.75} />}
            {has ? "Обновить аватар" : "Создать аватар"}
          </Button>
        </>
      )}

      {setup && avatar && (
        <AvatarSetup
          mode={has ? "update" : "create"}
          current={avatar}
          onDone={(a) => {
            setAvatar(a);
            setSetup(false);
            setToast(has ? "Аватар обновлён" : "Аватар готов");
          }}
          onClose={() => setSetup(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
