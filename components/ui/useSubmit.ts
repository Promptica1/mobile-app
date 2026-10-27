import { useState } from "react";
import { useTranslations } from "next-intl";

// Кнопка панели ждёт действия; при ошибке показываем сообщение и не закрываем панель.
export function useSubmit(action: () => Promise<void>, errorText?: string) {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch {
      setError(errorText ?? t("saveError"));
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}
