import "server-only";
import { annualReminderMail, purchaseMail, trialEndingMail, type Mail } from "./email/templates";
import type { Mailer } from "./stripe/types";

// Письма о подписке отправляются через Resend (https://resend.com/docs/api-reference/emails/send-email).
// Нужны переменные окружения RESEND_API_KEY и EMAIL_FROM (например, "MIRRO <billing@ваш-домен>";
// домен должен быть подтверждён в Resend). Без них письма не отправляются, остальное работает.
// Письма на английском.

const manageUrl = () => `${(process.env.APP_URL || "https://mirro-wardrobe.online").replace(/\/$/, "")}/profile/subscription/manage`;

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());

export async function sendMail(to: string, mail: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) {
    console.log("EMAIL: RESEND_API_KEY / EMAIL_FROM are not set — email skipped");
    return false;
  }
  // RESEND_API_URL — только для проверок на тестовом стенде.
  const res = await fetch(`${process.env.RESEND_API_URL ?? "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
  return true;
}

export const mailer: Mailer = {
  async purchase(to, info) {
    await sendMail(to, purchaseMail(info, manageUrl()));
  },
};

export const sendTrialEnding = (to: string, trialEnd: Date) => sendMail(to, trialEndingMail({ trialEnd }, manageUrl()));
export const sendAnnualReminder = (to: string, renewsOn: Date) => sendMail(to, annualReminderMail({ renewsOn }, manageUrl()));
