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
