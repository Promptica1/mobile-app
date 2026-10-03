import { CircleAlert, MailCheck, type LucideIcon } from "lucide-react";

type Props = {
  tone: "error" | "info";
  icon?: LucideIcon;
  children: React.ReactNode;
};

// Мягкое сообщение под формой: ошибка — розовое, подсказка — лавандовое.
export default function FormMessage({ tone, icon, children }: Props) {
  const Icon = icon ?? (tone === "error" ? CircleAlert : MailCheck);
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-2xl p-4 text-sm leading-relaxed ${
        tone === "error" ? "bg-pink/12" : "bg-lavender/20"
      }`}
    >
      <Icon
        size={18}
        strokeWidth={1.5}
        className={`mt-0.5 shrink-0 ${tone === "error" ? "text-danger" : ""}`}
      />
      <div>{children}</div>
    </div>
  );
}
