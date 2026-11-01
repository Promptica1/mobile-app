import type { MetadataRoute } from "next";

// Установка на главный экран. Цвета — как у приложения (viewport.themeColor в app/layout.tsx).
// Иконки создаёт scripts/generate-icons.mjs из логотипа.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MIRRO",
    short_name: "MIRRO",
    description: "AI wardrobe and virtual try-on",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f6",
    theme_color: "#faf8f6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
