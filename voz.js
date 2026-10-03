// Sala de voz: audio directo entre jugadores (WebRTC), usando el canal de Supabase para conectarse.
// Uso: Voz.preparar(canal, miId) ANTES de canal.subscribe(); después el botón 🎤 hace el resto.
const Voz = (() => {
  const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
  let canal = null, yo = null, mic = null, activo = false, muteado = false;
  const pares = {};   // id -> RTCPeerConnection
  const audios = {};  // id -> <audio>
  const hablando = {}; // id -> true/false (para mostrar quién habla)

  function mandar(tipo, data) { canal && canal.send({ type: "broadcast", event: "voz", payload: { tipo, de: yo, ...data } }); }

  function crearPar(id) {
    if (pares[id]) return pares[id];
    const pc = new RTCPeerConnection(ICE);
    pares[id] = pc;
    mic.getTracks().forEach(t => pc.addTrack(t, mic));
    pc.onicecandidate = e => { if (e.candidate) mandar("ice", { a: id, ice: e.candidate }); };
    pc.ontrack = e => {
      let au = audios[id];
      if (!au) { au = audios[id] = new Audio(); au.autoplay = true; au.playsInline = true; document.body.appendChild(au); }
      au.srcObject = e.streams[0]; au.play().catch(() => {});
      medir(id, e.streams[0]);
    };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) cerrarPar(id); actualizar(); };
    return pc;
  }
  function cerrarPar(id) {
    try { pares[id] && pares[id].close(); } catch (e) {}
    delete pares[id]; delete hablando[id];
    if (audios[id]) { audios[id].remove(); delete audios[id]; }
    actualizar();
  }

  async function recibir({ payload: m }) {
    if (!activo || m.de === yo) return;
    if (m.a && m.a !== yo) return; // mensaje para otro
    try {
      if (m.tipo === "hola") {         // alguien entró a la voz: yo le ofrezco conexión
        const pc = crearPar(m.de);
        await pc.setLocalDescription(await pc.createOffer());
        mandar("oferta", { a: m.de, sdp: pc.localDescription });
      } else if (m.tipo === "oferta") {
        const pc = crearPar(m.de);
        await pc.setRemoteDescription(m.sdp);
        await pc.setLocalDescription(await pc.createAnswer());
        mandar("respuesta", { a: m.de, sdp: pc.localDescription });
      } else if (m.tipo === "respuesta") {
        await pares[m.de]?.setRemoteDescription(m.sdp);
      } else if (m.tipo === "ice") {
        await pares[m.de]?.addIceCandidate(m.ice);
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
      const an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(stream).connect(an);
      const datos = new Uint8Array(an.frequencyBinCount);
      const tic = () => { if (!pares[id] && id !== yo) return; an.getByteFrequencyData(datos);
        const v = datos.reduce((a, b) => a + b, 0) / datos.length; const h = v > 18 && !(id === yo && muteado);
        if (h !== hablando[id]) { hablando[id] = h; actualizar(); } requestAnimationFrame(tic); };
      tic();
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
    if (!activo) { btn.textContent = "🎙️ Entrar a la voz"; btn.style.background = "#3fb6ff"; btn.style.color = "#001a2a"; lista.style.display = "none"; return; }
    btn.textContent = muteado ? "🔇 Micrófono apagado" : "🎤 Hablando (tocá para silenciar)";
    btn.style.background = muteado ? "#ff5a5a" : "#3ddc5a"; btn.style.color = "#000";
    const conectados = Object.keys(pares).filter(id => pares[id].connectionState === "connected");
    lista.style.display = "block";
    lista.innerHTML = `🔊 En la voz: ${conectados.length + 1}<br>` +
      [yo, ...conectados].map(id => `${hablando[id] ? "🟢" : "⚪"} ${id === yo ? "Vos" : (Voz.nombre(id) || "Jugador")}`).join("<br>");
  }

  btn.onclick = async () => {
    if (!canal) return;
    if (!activo) {
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { btn.textContent = "❌ Sin permiso de micrófono"; return; }
      activo = true; muteado = false; medir(yo, mic); mandar("hola", {}); actualizar();
    } else {
      muteado = !muteado; mic.getAudioTracks().forEach(t => t.enabled = !muteado); actualizar();
    }
  };
  addEventListener("beforeunload", () => { if (activo) mandar("chau", {}); });

  return {
    nombre: () => null,  // cada juego puede reemplazarlo para mostrar nombres
    preparar(c, id) { canal = c; yo = id; c.on("broadcast", { event: "voz" }, recibir); if (!caja.isConnected) document.body.appendChild(caja); actualizar(); },
    salir() { if (!activo) return; mandar("chau", {}); Object.keys(pares).forEach(cerrarPar); mic && mic.getTracks().forEach(t => t.stop()); activo = false; actualizar(); },
  };
})();
