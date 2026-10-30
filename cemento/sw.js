// El service worker: guarda la app en el aparato para que abra sin señal, y muestra las notificaciones (Web Push).
// Solo maneja los archivos de la app (mismo origen); el servidor de datos (otro origen) lo maneja la app con su cola.
// VERSION la pone publicar-web.sh: al cambiar, el aparato baja la versión nueva y la app ofrece «Actualizar» (no se
// cambia sola a mitad de una inspección).
const VERSION = "d8fe69-1030";
const CACHE = `bitacora-${VERSION}`;
const ARCHIVOS = [
  "./", "./index.html", "./manifest.webmanifest", "./css/app.css",
  "./js/app.mjs", "./js/api.mjs", "./js/ui.mjs", "./js/util.mjs", "./js/tema.mjs", "./js/medios.mjs", "./js/tromp.mjs", "./js/xlsx.mjs",
  "./js/vistas-tablero.mjs", "./js/vistas-calendario.mjs", "./js/vistas-inspecciones.mjs", "./js/vistas-hallazgos.mjs", "./js/vistas-equipos.mjs",
  "./js/vistas-colectores.mjs", "./js/vistas-reportes.mjs", "./js/vistas-tromp.mjs", "./js/vistas-ajustes.mjs",
  "./js/componentes.mjs", "./js/graficas.mjs", "./js/tendencia.mjs", "./js/qr.mjs", "./js/lector-qr.mjs", "./js/lector-qr-worker.js", "./js/vendor/jsQR.js",
  "./js/vistas-tareas.mjs", "./js/vistas-turno.mjs", "./js/vistas-paros.mjs", "./js/vistas-laboratorio.mjs", "./js/vistas-indicadores.mjs", "./js/vistas-planta.mjs",
  "./fuentes/inter-latin.woff2",
  "./iconos/icono-192.png", "./iconos/icono-512.png", "./iconos/icono-512-enmascarable.png", "./iconos/apple-touch-icon.png", "./iconos/favicon-64.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" para no guardar una copia vieja del caché HTTP
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("bitacora-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "activar") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // abrir la app (navegación): la copia guardada, siempre; así abre igual con o sin señal
  if (e.request.mode === "navigate") {
    e.respondWith(caches.match("./index.html", { cacheName: CACHE }).then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(e.request)),
  );
});

// ---- notificaciones: el servidor manda { titulo, cuerpo, url, etiqueta }
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch { d = { cuerpo: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Bitácora de proceso", {
    body: d.cuerpo || "",
    icon: "./iconos/icono-192.png",
    badge: "./iconos/favicon-64.png",
    tag: d.etiqueta || undefined,
    renotify: !!d.etiqueta,
    data: { url: d.url || "#/tablero" },
    lang: "es-PA",
  }));
});

// al tocarla: si la app está abierta, va a esa pantalla; si no, la abre ahí
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "#/tablero";
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = abiertas.find((c) => c.url.startsWith(self.registration.scope));
    if (app) {
      app.postMessage({ tipo: "abrir", url });
      return app.focus();
    }
    return self.clients.openWindow(new URL(url, self.registration.scope).href);
  })());
});
