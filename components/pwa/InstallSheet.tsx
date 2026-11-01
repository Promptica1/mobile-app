"use client";

import { useTranslations } from "next-intl";
import { Check, EllipsisVertical, ExternalLink, Plus, Share, SquarePlus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { androidChromeIntent } from "@/lib/inapp-browser";
import type { Variant } from "@/lib/pwa";

type Props = {
  variant: Variant;
  os: "ios" | "android" | "other";
  href: string;
  onInstall: () => void;
  onClose: () => void;
};

function Step({ n, Icon, title, hint }: { n: number; Icon: LucideIcon; title: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-subtle">
        <Icon size={22} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-[15px] font-medium">
          <span className="mr-1.5 text-muted tabular-nums">{n}.</span>
          {title}
        </span>
        {hint && <span className="mt-0.5 block text-sm leading-relaxed text-muted">{hint}</span>}
      </span>
    </li>
  );
}

// Нижнее окно установки. Содержимое зависит от браузера: туториал для iPhone, кнопка для Chrome,
// «откройте в браузере» для встроенных браузеров (Instagram, Facebook, TikTok, Telegram).
// Это отдельный экран от подсказки про оплату (components/InAppBrowserHint.tsx).
export default function InstallSheet({ variant, os, href, onInstall, onClose }: Props) {
  const t = useTranslations("pwa");
  const gotIt = (
    <Button variant="lime" onClick={onClose} className="mt-7">
      {t("gotIt")}
    </Button>
  );

  if (variant === "installed") {
    return (
      <Sheet title={t("installedTitle")} onClose={onClose}>
        <p className="text-[15px] leading-relaxed text-muted">{t("installedText")}</p>
        {gotIt}
      </Sheet>
    );
  }

  if (variant === "inapp") {
    const browser = os === "ios" ? "Safari" : "Chrome";
    return (
      <Sheet title={t("inAppTitle", { browser })} onClose={onClose}>
        <p className="text-[15px] leading-relaxed text-muted">{t("inAppWhy")}</p>
        <ol className="mt-5 flex flex-col gap-5">
          <Step n={1} Icon={EllipsisVertical} title={t("inAppSteps")} />
          <Step n={2} Icon={ExternalLink} title={t("inAppThen", { browser })} />
        </ol>
        {os === "android" && href ? (
          <a
            href={androidChromeIntent(href)}
            className="mt-7 flex h-14 w-full items-center justify-center rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
          >
            {t("openChrome")}
          </a>
        ) : (
          gotIt
        )}
      </Sheet>
    );
  }

  if (variant === "native") {
    return (
      <Sheet title={t("title")} onClose={onClose}>
        <p className="text-[15px] leading-relaxed text-muted">{t("subtitle")}</p>
        <Button variant="lime" onClick={onInstall} className="mt-7">
          <Plus size={18} strokeWidth={2} />
          {t("addButton")}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">{t("systemWindow")}</p>
      </Sheet>
    );
  }

  if (variant === "ios") {
    return (
      <Sheet title={t("title")} onClose={onClose}>
        <p className="text-[15px] leading-relaxed text-muted">{t("subtitle")}</p>
        <ol className="mt-5 flex flex-col gap-5">
          <Step n={1} Icon={Share} title={t("iosShare")} hint={t("iosShareHint")} />
          <Step n={2} Icon={SquarePlus} title={t("iosAdd")} hint={t("iosAddHint")} />
          <Step n={3} Icon={Check} title={t("iosConfirm")} hint={t("iosConfirmHint")} />
        </ol>
        {gotIt}
      </Sheet>
    );
  }

  // Android без системного окна и компьютер: ручная инструкция через меню браузера.
  return (
    <Sheet title={t("title")} onClose={onClose}>
      <p className="text-[15px] leading-relaxed text-muted">{t("subtitle")}</p>
      <ol className="mt-5 flex flex-col gap-5">
        <Step n={1} Icon={EllipsisVertical} title={t("manualMenu")} />
        <Step n={2} Icon={SquarePlus} title={t("manualAdd")} hint={t("manualAddHint")} />
      </ol>
      {gotIt}
    </Sheet>
  );
}
