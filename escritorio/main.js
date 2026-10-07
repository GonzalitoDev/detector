// App de escritorio de "Juegos de Gonzalito": abre los juegos en una ventana propia, sin navegador.
// Los archivos del juego van adentro de la app y se sirven con un protocolo propio (juegos://), así
// todo anda sin internet y lo que guardás (plata, autos, PIN, etc.) queda guardado entre una vez y otra.
//
// Se actualiza sola: al abrir y cada 2 minutos baja los juegos de la página publicada
// (https://gonzalitodev.github.io/detector/). Si cambió algo, lo guarda en la compu y lo aplica
// en cuanto volvés al menú (o al toque si ya estás en el menú). Sin internet usa la última versión bajada.
const { app, BrowserWindow, protocol, net, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const url = require("url");
const crypto = require("crypto");
const SITIO = process.env.JUEGOS_SITIO || "https://gonzalitodev.github.io/detector/";   // (la variable es solo para probar)
const ARCHIVOS = ["index.html", "policias.html", "pelea.html", "cartas.html", "comida.html", "gallina.html", "multi.html", "disparos.html",
  "chat.html", "sims.html", "vip.html", "admin.html", "comun.js", "db.js", "voz.js", "admin.js", "sw.js",
  "vendor/three.module.js", "vendor/supabase.min.js", "manifest.json", "iconos/icono-192.png", "iconos/icono-512.png"];
protocol.registerSchemesAsPrivileged([{ scheme: "juegos", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
let ventana = null, hayNueva = false;
const incluida = () => path.join(__dirname, "app");
const bajada = () => path.join(app.getPath("userData"), "juegos");
const raiz = () => fs.existsSync(path.join(bajada(), "index.html")) ? bajada() : incluida();
const hash = b => crypto.createHash("sha1").update(b).digest("hex");

async function buscarActualizacion() {
  try {
    const nuevos = {};
    for (const a of ARCHIVOS) { const r = await net.fetch(SITIO + a + "?v=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; nuevos[a] = Buffer.from(await r.arrayBuffer()); }
    const actual = raiz();
    const cambio = ARCHIVOS.some(a => { try { return hash(fs.readFileSync(path.join(actual, a))) !== hash(nuevos[a]); } catch (e) { return true; } });
    if (!cambio) return;
    // Se escribe todo en una carpeta aparte y después se reemplaza de una (nunca queda una versión a medias)
    const tmp = bajada() + "-nueva";
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const a of ARCHIVOS) { const f = path.join(tmp, a); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, nuevos[a]); }
    fs.rmSync(bajada(), { recursive: true, force: true }); fs.renameSync(tmp, bajada());
    hayNueva = true; aplicarSiSePuede(true);
  } catch (e) { /* sin internet: se sigue usando lo que hay */ }
}
// Recarga solo si estás en el menú (no te corta una partida); si estás jugando, avisa y se aplica al volver al menú
function aplicarSiSePuede(avisar) {
  if (!ventana || !hayNueva) return;
  const u = ventana.webContents.getURL();
  if (u.endsWith("/index.html") || u.endsWith("://app/")) { hayNueva = false; ventana.webContents.reloadIgnoringCache(); }
  else if (avisar) ventana.webContents.executeJavaScript(`(() => { const d = document.createElement("div"); d.textContent = "🔄 Hay una actualización de los juegos: se aplica cuando vuelvas al menú";
    d.style.cssText = "position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;background:#1e4fd8;color:#fff;padding:8px 14px;border-radius:10px;font:bold 14px system-ui";
    document.body.appendChild(d); setTimeout(() => d.remove(), 7000); })()`).catch(() => {});
}
function crearVentana() {
  ventana = new BrowserWindow({ width: 1280, height: 800, backgroundColor: "#0d1630", title: "Juegos de Gonzalito", icon: path.join(incluida(), "iconos", "icono-512.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true } });
  ventana.loadURL("juegos://app/index.html");
  ventana.webContents.on("did-navigate", () => aplicarSiSePuede(false));
  // Los links a otras páginas de internet se abren en el navegador
  ventana.webContents.setWindowOpenHandler(({ url: u }) => { if (!u.startsWith("juegos://")) shell.openExternal(u); return { action: "deny" }; });
  ventana.webContents.on("before-input-event", (e, i) => { if (i.type === "keyDown" && i.key === "F11") { ventana.setFullScreen(!ventana.isFullScreen()); e.preventDefault(); } });
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("juegos", req => { let p = decodeURIComponent(new URL(req.url).pathname); if (p === "/" || !p) p = "/index.html";
    for (const base of [raiz(), incluida()]) { const archivo = path.normalize(path.join(base, p)); if (archivo.startsWith(base) && fs.existsSync(archivo)) return net.fetch(url.pathToFileURL(archivo).toString()); }
    return new Response("No encontrado", { status: 404 }); });
  crearVentana();
  buscarActualizacion(); setInterval(buscarActualizacion, 2 * 60 * 1000);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
