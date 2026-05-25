// Service Worker for Push Notifications
self.addEventListener("push", function (event) {
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

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url ?? "/dashboard")
  );
});