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
};

export default function Photo({ src, alt, className = "", fallback = null }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`h-full w-full object-contain ${className}`}
    />
  );
}
