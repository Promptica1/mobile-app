import type { ButtonHTMLAttributes } from "react";

type Variant = "lavender" | "lime" | "secondary";

const variants: Record<Variant, string> = {
  lavender: "bg-lavender text-text",
  lime: "bg-lime text-text",
  secondary: "border border-border bg-surface text-text hover:border-text/30",
};

export function Button({
  variant,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant: Variant }) {
  return (
    <button
      type="button"
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
