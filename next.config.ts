import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Тексты оферты и политики (content/legal) читает сервер при оформлении подписки —
  // чтобы записать, с какой редакцией согласился пользователь.
  outputFileTracingIncludes: {
    "/api/payments/create": ["./content/legal/**/*"],
    "/signup": ["./content/legal/**/*"],
    "/login": ["./content/legal/**/*"],
    "/auth/callback": ["./content/legal/**/*"],
  },
  async headers() {
    return [
      // Service worker браузер не должен кэшировать, иначе обновления доходят с задержкой.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
