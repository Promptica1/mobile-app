import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  // dashed — пунктирный контур (пустой гардероб), filled — залитая фигура (аватар).
  variant: "dashed" | "filled";
};

export default function Silhouette({ variant, ...props }: Props) {
  const dashed = variant === "dashed";
  return (
    <svg
      viewBox="0 0 96 152"
      fill={dashed ? "none" : "currentColor"}
      stroke={dashed ? "currentColor" : "none"}
      strokeWidth="1.5"
      strokeDasharray={dashed ? "5 5" : undefined}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="48" cy="20" r="14" />
      <path d="M48 40c-14 0-24 8-26 20l-6 36a4 4 0 0 0 8 1l6-30v79a5 5 0 0 0 10 0v-44h16v44a5 5 0 0 0 10 0V67l6 30a4 4 0 0 0 8-1l-6-36c-2-12-12-20-26-20Z" />
    </svg>
  );
}
