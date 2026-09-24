import { ArrowLeft } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

export default function StepHeader({ title, subtitle, onBack }: Props) {
  return (
    <header className="pb-6 pt-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Назад"
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-border/50"
      >
        <ArrowLeft size={22} strokeWidth={1.5} />
      </button>
      <h1 className="mt-3 font-serif text-4xl font-medium leading-none tracking-tight">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
    </header>
  );
}
