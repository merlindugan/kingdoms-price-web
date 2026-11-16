/* =====================================================================
   COLISEO · RED (multijugador)
   El que crea la sala es el ANFITRIÓN: tiene la partida "de verdad" y la manda
   a los demás. Los CLIENTES solo muestran y mandan sus acciones al anfitrión.
   Transporte: PeerJS (WebRTC). Para probar sin internet: ?red=local usa
   BroadcastChannel entre pestañas del mismo navegador.
   ===================================================================== */
(function (root) {
const PREFIJO = 'coliseo-merlin-';
const listeners = {};
const Red = {
  modo: 'solo',          // 'solo' | 'host' | 'cliente'
  codigo: null,
  conexiones: [],        // (host) [{id, nombre, enviar, vivo}]
  on(tipo, fn) { (listeners[tipo] = listeners[tipo] || []).push(fn); },
  off(tipo) { delete listeners[tipo]; },
  emitir(tipo, ...a) { (listeners[tipo] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } }); },
};
const local = /[?&]red=local/.test(location.search);
/* ---------- mensajes grandes en pedazos ----------
   WebRTC entre navegadores distintos (ej. Chrome ↔ Safari) no garantiza mensajes de más de ~16 KB,
   y PeerJS en modo JSON no los parte: la partida completa pesa 20-50 KB. */
const TROZO = 8000;
let sigId = 1;
function partir(msg) {
  const s = JSON.stringify(msg);
  if (s.length <= TROZO) return [JSON.parse(s)];   // siempre limpio: sin funciones ni cosas que no viajan
  const id = (sigId++) + '-' + Math.random().toString(36).slice(2, 6), n = Math.ceil(s.length / TROZO), out = [];
  for (let i = 0; i < n; i++) out.push({ t: '_trozo', id, i, n, d: s.slice(i * TROZO, (i + 1) * TROZO) });
  return out;
}
function armador() {
  const pend = {};
  return (msg) => {   // devuelve el mensaje completo o null si falta
    if (!msg || msg.t !== '_trozo') return msg;
    const p = pend[msg.id] || (pend[msg.id] = { n: msg.n, partes: [], llegaron: 0, t: Date.now() });
    if (!p.partes[msg.i]) { p.partes[msg.i] = msg.d; p.llegaron++; }
    if (p.llegaron < p.n) return null;
    delete pend[msg.id];
    try { return JSON.parse(p.partes.join('')); } catch (e) { console.error('trozo roto', e); return null; }
  };
}
const nuevoCodigo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/* ---------- transporte local (pruebas): BroadcastChannel ---------- */
function canalLocal(codigo) {
  const bc = new BroadcastChannel(PREFIJO + codigo);
  return bc;
}

/* ---------- ANFITRIÓN ---------- */
Red.crearSala = () => new Promise((ok, mal) => {
  const codigo = nuevoCodigo();
  Red.modo = 'host'; Red.codigo = codigo; Red.conexiones = [];
  const alta = (id, enviarCrudo) => {
    const c = { id, nombre: '?', enviar: (msg) => partir(msg).forEach((m) => enviarCrudo(m)), vivo: true, armar: armador() };
    Red.conexiones.push(c);
    return c;
  };
  const recibir = (c, crudo) => {
    const msg = c.armar(crudo); if (!msg) return;
    if (msg.t === 'hola') { c.nombre = (msg.nombre || 'Jugador').slice(0, 14); c.tok = msg.tok || null; Red.emitir('llega', c); }
    else Red.emitir('msg', c, msg);
  };
  const baja = (c) => { if (!c.vivo) return; c.vivo = false; Red.emitir('se-va', c); };
  if (local) {
    const bc = canalLocal(codigo); Red._bc = bc;
    const porId = {};
    bc.onmessage = (ev) => {
      const m = ev.data; if (m.para !== 'host') return;
      let c = porId[m.de];
      if (!c) c = porId[m.de] = alta(m.de, (msg) => bc.postMessage({ para: m.de, msg }));
      if (m.msg.t === 'chau') return baja(c);
      recibir(c, m.msg);
    };
    return ok(codigo);
  }
  if (!root.Peer) return mal(new Error('No se pudo cargar PeerJS (¿sin internet?)'));
  const peer = new root.Peer(PREFIJO + codigo, { debug: 1 });
  Red._peer = peer;
  peer.on('open', () => ok(codigo));
  peer.on('error', (e) => { if (e.type === 'unavailable-id') { peer.destroy(); Red.crearSala().then(ok, mal); } else { Red.emitir('error', e); mal(e); } });
  peer.on('connection', (conn) => {
    let c = null;
    conn.on('open', () => { c = alta(conn.peer, (msg) => { try { conn.send(msg); } catch (e) {} }); });
    conn.on('data', (msg) => { if (c) recibir(c, msg); });
    conn.on('close', () => c && baja(c));
    conn.on('error', () => { if (c && !conn.open) baja(c); });
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
});
// mandar a todos los clientes (o a uno)
Red.difundir = (msg) => { for (const c of Red.conexiones) if (c.vivo) c.enviar(msg); };
Red.enviarA = (c, msg) => { if (c && c.vivo) c.enviar(msg); };

/* ---------- CLIENTE ---------- */
// ficha que identifica a este jugador: si se corta y vuelve a entrar, recupera su emperador
// se guarda en el celu/compu (no solo en la pestaña): aunque cierres el navegador, al volver te reconoce
const fichaSesion = () => { try { let t = localStorage.getItem('coliseo_tok'); if (!t) { t = Math.random().toString(36).slice(2, 12); localStorage.setItem('coliseo_tok', t); } return t; } catch (e) { return Red._tok || (Red._tok = Math.random().toString(36).slice(2, 12)); } };
Red.unirse = (codigo, nombre) => new Promise((ok, mal) => {
  codigo = (codigo || '').trim().toUpperCase();
  Red.modo = 'cliente'; Red.codigo = codigo;
  if (local) {
    const yo = 'c' + Math.random().toString(36).slice(2, 8);
    const bc = canalLocal(codigo); Red._bc = bc;
    const armar = armador();
    Red.enviar = (msg) => partir(msg).forEach((m) => bc.postMessage({ para: 'host', de: yo, msg: m }));
    bc.onmessage = (ev) => { if (ev.data.para !== yo) return; const m = armar(ev.data.msg); if (m) Red.emitir('msg', null, m); };
    window.addEventListener('beforeunload', () => Red.enviar({ t: 'chau' }));
    Red.enviar({ t: 'hola', nombre, tok: fichaSesion() });
    return ok();
  }
  if (!root.Peer) return mal(new Error('No se pudo cargar PeerJS (¿sin internet?)'));
  const peer = new root.Peer({ debug: 1 });
  Red._peer = peer;
  let listo = false, conn = null, intentos = 0, reintento = null, cerrado = false;
  const armar = armador();
  Red.enviar = (msg) => partir(msg).forEach((m) => { try { conn && conn.open && conn.send(m); } catch (e) {} });
  // si se corta, no lo echamos de una: probamos volver a conectar unos segundos
  const caida = () => {
    if (!listo || cerrado || reintento) return;
    if (conn && conn.open) return;   // un error suelto con la conexión viva no es un corte
    Red.emitir('reconectando', true);
    const probar = () => {
      reintento = null;
      if (cerrado) return;
      if (++intentos > 10) { cerrado = true; Red.emitir('reconectando', false); return Red.emitir('cortado'); }
      try { if (peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) {}
      conectar();
      reintento = setTimeout(() => { if (!(conn && conn.open)) probar(); }, 2500);
    };
    probar();
  };
  const conectar = () => {
    try { conn && conn.close(); } catch (e) {}
    conn = peer.connect(PREFIJO + codigo, { reliable: true, serialization: 'json' });
    conn.on('open', () => {
      const vuelta = listo; listo = true; intentos = 0;
      if (reintento) { clearTimeout(reintento); reintento = null; }
      Red.enviar({ t: 'hola', nombre, tok: fichaSesion(), vuelta });
      if (vuelta) Red.emitir('reconectando', false); else ok();
    });
    conn.on('data', (crudo) => { const m = armar(crudo); if (m) Red.emitir('msg', null, m); });
    conn.on('close', caida);
    conn.on('error', caida);
  };
  peer.on('open', () => { if (!conn) conectar(); });
  // el servidor de PeerJS solo sirve para encontrarse: si se cae, la partida sigue por la conexión directa
  peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} });
  peer.on('error', (e) => { if (!listo) mal(e.type === 'peer-unavailable' ? new Error('No existe una sala con ese código.') : e); else caida(); });
  Red._cerrarCliente = () => { cerrado = true; };
  setTimeout(() => { if (!listo) mal(new Error('No se pudo conectar (tiempo agotado).')); }, 15000);
});

Red.cerrar = () => {
  try { Red._cerrarCliente && Red._cerrarCliente(); } catch (e) {}
  try { Red._peer && Red._peer.destroy(); } catch (e) {}
  try { Red._bc && Red._bc.close(); } catch (e) {}
  Red._peer = Red._bc = null; Red.modo = 'solo'; Red.conexiones = []; Red.codigo = null;
};
Red.local = local;
Red._partir = partir; Red._armador = armador;
root.Red = Red;
})(window);
