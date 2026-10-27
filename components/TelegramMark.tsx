"use client";

import { useEffect } from "react";
import { markTelegram } from "@/lib/telegram";

// Невидимый: внутри Telegram ставит cookie, по которой сервер выбирает оплату через ЮKassa.
export default function TelegramMark() {
  useEffect(markTelegram, []);
  return null;
}
