// App de escritorio de "Juegos de Gonzalito": abre los juegos en una ventana propia, sin navegador.
// Los archivos del juego van adentro de la app y se sirven con un protocolo propio (juegos://), así
// todo anda sin internet y lo que guardás (plata, autos, PIN, etc.) queda guardado entre una vez y otra.
const { app, BrowserWindow, protocol, net, shell, Menu } = require("electron");
const path = require("path");
const url = require("url");
protocol.registerSchemesAsPrivileged([{ scheme: "juegos", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
function crearVentana() {
  const v = new BrowserWindow({ width: 1280, height: 800, backgroundColor: "#0d1630", title: "Juegos de Gonzalito", icon: path.join(__dirname, "app", "iconos", "icono-512.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true } });
  v.loadURL("juegos://app/index.html");
  // Los links a otras páginas de internet se abren en el navegador
  v.webContents.setWindowOpenHandler(({ url: u }) => { if (!u.startsWith("juegos://")) shell.openExternal(u); return { action: "deny" }; });
  v.webContents.on("before-input-event", (e, i) => { if (i.type === "keyDown" && i.key === "F11") { v.setFullScreen(!v.isFullScreen()); e.preventDefault(); } });
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const raiz = path.join(__dirname, "app");
  protocol.handle("juegos", req => { let p = decodeURIComponent(new URL(req.url).pathname); if (p === "/" || !p) p = "/index.html";
    const archivo = path.normalize(path.join(raiz, p)); if (!archivo.startsWith(raiz)) return new Response("No", { status: 403 });
    return net.fetch(url.pathToFileURL(archivo).toString()); });
  crearVentana();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
