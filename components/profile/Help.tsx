"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, Send } from "lucide-react";
import FormMessage from "@/components/ui/FormMessage";
import Pills from "@/components/ui/Pills";
import SubmitButton from "@/components/ui/SubmitButton";
import { MESSAGE_MAX, MESSAGE_MIN, SUPPORT_TOPICS, sendSupportRequest, type SupportTopic } from "@/lib/support";

const FAQ = [
  {
    q: "Как добавить вещь?",
    a: "В Гардеробе нажмите «+», сфотографируйте вещь или выберите фото из галереи и укажите тип. AI вырежет вещь с фона. Если что-то вышло не так, напишите «Уточнение для AI» — например, «без лишних пуговиц» — и повторите.",
  },
  {
    q: "Как примерить образ?",
    a: "Создайте аватар по селфи, затем в Примерке выберите вещи — по одной в каждой категории — и нажмите «Примерить». Через 10–40 секунд вы увидите себя в этом образе.",
  },
  {
    q: "Что такое токены?",
    a: "Токен тратится на добавление вещи, новую примерку и создание аватара. Повтор уже сохранённого образа и неудачные попытки — бесплатно. Остаток видно в шапке экранов и в Профиле.",
  },
  {
    q: "Как сохранить образ и разложить по папкам?",
    a: "После примерки нажмите «Сохранить образ», задайте название и выберите папку или создайте новую. Все образы — в разделе «Образы», там же фильтры по папкам и избранному.",
  },
  {
    q: "Если поменять аватар, старые образы изменятся?",
    a: "Нет. Сохранённые образы остаются такими, какими были. Новые примерки будут собираться на обновлённом аватаре.",
  },
  {
    q: "Кто видит мои фото?",
    a: "Только вы. Фото хранятся в закрытом хранилище и открываются по временной ссылке. Подробнее — в разделе «Приватность и данные».",
  },
  {
    q: "Как удалить аккаунт?",
    a: "Профиль → «Приватность и данные» → «Удалить аккаунт». Удалятся все вещи, образы, аватар и фото — восстановить их будет нельзя.",
  },
];

function SupportForm() {
  const [topic, setTopic] = useState<SupportTopic>("question");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim().length < MESSAGE_MIN) return setError("Опишите вопрос чуть подробнее.");
    setError("");
    setSending(true);
    try {
      await sendSupportRequest(topic, message);
      setSent(true);
      setMessage("");
    } catch {
      setError("Не получилось отправить. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-card border border-border bg-surface px-5 py-8 text-center">
        <CircleCheck size={36} strokeWidth={1.25} className="text-green" />
        <p className="mt-3 font-serif text-2xl font-medium">Сообщение отправлено</p>
        <p className="mt-1.5 max-w-[260px] text-sm leading-relaxed text-muted">
          Спасибо! Мы прочитаем его и ответим на почту, указанную при регистрации.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-5 text-sm text-muted underline-offset-4 hover:text-text hover:underline"
        >
          Написать ещё
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <Pills label="Тема" options={SUPPORT_TOPICS} value={topic} onChange={setTopic} />
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between px-1 text-sm font-medium">
          Сообщение
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
          placeholder="Расскажите, что случилось или что хотелось бы улучшить"
          className="w-full resize-none rounded-2xl border border-border bg-subtle px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-lavender"
        />
      </label>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton loading={sending}>
        {!sending && <Send size={17} strokeWidth={1.75} />}
        {sending ? "Отправляем…" : "Отправить"}
      </SubmitButton>
    </form>
  );
}

export default function Help() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2.5 px-1 text-sm font-medium">Частые вопросы</h2>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-[15px] transition-colors hover:bg-subtle [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown
                  size={18}
                  strokeWidth={1.5}
                  className="shrink-0 text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="px-1 text-sm font-medium">Написать в поддержку</h2>
        <p className="mb-2.5 mt-1 px-1 text-xs leading-relaxed text-muted">
          Не нашли ответ? Напишите нам — ответим на почту вашего аккаунта.
        </p>
        <SupportForm />
      </section>

      <Link href="/profile/privacy" className="mx-auto py-1 text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        Приватность и данные
      </Link>
    </div>
  );
}
