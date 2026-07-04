const CACHE_NAME = "aba-ai-v2";
const OFFLINE_PAGE = "/dashboard";

const STATIC_ASSETS = [
  "/",
  "/login",
  "/dashboard",
  "/login-banner.jpg",
  "/manifest.json",
];

// ========================
// INSTALL
// ========================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ========================
// ACTIVATE
// ========================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ========================
// FETCH — network first, cache fallback
// ========================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, extensions, Supabase, Anthropic
  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("vercel.app") && url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Navigation — network first, fall back to cached dashboard
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  // Static assets — cache first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.match(/\.(jpg|png|svg|ico|json|webp|woff|woff2)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }
});

// ========================
// BACKGROUND SYNC — cache key dashboard data
// ========================
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_DASHBOARD_DATA") {
    const { data, key } = event.data;
    caches.open(CACHE_NAME).then((cache) => {
      const response = new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
      cache.put(`/offline-data/${key}`, response);
    });
  }

  if (event.data?.type === "GET_CACHED_DATA") {
    const { key } = event.data;
    caches.open(CACHE_NAME).then((cache) => {
      cache.match(`/offline-data/${key}`).then((response) => {
        if (response) {
          response.json().then((data) => {
            event.source?.postMessage({ type: "CACHED_DATA", key, data });
          });
        }
      });
    });
  }
});

// ========================
// PUSH NOTIFICATIONS
// ========================
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "ABA AI", {
      body: data.body ?? "You have a new notification",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/dashboard/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url ?? "/dashboard"));
});