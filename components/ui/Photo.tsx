/* eslint-disable @next/next/no-img-element --
   Фото из закрытого бакета отдаются по временным подписанным ссылкам
   (и локальные превью — по blob:), оптимизатор next/image здесь не нужен. */
import { useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  // Что показать, если фото не загрузилось (например, ссылка устарела).
  fallback?: React.ReactNode;
  // contain — вписать в рамку целиком; width — во всю ширину, высота по пропорциям.
  fit?: "contain" | "width";
};

export default function Photo({ src, alt, className = "", fallback = null, fit = "contain" }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`${fit === "width" ? "block h-auto w-full" : "h-full w-full object-contain"} ${className}`}
    />
  );
}
