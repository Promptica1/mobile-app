"use client";

import { useEffect } from "react";
import { usePwa } from "./PwaProvider";

// Открытие приложения. Для пользователей ЮKassa это «после регистрации» (первый показ),
// для остальных — только повторный показ через 3 дня. Окно выскакивает не сразу, а через пару секунд.
export default function InstallPromptTrigger({ signupFirstShow }: { signupFirstShow: boolean }) {
  const { request } = usePwa();
  useEffect(() => {
    const timer = setTimeout(() => request("open", { signupFirstShow }), 3500);
    return () => clearTimeout(timer);
  }, [request, signupFirstShow]);
  return null;
}
