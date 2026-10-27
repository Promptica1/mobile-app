"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, CircleCheck, Send } from "lucide-react";
import FormMessage from "@/components/ui/FormMessage";
import Pills from "@/components/ui/Pills";
import SubmitButton from "@/components/ui/SubmitButton";
import { MESSAGE_MAX, MESSAGE_MIN, SUPPORT_TOPICS, sendSupportRequest, type SupportTopic } from "@/lib/support";

const FAQ_IDS = [1, 2, 3, 4, 5, 6, 7] as const;

function SupportForm() {
  const t = useTranslations("help");
  const [topic, setTopic] = useState<SupportTopic>("question");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim().length < MESSAGE_MIN) return setError(t("tooShort"));
    setError("");
    setSending(true);
    try {
      await sendSupportRequest(topic, message);
      setSent(true);
      setMessage("");
    } catch {
      setError(t("sendError"));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-card border border-border bg-surface px-5 py-8 text-center">
        <CircleCheck size={36} strokeWidth={1.25} className="text-green" />
        <p className="mt-3 font-serif text-2xl font-medium">{t("sentTitle")}</p>
        <p className="mt-1.5 max-w-[260px] text-sm leading-relaxed text-muted">
          {t("sentText")}
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-5 text-sm text-muted underline-offset-4 hover:text-text hover:underline"
        >
          {t("writeMore")}
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <Pills
        label={t("topic")}
        options={SUPPORT_TOPICS.map(({ value }) => ({ value, label: t(`topics.${value}`) }))}
        value={topic}
        onChange={setTopic}
      />
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between px-1 text-sm font-medium">
          {t("message")}
          <span className="text-xs font-normal text-muted tabular-nums">
            {message.length}/{MESSAGE_MAX}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(e) => {
            setError("");
            setMessage(e.target.value);
          }}
          maxLength={MESSAGE_MAX}
          rows={4}
          placeholder={t("placeholder")}
          className="w-full resize-none rounded-2xl border border-border bg-subtle px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
        />
      </label>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton loading={sending}>
        {!sending && <Send size={17} strokeWidth={1.75} />}
        {sending ? t("sending") : t("send")}
      </SubmitButton>
    </form>
  );
}

export default function Help() {
  const t = useTranslations("help");
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2.5 px-1 text-sm font-medium">{t("faqTitle")}</h2>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {FAQ_IDS.map((n) => (
            <details key={n} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-[15px] transition-colors hover:bg-subtle [&::-webkit-details-marker]:hidden">
                {t(`faq.q${n}`)}
                <ChevronDown
                  size={18}
                  strokeWidth={1.5}
                  className="shrink-0 text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-muted">{t(`faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="px-1 text-sm font-medium">{t("contactTitle")}</h2>
        <p className="mb-2.5 mt-1 px-1 text-xs leading-relaxed text-muted">
          {t("contactText")}
        </p>
        <SupportForm />
      </section>

      <Link href="/profile/privacy" className="mx-auto py-1 text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        {t("privacyLink")}
      </Link>
    </div>
  );
}
