import { useState } from "react";

const SAVE_ERROR = "Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.";

// Кнопка панели ждёт действия; при ошибке показываем сообщение и не закрываем панель.
export function useSubmit(action: () => Promise<void>, errorText = SAVE_ERROR) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch {
      setError(errorText);
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}
