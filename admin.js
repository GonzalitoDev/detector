// Menú admin para Gonza (lo usan los juegos). El PIN se elige la primera vez y queda guardado en el dispositivo.
// Cada juego llama a AdminGonza.instalar({ acciones: () => [{ g: "Grupo", t: "Botón", f: () => {...} }] }).
const AdminGonza = (() => {
  const esGonza = () => { try { return /^gonza/i.test((localStorage.getItem("nombre") || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "")); } catch (e) { return false; } };
  let ok = false, acciones = () => [];
  async function hash(p) { try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("polis:" + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); } catch (e) { return "x" + p; } }
  async function pedirPin() {
    if (ok) return true; let g = null; try { g = localStorage.getItem("polis-admin-pin"); } catch (e) {}
    const p = await (typeof pedirTexto === "function" ? pedirTexto(g ? "🔐 PIN de admin:" : "🔐 Elegí un PIN de admin (lo vas a usar siempre):", true) : Promise.resolve(prompt("🔐 PIN de admin:"))); if (!p) return false;
    const h = await hash(p);
    if (!g) { try { localStorage.setItem("polis-admin-pin", h); } catch (e) {} } else if (h !== g) { alert("❌ PIN incorrecto"); return false; }
    return ok = true;
  }
  function pintar() {
    const lista = acciones(), cuerpo = document.getElementById("adg-cuerpo"); cuerpo.innerHTML = ""; let grupo = null;
    lista.forEach(a => {
      if (a.g !== grupo) { grupo = a.g; const h = document.createElement("div"); h.textContent = a.g; h.style.cssText = "font-weight:900;margin:10px 0 4px"; cuerpo.appendChild(h); }
      if (a.input) { const i = document.createElement("input"); i.id = a.input; i.maxLength = 80; i.placeholder = a.t; i.style.cssText = "width:65%;padding:8px;border-radius:8px;border:0;margin:3px"; cuerpo.appendChild(i); return; }
      const b = document.createElement("button"); b.textContent = a.t;
      b.style.cssText = `margin:3px;padding:8px 10px;border:0;border-radius:10px;background:${a.c || "#ffffff22"};color:#fff;font-weight:800;cursor:pointer`;
      b.onclick = () => { try { a.f(); } catch (e) { console.error(e); } if (a.cierra) cerrar(); else pintar(); };
      cuerpo.appendChild(b);
    });
    if (!lista.length) cuerpo.textContent = "Empezá una partida para usar el menú.";
  }
  async function abrir() { if (!esGonza() || !(await pedirPin())) return; document.exitPointerLock?.(); document.getElementById("adg").style.display = "block"; pintar(); }
  function cerrar() { document.getElementById("adg").style.display = "none"; }
  function instalar(op) {
    acciones = op.acciones;
    const d = document.createElement("div"); d.id = "adg";
    d.style.cssText = "display:none;position:fixed;inset:0;z-index:999;background:#000c;overflow:auto;padding:16px;font-family:system-ui,sans-serif;color:#fff";
    d.innerHTML = `<div style="max-width:520px;margin:0 auto;background:#1a0f2e;border:2px solid #ffd400;border-radius:16px;padding:16px">
      <h2 style="margin:0 0 6px;text-align:center">🛠️ Menú admin · Gonza</h2><div id="adg-cuerpo"></div>
      <button id="adg-x" style="margin-top:12px;width:100%;padding:8px;border:0;border-radius:10px;background:#ffffff22;color:#fff;font-weight:800">Cerrar</button></div>`;
    document.body.appendChild(d); document.getElementById("adg-x").onclick = cerrar;
    const b = document.createElement("button"); b.textContent = "🛠️ Admin";
    b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:6px;z-index:998;border:0;border-radius:12px;padding:6px 12px;background:#ffd400;color:#000;font-weight:900;display:none";
    b.onclick = abrir; document.body.appendChild(b);
    const ver = () => { b.style.display = esGonza() ? "block" : "none"; }; ver(); setInterval(ver, 2000);
  }
  return { instalar, esGonza, abrir, valor: id => (document.getElementById(id)?.value || "").trim() };
})();
