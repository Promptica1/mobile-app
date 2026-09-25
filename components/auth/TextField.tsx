"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
  // Пароль: показывает кнопку «глаз», которая открывает/скрывает символы.
  password?: boolean;
};

export default function TextField({ label, helper, password, className = "", ...props }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const type = password ? (visible ? "text" : "password") : props.type;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block px-1 text-sm font-medium">
        {label}
      </label>
      <div className="flex h-14 items-center rounded-2xl border border-border bg-surface px-4 transition-colors focus-within:border-lavender">
        <input
          id={id}
          {...props}
          type={type}
          aria-describedby={helper ? `${id}-helper` : undefined}
          className={`h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted ${className}`}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
          >
            {visible ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
          </button>
        )}
      </div>
      {helper && (
        <p id={`${id}-helper`} className="mt-1.5 px-1 text-xs text-muted">
          {helper}
        </p>
      )}
    </div>
  );
}
