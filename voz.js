// Sala de voz: audio directo entre jugadores (WebRTC), usando el canal de Supabase para conectarse.
// Uso: Voz.preparar(canal, miId) ANTES de canal.subscribe(); después el botón 🎤 hace el resto.
const Voz = (() => {
  // STUN de Google + TURN público gratuito (Open Relay) para redes que bloquean la conexión directa
  const ICE = { iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"],
      username: "openrelayproject", credential: "openrelayproject" } ] };
  let canal = null, yo = null, mic = null, activo = false, muteado = false, sordo = false;
  const pares = {};   // id -> RTCPeerConnection
  const audios = {};  // id -> <audio>
  const hablando = {}; // id -> true/false (para mostrar quién habla)
  const iceEnEspera = {}; // candidatos que llegan antes de la oferta/respuesta
  const medidores = {};   // id -> intervalo del medidor de volumen

  function mandar(tipo, data) { canal && canal.send({ type: "broadcast", event: "voz", payload: { tipo, de: yo, ...data } }); }

  function crearPar(id) {
    if (pares[id]) return pares[id];
    const pc = new RTCPeerConnection(ICE);
    pares[id] = pc;
    mic.getTracks().forEach(t => pc.addTrack(t, mic));
    pc.onicecandidate = e => { if (e.candidate) mandar("ice", { a: id, ice: e.candidate }); };
    pc.ontrack = e => {
      let au = audios[id];
      if (!au) { au = audios[id] = new Audio(); au.autoplay = true; au.playsInline = true; au.muted = sordo; document.body.appendChild(au); }
      au.srcObject = e.streams[0]; au.play().catch(() => {});
      medir(id, e.streams[0]);
    };
    // Si se corta, se reconecta solo
    let corte = null;
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState; clearTimeout(corte);
      if (st === "failed") reconectar(id);
      else if (st === "disconnected") corte = setTimeout(() => { if (pc.connectionState !== "connected") reconectar(id); }, 4000);
      actualizar();
    };
    return pc;
  }
  function reconectar(id) { if (!activo) return; cerrarPar(id); mandar("hola", { a: id }); }
  // Para no chocar, siempre ofrece el que tiene el id "menor"
  async function ofrecer(id) {
    if (pares[id] && pares[id].connectionState === "connected") return;
    if (pares[id]) cerrarPar(id);
    const pc = crearPar(id);
    await pc.setLocalDescription(await pc.createOffer());
    mandar("oferta", { a: id, sdp: pc.localDescription });
  }
  async function vaciarIce(id) { const l = iceEnEspera[id] || []; delete iceEnEspera[id]; for (const c of l) { try { await pares[id]?.addIceCandidate(c); } catch (e) {} } }
  function cerrarPar(id) {
    try { pares[id] && pares[id].close(); } catch (e) {}
    clearInterval(medidores[id]); delete medidores[id]; delete iceEnEspera[id];
    delete pares[id]; delete hablando[id];
    if (audios[id]) { audios[id].remove(); delete audios[id]; }
    actualizar();
  }

  async function recibir({ payload: m }) {
    if (!activo || m.de === yo) return;
    if (m.a && m.a !== yo) return; // mensaje para otro
    try {
      if (m.tipo === "hola") {          // alguien entró (o pide reconectar)
        if (yo < m.de) await ofrecer(m.de);
        else if (!m.a) mandar("hola", { a: m.de });  // le aviso que estoy, para que me ofrezca él
        else if (!(pares[m.de] && pares[m.de].connectionState === "connected")) { cerrarPar(m.de); mandar("hola", { a: m.de, otra: 1 }); if (m.otra) await ofrecer(m.de); }
      } else if (m.tipo === "oferta") {
        if (pares[m.de]) cerrarPar(m.de);
        const pc = crearPar(m.de);
        await pc.setRemoteDescription(m.sdp); await vaciarIce(m.de);
        await pc.setLocalDescription(await pc.createAnswer());
        mandar("respuesta", { a: m.de, sdp: pc.localDescription });
      } else if (m.tipo === "respuesta") {
        const pc = pares[m.de];
        if (pc && pc.signalingState === "have-local-offer") { await pc.setRemoteDescription(m.sdp); await vaciarIce(m.de); }
      } else if (m.tipo === "ice") {
        const pc = pares[m.de];
        if (pc && pc.remoteDescription) await pc.addIceCandidate(m.ice);
        else (iceEnEspera[m.de] = iceEnEspera[m.de] || []).push(m.ice);
      } else if (m.tipo === "chau") {
        cerrarPar(m.de);
      }
    } catch (e) { console.warn("voz", e); }
  }

  // Detecta si alguien está hablando (para iluminar su nombre)
  let ctx = null;
  function medir(id, stream) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(stream).connect(an);
      const datos = new Uint8Array(an.frequencyBinCount);
      clearInterval(medidores[id]);
      medidores[id] = setInterval(() => {
        if (!activo || (!pares[id] && id !== yo)) { clearInterval(medidores[id]); return; }
        an.getByteFrequencyData(datos);
        const v = datos.reduce((a, b) => a + b, 0) / datos.length, h = v > 18 && !(id === yo && muteado);
        if (h !== hablando[id]) { hablando[id] = h; try { Voz.onHabla && Voz.onHabla(id, h); } catch (e) {} pintarBoton(); }
      }, 150);
    } catch (e) {}
  }

  // ---- Interfaz: botón flotante ----
  const caja = document.createElement("div");
  caja.style.cssText = "position:fixed;right:12px;bottom:170px;z-index:60;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:system-ui,sans-serif";
  const btn = document.createElement("button");
  btn.style.cssText = "font-size:15px;padding:10px 14px;border:0;border-radius:24px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px #0008";
  const lista = document.createElement("div");
  lista.style.cssText = "background:#000a;color:#fff;border-radius:10px;padding:6px 10px;font-size:13px;display:none";
  caja.append(lista, btn);

  function actualizar() {
    try { Voz.onCambio && Voz.onCambio(estado()); } catch (e) {}
    pintarBoton();
  }
  function pintarBoton() {
    if (!caja.isConnected) return;
    if (!activo) { btn.textContent = "🎙️ Entrar a la voz"; btn.style.background = "#3fb6ff"; btn.style.color = "#001a2a"; lista.style.display = "none"; return; }
    btn.textContent = muteado ? "🔇 Micrófono apagado" : "🎤 Hablando (tocá para silenciar)";
    btn.style.background = muteado ? "#ff5a5a" : "#3ddc5a"; btn.style.color = "#000";
    const conectados = Object.keys(pares).filter(id => pares[id].connectionState === "connected");
    lista.style.display = "block";
    lista.innerHTML = `🔊 En la voz: ${conectados.length + 1}<br>` +
      [yo, ...conectados].map(id => `${hablando[id] ? "🟢" : "⚪"} ${id === yo ? "Vos" : (Voz.nombre(id) || "Jugador")}`).join("<br>");
  }

  async function entrar() {
    if (!canal || activo) return true;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { btn.textContent = "❌ Sin permiso de micrófono"; return false; }
    activo = true; muteado = false; medir(yo, mic); mandar("hola", {}); actualizar();
    // Por si el primer aviso se perdió, lo repito un par de veces
    setTimeout(() => activo && mandar("hola", {}), 2500); setTimeout(() => activo && mandar("hola", {}), 7000);
    return true;
  }
  function alternarMute() { if (!activo) return; muteado = !muteado; mic.getAudioTracks().forEach(t => t.enabled = !muteado); actualizar(); }
  function alternarSordo() { sordo = !sordo; Object.values(audios).forEach(a => a.muted = sordo); actualizar(); }
  function estado() {
    const conectados = Object.keys(pares).filter(id => pares[id].connectionState === "connected");
    return { activo, muteado, sordo, personas: activo ? [yo, ...conectados].map(id => ({ id, yo: id === yo, hablando: !!hablando[id] })) : [] };
  }
  btn.onclick = () => activo ? alternarMute() : entrar();
  addEventListener("beforeunload", () => { if (activo) mandar("chau", {}); });

  return {
    nombre: () => null,   // cada juego puede reemplazarlo para mostrar nombres
    onCambio: null,       // se llama cuando cambia quién está conectado o el micrófono
    onHabla: null,        // (id, true/false) cuando alguien empieza o deja de hablar
    // ui:false para usar tu propia interfaz (como en el chat estilo Discord)
    preparar(c, id, op = {}) { canal = c; yo = id; c.on("broadcast", { event: "voz" }, recibir);
      if (op.ui === false) caja.remove(); else if (!caja.isConnected) document.body.appendChild(caja); actualizar(); },
    entrar, alternarMute, alternarSordo, estado,
    salir() { if (!activo) return; mandar("chau", {}); Object.keys(pares).forEach(cerrarPar); clearInterval(medidores[yo]); delete medidores[yo]; delete hablando[yo];
      mic && mic.getTracks().forEach(t => t.stop()); activo = false; muteado = false; actualizar(); },
  };
})();
