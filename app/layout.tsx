import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import LocaleSync from "@/components/LocaleSync";
import PwaProvider from "@/components/pwa/PwaProvider";
import TelegramMark from "@/components/TelegramMark";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: "MIRRO",
    description: t("description"),
    applicationName: "MIRRO",
    // Запуск с главного экрана iPhone: без адресной строки Safari. Иконка — apple-touch-icon.
    appleWebApp: { capable: true, title: "MIRRO", statusBarStyle: "default" },
    icons: {
      icon: [
        { url: "/icon.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    // Next.js отдаёт только mobile-web-app-capable; iPhone ждёт ещё и apple-mobile-web-app-capable.
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf8f6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${cormorant.variable}`}>
      <body className="bg-background font-sans text-text antialiased">
        <NextIntlClientProvider>
          <LocaleSync />
          <TelegramMark />
          <PwaProvider>{children}</PwaProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
