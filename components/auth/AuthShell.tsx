import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="pb-8 pt-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Digital Wardrobe
        </p>
        <h1 className="mt-4 font-serif text-[2.5rem] font-medium leading-[1.05] tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-[15px] text-muted">{subtitle}</p>
      </header>
      <div className="flex flex-col gap-5">{children}</div>
      {footer && <div className="mt-auto pt-8 text-center text-sm">{footer}</div>}
    </div>
  );
}
