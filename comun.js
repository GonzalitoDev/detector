// Ajustes compartidos: dificultad, sonido y récord (guardados en el navegador)
const AJUSTES = (() => {
  const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const MULT = { facil: 0.7, normal: 1, dificil: 1.35 };
  return {
    get dificultad() { return leer("dificultad", "normal"); },
    set dificultad(v) { guardar("dificultad", v); },
    get mult() { return MULT[this.dificultad] || 1; },
    get sonido() { return leer("sonido", "1") === "1"; },
    set sonido(v) { guardar("sonido", v ? "1" : "0"); },
    record(juego) { return JSON.parse(leer("record-" + juego, '{"g":0,"p":0}')); },
    resultado(juego, gano) { const r = this.record(juego); gano ? r.g++ : r.p++; guardar("record-" + juego, JSON.stringify(r)); },
  };
})();

// Instalable y sin internet: registra el service worker (guarda el sitio en el teléfono) y el manifiesto
(() => {
  try {
    if (!document.querySelector('link[rel="manifest"]')) { const l = document.createElement("link"); l.rel = "manifest"; l.href = "manifest.json"; document.head.appendChild(l); }
    if (!document.querySelector('meta[name="theme-color"]')) { const m = document.createElement("meta"); m.name = "theme-color"; m.content = "#1e4fd8"; document.head.appendChild(m); }
    if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  } catch (e) {}
})();
// Cuadro para escribir un texto (por ejemplo el PIN de admin). Reemplaza a prompt(), que la app de PC no muestra.
// Devuelve una promesa con lo escrito, o null si se cancela.
function pedirTexto(mensaje, secreto) {
  return new Promise(res => {
    const fondo = document.createElement("div");
    fondo.style.cssText = "position:fixed;inset:0;z-index:100000;background:#000b;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif";
    fondo.innerHTML = `<div style="background:#141e33;border:2px solid #ffd400;border-radius:14px;padding:16px;width:min(86vw,340px);color:#fff;text-align:center">
      <div class="pt-msg" style="font-weight:800;margin-bottom:10px"></div>
      <input style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:0;font-size:18px;text-align:center" autocomplete="off">
      <div style="display:flex;gap:8px;margin-top:12px"><button data-r="no" style="flex:1;padding:9px;border:0;border-radius:10px;background:#ffffff22;color:#fff;font-weight:800">Cancelar</button>
      <button data-r="si" style="flex:1;padding:9px;border:0;border-radius:10px;background:#ffd400;color:#000;font-weight:900">Aceptar</button></div></div>`;
    fondo.querySelector(".pt-msg").textContent = mensaje;
    const inp = fondo.querySelector("input"); if (secreto) { inp.type = "password"; inp.inputMode = "numeric"; }
    const fin = v => { fondo.remove(); res(v); };
    fondo.querySelector('[data-r="si"]').onclick = () => fin(inp.value);
    fondo.querySelector('[data-r="no"]').onclick = () => fin(null);
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") fin(inp.value); else if (e.key === "Escape") fin(null); });
    document.exitPointerLock?.(); document.body.appendChild(fondo); setTimeout(() => inp.focus(), 0);
  });
}
