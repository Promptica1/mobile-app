// MIRRO — service worker. Делает сайт устанавливаемым и показывает заглушку без сети.
//
// Что кэшируем: офлайн-страницу, иконки и неизменяемую статику Next.js (/_next/static — имена
// файлов с хэшем, содержимое никогда не меняется).
// Чего НЕ трогаем: страницы (всегда из сети — в них данные пользователя), /api, вход, оплату и любые
// чужие адреса (Stripe, ЮKassa, Supabase, Google) — такие запросы идут напрямую, как без service worker.

const VERSION = "v1";
const CACHE = `mirro-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mirro-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Переход на страницу: всегда из сети; нет сети — заглушка. Страницы не кэшируем.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Неизменяемая статика и иконки: сначала кэш.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Остальное (API, данные, картинки вещей) — без участия service worker.
});
