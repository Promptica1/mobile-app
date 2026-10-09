"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Clock, LoaderCircle } from "lucide-react";
import { cancelReasonText, checkPayment, formatDate, type PaymentResult as Result } from "@/lib/billing";

// Пока ЮKassa не дала окончательный ответ — переспрашиваем сервер каждые 2 секунды.
const POLL_MS = 2000;
const MAX_POLLS = 10;

export default function PaymentResult({ order }: { order: string | null }) {
  const [result, setResult] = useState<Result | null>(null);
  const [polls, setPolls] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(() => {
    if (!order) return;
    checkPayment(order).then((r) => {
      setResult(r);
      setPolls((n) => n + 1);
    });
  }, [order]);

  useEffect(check, [check]);
  useEffect(() => {
    if (result?.status !== "pending" || polls >= MAX_POLLS) return;
    timer.current = setTimeout(check, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [result, polls, check]);

  const loading = order && (!result || (result.status === "pending" && polls < MAX_POLLS));

  if (!order || result?.status === "error") {
    const notFound = !order || (result?.status === "error" && (result.error === "not_found" || result.error === "bad_order"));
    return (
      <Screen icon={<CircleAlert size={36} strokeWidth={1.25} className="text-danger" />} title="Не удалось проверить оплату">
        <p>
          {notFound
            ? "Мы не нашли этот платёж. Если деньги списались — напишите нам в «Помощь и поддержка»."
            : "Проверьте интернет и попробуйте ещё раз. Если оплата прошла, подписка появится автоматически."}
        </p>
        <Actions primary={{ label: "Проверить ещё раз", onClick: check }} secondary={{ label: "К тарифам", href: "/profile/subscription" }} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen icon={<LoaderCircle size={36} strokeWidth={1.5} className="animate-spin text-lavender" />} title="Проверяем оплату…">
        <p>Обычно это занимает несколько секунд.</p>
      </Screen>
    );
  }

  if (result?.status === "succeeded") {
    return (
      <Screen icon={<CircleCheck size={40} strokeWidth={1.25} className="text-green" />} title="Оплата прошла">
        <p>
          Подписка <b className="font-semibold text-text">MIRRO {result.planName}</b> оформлена
          {result.periodEnd ? ` и действует до ${formatDate(result.periodEnd)}` : ""}.
        </p>
        <Actions primary={{ label: "Закрыть", href: "/wardrobe" }} />
        {/* Условие автопродления — обязательно показываем после оформления */}
        <p className="mt-6 max-w-[290px] text-xs leading-relaxed text-muted">
          Подписка продлевается автоматически каждый месяц. Отменить можно в любой момент в разделе
          «Моя подписка».
        </p>
      </Screen>
    );
  }

  if (result?.status === "pending") {
    return (
      <Screen icon={<Clock size={36} strokeWidth={1.25} className="text-muted" />} title="Оплата ещё обрабатывается">
        <p>Банк пока не подтвердил платёж. Проверьте через минуту — если оплата пройдёт, подписка включится.</p>
        <Actions primary={{ label: "Проверить ещё раз", onClick: () => { setPolls(0); check(); } }} secondary={{ label: "К тарифам", href: "/profile/subscription" }} />
      </Screen>
    );
  }

  // canceled
  return (
    <Screen icon={<CircleAlert size={36} strokeWidth={1.25} className="text-danger" />} title="Оплата не завершена">
      <p>{result?.status === "canceled" ? cancelReasonText(result.reason) : ""} Деньги не списаны.</p>
      <Actions primary={{ label: "Попробовать снова", href: "/profile/subscription" }} secondary={{ label: "В профиль", href: "/profile" }} />
    </Screen>
  );
}

function Screen({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center" aria-live="polite">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-lavender/15">{icon}</span>
      <h2 className="mt-6 font-serif text-[2rem] font-medium leading-tight">{title}</h2>
      <div className="mt-2 flex max-w-[300px] flex-col items-center text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

type Action = { label: string; href?: string; onClick?: () => void };
function Actions({ primary, secondary }: { primary: Action; secondary?: Action }) {
  const cls = "flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium";
  const render = (a: Action, style: string) =>
    a.href ? (
      <Link href={a.href} className={`${cls} ${style}`}>
        {a.label}
      </Link>
    ) : (
      <button type="button" onClick={a.onClick} className={`${cls} ${style}`}>
        {a.label}
      </button>
    );
  return (
    <div className="mt-8 flex w-[280px] flex-col gap-2">
      {render(primary, "bg-lime text-text")}
      {secondary && render(secondary, "text-muted hover:text-text")}
    </div>
  );
}
