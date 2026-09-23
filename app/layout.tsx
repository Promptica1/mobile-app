import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Wardrobe",
  description: "Digital Wardrobe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="bg-background antialiased">{children}</body>
    </html>
  );
}
