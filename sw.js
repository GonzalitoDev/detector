// Funciona sin internet: guarda todo el sitio en el teléfono la primera vez que se abre con conexión.
// Para los archivos del sitio: responde al instante con lo guardado y, si hay internet, lo actualiza para la próxima vez.
// Lo que viene de afuera (ranking, online, imágenes de IA) va directo a internet; sin conexión, los juegos siguen sin eso.
const VERSION = "juegos-v1";
const ARCHIVOS = [
  "./", "index.html", "policias.html", "pelea.html", "cartas.html", "comida.html", "gallina.html", "multi.html", "disparos.html",
  "chat.html", "sims.html", "vip.html", "admin.html", "comun.js", "db.js", "voz.js",
  "vendor/three.module.js", "vendor/supabase.min.js", "manifest.json", "iconos/icono-192.png", "iconos/icono-512.png",
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(ARCHIVOS.map(a => c.add(new Request(a, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // lo de afuera: normal
  e.respondWith(caches.open(VERSION).then(async c => {
    const guardado = await c.match(req, { ignoreSearch: true });
    const red = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (guardado) { e.waitUntil(red); return guardado; }
    const r = await red; if (r) return r;
    if (req.mode === "navigate") return (await c.match("index.html")) || new Response("Sin conexión", { status: 503 });
    return new Response("", { status: 504 });
  }));
});
