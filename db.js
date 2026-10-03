// Base de datos propia (Supabase). La clave es pública: la seguridad la ponen las reglas (RLS) de la base.
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
      } catch (e) { console.warn(e); }
    },
    ranking(modo) { const orden = (modo === "comida" || modo === "gallina") ? "mejor_puntaje.desc" : "ganadas.desc,perdidas.asc";
      return pedir("ranking?select=*" + (modo ? "&modo=eq." + modo : "") + "&order=" + orden + "&limit=10"); },
    historial(nombre) { return pedir("partidas?select=*&nombre=eq." + encodeURIComponent(nombre) + "&order=creado.desc&limit=10"); },
    // Frases del Gordo
    async guardarFrase(texto) {
      try { const r = await pedir("frases", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ texto: String(texto).slice(0, 160) }) }); return r && r[0]; }
      catch (e) { console.warn(e); }
    },
    mejoresFrases() { return pedir("frases?select=id,texto,votos&order=votos.desc,creado.desc&limit=10"); },
    votar(id) { return pedir("rpc/votar_frase", { method: "POST", body: JSON.stringify({ frase_id: id }) }); },
  };
})();
