self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = String(payload?.title || "WEBTV BD Admin");
  const body = String(payload?.body || "New admin notification");
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const options = {
    body,
    data,
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: "admin-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = "/dashboard/clients";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes("/dashboard")) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
