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

  const title = String(payload?.title || "WEBTV BD");
  const body = String(payload?.body || "New notification");
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const options = {
    body,
    data,
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: String(data?.tag || payload?.tag || "webtv-notification"),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.target_url || "/dashboard");
  const origin = self.location?.origin || "";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (origin && client.url.startsWith(origin)) {
          if (targetUrl && typeof client.navigate === "function") {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
