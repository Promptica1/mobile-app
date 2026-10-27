import InAppBrowserHint from "@/components/InAppBrowserHint";
import { LanguageLinks } from "@/components/LanguageSwitcher";
import { getPaymentProvider } from "@/lib/payment-provider.server";

// Экраны входа и регистрации: без нижней навигации. Первые экраны для человека из рекламы, поэтому
// здесь же (только там, где платят через Stripe) подсказка про встроенный браузер соцсетей.
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stripe = (await getPaymentProvider()) === "stripe";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      {stripe && <InAppBrowserHint className="mt-4" />}
      {children}
      <div className="pt-6">
        <LanguageLinks />
      </div>
    </div>
  );
}
