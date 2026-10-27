"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmDeleteSheet from "@/components/ui/ConfirmDeleteSheet";
import { deleteAccount } from "@/lib/account";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function DeleteAccount() {
  const t = useTranslations("profile.account");
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");

  return (
    <>
      <Button
        variant="secondary"
        className="text-danger!"
        onClick={() => (getSupabaseEnv() ? setConfirm(true) : setNote(t("demo")))}
      >
        <Trash2 size={18} strokeWidth={1.75} />
        {t("deleteButton")}
      </Button>
      {note && <p className="mt-2 text-center text-xs text-muted">{note}</p>}

      {confirm && (
        <ConfirmDeleteSheet
          title={t("deleteTitle")}
          text={t("deleteText")}
          confirmLabel={t("deleteConfirm")}
          busyLabel={t("deleteBusy")}
          onClose={() => setConfirm(false)}
          onDelete={async () => {
            await deleteAccount();
            // Полная перезагрузка: в браузере не остаётся данных удалённого аккаунта.
            window.location.replace("/login?deleted=1");
          }}
        />
      )}
    </>
  );
}
