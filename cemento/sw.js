// El service worker: guarda la app en el aparato para que abra sin señal. Solo maneja los archivos de la app (mismo
// origen); el servidor de datos (otro origen) lo maneja la app con su cola. VERSION la pone publicar.sh: al cambiar,
// el aparato baja la versión nueva y la app ofrece «Actualizar» (no se cambia sola a mitad de una inspección).
const VERSION = "1044ad2e02";
const CACHE = `bitacora-${VERSION}`;
const ARCHIVOS = [
  "./", "./index.html", "./manifest.webmanifest", "./css/app.css",
  "./js/app.mjs", "./js/api.mjs", "./js/ui.mjs", "./js/util.mjs", "./js/medios.mjs", "./js/tromp.mjs",
  "./js/vistas-inspecciones.mjs", "./js/vistas-hallazgos.mjs", "./js/vistas-equipos.mjs", "./js/vistas-reportes.mjs", "./js/vistas-tromp.mjs",
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
