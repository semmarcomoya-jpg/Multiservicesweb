// Service worker: permite instalar la app y recibir avisos con la app cerrada.
// No guarda datos privados en caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Aviso que manda el servidor (función send-push)
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    d = { title: 'Castillo Multiservices', body: e.data ? e.data.text() : '' };
  }
  const base = self.registration.scope;
  e.waitUntil(
    self.registration.showNotification(d.title || 'Castillo Multiservices', {
      body: d.body || '',
      icon: base + 'icon-192.png',
      badge: base + 'icon-192.png',
      tag: d.tag || undefined,
      data: { link: d.link || '' },
    }),
  );
});

// Al tocar el aviso se abre la app en la pantalla que corresponde
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const base = self.registration.scope;
  const link = (e.notification.data && e.notification.data.link) || '';
  const url = base + String(link).replace(/^\//, '');
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(base) && 'focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
