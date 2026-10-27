// Встроенный браузер соцсетей (Instagram, Facebook, TikTok): в нём не работают Apple Pay и Google Pay,
// поэтому до оплаты через Stripe подсказываем открыть сайт во внешнем браузере. Оплату не блокируем:
// оставшийся во встроенном браузере платит формой карты. Определяем по user agent. Без зависимостей — есть тест.

export type InAppApp = "instagram" | "facebook" | "tiktok";
export type InAppInfo = { app: InAppApp | null; os: "ios" | "android" | "other" };

export function detectInApp(ua: string): InAppInfo {
  const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "other";
  const app: InAppApp | null = /Instagram/i.test(ua)
    ? "instagram"
    : /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(ua)
      ? "facebook"
      : /TikTok|musical_ly|BytedanceWebview|trill_/i.test(ua)
        ? "tiktok"
        : null;
  return { app, os };
}

// Android: ссылка, которая открывает ту же страницу во внешнем Chrome (если Chrome нет — обычная ссылка).
export function androidChromeIntent(href: string): string {
  const url = new URL(href);
  const target = `${url.host}${url.pathname}${url.search}`;
  return `intent://${target}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}
