"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/useToast";
import { exportMyData } from "@/lib/exportData";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function ExportData() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    if (!getSupabaseEnv()) return toast.show("Недоступно в тестовом режиме");
    setBusy(true);
    try {
      await exportMyData();
      toast.show("Файл с данными скачан");
    } catch {
      toast.show("Не получилось собрать данные. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="secondary" onClick={run} disabled={busy}>
        {busy ? (
          <LoaderCircle size={18} strokeWidth={2} className="animate-spin" />
        ) : (
          <Download size={18} strokeWidth={1.75} />
        )}
        {busy ? "Собираем данные…" : "Скачать мои данные"}
      </Button>
      {toast.node}
    </>
  );
}
