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
  // contain — вписать в рамку целиком; cover — заполнить рамку с обрезкой краёв;
  // width — во всю ширину, высота по пропорциям; natural — рамка картинки совпадает с
  // самой картинкой (вписана в родителя без полей) — нужно, чтобы растушевать её края.
  fit?: "contain" | "cover" | "width" | "natural";
  style?: React.CSSProperties;
  // Для чтения пикселей на canvas картинка должна грузиться с CORS.
  crossOrigin?: "anonymous";
  onLoad?: (img: HTMLImageElement) => void;
};

export default function Photo({
  src,
  alt,
  className = "",
  fallback = null,
  fit = "contain",
  crossOrigin,
  onLoad,
  style,
}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      crossOrigin={crossOrigin}
      onLoad={(e) => onLoad?.(e.currentTarget)}
      onError={() => setFailedSrc(src)}
      style={style}
      className={`${{ width: "block h-auto w-full", contain: "h-full w-full object-contain", cover: "h-full w-full object-cover", natural: "block max-h-full max-w-full object-contain" }[fit]} ${className}`}
    />
  );
}
