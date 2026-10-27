import { OFFER_INFO, type Offer } from "../stripe/rules.ts";

// Письма о подписке (Stripe). Только английский. Без зависимостей — проверяются тестами.

export type Mail = { subject: string; html: string; text: string };

const usd = (n: number) => `$${n.toFixed(2)}`;
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function layout(title: string, paragraphs: string[], manageUrl: string): Mail["html"] {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2c2c2a">
  <p style="font-size:22px;letter-spacing:.25em;font-weight:600;margin:0 0 24px">MIRRO</p>
  <h1 style="font-size:24px;margin:0 0 12px">${title}</h1>
  ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${p}</p>`).join("\n  ")}
  <p style="margin:24px 0"><a href="${manageUrl}" style="display:inline-block;background:#d9f26b;color:#2c2c2a;text-decoration:none;font-weight:500;padding:14px 28px;border-radius:999px">Manage subscription</a></p>
  <p style="font-size:12px;color:#8a8a85;line-height:1.6">You can cancel any time in Profile → Subscription → Manage subscription.</p>
</div>`;
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "");
function build(subject: string, title: string, paragraphs: string[], manageUrl: string): Mail {
  return {
    subject,
    html: layout(title, paragraphs, manageUrl),
    text: [title, "", ...paragraphs.map(strip), "", `Manage subscription: ${manageUrl}`].join("\n"),
  };
}

export function purchaseMail(
  info: { offer: Offer; periodEnd: Date | null; trialEnd: Date | null },
  manageUrl: string,
): Mail {
  const o = OFFER_INFO[info.offer];
  const recurring = `${usd(o.recurringUsd)}/${o.interval === "year" ? "year" : "month"}`;
  if (info.offer === "trial" || info.offer === "trial_free") {
    const when = info.trialEnd ? ` on ${day(info.trialEnd)}` : "";
    const paid = o.setupUsd > 0 ? `We charged ${usd(o.setupUsd)} for your ${o.trialDays}-day trial. ` : `Your ${o.trialDays}-day free trial has started. `;
    return build(
      "Your MIRRO trial has started",
      "Your trial has started",
      [
        `Thank you! ${paid}Everything in Premium is unlocked.`,
        `After the trial your subscription renews${when} at ${recurring}. You can cancel any time before then and you won't be charged.`,
      ],
      manageUrl,
    );
  }
  const until = info.periodEnd ? ` It renews on ${day(info.periodEnd)}.` : "";
  return build(
    "Your MIRRO Premium subscription",
    "Thank you for subscribing",
    [`Your Premium subscription (${recurring}) is active.${until}`, "You can cancel the renewal any time and keep access until the end of the paid period."],
    manageUrl,
  );
}

export function trialEndingMail(info: { trialEnd: Date }, manageUrl: string): Mail {
  return build(
    "Your MIRRO trial ends tomorrow",
    "Your trial ends soon",
    [
      `Your trial ends on ${day(info.trialEnd)}. After that your subscription renews at ${usd(OFFER_INFO.monthly.recurringUsd)}/month.`,
      "If you'd rather not continue, cancel before then and you won't be charged.",
    ],
    manageUrl,
  );
}

export function annualReminderMail(info: { renewsOn: Date }, manageUrl: string): Mail {
  return build(
    "Your MIRRO annual plan renews in 7 days",
    "Your annual plan renews soon",
    [
      `Your Premium annual plan renews on ${day(info.renewsOn)} at ${usd(OFFER_INFO.annual.recurringUsd)}/year.`,
      "If you don't want to renew, you can turn off renewal now and keep access until the end of the paid year.",
    ],
    manageUrl,
  );
}
