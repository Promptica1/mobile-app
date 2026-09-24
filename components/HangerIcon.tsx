import type { LucideProps } from "lucide-react";

// В lucide нет иконки вешалки — рисуем свою в том же стиле (24×24, линия 2px).
export default function HangerIcon({
  size = 24,
  strokeWidth = 2,
  ...props
}: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 5.5a2 2 0 1 1 3 1.73c-.62.36-1 1.02-1 1.74v.53" />
      <path d="M12 9.5 2.9 16.2a1 1 0 0 0 .6 1.8h17a1 1 0 0 0 .6-1.8z" />
    </svg>
  );
}
