self.addEventListener("push", (event) => {
  let title = "StewardFlow";
  let body = "새 알림이 도착했습니다. 확인해 주세요.";
  let url = "/notifications";

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload && typeof payload === "object") {
        if (typeof payload.title === "string" && payload.title.trim()) {
          title = payload.title;
        }
        if (typeof payload.body === "string" && payload.body.trim()) {
          body = payload.body;
        }
        if (typeof payload.url === "string" && payload.url.trim()) {
          url = payload.url;
        }
      }
    } catch {
      // payload-less push일 수 있으므로 무시
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url },
      tag: "stewardflow-notification",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    event.notification?.data?.url && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

