import assert from "node:assert/strict";
import { test } from "node:test";
import { androidChromeIntent, detectInApp } from "../lib/inapp-browser.ts";

const IG_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.30.109 (iPhone15,2; iOS 17_5; en_US; en-US; scale=3.00; 1170x2532; 612417800)";
const IG_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.30.109 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; en_US; 612417800)";
const FB_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/460.0.0.45.108;FBBV/600000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]";
const FB_ANDROID = "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.50.109;]";
const TIKTOK_ANDROID = "Mozilla/5.0 (Linux; Android 13; SM-A546B Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 trill_2023604030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/36.4.3 BytedanceWebview/d8a21c6";
const TIKTOK_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_36.4.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const CHROME_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

test("встроенные браузеры соцсетей определяются по user agent", () => {
  assert.deepEqual(detectInApp(IG_IOS), { app: "instagram", os: "ios" });
  assert.deepEqual(detectInApp(IG_ANDROID), { app: "instagram", os: "android" });
  assert.deepEqual(detectInApp(FB_IOS), { app: "facebook", os: "ios" });
  assert.deepEqual(detectInApp(FB_ANDROID), { app: "facebook", os: "android" });
  assert.deepEqual(detectInApp(TIKTOK_ANDROID), { app: "tiktok", os: "android" });
  assert.deepEqual(detectInApp(TIKTOK_IOS), { app: "tiktok", os: "ios" });
});

test("обычные браузеры не считаются встроенными", () => {
  assert.equal(detectInApp(SAFARI).app, null);
  assert.equal(detectInApp(CHROME_ANDROID).app, null);
  assert.equal(detectInApp(CHROME_DESKTOP).app, null);
  assert.equal(detectInApp("").app, null);
});

test("Android: intent-ссылка открывает ту же страницу во внешнем Chrome", () => {
  const href = "https://mirro-wardrobe.online/profile/subscription?x=1#top";
  const intent = androidChromeIntent(href);
  assert.ok(intent.startsWith("intent://mirro-wardrobe.online/profile/subscription?x=1#Intent;"));
  assert.ok(intent.includes("scheme=https;package=com.android.chrome;"));
  assert.ok(intent.includes(`S.browser_fallback_url=${encodeURIComponent(href)}`));
  assert.ok(intent.endsWith(";end"));
});
