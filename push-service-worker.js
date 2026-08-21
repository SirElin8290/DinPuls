self.addEventListener("push", event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { message = { body: event.data?.text() || "Ny lokal uppdatering" }; }
  const title = message.title || "DinPuls";
  const options = {
    body: message.body || "Det finns en ny viktig lokal uppdatering.",
    icon: "/assets/icon-192.png",
    badge: "/assets/favicon-32x32.png",
    tag: message.tag || undefined,
    data: { url: message.url || "/" },
    renotify: Boolean(message.renotify)
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => client.url === target);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
