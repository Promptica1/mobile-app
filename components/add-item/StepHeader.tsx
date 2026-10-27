import { ArrowLeft, CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
  // Кнопка «?» справа — открывает подсказку о съёмке.
  onHelp?: () => void;
};

export default function StepHeader({ title, subtitle, onBack, onHelp }: Props) {
  const t = useTranslations();
  return (
    <header className="pb-6 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common.back")}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
        {onHelp && (
          <button
            type="button"
            onClick={onHelp}
            aria-label={t("addItem.help")}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-border/50 hover:text-text"
          >
            <CircleHelp size={22} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <h1 className="mt-3 font-serif text-4xl font-medium leading-none tracking-tight">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
    </header>
  );
}
