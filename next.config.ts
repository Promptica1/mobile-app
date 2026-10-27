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
};

export default withNextIntl(nextConfig);
