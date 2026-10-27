"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Camera, LoaderCircle, UserRound } from "lucide-react";
import Photo from "@/components/ui/Photo";
import { uploadProfilePhoto } from "@/lib/account";

type Props = {
  path: string | null;
  url: string | null;
  // null — тестовый режим без Supabase: загрузка недоступна.
  enabled: boolean;
  onMessage: (text: string) => void;
};

// Круглое фото профиля (отдельно от аватара) с кнопкой-камерой.
export default function ProfilePhoto({ path: initialPath, url: initialUrl, enabled, onMessage }: Props) {
  const t = useTranslations("profile.photo");
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState({ path: initialPath, url: initialUrl });
  const [uploading, setUploading] = useState(false);

  const placeholder = (
    <span className="flex h-full w-full items-center justify-center">
      <UserRound size={28} strokeWidth={1.25} className="text-text/40" />
    </span>
  );

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return onMessage(t("notAnImage"));
    setUploading(true);
    try {
      setPhoto(await uploadProfilePhoto(file, photo.path));
      onMessage(t("updated"));
    } catch {
      onMessage(t("uploadError"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <span className="relative block h-16 w-16 overflow-hidden rounded-full border border-border bg-beige">
        {photo.url ? (
          <Photo src={photo.url} alt={t("alt")} fit="cover" fallback={placeholder} />
        ) : (
          placeholder
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <LoaderCircle size={20} strokeWidth={2} className="animate-spin text-lavender" />
          </span>
        )}
      </span>
      <input ref={input} type="file" accept="image/*" hidden onChange={handleChange} aria-label={t("alt")} />
      <button
        type="button"
        onClick={() => (enabled ? input.current?.click() : onMessage(t("demo")))}
        disabled={uploading}
        aria-label={photo.url ? t("change") : t("add")}
        className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-lime disabled:opacity-60"
      >
        <Camera size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
