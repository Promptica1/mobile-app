"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/useToast";
import { exportMyData } from "@/lib/exportData";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function ExportData() {
  const t = useTranslations("profile.account");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    if (!getSupabaseEnv()) return toast.show(t("demo"));
    setBusy(true);
    try {
      await exportMyData();
      toast.show(t("exportDone"));
    } catch {
      toast.show(t("exportError"));
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
        {busy ? t("exportBusy") : t("exportButton")}
      </Button>
      {toast.node}
    </>
  );
}
