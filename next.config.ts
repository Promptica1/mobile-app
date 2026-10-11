import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Тексты оферты и политики (content/legal) читает сервер при оформлении подписки —
  // чтобы записать, с какой редакцией согласился пользователь.
  outputFileTracingIncludes: {
    "/api/payments/create": ["./content/legal/**/*"],
    "/signup": ["./content/legal/**/*"],
  },
};

export default nextConfig;
