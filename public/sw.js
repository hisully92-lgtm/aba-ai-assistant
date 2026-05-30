const CACHE_NAME = "aba-ai-v1";

const STATIC_ASSETS = [
  "/",
  "/login",
  "/dashboard",
  "/login-banner.jpg",
  "/manifest.json",
];

// ========================
// INSTALL — cache static assets
// ========================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ========================
// ACTIVATE — clean old caches
// ========================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ========================
// FETCH — network first, fall back to cache
// ========================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and Supabase API requests
  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("anthropic.com")
  ) {
    return;
  }

  // For navigation requests (pages) — network first, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard")))
    );
    return;
  }

  // For static assets — cache first, fall back to network
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".json")
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
// PUSH NOTIFICATIONS
// ========================
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body ?? "You have a new notification",
    icon: "/login-banner.jpg",
    badge: "/login-banner.jpg",
    data: { url: data.url ?? "/dashboard/notifications" },
  };
  event.waitUntil(
    self.registration.showNotification(data.title ?? "ABA AI Assistant", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url ?? "/dashboard")
  );
});