"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmDeleteSheet from "@/components/ui/ConfirmDeleteSheet";
import { deleteAccount } from "@/lib/account";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function DeleteAccount() {
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");

  return (
    <>
      <Button
        variant="secondary"
        className="text-danger!"
        onClick={() => (getSupabaseEnv() ? setConfirm(true) : setNote("Недоступно в тестовом режиме"))}
      >
        <Trash2 size={18} strokeWidth={1.75} />
        Удалить аккаунт
      </Button>
      {note && <p className="mt-2 text-center text-xs text-muted">{note}</p>}

      {confirm && (
        <ConfirmDeleteSheet
          title="Удалить аккаунт?"
          text="Это нельзя отменить. Мы удалим профиль, все вещи и их фото, аватар, образы, папки и примерки. Восстановить их будет невозможно."
          confirmLabel="Удалить навсегда"
          busyLabel="Удаляем данные…"
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
