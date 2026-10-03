// Base de datos propia (Supabase). La clave es pública: la seguridad la ponen las reglas (RLS) de la base.
const RANGOS = [
  { id:"hierro",   nom:"Hierro",      ico:"🔩", xp:0,    col:"#9aa4ad" },
  { id:"bronce",   nom:"Bronce",      ico:"🥉", xp:100,  col:"#cd7f32" },
  { id:"plata",    nom:"Plata",       ico:"🥈", xp:300,  col:"#c0c7d0" },
  { id:"oro",      nom:"Oro",         ico:"🥇", xp:700,  col:"#ffd400" },
  { id:"platino",  nom:"Platino",     ico:"💠", xp:1300, col:"#5ad1ff" },
  { id:"diamante", nom:"Diamante",    ico:"💎", xp:2200, col:"#b57bff" },
  { id:"maestro",  nom:"Maestro",     ico:"🔥", xp:3500, col:"#ff6a3d" },
  { id:"leyenda",  nom:"Leyenda del Gordo", ico:"👑", xp:5500, col:"#ff3bd4" },
];
const DB = (() => {
  const URL = "https://eluxvcixctwnzyysvoor.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdXh2Y2l4Y3R3bnp5eXN2b29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTk5NzAsImV4cCI6MjEwMzY5NTk3MH0.Gq29eHc-X1vEfbxM_9E5mlOynIJCh0pBbsSOPX923IQ";
  const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
  async function pedir(ruta, opciones = {}) {
    const r = await fetch(URL + "/rest/v1/" + ruta, { ...opciones, headers: { ...H, ...(opciones.headers || {}) } });
    if (!r.ok) throw new Error("DB " + r.status);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  }
  const leer = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  return {
    get nombre() { return leer("nombre", ""); },
    set nombre(v) { try { localStorage.setItem("nombre", String(v).trim().slice(0, 20)); } catch (e) {} },
    // Guarda una partida terminada
    async guardarPartida(modo, gano, duracionSeg, puntos = 0) {
      if (!this.nombre) return;
      try {
        await pedir("partidas", { method: "POST", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ nombre: this.nombre, modo, dificultad: (window.AJUSTES ? AJUSTES.dificultad : "normal"), gano, duracion_seg: Math.round(duracionSeg), puntos }) });
        this.avisarRango();
      } catch (e) { console.warn(e); }
    },
    ranking(modo) { const orden = (modo === "comida" || modo === "gallina") ? "mejor_puntaje.desc" : "ganadas.desc,perdidas.asc";
      return pedir("ranking?select=*" + (modo ? "&modo=eq." + modo : "") + "&order=" + orden + "&limit=10"); },
    historial(nombre) { return pedir("partidas?select=*&nombre=eq." + encodeURIComponent(nombre) + "&order=creado.desc&limit=10"); },
    // Muestra un cartel si subiste de rango
    async avisarRango() {
      try {
        const p = await this.perfil(); const r = this.rango(p.xp), suma = p.xp - Number(leer("ultimo-xp", p.xp));
        const antes = leer("ultimo-rango", r.id);
        try { localStorage.setItem("ultimo-rango", r.id); localStorage.setItem("ultimo-xp", p.xp); } catch (e) {}
        const subio = RANGOS.findIndex(x => x.id === r.id) > RANGOS.findIndex(x => x.id === antes);
        const d = document.createElement("div");
        d.style.cssText = `position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:99999;background:#14102aee;border:3px solid ${r.col};color:#fff;
          border-radius:16px;padding:${subio ? "18px 26px" : "8px 16px"};text-align:center;font-family:system-ui,sans-serif;font-weight:800;box-shadow:0 0 30px ${r.col};
          transition:opacity .6s;pointer-events:none`;
        d.innerHTML = subio ? `<div style="font-size:54px">${r.ico}</div><div style="font-size:22px">¡SUBISTE A ${r.nom.toUpperCase()}!</div><div style="opacity:.8">${p.xp} XP</div>`
                            : `${r.ico} ${r.nom} · ${suma > 0 ? "+" + suma + " XP · " : ""}${p.xp} XP`;
        document.body.appendChild(d); setTimeout(() => d.style.opacity = 0, subio ? 4000 : 2500); setTimeout(() => d.remove(), subio ? 4700 : 3200);
      } catch (e) {}
    },
    // Frases del Gordo
    async guardarFrase(texto) {
      try { const r = await pedir("frases", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ texto: String(texto).slice(0, 160) }) }); return r && r[0]; }
      catch (e) { console.warn(e); }
    },
    mejoresFrases() { return pedir("frases?select=id,texto,votos&order=votos.desc,creado.desc&limit=10"); },
    votar(id) { return pedir("rpc/votar_frase", { method: "POST", body: JSON.stringify({ frase_id: id }) }); },
    // ---- Rangos (la experiencia se calcula en la base con todas tus partidas) ----
    // Ganar da 30 XP, perder 10, y los puntos de los juegos de puntaje suman un extra.
    RANGOS,
    rango(xp) { let r = RANGOS[0]; for (const x of RANGOS) if (xp >= x.xp) r = x; return r; },
    progreso(xp) { const i = RANGOS.indexOf(this.rango(xp)), sig = RANGOS[i + 1];
      return sig ? { sig, falta: sig.xp - xp, pct: Math.round((xp - RANGOS[i].xp) / (sig.xp - RANGOS[i].xp) * 100) } : { sig: null, falta: 0, pct: 100 }; },
    async perfil(nombre = this.nombre) { if (!nombre) return null;
      const r = await pedir("perfiles?select=*&nombre=eq." + encodeURIComponent(nombre)); return r && r[0] || { nombre, partidas: 0, ganadas: 0, xp: 0 }; },
    async perfiles(nombres) { if (!nombres.length) return [];
      const lista = nombres.map(n => '"' + String(n).replace(/["\\,()]/g, "") + '"').join(",");
      return pedir("perfiles?select=nombre,xp&nombre=in." + encodeURIComponent("(" + lista + ")")); },
    topRangos() { return pedir("perfiles?select=*&order=xp.desc&limit=20"); },
    // ---- Tienda VIP (las gemas solo las da el admin) ----
    vipItems() { return pedir("vip_items?select=*&activo=eq.true&order=tipo,precio"); },
    async gemas(nombre = this.nombre) { const r = await pedir("gemas_saldo?select=saldo&nombre=eq." + encodeURIComponent(nombre)); return r && r[0] ? r[0].saldo : 0; },
    misCompras(nombre = this.nombre) { return pedir("vip_compras?select=item_id&nombre=eq." + encodeURIComponent(nombre)); },
    miEquipo(nombre = this.nombre) { return pedir("vip_equipo?select=*&nombre=eq." + encodeURIComponent(nombre)).then(r => r[0] || {}); },
    comprarVip(item) { return pedir("rpc/comprar_vip", { method: "POST", body: JSON.stringify({ p_nombre: this.nombre, p_item: item }) }); },
    equiparVip(item, tipo) { return pedir("rpc/equipar_vip", { method: "POST", body: JSON.stringify({ p_nombre: this.nombre, p_item: item, p_tipo: tipo }) }); },
    // Estilo VIP de varios jugadores a la vez: { nombre: { insignia, color, titulo } }
    async estilosVip(nombres) {
      if (!nombres.length) return {};
      const lista = nombres.map(n => '"' + String(n).replace(/["\\,()]/g, "") + '"').join(",");
      const [eq, items] = await Promise.all([pedir("vip_equipo?select=*&nombre=in." + encodeURIComponent("(" + lista + ")")), this._itemsCache || (this._itemsCache = pedir("vip_items?select=id,valor,tipo"))]);
      const porId = Object.fromEntries(items.map(i => [i.id, i.valor])), r = {};
      for (const e of eq) r[e.nombre] = { insignia: porId[e.insignia] || "", color: porId[e.color] || "", titulo: porId[e.titulo] || "" };
      return r;
    },
  };
})();
