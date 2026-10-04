import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import pkg from "@/package.json";

// Обращения в поддержку: строка в таблице support_requests (RLS — только свои).

export const SUPPORT_TOPICS = [
  { value: "question", label: "Вопрос" },
  { value: "bug", label: "Ошибка" },
  { value: "idea", label: "Идея" },
  { value: "payment", label: "Оплата" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["value"];
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 2000;

export async function sendSupportRequest(topic: SupportTopic, message: string): Promise<void> {
  if (!getSupabaseEnv()) return;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("no session");
  const { error } = await supabase.from("support_requests").insert({
    topic,
    message: message.trim().slice(0, MESSAGE_MAX),
    email: session.user.email ?? null,
    app_version: pkg.version,
    user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}
