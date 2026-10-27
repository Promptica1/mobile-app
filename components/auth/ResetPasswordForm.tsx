"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, authErrorMessage, validateNewPassword } from "@/lib/auth/errors";
import AuthShell from "./AuthShell";
import FormMessage from "@/components/ui/FormMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import TextField from "./TextField";

// Страница из письма «Сброс пароля». Ссылка Supabase может прийти в разных видах — принимаем все:
//   ?code=…                        — новый вход (PKCE): меняем код на сессию;
//   ?token_hash=…&type=recovery    — шаблон письма с token_hash: подтверждаем через verifyOtp
//                                    (работает, даже если письмо открыли в другом браузере);
//   #access_token=…&type=recovery  — старый формат: клиент Supabase сам подхватит сессию
//                                    и пришлёт событие PASSWORD_RECOVERY;
//   ?error=… / #error=…            — ссылка устарела или уже использована.
// Есть сессия восстановления — показываем форму нового пароля.

type Stage = "checking" | "ready" | "invalid";

function linkParams() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    code: query.get("code"),
    tokenHash: query.get("token_hash"),
    type: query.get("type") ?? hash.get("type"),
    error: query.get("error") ?? hash.get("error") ?? query.get("error_code") ?? hash.get("error_code"),
  };
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const t = useTranslations("auth.reset");
  const tErr = useTranslations("auth.errors");
  const tLogin = useTranslations("auth.forgot");
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const ready = () => alive && setStage("ready");

    // Старый формат ссылки (#access_token…): клиент сам установит сессию и сообщит об этом.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) ready();
    });

    (async () => {
      const { code, tokenHash, type, error: linkError } = linkParams();
      if (linkError) return alive && setStage("invalid");

      // getSession ждёт, пока клиент разберёт адрес (он сам обрабатывает ?code и #access_token).
      const { data } = await supabase.auth.getSession();
      if (data.session) return ready();

      if (tokenHash && (type === "recovery" || !type)) {
        const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        return error ? alive && setStage("invalid") : ready();
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return ready();
        // Код уже мог обменять сам клиент — проверяем сессию ещё раз.
        const { data: again } = await supabase.auth.getSession();
        return again.session ? ready() : alive && setStage("invalid");
      }
      // Ни кода, ни сессии: страницу открыли не из письма (или ссылка без параметров).
      if (alive) setStage("invalid");
    })();

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Убираем одноразовые параметры из адресной строки, чтобы их нельзя было переиспользовать.
  useEffect(() => {
    if (stage === "ready" && (window.location.search || window.location.hash)) {
      window.history.replaceState(null, "", "/reset-password");
    }
  }, [stage]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const invalid = validateNewPassword(password, tErr);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError(tErr("passwordsMismatch"));
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(authErrorMessage(error, tErr));
      setLoading(false);
      return;
    }
    // Выходим из сессии восстановления — дальше вход с новым паролем.
    await supabase.auth.signOut();
    router.replace("/login?reset=1");
    router.refresh();
  }

  const footer = (
    <Link href="/login" className="font-medium underline underline-offset-4">
      {tLogin("backToLogin")}
    </Link>
  );

  if (stage === "checking") {
    return (
      <AuthShell title={t("title")} subtitle={t("checking")} footer={footer}>
        <div className="flex justify-center py-8" aria-busy>
          <LoaderCircle size={28} strokeWidth={1.75} className="animate-spin text-muted" />
        </div>
      </AuthShell>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell title={t("invalidTitle")} subtitle={t("invalidSubtitle")} footer={footer}>
        <FormMessage tone="error">
          {t("invalidText")}
        </FormMessage>
        <Link
          href="/forgot-password"
          className="flex h-14 items-center justify-center rounded-full bg-lime text-[15px] font-medium text-text transition-transform active:scale-[0.98]"
        >
          {t("newLink")}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")} footer={footer}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label={t("newPassword")}
          password
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          helper={t("passwordHelper", { min: MIN_PASSWORD_LENGTH })}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label={t("repeat")}
          password
          autoComplete="new-password"
          placeholder={t("repeatPlaceholder")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <SubmitButton loading={loading}>{loading ? t("saving") : t("submit")}</SubmitButton>
      </form>
    </AuthShell>
  );
}
