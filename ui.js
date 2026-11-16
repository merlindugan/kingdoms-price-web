/* =====================================================================
   COLISEO · PANTALLAS + FLUJO DE PARTIDA (solo y multijugador)
   menú (prisión) → salón / sala online → tablero ↔ subasta / evento /
   preparación / pelea / post / recuperación → final
   El ANFITRIÓN (o el jugador solo) tiene la partida y decide; los CLIENTES
   muestran lo que manda el anfitrión y le mandan sus acciones.
   ===================================================================== */
(function () {
const R = window.REGLAS, M = window.Motor, P = window.Partida, S = window.Sprites, E = window.Escenas, Red = window.Red;
const root = document.getElementById('root');
const $ = (q, c = document) => c.querySelector(q);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const V3 = (x, y, z) => window.Mundo.V3(x, y, z);
let G = null, YO = 0;
const yo = () => G.emperadores[YO];
const esHost = () => Red.modo !== 'cliente';
const online = () => Red.modo !== 'solo';
const ICON = { subasta: '⚖️', evento: '📜', preparacion: '⚒️', pelea: '⚔️', recuperacion: '🩹', campeones: '👑' };
const nombreDe = (e) => (e.id === YO ? `${e.nombre} (vos)` : e.nombre);

/* =====================================================================
   UTILIDADES DE PANTALLA
   ===================================================================== */
function pantalla(escena, html, opts) {
  window.Arena && window.Arena.salir();
  root.innerHTML = '';
  const scr = h(`<div class="scr"><div class="box"></div></div>`);
  root.appendChild(scr);
  const box = $('.box', scr);
  if (html) box.insertAdjacentHTML('beforeend', html);
  if (escena) box.h = window.Mundo.montar(box, escena, opts || {});
  return box;
}
function anclar(box, el, punto) { box.h.frames.push(() => { const p = box.h.proyectar(punto()); el.style.left = p.x + '%'; el.style.top = p.y + '%'; }); }
function modal(html) { const m = h(`<div class="modal"><div class="panel">${html}</div></div>`); document.body.appendChild(m); return m; }
function alertar(t) { const m = modal(`<div style="font-size:15px">${t}</div><br><button id="x">Ok</button>`); $('#x', m).onclick = () => m.remove(); }
const tiles = new Map();
function framesDe(g, color) {
  const key = g.id + color + g.equipo.arma + g.equipo.escudo + g.equipo.armadura;
  if (!tiles.has(key)) tiles.set(key, window.Rig ? [window.Rig.retrato(specDe(g, color))] : S.frames(specDe(g, color)));
  return tiles.get(key);
}
const specDe = (g, color) => ({ id: g.id, raza: M.razaVisual(g, false), color, piel: M.pielDe(g), jefe: g.jefe, esbirro: g.esbirro, ojosRojos: !!g.resucitado, ...g.equipo, protesis: g.protesis || null });
const razaDe = (g) => (g.esbirro && R.ESBIRROS[g.esbirro] ? R.ESBIRROS[g.esbirro].nombre : g.jefe ? R.JEFES[g.jefe].titulo.replace(/^./, (c) => c.toUpperCase()) : M.razaLabel(g, G && g.dueno === YO));
const keyDe = (g, color) => g.id + color + g.equipo.arma + g.equipo.escudo + g.equipo.armadura;
// rasgos tocables: al apretar uno se ve qué hace
const rasgosHTML = (g) => (g.rasgos.length ? g.rasgos.map((k) => `<button class="rasgo" data-r="${k}">${R.RASGOS[k].label} <span>ⓘ</span></button>`).join(' ') : 'ninguno');
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.rasgo');
  document.querySelectorAll('.rasgo-pop').forEach((x) => x.remove());
  if (!b) return;
  e.stopPropagation();
  const r = R.RASGOS[b.dataset.r]; if (!r) return;
  const pop = h(`<div class="rasgo-pop"><b>${r.label}</b><div>${r.desc}</div></div>`);
  document.body.appendChild(pop);
  const bb = b.getBoundingClientRect(), pw = Math.min(260, window.innerWidth - 16);
  pop.style.width = pw + 'px';
  pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, bb.left)) + 'px';
  const ph = pop.offsetHeight; pop.style.top = (bb.bottom + ph + 8 < window.innerHeight ? bb.bottom + 6 : bb.top - ph - 6) + 'px';
}, true);
function retrato(g, color) { const c = document.createElement('canvas'); c.width = 52; c.height = 52; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(framesDe(g, color)[0], 0, 0, 52, 52); return c; }
const colorDueno = (g) => (g.dueno !== undefined && G.emperadores[g.dueno] ? G.emperadores[g.dueno].color : '#9a8a70');
const bolsaTxt = (e) => `${e.bolsa.oro} oro`;
const bolsaHTML = (e) => `<span class="mo oro"></span>${e.bolsa.oro}`;
const barCol = (v) => (v >= 75 ? '#e0b44c' : v >= 55 ? '#6fb35a' : v >= 38 ? '#9fb3c8' : '#a06b5a');
const gl = (e, gid) => e.escuderia.find((g) => g.id === gid);

function tarjetaCompleta(g) {
  const div = h(`<div class="gcard"></div>`);
  div.appendChild(retrato(g, colorDueno(g)));
  const les = Object.entries(g.lesiones).filter(([, v]) => v > 0);
  div.insertAdjacentHTML('beforeend', `<b>${g.nombre}</b> <span class="tier ${g.tier}">${g.tier}</span><br>
    <span class="meta">${razaDe(g)} · ${R.ESTILOS[g.estilo].label} · ${g.edad} años</span><br>
    <span class="meta">${g.altura.toFixed(2)} m · ${g.peso} kg · potencial ${g.potencial}</span>
    <div class="stats6">${R.STATS.map((s) => `<div class="s6">${s.corto}<b>${g.stats[s.key]}</b><div class="bar"><i style="width:${g.stats[s.key]}%;background:${barCol(g.stats[s.key])}"></i></div></div>`).join('')}</div>
    <div class="meta">Vida ${g.vida ?? 100}% · <span class="salud ${P.salud(g).split(' ')[0]}">${P.salud(g)}</span>${les.length ? ' — ' + les.map(([k, v]) => `${M.INJ.label[k].toLowerCase()} ${Math.round(v * 100)}%`).join(', ') : ''}</div>
    <div class="meta">${R.ARMAS[g.equipo.arma].label} · ${R.ESCUDOS[g.equipo.escudo].label} · ${R.ARMADURAS[g.equipo.armadura].label}</div>
    <div class="meta">Récord: ${g.record.v}V ${g.record.d}D · ${g.record.muertes} muertes causadas</div>
    ${g.inspeccionado || g.dueno === YO ? `<div class="meta" style="color:#d9c4a3">Honor ${g.honor} · Rasgos: ${rasgosHTML(g)}</div>` : '<div class="meta" style="color:var(--dim)">Honor y rasgos: ?</div>'}`);
  return div;
}
function tarjetaSubasta(g, carro) {
  const v = P.vista(G, yo(), g, carro);
  const div = h(`<div class="gcard"></div>`);
  div.appendChild(retrato(g, '#8a7a62'));
  const lobo = g.raza === 'lobo' && (g._revelar || v.completo);   // inspeccionado (o con el ojito): se ve que el "humano" es hombre lobo
  div.insertAdjacentHTML('beforeend', `<b>${lobo ? R.RAZAS.lobo.label : g._revelar ? R.RAZAS[g.raza].label : razaDe(g)}</b> <span class="tier ${v.tier || 'q'}">${v.tier || '?'}</span>${lobo ? '<span class="lobo-ok">🐺 ¡es lobo!</span>' : ''}<br>
    <span class="meta">Salud: <span class="salud ${v.salud.split(' ')[0]}">${v.salud}</span></span>
    <div class="stats6">${R.STATS.map((s) => (v.stats[s.key] !== undefined ? `<div class="s6">${s.corto}<b>${v.stats[s.key]}</b></div>` : `<div class="s6 q">${s.corto}<b>?</b></div>`)).join('')}</div>`);
  return div;
}

/* =====================================================================
   FLUJO: el anfitrión decide; todos aprietan "Listo" para avanzar
   ===================================================================== */
let vista = null;             // { p, d, refrescar }
const refrescos = new Set();  // funciones extra (modales abiertos) a llamar cuando cambia el estado
function refrescar() { if (vista && vista.refrescar) vista.refrescar(); refrescos.forEach((f) => f()); }
function difundirEstado() { if (Red.modo === 'host') Red.difundir({ t: 'estado', G: P.serializar(G) }); }
function ir(p, d = {}) {   // (anfitrión) cambia de pantalla para todos
  G.flujo = { p, listos: [] };
  HOST.ultimoIr = { t: 'ir', p, d };
  if (Red.modo === 'host') { difundirEstado(); Red.difundir(HOST.ultimoIr); }
  mostrar(p, d);
}
// la música de cada pantalla (las cinemáticas la ponen ellas mismas)
function musicaDe(p, d) {
  if (p === 'subasta') return 'subasta';
  if (p === 'evento') return 'cinematica';
  if (p === 'pelea') {
    const cfg = (d && d.cfg) || HOST.cfg || {}, esc = String(cfg.escenario || '');
    if (cfg.modo === 'campeones') return 'campeones';
    if (esc.startsWith('maz')) return 'mazmorra';
    if (esc === 'cdh' || esc === 'diablo' || (d && /final/i.test(d.titulo || ''))) return 'cdh';
    return 'cde';
  }
  return 'menu';
}
function mostrar(p, d) {
  if (window.Musica) Musica.poner(musicaDe(p, d)); refrescos.clear(); if (p !== 'chaman') window.__fusionFx = null; R.PELEA.maxPorEquipo = G && G.historia && G.historia.diabloPend ? 24 : 8;   /* contra el Diablo se convocan hasta 24 */ document.querySelectorAll('.naldo').forEach((n) => { if (n._fin) n._fin(true); else n.remove(); });   /* Naldo no se queda hablando en la pantalla que sigue */ document.querySelectorAll('.modal').forEach((m) => m.remove()); vista = { p, d }; PANT[p](d || {});  if (window.Logros) setTimeout(() => { try { Logros.observar(); } catch (e) {} }, 0); }
const humanos = () => G.emperadores.filter((e) => e.esJugador);
const faltan = () => humanos().filter((e) => !(G.flujo && G.flujo.listos.includes(e.id)));
const yaListo = () => G.flujo && G.flujo.listos.includes(YO);
function esperaHTML() {
  const f = faltan();
  if (!online()) return '';
  return f.length ? `<span class="meta espera">Esperando a: ${f.map((e) => `<b style="color:${e.color}">${e.nombre}</b>`).join(', ')}</span>` : '';
}
// botón "Listo" estándar
function botonListo(label) {
  const b = h(`<button class="prim">${yaListo() ? '✔ Esperando…' : label}</button>`);
  b.disabled = yaListo();
  b.onclick = () => { b.disabled = true; b.textContent = '✔ Esperando…'; act('listo'); };
  return b;
}

// acciones: el anfitrión las ejecuta; el cliente se las manda
function act(a, ...args) { if (esHost()) ejecutar(YO, a, args); else Red.enviar({ t: 'act', a, args }); }
function ejecutar(empId, a, args) {
  const e = G.emperadores[empId]; if (!e || !ACC[a]) return;
  const r = ACC[a](e, ...args);
  if (r && r !== 'ok') priv(empId, { k: 'msg', txt: r });
  difundirEstado(); refrescar();
}
// mensaje privado a un emperador (a vos o a un cliente)
function priv(empId, obj) {
  if (empId === YO) return manejarPriv(obj);
  const c = Red.conexiones.filter((x) => x.empId === empId && x.vivo).pop(); if (c) Red.enviarA(c, { t: 'priv', ...obj });
}
let PRIV = {};
function manejarPriv(o) {
  if (o.k === 'msg') return alertar(o.txt);
  if (o.k === 'fusion' && window.__fusionFx && !o.visto) { window.__fusionFx(o.r.ok); return setTimeout(() => manejarPriv({ ...o, visto: true }), 1700); }
  if (o.k === 'fusion') { const r = o.r, m = modal(`<div class="fu-res ${r.ok ? 'bien' : 'mal'}"><div class="fu-ic"></div><b>${r.ok ? '¡La fusión salió bien!' : 'La fusión salió mal'}</b>${r.ok ? `<p>${r.a} ahora es <span class="tier ${r.a2}">${r.a2}</span></p><p>${r.b} se fundió en él.</p>` : `<p>Perdiste a ${r.a}</p><p>y también a ${r.b}.</p>`}</div><div class="fu-bts"><button class="prim" id="x">Seguir</button></div>`); $('.fu-ic', m).appendChild(iconoMisc('fusion')); $('#x', m).onclick = () => m.remove(); return; }
  if (o.k === 'evento') PRIV.ev = o.ev;
  if (o.k === 'eventoRes') PRIV.evRes = o.txt;
  refrescar();
}

/* ---------- acciones (las corre el anfitrión) ---------- */
const HOST = {};
const ACC = {
  listo(e) {
    if (!G.flujo || G.flujo.listos.includes(e.id)) return 'ok';
    if (G.flujo.p === 'subasta' && HOST.sub && HOST.sub.estado !== 'fin') return 'ok';
    G.flujo.listos.push(e.id);
    if (!faltan().length) setTimeout(avanzarFlujo, 60);
    return 'ok';
  },
  campeon(e, gid) {
    if (!G.flujo || G.flujo.p !== 'campeones' || !HOST.camp) return 'ok';
    if (!P.vivos(e).some((g) => g.id === gid && !g.jefe)) return 'ok';   // los monstruos de mazmorra no van
    HOST.camp.eleccion[e.id] = gid;
    return ACC.listo(e);
  },
  pujar(e, monto) {
    const SB = HOST.sub; if (!SB || SB.estado !== 'puja') return 'ok';
    if (!R.ECONOMIA.pujas.includes(monto)) return 'ok';   // solo de a 1 o de a 5
    if (e.esJugador && SB.pasaron.has(e.id)) return 'ok';   // el que pasó ya no oferta en este carro
    if (!P.pujar(G, SB.carro, e, monto)) return 'No te alcanza la bolsa.';
    SB.reloj = Math.max(SB.reloj, R.SUBASTA.relojTrasPuja); enviarSub(); return 'ok';
  },
  paso(e) {
    const SB = HOST.sub; if (!SB || SB.estado !== 'puja') return 'ok';
    SB.pasaron.add(e.id);
    const pendientes = humanos().filter((x) => x.id !== SB.carro.lider && !SB.pasaron.has(x.id));
    if (!pendientes.length) { SB.rapido = true; enviarSub(); }   // ya no queda ningún humano pujando: este carro va 5 veces más rápido
    return 'ok';
  },
  inspLote(e) {
    const SB = HOST.sub; if (!SB || !SB.carro || e.inspecciones <= 0 || SB.carro.inspeccionadoPor.includes(e.id)) return 'ok';
    e.inspecciones--; SB.carro.inspeccionadoPor.push(e.id); enviarSub(); return 'ok';
  },
  evento(e, i) {
    if (!HOST.evs || HOST.evRes[e.id] !== undefined) return 'ok';
    const ev = HOST.evs[e.id];
    const res = P.resolverEvento(G, e, ev, ev.opciones ? i === 0 : true);
    HOST.evRes[e.id] = res; G.log.push(`${e.nombre} recibió un mensaje secreto.`);
    priv(e.id, { k: 'eventoRes', txt: res });
    return 'ok';
  },
  comprar(e, gid, tipo, id) { const g = gl(e, gid); return g ? P.comprarItem(G, e, g, tipo, id) : 'ok'; },
  entrenar(e, gid, k) { const g = gl(e, gid); return g ? P.entrenar(G, e, g, k) : 'ok'; },
  curar(e, gid) { const g = gl(e, gid); return g ? P.curar(G, e, g) : 'ok'; },
  inspeccionar(e, gid) { const g = gl(e, gid); return g ? P.inspeccionar(G, e, g) : 'ok'; },
  mejorarChaman(e) { return P.mejorarChaman(G, e); },
  curarLastimados(e) { return P.curarLastimados(G, e); },
  internar(e, gid) { const g = gl(e, gid); return g ? internar(e, g) : 'ok'; },
  sacarCama(e, gid) { const g = gl(e, gid); return g ? sacarCama(e, g) : 'ok'; },
  fusionar(e, ga, gb) { const a = gl(e, ga), b = gl(e, gb); if (!a || !b) return 'ok'; const r = P.fusionar(G, e, a, b); if (typeof r === 'string') return r; priv(e.id, { k: 'fusion', r }); return 'ok'; },
  ojear(e) {   // el ojito: ve todo el carro. 5 oro, y cada vez 5 más en esta subasta
    const SB = HOST.sub; if (!SB || !SB.carro || SB.estado !== 'puja' || SB.carro.inspeccionadoPor.includes(e.id)) return 'ok';
    SB.ojos = SB.ojos || {}; const n = SB.ojos[e.id] || 0, precio = R.TIENDA.ojo.base + R.TIENDA.ojo.suba * n;
    if (e.bolsa.oro - (SB.carro.pujas[e.id] || 0) < precio) return 'No te alcanza.';
    e.bolsa.oro -= precio; SB.ojos[e.id] = n + 1; P.est(e).ojos++; SB.carro.inspeccionadoPor.push(e.id); enviarSub(); return 'ok';
  },
  orden(e, gid, orden, prot) { const g = gl(e, gid); if (g) { g.orden = orden; if (prot !== undefined && prot !== null) g.protegeVs = prot; } return 'ok'; },
  convocar(e, gid, quiere) {
    const g = gl(e, gid); if (!g) return 'ok';
    if (quiere && g.inmortal && (g.vida ?? 100) <= 0) return 'Está tirado: curalo sacrificando esclavos.';
    if (quiere && g.internado) return 'Está en la sala del curandero.';
    const conv = P.convocados(e), esta = conv.includes(g);
    for (const x of P.vivos(e)) x.convocado = conv.includes(x);
    if (!quiere && esta) { if (conv.length <= 1) return 'Tiene que pelear al menos uno.'; g.convocado = false; }
    else if (quiere && !esta) { if (conv.length >= R.PELEA.maxPorEquipo) return `Ya tenés ${R.PELEA.maxPorEquipo} convocados. Sacá a alguno primero.`; g.convocado = true; }
    return 'ok';
  },
  plan(e, v) { e.plan = v; return 'ok'; },
  formacion(e, v) { e.formacion = v; return 'ok'; },
  curarTodo(e) { return P.curarTodo(G, e); },
  vender(e, gid) { const g = gl(e, gid); return g ? P.vender(G, e, g) : 'ok'; },
};

function avanzarFlujo() {
  const p = G.flujo.p;
  if (p === 'tablero') return entrar(P.fase(G));
  if (p === 'empate') return entrarPeleaFinal();
  if (p === 'campeones') return entrarCampeones();
  if (p === 'final') return;
  volver();
}
function volver() {
  if (G.historia) return hVolver();
  if (G.casillero >= R.CASILLEROS) {
    G.terminada = true;
    const emp = P.empatados(G);
    return emp.length > 1 ? ir('empate', { ids: emp.map((e) => e.id) }) : ir('final', { ganador: P.ranking(G)[0].id });
  }
  P.avanzar(G); ir('tablero', { mover: true });
}
function entrar(fase) {
  if (fase === 'subasta') {
    const sub = P.crearSubasta(G);
    HOST.sub = { carros: sub.carros, idx: -1, estado: 'llega', reloj: 0, t: 0, react: [], carro: null, pasaron: new Set(), ganador: null };
    ir('subasta', { carros: JSON.parse(JSON.stringify(sub.carros.map((c) => c.lote))) });
    subasta_iniciarHost();
  } else if (fase === 'evento') {
    HOST.evs = P.sortearEventos(G); HOST.evRes = {};
    for (const e of G.emperadores) if (!e.esJugador) { const ev = HOST.evs[e.id]; HOST.evRes[e.id] = P.resolverEvento(G, e, ev, P.botAceptaEvento(G, e, ev)); }
    PRIV = {};
    ir('evento', {});
    for (const e of humanos()) priv(e.id, { k: 'evento', ev: JSON.parse(JSON.stringify(HOST.evs[e.id])) });
  } else if (fase === 'preparacion') {
    for (const e of G.emperadores) if (!e.esJugador) P.botPreparacion(G, e);
    ir('preparacion', {});
  } else if (fase === 'pelea') {
    entrarPelea(null);
  } else if (fase === 'campeones') {
    HOST.camp = { eleccion: {} };
    const con = G.emperadores.filter((e) => P.vivos(e).length);
    if (con.length < 2) { G.log.push('No hubo pelea de campeones: faltan campeones.'); return volver(); }
    for (const e of G.emperadores) { const m = P.mejorDe(e); if (m) HOST.camp.eleccion[e.id] = m.id; }
    ir('campeones', {});
    // los que no tienen gladiadores (o los bots) ya están listos
    for (const e of G.emperadores) if (!e.esJugador || !P.vivos(e).length) ACC.listo(e);
  } else if (fase === 'recuperacion') {
    for (const e of G.emperadores) if (!e.esJugador && P.botRecuperacion(G, e)) G.log.push(`${e.nombre} pagó para curar a toda su escudería.`);
    const lineas = P.recuperar(G);
    ir('recuperacion', { lineas: lineas.map((l) => ({ emp: l.e.id, txt: l.txt })) });
  }
}
let escenarioSig = null;   // qué arena le toca a la próxima pelea (coliseo de historia, de entretenimiento, mazmorra, la del Diablo)
function entrarPelea(soloIds, tituloH) {
  const { cfg, regalos } = P.armarPelea(G, soloIds);
  cfg.escenario = escenarioSig; escenarioSig = null;
  for (const r of regalos) G.log.push(`${r.emp.nombre} no tenía gladiadores: le prestan a ${r.g.nombre}.`);
  // proteger: el índice elegido en preparación se traduce al orden de convocados
  for (const eq of cfg.equipos) eq.glads.forEach((gc) => { if (gc.orden === 'proteger' && gc.g.protegeVs !== undefined) { const e = G.emperadores[eq.empId]; const pv = gc.g.protegeVs, target = typeof pv === 'string' ? P.vivos(e).find((x) => x.id === pv) : P.vivos(e)[pv]; const idx = eq.glads.findIndex((x) => x.g === target); gc.protege = idx >= 0 ? idx : 0; } });
  HOST.cfg = cfg; HOST.final = !!soloIds;
  ir('pelea', { cfg: JSON.parse(JSON.stringify(cfg)), titulo: tituloH || (soloIds ? 'Pelea final por el reino' : `Pelea del ciclo ${P.ciclo(G)}`) });
}
const entrarPeleaFinal = () => entrarPelea(vista.d.ids);
function entrarCampeones() {
  const cfg = P.armarCampeones(G, HOST.camp ? HOST.camp.eleccion : {});
  if (cfg.equipos.length < 2) { G.log.push('No hubo pelea de campeones.'); return volver(); }
  // el resto de cada escuadra mira desde las gradas
  const elegidos = new Set(cfg.equipos.map((q) => q.glads[0].g.id));
  cfg.publico = G.emperadores.map((e) => ({ color: e.color, glads: P.vivos(e).filter((g) => !elegidos.has(g.id)).slice(0, 8).map((g) => ({ ...specDe(g, e.color), altura: g.altura })) }));
  HOST.cfg = cfg; HOST.final = false;
  for (const q of cfg.equipos) G.log.push(`${q.nombre} manda a ${q.glads[0].g.nombre} a la torre.`);
  ir('pelea', { cfg: JSON.parse(JSON.stringify(cfg)), titulo: '👑 Pelea de campeones' });
}
function finDePelea(s) {   // (anfitrión)
  if (G.historia) return hFinPelea(s);
  const cfg = HOST.cfg;
  const res = P.aplicarPelea(G, s, cfg, HOST.final);
  const w = G.emperadores[cfg.equipos[s.fin.ganador].empId];
  if (HOST.final) { const E = P.est(w); E.ganoPartida = 1; E.jugadores = G.emperadores.length; return ir('final', { ganador: w.id }); }
  if (cfg.modo === 'campeones') {
    G.log.push(`Pelea de campeones: ganó ${w.nombre}.`);
    return ir('post', { fin: s.fin, logros: [], emps: cfg.equipos.map((q) => q.empId), modo: 'campeones', campeon: cfg.equipos[s.fin.ganador].glads[0].g.nombre });
  }
  G.log.push(`Pelea ${P.ciclo(G)}: ganó ${w.nombre}.`);
  for (const r of res) { const ti = cfg.equipos.findIndex((x) => x.empId === r.e.id); const muertos = s.fighters.filter((f) => f.team === ti && f.estado === 'muerto').length; if (muertos) G.log.push(`${r.e.nombre} perdió ${muertos} gladiador(es).`); }
  ir('post', { fin: s.fin, logros: s.logros, emps: cfg.equipos.map((q) => q.empId) });
}

/* =====================================================================
   PANTALLAS (las ven todos; nada de lógica de juego acá)
   ===================================================================== */
const PANT = {};

/* ---------- MENÚ ---------- */
function menu() {
  if (window.Musica) Musica.poner('menu');
  document.querySelectorAll('.naldo, .nvelo, .charla, .logros-ov, body > .cine-saltar').forEach((x) => x.remove());   // que no quede nada de la partida encima del menú
  Red.cerrar(); G = null; vista = null;
  const box = pantalla('prision', `
    <div class="lay menuC"><div style="text-align:center"><div class="big">KINGDOM'S PRICE</div>
      <div class="pix menuSub">Subastas, escuderías y sangre por el derecho a gobernar el reino</div></div>
    <div class="menuB">
      <button class="mbtn piedra" id="bHist">MODO HISTORIA</button>
      <button class="mbtn piedra" id="bAmigos">JUGAR CON AMIGOS</button>
      <button class="mbtn piedra" id="bSalir">SALIR DEL JUEGO</button>
    </div></div>
    <button class="lay btrofeo" id="bLog" aria-label="Logros y estadísticas" title="Logros y estadísticas">🏆</button>
    <button class="lay bajustes piedra" id="bAj">⚙ AJUSTES</button>
    ${enApp() ? '' : `<a class="lay bapk" href="KingdomsPrice.apk" download="KingdomsPrice.apk"><img src="icono.png" alt=""><span>DESCARGAR APK<small>Para celulares Android</small></span></a>`}`);
  $('#bAj', box).onclick = () => ajustes();
  $('#bLog', box).onclick = () => window.Logros && Logros.panel();
  if ($('.bapk', box)) $('.bapk', box).onclick = (e) => { e.preventDefault(); descargarApk($('.bapk small', box)); };
  $('#bSalir', box).onclick = salirJuego;
  $('#bAmigos', box).onclick = salaOnline;
  $('#bHist', box).onclick = historiaMenu;
  // al apoyar el dedo el botón se hunde (y vuelve al soltar)
  box.querySelectorAll('.mbtn.piedra, .bajustes.piedra, .btrofeo').forEach((b) => {
    b.addEventListener('pointerdown', () => b.classList.add('hundido'));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => b.classList.remove('hundido'));
  });
  if (window.I18N) box.appendChild(I18N.bandera());   // banderita: cambia el idioma
  if (window.Actualizar) { Actualizar.arranqueOk(); if (Actualizar.esApp()) box.appendChild(Actualizar.boton()); }   // en la app: botón ACTUALIZAR si hay versión nueva
}

// baja el APK: si el sitio tiene el .apk (itch, web propia) lo usa; si no (donde solo se pueden subir textos),
// lo arma desde apk_datos.js, que es el mismo APK escrito en texto (base64)
async function descargarApk(nota) {
  const txt0 = nota.textContent; nota.textContent = 'Descargando…';
  try {
    let blob = null;
    try { const r = await fetch('KingdomsPrice.apk'); if (r.ok) { const b = await r.blob(); if (b.size > 1e6) blob = b; } } catch (e) {}
    if (!blob) {
      // apk_datos.js dice en cuántos pedazos viene (cada pedazo es el APK escrito en texto)
      const r = await fetch('apk_datos.js'); if (!r.ok) throw new Error('sin apk');
      const n = parseInt((await r.text()).trim(), 10) || 1, partes = [];
      for (let k = 0; k < n; k++) {
        nota.textContent = `Descargando… ${Math.round((100 * k) / n)}%`;
        const rp = await fetch(`apk_datos_${k}.js`); if (!rp.ok) throw new Error('falta un pedazo');
        const bin = atob((await rp.text()).trim()), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        partes.push(u8);
      }
      blob = new Blob(partes);
    }
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.android.package-archive' }));
    const a = document.createElement('a'); a.href = url; a.download = 'KingdomsPrice.apk'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    nota.textContent = '¡Listo! Abrilo para instalar';
  } catch (e) { nota.textContent = 'No se pudo descargar'; }
  setTimeout(() => { nota.textContent = txt0; }, 5000);
}
const enApp = () => { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); };
// salir: en la app de Android cierra la app; en el navegador no se puede cerrar la pestaña desde el juego
function salirJuego() {
  const Cap = window.Capacitor, App = Cap && Cap.Plugins && Cap.Plugins.App;
  if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && App) return App.exitApp();
  try { window.close(); } catch (e) {}
  setTimeout(() => { const m = modal(`<div style="font:700 18px var(--fB);color:var(--gold);margin-bottom:8px">Salir del juego</div><div class="meta" style="margin-bottom:12px">En el navegador, cerrá la pestaña.</div><button class="prim" id="ok">Listo</button>`); $('#ok', m).onclick = () => m.remove(); }, 150);
}

/* ---------- AJUSTES: 3D o 2D, nivel de gráficos, luces y partículas ---------- */
// conMenu: desde el mapa de la historia, botón para volver al menú principal (la partida queda guardada)
function ajustes(conMenu) {
  conMenu = conMenu === true;
  const A = window.Ajustes, m = modal(`<div style="font:700 20px var(--fT);color:var(--gold);margin-bottom:8px">⚙ Ajustes</div>
    <div class="ajg"><div class="ajf"><span>Gladiadores</span><div class="ajo" data-k="g"><button data-v="3d">🧊 3D</button><button data-v="2d">🖼 2D</button></div></div>
    <div class="ajf"><span>Gráficos</span><div class="ajo" data-k="nivel"><button data-v="alto">Altos</button><button data-v="medio">Medios</button><button data-v="bajo">Bajos</button></div></div>
    <div class="ajf"><span>Luces y partículas</span><div class="ajo" data-k="fx"><button data-v="1">Con</button><button data-v="0">Sin</button></div></div>
    <div class="ajf"><span>🎵 Música</span><div class="ajo" data-k="mus"><button data-v="1">Con</button><button data-v="0">Sin</button></div></div>
    <div class="ajf"><span>Volumen música</span><input type="range" id="ajvol" min="0" max="100" step="5" style="flex:1;max-width:190px;accent-color:#e0b44c"></div>
    <div class="ajf"><span>🔊 Efectos</span><div class="ajo" data-k="sfx"><button data-v="1">Con</button><button data-v="0">Sin</button></div></div></div>
    <div class="meta" id="ajn" style="margin:8px 0 10px;min-height:2.6em"></div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${conMenu ? '<button id="ajm">☰ Menú principal</button>' : ''}<button class="prim" id="ajx">Listo</button></div>`);
  if (conMenu) $('#ajm', m).onclick = () => { m.remove(); hGuardar(); menu(); };
  const NOTA = { alto: 'Altos: cuerpos 3D con todo el detalle, público en las gradas y desenfoque de fondo al hacer zoom.', medio: 'Medios: cuerpos 3D con menos cubitos y sin desenfoque. Para celulares de gama media.', bajo: 'Bajos: cuerpos 3D más simples. Para que ande fluido en cualquier celular.' };
  const val = { g: () => (window.Voxel && Voxel.modo3D() ? '3d' : '2d'), nivel: () => A.nivel(), fx: () => (A.fx() ? '1' : '0'),
    mus: () => (window.Musica && Musica.apagada ? '0' : '1'), sfx: () => (window.Sonido && Sonido.mudo ? '0' : '1') };
  const vol = $('#ajvol', m); if (window.Musica) { vol.value = Math.round(Musica.volumen * 100); vol.oninput = () => Musica.setVolumen(vol.value / 100); }
  const pint = () => { m.querySelectorAll('.ajo').forEach((o) => o.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val[o.dataset.k]()))); $('#ajn', m).textContent = NOTA[A.nivel()] + (val.g() === '2d' ? ' En 2D el nivel casi no cambia nada.' : ''); };
  m.querySelectorAll('.ajo button').forEach((b) => { b.onclick = () => { const k = b.parentNode.dataset.k, v = b.dataset.v; if (k === 'g') { if (window.Voxel) Voxel.modo3D(v === '3d'); } else if (k === 'nivel') A.nivel(v); else if (k === 'mus') { if (window.Musica) Musica.apagar(v === '0'); } else if (k === 'sfx') { if (window.Sonido) Sonido.silenciar(v === '0'); } else A.fx(v === '1'); pint(); }; });
  $('#ajx', m).onclick = () => m.remove(); pint();
}

/* ---------- SALÓN (solo): cuántos emperadores ---------- */
function salonSolo() {
  let n = 4;
  const box = pantalla('salon', `
    <div class="lay pix" style="left:0;right:0;top:3%;text-align:center;font:700 clamp(16px,2.6vw,34px) var(--fT);color:#f6e2b0;text-shadow:0 2px 0 #000">El Salón de los Emperadores</div>
    <div class="lay panel" style="left:50%;top:13%;transform:translateX(-50%);padding:10px 16px;display:flex;gap:12px;align-items:center">
      <button id="atras">◂</button><span>Emperadores</span><button id="menos">−</button><b id="num" style="font-size:20px;min-width:1.2em;text-align:center">4</b><button id="mas">+</button>
      <button class="prim" id="jugar" style="margin-left:8px">JUGAR ▸</button>
    </div>`);
  const nombres = ['Vos', ...P.NOMBRES_BOT];
  const labels = etiquetasSalon(box, () => nombres);
  const upd = () => { box.h.S.setN(n, R.EQUIPOS.map((e) => e.color)); labels(n); $('#num', box).textContent = n; };
  $('#menos', box).onclick = () => { if (n > R.JUGADORES.min) { n--; upd(); } };
  $('#mas', box).onclick = () => { if (n < R.JUGADORES.max) { n++; upd(); } };
  $('#atras', box).onclick = menu;
  $('#jugar', box).onclick = () => { Red.modo = 'solo'; YO = 0; G = P.nueva(n); ir('tablero', {}); };
  upd();
}
function etiquetasSalon(box, nombres) {
  const S3 = box.h.S;
  const els = R.EQUIPOS.map((q, i) => { const el = h(`<div class="lay pix nlab" style="color:${q.color}"></div>`); box.appendChild(el); anclar(box, el, () => (S3.emps[i] ? S3.emps[i].position.clone().add(V3(0, -0.12, 0)) : V3(0, -50, 0))); return el; });
  return (n) => { const ns = nombres(); els.forEach((el, i) => { el.style.display = i < n ? '' : 'none'; el.textContent = ns[i] || ''; }); };
}

/* ---------- EDITOR DE EMPERADOR (multijugador): raza, tono de piel y pelo ---------- */
const LOOK_RAZAS = ['humano', 'orco', 'goblin', 'gigante'];
const PEINADO_L = { calvo: 'Calvo', rapado: 'Rapado', corto: 'Corto', largo: 'Largo', coleta: 'Coleta', rodete: 'Rodete', cresta: 'Cresta', crestaAlta: 'Cresta alta', crestaLarga: 'Cresta larga' };
const hex6 = (n) => '#' + n.toString(16).padStart(6, '0');
function tonar(hex, k) { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); }
function opcionesLook(raza) {
  const RS = (window.Voxel && Voxel.rasgosRaza && Voxel.rasgosRaza(raza)) || { pein: ['corto'], pelo: [0x2e1c10] };
  const tonos = raza === 'humano' ? M.PIELES_HUMANAS.map((p) => p[0]) : [0.72, 0.86, 1, 1.14, 1.28].map((k) => tonar(R.RAZAS[raza].piel, k));
  return { tonos, peinados: [...new Set(RS.pein)], pelos: [...new Set(RS.pelo)].map(hex6) };
}
function lookPorDefecto(raza = 'humano') { const o = opcionesLook(raza); return { raza, piel: o.tonos[Math.min(1, o.tonos.length - 1)], peinado: o.peinados.includes('corto') ? 'corto' : o.peinados[0], pelo: o.pelos[0] }; }
function lookValido(l) {
  if (!l || !LOOK_RAZAS.includes(l.raza)) return null;
  const o = opcionesLook(l.raza), d = lookPorDefecto(l.raza), okH = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  return { raza: l.raza, piel: okH(l.piel) ? l.piel : d.piel, peinado: o.peinados.includes(l.peinado) ? l.peinado : d.peinado, pelo: okH(l.pelo) ? l.pelo : d.pelo };
}
function miLook() { try { return lookValido(JSON.parse(localStorageGet('coliseo-look'))) || lookPorDefecto(); } catch (e) { return lookPorDefecto(); } }
function editorLook(cont, alCambiar) {
  let L = miLook();
  const pintar = () => {
    const o = opcionesLook(L.raza);
    const chips = (k, lista, lab) => lista.map((v) => `<button class="lk-chip ${L[k] === v ? 'on' : ''}" data-k="${k}" data-v="${v}">${lab(v)}</button>`).join('');
    const sw = (k, lista) => lista.map((v) => `<button class="lk-sw ${L[k] === v ? 'on' : ''}" data-k="${k}" data-v="${v}" style="background:${v}" aria-label="${v}"></button>`).join('');
    cont.innerHTML = `<div class="lk-t">Tu emperador</div>
      <div class="lk-f"><span>Raza</span><div>${chips('raza', LOOK_RAZAS, (v) => R.RAZAS[v].label)}</div></div>
      <div class="lk-f"><span>Tono</span><div>${sw('piel', o.tonos)}</div></div>
      <div class="lk-f"><span>Pelo</span><div>${chips('peinado', o.peinados, (v) => PEINADO_L[v] || v)}</div></div>
      <div class="lk-f"><span>Color</span><div>${sw('pelo', o.pelos)}</div></div>`;
    cont.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === 'raza') L = lookPorDefecto(v); else L = { ...L, [k]: v };
      localStorageSet('coliseo-look', JSON.stringify(L)); pintar(); alCambiar(L);
    }));
  };
  pintar(); alCambiar(L);
}

/* ---------- SALA ONLINE (lobby en el salón) ---------- */
function salaOnline() {
  const box = pantalla('salon', `
    <div class="lay pix" style="left:0;right:0;top:3%;text-align:center;font:700 clamp(16px,2.6vw,34px) var(--fT);color:#f6e2b0;text-shadow:0 2px 0 #000">Jugar con amigos</div>
    <div class="lay panel sala" id="sala" style="left:2%;top:13%;padding:12px 16px;width:min(460px,56%);max-height:84%;overflow:auto"></div>`);
  const sala = $('#sala', box);
  box.h.S.setN(0, []); box.h.S.offX = 2.4;
  let nombre = (localStorageGet('coliseo-nombre') || '').slice(0, 14);
  sala.innerHTML = `<div class="ctrls"><label>Tu nombre <input id="nom" maxlength="14" value="${nombre}" placeholder="Emperador"></label></div>
    <div class="ctrls"><button class="prim" id="crear">Crear sala</button><span class="meta">o</span><input id="cod" maxlength="6" placeholder="CÓDIGO" style="width:7em;text-transform:uppercase"><button id="unir">Unirse</button><button id="atras">◂ Menú</button></div>
    ${localStorageGet('coliseo-sala') ? `<div class="ctrls"><button class="prim" id="volver">↩ Volver a la sala ${localStorageGet('coliseo-sala')}</button></div>` : ''}
    <div class="meta">Uno crea la sala y le pasa el código a los demás. ${Red.local ? '<b style="color:#e9a76b">(modo prueba local)</b>' : 'Se conecta por internet con PeerJS.'}</div><div class="meta" id="err" style="color:#ff8a7a"></div>
    <div class="lk" id="lk"></div>`;
  editorLook($('#lk', sala), (L) => box.h.S.setN(1, [R.EQUIPOS[0].color], undefined, [L]));
  const nom = () => { const v = ($('#nom', sala).value || '').trim() || 'Emperador'; localStorageSet('coliseo-nombre', v); return v.slice(0, 14); };
  $('#atras', sala).onclick = menu;
  $('#crear', sala).onclick = () => { $('#err', sala).textContent = 'Creando sala…'; Red.crearSala().then(() => { box.h.S.offX = 0; lobbyHost(box, nom()); }).catch((e) => { $('#err', sala).textContent = e.message || String(e); Red.modo = 'solo'; }); };
  const unirse = (cod) => {
    if (cod.length < 4) { $('#err', sala).textContent = 'Poné el código de la sala.'; return; }
    $('#err', sala).textContent = 'Conectando…';
    escucharComoCliente();
    Red.unirse(cod, nom()).then(() => { localStorageSet('coliseo-sala', cod); Red.enviar({ t: 'look', look: miLook() }); box.h.S.offX = 0; lobbyCliente(box, cod); }).catch((e) => { $('#err', sala).textContent = e.message || String(e); Red.cerrar(); });
  };
  $('#unir', sala).onclick = () => unirse(($('#cod', sala).value || '').trim().toUpperCase());
  if ($('#volver', sala)) $('#volver', sala).onclick = () => unirse(localStorageGet('coliseo-sala'));
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function lobbyHost(box, miNombre) {
  const sala = $('#sala', box);
  let bots = 2;
  const jugadores = () => [{ nombre: miNombre, humano: true, look: miLook() }, ...Red.conexiones.filter((c) => c.vivo && c.enLobby).map((c) => ({ nombre: c.nombre, humano: true, c, look: c.look || null })), ...Array.from({ length: bots }, (_, i) => ({ nombre: P.NOMBRES_BOT[i], humano: false }))];
  const labels = etiquetasSalon(box, () => jugadores().map((j) => j.nombre + (j.humano ? '' : ' 🤖')));
  const pintar = () => {
    const js = jugadores(); const n = js.length;
    if (n > R.JUGADORES.max) { bots = Math.max(0, bots - (n - R.JUGADORES.max)); return pintar(); }
    box.h.S.setN(Math.min(n, 6), R.EQUIPOS.map((e) => e.color), undefined, js.map((j) => j.look || null)); labels(Math.min(n, 6));
    sala.innerHTML = `<div class="codigo">Código de la sala: <b>${Red.codigo}</b></div>
      <div class="meta">Pasale este código a tus amigos. Pueden ser hasta ${R.JUGADORES.max} emperadores (mínimo ${R.JUGADORES.min}, completás con bots).</div>
      <div class="ctrls" style="margin-top:8px"><span>Bots</span><button id="bm">−</button><b>${bots}</b><button id="bp">+</button><span class="meta">${js.filter((j) => j.humano).length} humano(s) · ${n} en total</span></div>
      <div class="ctrls"><button class="prim" id="go" ${n < R.JUGADORES.min ? 'disabled' : ''}>JUGAR ▸</button><button id="atras">◂ Cerrar sala</button></div>`;
    Red.difundir({ t: 'lobby', jugadores: js.map((j) => ({ nombre: j.nombre, humano: j.humano, look: j.look || null })), codigo: Red.codigo });
    $('#bm', sala).onclick = () => { if (bots > 0) { bots--; pintar(); } };
    $('#bp', sala).onclick = () => { if (n < R.JUGADORES.max) { bots++; pintar(); } };
    $('#atras', sala).onclick = menu;
    $('#go', sala).onclick = () => empezarOnline(jugadores());
  };
  Red.off('llega'); Red.off('se-va'); Red.off('msg');
  Red.on('llega', (c) => {
    // un jugador que se cortó vuelve con su ficha: recupera su emperador (que mientras tanto manejaba un bot)
    // lo reconozco por su ficha, o si entra desde otro lado, por el nombre de un emperador humano que quedó sin conexión
    const norm = (t) => (t || '').trim().toLowerCase();
    const e = G && ((c.tok && G.emperadores.find((x) => x.tok === c.tok))
      || G.emperadores.find((x) => x.humano0 && norm(x.nombre) === norm(c.nombre)));
    if (e) {
      e.tok = c.tok || e.tok;
      for (const o of Red.conexiones) if (o !== c && o.empId === e.id && o.vivo) o.vivo = false;
      c.empId = e.id; e.esJugador = true; G.log.push(`${e.nombre} volvió a la partida.`);
      Red.enviarA(c, { t: 'bienvenida', yo: e.id }); Red.enviarA(c, { t: 'estado', G: P.serializar(G) });
      if (HOST.ultimoIr) Red.enviarA(c, HOST.ultimoIr);
      if (G.flujo && G.flujo.p === 'subasta' && HOST.sub && HOST.sub.carro) enviarSub();
      // si vuelve en el callejón, le reenvío su mensaje secreto (y el resultado, si ya se resolvió)
      if (G.flujo && G.flujo.p === 'evento' && HOST.evs && HOST.evs[e.id]) {
        setTimeout(() => { priv(e.id, { k: 'evento', ev: JSON.parse(JSON.stringify(HOST.evs[e.id])) }); if (HOST.evRes[e.id] !== undefined) priv(e.id, { k: 'eventoRes', txt: HOST.evRes[e.id] }); }, 300);
      }
      difundirEstado(); refrescar(); return;
    }
    if (G || jugadores().filter((j) => j.humano).length >= R.JUGADORES.max) { Red.enviarA(c, { t: 'lleno', enCurso: !!G }); return; } c.enLobby = true; if (jugadores().length > R.JUGADORES.max && bots > 0) bots--; pintar(); });
  Red.on('se-va', (c) => { if (!G) return pintar(); seFue(c); });
  Red.on('msg', (c, msg) => {
    if (msg.t === 'look') { c.look = lookValido(msg.look); if (!G) pintar(); else { const e = G.emperadores[c.empId]; if (e && c.look) { e.look = c.look; difundirEstado(); } } }
    else if (msg.t === 'act' && G && c.empId !== undefined) ejecutar(c.empId, msg.a, msg.args || []);
    else if (msg.t === 'reenviar' && G && HOST.ultimoIr) {   // un cliente quedó desfasado: le mando de nuevo la partida y la pantalla actual
      Red.enviarA(c, { t: 'estado', G: P.serializar(G) }); Red.enviarA(c, HOST.ultimoIr);
      if (G.flujo.p === 'subasta' && HOST.sub && HOST.sub.carro) enviarSub();
    }
  });
  pintar();
}
function empezarOnline(js) {
  YO = 0;
  G = P.nueva(js.length, null, js.map((j) => ({ nombre: j.nombre, humano: j.humano })));
  js.forEach((j, i) => { if (j.look) G.emperadores[i].look = j.look; if (j.c) { j.c.empId = i; G.emperadores[i].tok = j.c.tok || null; G.emperadores[i].humano0 = true; Red.enviarA(j.c, { t: 'bienvenida', yo: i }); } });
  ir('tablero', {});
}
function seFue(c) {   // (anfitrión) un jugador se desconectó: su emperador pasa a ser bot
  const e = G.emperadores[c.empId]; if (!e || !e.esJugador) return;
  e.esJugador = false; G.log.push(`${e.nombre} se desconectó: lo maneja un bot.`);
  if (HOST.evs && HOST.evRes && HOST.evRes[e.id] === undefined) HOST.evRes[e.id] = P.resolverEvento(G, e, HOST.evs[e.id], P.botAceptaEvento(G, e, HOST.evs[e.id]));
  difundirEstado(); refrescar();
  if (G.flujo && !faltan().length) setTimeout(avanzarFlujo, 60);
}

function lobbyCliente(box, cod) {
  const sala = $('#sala', box);
  let lista = [];
  const labels = etiquetasSalon(box, () => lista.map((j) => j.nombre + (j.humano ? '' : ' 🤖')));
  const pintar = () => {
    box.h.S.setN(Math.min(6, lista.length), R.EQUIPOS.map((e) => e.color), undefined, lista.map((j) => lookValido(j.look))); labels(Math.min(6, lista.length));
    sala.innerHTML = `<div class="codigo">Sala <b>${cod}</b></div><div class="meta">Conectado. Esperando a que el anfitrión arranque la partida…</div><div class="ctrls" style="margin-top:8px"><button id="atras">◂ Salir</button></div>`;
    $('#atras', sala).onclick = menu;
  };
  HOST_LOBBY = (msg) => { lista = msg.jugadores; pintar(); };
  pintar();
}
let HOST_LOBBY = null;
// (cliente) si me quedé en otra pantalla que la del anfitrión, pido que me la reenvíe
let ultimoPedido = 0, desfaseT = null;
function pedirReenvio() { const now = Date.now(); if (now - ultimoPedido < 2500) return; ultimoPedido = now; Red.enviar({ t: 'reenviar' }); }
function vigilarDesfase() {
  clearTimeout(desfaseT);
  desfaseT = setTimeout(() => { if (Red.modo === 'cliente' && G && G.flujo && (!vista || vista.p !== G.flujo.p)) pedirReenvio(); }, 1500);
}
function escucharComoCliente() {
  Red.off('msg'); Red.off('cortado'); Red.off('reconectando');
  Red.on('reconectando', (on) => {
    let t = document.getElementById('reco');
    if (on && !t) { t = h(`<div id="reco">Se cortó la conexión · reconectando…</div>`); document.body.appendChild(t); }
    if (!on && t) { t.remove(); pedirReenvio(); }
  });
  Red.on('cortado', () => { const t = document.getElementById('reco'); if (t) t.remove(); if (Red.modo !== 'cliente') return; menu(); alertar('Se cortó la conexión con el anfitrión.'); });
  Red.on('msg', (c, msg) => {
    if (msg.t === 'lobby') HOST_LOBBY && HOST_LOBBY(msg);
    else if (msg.t === 'lleno') { menu(); alertar(msg.enCurso ? 'La partida ya empezó. Para volver a tu lugar, entrá con <b>el mismo nombre</b> que tenías.' : 'La sala está llena.'); }
    else if (msg.t === 'bienvenida') YO = msg.yo;
    else if (msg.t === 'estado') { G = msg.G; refrescar(); vigilarDesfase(); }
    else if (msg.t === 'ir') { if (G) mostrar(msg.p, msg.d); else setTimeout(() => G && mostrar(msg.p, msg.d), 200); }
    else if (msg.t === 'sub') aplicarSubRemoto(msg);
    else if (msg.t === 'snap') { if (!vista || vista.p !== 'pelea') pedirReenvio(); else window.Arena.recibir(msg); }
    else if (msg.t === 'priv') manejarPriv(msg);
  });
}

/* ---------- TABLERO ---------- */
PANT.tablero = (d) => {
  const box = pantalla('tablero', `<div class="boardui greek"><div class="center"><div class="panel" id="pp"></div><div class="panel" id="cr"></div></div></div>`, { fases: R.TABLERO, colores: G.emperadores.map((e) => e.color), looks: G.emperadores.map((e) => e.look || null) });
  const S3 = box.h.S;
  if (d.mover && G.casillero > 1) { S3.setCasillero(G.casillero - 1, false); setTimeout(() => S3.setCasillero(G.casillero, true), 300); }
  else S3.setCasillero(G.casillero, false);
  const pintar = () => {
    const pp = $('#pp', box);
    pp.innerHTML = `<h2>Ciclo ${P.ciclo(G)} de 6 · Casillero ${G.casillero}</h2>
      <div class="meta" style="margin-bottom:8px">Próxima fase: <b class="nx">${ICON[P.fase(G)]} ${R.FASE_LABEL[P.fase(G)]}</b>${online() ? ` · sala <b class="nx">${Red.codigo}</b>` : ''}</div>
      <table><tr><th>Emperador</th><th>Bolsa</th><th>Puntos</th><th>Gladiadores</th></tr>
      ${P.ranking(G).map((e) => `<tr><td><span class="nmT" style="color:${e.color}">${nombreDe(e)}</span>${online() && !e.esJugador ? ' 🤖' : ''}${online() && G.flujo.listos.includes(e.id) ? ' ✔' : ''}</td><td>${bolsaHTML(e)}</td><td><b>${e.puntos}</b></td><td>${P.vivos(e).length}</td></tr>`).join('')}</table>
      <div class="ctrls" style="margin-top:12px" id="bt"></div><div id="esp"></div>`;
    $('#bt', pp).appendChild(botonListo(`Entrar: ${ICON[P.fase(G)]} ${R.FASE_LABEL[P.fase(G)]} ▸`));
    const be = h(`<button>Mi escudería (${P.vivos(yo()).length})</button>`); be.onclick = verEscuderia; $('#bt', pp).appendChild(be);
    $('#esp', pp).innerHTML = esperaHTML();
    $('#cr', box).innerHTML = `<h2>Crónica</h2><div class="meta" style="font-size:12px">${G.log.slice(-14).reverse().map((l) => `<div style="padding:2px 0;border-bottom:1px dashed #3a2e24">${l}</div>`).join('') || 'Todavía no pasó nada.'}</div>`;
  };
  vista.refrescar = pintar; pintar();
};
function verEscuderia() {
  const m = modal(`<h2 style="font:700 18px var(--fB);color:var(--gold);margin:0 0 6px">Tu escudería</h2><div class="meta" id="inf"></div>
    <div class="meta" id="cvn" style="margin-top:4px"></div><div class="cards" id="cs" style="margin:10px 0"></div><button id="x">Cerrar</button>`);
  const pintar = () => {
    $('#inf', m).textContent = `${bolsaTxt(yo())}${yo().ojeador ? ' · tenés ojeador' : ''}${yo().inspecciones ? ` · ${yo().inspecciones} inspección(es) para la subasta` : ''}`;
    const cs = $('#cs', m); cs.innerHTML = ''; const vs = P.vivos(yo()); const conv = P.convocados(yo());
    $('#cvn', m).innerHTML = `Convocados para la próxima pelea: <b style="color:var(--gold)">${conv.length}/${R.PELEA.maxPorEquipo}</b>`;
    if (!vs.length) cs.innerHTML = '<div class="meta">Todavía no tenés gladiadores. Si llegás a la pelea sin ninguno, te prestan uno <span class="tier D">D</span>.</div>';
    vs.forEach((g) => { const c = tarjetaCompleta(g); c.appendChild(botonConvocar(g)); c.appendChild(botonVender(g)); cs.appendChild(c); });
  };
  refrescos.add(pintar); pintar();
  $('#x', m).onclick = () => { refrescos.delete(pintar); m.remove(); };
}
let ventaRapida = false;   // vender sin confirmar (se pide en el cartel de venta)
function botonVender(g, despues) {
  const oro = P.precioVenta(g);
  const b = h(`<button class="vender" style="margin-top:6px;width:100%">Vender · ${oro} oro</button>`);
  b.onclick = () => {
    if (ventaRapida) { despues && despues(); return act('vender', g.id); }
    const m = modal(`<div style="font-size:15px">¿Vender a <b>${g.nombre}</b> por <b style="color:var(--gold)">${oro} oro</b>?</div><div class="meta">No se puede deshacer.</div><label class="meta" style="display:block;margin-top:6px"><input type="checkbox" id="rap"> No preguntar más (venta rápida)</label><div class="ctrls" style="margin-top:10px"><button class="prim" id="si">Vender</button><button id="no">Cancelar</button></div>`);
    $('#rap', m).onchange = (e) => { ventaRapida = e.target.checked; };
    $('#no', m).onclick = () => m.remove();
    $('#si', m).onclick = () => { m.remove(); despues && despues(); act('vender', g.id); };
  };
  return b;
}
function botonConvocar(g) {
  const esta = P.convocados(yo()).some((x) => x.id === g.id);
  const tirado = g.inmortal && (g.vida ?? 100) <= 0;
  const b = h(`<button class="${esta ? 'on' : ''}" style="margin-top:6px;width:100%" ${tirado && !esta ? 'disabled' : ''}>${tirado && !esta ? '💤 Tirado: curalo' : esta ? '✔ Convocado' : 'Convocar'}</button>`);
  b.onclick = () => act('convocar', g.id, !esta);
  return b;
}

/* ---------- SUBASTA ---------- */
// (anfitrión) reloj, bots y estados del carro
function subasta_iniciarHost() {
  const SB = HOST.sub;
  const sig = () => {
    SB.idx++;
    if (SB.idx >= SB.carros.length) { SB.estado = 'fin'; SB.carro = null; G.flujo.listos = []; enviarSub(); difundirEstado(); refrescar(); return; }
    SB.carro = SB.carros[SB.idx]; SB.estado = 'llega'; SB.t = 3.4; SB.pasaron = new Set(); SB.ganador = null; SB.rapido = false;
    for (const e of G.emperadores) if (!e.esJugador) P.botInspecciona(G, e, SB.carro);
    enviarSub();
  };
  let last = performance.now(), relojMostrado = -1;
  clearInterval(HOST.subTick);
  HOST.subTick = setInterval(() => {
    if (!G || !G.flujo || G.flujo.p !== 'subasta') return clearInterval(HOST.subTick);
    const now = performance.now(), dt = Math.min(0.5, (now - last) / 1000) * (SB.rapido ? 8 : 1); last = now;
    if (SB.estado === 'llega') { SB.t -= dt; if (SB.t <= 0) { SB.estado = 'puja'; SB.reloj = R.SUBASTA.reloj; SB.react = G.emperadores.map((e) => P.reaccionBot(e)); enviarSub(); } }
    else if (SB.estado === 'puja') {
      SB.reloj -= dt;
      for (const e of G.emperadores) {
        if (e.esJugador) continue;
        SB.react[e.id] -= dt;
        if (SB.react[e.id] <= 0) { const m = P.botPuja(G, e, SB.carro, SB.reloj, humanos().map((x) => x.id)); if (m > 0) ACC.pujar(e, m); SB.react[e.id] = P.reaccionBot(e) * (SB.reloj < 3 ? 0.5 : 1); }
      }
      if (Math.ceil(SB.reloj) !== relojMostrado) { relojMostrado = Math.ceil(SB.reloj); enviarSub(); }
      if (SB.reloj <= 0) {
        const r = P.cerrarCarro(G, SB.carro);
        SB.ganador = r ? { emp: r.emp.id, monto: r.monto } : null;
        SB.estado = 'vendido'; SB.t = 2.4; enviarSub(); difundirEstado(); refrescar();
      }
    } else if (SB.estado === 'vendido') { SB.t -= dt; if (SB.t <= 0) { SB.estado = 'sale'; SB.t = 3.4; enviarSub(); } }
    else if (SB.estado === 'sale') { SB.t -= dt; if (SB.t <= 0) sig(); }
  }, 100);
  sig();
}
function enviarSub() {
  const SB = HOST.sub, c = SB.carro;
  const msg = { t: 'sub', idx: SB.idx, estado: SB.estado, reloj: SB.reloj, pujas: c ? c.pujas : [], lider: c ? c.lider : null, insp: c ? c.inspeccionadoPor : [], ojos: SB.ojos || {}, ganador: SB.ganador };
  if (Red.modo === 'host') Red.difundir(msg);
  aplicarSub(msg);
}
let aplicarSub = () => {};
function aplicarSubRemoto(msg) { aplicarSub(msg); }

// la subasta también tiene su pantalla de carga: el mercado a lo lejos (corta: el primer carro tarda en llegar)
PANT.subasta = (d) => {
  const carga = window.Carga && !(document.querySelector('#misBtns')) ? Carga.mostrar({ tipo: 'subasta', titulo: 'Subasta de esclavos', sub: G.historia && window.Mundo ? '📍 ' + regionAct().nombre : '', pie: 'Llegan los carros' }) : null;
  PANT._subasta(d);
  if (carga) requestAnimationFrame(() => requestAnimationFrame(() => carga.cerrar(1100)));
};
PANT._subasta = (d) => {
  const lotes = d.carros;     // copia de los lotes (para mostrar)
  const L = { idx: -1, estado: 'llega', pujas: G.emperadores.map(() => 0), lider: null, insp: [], ojos: {}, ganador: null, visto: -1 };
  const box = pantalla('calle', `
    <div class="reloj" id="reloj"></div>
    <div class="lay panel" style="left:1%;top:2%;padding:6px 10px"><b>Subasta</b> · carro <span id="ncar">1</span> de ${lotes.length}<br><span class="meta">Tu bolsa: <span class="bolsa" id="mib"></span></span></div>
    <div class="lay" id="info" style="right:1%;top:2%;max-width:48%"></div>
    <div class="lay" id="msg" style="left:50%;top:22%;transform:translateX(-50%);"></div>
    <div class="mesa" id="mesa">${G.emperadores.map((e, i) => `<div class="pj ${e.id === YO ? 'yo' : ''}" id="q${e.id}" style="left:${50 + (i - (G.emperadores.length - 1) / 2) * Math.min(22, 80 / G.emperadores.length)}%;--c:${e.color}" title="${nombreDe(e)}"><span class="pj-c"></span><span class="pj-n"><b id="o${e.id}">0</b><small id="pb${e.id}"></small></span></div>`).join('')}</div>
    <div class="lay pujas" id="misBtns">${R.ECONOMIA.pujas.map((m) => `<button data-m="${m}"><b>+${m}</b><span class="mo oro"></span></button>`).join('')}<button id="insp" style="display:none">🔍<small>Inspeccionar</small></button><button id="ojo" class="ojo" aria-label="Ojear el carro"><span class="ojo-ic"></span><span class="ojo-p"><b id="ojoP">5</b><span class="mo oro"></span></span></button><button id="paso" class="pasar" title="Dejás pasar este carro">PASAR ⏩</button></div>`);
  const ui = { reloj: $('#reloj', box), info: $('#info', box), msg: $('#msg', box) };
  const S3 = box.h.S;
  const carroVista = () => ({ lote: lotes[L.idx], inspeccionadoPor: L.insp });
  box.h.frames.push((t, dt) => {
    const c = S3.carro.position;
    if (L.estado === 'llega') { S3.andando = c.x < 0 ? 1 : 0; c.x = Math.min(0, c.x + dt * 7); }
    else if (L.estado === 'sale' || L.estado === 'fin') { S3.andando = c.x < 26 ? 1 : 0; c.x = Math.min(30, c.x + dt * 8); }
    else { S3.andando = 0; c.x += (0 - c.x) * Math.min(1, dt * 4); }
    // el reloj va en una esquinita del carro, así no lo tapa nada
    const p = box.h.proyectar(window.Mundo.V3(c.x - 2.1, 3.1, c.z));
    ui.reloj.style.left = Math.max(4, Math.min(96, p.x)) + '%'; ui.reloj.style.top = Math.max(4, p.y) + '%';
  });
  // cada rey tiene su lugar en la mesa, justo arriba de su retrato
  const zonas = () => {
    const br = box.getBoundingClientRect();
    S3.setSpots(G.emperadores.map((e) => { const r = $(`#q${e.id}`, box).getBoundingClientRect(); const p = box.h.aPlano(r.left - br.left + r.width / 2, r.top - br.top - br.height * 0.06, S3.mesaY); return { x: p.x, z: Math.max(5.9, Math.min(8.8, p.z)) }; }));
  };
  G.emperadores.forEach((e) => { const c = $(`#q${e.id} .pj-c`, box); if (c) c.appendChild(retratoEmp(e)); });
  box.h.onResize = zonas; setTimeout(zonas, 50);
  const monedas = (i, monto) => { for (let k = 0; k < monto; k++) setTimeout(() => S3.moneda(i), k * Math.min(45, 500 / monto)); };   // una moneda por cada oro
  function pintarBolsas() {
    for (const e of G.emperadores) {
      $(`#o${e.id}`, box).textContent = L.pujas[e.id] || 0;
      $(`#q${e.id}`, box).classList.toggle('lead', L.lider === e.id && !!L.pujas[e.id]);
      $(`#pb${e.id}`, box).innerHTML = `<span class="mo oro"></span>${Math.round(e.bolsa.oro)}`;   // el oro que le queda en la bolsa
    }
    $('#mib', box).textContent = bolsaTxt(yo());
  }
  function mostrarInfo() {
    if (L.idx < 0 || L.idx >= lotes.length) { ui.info.innerHTML = ''; return; }
    const lote = lotes[L.idx];
    ui.info.innerHTML = `<div class="panel" style="padding:6px 8px;margin-bottom:6px">${lote.length > 1 ? `<b>Lote de ${lote.length}</b> — se puja por el grupo completo` : '<b>Un gladiador</b>'}${L.insp.includes(YO) ? ' · <span style="color:var(--gold)">inspeccionado</span>' : ''}</div><div class="cards"></div>`;
    lote.forEach((g) => $('.cards', ui.info).appendChild(tarjetaSubasta(g, carroVista())));
    $('#insp', box).style.display = yo().inspecciones > 0 && !L.insp.includes(YO) && L.estado === 'puja' ? '' : 'none';
    pintarOjo();
  }
  aplicarSub = (m) => {
    if (!box.isConnected) return;
    if (m.idx !== L.idx && m.idx < lotes.length) {   // llega otro carro
      L.idx = m.idx; L.pujas = G.emperadores.map(() => 0); L.lider = null; L.ganador = null; L.paso = false;
      S3.carro.position.x = -24; S3.limpiarMonedas();
      S3.setLote(lotes[L.idx].map((g) => ({ canvas: framesDe(g, '#8a7a62')[0], spec: specDe(g, '#8a7a62'), altura: g.altura, raza: g.raza })));
      $('#ncar', box).textContent = L.idx + 1; ui.msg.innerHTML = '';
    }
    m.pujas.forEach((v, i) => { if (v > (L.pujas[i] || 0)) { monedas(i, v - (L.pujas[i] || 0)); if (window.Sonido) Sonido.moneda(); } });
    const cambioEstado = m.estado !== L.estado;
    L.pujas = m.pujas.slice(); L.lider = m.lider; L.insp = m.insp.slice(); L.ojos = m.ojos || {}; L.estado = m.estado; L.ganador = m.ganador;
    ui.reloj.textContent = m.estado === 'puja' ? `⏳ ${Math.max(0, Math.ceil(m.reloj))}` : '';
    box.querySelectorAll('#misBtns button').forEach((b) => { b.disabled = m.estado !== 'puja' || L.paso; });
    const bp = $('#paso', box); if (bp) { bp.disabled = m.estado !== 'puja' || L.paso; bp.textContent = L.paso ? 'PASASTE ⏩' : 'PASAR ⏩'; }
    if (cambioEstado || m.estado === 'puja') mostrarInfo();
    if (m.estado === 'vendido' && L.visto !== L.idx) {
      L.visto = L.idx;
      if (window.Sonido) Sonido.publico('aplausos', 0.5);
      const lote = lotes[L.idx];
      if (!m.ganador) ui.msg.innerHTML = `<div class="panel" style="padding:8px 14px">Nadie ofreció nada. El carro sigue de largo.</div>`;
      else {
        const w = G.emperadores[m.ganador.emp];
        ui.msg.innerHTML = `<div class="panel" style="padding:8px 14px;font-size:15px">¡<b style="color:${w.color}">${nombreDe(w)}</b> se ${lote.length > 1 ? 'los' : 'lo'} lleva por <b>${P.fmtMonto(m.ganador.monto)}</b>!</div>`;
        if (m.ganador.emp === YO) {
          const mm = modal(`<h2 style="font:700 18px var(--fB);color:var(--gold);margin:0 0 6px">¡${lote.length > 1 ? 'Son tuyos' : 'Es tuyo'}!</h2><div class="meta">Ahora ves todo lo que se sabe de ${lote.length > 1 ? 'ellos' : 'él'}. El honor y los rasgos siguen ocultos hasta que un inspector los revise.</div><div class="cards" id="cs" style="margin:10px 0"></div><button class="prim" id="x">Seguir</button>`);
          lote.forEach((g) => $('#cs', mm).appendChild(tarjetaCompleta({ ...g, dueno: YO })));
          if (lote.some((g) => g.raza === 'lobo')) $('#cs', mm).insertAdjacentHTML('beforebegin', `<div class="lobo-ok grande">🐺 Sorpresa: ${lote.filter((g) => g.raza === 'lobo').length > 1 ? 'hay hombres lobo' : 'uno es hombre lobo'}. Solo vos lo sabés.</div>`);
          $('#x', mm).onclick = () => mm.remove();
        }
      }
    }
    if (m.estado === 'sale') ui.msg.innerHTML = '';
    if (m.estado === 'fin') terminar();
    pintarBolsas();
  };
  function terminar() {
    ui.info.innerHTML = ''; ui.reloj.textContent = '';
    ui.msg.innerHTML = `<div class="panel" style="padding:12px 18px;text-align:center"><b>Se terminó la subasta.</b><br><span class="meta">Tenés ${P.vivos(yo()).length} gladiador(es).</span><br><br><span id="bl"></span><div id="esp"></div></div>`;
    const pint = () => { if (!$('#bl', box)) return; $('#bl', box).innerHTML = ''; $('#bl', box).appendChild(botonListo(G.historia ? 'Volver al mapa' : 'Volver al tablero')); $('#esp', box).innerHTML = esperaHTML(); };
    vista.refrescar = () => { pintarBolsas(); pint(); }; pint();
  }
  box.querySelectorAll('#misBtns button[data-m]').forEach((b) => b.onclick = () => act('pujar', +b.dataset.m));
  $('#insp', box).onclick = () => act('inspLote');
  // el ojito: 5 oro, después 10, 15… (en esta subasta)
  const ojo = $('#ojo', box); ojo.querySelector('.ojo-ic').appendChild(iconoOjo());
  function pintarOjo() { const p = R.TIENDA.ojo.base + R.TIENDA.ojo.suba * (L.ojos[YO] || 0), visto = L.insp.includes(YO), hay = L.idx >= 0 && L.idx < lotes.length && L.estado === 'puja' && !L.paso;
    $('#ojoP', box).textContent = p; ojo.disabled = !hay || visto || yo().bolsa.oro - (L.pujas[YO] || 0) < p; ojo.classList.toggle('visto', visto); ojo.title = visto ? 'Ya lo estás viendo' : `Ver todo el carro por ${p} oro`; }
  ojo.onclick = () => act('ojear');
  if ($('#paso', box)) $('#paso', box).onclick = () => { L.paso = true; act('paso'); box.querySelectorAll('#misBtns button').forEach((b) => { b.disabled = true; }); };
  vista.refrescar = () => { pintarBolsas(); };
  pintarBolsas();
  window.__subasta = () => ({ estado: L.estado, idx: L.idx, lider: L.lider });
  if (HOST.sub && esHost()) enviarSub();
};

/* ---------- EVENTO (secreto) ---------- */
PANT.evento = () => {
  const box = pantalla('callejon', `
    <div class="lay" style="left:2%;top:3%;display:flex;gap:6px;flex-wrap:wrap" id="otros"></div>
    <div class="lay parch" id="carta" style="left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,80%);padding:18px 22px"></div>`);
  if (esHost()) { PRIV.ev = JSON.parse(JSON.stringify(HOST.evs[YO])); PRIV.evRes = HOST.evRes[YO]; }
  else PRIV = {};   // al cliente el mensaje privado le llega justo después
  const carta = $('#carta', box);
  const pintar = () => {
    $('#otros', box).innerHTML = G.emperadores.filter((e) => e.id !== YO).map((e) => `<div class="panel" style="padding:4px 8px;font-size:12px"><span style="color:${e.color};font-weight:700">${e.nombre}</span> recibió un mensaje 🔒${online() && G.flujo.listos.includes(e.id) ? ' ✔' : ''}</div>`).join('');
    const ev = PRIV.ev;
    if (!ev) { carta.innerHTML = '<div style="font-size:15px">Una figura encapuchada se acerca…</div>'; return; }
    if (PRIV.evRes === undefined) {
      const opciones = ev.opciones || null;
      carta.innerHTML = `<div style="font-size:12px;color:#7b5530;letter-spacing:.1em">SOLO PARA TUS OJOS</div><h2>${ev.titulo}</h2><p style="font-size:15px">${ev.texto}</p><div id="extra"></div>
        <div class="ctrls" id="ops">${opciones ? opciones.map((o, i) => `<button data-i="${i}">${o}</button>`).join('') : '<button data-i="0">Aceptar</button>'}</div><div class="meta" style="color:#5a3d22">Tu bolsa: ${bolsaTxt(yo())}</div>`;
      if (ev.gladiador) { ev.gladiador._revelar = true; $('#extra', carta).appendChild(tarjetaSubasta(ev.gladiador, null)); }
      carta.querySelectorAll('#ops button').forEach((b) => b.onclick = () => { carta.querySelectorAll('#ops button').forEach((x) => { x.disabled = true; }); act('evento', +b.dataset.i); });
    } else {
      carta.innerHTML = `<h2>${ev.titulo}</h2><p style="font-size:15px">${PRIV.evRes}</p><div class="meta" style="color:#5a3d22">Tu bolsa: ${bolsaTxt(yo())}</div><br><span id="bl"></span><div id="esp" style="color:#5a3d22"></div>`;
      $('#bl', carta).appendChild(botonListo(G.historia ? 'Volver al mapa' : 'Volver al tablero')); $('#esp', carta).innerHTML = esperaHTML();
    }
  };
  vista.refrescar = () => { if (esHost() && HOST.evRes) PRIV.evRes = HOST.evRes[YO]; pintar(); };
  pintar();
};

/* ---------- PREPARACIÓN: establo + mercado ---------- */
// cómo rinde cada objeto, en notas de 0 a 10 (para las cartas del mercado)
function notas(tipo, v) {
  const n = (x) => Math.max(0, Math.min(10, x));
  if (tipo === 'arma') return { 'DAÑO': n(v.dmg / 15 * 10), 'ALCANCE': n(v.opt / 2.05 * 10), 'VELOCIDAD': n(0.38 / (v.carga + v.recup) * 10), 'ROMPE': n(v.rompe / 2.2 * 10) };
  if (tipo === 'escudo') return { 'BLOQUEO': n(v.bloqueo / 1.15 * 10), 'MOVILIDAD': n((v.movilidad - 0.75) / 0.25 * 10), 'AGUANTE': n((1.25 - v.cardio) / 0.25 * 10) };
  return { 'PROTECCIÓN': n((1 - v.danio) / 0.32 * 10), 'MOVILIDAD': n((v.movilidad - 0.75) / 0.25 * 10), 'AGUANTE': n((1.3 - v.cardio) / 0.3 * 10) };
}
let ordenEstablo = 'tier';   // cómo se ordenan los gladiadores en el establo (solo de este jugador)
const ORDEN_EST = { tier: 'Tier', conv: 'Convocados primero', raza: 'Raza', ventaAsc: 'Venta: más barato primero', venta: 'Venta: más caro primero', vida: 'Vida', fuerza: 'Más fuertes', nombre: 'Nombre', llegada: 'Llegada' };
function ordenarEstablo(vs) {
  const T = R.TIER_ORDEN, l = [...vs];
  if (ordenEstablo === 'tier') l.sort((a, b) => T.indexOf(b.tier) - T.indexOf(a.tier) || P.fuerzaG(b) - P.fuerzaG(a));
  else if (ordenEstablo === 'venta') l.sort((a, b) => P.precioVenta(b) - P.precioVenta(a));
  else if (ordenEstablo === 'conv') l.sort((a, b) => (b.convocado ? 1 : 0) - (a.convocado ? 1 : 0) || T.indexOf(b.tier) - T.indexOf(a.tier) || P.fuerzaG(b) - P.fuerzaG(a));
  else if (ordenEstablo === 'ventaAsc') l.sort((a, b) => P.precioVenta(a) - P.precioVenta(b));
  else if (ordenEstablo === 'raza') l.sort((a, b) => razaDe(a).localeCompare(razaDe(b)) || T.indexOf(b.tier) - T.indexOf(a.tier) || P.fuerzaG(b) - P.fuerzaG(a));
  else if (ordenEstablo === 'vida') l.sort((a, b) => (b.vida ?? 100) - (a.vida ?? 100));
  else if (ordenEstablo === 'fuerza') l.sort((a, b) => P.fuerzaG(b) - P.fuerzaG(a));
  else if (ordenEstablo === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return l;
}
/* ---------- retratos de los gladiadores (los del establo): en 3D se sacan de a uno con una cámara aparte y se guardan ---------- */
const RETRATOS = new Map(), RET_COLA = [];
let RET3D = null, retOcupado = false;
const TIER_COL = { D: '#8b7d6b', C: '#9fb3c8', B: '#6fb35a', A: '#c27ef0', S: '#f2c14e' };
function retratoKey(g, color) { return keyDe(g, color) + '|' + JSON.stringify(g.protesis || {}) + '|' + (window.Voxel && Voxel.modo3D() ? '3d' : '2d'); }
function retratoDe(g, color) {
  const k = retratoKey(g, color);
  if (RETRATOS.has(k)) return RETRATOS.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const fr = framesDe(g, color)[0]; x.drawImage(fr, 0, 0, 160, 160);   // mientras tanto, el dibujo 2D
  c.listo = !(window.Voxel && Voxel.modo3D() && window.THREE);
  RETRATOS.set(k, c);
  if (!c.listo) { RET_COLA.push({ g, color, k, c }); if (!retOcupado) setTimeout(retPaso, 30); }
  return c;
}
function retPaso() {
  const it = RET_COLA.shift(); if (!it) { retOcupado = false; return; }
  retOcupado = true;
  try {
    const T = THREE;
    if (!RET3D) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const ren = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: true }); ren.setPixelRatio(1); ren.setSize(160, 160, false);
      const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xfff4e0, 0x403020, 0.9)); const d = new T.DirectionalLight(0xffffff, 0.65); d.position.set(1.6, 2.2, 3); sc.add(d);
      RET3D = { ren, sc, cam: new T.PerspectiveCamera(24, 1, 0.05, 40), c };
    }
    const { g, color, c } = it, alt = g.altura || 1.8, f = Voxel.figura(specDe(g, color), alt);
    f.rotation.y = 0.42; for (let i = 0; i < 4; i++) f.animar(0.05, 'quieto');
    RET3D.sc.add(f);
    const mitad = alt * 0.34, dist = mitad / Math.tan((24 / 2) * Math.PI / 180);
    RET3D.cam.position.set(alt * 0.05, alt * 0.78, dist); RET3D.cam.lookAt(0, alt * 0.72, 0);
    RET3D.ren.render(RET3D.sc, RET3D.cam);
    const x = c.getContext('2d'); x.clearRect(0, 0, 160, 160); x.drawImage(RET3D.c, 0, 0); c.listo = true;
    RET3D.sc.remove(f); f.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    document.querySelectorAll('canvas.gret').forEach((cv) => { if (cv.dataset.k === it.k) { const y = cv.getContext('2d'); y.clearRect(0, 0, cv.width, cv.height); y.drawImage(c, 0, 0, cv.width, cv.height); } });
  } catch (e) { console.error(e); }
  setTimeout(retPaso, 16);
}
function pintarRetrato(cv, g, color) { const src = retratoDe(g, color); cv.dataset.k = retratoKey(g, color); const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(src, 0, 0, cv.width, cv.height); }

/* ---------- EL ESTABLO: retratos en cuadrícula de a 4, filtros, convocar desde la esquinita; ficha y mercado a la derecha ---------- */
let filtroEst = 'todos', catMercado = null, mkSel = null, mkIr = false, fuSel = null;   // en qué categoría del mercado estás y qué objeto tenés abierto
// íconos dibujados para los "varios" del mercado
function iconoMisc(cual) {
  const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); const f = (col, a, b, w, hh) => { x.fillStyle = col; x.fillRect(a, b, w, hh); };
  if (cual === 'lupa') { x.lineWidth = 5; x.strokeStyle = '#d8c8a0'; x.beginPath(); x.arc(20, 20, 11, 0, 7); x.stroke(); f('#6a4a2a', 28, 30, 6, 6); x.save(); x.translate(31, 33); x.rotate(Math.PI / 4); f('#8a5a30', -3, 0, 7, 16); x.restore(); f('#a8d8f0', 14, 14, 6, 4); return c; }
  if (cual === 'fusion') {   // dos llamas que se juntan en un cuenco chamánico
    f('#3a2416', 10, 34, 28, 8); f('#5a3a22', 8, 30, 32, 5); f('#2a1a10', 14, 42, 20, 3);
    f('#8a4ad8', 12, 16, 8, 14); f('#c08af8', 14, 20, 4, 8); f('#4ab8d8', 28, 16, 8, 14); f('#9ae0f0', 30, 20, 4, 8);
    f('#e9b8ff', 20, 6, 8, 16); f('#fff3ff', 22, 10, 4, 8); f('#f0c24a', 6, 6, 3, 3); f('#f0c24a', 38, 8, 3, 3); f('#f0c24a', 34, 2, 2, 2); return c; }
  if (cual === 'cruz') { f('#f2ead8', 6, 10, 36, 30); f('#1a110a', 6, 10, 36, 3); f('#c0392b', 20, 15, 8, 20); f('#c0392b', 14, 21, 20, 8); f('#8a6a40', 18, 4, 12, 7); f('#1a110a', 20, 6, 8, 3); return c; }
  f('#7a5a36', 8, 18, 32, 24); f('#5a4026', 8, 18, 32, 4); f('#f0c24a', 14, 10, 8, 8); f('#e0b030', 24, 8, 8, 10); f('#c0392b', 30, 26, 10, 10); f('#f2ead8', 33, 27, 4, 8); f('#f2ead8', 31, 29, 8, 4); return c;
}
// retrato chiquito del emperador (la cara, con su corona): en 3D se saca con una cámara aparte
const RET_EMP = new Map(); let RENEMP = null;
function retratoEmp(e) {
  const look = e.look || (e.raza ? { raza: e.raza } : null), k = e.color + JSON.stringify(look || {});
  const c = document.createElement('canvas'); c.width = c.height = 72;
  const pintar = (src) => { const x = c.getContext('2d'); x.clearRect(0, 0, 72, 72); x.drawImage(src, 0, 0, 72, 72); };
  if (RET_EMP.has(k)) { pintar(RET_EMP.get(k)); return c; }
  const plano = () => { const s = document.createElement('canvas'); s.width = s.height = 72; const x = s.getContext('2d'); x.imageSmoothingEnabled = false; if (E && E.emperador) { const em = E.emperador(e.color, look && look.piel); x.drawImage(em, 4, 0, 12, 10, 8, 4, 56, 48); } return s; };
  try {
    if (!(window.Voxel && Voxel.modo3D() && window.THREE)) throw 0;
    const T = THREE;
    if (!RENEMP) { const cv = document.createElement('canvas'); cv.width = cv.height = 96; const ren = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); ren.setPixelRatio(1); ren.setSize(96, 96, false); const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xfff4e0, 0x403020, 0.95)); const d = new T.DirectionalLight(0xffffff, 0.6); d.position.set(1.2, 2, 3); sc.add(d); RENEMP = { ren, sc, cam: new T.PerspectiveCamera(22, 1, 0.05, 30), cv }; }
    const raza = (look && look.raza) || 'humano', alt = raza === 'gigante' ? 2.5 : raza === 'goblin' ? 1.2 : raza === 'orco' ? 1.95 : 1.75;
    const f = Voxel.emperador(e.color, alt, raza, look); f.userData.manual = true; for (let i = 0; i < 3; i++) f.animar(0.05);
    RENEMP.sc.add(f); f.rotation.y = 0.35;
    const cy = alt * 0.86, d = (alt * 0.2) / Math.tan(11 * Math.PI / 180);
    RENEMP.cam.position.set(alt * 0.04, cy, d); RENEMP.cam.lookAt(0, cy - alt * 0.015, 0);
    RENEMP.ren.render(RENEMP.sc, RENEMP.cam);
    const s = document.createElement('canvas'); s.width = s.height = 72; s.getContext('2d').drawImage(RENEMP.cv, 0, 0, 72, 72);
    RENEMP.sc.remove(f); f.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    RET_EMP.set(k, s); pintar(s);
  } catch (err) { const s = plano(); RET_EMP.set(k, s); pintar(s); }
  return c;
}
function iconoOjo() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const f = (col, a, b, w, hh) => { x.fillStyle = col; x.fillRect(a, b, w, hh); };
  f('#f2ead8', 6, 12, 20, 8); f('#f2ead8', 9, 10, 14, 12); f('#1a110a', 4, 15, 2, 2); f('#1a110a', 26, 15, 2, 2); f('#1a110a', 8, 10, 2, 2); f('#1a110a', 22, 10, 2, 2); f('#1a110a', 10, 8, 12, 2); f('#1a110a', 8, 20, 2, 2); f('#1a110a', 22, 20, 2, 2); f('#1a110a', 10, 22, 12, 2);
  f('#4a8ad8', 12, 11, 8, 10); f('#1a110a', 14, 13, 4, 6); f('#ffffff', 13, 12, 2, 2); return c;
}
// textos largos: van aparte, en una ventanita (nunca más de 6 palabras por renglón)
function info(titulo, renglones) { const m = modal(`<div class="info-t">${titulo}</div>${renglones.map((r) => `<p class="info-r">${r}</p>`).join('')}<button class="prim" id="ix">Entendido</button>`); $('#ix', m).onclick = () => m.remove(); }
PANT.preparacion = () => {
  window.Arena && window.Arena.salir();
  let selId = null, eligeProt = null;   // eligeProt: id del que va a proteger, mientras tocás el retrato del protegido
  root.innerHTML = '';
  const scr = h(`<div class="prep2 est2"><div class="est"><div class="est-top"></div><div class="est-fil"></div><div class="egrid"></div></div><div class="brut"></div></div>`);
  root.appendChild(scr);
  const top = $('.est-top', scr), fil = $('.est-fil', scr), grid = $('.egrid', scr), brut = $('.brut', scr);
  let navFicha = null;
  const teclas = (ev) => { if (!scr.isConnected) return window.removeEventListener('keydown', teclas); if (!navFicha || /INPUT|SELECT/.test(document.activeElement.tagName)) return; if (ev.key === 'ArrowLeft') navFicha(-1); if (ev.key === 'ArrowRight') navFicha(1); };
  window.addEventListener('keydown', teclas);
  const tirado = (g) => g.inmortal && (g.vida ?? 100) <= 0;
  const filtrados = () => {
    const vs = ordenarEstablo(P.vivos(yo())), conv = P.convocados(yo());
    if (filtroEst === 'conv') return vs.filter((g) => conv.includes(g));
    if (filtroEst === 'libres') return vs.filter((g) => !conv.includes(g));
    if (filtroEst !== 'todos') return vs.filter((g) => (g.jefe ? 'jefe' : g.raza === 'lobo' ? 'humano' : g.raza) === filtroEst);
    return vs;
  };
  function render() {
    const todos = P.vivos(yo()), conv = P.convocados(yo()), vs = filtrados();
    if (!vs.length && filtroEst !== 'todos') { filtroEst = 'todos'; return render(); }
    if (!vs.some((g) => g.id === selId)) selId = vs.length ? vs[0].id : null;   // siempre hay alguien elegido: nada de espacio muerto
    const sel = vs.find((g) => g.id === selId) || null;
    top.innerHTML = `${G.historia ? '<button class="emap" id="emap" aria-label="Volver al mapa">🗺 <b>MAPA</b></button>' : ''}<b class="est-tit">EL ESTABLO</b><span class="econv ${conv.length ? 'on' : ''}">⚔ ${conv.length}/${R.PELEA.maxPorEquipo}<small>convocados</small></span>
      <label class="meta">Plan <select id="plan">${Object.entries(M.PLANES).map(([k, v]) => `<option value="${k}" ${k === yo().plan ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="meta">Formación <select id="form">${Object.entries({ linea: 'Línea', cunia: 'Cuña', columna: 'Columna', circulo: 'Círculo' }).map(([k, v]) => `<option value="${k}" ${k === yo().formacion ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
    if (!G.historia) { top.insertAdjacentHTML('beforeend', `<button class="ebtn" id="eCham">🔮 Chamán</button><button class="ebtn" id="eMed">✚ Médico</button>`); $('#eCham', top).onclick = () => mostrar('chaman', {}); $('#eMed', top).onclick = medicoMulti; }
    if ($('#emap', top)) $('#emap', top).onclick = () => mostrar('mapa', {});
    $('#plan', top).onchange = (e) => act('plan', e.target.value);
    $('#form', top).onchange = (e) => act('formacion', e.target.value);
    // filtros: por raza (solo las que tenés), convocados o no; y el orden
    const cuenta = {}; for (const g of todos) { const k = g.jefe ? 'jefe' : g.raza === 'lobo' ? 'humano' : g.raza; cuenta[k] = (cuenta[k] || 0) + 1; }
    const chip = (k, txt, n) => `<button class="fchip ${filtroEst === k ? 'on' : ''}" data-f="${k}">${txt}${n != null ? ` <small>${n}</small>` : ''}</button>`;
    fil.innerHTML = chip('todos', 'Todos', todos.length) + chip('conv', '⚔ Convocados', conv.length) + chip('libres', 'Sin convocar', todos.length - conv.length)
      + Object.entries(cuenta).map(([k, n]) => chip(k, k === 'jefe' ? 'Monstruos' : R.RAZAS[k].plural, n)).join('')
      + `<label class="meta ford">Ordenar <select id="ordE">${Object.entries(ORDEN_EST).map(([k, v]) => `<option value="${k}" ${k === ordenEstablo ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
    fil.querySelectorAll('.fchip').forEach((b) => { b.onclick = () => { filtroEst = b.dataset.f; render(); }; });
    $('#ordE', fil).onchange = (e) => { ordenEstablo = e.target.value; render(); };
    // la cuadrícula
    const quienProt = eligeProt != null && P.vivos(yo()).find((x) => x.id === eligeProt);
    if (eligeProt != null && !quienProt) eligeProt = null;
    grid.classList.toggle('eligiendo', !!quienProt);
    grid.innerHTML = vs.length ? '' : `<div class="evacio">El establo está vacío.${G.historia ? ' Andá a una subasta desde el mapa.' : ' Si llegás así a la pelea, te prestan uno <span class="tier D">D</span>.'}</div>`;
    for (const g of vs) {
      const esta = conv.includes(g), vida = g.vida ?? 100, les = P.salud(g) !== 'Sano';
      const extra = ordenEstablo.startsWith('venta') ? `${P.precioVenta(g)} oro` : razaDe(g);
      const c = h(`<div class="ecard ${g.id === selId ? 'sel' : ''} ${esta ? 'conv' : ''} ${tirado(g) ? 'tirado' : ''}" style="--t:${TIER_COL[g.tier] || '#888'}" role="button" tabindex="0" aria-label="${g.nombre}, tier ${g.tier}">
        <div class="gfoto"><canvas class="gret" width="128" height="128"></canvas></div>
        <span class="tier ${g.tier}">${g.tier}</span>
        <button class="gconv ${esta ? 'on' : ''}" aria-label="${esta ? 'Desconvocar' : 'Convocar'} a ${g.nombre}" title="${g.internado ? 'En la sala del curandero' : esta ? 'Desconvocar' : 'Convocar'}" ${(tirado(g) || g.internado) && !esta ? 'disabled' : ''}>${g.internado ? '🛏' : tirado(g) && !esta ? '💤' : '⚔'}</button>
        ${les || g.inmortal ? `<span class="gest">${g.inmortal ? '👹' : ''}${les ? '🩹' : ''}</span>` : ''}
        <div class="gpie"><b>${g.nombre}</b><small>${extra}</small><span class="gvida" title="Vida ${vida}%"><i style="width:${vida}%;background:${vida > 60 ? '#6fb35a' : vida > 30 ? '#e0b31c' : '#d0402a'}"></i></span></div></div>`);
      pintarRetrato($('canvas', c), g, yo().color);
      if (quienProt && g.id === eligeProt) c.classList.add('protector');
      c.onclick = () => {
        if (quienProt) { if (g.id === eligeProt) return; act('orden', eligeProt, 'proteger', g.id); selId = eligeProt; eligeProt = null; return render(); }
        selId = g.id; render();
      };
      c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selId = g.id; render(); } };
      $('.gconv', c).onclick = (e) => { e.stopPropagation(); act('convocar', g.id, !esta); };
      grid.appendChild(c);
    }
    if (quienProt) { const av = h(`<div class="eprot">🛡 Tocá a quién protege ${quienProt.nombre} <button id="protNo">Cancelar</button></div>`); grid.prepend(av); $('#protNo', av).onclick = (e) => { e.stopPropagation(); eligeProt = null; render(); }; }
    const s = grid.querySelector('.ecard.sel'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    const scrollAntes = brut.scrollTop;   // comprar o convocar no te tiene que tirar arriba de todo
    renderFicha(sel, vs); renderMercado(sel);
    if (mkIr) { mkIr = false; const m = $('.mk', brut); if (m) brut.scrollTop = m.offsetTop - 6; } else brut.scrollTop = scrollAntes;
  }
  function renderFicha(g, vs) {
    brut.innerHTML = '';
    if (!g) { navFicha = null; return; }
    const les = Object.entries(g.lesiones).filter(([, v]) => v > 0), idx = vs.findIndex((x) => x.id === g.id), W = R.ARMAS[g.equipo.arma];
    const f = h(`<div class="fic" style="--t:${TIER_COL[g.tier] || '#888'}">
      <div class="fic-h"><canvas class="gret" width="96" height="96"></canvas><div class="fic-t">
        <div class="fn">${g.nombre} <span class="tier ${g.tier}">${g.tier}</span></div>
        <div class="meta">${razaDe(g)}${g.raza === 'lobo' ? ' <span class="secreto" title="Solo vos lo sabés">🐺 en realidad, hombre lobo</span>' : ''}${Object.entries(g.protesis || {}).map(([m, t]) => ` · ${t === 'garfio' ? '🪝 garfio' : '🦿 pata de palo'}`).join('')} · ${W.label}</div>
        <div class="meta">Potencial ${g.potencial} · ${g.record.v}V ${g.record.d}D · ${g.record.muertes} muertes</div>
        <div class="fvida">VIDA ${g.vida ?? 100}%<span class="vb"><i style="width:${g.vida ?? 100}%"></i></span></div></div>
        <div class="fnav"><button id="fprev" aria-label="Anterior">◀</button><span>${idx + 1}/${vs.length}</span><button id="fnext" aria-label="Siguiente">▶</button></div></div>
      ${g.inmortal ? '<div class="fmon">👹 Monstruo inmortal: si cae queda tirado, y solo se cura sacrificando esclavos.</div>' : ''}
      <div class="fstats">${R.STATS.map((s) => `<div><span>${s.label.slice(0, 3).toUpperCase()}</span><b>${g.stats[s.key]}</b><i><u style="width:${g.stats[s.key]}%;background:${barCol(g.stats[s.key])}"></u></i></div>`).join('')}</div>
      <div class="meta">Salud: <span class="salud ${P.salud(g).split(' ')[0]}">${P.salud(g)}</span>${les.length ? ' — ' + les.map(([k, v]) => `${M.INJ.label[k].toLowerCase()} ${Math.round(v * 100)}%`).join(', ') : ''}</div>
      <div class="meta">Honor ${g.honor} · Rasgos: ${rasgosHTML(g)}</div>
      <div class="facc"><span id="cvb"></span><label class="meta">Orden <select id="ord">${Object.entries(M.ORDENES).map(([k, v]) => `<option value="${k}" ${k === (g.orden || 'cercano') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${g.orden === 'proteger' ? (() => { const pv = g.protegeVs, vv = P.vivos(yo()), t = vv.find((x) => x.id === pv) || (typeof pv === 'number' ? vv[pv] : null); return `<button class="ebtn" id="prot">🛡 ${t && t.id !== g.id ? 'a ' + t.nombre : 'elegir a quién'}</button>`; })() : ''}</div></div>`);
    brut.appendChild(f);
    pintarRetrato($('canvas', f), g, yo().color);
    const bc = botonConvocar(g); bc.style.width = 'auto'; bc.style.marginTop = '0'; $('#cvb', f).appendChild(bc);
    const bv = botonVender(g, () => { const r = vs.filter((x) => x.id !== g.id); selId = r.length ? r[Math.min(idx, r.length - 1)].id : null; }); bv.style.width = 'auto'; bv.style.marginTop = '0'; $('#cvb', f).appendChild(bv);
    if (g.inmortal) {
      const otros = P.vivos(yo()).filter((x) => !x.inmortal);
      const bs = h(`<button class="vender" style="width:auto;margin:0" ${(g.vida ?? 100) >= 100 || !otros.length ? 'disabled' : ''}>🩸 Sacrificar para curarlo</button>`);
      bs.onclick = () => {
        const SA = R.HISTORIA.sacrificio, lista = ordenarEstablo(otros);
        const m = modal(`<div style="font:700 17px var(--fB);color:var(--gold)">Curar a ${g.nombre} · vida ${g.vida ?? 100}%</div><div class="meta" style="margin:4px 0 8px">Los monstruos no se curan solos: comen esclavos. Cuanto mejor el tier, más cura.</div><div class="sacr">${lista.map((x, i) => `<button data-i="${i}"><b>${x.nombre}</b> <span class="tier ${x.tier}">${x.tier}</span> ${razaDe(x)} · +${SA[x.tier]}%</button>`).join('')}</div><div class="ctrls" style="margin-top:8px"><button id="c">Listo</button></div>`);
        m.querySelectorAll('.sacr button').forEach((b) => { b.onclick = () => { const x = lista[+b.dataset.i]; yo().escuderia = yo().escuderia.filter((y) => y !== x); g.vida = Math.min(100, (g.vida ?? 0) + SA[x.tier]); if (g.vida >= 100) for (const k in g.lesiones) g.lesiones[k] = 0; m.remove(); if (G.historia) hGuardar(); render(); }; });
        $('#c', m).onclick = () => m.remove();
      };
      $('#cvb', f).appendChild(bs);
    }
    const mover = (d) => { selId = vs[(idx + d + vs.length) % vs.length].id; render(); };
    $('#fprev', f).onclick = () => mover(-1); $('#fnext', f).onclick = () => mover(1);
    navFicha = mover;
    // proteger: al toque te pide tocar el retrato del que va a proteger
    $('#ord', f).onchange = (e) => { if (e.target.value === 'proteger') { eligeProt = g.id; act('orden', g.id, 'proteger', null); render(); } else act('orden', g.id, e.target.value, null); };
    if ($('#prot', f)) $('#prot', f).onclick = () => { eligeProt = g.id; render(); };
  }
  function renderMercado(g) {
    const mk = h(`<section class="mk" aria-label="Mercado"><div id="mkb"></div><div id="bl"></div><div id="esp" class="mk-esp"></div></section>`);
    brut.appendChild(mk);
    if (!G.historia) { const bl = botonListo('LISTO ▸ AL TABLERO'); bl.className = 'mk-go'; $('#bl', mk).appendChild(bl); $('#esp', mk).innerHTML = esperaHTML(); }
    const cuerpo = $('#mkb', mk), oro = yo().bolsa.oro;
    const head = (titulo, atras) => `<div class="mk-head">${atras ? '<button class="mk-back" id="mkBack" aria-label="Volver a las categorías">◀</button>' : ''}<b>${titulo}</b><span class="mk-oro"><span class="mo oro"></span>${oro}</span></div>`;
    if (!g) { cuerpo.innerHTML = head('Mercado') + '<div class="mk-vacio">Elegí un gladiador</div>'; return; }
    const armaManos = (id) => R.ARMAS[id].manos === 2 || R.ARMAS[id].sinEscudo;
    const lastimados = P.vivos(yo()).filter((x) => P.salud(x) !== 'Sano');
    const icon = (tipo, k) => { const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(window.Rig.icono(tipo, k, yo().color), 0, 0); return c; };
    const CATS = {
      arma: { titulo: 'Armas', tabla: R.ARMAS, puesto: g.equipo.arma, lista: Object.entries(R.ARMAS).filter(([, v]) => !v.oculta) },
      armadura: { titulo: 'Armaduras', tabla: R.ARMADURAS, puesto: g.equipo.armadura, lista: Object.entries(R.ARMADURAS).filter(([k]) => k !== 'ninguna') },
      escudo: { titulo: 'Escudos', tabla: R.ESCUDOS, puesto: g.equipo.escudo, lista: Object.entries(R.ESCUDOS).filter(([k]) => k !== 'ninguno') },
    };
    // ---- portada: las 4 categorías ----
    if (!catMercado || !CATS[catMercado]) {
      cuerpo.innerHTML = head('Mercado') + `<div class="mk-cats"></div>`;
      const wrap = $('.mk-cats', cuerpo);
      for (const [k, C] of Object.entries(CATS)) {
        let sub, ic;
        if (k === 'misc') { sub = lastimados.length ? `${lastimados.length} lastimado${lastimados.length > 1 ? 's' : ''}` : 'Médico, inspector, fusión'; ic = iconoMisc(); }
        else { const v = C.tabla[C.puesto]; sub = v && C.puesto !== 'ninguno' && C.puesto !== 'ninguna' ? `Tiene: ${v.label}` : 'No tiene'; ic = icon(k, C.puesto && C.puesto !== 'ninguno' && C.puesto !== 'ninguna' ? C.puesto : C.lista[0][0]); }
        const b = h(`<button class="mk-cat"><span class="mk-ic"></span><span class="mk-ct"><b>${C.titulo}</b><small>${sub}</small></span><span class="mk-flecha" aria-hidden="true">›</span></button>`);
        $('.mk-ic', b).appendChild(ic);
        if (k === 'misc' && lastimados.length) b.classList.add('alerta');
        b.onclick = () => { catMercado = k; mkSel = null; mkIr = true; render(); };
        wrap.appendChild(b);
      }
      return;
    }
    const C = CATS[catMercado];
    cuerpo.innerHTML = head(C.titulo, true) + `<div class="mk-para">Para <b>${g.nombre}</b></div><div class="mk-lista"></div>`;
    $('#mkBack', cuerpo).onclick = () => { catMercado = null; mkIr = true; render(); };
    const lista = $('.mk-lista', cuerpo);
    // ---- varios: médico e inspector ----
    if (catMercado === 'misc') {
      const les = Object.entries(g.lesiones).filter(([, v]) => v > 0);
      const card = (ic, titulo, linea, cuerpoHTML) => { const c = h(`<div class="mk-item mk-misc"><span class="mk-ic"></span><div class="mk-it"><div class="mk-l1"><b>${titulo}</b><button class="mk-info" aria-label="Qué hace">?</button></div><small>${linea}</small>${cuerpoHTML}</div></div>`); $('.mk-ic', c).appendChild(ic); return c; };
      const med = card(iconoMisc('cruz'), 'Médico', 'Baja las lesiones a la mitad', `${les.length ? `<div class="mk-les">${les.map(([k, v]) => `<span>${M.INJ.label[k]} ${Math.round(v * 100)}%</span>`).join('')}</div>` : '<div class="mk-ok">Está sano</div>'}<div class="mk-acc"></div>`);
      const ac = $('.mk-acc', med);
      const bm = h(`<button class="mk-buy" ${les.length ? '' : 'disabled'}>Curarlo<span>${R.TIENDA.curar.precio}<span class="mo oro"></span></span></button>`); bm.onclick = () => act('curar', g.id); ac.appendChild(bm);
      const bt = h(`<button class="mk-sec" ${lastimados.length ? '' : 'disabled'}>Curar a todos (${lastimados.length})<span>${R.TIENDA.curar.precio * lastimados.length}<span class="mo oro"></span></span></button>`); bt.onclick = () => lastimados.forEach((x) => act('curar', x.id)); ac.appendChild(bt);
      $('.mk-info', med).onclick = () => info('Médico', ['Las lesiones vienen de peleas anteriores.', 'Ojo hinchado, cortes, costillas, huesos.', 'Le bajan el rendimiento en la arena.', `El médico las baja a la mitad.`, `Cobra ${R.TIENDA.curar.precio} oro por gladiador.`]);
      const ins = card(iconoMisc('lupa'), 'Inspector', 'Revela honor y rasgos', `<div class="mk-acc"></div>`);
      const bi = h(`<button class="mk-buy" ${g.inspeccionado ? 'disabled' : ''}>${g.inspeccionado ? 'Ya inspeccionado' : 'Inspeccionar'}${g.inspeccionado ? '' : `<span>${R.TIENDA.inspector.precio}<span class="mo oro"></span></span>`}</button>`); bi.onclick = () => act('inspeccionar', g.id); $('.mk-acc', ins).appendChild(bi);
      $('.mk-info', ins).onclick = () => info('Inspector', ['Mira de cerca a tu gladiador.', 'Te dice cuánto honor tiene.', 'Y qué rasgos ocultos esconde.', 'El honor decide si perdona.', `Cobra ${R.TIENDA.inspector.precio} oro.`]);
      // fusión chamánica: el elegido es el que se queda; tocás con quién fusionarlo
      const ch = R.TIENDA.fusion.chance[g.tier], sig = R.TIER_ORDEN[R.TIER_ORDEN.indexOf(g.tier) + 1];
      const pares = P.fusionable(g) ? P.vivos(yo()).filter((x) => x !== g && x.tier === g.tier && P.fusionable(x)) : [];
      if (!pares.some((x) => x.id === fuSel)) fuSel = null;
      const fu = card(iconoMisc('fusion'), 'Fusión chamánica', P.fusionable(g) ? `${tb(g.tier)} + ${tb(g.tier)} = ${tb(sig)}` : g.tier === 'S' ? `Ya es ${tb('S')}` : 'Los monstruos no se fusionan',
        P.fusionable(g) ? `<div class="fu-ch"><span class="fu-p ${ch >= 0.8 ? 'alta' : ch >= 0.5 ? 'media' : 'baja'}">${Math.round(ch * 100)}% de chance</span><span class="fu-g">Gratis</span></div>${pares.length ? `<small class="fu-con">¿Con quién?</small><div class="fu-pares">${pares.map((x) => `<button class="fu-par ${x.id === fuSel ? 'on' : ''}" data-id="${x.id}"><b>${x.nombre}</b><small>${razaDe(x)}${P.salud(x) !== 'Sano' ? ' · herido' : ''}</small></button>`).join('')}</div>` : `<div class="fu-no">No tenés otro tier ${g.tier}</div>`}<div class="mk-acc"></div>` : '');
      if (P.fusionable(g) && pares.length) {
        fu.querySelectorAll('.fu-par').forEach((b) => (b.onclick = () => { fuSel = fuSel === b.dataset.id ? null : b.dataset.id; render(); }));
        const bf = h(`<button class="mk-buy fu-go" ${fuSel ? '' : 'disabled'}>Fusionar</button>`);
        bf.onclick = () => { const otro = pares.find((x) => x.id === fuSel); if (!otro) return;
          if (ch >= 1) { fuSel = null; act('fusionar', g.id, otro.id); return; }   // 100%: no hay nada que perder, se fusiona sin preguntar
          const m = modal(`<div class="fu-res"><div class="fu-ic"></div><b>¿Fusionar?</b><p>${g.nombre} + ${otro.nombre}</p><p>Chance: ${Math.round(ch * 100)}%</p><p class="fu-ojo">Si sale mal, perdés los dos.</p></div><div class="fu-bts"><button id="no">Cancelar</button><button class="prim" id="si">Fusionar</button></div>`);
          $('.fu-ic', m).appendChild(iconoMisc('fusion')); $('#no', m).onclick = () => m.remove();
          $('#si', m).onclick = () => { m.remove(); fuSel = null; act('fusionar', g.id, otro.id); }; };
        $('.mk-acc', fu).appendChild(bf);
      }
      $('.mk-info', fu).onclick = () => info('Fusión chamánica', ['Juntás dos del mismo tier.', 'El elegido sube un tier.', 'El otro se funde en él.', 'D a C: siempre sale.', 'C a B: 80%.', 'B a A: 50%.', 'A a S: 20%.', 'Es gratis.', 'Si sale mal, perdés los dos.']);
      lista.append(med, ins, fu);
      return;
    }
    // ---- armas, armaduras, escudos: tocás uno para ver qué cambia y lo comprás ----
    const actual = C.tabla[C.puesto];
    for (const [k, v] of C.lista) {
      const have = C.puesto === k, bloq = catMercado === 'escudo' && armaManos(g.equipo.arma) && !have, caro = !have && v.precio > oro, abierto = mkSel === k;
      const sv = notas(catMercado, v), sa = actual ? notas(catMercado, actual) : Object.fromEntries(Object.keys(sv).map((n) => [n, 0]));
      const filas = Object.entries(sv).map(([n, x]) => {
        const d = Math.round(x - sa[n]), cls = have || !d ? '' : d > 0 ? 'up' : 'dn';
        return `<div class="mk-st"><span>${n.charAt(0) + n.slice(1).toLowerCase()}</span><i><u style="width:${x * 10}%"></u>${have ? '' : `<em style="left:${sa[n] * 10}%"></em>`}</i><b class="${cls}">${have || !d ? '' : (d > 0 ? '+' : '−') + Math.abs(d)}</b></div>`;
      }).join('');
      const resumen = have ? '' : Object.entries(sv).map(([n, x]) => [n, Math.round(x - sa[n])]).filter(([, d]) => d).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([n, d]) => `<span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${n.charAt(0) + n.slice(1).toLowerCase()}</span>`).join('');
      const etiqueta = have ? '<span class="mk-tag on">Equipado</span>' : bloq ? '<span class="mk-tag">Arma a dos manos</span>' : `<span class="mk-precio ${caro ? 'caro' : ''}">${v.precio}<span class="mo oro"></span></span>`;
      const it = h(`<div class="mk-item ${have ? 'have' : ''} ${bloq ? 'bloq' : ''} ${abierto ? 'abierto' : ''}">
        <button class="mk-fila" aria-expanded="${abierto}"><span class="mk-ic"></span><span class="mk-it"><span class="mk-l1"><b>${v.label}</b>${etiqueta}</span><span class="mk-res">${have ? 'Lo tiene puesto' : bloq ? 'No se puede con su arma' : resumen || 'Igual a lo que tiene'}${!have && (v.manos === 2 || v.sinEscudo) ? '<span class="mk-dos">Sin escudo</span>' : ''}</span></span></button>
        ${abierto ? `<div class="mk-det"><div class="mk-stats">${filas}</div>${have || bloq ? '' : `<div class="mk-leyenda"><em></em> lo que tiene ahora</div><button class="mk-buy" ${caro ? 'disabled' : ''}>${caro ? 'No te alcanza' : 'Comprar'}<span>${v.precio}<span class="mo oro"></span></span></button>`}</div>` : ''}</div>`);
      $('.mk-ic', it).appendChild(icon(catMercado, k));
      $('.mk-fila', it).onclick = () => { mkSel = abierto ? null : k; render(); };
      const buy = $('.mk-buy', it); if (buy) buy.onclick = () => { mkSel = null; act('comprar', g.id, catMercado, k); };
      lista.appendChild(it);
    }
  }
  vista.refrescar = render;
  render();
};

/* ---------- PELEA ---------- */
// qué paisaje y qué texto lleva la pantalla de carga de cada pelea
function cargaDePelea(d) {
  const cfg = (esHost() ? HOST.cfg : d.cfg) || {}, esc = String(cfg.escenario || '');
  const tipo = cfg.modo === 'campeones' ? 'torre' : esc.startsWith('maz') ? 'mazmorra' : esc === 'diablo' ? 'diablo' : esc === 'cdh' ? 'historia' : 'coliseo';
  const titulo = String(d.titulo || 'La pelea').replace(/^[^\p{L}\p{N}]+/u, '').replace(/<[^>]+>/g, '').trim();
  const sub = G.historia && window.Mundo ? '📍 ' + regionAct().nombre : '';
  return { tipo, titulo, sub, pie: 'Preparando la arena' };
}
PANT.pelea = (d) => {
  // pantalla de carga: mientras se arma todo (cuerpos, efectos) se ve el coliseo a lo lejos; después no hay tirones
  const carga = window.Carga ? Carga.mostrar(cargaDePelea(d)) : null, mio = vista;
  const armar = () => {
    if (vista !== mio) { if (carga) carga.cerrar(); return; }
    root.innerHTML = '';
    if (esHost()) window.Arena.abrir(root, HOST.cfg, finDePelea, d.titulo, { emitir: Red.modo === 'host' ? (m) => Red.difundir(m) : null });
    else window.Arena.abrir(root, d.cfg, null, d.titulo, { remoto: true });
    if (window.Arena.precalentar) window.Arena.precalentar();
    if (carga) carga.cerrar(1500);
  };
  if (carga) setTimeout(armar, 60); else armar();
};

/* ---------- POST PELEA: el escenario del oro del pueblo ---------- */
PANT.post = (d) => {
  const emp = (ti) => G.emperadores[d.emps[ti]];
  const win = emp(d.fin.ganador);
  const camp = d.modo === 'campeones';
  const premiados = camp ? [{ label: '👑 Campeón de la torre', ganadores: [d.fin.ganador], parte: d.fin.equipos[d.fin.ganador].oro }] : d.logros.filter((l) => !l.nadie);
  const box = pantalla('escenario', `
    <div class="lay pix" style="left:0;right:0;top:3%;text-align:center"><div style="font:700 clamp(16px,3vw,38px) var(--fT);color:#fff3c8;text-shadow:0 3px 0 #000">¡${win.id === YO ? 'Ganaste' : win.nombre + ' gana'} la pelea${camp ? ' de campeones' : ''}!</div>
      <div class="pix" style="color:#e0c890;font-size:clamp(11px,1.3vw,16px)">${camp ? `${d.campeon} es el campeón de la torre · ${R.CAMPEONES.oroPorJugador} oro por jugador, 3 puntos y 1 por cada campeón que mató` : `El oro del pueblo: ${R.RECOMPENSAS.reparto.muertes} oro por cada galardón`}</div></div>
    <div class="lay recompensas">${d.fin.equipos.map((fe, i) => { const e = emp(i); return `<div class="chip"><b style="color:${e.color}">${nombreDe(e)}</b><span><span class="mo oro"></span>+${fe.oro}</span><span class="pts">+${fe.puntos} pts</span></div>`; }).join('')}
      <span id="bl"></span><div id="esp" style="width:100%;text-align:center"></div></div>`, { colores: premiados.map((l) => emp(l.ganadores[0]).color) });
  premiados.forEach((l, i) => {
    const e = emp(l.ganadores[0]);
    const el = h(`<div class="lay premio"><b>${l.label}</b><span style="color:${e.color}">${camp ? d.campeon + ' · ' : ''}${e.nombre}</span><span class="mo-row"><span class="mo oro"></span>${l.parte}</span>${l.empate ? '<small>empate: al que menos tenía</small>' : ''}</div>`);
    box.appendChild(el);
    anclar(box, el, () => box.h.S.sprites[i].position.clone().add(V3(0, 1.75, 0)));
  });
  const pint = () => { $('#bl', box).innerHTML = ''; $('#bl', box).appendChild(botonListo('Continuar ▸')); $('#esp', box).innerHTML = esperaHTML(); };
  vista.refrescar = pint; pint();
};

/* ---------- PELEA DE CAMPEONES: cada uno elige a su mejor gladiador ---------- */
PANT.campeones = () => {
  window.Arena && window.Arena.salir();
  const box = pantalla('escenario', `<div class="lay panel" id="cp" style="left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92%);max-height:88%;overflow:auto;padding:14px 18px"></div>`, { colores: [] });
  const cp = $('#cp', box);
  let elegido = null;
  const pint = () => {
    const vs = ordenarEstablo(P.vivos(yo()).filter((g) => !g.jefe)), listo = yaListo();   // los monstruos de mazmorra no van a la pelea de campeones
    if (elegido === null && vs.length) elegido = vs.slice().sort((a, b) => P.fuerzaG(b) - P.fuerzaG(a))[0].id;
    cp.innerHTML = `<div style="font:700 clamp(18px,2.6vw,30px) var(--fT);color:var(--gold)">👑 Pelea de campeones</div>
      <div class="meta">Cada emperador manda a <b>un solo gladiador</b> a una torre colgante sin bordes. Nadie se rinde y el que se cae, muere.
      El ganador se lleva <b>${R.CAMPEONES.oroPorJugador} oro por jugador</b>, <b>3 puntos</b> y <b>1 punto por cada campeón que mate</b>. Los demás ganan 1 punto si mataron a alguno.</div>
      ${vs.length ? `<div class="camps">${vs.map((g) => `<button class="campc ${g.id === elegido ? 'sel' : ''}" data-id="${g.id}" ${listo ? 'disabled' : ''}><canvas width="64" height="64"></canvas><b>${g.nombre} <span class="tier ${g.tier}">${g.tier}</span></b><small>${razaDe(g)} · vida ${g.vida ?? 100}% · ${R.ARMAS[g.equipo.arma].label}</small></button>`).join('')}</div>` : '<div class="meta">No tenés gladiadores: mirás desde las gradas.</div>'}
      <div class="ctrls" style="margin-top:10px"><span id="bl"></span><span id="esp"></span></div>`;
    cp.querySelectorAll('.campc').forEach((b) => {
      const g = vs.find((x) => x.id === b.dataset.id);
      const c = $('canvas', b).getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(framesDe(g, yo().color)[0], 0, 0, 64, 64);
      b.onclick = () => { elegido = g.id; pint(); };
    });
    if (vs.length) {
      const b = h(`<button class="prim">${listo ? '✔ Esperando…' : 'Mandarlo a la torre ▸'}</button>`); b.disabled = listo;
      b.onclick = () => { b.disabled = true; b.textContent = '✔ Esperando…'; act('campeon', elegido); };
      $('#bl', cp).appendChild(b);
    }
    $('#esp', cp).innerHTML = esperaHTML();
  };
  vista.refrescar = pint; pint();
};

/* ---------- RECUPERACIÓN ---------- */
PANT.recuperacion = (d) => {
  const box = pantalla('enfermeria', `<div class="lay panel" id="rp" style="left:50%;top:50%;transform:translate(-50%,-50%);width:min(620px,86%);max-height:84%;overflow:auto;padding:14px 18px"></div>`);
  const pint = () => {
    const lineas = d.lineas.filter((l) => l.emp === YO || /despide|devuelve/.test(l.txt));
    $('#rp', box).innerHTML = `<h2 style="font:700 20px var(--fT);color:var(--gold);margin:0 0 8px">Recuperación</h2>
      ${lineas.length ? lineas.map((l) => `<div style="padding:3px 0;border-bottom:1px dashed #3a2e24"><span class="nmT" style="color:${G.emperadores[l.emp].color}">${G.emperadores[l.emp].nombre}</span> ${l.txt}</div>`).join('') : '<div class="meta">Nadie tuvo que despedir a nadie esta vez.</div>'}
      <table style="margin-top:10px"><tr><th>Emperador</th><th>Bolsa</th><th>Puntos</th><th>Gladiadores</th></tr>${P.ranking(G).map((e) => `<tr><td><span class="nmT" style="color:${e.color}">${nombreDe(e)}</span>${online() && G.flujo.listos.includes(e.id) ? ' ✔' : ''}</td><td>${bolsaHTML(e)}</td><td>${e.puntos}</td><td>${P.vivos(e).length}</td></tr>`).join('')}</table>
      <div class="meta" style="margin-top:6px">En la recuperación todos recuperan +${R.VIDA.recuperacion}% de vida, y +${R.VIDA.porCasillero}% en cada casillero que avanza el tablero. <span class="prov">Las lesiones bajan ${Math.round(R.RECUPERACION.curaNatural * 100)}% solas (provisional).</span></div>
      <div class="ctrls" style="margin-top:10px"><button id="cura">Curar a todos al 100% (${R.VIDA.curaTotalOro} oro)</button><span id="bl"></span></div><div id="esp"></div>`;
    const todosSanos = P.vivos(yo()).every((g) => (g.vida ?? 100) >= 100 && Object.values(g.lesiones).every((v) => v === 0));
    const cura = $('#cura', box); if (todosSanos) { cura.disabled = true; cura.textContent = '✔ Todos al 100%'; }
    cura.onclick = () => act('curarTodo');
    $('#bl', box).appendChild(botonListo(G.casillero >= R.CASILLEROS ? 'Ver el final' : 'Volver al tablero'));
    $('#esp', box).innerHTML = esperaHTML();
  };
  vista.refrescar = pint; pint();
};

/* ---------- EMPATE y FINAL ---------- */
PANT.empate = (d) => {
  const box = pantalla('salon', `<div class="lay panel" id="ep" style="left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,86%);padding:16px 20px;text-align:center"></div>`);
  box.h.S.setN(0, []);
  const pint = () => {
    const emp = d.ids.map((i) => G.emperadores[i]);
    $('#ep', box).innerHTML = `<h2 style="font:700 22px var(--fT);color:var(--gold);margin:0 0 8px">¡Empate por el reino!</h2>
      <div>${emp.map((e) => `<b style="color:${e.color}">${nombreDe(e)}</b>`).join(' · ')} terminaron con ${emp[0].puntos} puntos.</div>
      <div class="meta" style="margin:8px 0">Se define con una pelea final entre ellos.</div><span id="bl"></span><div id="esp"></div>`;
    $('#bl', box).appendChild(botonListo('⚔ Pelea final')); $('#esp', box).innerHTML = esperaHTML();
  };
  vista.refrescar = pint; pint();
};
PANT.final = (d) => {
  const rk = P.ranking(G), w = G.emperadores[d.ganador];
  const box = pantalla('final', `<div class="lay pix" style="left:0;right:0;top:4%;text-align:center"><div class="big" style="font-size:clamp(20px,4.5vw,56px)">${w.id === YO ? '¡GOBERNÁS EL REINO!' : `${w.nombre.toUpperCase()} GOBIERNA EL REINO`}</div></div>
    <div class="lay panel" style="left:50%;bottom:4%;transform:translateX(-50%);width:min(620px,86%);padding:10px 16px">
      <table><tr><th>#</th><th>Emperador</th><th>Puntos</th><th>Peleas ganadas</th><th>Logros</th><th>Caídos</th></tr>${rk.map((e, i) => `<tr><td>${i + 1}</td><td><span class="nmT" style="color:${e.color}">${nombreDe(e)}</span></td><td><b>${e.puntos}</b></td><td>${e.victorias}</td><td>${e.logros}</td><td>${e.caidos.length}</td></tr>`).join('')}</table>
      <div class="ctrls" style="margin-top:10px;justify-content:center"><button class="prim" id="otra">Volver al menú</button></div></div>`, { color: w.color });
  $('#otra', box).onclick = menu;
};

/* =====================================================================
   MODO HISTORIA (idea de Manu): Prota, esclavo que se vuelve asesor del rey.
   Etapa 1: intro, tutorial, escudería con mapa, coliseos de entretenimiento y de
   historia, peleas de campeones, subastas, eventos y el préstamo del rey.
   Usa una partida (G) con un solo emperador humano (Prota); para cada lugar
   del mapa se suman reyes bots y después se van.
   ===================================================================== */
const HKEY = 'coliseo_historia';
const HI = R.HISTORIA;
const HT = {
  tierNivel: ['D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S', 'S'],   // tier de los coliseos de entretenimiento según cuántos de historia ganaste
  // coliseos de entretenimiento (tabla de Manu): reyes y gladiadores por rey según el tier
  cde: { D: { bots: 2, glads: 2 }, C: { bots: 3, glads: 4 }, B: { bots: 3, glads: 6 }, A: { bots: 4, glads: 6 }, S: { bots: 4, glads: 8 } },
  oroInicial: 120, bolsaBots: (n) => 120 + 40 * n,
};
const TIERS_ORD = ['D', 'C', 'B', 'A', 'S'];
const tierAbajo = (t) => TIERS_ORD[Math.max(0, TIERS_ORD.indexOf(t) - 1)];
const HS = () => G && G.historia;
function hGuardar() { try { const c = P.serializar(G); delete c.flujo; localStorage.setItem(HKEY, JSON.stringify(c)); } catch (e) { /* sin storage */ } }
function hCargar() { try { const s = localStorage.getItem(HKEY); if (!s) return null; const c = JSON.parse(s); hArreglarIds(c); if (c.historia) c.historia.naldoPend = null; return c; } catch (e) { return null; } }
// ids únicos: los nuevos arrancan después del más alto guardado, y si una partida vieja ya tenía repetidos, se les da uno nuevo
function hArreglarIds(c) {
  let max = 0; JSON.stringify(c).replace(/"id":"g(\d+)"/g, (_, n) => { max = Math.max(max, +n); return _; });
  M.subirUID(max);
  const vistos = new Set();
  for (const e of c.emperadores || []) for (const g of [...(e.escuderia || []), ...(e.caidos || [])]) {
    if (!g || typeof g !== 'object' || !g.id) continue;
    if (vistos.has(g.id)) { M.subirUID(++max); g.id = 'g' + max; }
    vistos.add(g.id);
  }
}
function hBorrar() { try { localStorage.removeItem(HKEY); } catch (e) { /* nada */ } }

/* ---------- charlas: globos de texto con voz de 8 bits ---------- */
const retratoCharla = (q) => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const per = GUION.personajes[q] || {};
  if (q === 'diablo' && window.Rig) x.drawImage(window.Rig.retrato({ id: 'diablo', raza: 'gigante', color: '#3a0a06', piel: '#a8221a', arma: 'lanza', escudo: 'ninguno', armadura: 'ninguna' }), 0, 0, 64, 64);
  else if (q === 'subastador' && window.Rig) x.drawImage(window.Rig.retrato({ id: 'subastador', raza: 'humano', color: '#7a3a22', piel: '#d8a878', arma: 'nada', escudo: 'ninguno', armadura: 'ninguna' }), 0, 0, 64, 64);
  else if (q === 'prota' && window.Rig) x.drawImage(window.Rig.retrato({ id: 'prota', raza: 'humano', color: '#6a5a44', piel: '#c8956a', arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' }), 0, 0, 64, 64);
  else if (E && E.emperador) { const e = E.emperador(per.color || '#c8a640'); x.drawImage(e, Math.max(0, (e.width - e.height) / 2), 0, Math.min(e.width, e.height), e.height, 4, 0, 56, 64); }
  return c;
};
function charla(lineas, cb, fondo, alLinea) {
  lineas = (lineas || []).filter((l) => !l.t.startsWith('[MANU'));   // lo que Manu todavía no escribió no se muestra
  if (window.T) lineas = lineas.map((l) => ({ ...l, t: T(l.t) }));   // traducción (si el idioma no es castellano)
  if (fondo && lineas.length && window.Musica) Musica.poner('cinematica');   // charlas en escena = cinemática
  if (fondo) { document.querySelectorAll('.modal').forEach((m) => m.remove()); document.querySelectorAll('.naldo').forEach((n) => { if (n._fin) n._fin(true); else n.remove(); }); pantalla(fondo, '', fondo === 'salon' ? {} : undefined); }
  let S3c = null;
  if (fondo === 'salon' && root.querySelector('.box') && root.querySelector('.box').h) {
    const S3 = root.querySelector('.box').h.S, qs = new Set(lineas.map((l) => l.q));
    // si hablan el rey, el prota o el diablo: cinemática (caminan por la nave, plano y contraplano); si no, el salón de siempre
    if (S3.cine && (qs.has('rey') || qs.has('prota') || qs.has('diablo'))) { S3.cine(['rey', 'prota', ...(qs.has('diablo') ? ['diablo'] : [])]); S3c = S3; }
    else if (S3.setN) S3.setN(1, ['#c8a640']);
  }
  if (!lineas.length) return cb && cb();
  if (S3c) { const al0 = alLinea; alLinea = (L, i) => { S3c.plano(L.q); if (al0) al0(L, i); }; }
  document.querySelectorAll('.charla').forEach((x) => x.remove());
  const ov = h(`<div class="charla"><div class="globo"><canvas class="cara"></canvas><div class="cuerpo"><b class="quien"></b><div class="txt" data-noi18n></div></div><span class="sig">▼</span></div></div>`);
  document.body.appendChild(ov);
  let i = -1, timer = null, escrito = true;
  const fin = () => { clearInterval(timer); ov.remove(); cb && cb(); };
  const sig = () => {
    if (!escrito) { clearInterval(timer); escrito = true; $('.txt', ov).textContent = lineas[i].t; return; }
    i++; if (i >= lineas.length) return fin();
    const L = lineas[i], per = GUION.personajes[L.q] || GUION.personajes.narrador;
    if (alLinea) alLinea(L, i);
    const globo = $('.globo', ov); globo.className = 'globo ' + (L.q === 'narrador' ? 'narra' : L.q === 'prota' ? 'der' : 'izq');
    $('.quien', ov).textContent = per.nombre; $('.quien', ov).style.color = per.color;
    const cv = $('.cara', ov); if (L.q !== 'narrador') { const r = retratoCharla(L.q); cv.width = 64; cv.height = 64; cv.getContext('2d').drawImage(r, 0, 0); }
    const txt = $('.txt', ov); txt.textContent = ''; escrito = false; let k = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      if (k >= L.t.length) { clearInterval(timer); escrito = true; return; }
      const ch = L.t[k++]; txt.textContent += ch;
      if (window.Sonido && /[a-záéíóúñ0-9]/i.test(ch) && k % 2) Sonido.bip(per.tono, ch);
    }, 28);
  };
  ov.onclick = sig; sig();
}
function pregunta(linea, opciones, cb) {
  charla([linea], () => {
    const m = modal(`<div style="font-size:15px;margin-bottom:10px">${linea.t.startsWith('[MANU') ? '¿Querés hacer el tutorial?' : linea.t}</div><div class="ctrls">${opciones.map((o, i) => `<button class="${i === 0 ? 'prim' : ''}" data-i="${i}">${o}</button>`).join('')}</div>`);
    m.querySelectorAll('button').forEach((b) => { b.onclick = () => { m.remove(); cb(+b.dataset.i); }; });
  });
}
// consejo del tutorial que flota arriba de la pantalla
function consejo(txt) { document.querySelectorAll('.consejo').forEach((x) => x.remove()); if (!txt) return; const c = h(`<div class="consejo"><b>Consejo</b> ${txt}</div>`); document.body.appendChild(c); return c; }

/* ---------- empezar / continuar ---------- */
function historiaMenu() {
  const guardada = hCargar();
  if (!guardada) return historiaNueva();
  const m = modal(`<div style="font:700 20px var(--fT);color:var(--gold)">Modo Historia</div><div class="meta" style="margin:6px 0 12px">Partida guardada: Coliseo de historia ${guardada.historia.nivel}/10 · ${guardada.emperadores[0].bolsa.oro} oro · ${guardada.emperadores[0].escuderia.filter((g) => g.vivo).length} esclavos</div><div class="ctrls"><button class="prim" id="c">Continuar</button><button id="n">Empezar de nuevo</button><button id="x">Volver</button></div>`);
  $('#c', m).onclick = () => { m.remove(); historiaContinuar(guardada); };
  $('#n', m).onclick = () => { m.remove(); hBorrar(); historiaNueva(); };
  $('#x', m).onclick = () => m.remove();
}
function historiaBase(seed) {
  Red.modo = 'solo'; YO = 0;
  G = P.nueva(1, seed, [{ nombre: 'Prota', humano: true }]);
  G.emperadores[0].bolsa.oro = 0;
  G.historia = { nivel: 0, prestamo: 0, tut: 0, pasos: 0, visto: {}, oro0: 0, nodo: null }; hNormalizar();
}
function historiaContinuar(g) {
  Red.modo = 'solo'; YO = 0; G = g; G.rng = M.mulberry32((G.seed + 7919 * (G.historia.pasos + 1)) | 0); G.deudas = G.deudas || [];
  irEscuderia();
}
/* ---------- cinemática de la intro (guion de Merlin) ----------
   JERICHAMES en negro → patas del caballo → los reyes contando monedas → los esclavos en la carreta →
   Naldo mirando, con Prota que llega de atrás encadenado → la carreta frena y se ve la plaza (título) →
   las pujas con plano y contraplano → "¡Vendido!" → más tarde, en el establo. */
function cineIntro(cb) {
  if (window.Musica) Musica.poner('cinematica');
  const box = pantalla('calle', `<div class="cine-bar arriba"></div><div class="cine-bar abajo"></div>
    <div class="cine-titulo espera"><div class="big">KINGDOM'S PRICE</div><div class="pix">Modo Historia</div></div>
    <div class="cine-negro"><div class="cine-estudio">JERICHAMES</div></div><button class="cine-saltar">Saltar ▸</button>`);
  const S3 = box.h.S, V = (x, y, z) => window.Mundo.V3(x, y, z), MU = window.Mundo;
  let vivo = true; const later = (f, ms) => setTimeout(() => { if (vivo && box.isConnected) f(); }, ms);
  const terminar = () => { if (!vivo) return; vivo = false; document.querySelectorAll('.charla, body > .cine-saltar').forEach((x) => x.remove()); if (window.Sonido) Sonido.ambiente(false); cb(); };
  // "Saltar" va arriba de todo (también de los cuadros de diálogo)
  const salt = $('.cine-saltar', box); document.querySelectorAll('body > .cine-saltar').forEach((x) => x.remove()); document.body.appendChild(salt); salt.onclick = terminar;
  S3.mesaG.visible = false;   // la mesa grande de las pujas es del juego, no de la intro
  const add = (o, x, z, y = 0) => { o.position.set(x, y, z); S3.scene.add(o); return o; };
  const fig = (spec, h) => { const f = MU.gladSprite({ spec }, h); if (f.voxel) f.voxel.modo = 'paseo'; return f; };
  // el carro con tres goblins, que llega por la calle
  const CARRO = { x0: -15, x1: 0.2, z: -1.4 };
  S3.carro.position.set(CARRO.x0, 0, CARRO.z);
  S3.setLote(['goblin', 'goblin', 'goblin'].map((raza, i) => ({ id: 'i' + i, raza, altura: R.RAZAS[raza].altura, spec: { id: 'i' + i, raza, color: '#8a7a62', piel: R.RAZAS[raza].piel, arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' } })));
  // la mesita de los reyes, mirando a la carreta
  const MC = { x: -5.0, z: 3.4 }, ang = Math.atan2(CARRO.x1 - MC.x, CARRO.z - MC.z);
  const mesa = S3.mesita(MC.x, MC.z, ang);
  const fw = V(Math.sin(ang), 0, Math.cos(ang)), lat = V(Math.cos(ang), 0, -Math.sin(ang));   // adelante (hacia el carro) y al costado
  const HS0 = 0.02;   // sentados: el cuerpo baja hasta el banquito
  const reyes = ['#5a6ab0', '#c8a640', '#4a8a4a'].map((c, i) => { const e = add(MU.spriteEmp(c, 1.45), mesa.asientos[i].x, mesa.asientos[i].z, HS0); e.rotation.y = ang; if (e.voxel) { e.voxel.modo = 'paseo'; e.voxel.sentado = true; e.voxel.contar = true; } return e; });
  const [cal, rey, aug] = reyes;   // Naldo en el medio, Calígula y Augusto a los costados
  mesa.poner(0, 46, true); mesa.poner(1, 30, true); mesa.poner(2, 52, true);
  // Prota y dos esclavos encadenados, que llegan caminando por detrás de Naldo
  const atras = fw.clone().multiplyScalar(-1);
  const protaFin = rey.position.clone().add(atras.clone().multiplyScalar(0.95)).add(lat.clone().multiplyScalar(0.32));
  const fila = [
    fig({ id: 'prota', raza: 'humano', color: '#6a5a44', piel: '#c8956a', arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' }, 1.24),
    fig({ id: 'esc1', raza: 'humano', color: '#5a4a3a', piel: '#a8744a', arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' }, 1.2),
    fig({ id: 'esc2', raza: 'orco', color: '#5a4a3a', piel: R.RAZAS.orco.piel, arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' }, 1.3),
  ];
  const prota = fila[0];
  const metaFila = (k) => protaFin.clone().add(atras.clone().multiplyScalar(k * 0.85)).add(lat.clone().multiplyScalar(k * 0.25));
  fila.forEach((f, k) => { const p = metaFila(k).add(atras.clone().multiplyScalar(5)); add(f, p.x, p.z); });
  // la cadena: eslabones estirados entre las muñecas de uno y otro
  const cadMat = new THREE.MeshLambertMaterial({ color: '#2a2622' });
  const cadenas = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1), cadMat); S3.scene.add(m); return m; });
  // el subastador, parado al lado de la carreta
  const sub = fig({ id: 'subastador', raza: 'humano', color: '#7a3a22', piel: '#d8a878', arma: 'munon', escudo: 'ninguno', armadura: 'toga' }, 1.3);
  add(sub, CARRO.x1 - 2.6, CARRO.z + 1.45);
  const angSub = Math.atan2(MC.x - sub.position.x, MC.z - sub.position.z);
  // girar a alguien en el mundo (el cuerpo de adentro gira solo según camina: se compensa)
  const mirarA = (o, a) => { o.rotation.y = a - (o.children[0] ? o.children[0].rotation.y : 0); };
  const cab = (o, h) => V(o.position.x, o.position.y + h, o.position.z);
  const HR = 1.18, HP = 1.14;   // altura de la cara: rey sentado, Prota parado

  /* ---------- cámara: cortes secos, cada plano con su movimiento, su lente y su foco ---------- */
  const cam = { f: null, t: 0 }; let fovMeta = 40;
  const cortar = (f) => { cam.f = f; cam.t = 0; };
  const caballo = () => V(S3.carro.position.x + 3.75, 0, S3.carro.position.z);
  const PL = {
    patas: (u) => { const c = caballo(); return { p: V(c.x - 0.6 + u * 0.15, 0.42, c.z + 4.1), m: V(c.x + 0.1, 0.5, c.z), fov: 24, foco: V(c.x, 0.5, c.z + 0.2), b: 1 }; },
    mesa: (u) => ({ p: mesa.local(0.5 - u * 0.05, 1.08, 1.0 - u * 0.06), m: mesa.local(0, 0.8, -0.7), fov: 36, foco: mesa.local(0, 0.75, -0.55), b: 1 }),
    carreta: (u) => { const c = S3.carro.position; return { p: V(c.x + 0.9 - u * 0.25, 1.2, c.z + 2.5), m: V(c.x - 0.3, 1.15, c.z), fov: 36, foco: V(c.x - 0.1, 1.1, c.z + 0.1), b: 1 }; },
    naldo: (u) => ({ p: cab(rey, 1.32).add(fw.clone().multiplyScalar(1.6)).add(lat.clone().multiplyScalar(-0.3)), m: cab(rey, 1.08).add(atras.clone().multiplyScalar(0.8)), fov: 32 - u * 0.5, foco: u < 2.4 ? cab(rey, HR) : cab(prota, HP), b: 1 }),
    plaza: (u) => ({ p: V(-10 + u * 0.9, 7.2 - u * 0.45, 13 - u * 0.4), m: V(-1.5, 1.0, -1.6), fov: 50, foco: V(-1.5, 1, -1), b: 0.15 }),
    // primer plano de un rey: de costado y por fuera de la mesa (las pilas de monedas no tapan); el bajo, en contrapicado
    rey: (u, k) => { const i = reyes.indexOf(k), sx = i === 0 ? -1 : 1, lx = [-0.62, 0, 0.62][i]; return { p: mesa.local(lx + sx * (0.55 - u * 0.02), 1.22, 0.38), m: mesa.local(lx, 1.12, -0.98), fov: 30, foco: cab(k, HR), b: 1 }; },
    reyBajo: (u, k) => { const i = reyes.indexOf(k), sx = i === 0 ? -1 : 1, lx = [-0.62, 0, 0.62][i]; return { p: mesa.local(lx + sx * 0.4, 0.86 + u * 0.02, 0.55), m: mesa.local(lx, 1.18, -0.98), fov: 32 - u * 0.5, foco: cab(k, HR), b: 1 }; },
    mesaTodos: (u) => ({ p: mesa.local(-0.3 + u * 0.05, 1.45, 2.0 - u * 0.08), m: mesa.local(0, 0.75, -0.6), fov: 40, foco: mesa.local(0, 0.8, -0.6), b: 0.7 }),
    // plano y contraplano entre Naldo (sentado, girado hacia atrás) y Prota (parado detrás)
    aProta: (u) => { const d = prota.position.clone().sub(rey.position).setY(0).normalize(), pe = V(-d.z, 0, d.x); return { p: cab(rey, HR + 0.02).sub(d.clone().multiplyScalar(0.75)).add(pe.multiplyScalar(0.32)), m: cab(prota, HP), fov: 30 - u * 0.3, foco: cab(prota, HP), b: 1 }; },
    aNaldo: (u) => { const d = rey.position.clone().sub(prota.position).setY(0).normalize(), pe = V(-d.z, 0, d.x); return { p: cab(prota, 1.02).sub(d.clone().multiplyScalar(0.42)).add(pe.multiplyScalar(-0.34)), m: cab(rey, HR - 0.02), fov: 32 - u * 0.3, foco: cab(rey, HR), b: 1 }; },
    subasta: (u) => ({ p: cab(rey, 1.35).add(atras.clone().multiplyScalar(1.4)).add(lat.clone().multiplyScalar(0.5)), m: cab(sub, 1.0), fov: 34, foco: cab(sub, 1.1), b: 0.9 }),
    vendido: (u) => ({ p: cab(sub, 0.6).add(V(Math.sin(angSub), 0, Math.cos(angSub)).multiplyScalar(1.7)), m: cab(sub, 1.15), fov: 32 - u * 0.5, foco: cab(sub, 1.15), b: 1 }),
  };
  const _foco = V(0, 0, 0); S3.foco = _foco; S3.bokeh = 0;
  // la escena: carro que llega y frena, reyes que murmuran y cuentan, Prota que se acerca, la cadena
  let t0 = null, habla = null, giroRey = 0, giroMeta = 0, subeSub = 0;
  const T_LLEGA = [2.8, 11.0], T_PROTA = [10.6, 13.6];
  box.h.frames.push((t, dt) => {
    if (t0 == null) t0 = t; const tt = t - t0;
    // carro: entra rápido y frena (ease-out)
    const uc = Math.min(1, Math.max(0, (tt - T_LLEGA[0]) / (T_LLEGA[1] - T_LLEGA[0])));
    S3.carro.position.x = CARRO.x0 + (CARRO.x1 - CARRO.x0) * (1 - (1 - uc) * (1 - uc)); S3.andando = uc > 0 && uc < 0.985 ? 1 : 0;
    // reyes: antes de las pujas murmuran (hablan bajito por turnos) y cuentan monedas
    reyes.forEach((e, i) => { const v = e.voxel; if (!v) return; v.habla = habla ? habla === e : (!dlg && Math.sin(tt * 0.9 + i * 2.1) > 0.55); v.contar = !dlg && !v.habla; });
    // Naldo se da vuelta para hablar con Prota
    giroRey += (giroMeta - giroRey) * Math.min(1, dt * 3); rey.rotation.y = ang + giroRey; if (rey.voxel) rey.voxel.mirar = giroRey * 0.6;
    // Prota y los otros dos caminan hasta atrás de Naldo
    const up = Math.min(1, Math.max(0, (tt - T_PROTA[0]) / (T_PROTA[1] - T_PROTA[0])));
    fila.forEach((f, k) => {
      const ini = metaFila(k).add(atras.clone().multiplyScalar(5)), fin = metaFila(k), p = ini.lerp(fin, up);
      f.position.set(p.x, 0, p.z); if (f.voxel) { f.voxel.andar += ((up > 0 && up < 1 ? 1 : 0) - (f.voxel.andar || 0)) * Math.min(1, dt * 5); f.voxel.habla = k === 0 && habla === prota; }
      if (f.animar) f.animar(dt, 'quieto');
      const haciaRey = Math.atan2(rey.position.x - f.position.x, rey.position.z - f.position.z);
      mirarA(f, up < 1 ? Math.atan2(fw.x, fw.z) : k === 0 && giroMeta ? haciaRey : Math.atan2(fw.x, fw.z));
    });
    // cadenas entre las manos
    for (let k = 0; k < 2; k++) { const a = fila[k].position, b = fila[k + 1].position, A = V(a.x, 0.62, a.z), B = V(b.x, 0.6, b.z), m = cadenas[k]; m.position.copy(A).lerp(B, 0.5); m.position.y -= 0.08; m.lookAt(B); m.scale.z = A.distanceTo(B); }
    // subastador: mira a los reyes; levanta el brazo cuando habla
    if (sub.animar) sub.animar(dt, 'quieto'); mirarA(sub, angSub); if (sub.voxel) sub.voxel.habla = habla === sub || subeSub > 0; if (subeSub > 0) subeSub -= dt;
    // cámara
    cam.t += dt;
    if (cam.f) {
      const q = cam.f(cam.t); S3.camera.position.copy(q.p); S3.camera.lookAt(q.m);
      if (Math.abs(S3.camera.fov - q.fov) > 0.02) { S3.camera.fov = q.fov; S3.camera.updateProjectionMatrix(); }
      _foco.lerp(q.foco, cam.t < 0.05 ? 1 : Math.min(1, dt * 2.5)); S3.bokeh = q.b;
    }
  });
  let dlg = false;
  if (window.Sonido) { Sonido.oyente = null; Sonido.ambiente(true); }
  // ---------- la apertura, sin diálogo ----------
  cortar(PL.patas);
  const negro = $('.cine-negro', box), est = $('.cine-estudio', box), tit = $('.cine-titulo', box);
  later(() => est.classList.add('ver'), 300);
  later(() => est.classList.remove('ver'), 2000);
  later(() => negro.classList.add('fuera'), 2700);
  later(() => cortar(PL.mesa), 6000);
  later(() => cortar(PL.carreta), 8700);
  later(() => cortar(PL.naldo), 10900);
  later(() => { cortar(PL.plaza); tit.classList.remove('espera'); tit.classList.add('ver'); }, 14300);
  later(() => tit.classList.add('fuera'), 18000);
  // ---------- las pujas ----------
  const quien = { rey, caligula: cal, augusto: aug, prota, subastador: sub };
  const IDX = { caligula: 0, rey: 1, augusto: 2 };
  later(() => {
    dlg = true;
    charla(GUION.intro, () => {
      // corte a negro y, más tarde, en el establo
      negro.classList.remove('fuera'); negro.classList.add('corte');
      later(() => cineEscuderia(terminar, () => vivo), 900);
    }, null, (L, i) => {
      habla = quien[L.q] || null;
      const num = +((L.t.match(/\d+/) || [])[0] || 0);
      if (L.q === 'caligula' || L.q === 'augusto') { giroMeta = 0; cortar(i % 2 ? (u) => PL.reyBajo(u, quien[L.q]) : (u) => PL.rey(u, quien[L.q])); mesa.poner(IDX[L.q], Math.min(14, Math.max(3, Math.round(num / 2)))); }
      else if (L.q === 'rey' && /^15/.test(L.t)) { giroMeta = 0; cortar(PL.mesaTodos); [0, 1, 2].forEach((k) => later(() => mesa.poner(k, 9), k * 260)); }
      else if (L.q === 'prota') { giroMeta = 2.0; cortar(PL.aProta); }
      else if (L.q === 'rey' && /30 monedas/.test(L.t)) { giroMeta = 0; cortar((u) => PL.rey(u, rey)); mesa.poner(1, 30); if (window.Sonido) Sonido.publico('ooh', 0.6); }
      else if (L.q === 'rey' && /cabeza/.test(L.t)) { giroMeta = 2.0; cortar((u) => PL.rey(u, rey)); }
      else if (L.q === 'rey') { giroMeta = 2.0; cortar(PL.aNaldo); }
      else if (L.q === 'subastador' && /Vendido/.test(L.t)) { cortar(PL.vendido); subeSub = 2.5; if (window.Sonido) Sonido.publico('aplausos', 0.8); }
      else if (L.q === 'subastador') { habla = null; cortar(PL.subasta); }
    });
  }, 19200);
}
// "más tarde, en la escudería": el establo con los tres goblins, Naldo y Prota (plano y contraplano)
function cineEscuderia(cb, sigue) {
  const box = pantalla('establo', `<div class="cine-bar arriba"></div><div class="cine-bar abajo"></div><div class="cine-negro corte"></div><button class="cine-saltar">Saltar ▸</button>`);
  const S3 = box.h.S, V = (x, y, z) => window.Mundo.V3(x, y, z), MU = window.Mundo;
  const salt = $('.cine-saltar', box); document.querySelectorAll('body > .cine-saltar').forEach((x) => x.remove()); document.body.appendChild(salt);
  salt.onclick = () => { document.querySelectorAll('.charla, body > .cine-saltar').forEach((x) => x.remove()); cb(); };
  S3.setGladiadores(['goblin', 'goblin', 'goblin'].map((raza, i) => ({ id: 'ig' + i, raza, altura: R.RAZAS[raza].altura, spec: { id: 'i' + i, raza, color: '#8a7a62', piel: R.RAZAS[raza].piel, arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' } })));
  const rey = MU.spriteEmp('#c8a640', 1.74); rey.position.set(-0.75, 0, 2.6); S3.scene.add(rey); if (rey.voxel) rey.voxel.modo = 'paseo';
  const prota = MU.gladSprite({ spec: { id: 'prota', raza: 'humano', color: '#6a5a44', piel: '#c8956a', arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' } }, 1.66); prota.position.set(0.75, 0, 2.75); S3.scene.add(prota); if (prota.voxel) prota.voxel.modo = 'paseo';
  const mirarA = (o, a) => { o.rotation.y = a - (o.children[0] ? o.children[0].rotation.y : 0); };
  const cab = (o, h) => V(o.position.x, h, o.position.z);
  S3.foco = V(0, 1, 0); S3.bokeh = 0;
  let plano = 'general', u = 0, habla = null;
  box.h.frames.push((t, dt) => {
    u += dt;
    // se miran entre ellos, un poco abiertos hacia la cámara
    rey.rotation.y = Math.PI / 2 - 0.45; mirarA(prota, -Math.PI / 2 + 0.45); if (prota.animar) prota.animar(dt, 'quieto');
    if (rey.voxel) rey.voxel.habla = habla === 'rey'; if (prota.voxel) prota.voxel.habla = habla === 'prota';
    let p, m, fov, f, b;
    if (plano === 'rey') { p = cab(prota, 1.56).add(V(0.55, 0, 0.75)); m = cab(rey, 1.55); fov = 30 - u * 0.3; f = cab(rey, 1.55); b = 1; }
    else if (plano === 'final') { p = V(0, 2.2 + u * 0.12, 8.5 + u * 0.35); m = V(0, 1.2, 0); fov = 44; f = cab(rey, 1.3); b = 0.4; }
    else { p = V(-2.2 + u * 0.08, 1.7, 7.4 - u * 0.12); m = V(0, 1.1, 1.0); fov = 40; f = cab(rey, 1.4); b = 0.6; }
    S3.camera.position.copy(p); S3.camera.lookAt(m); if (Math.abs(S3.camera.fov - fov) > 0.02) { S3.camera.fov = fov; S3.camera.updateProjectionMatrix(); }
    S3.foco.copy(f); S3.bokeh = b;
  });
  setTimeout(() => { const n = $('.cine-negro', box); if (n) n.classList.add('fuera'); }, 120);
  setTimeout(() => {
    if (!sigue() || !box.isConnected) return;
    charla(GUION.intro_escuderia, () => { if (window.Sonido) Sonido.ambiente(false); document.querySelectorAll('body > .cine-saltar').forEach((x) => x.remove()); cb(); }, null, (L, i) => {
      habla = L.q; u = 0;
      plano = L.q === 'rey' ? 'rey' : i === 0 ? 'general' : 'final';
    });
  }, 1200);
}
function historiaNueva() {
  historiaBase(1 + Math.floor(Math.random() * 1e9));
  cineIntro(() => charla(GUION.rey_dinero, () => {
    yo().bolsa.oro = HT.oroInicial;
    pregunta(GUION.tutorial_pregunta, ['Sí, enseñame', 'No, ya sé'], (i) => {
      if (i === 0) { HS().tut = 1; charla(GUION.tutorial_subasta, () => hSubasta(true)); }
      else { hNormalizar(); hRellenar(); hGuardar(); charla(GUION.escuderia, irEscuderia, 'salon'); }
    });
  }));
}
// en la historia la pantalla principal es el mapa; desde ahí se entra al establo
function irEscuderia() { consejo(null); hNormalizar(); hAcomodar(); if (!HS().lugares.length) hRellenar(); hGuardar(); ir('mapa', {}); }

/* ---------- utilidades de tiers ---------- */
const pickDist = (d) => { const e = Object.entries(d); let x = G.rng() * e.reduce((a, [, v]) => a + v, 0); for (const [k, v] of e) { x -= v; if (x <= 0) return k; } return e[0][0]; };
const subirDist = (d, k) => { if (!k) return d; const o = {}; for (const [t, v] of Object.entries(d)) { const t2 = TIERS_ORD[Math.min(4, TIERS_ORD.indexOf(t) + k)]; o[t2] = (o[t2] || 0) + v; } return o; };
const distHTML = (d) => TIERS_ORD.filter((t) => d[t]).map((t) => `<span class="tier ${t}">${t}</span>&nbsp;${Math.round(d[t] * 100)}%`).join(' &nbsp;');
const tierDom = (d) => Object.entries(d).sort((a, b) => b[1] - a[1])[0][0];
const elegir = (l) => l[Math.floor(Math.random() * l.length)];
const RAZA_LABEL = (r) => (R.RAZAS[r] ? R.RAZAS[r].label : r);

/* ---------- estado de la historia (y arreglo de partidas guardadas viejas) ---------- */
function hNormalizar() {
  const H = HS(); if (!H) return;
  if (H.mapa) { delete H.mapa; }
  const def = { dia: 1, lugares: [], evUsados: 0, subPend: 2, espUsadas: {}, pdcHechas: 0, mazHechas: [], naldo: {}, sel: 0, maz: null };
  for (const k in def) if (H[k] === undefined) H[k] = JSON.parse(JSON.stringify(def[k]));
}

/* ---------- dónde queda cada cosa en el mapa ---------- */
// hay un mapa por cada coliseo de historia (10): cada uno en una ciudad del reino, con su paisaje
const regionK = () => Math.max(0, Math.min(9, (HS() && HS().nivel) || 0));
const regionAct = () => window.Mundo.REGIONES[regionK()];
const layoutAct = () => window.Mundo.regionLayout(regionK());
// un lugar libre del mapa actual para algo nuevo
function hSlotLibre() {
  const H = HS(), k = regionK(), ocupados = new Set(H.lugares.filter((l) => l.m === k).map((l) => l.s));
  const L = layoutAct().slots, libres = L.map((_, i) => i).filter((i) => !ocupados.has(i));
  const i = libres.length ? libres[Math.floor(G.rng() * libres.length)] : Math.floor(G.rng() * L.length);
  return { s: i, m: k, x: L[i][0], y: L[i][1] };
}
// lo que viene de una partida guardada con el mapa viejo: se acomoda en el mapa de ahora
function hAcomodar() {
  const H = HS(), k = regionK();
  for (const l of H.lugares) if (l.m !== k || l.s == null) { l.s = null; l.m = -1; }
  for (const l of H.lugares) if (l.m !== k) { Object.assign(l, hSlotLibre()); if (l.tipo !== 'mazmorra') l.ciudad = regionAct().nombre; }
}

/* ---------- lugares del mapa ---------- */
function hLugar(tipo, extra = {}) {
  const H = HS(), n = H.nivel, r = G.rng;
  const id = 'l' + H.dia + '_' + Math.floor(r() * 1e9);
  const base = { id, tipo, ciudad: regionAct().nombre, ...hSlotLibre(), desde: H.dia };
  if (tipo === 'subasta' || tipo === 'especial') {
    const E = tipo === 'especial' ? HI.especiales[extra.esp] : null;
    const bots = 2 + Math.floor(r() * 4);   // de 2 a 5 reyes más vos (decidido por Merlin)
    const base0 = Math.max(yo().bolsa.oro, HT.bolsaBots(n) * 0.5);
    const dif = pickDist({ facil: 0.3, medio: 0.35, dificil: 0.25, muy: 0.1 });
    const [f0, f1] = { facil: [0.45, 0.75], medio: [0.85, 1.2], dificil: [1.3, 1.9], muy: [2.1, 3] }[dif];
    const bolsas = Array.from({ length: bots }, () => Math.round(base0 * (f0 + r() * (f1 - f0)) * (0.85 + r() * 0.3)));
    const dist = subirDist(HI.tiersSubasta[Math.min(n, HI.tiersSubasta.length - 1)], E ? E.mejora : 0);
    return { ...base, bots, bolsas, dist, esp: extra.esp || null, ...(E ? { vence: H.dia + HI.diasTemporal } : {}) };
  }
  if (tipo === 'evento') return { ...base, vence: H.dia + HI.diasTemporal };
  if (tipo === 'cde') {
    const dist = HI.tiersCdh[Math.min(10, n + 1)], tier = HT.tierNivel[n], c = HT.cde[tier];
    const glads = Array.from({ length: c.bots }, () => Math.max(2, Math.min(8, c.glads + Math.floor(r() * 4) - 1)));   // no siempre 8: algunos ya tenían de antes
    return { ...base, tier, dist, bots: c.bots, glads, premio: HI.cde.premio[tier], vence: H.dia + 4 };
  }
  if (tipo === 'pdc') { const k = extra.k; return { ...base, k, dist: HI.tiersCdh[k], bots: HI.pdc.bots(k), premio: HI.pdc.premio(k) }; }
  if (tipo === 'mazmorra') { const k = extra.k, Mz = HI.mazmorras[k]; return { ...base, k, ciudad: Mz.nombre, jefe: Mz.jefe, dist: HI.tiersCdh[Math.min(10, Mz.despuesDe + 1)] }; }
  return base;
}
// el lugar del coliseo de historia que sigue (no ocupa lugar: siempre está)
function hCdh() {
  const H = HS(), k = H.nivel + 1; if (k > 10) return null;
  const [x, y] = layoutAct().cdh;
  return { id: 'cdh' + k, tipo: 'cdh', n: k, ciudad: regionAct().nombre, x, y, reyes: HI.reyesCdh[k].map((i) => HI.REYES[i]), dist: HI.tiersCdh[k], premio: HI.premioCdh[k] };
}
const lleno = () => HS().lugares.length >= HI.maxLugares;
function hAgregar(l) { if (lleno()) return false; HS().lugares.push(l); return true; }
// pasa un día: se vencen los temporales y aparecen cosas nuevas (nunca más de 6)
function hRellenar() {
  const H = HS(), r = G.rng, vencidos = [];
  H.lugares = H.lugares.filter((l) => { if (l.vence && l.vence < H.dia) { vencidos.push(l); return false; } return true; });
  // mazmorras: una después de cada coliseo de historia del 3 al 9; no se van nunca
  HI.mazmorras.forEach((Mz, k) => { if (H.nivel === Mz.despuesDe && !H.mazHechas.includes(k) && !H.lugares.some((l) => l.tipo === 'mazmorra' && l.k === k)) hAgregar(hLugar('mazmorra', { k })); });
  // la pelea de campeones que toca (son 10 en toda la historia)
  const kp = H.pdcHechas + 1;
  if (kp <= HI.pdc.total && H.nivel >= kp - 1 && !H.lugares.some((l) => l.tipo === 'pdc')) hAgregar(hLugar('pdc', { k: kp }));
  // subastas que trajo el último coliseo de historia
  while (H.subPend > 0 && !lleno()) { hAgregar(hLugar('subasta')); H.subPend--; }
  // siempre hay al menos un coliseo de entretenimiento
  const nCde = () => H.lugares.filter((l) => l.tipo === 'cde').length;
  if (!nCde()) hAgregar(hLugar('cde'));
  if (nCde() < 2 && r() < 0.35) hAgregar(hLugar('cde'));
  // eventos: aparecen al azar y no podés hacer más de 2 por coliseo de historia
  const evAbiertos = H.lugares.filter((l) => l.tipo === 'evento').length;
  if (H.evUsados + evAbiertos < HI.eventosPorCdh && r() < 0.4) hAgregar(hLugar('evento'));
  return vencidos;
}

/* ---------- textos y dibujos de cada lugar ---------- */
const difSubasta = (l) => { const prom = l.bolsas.reduce((a, b) => a + b, 0) / l.bolsas.length, k = prom / Math.max(1, yo().bolsa.oro); return HI.dificultad.find((d) => k <= d.hasta); };
const NODO = {
  diablo: { icon: '😈', titulo: () => 'El Diablo', desc: () => '' },
  cdh: { icon: '⚔️', titulo: (n) => `Coliseo de historia ${n.n}/10`, desc: (n) => `${n.reyes.length} reyes de otras ciudades, con 8 gladiadores cada uno: ${n.reyes.map((k) => `<b>${k.nombre}</b> de ${k.ciudad} (${RAZA_LABEL(k.raza).toLowerCase()})`).join(', ')}.<br>Tiers: ${distHTML(n.dist)}<br>${n.n === 10 ? 'La pelea final: tu libertad.' : `Recompensa ${n.premio} oro · trae 2 subastas nuevas.`} Antes de entrar pasás a ver a Naldo.` },
  cde: { icon: '🏟️', titulo: (n) => 'Coliseo de entretenimiento', tier: (n) => n.tier, desc: (n) => `${n.bots} reyes de las subastas, con ${n.glads.join(', ')} gladiadores.<br>Tiers: ${distHTML(n.dist)}<br>Recompensa ${n.premio} oro.` },
  pdc: { icon: '👑', titulo: (n) => `Pelea de campeones ${n.k}/10`, desc: (n) => `${n.bots} reyes mandan a su campeón a la torre. Nadie se rinde.<br>Tiers: ${distHTML(n.dist)}<br>Recompensa ${n.premio} oro.` },
  subasta: { icon: '⚖️', titulo: () => 'Subasta de esclavos', desc: (n) => { const d = difSubasta(n); return `${n.bots} reyes más vos · dificultad <b style="color:${d.color}">${d.label}</b> (traen ${Math.min(...n.bolsas)}–${Math.max(...n.bolsas)} oro; vos tenés ${yo().bolsa.oro})<br>Chances de cada tier: ${distHTML(n.dist)}<br>Cuando la usás, desaparece.`; } },
  especial: { icon: '💎', titulo: (n) => HI.especiales[n.esp].nombre, desc: (n) => { const d = difSubasta(n); return `Subasta especial: la ganaste por ${HI.especiales[n.esp].por}.<br>${n.bots} reyes más vos · dificultad <b style="color:${d.color}">${d.label}</b> (traen ${Math.min(...n.bolsas)}–${Math.max(...n.bolsas)} oro)<br>Chances de cada tier: ${distHTML(n.dist)}`; } },
  evento: { icon: '📜', titulo: () => 'Algo pasa en el pueblo', desc: () => `Puede ser muy bueno o muy malo. Eventos usados desde el último coliseo de historia: ${HS().evUsados}/${HI.eventosPorCdh}.` },
  mazmorra: { icon: '🕳️', titulo: (n) => `Mazmorra: ${HI.mazmorras[n.k].nombre}`, desc: (n) => { const J = R.JEFES[n.jefe]; return `3 oleadas sin piedad y al final <b>${J.nombre}, ${J.titulo}</b>. Si perdés, se muere todo el equipo que mandaste.<br>Tiers de las oleadas: ${distHTML(n.dist)}<br>Al jefe lo podés esclavizar${J.monstruo ? ' (los monstruos son inmortales)' : ''} o matarlo por ${J.oro} oro. No se va nunca: la podés hacer cuando quieras.`; } },
};
const restaDias = (l) => (l.vence ? l.vence - HS().dia + 1 : null);
// fotito sencilla de cada lugar (pixel art dibujado a mano en un canvas)
function fotoLugar(l) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 56; const x = c.getContext('2d');
  let s = [...String(l.id)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7); const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const f = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const noche = l.tipo === 'mazmorra' || l.tipo === 'pdc' || l.tipo === 'diablo';
  const cielo = x.createLinearGradient(0, 0, 0, 40); cielo.addColorStop(0, noche ? '#1a1830' : '#6aa0d0'); cielo.addColorStop(1, noche ? '#4a3050' : '#e8c890'); x.fillStyle = cielo; x.fillRect(0, 0, 96, 40);
  if (!noche) f('#f4e080', 70 + r() * 16, 6, 6, 6); else for (let i = 0; i < 12; i++) f('#e8e0c0', r() * 96, r() * 24, 1, 1);
  for (let i = 0; i < 4; i++) { const h = 6 + r() * 10, a = r() * 96; x.fillStyle = noche ? '#2a2038' : '#9aa890'; x.beginPath(); x.moveTo(a - 20, 40); x.lineTo(a, 40 - h); x.lineTo(a + 20, 40); x.fill(); }
  f(l.tipo === 'mazmorra' ? '#3a3028' : '#c8a868', 0, 40, 96, 16);
  for (let i = 0; i < 30; i++) f(l.tipo === 'mazmorra' ? '#2a2420' : '#b89858', r() * 96, 41 + r() * 15, 2, 1);
  const arcos = (cx, w, h, col, pisos) => { for (let p = 0; p < pisos; p++) { const y0 = 42 - (p + 1) * h; f(col, cx - w / 2, y0, w, h); for (let a = cx - w / 2 + 2; a < cx + w / 2 - 3; a += 5) f('#3a2a1a', a, y0 + 2, 3, h - 3); } };
  if (l.tipo === 'diablo') { const cl = x.createLinearGradient(0, 0, 0, 40); cl.addColorStop(0, '#2a0806'); cl.addColorStop(1, '#a8221a'); x.fillStyle = cl; x.fillRect(0, 0, 96, 40); arcos(48, 70, 8, '#4a3a34', 3); for (let i = 0; i < 9; i++) f(['#ff8a20', '#ffd040', '#ff4a20'][i % 3], 14 + i * 8, 14 - (i % 3) * 3, 3, 6 + (i % 2) * 3); f('#ffd000', 44, 26, 3, 2); f('#ffd000', 50, 26, 3, 2); }
  else if (l.tipo === 'cdh') { arcos(48, 70, 8, '#d8c0a0', 3); f('#c8a640', 46, 10, 2, 8); f('#a0302a', 48, 10, 8, 4); }
  else if (l.tipo === 'cde') { arcos(48, 50, 7, '#c8a888', 2); f('#2a6ad0', 40, 22, 2, 6); f('#e0b31c', 42, 22, 5, 3); }
  else if (l.tipo === 'pdc') { f('#8a7a6a', 40, 6, 16, 36); for (let y = 10; y < 40; y += 6) f('#f0c060', 46, y, 4, 3); f('#6a5a4a', 38, 4, 20, 4); }
  else if (l.tipo === 'subasta' || l.tipo === 'especial') {
    const lona = l.tipo === 'especial' ? '#8e44ad' : '#c0392b';
    for (const a of [10, 38, 66]) { f('#6a4a2a', a, 26, 20, 16); f(lona, a - 2, 22, 24, 5); f('#e8d8b0', a + 3, 30, 14, 8); }
    f('#4a3a2a', 30, 40, 22, 4); for (let a = 31; a < 52; a += 4) f('#2a1a0c', a, 30, 1, 10);
  } else if (l.tipo === 'evento') { for (const a of [8, 34, 62]) { f('#b8906a', a, 28, 22, 14); x.fillStyle = '#7a3a2a'; x.beginPath(); x.moveTo(a - 3, 28); x.lineTo(a + 11, 18); x.lineTo(a + 25, 28); x.fill(); f('#3a2a1a', a + 8, 34, 5, 8); } f('#f0e0b0', 42, 6, 12, 10); f('#3a2a1a', 47, 8, 2, 4); f('#3a2a1a', 47, 13, 2, 1); }
  else if (l.tipo === 'mazmorra') { x.fillStyle = '#5a4a3a'; x.beginPath(); x.moveTo(10, 44); x.lineTo(30, 10); x.lineTo(66, 8); x.lineTo(88, 44); x.fill(); x.fillStyle = '#0a0806'; x.beginPath(); x.ellipse(48, 40, 14, 16, 0, Math.PI, 0); x.fill(); f('#f08020', 28, 26, 3, 4); f('#f08020', 66, 26, 3, 4); f('#e8e0c8', 45, 30, 6, 5); f('#0a0806', 46, 32, 1, 1); f('#0a0806', 49, 32, 1, 1); }
  return c;
}

/* ---------- PANTALLA DEL MAPA: una maqueta 3D; un lugar por vez, con flechitas ---------- */
const TIPO_L = {
  diablo: { nombre: 'Pelea final', color: '#ff5a3a' },
  cdh: { nombre: 'Coliseo de historia', color: '#f0c24a' }, cde: { nombre: 'Coliseo de entretenimiento', color: '#e08a3a' }, pdc: { nombre: 'Pelea de campeones', color: '#ffd070' },
  subasta: { nombre: 'Subasta', color: '#8fd070' }, especial: { nombre: 'Subasta especial', color: '#d08af8' }, evento: { nombre: 'Evento', color: '#6ac8f0' }, mazmorra: { nombre: 'Mazmorra', color: '#f06a4a' },
};
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const tb = (t) => `<span class="tier ${t}">${t}</span>`;   // escudito del tier (la forma ya dice qué tier es)
// barra de chances por tier: cada tramo lleva su escudito y el porcentaje
const barraTiers = (d) => `<div class="mtiers">${TIERS_ORD.filter((t) => d[t]).map((t) => `<i class="seg ${t}" style="flex:${d[t]}">${d[t] >= 0.08 ? tb(t) : ''}${d[t] >= 0.16 ? `<b>${Math.round(d[t] * 100)}%</b>` : ''}</i>`).join('')}</div>`;
// lo que muestra la carta de cada lugar: nombre corto, datos sueltos, a quién le sirven los tiers y una línea de texto
function fichaLugar(l) {
  if (l.tipo === 'diablo') { const dato = (k, v, col) => `<span class="mdato"${col ? ` style="border-color:${col};color:${col}"` : ''}><em>${k}</em>${v}</span>`; return { corto: 'El Diablo', titulo: 'El ejército del Diablo', datos: [dato('Rivales', '24 resucitados', '#ff5a3a'), dato('Convocás', 'hasta 24'), dato('Después', 'baja él')], tiers: null, txt: 'Los últimos 24 que enfrentaste vuelven con los ojos rojos.' }; }
  const dato = (k, v, col) => `<span class="mdato"${col ? ` style="border-color:${col};color:${col}"` : ''}><em>${k}</em>${v}</span>`;
  if (l.tipo === 'cdh') return { corto: `${TIERS_ORD.filter((t) => l.dist[t]).map(tb).join('')}Coliseo ${ROMANOS[l.n - 1]}`, titulo: `Coliseo de historia ${l.n}/10`, tiersL: TIERS_ORD.filter((t) => l.dist[t]), datos: [dato('Rivales', `${l.reyes.length} reyes × 8`), l.n === 10 ? dato('Premio', 'tu libertad', '#f0c24a') : dato('Premio', `${l.premio} oro`, '#f0c24a'), ...(l.n < 10 ? [dato('Trae', '2 subastas')] : [])], tiers: ['Tiers de los rivales', l.dist], txt: `${l.reyes.map((k) => `<b>${k.nombre}</b> de ${k.ciudad} (${RAZA_LABEL(k.raza).toLowerCase()})`).join(' · ')}. Antes de entrar pasás a ver a Naldo.` };
  if (l.tipo === 'cde') return { corto: `${tb(l.tier)}Coliseo`, titulo: 'Coliseo de entretenimiento', tier: l.tier, datos: [dato('Rivales', `${l.bots} reyes`), dato('Gladiadores', l.glads.join(' · ')), dato('Premio', `${l.premio} oro`, '#f0c24a')], tiers: ['Tiers de los rivales', l.dist], txt: 'Pelean los reyes de las subastas, que ya tienen gladiadores de antes.' };
  if (l.tipo === 'pdc') return { corto: `Campeones ${ROMANOS[l.k - 1]}`, titulo: `Pelea de campeones ${l.k}/10`, datos: [dato('Rivales', `${l.bots} campeones`), dato('Premio', `${l.premio} oro`, '#f0c24a')], tiers: ['Tiers de los rivales', l.dist], txt: 'Cada rey manda a uno solo a la torre. Nadie se rinde.' };
  if (l.tipo === 'subasta' || l.tipo === 'especial') { const d = difSubasta(l), E = l.esp ? HI.especiales[l.esp] : null; return { corto: E ? 'Especial' : 'Subasta', titulo: E ? E.nombre : 'Subasta de esclavos', datos: [dato('Dificultad', d.label, d.color), dato('Reyes', `${l.bots} + vos`), dato('Traen', `${Math.min(...l.bolsas)}–${Math.max(...l.bolsas)} oro`)], tiers: ['Chances de cada tier', l.dist], txt: E ? `La ganaste por ${E.por}. Cuando la usás, desaparece.` : 'Cuando la usás, desaparece. Cada coliseo de historia ganado trae 2 nuevas.' }; }
  if (l.tipo === 'evento') return { corto: 'Evento', titulo: 'Algo pasa en el pueblo', datos: [dato('Usados', `${HS().evUsados}/${HI.eventosPorCdh}`)], txt: 'Puede ser muy bueno o muy malo. Solo 2 eventos entre coliseo de historia y coliseo de historia.' };
  const J = R.JEFES[l.jefe];
  return { corto: 'Mazmorra', titulo: HI.mazmorras[l.k].nombre, datos: [dato('Jefe', `${J.nombre}, ${J.titulo}`, '#f06a4a'), dato('Oleadas', '3 + jefe'), dato('Botín', `${J.oro} oro o esclavizarlo`, '#f0c24a')], tiers: ['Tiers de las oleadas', l.dist], txt: `Si perdés, se muere todo el equipo que mandaste. No se va nunca: la podés hacer cuando quieras${J.monstruo ? '. Los monstruos esclavizados son inmortales.' : '.'}` };
}
/* ---------- EL CHAMÁN: fusionar gladiadores y mejorarlo ---------- */
let chA = null, chB = null;
PANT.chaman = () => {
  const volver = () => { window.__fusionFx = null; mostrar(G.historia ? 'mapa' : 'preparacion', {}); };
  const box = pantalla('chaman', `<div class="lay panel chp" id="chp"></div><button class="lay mvol chvol" id="chVol" aria-label="Volver">◀<b>${G.historia ? 'Mapa' : 'Establo'}</b></button>`);
  const S3 = box.h.S, pnl = $('#chp', box);
  window.__fusionFx = (ok) => S3.fusion(ok);
  $('#chVol', box).onclick = volver;
  let parVisto = '';
  function pintar() {
    if (!pnl.isConnected) return;
    const e = yo(), oro = e.bolsa.oro, nv = e.chaman || 0, vs = P.vivos(e).filter(P.fusionable);
    if (!vs.some((g) => g.id === chA)) chA = null;
    const A = vs.find((g) => g.id === chA), pares = A ? vs.filter((x) => x !== A && x.tier === A.tier) : [];
    if (!pares.some((g) => g.id === chB)) chB = null;
    const B = pares.find((g) => g.id === chB), ch = A ? P.chanceFusion(e, A.tier) : 0, sig = A ? R.TIER_ORDEN[R.TIER_ORDEN.indexOf(A.tier) + 1] : '';
    const chip = (g, on, rol) => `<button class="chg ${on ? 'on' : ''}" data-r="${rol}" data-id="${g.id}"><span class="tier ${g.tier}">${g.tier}</span><b>${g.nombre}</b><small>${razaDe(g)}</small></button>`;
    const tabla = Object.keys(R.TIENDA.fusion.chance).map((t) => `<span><b>${t}→${R.TIER_ORDEN[R.TIER_ORDEN.indexOf(t) + 1]}</b>${Math.round(P.chanceFusion(e, t) * 100)}%</span>`).join('');
    const precio = R.TIENDA.fusion.precios[nv];
    pnl.innerHTML = `<div class="ch-head"><b>EL CHAMÁN</b><span class="mk-oro"><span class="mo oro"></span>${oro}</span><button class="mk-info" id="chI" aria-label="Qué hace">?</button></div>
      <div class="ch-sec"><small>1 · El que se queda</small><div class="chl">${vs.length ? vs.map((g) => chip(g, g.id === chA, 'a')).join('') : '<div class="fu-no">No tenés con quién</div>'}</div></div>
      ${A ? `<div class="ch-sec"><small>2 · El que se funde</small><div class="chl">${pares.length ? pares.map((g) => chip(g, g.id === chB, 'b')).join('') : `<div class="fu-no">No tenés otro ${tb(A.tier)}</div>`}</div></div>` : ''}
      ${A && B ? `<div class="ch-res"><span class="fu-p ${ch >= 0.8 ? 'alta' : ch >= 0.5 ? 'media' : 'baja'}">${Math.round(ch * 100)}% de chance</span><span>${tb(A.tier)} → ${tb(sig)}</span></div><button class="mk-buy fu-go" id="chGo">Fusionar</button>${ch >= 1 ? '' : '<div class="fu-ojo">Si sale mal, perdés los dos</div>'}` : ''}
      <div class="ch-sec ch-mej"><small>Mejorar al chamán</small><div class="ch-niv">${[0, 1, 2].map((k) => `<i class="${k < nv ? 'on' : ''}"></i>`).join('')}<span>Nivel ${nv}/3</span></div>
        <div class="ch-tab">${tabla}</div>
        ${precio != null ? `<button class="mk-sec" id="chMej" ${oro < precio ? 'disabled' : ''}>+20% a todo<span>${precio}<span class="mo oro"></span></span></button>` : '<div class="mk-ok">Al máximo</div>'}</div>`;
    pnl.querySelectorAll('.chg').forEach((b) => (b.onclick = () => { if (b.dataset.r === 'a') { chA = chA === b.dataset.id ? null : b.dataset.id; chB = null; } else chB = chB === b.dataset.id ? null : b.dataset.id; pintar(); }));
    if ($('#chGo', pnl)) $('#chGo', pnl).onclick = () => {
      if (ch >= 1) { const a = A.id, b = B.id; chB = null; act('fusionar', a, b); return; }   // 100%: sin preguntar
      const m = modal(`<div class="fu-res"><div class="fu-ic"></div><b>¿Fusionar?</b><p>${A.nombre} + ${B.nombre}</p><p>Chance: ${Math.round(ch * 100)}%</p><p class="fu-ojo">Si sale mal, perdés los dos.</p></div><div class="fu-bts"><button id="no">Cancelar</button><button class="prim" id="si">Fusionar</button></div>`);
      $('.fu-ic', m).appendChild(iconoMisc('fusion')); $('#no', m).onclick = () => m.remove();
      $('#si', m).onclick = () => { m.remove(); const a = A.id, b = B.id; chB = null; act('fusionar', a, b); };
    };
    if ($('#chMej', pnl)) $('#chMej', pnl).onclick = () => act('mejorarChaman');
    $('#chI', pnl).onclick = () => info('El chamán', ['Junta dos del mismo tier.', 'El primero sube un tier.', 'El segundo se funde en él.', 'Es gratis.', 'Si sale mal, perdés los dos.', 'Cada mejora: +20% a todo.', 'Mejoras: 100, 200 y 300 oro.']);
    const k = (A ? A.id : '') + '|' + (B ? B.id : '');
    if (k !== parVisto) { parVisto = k; S3.setPar(A && { spec: specDe(A, e.color), altura: A.altura }, B && { spec: specDe(B, e.color), altura: B.altura }); }
  }
  vista.refrescar = pintar; pintar();
};

/* ---------- LA SALA DEL CURANDERO (historia): 8 camas, 1 a 4 días, 5 oro por día ---------- */
const puedeCama = (g) => !g.jefe && !g.esbirro && !g.inmortal && !g.resucitado;
function diasCura(g) {
  const les = Object.values(g.lesiones || {}), mx = les.length ? Math.max(...les) : 0, tot = les.reduce((a, v) => a + v, 0), vida = (100 - (g.vida ?? 100)) / 100;
  const x = Math.max(mx, tot * 0.6, vida * 0.8);
  return Math.max(1, Math.min(R.TIENDA.curandero.diasMax, Math.ceil(x * 4)));
}
const necesitaCura = (g) => P.salud(g) !== 'Sano' || (g.vida ?? 100) < 100;
function internar(e, g) {
  const C = R.TIENDA.curandero;
  if (!G.historia) return 'Eso es del modo historia.';
  if (!puedeCama(g)) return 'Los monstruos no entran al curandero.';
  if (g.internado) return 'Ya está en una cama.';
  if (!necesitaCura(g)) return 'Está sano.';
  const usadas = new Set(P.vivos(e).filter((x) => x.internado).map((x) => x.cama));
  let cama = 0; while (usadas.has(cama) && cama < C.camas) cama++;
  if (cama >= C.camas) return 'No hay camas libres.';
  const dias = diasCura(g), precio = dias * C.oroDia;
  if (e.bolsa.oro < precio) return 'No te alcanza.';
  e.bolsa.oro -= precio; Object.assign(g, { internado: dias, internadoTotal: dias, cama, convocado: false });
  P.est(e).internados++;
  return 'ok';
}
function sacarCama(e, g) {
  if (!g.internado) return 'ok';
  const frac = (g.internadoTotal - g.internado) / g.internadoTotal;   // lo que ya se curó
  for (const k in g.lesiones) { g.lesiones[k] = +(g.lesiones[k] * (1 - frac)).toFixed(2); if (g.lesiones[k] < 0.05) g.lesiones[k] = 0; }
  g.vida = Math.round((g.vida ?? 100) + (100 - (g.vida ?? 100)) * frac);
  e.bolsa.oro += g.internado * R.TIENDA.curandero.oroDia;   // te devuelve los días que no usó
  delete g.internado; delete g.internadoTotal; delete g.cama; return 'ok';
}
// pasa un día: los internados se curan un día más; al terminar salen sanos
function diaCurandero() {
  const salen = [];
  for (const g of P.vivos(yo())) { if (!g.internado) continue; g.internado--; if (g.internado <= 0) { for (const k in g.lesiones) g.lesiones[k] = 0; g.vida = 100; delete g.internado; delete g.internadoTotal; delete g.cama; salen.push(g.nombre); } }
  return salen;
}
PANT.curandero = () => {
  const box = pantalla('curandero', `<div class="lay panel chp cup" id="cup"></div><button class="lay mvol chvol" id="cuVol" aria-label="Volver al mapa">◀<b>Mapa</b></button>`);
  const S3 = box.h.S, pnl = $('#cup', box), C = R.TIENDA.curandero;
  $('#cuVol', box).onclick = () => mostrar('mapa', {});
  function pintar() {
    if (!pnl.isConnected) return;
    const e = yo(), vs = P.vivos(e), en = vs.filter((g) => g.internado).sort((a, b) => a.cama - b.cama), cand = vs.filter((g) => !g.internado && necesitaCura(g)), oro = e.bolsa.oro;
    S3.setCamas(en.map((g) => ({ cama: g.cama, g: { spec: specDe(g, e.color), altura: g.altura, id: g.id } })));
    const salud = (g) => { const v = g.vida ?? 100; return `<span class="cu-v"><i style="width:${v}%;background:${v > 60 ? '#6fb35a' : v > 30 ? '#e0b31c' : '#d0402a'}"></i></span>`; };
    pnl.innerHTML = `<div class="ch-head"><b>EL CURANDERO</b><span class="mk-oro"><span class="mo oro"></span>${oro}</span><button class="mk-info" id="cuI" aria-label="Qué hace">?</button></div>
      <div class="ch-sec"><small>Camas ${en.length}/${C.camas}</small><div class="cul">${en.length ? en.map((g) => `<div class="cuf"><span class="tier ${g.tier}">${g.tier}</span><b>${g.nombre}</b><span class="cu-d">${g.internado} día${g.internado > 1 ? 's' : ''}</span><button class="mk-sec cu-s" data-id="${g.id}">Sacar</button></div>`).join('') : '<div class="fu-no">Las camas están vacías</div>'}</div></div>
      <div class="ch-sec"><small>Lastimados</small><div class="cul">${cand.length ? cand.map((g) => { const ok = puedeCama(g), d = diasCura(g); return `<div class="cuf ${ok ? '' : 'no'}"><span class="tier ${g.tier}">${g.tier}</span><b>${g.nombre}</b>${salud(g)}${ok ? `<button class="mk-buy cu-a" data-id="${g.id}" ${oro < d * C.oroDia || en.length >= C.camas ? 'disabled' : ''}>${d} día${d > 1 ? 's' : ''}<span>${d * C.oroDia}<span class="mo oro"></span></span></button>` : '<small class="cu-no">Monstruo: no entra</small>'}</div>`; }).join('') : '<div class="mk-ok">Todos están sanos</div>'}</div></div>`;
    pnl.querySelectorAll('.cu-a').forEach((b) => (b.onclick = () => act('internar', b.dataset.id)));
    pnl.querySelectorAll('.cu-s').forEach((b) => (b.onclick = () => {
      const g = vs.find((x) => x.id === b.dataset.id); if (!g) return;
      const m = modal(`<div class="fu-res"><b>¿Sacarlo de la cama?</b><p>${g.nombre} sale curado a medias.</p><p>Te devuelven ${g.internado * C.oroDia} oro.</p></div><div class="fu-bts"><button id="no">Cancelar</button><button class="prim" id="si">Sacar</button></div>`);
      $('#no', m).onclick = () => m.remove(); $('#si', m).onclick = () => { m.remove(); act('sacarCama', g.id); };
    }));
    $('#cuI', pnl).onclick = () => info('El curandero', ['Acostás a tus lastimados.', 'Se curan del todo.', 'Tardan de 1 a 4 días.', 'Depende de cuánto daño tengan.', `Cada día cuesta ${C.oroDia} oro.`, 'En la cama no pueden pelear.', 'Si lo sacás antes, sale a medias.', 'Los monstruos no entran.']);
  }
  vista.refrescar = pintar; pintar();
};
// el médico del multijugador: cura a todos los lastimados de una
function medicoMulti() {
  const ls = P.vivos(yo()).filter((g) => Object.values(g.lesiones).some((v) => v > 0) && !g.jefe), pr = R.TIENDA.curar.precio;
  const m = modal(`<div class="fu-res"><div class="fu-ic"></div><b>El médico</b>${ls.length ? `<p>${ls.length} lastimado${ls.length > 1 ? 's' : ''}</p><p>Les baja las lesiones a la mitad.</p><p>${pr} oro por cada uno.</p>` : '<p>Nadie está lastimado.</p>'}</div><div class="fu-bts"><button id="no">${ls.length ? 'Cancelar' : 'Ok'}</button>${ls.length ? `<button class="prim" id="si" ${yo().bolsa.oro < pr * ls.length ? 'disabled' : ''}>Curar a todos · ${pr * ls.length} oro</button>` : ''}</div>`);
  $('.fu-ic', m).appendChild(iconoMisc('cruz')); $('#no', m).onclick = () => m.remove();
  if ($('#si', m)) $('#si', m).onclick = () => { m.remove(); act('curarLastimados'); };
}

PANT.mapa = () => {
  window.Arena && window.Arena.salir();
  hNormalizar(); hAcomodar(); if (!HS().lugares.length) hRellenar();
  const H = HS(), nv = H.nivel;
  const cdh = hCdh() || (H.diabloPend ? { id: 'diablo', tipo: 'diablo', ciudad: 'Roma', x: layoutAct().cdh[0], y: layoutAct().cdh[1] } : null), lista = [...(cdh ? [cdh] : []), ...H.lugares];
  H.sel = Math.max(0, Math.min(H.sel || 0, lista.length - 1));
  root.innerHTML = '';
  const scr = h(`<div class="mapa3"><div class="m3d"></div><div class="mlabels"></div>
    <div class="mesq"><span class="mreg" title="Dónde estás">📍 ${regionAct().nombre}</span><span>${bolsaHTML(yo())}</span><span class="mprog" title="Coliseos de historia">${ROMANOS.map((_, i) => `<i class="${i < nv ? 'ok' : i === nv ? 'ya' : ''}"></i>`).join('')}</span></div>
    <button class="lay bajustes mapaj" id="bAj">⚙ AJUSTES</button>
    <button id="mCur" class="mvol mvol2 mcur" aria-label="Sala del curandero" title="Curandero"><span class="mvol-ic">✚</span>Curandero</button>
    <button id="mCham" class="mvol mvol2 mcham" aria-label="El chamán" title="Chamán"><span class="mvol-ic">🔮</span>Chamán</button>
    <button id="vol" class="mvol" aria-label="Ir al establo" title="Establo"><svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><path d="M4 22 L24 6 L44 22 V26 H40 V42 H8 V26 H4 Z" fill="#c9a26a" stroke="#1a110a" stroke-width="2.5" stroke-linejoin="round"/><path d="M4 22 L24 6 L44 22 V26 H4 Z" fill="#a3402a" stroke="#1a110a" stroke-width="2.5" stroke-linejoin="round"/><rect x="15" y="27" width="18" height="15" fill="#2a1a0c" stroke="#1a110a" stroke-width="2"/><path d="M19.5 27 V42 M24 27 V42 M28.5 27 V42" stroke="#8a8a86" stroke-width="2"/></svg><small>Escudería</small></button>
    <div class="mlado"><div class="mcuerpo"></div><div class="mnav"><button class="mflecha" id="ant" aria-label="Lugar anterior">◀</button><div class="mchips"></div><button class="mflecha" id="sig" aria-label="Lugar siguiente">▶</button></div></div></div>`);
  root.appendChild(scr);
  // al llegar a un mapa nuevo: te dice dónde estás
  if (H.mapaVisto !== regionK()) {
    H.mapaVisto = regionK(); hGuardar();
    const RG = regionAct(), cart = h(`<div class="mllegada"><small>Mapa ${ROMANOS[regionK()]}</small><b>${RG.nombre}</b><span>${RG.donde}</span></div>`);
    scr.appendChild(cart); const fuera = () => { cart.classList.add('va'); setTimeout(() => cart.remove(), 700); };
    cart.onclick = fuera; setTimeout(fuera, 3600);
  }
  const cont = $('.m3d', scr);
  const H3 = window.Mundo.montar(cont, 'mapa', { alto: 540, seed: G.seed, nivel: nv, region: regionK(), base: layoutAct().base, lugares: lista.map((l) => ({ tipo: l.tipo, x: l.x, y: l.y })),
    prota: { spec: { id: 'prota', raza: 'humano', color: '#6a5a44', piel: '#c8956a', arma: 'munon', escudo: 'ninguno', armadura: 'ninguna' }, altura: 1.75 } });
  const S3 = H3.S, fichas = lista.map(fichaLugar);
  // cartelitos sobre la maqueta: lugares, pueblos y los coliseos del camino
  const capa = $('.mlabels', scr);
  const carteles = [
    ...S3.puntos.map((p) => { const l = lista[p.idx], d = restaDias(l), e = h(`<button class="mcartel" style="--c:${TIPO_L[l.tipo].color}">${fichas[p.idx].corto}${d ? `<small class="${d <= 1 ? 'urge' : ''}">${d}d</small>` : ''}</button>`); e.onclick = () => elegirL(p.idx, true); return { e, pos: p.pos, idx: p.idx }; }),
    ...S3.hitos.map((q) => ({ e: h(`<span class="mhito ${q.hecho ? 'ok' : ''}">${ROMANOS[q.k - 1]}</span>`), pos: q.pos })),
  ];
  carteles.forEach((c) => capa.appendChild(c.e));
  H3.frames.push(() => carteles.forEach((c) => {
    const p = H3.proyectar(c.pos), fuera = p.z > 1 || p.x < -5 || p.x > 105 || p.y < 6 || p.y > 100;
    c.e.style.display = fuera ? 'none' : ''; if (fuera) return;
    c.e.style.left = p.x + '%'; c.e.style.top = p.y + '%';
  }));
  $('#bAj', scr).onclick = () => ajustes(true);
  // tirita de lugares: de un vistazo qué hay y cuánto le queda
  const chips = $('.mchips', scr);
  lista.forEach((l, i) => {
    const d = restaDias(l), c = h(`<button class="mchip" style="--c:${TIPO_L[l.tipo].color}" title="${fichas[i].titulo}" aria-label="${fichas[i].titulo}"><span class="mini"></span>${d && d <= 1 ? '<small class="urge">!</small>' : ''}</button>`);
    const f = fotoLugar(l); $('.mini', c).appendChild(f); c.onclick = () => elegirL(i, true); chips.appendChild(c);
  });
  const cuerpo = $('.mcuerpo', scr);
  let viajando = false;
  function elegirL(i, pasaNaldo) {
    if (viajando || !lista.length) return;
    H.sel = (i + lista.length) % lista.length; const l = lista[H.sel], F = fichas[H.sel], TL = TIPO_L[l.tipo];
    S3.elegir(H.sel);
    carteles.forEach((c) => c.idx != null && c.e.classList.toggle('sel', c.idx === H.sel));
    [...chips.children].forEach((c, k) => { c.classList.toggle('sel', k === H.sel); if (k === H.sel && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    const dias = restaDias(l);
    cuerpo.style.setProperty('--c', TL.color);
    cuerpo.innerHTML = `<div class="mpolaroid"><div class="mfoto"></div><div class="mtipo">${TL.nombre}</div><b class="mtit">${F.titulo}</b>${F.tier ? tb(F.tier) : F.tiersL ? `<span class="mtbs">${F.tiersL.map(tb).join('')}</span>` : ''}</div>
      <div class="mnota"><div class="mdonde">${l.tipo === 'mazmorra' ? 'Lejos de todo' : l.tipo === 'cdh' ? regionAct().nombre : l.ciudad}${dias ? ` · <span class="${dias <= 1 ? 'urge' : ''}">${dias === 1 ? 'último día' : `quedan ${dias} días`}</span>` : l.tipo === 'mazmorra' || l.tipo === 'cdh' ? ' · no se va' : ''}</div>
      <div class="mdatos">${F.datos.join('')}</div>
      ${F.tiers ? `<div class="mtl">${F.tiers[0]}</div>${barraTiers(F.tiers[1])}` : ''}
      <small>${F.txt}</small></div>
      <button class="mir" id="ir"><b>IR</b></button>`;
    $('.mfoto', cuerpo).appendChild(fotoLugar(l));
    $('#ir', cuerpo).onclick = () => {
      if (viajando) return;
      naldoCallar();
      const pelea = ['cde', 'pdc', 'cdh', 'mazmorra'].includes(l.tipo);
      if (pelea && !tieneEsclavos()) return hEntrarNodo(l);   // avisa que no hay con quién pelear
      viajando = true; scr.classList.add('viaje');
      if (window.Sonido && Sonido.pasos) Sonido.pasos();
      S3.viajar(H.sel, () => hEntrarNodo(l));
    };
  }
  $('#ant', scr).onclick = () => elegirL(H.sel - 1, true); $('#sig', scr).onclick = () => elegirL(H.sel + 1, true);
  const teclas = (ev) => { if (!scr.isConnected) return window.removeEventListener('keydown', teclas); if (document.querySelector('.nvelo')) return; if (ev.key === 'ArrowLeft') elegirL(H.sel - 1, true); if (ev.key === 'ArrowRight') elegirL(H.sel + 1, true); if (ev.key === 'Enter' && $('#ir', cuerpo)) $('#ir', cuerpo).click(); };
  window.addEventListener('keydown', teclas);
  // deslizar sobre la carta cambia de lugar
  let tx0 = null; const carta = $('.mlado', scr);
  carta.addEventListener('touchstart', (e) => { tx0 = e.touches[0].clientX; }, { passive: true });
  carta.addEventListener('touchend', (e) => { if (tx0 === null) return; const dx = e.changedTouches[0].clientX - tx0; tx0 = null; if (Math.abs(dx) > 60) elegirL(H.sel + (dx < 0 ? 1 : -1), true); });
  // sobre la maqueta: tocar un lugar lo elige, arrastrar gira un poco, rueda o pellizco acerca
  const ptrs = new Map(); let movido = 0, pinza = 0;
  cont.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); movido = 0; pinza = 0; });
  cont.addEventListener('pointermove', (e) => {
    const a = ptrs.get(e.pointerId); if (!a) return;
    if (ptrs.size >= 2) { a.x = e.clientX; a.y = e.clientY; const [p1, p2] = [...ptrs.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y); if (pinza) S3.zoom(pinza / d); pinza = d; movido = 99; return; }
    const dx = e.clientX - a.x; a.x = e.clientX; a.y = e.clientY; movido += Math.abs(dx); if (movido > 6) S3.girar(-dx * 0.004);
  });
  const soltar = (e) => {
    const a = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (a && movido <= 6) { const r = cont.getBoundingClientRect(), i = S3.picar(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); if (i >= 0) elegirL(i, true); }
  };
  cont.addEventListener('pointerup', soltar); cont.addEventListener('pointercancel', (e) => ptrs.delete(e.pointerId));
  cont.addEventListener('wheel', (e) => { e.preventDefault(); S3.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  const margen = () => { const r = scr.getBoundingClientRect(), l = $('.mlado', scr).getBoundingClientRect(); S3.margenDer = -l.width / Math.max(1, r.width); }; margen(); H3.onResize = margen;
  elegirL(H.sel);
  $('#vol', scr).onclick = () => { naldoCallar(); ir('preparacion', {}); };
  $('#mCham', scr).onclick = () => { naldoCallar(); mostrar('chaman', {}); };
  $('#mCur', scr).onclick = () => { naldoCallar(); mostrar('curandero', {}); };
  // Naldo explica el mapa la primera vez, y cada tipo de lugar nuevo
  if (!H.naldo.mapa) { H.naldo.mapa = 1; naldo(GUION.naldo.mapa); }
  else { const nuevo = lista.find((l) => !H.naldo['tipo_' + l.tipo] && GUION.naldo.tipos[l.tipo]); if (nuevo) { H.naldo['tipo_' + nuevo.tipo] = 1; naldo(GUION.naldo.tipos[nuevo.tipo]); }
    // de vez en cuando (una vez por día como mucho), Naldo tira algún comentario suelto
    else if (GUION.naldo.azar && H.naldo.azarDia !== H.dia && Math.random() < 0.3) setTimeout(() => { if (scr.isConnected && !document.querySelector('.naldo') && !H.naldoPend) { H.naldo.azarDia = H.dia; naldo([elegir(GUION.naldo.azar)]); } }, 900); }
};

/* ---------- NALDO: el rey que te puso de asesor, te habla desde un costado ---------- */
let NALDO3D = null;
function naldoCara(cv) {
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  if (window.Voxel && Voxel.modo3D() && window.THREE) {
    try {
      if (!NALDO3D) {
        const T = THREE, c = document.createElement('canvas'); c.width = c.height = 128;
        const ren = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: false }); ren.setPixelRatio(1); ren.setSize(128, 128, false);
        const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xfff4e0, 0x403020, 0.95)); const d = new T.DirectionalLight(0xffffff, 0.55); d.position.set(1, 2, 3); sc.add(d);
        const fig = Voxel.emperador((GUION.personajes.rey || {}).color || '#c8a640', 1.75, 'humano'); sc.add(fig);
        const cam = new T.PerspectiveCamera(26, 1, 0.05, 10); cam.position.set(0.08, 1.64, 0.95); cam.lookAt(0, 1.6, 0);
        NALDO3D = { ren, sc, cam, fig, c };
      }
      NALDO3D.ren.render(NALDO3D.sc, NALDO3D.cam);
      x.clearRect(0, 0, cv.width, cv.height); x.drawImage(NALDO3D.c, 0, 0, cv.width, cv.height); return;
    } catch (e) { NALDO3D = null; }
  }
  x.clearRect(0, 0, cv.width, cv.height); x.drawImage(retratoCharla('rey'), 0, 0, cv.width, cv.height);
}
function naldo(lineas, cb) {
  if (typeof lineas === 'string') lineas = [lineas];
  lineas = (lineas || []).map((l) => (Array.isArray(l) ? elegir(l) : l)).filter((l) => l && !String(l).startsWith('[MANU'));
  if (window.T) lineas = lineas.map((l) => T(String(l)));   // traducción
  document.querySelectorAll('.naldo').forEach((n) => { if (n._fin) n._fin(true); else n.remove(); });
  if (!lineas.length) return cb && cb();
  const nd = h(`<div class="naldo"><canvas width="96" height="96"></canvas><div class="ntxt"><b>Rey Naldo</b><div class="t" data-noi18n></div><span class="sig">▼</span></div></div>`);
  const velo = h('<div class="nvelo"></div>'); document.body.appendChild(velo); window.__lento = 0.2;   // lo de atrás se oscurece y va en cámara lenta hasta que termines de leer
  document.body.appendChild(nd);
  const cv = $('canvas', nd), tx = $('.t', nd);
  let i = -1, timer = null, escrito = true, vivo = true, ultBoca = 0;
  const loop = () => { if (!vivo) return; naldoCara(cv); requestAnimationFrame(loop); };
  const fin = (callado) => { vivo = false; clearInterval(timer); nd.remove(); velo.remove(); if (!document.querySelector('.naldo')) window.__lento = 1; if (!callado && cb) cb(); };
  nd._fin = fin; nd._sig = () => sig();
  const sig = () => {
    if (!escrito) { clearInterval(timer); escrito = true; tx.textContent = lineas[i]; return; }
    i++; if (i >= lineas.length) return fin();
    const L = lineas[i]; tx.textContent = ''; escrito = false; let k = 0;
    timer = setInterval(() => {
      if (k >= L.length) { clearInterval(timer); escrito = true; return; }
      const ch = L[k++]; tx.textContent += ch;
      if (/[a-záéíóúñ]/i.test(ch) && k % 2) { if (window.Sonido) Sonido.bip((GUION.personajes.rey || {}).tono || 120, ch); const t = performance.now(); if (NALDO3D && t - ultBoca > 130) { ultBoca = t; NALDO3D.fig.voxel.expresion('dolor', 0.09); } }
    }, 26);
  };
  nd.onclick = sig; velo.onclick = sig; sig(); loop();
}

// pasa a lo siguiente que Naldo iba a decir (o lo cierra, si era lo último); callar lo cierra del todo
function naldoPasar() { const n = document.querySelector('.naldo'); if (n && n._sig) { n._sig(); if (document.body.contains(n)) n._sig(); } }
function naldoCallar() { document.querySelectorAll('.naldo').forEach((n) => { if (n._fin) n._fin(true); else n.remove(); }); }

/* ---------- reyes rivales ---------- */
function hBot(i, oro, dist, glads, opt = {}) {
  const nombres = P.NOMBRES_BOT;
  const e = { id: i, nombre: opt.nombre || nombres[(i - 1 + HS().dia) % nombres.length], color: R.EQUIPOS[i].color, equipo: R.EQUIPOS[i].nombre, esJugador: false, bolsa: { oro }, puntos: 0, escuderia: [], caidos: [], ojeador: false, inspecciones: 0,
    plan: 'agresivo', formacion: 'linea', temple: 0.8 + G.rng() * 0.45, victorias: 0, logros: 0, perfil: opt.perfil || (i === 1 ? 'tonto' : 'astuto'), raza: opt.raza };
  for (let k = 0; k < (glads || 0); k++) {
    const raza = opt.raza && opt.raza !== 'ghoul' && G.rng() < 0.6 ? opt.raza : opt.raza === 'ghoul' && G.rng() < 0.4 ? 'ghoul' : undefined;   // los reyes prefieren a los de su raza
    const ES = opt.esbirro && R.ESBIRROS[opt.esbirro];   // en la mazmorra pelean los esbirros del monstruo
    const g = M.generarGladiador(G.rng, { tier: pickDist(dist), raza: ES ? ES.raza : raza }); g.dueno = i; g.orden = 'cercano'; if (opt.sinPiedad) g.sinPiedad = true;
    if (ES) { g.esbirro = opt.esbirro; if (ES.altura) g.altura = +(ES.altura * (0.95 + G.rng() * 0.1)).toFixed(2); if (ES.equipo) g.equipo = { ...ES.equipo }; if (ES.sinSangre) g.sinSangre = true; }
    e.escuderia.push(g);
  }
  return e;
}
function hConBots(n, f) { G.emperadores = [yo()]; for (let i = 1; i <= n; i++) G.emperadores.push(f(i)); }
const tieneEsclavos = () => P.vivos(yo()).some((g) => !g.internado && !(g.inmortal && (g.vida ?? 100) <= 0));   // los de la sala del curandero tampoco pueden pelear
// los monstruos tirados (vida 0) no pueden pelear hasta que los cures
function hMonstruosTirados() { const l = P.vivos(yo()).filter((g) => g.inmortal && (g.vida ?? 100) <= 0); for (const g of l) g.convocado = false; return l; }

/* ---------- entrar a un lugar (pasa un día) ---------- */
function hEntrarNodo(n) {
  const H = HS(); H.nodo = n; H.oro0 = yo().bolsa.oro; H.esclavos0 = P.vivos(yo()).length;
  const pelea = n.tipo === 'cde' || n.tipo === 'pdc' || n.tipo === 'cdh' || n.tipo === 'mazmorra' || n.tipo === 'diablo';
  if (pelea) { const t = hMonstruosTirados(); if (t.length) G.log.push(`${t.map((g) => g.nombre).join(', ')} está tirado: no puede pelear.`); }
  if (pelea && !tieneEsclavos()) { H.nodo = null; return alertar('No tenés esclavos que puedan pelear. Comprá en una subasta primero (o curá a tu monstruo, o esperá a que salgan del curandero).'); }
  if (pelea && !P.convocados(yo()).length) for (const g of P.vivos(yo()).filter((x) => !(x.inmortal && (x.vida ?? 100) <= 0)).slice(0, R.PELEA.maxPorEquipo)) g.convocado = true;
  if (n.tipo === 'subasta' || n.tipo === 'especial') return hSubasta(false, n);
  if (n.tipo === 'evento') return hEvento(n);
  if (n.tipo === 'diablo') return hDiablo();
  if (n.tipo === 'cde') { escenarioSig = 'cde'; hConBots(n.bots, (i) => hBot(i, 0, n.dist, n.glads[i - 1])); return entrarPelea(null, `🏟️ Coliseo de entretenimiento ${tb(n.tier)}`); }
  if (n.tipo === 'pdc' && !P.vivos(yo()).some((g) => !g.jefe)) { H.nodo = null; return alertar('A la pelea de campeones no se puede ir con monstruos, y no tenés a nadie más.'); }
  if (n.tipo === 'pdc') { hConBots(n.bots, (i) => hBot(i, 0, n.dist, 3)); return entrar('campeones'); }
  if (n.tipo === 'mazmorra') { H.maz = { k: n.k, ola: 0, id: n.id }; return charla([], () => naldo([GUION.naldo.mazmorra.antes], () => hOla()), 'salon'); }
  if (n.tipo === 'cdh') {
    // para entrar al coliseo de historia, Prota tiene que pasar sí o sí por Naldo
    const g = GUION.cdh[n.n] || {}, primera = !H.naldo.cdh;
    H.naldo.cdh = 1;
    // antes del último, la cinemática de Naldo y Prota (texto de Merlin)
    const lineas = n.n === 10 ? GUION.cdh10_final.map((l) => ({ ...l, t: l.t.replace('{dias}', H.dia === 1 ? 'un día' : `${H.dia} días`) })) : [...(primera ? GUION.naldo.cdh_primera : [elegir(GUION.naldo.cdh_antes)]), ...(g.antes || [])];
    if (n.n === 10) document.body.classList.add('cinebars');
    // la charla con Naldo antes del coliseo es una cinemática en el palacio (caminan por la nave, plano y contraplano)
    return charla(lineas.map((t) => (typeof t === 'string' ? { q: 'rey', t } : t)), () => {
      document.body.classList.remove('cinebars'); escenarioSig = 'cdh';
      hConBots(n.reyes.length, (i) => { const k = n.reyes[i - 1]; return hBot(i, 0, n.dist, HI.gladsCdh, { nombre: `${k.nombre} de ${k.ciudad}`, raza: k.raza }); });
      entrarPelea(null, `⚔️ Coliseo de historia ${n.n}/10`);
    }, 'salon');
  }
}
// subasta (la del tutorial tiene los lotes y la plata ya decididos, y nadie más puja)
function hSubasta(tut, n) {
  if (tut) G.emperadores = [yo()];
  else hConBots(n.bots, (i) => hBot(i, n.bolsas[i - 1], { D: 1 }, 0));
  const E = n && n.esp ? HI.especiales[n.esp] : null;
  const sub = P.crearSubasta(G, n ? { dist: n.dist, razas: E && E.razas, grandes: E && E.lotesGrandes } : {});
  if (tut) {
    const lotes = [[{ raza: 'goblin', tier: 'C' }, { raza: 'goblin', tier: 'C' }], [{ raza: 'orco', tier: 'C' }]];
    sub.carros = lotes.map((L) => {
      const lote = L.map((o) => { const g = M.generarGladiador(G.rng, o); const ks = R.STATS.map((s) => s.key); g.visibles = ks.slice(0, R.SUBASTA.statsVisibles); g.ocultasOjeador = ks.slice(2, 4); return g; });
      return { lote, pujas: G.emperadores.map(() => 0), lider: null, inspeccionadoPor: [] };
    });
  }
  HOST.sub = { carros: sub.carros, idx: -1, estado: 'llega', reloj: 0, t: 0, react: [], carro: null, pasaron: new Set(), ganador: null };
  ir('subasta', { carros: JSON.parse(JSON.stringify(sub.carros.map((c) => c.lote))) });
  subasta_iniciarHost();
  if (tut) consejo('Práctica: nadie más puja. En cada carro tocá <b>+5 oro</b> una vez antes de que se termine el reloj y te lo llevás.');
}

/* ---------- eventos del pueblo (base de Merlin/Claude; textos para que Manu corrija) ---------- */
function hNuevoEsclavo(raza, tier) { const g = M.generarGladiador(G.rng, { raza, tier }); g.dueno = 0; g.orden = 'cercano'; yo().escuderia.push(g); return g; }
const EVENTOS_FX = {
  fiesta: () => { yo().bolsa.oro += 30; return '+30 oro'; },
  apuestas: (i) => { if (i) return 'No apostaste.'; if (yo().bolsa.oro < 20) return 'No te alcanzaba para apostar.'; if (G.rng() < 0.5) { yo().bolsa.oro += 30; return '¡Ganaste! +30 oro'; } yo().bolsa.oro -= 20; return 'Perdiste 20 oro.'; },
  esqueletos: (i) => { if (i) return 'Seguiste de largo.'; if (yo().bolsa.oro < 40) return 'No te alcanzaba.'; yo().bolsa.oro -= 40; const g = hNuevoEsclavo('esqueleto', G.rng() < 0.3 ? 'B' : 'C'); return `-40 oro · ${g.nombre} (esqueleto ${g.tier}) se suma.`; },
  luna: (i) => { if (i) return 'Lo echaste.'; const g = hNuevoEsclavo('lobo', 'B'); if (G.rng() < 0.35) { const v = P.vivos(yo()).filter((x) => x !== g && !x.inmortal); if (v.length) { const m = v[Math.floor(G.rng() * v.length)]; m.vivo = false; yo().escuderia = yo().escuderia.filter((x) => x !== m); return `${g.nombre} se suma… pero esa noche se comió a ${m.nombre}.`; } } return `${g.nombre} se suma a tu escudería.`; },
  peste: () => { const v = P.vivos(yo()); for (const g of v) if (!g.inmortal) g.vida = Math.max(5, (g.vida ?? 100) - 25); return v.length ? 'Todos tus esclavos pierden 25% de vida.' : 'No tenías esclavos: te salvaste.'; },
  fuga: () => { const v = P.vivos(yo()).filter((g) => !g.inmortal).sort((a, b) => P.fuerzaG(a) - P.fuerzaG(b)); if (v.length < 2) return 'Nadie se pudo escapar.'; const g = v[Math.floor(G.rng() * (v.length - 1))]; yo().escuderia = yo().escuderia.filter((x) => x !== g); return `${g.nombre} se escapó.`; },
  herrero: () => { const v = P.vivos(yo()).filter((g) => g.equipo.armadura !== 'pesada'); if (!v.length) return 'Todos ya tenían la mejor armadura.'; const g = v[Math.floor(G.rng() * v.length)]; g.equipo.armadura = g.equipo.armadura === 'ninguna' ? 'ligera' : 'pesada'; return `${g.nombre} recibe una armadura ${R.ARMADURAS[g.equipo.armadura].label.toLowerCase()}.`; },
  entrenador: () => { const v = P.vivos(yo()); if (!v.length) return 'No tenías a quién entrenar.'; const out = []; for (let k = 0; k < Math.min(2, v.length); k++) { const g = v[Math.floor(G.rng() * v.length)], st = R.STATS[Math.floor(G.rng() * R.STATS.length)]; g.stats[st.key] = Math.min(99, g.stats[st.key] + 5); out.push(`${g.nombre} +5 ${st.label.toLowerCase()}`); } return out.join(' · '); },
  ladrones: () => { const q = Math.max(5, Math.round(yo().bolsa.oro * 0.15)); const p = Math.min(q, yo().bolsa.oro); yo().bolsa.oro -= p; return `Te robaron ${p} oro.`; },
  cementerio: () => { const g = hNuevoEsclavo('ghoul', 'B'); return `${g.nombre} (ghoul B) sale de la tumba y se suma.`; },
  curandera: () => { for (const g of P.vivos(yo()).filter((x) => !x.inmortal)) { g.vida = 100; for (const k in g.lesiones) g.lesiones[k] = 0; } return 'Todos tus esclavos al 100%.'; },
  desafio: (i) => { if (i) return 'No aceptaste.'; const v = P.vivos(yo()).filter((g) => !(g.inmortal && (g.vida ?? 100) <= 0)).sort((a, b) => P.fuerzaG(b) - P.fuerzaG(a)); if (!v.length) return 'No tenías a quién mandar.'; const g = v[0]; if (G.rng() < 0.65) { yo().bolsa.oro += 40; return `${g.nombre} ganó: +40 oro.`; } if (g.inmortal) { g.vida = 0; return `${g.nombre} perdió y quedó tirado.`; } yo().escuderia = yo().escuderia.filter((x) => x !== g); return `${g.nombre} perdió… y no se levantó más.`; },
  recluta: () => { const g = hNuevoEsclavo('goblin', 'D'); return `${g.nombre} (goblin D) se suma gratis. Algo es algo.`; },
};
function hEvento(n) {
  const H = HS(); H.evUsados++;
  const ids = Object.keys(EVENTOS_FX).filter((k) => GUION.eventos[k]);
  const id = ids[Math.floor(G.rng() * ids.length)], E = GUION.eventos[id];
  const terminar = (txt) => { const m = modal(`<div style="font:700 18px var(--fB);color:var(--gold)">${E.titulo}</div><div style="margin:8px 0 12px;font-size:15px">${txt}</div><button class="prim" id="ok">Volver al mapa</button>`); $('#ok', m).onclick = () => { m.remove(); hVolver(); }; };
  charla(E.lineas, () => {
    if (!E.opciones) return terminar(EVENTOS_FX[id](0));
    const m = modal(`<div style="font:700 18px var(--fB);color:var(--gold)">${E.titulo}</div><div class="ctrls" style="margin-top:10px">${E.opciones.map((o, i) => `<button class="${i ? '' : 'prim'}" data-i="${i}">${o}</button>`).join('')}</div>`);
    m.querySelectorAll('button').forEach((b) => { b.onclick = () => { m.remove(); terminar(EVENTOS_FX[id](+b.dataset.i)); }; });
  }, 'salon');
}

/* ---------- mazmorras: 3 oleadas sin piedad y el jefe ---------- */
function hJefe(key) {
  const J = R.JEFES[key];
  const g = M.generarGladiador(G.rng, { raza: J.base, tier: 'S' });
  for (const s of R.STATS) g.stats[s.key] = Math.min(99, 90 + Math.floor(G.rng() * 10));
  Object.assign(g, { jefe: key, nombre: J.nombre, altura: J.altura, peso: J.peso, aguanteJefe: J.aguante, fuerzaJefe: J.fuerza, honor: 10, rasgos: [], edad: 30 + Math.floor(G.rng() * 300) });
  g.equipo = { arma: J.arma, escudo: J.escudo, armadura: J.armadura };
  for (const k in g.lesiones) g.lesiones[k] = 0;
  return g;
}
function hOla() {
  const H = HS(), mz = H.maz, Mz = HI.mazmorras[mz.k], n = H.lugares.find((l) => l.id === mz.id) || hLugar('mazmorra', { k: mz.k });
  if (!tieneEsclavos()) { H.maz = null; return hVolver(); }
  if (!P.convocados(yo()).length) for (const g of P.vivos(yo()).filter((x) => !(x.inmortal && (x.vida ?? 100) <= 0)).slice(0, R.PELEA.maxPorEquipo)) g.convocado = true;
  if (mz.ola < 3) {
    escenarioSig = 'maz:' + Mz.jefe;
    hConBots(1, (i) => hBot(i, 0, n.dist, HI.oleadas[mz.ola], { nombre: Mz.nombre, sinPiedad: true, esbirro: Mz.jefe }));
    return entrarPelea(null, `🕳️ ${Mz.nombre} · oleada ${mz.ola + 1}/3`);
  }
  const J = R.JEFES[Mz.jefe];
  escenarioSig = 'maz:' + Mz.jefe;
  hConBots(1, (i) => { const e = hBot(i, 0, n.dist, 0, { nombre: `${J.nombre}, ${J.titulo}` }); const g = hJefe(Mz.jefe); g.dueno = i; g.orden = 'cercano'; e.escuderia.push(g); return e; });
  entrarPelea(null, `🕳️ ${Mz.nombre} · ${J.nombre}, ${J.titulo}`);
}
// después de cada oleada: seguir o volver otro día (la mazmorra no se va)
function hTrasOla(gano, s) {
  const H = HS(), mz = H.maz, Mz = HI.mazmorras[mz.k], J = R.JEFES[Mz.jefe];
  if (!gano) {
    // el monstruo no deja rendidos: se muere todo el equipo que mandaste
    const ids = new Set(HOST.cfg.equipos.find((q) => q.empId === YO).glads.map((gc) => gc.g.id));
    const muertos = [];
    for (const g of yo().escuderia) if (ids.has(g.id)) { if (g.inmortal) g.vida = 0; else if (g.vivo) { g.vivo = false; muertos.push(g.nombre); } else muertos.push(g.nombre); }
    H.maz = null;
    return ir('hres', { gano: false, premio: 0, caidos: [...new Set(muertos)], titulo: `${Mz.nombre}`, naldo: [GUION.naldo.mazmorra.perdio] });
  }
  if (mz.ola < 3) {
    mz.ola++;
    yo().escuderia = yo().escuderia.filter((g) => g.vivo);
    const m = modal(`<div style="font:700 18px var(--fB);color:var(--gold)">${Mz.nombre} · oleada ${mz.ola}/3 superada</div><div class="meta" style="margin:6px 0 10px">Te quedan ${P.vivos(yo()).length} esclavos. ${mz.ola === 3 ? `Lo que sigue es <b>${J.nombre}, ${J.titulo}</b>.` : 'Viene otra oleada.'} Si te vas, la mazmorra queda y podés volver otro día (empezás de nuevo).</div><div class="ctrls"><button class="prim" id="s">Seguir</button><button id="v">Irse</button></div>`);
    naldo([mz.ola === 3 ? GUION.naldo.mazmorra.jefe : GUION.naldo.mazmorra.oleada]);
    $('#s', m).onclick = () => { m.remove(); naldo([]); hOla(); };
    $('#v', m).onclick = () => { m.remove(); naldo([]); H.maz = null; hVolver(); };
    return;
  }
  // venciste al jefe: esclavizarlo o matarlo por oro
  H.maz = null; H.mazHechas.push(mz.k); H.lugares = H.lugares.filter((l) => l.id !== mz.id);
  const m = modal(`<div style="font:700 20px var(--fT);color:var(--gold)">¡Venciste a ${J.nombre}, ${J.titulo}!</div><div class="meta" style="margin:6px 0 10px">${J.monstruo ? 'Si lo esclavizás, es inmortal: si cae en combate queda tirado y se cura sacrificando esclavos.' : 'Si lo esclavizás, pelea para vos (es mortal).'} También lo podés vender después.</div><div class="ctrls"><button class="prim" id="e">⛓ Esclavizarlo</button><button id="k">🗡 Matarlo · +${J.oro} oro</button></div>`);
  naldo([GUION.naldo.mazmorra.gano]);
  $('#e', m).onclick = () => { m.remove(); const g = hJefe(Mz.jefe); g.dueno = 0; g.vida = 35; g.inmortal = !!J.monstruo; g.convocado = false; g.inspeccionado = true; yo().escuderia.push(g); hVolver(); };
  $('#k', m).onclick = () => { m.remove(); yo().bolsa.oro += J.oro; hVolver(); };
}

/* ---------- la pelea final: el ejército del Diablo y después él ---------- */
function hDiablo() {
  const H = HS();
  H.diablo = { fase: 1 }; H.diabloSnap = JSON.stringify({ e: yo().escuderia, oro: yo().bolsa.oro });   // para poder reintentar
  hConBots(1, (i) => {
    const e = hBot(i, 0, { S: 1 }, 0, { nombre: 'El Diablo' });
    const base = (H.vistos || []).slice(-24).map((g) => JSON.parse(JSON.stringify(g)));
    while (base.length < 24) base.push(M.generarGladiador(G.rng, { tier: G.rng() < 0.5 ? 'S' : 'A' }));
    base.forEach((g, k) => { Object.assign(g, { id: `res${k}_${H.dia}_${Math.floor(G.rng() * 1e6)}`, dueno: i, vivo: true, vida: 100, convocado: true, orden: 'cercano', resucitado: true, sinPiedad: true }); for (const z in g.lesiones) g.lesiones[z] = 0; delete g.protesis; e.escuderia.push(g); });
    return e;
  });
  escenarioSig = 'diablo';
  entrarPelea(null, '😈 El ejército del Diablo');
}
function hTrasDiablo(gano) {
  const H = HS();
  if (!gano) {
    H.diablo = null;
    const m = modal(`<div style="font:700 22px var(--fT);color:#e05a4a">El Diablo se sienta en tu trono</div><div class="meta" style="margin:8px 0 12px">Podés volver a intentarlo con el equipo que tenías antes.</div><div class="ctrls" style="justify-content:center"><button class="prim" id="r">Reintentar</button><button id="m">Volver al menú</button></div>`);
    $('#r', m).onclick = () => { m.remove(); const sn = JSON.parse(H.diabloSnap); yo().escuderia = sn.e; yo().bolsa.oro = sn.oro; G.emperadores = [yo()]; irEscuderia(); };
    $('#m', m).onclick = () => { m.remove(); const sn = JSON.parse(H.diabloSnap); yo().escuderia = sn.e; yo().bolsa.oro = sn.oro; G.emperadores = [yo()]; hGuardar(); menu(); };
    return;
  }
  yo().escuderia = yo().escuderia.filter((g) => g.vivo);
  if (H.diablo.fase === 1) {
    H.diablo.fase = 2;
    return charla(GUION.diablo.entra, () => {
      for (const g of P.vivos(yo())) g.convocado = !(g.inmortal && (g.vida ?? 100) <= 0);
      hConBots(1, (i) => { const e = hBot(i, 0, { S: 1 }, 0, { nombre: 'El Diablo' }); const g = hJefe('diablo'); g.dueno = i; g.orden = 'cercano'; e.escuderia.push(g); return e; });
      escenarioSig = 'diablo';
      entrarPelea(null, '😈 El Diablo');
    }, 'salon');
  }
  H.diablo = null; H.diabloHecho = true; H.diabloPend = false; G.emperadores = [yo()];
  P.est(yo()).ganoHistoria = 1; if (window.Logros) Logros.observar();   // logros: terminaste la historia (antes de borrar la partida)
  charla(GUION.diablo.gano, () => { hBorrar(); irFinalHistoria(); }, 'salon');
}

/* ---------- después de cada lugar del mapa ---------- */
function hVolver() {
  const H = HS(); consejo(null); hNormalizar();
  G.emperadores = [yo()];
  const pendiente = [];
  // los que murieron se van, los demás se recuperan un poco (los monstruos solo se curan con sacrificios)
  const vidaInm = new Map(yo().escuderia.filter((g) => g.inmortal).map((g) => [g, [g.vida ?? 100, { ...g.lesiones }]]));
  P.recuperar(G); yo().escuderia = yo().escuderia.filter((g) => g.vivo);
  for (const [g, [v, l]] of vidaInm) { g.vida = v; g.lesiones = l; }   // los monstruos no se curan solos: solo con sacrificios
  // tutorial: subasta → pelea → el rey vende todo y te deja con 120
  if (H.tut === 1) {
    H.tut = 2;
    for (const g of P.vivos(yo())) g.convocado = true;
    if (!tieneEsclavos()) for (let k = 0; k < 2; k++) { const g = M.generarGladiador(G.rng, { raza: 'goblin', tier: 'C' }); g.dueno = 0; g.orden = 'cercano'; yo().escuderia.push(g); }
    return charla(GUION.tutorial_pelea, () => { escenarioSig = 'cde'; hConBots(1, (i) => hBot(i, 0, { D: 1 }, 2)); G.emperadores[1].escuderia.forEach((g) => { g.raza = 'goblin'; }); consejo('Práctica: tus esclavos pelean solos. Tocá a uno para seguirlo con la cámara.'); entrarPelea(null, 'Pelea de práctica'); }, 'salon');
  }
  if (H.tut === 3) {
    H.tut = 0; yo().escuderia = []; yo().bolsa.oro = HT.oroInicial; H.lugares = []; hRellenar();
    return charla(GUION.tutorial_fin, () => charla(GUION.escuderia, irEscuderia), 'salon');
  }
  const n = H.nodo;
  // el lugar se usó: desaparece (menos la mazmorra, que se queda hasta que la ganes)
  if (n && n.tipo !== 'cdh' && n.tipo !== 'mazmorra') {
    H.lugares = H.lugares.filter((x) => x.id !== n.id);
    if (n.tipo === 'pdc') H.pdcHechas = Math.max(H.pdcHechas, n.k);
  }
  // comentario de Naldo después de la subasta
  if (n && (n.tipo === 'subasta' || n.tipo === 'especial')) {
    const compro = P.vivos(yo()).length - (H.esclavos0 || 0), gasto = (H.oro0 || 0) - yo().bolsa.oro, NS = GUION.naldo.subasta;
    H.naldoPend = [compro <= 0 ? NS.nada : gasto > (H.oro0 || 1) * 0.7 ? NS.caro : gasto < (H.oro0 || 1) * 0.3 ? NS.barato : NS.normal];
  }
  // pasa un día: se vence lo temporal y aparecen lugares nuevos
  if (n) {
    H.dia++;
    const salen = diaCurandero();
    if (salen.length) H.naldoPend = [...(H.naldoPend || []), `${salen.join(', ')} ${salen.length > 1 ? 'salieron' : 'salió'} curado${salen.length > 1 ? 's' : ''} de la sala del curandero.`];
    const vencidos = hRellenar();
    if (vencidos.length) H.naldoPend = [...(H.naldoPend || []), elegir(GUION.naldo.vencio).replace('{lugar}', vencidos.map((l) => NODO[l.tipo].titulo(l).toLowerCase()).join(', '))];
  }
  H.nodo = null;
  if (H.charla) { pendiente.push(...H.charla); H.charla = null; }
  // sin esclavos y sin plata para comprar: el rey presta una sola vez; la segunda, se pierde
  const quiebra = !P.vivos(yo()).length && yo().bolsa.oro < 5;
  const seguir = () => {
    if (H.libre && H.diabloHecho) { hBorrar(); return irFinalHistoria(); }
    if (H.libre && !H.diabloPend) { H.diabloPend = true; R.PELEA.maxPorEquipo = 24; hGuardar(); return charla(GUION.diablo.aparece, irEscuderia, 'salon'); }
    if (quiebra) {
      if (!H.prestamo) { H.prestamo = 1; return charla(GUION.prestamo, () => { yo().bolsa.oro += HT.oroInicial; irEscuderia(); }, 'salon'); }
      hBorrar(); return charla(GUION.derrota, () => { const m = modal(`<div style="font:700 22px var(--fT);color:#e05a4a">Fin de la historia</div><div class="meta" style="margin:8px 0 12px">Te quedaste sin esclavos y sin plata por segunda vez. Hay que empezar el modo historia de nuevo.</div><button class="prim" id="ok">Volver al menú</button>`); $('#ok', m).onclick = () => { m.remove(); menu(); }; }, 'salon');
    }
    // lo que Naldo tenía para decir se saca ANTES de guardar: si no, quedaba guardado y lo repetía después de otra cosa (ej. "compra decente" tras un coliseo)
    const l = H.naldoPend; H.naldoPend = null;
    irEscuderia();
    if (l) setTimeout(() => naldo(l), 300);
  };
  if (pendiente.length) return charla(pendiente, seguir, 'salon');
  seguir();
}
function hFinPelea(s) {
  const H = HS(), cfg = HOST.cfg, n = H.nodo;
  const vAntes = new Map(yo().escuderia.filter((g) => g.inmortal).map((g) => [g, g.vida ?? 100]));
  if (!H.tut && !H.diablo) {   // el Diablo resucita a los últimos 24 que enfrentaste (no monstruos)
    const vistos = cfg.equipos.filter((q) => q.empId !== YO).flatMap((q) => q.glads.map((gc) => gc.g)).filter((g) => !g.jefe && !g.esbirro && !g.resucitado);
    H.vistos = [...(H.vistos || []), ...vistos.map((g) => JSON.parse(JSON.stringify(g)))].slice(-24);
  }
  P.aplicarPelea(G, s, cfg, false);
  for (const [g, v] of vAntes) if (g.vivo) g.vida = Math.min(v, g.vida ?? v);   // pelear no los cura (aunque regeneren adentro de la pelea)
  // los monstruos son inmortales: si caen, quedan tirados (vida 0) en vez de morir
  for (const g of yo().escuderia) if (g.inmortal && !g.vivo) { g.vivo = true; g.vida = 0; yo().caidos = yo().caidos.filter((c) => c.nombre !== g.nombre); }
  const ti = cfg.equipos.findIndex((q) => q.empId === YO), gano = s.fin.ganador === ti, fe = s.fin.equipos && s.fin.equipos[ti];
  yo().bolsa.oro = H.oro0;   // en la historia el oro lo da la recompensa del lugar, no el reparto del pueblo
  if (H.diablo) return hTrasDiablo(gano);
  if (H.maz) return hTrasOla(gano, s);
  const caidos = yo().escuderia.filter((g) => !g.vivo).map((g) => g.nombre);
  let premio = 0, nuevas = [];
  if (H.tut === 2) { H.tut = 3; }
  else if (gano && n) {
    premio = n.premio || 0; yo().bolsa.oro += premio;
    if (n.tipo === 'cdh') {
      P.est(yo()).cdh++;
      H.nivel = n.n; H.charla = (GUION.cdh[n.n] || {}).despues || [];
      if (n.n < 10) H.lugares = [];   // mapa nuevo: lo que quedó sin usar en el anterior se pierde
      if (n.n >= 10) H.libre = true;
      else { H.evUsados = 0; H.espUsadas = {}; H.subPend += HI.subastasPorCdh; }
    }
  } else if (!gano && n && n.tipo === 'cdh') H.charla = GUION.cdh_perdido;
  // subastas especiales: por galardones o por cómo fuiste a pelear (una de cada tipo por coliseo de historia)
  if (n && !H.tut && cfg.modo !== 'campeones') {
    const conv = cfg.equipos[ti].glads.length, L = (fe && fe.logros) || [];
    const disparos = [];
    if (L.includes('Más sangre perdida')) disparos.push('sangre');
    if (L.includes('Más muertes')) disparos.push('muertes');
    if (L.includes('Más supervivientes')) disparos.push('vivos');
    if (conv >= 8) disparos.push('ocho');
    if (conv === 1) disparos.push('uno');
    for (const k of disparos) {
      if (H.espUsadas[k]) continue;
      H.espUsadas[k] = 1;
      if (hAgregar(hLugar('especial', { esp: k }))) nuevas.push(HI.especiales[k]); else nuevas.push({ ...HI.especiales[k], perdida: true });
      break;   // una por pelea
    }
  }
  const NP = GUION.naldo.pelea;
  const com = !n ? null : gano ? (caidos.length ? NP.gano_con_bajas : NP.gano_sin_bajas) : (P.vivos(yo()).length ? NP.perdio : NP.perdio_todo);
  const extra = nuevas.map((e) => (e.perdida ? elegir(GUION.naldo.sin_lugar).replace('{nombre}', e.nombre) : elegir(GUION.naldo.especial).replace('{nombre}', e.nombre).replace('{por}', e.por)));
  ir('hres', { gano, premio, caidos, titulo: n ? NODO[n.tipo].titulo(n) + (NODO[n.tipo].tier ? ' ' + tb(NODO[n.tipo].tier(n)) : '') : 'Pelea de práctica', naldo: com ? [elegir(com), ...extra] : extra });
}
PANT.hres = (d) => {
  const box = pantalla('salon', `<div class="lay panel" style="left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,92%);padding:16px 20px;text-align:center">
    <div class="meta">${d.titulo}</div>
    <div style="font:700 clamp(22px,3.4vw,38px) var(--fT);color:${d.gano ? 'var(--gold)' : '#e05a4a'}">${d.gano ? '¡Ganaste!' : 'Perdiste'}</div>
    ${d.premio ? `<div style="font-size:18px;margin:6px 0"><span class="mo oro"></span> +${d.premio} oro</div>` : ''}
    ${d.caidos.length ? `<div class="meta">Murieron: ${d.caidos.join(', ')}</div>` : '<div class="meta">No murió ninguno de tus esclavos.</div>'}
    <div class="ctrls" style="justify-content:center;margin-top:12px"><button class="prim" id="v">Volver al mapa</button></div></div>`);
  $('#v', box).onclick = () => { naldo([]); hVolver(); };
  if (d.naldo && d.naldo.length) setTimeout(() => naldo(d.naldo), 400);
};
function irFinalHistoria() {
  const box = pantalla('final', `<div class="lay" style="left:0;right:0;top:20%;text-align:center"><div class="big">LIBERTAD</div><div class="pix" style="color:#e0c890;margin-top:10px">Prota completó los 10 coliseos de historia y es libre para crear su propio reino.</div>
    <div class="ctrls" style="justify-content:center;margin-top:16px"><button class="prim" id="m">Volver al menú</button></div></div>`, { color: '#c8a640' });
  $('#m', box).onclick = menu;
}

window.COLISEO = {
  get G() { return G; }, get YO() { return YO; }, get vista() { return vista; }, menu,
  // atajos de prueba (solo en modo solo/anfitrión)
  nueva: (n) => { Red.modo = 'solo'; YO = 0; G = P.nueva(n); ir('tablero', {}); },
  _esc: (e) => { escenarioSig = e; }, entrarPelea, hBot, hConBots, charla,
  entrar: (f) => entrar(f), ir, act, historiaNueva, hEntrarNodo, hVolver, hTrasDiablo, hRellenar, hLugar, naldo, charla, get HS() { return HS(); },
};
const giro = h(`<div id="giro"><div>🔄</div><b>Girá el celular</b><span>Kingdom's Price se juega en horizontal</span></div>`);
document.body.appendChild(giro);
// las fuentes vienen adentro del juego: se cargan antes del menú (los carteles 3D las dibujan en lienzos)
Promise.race([Promise.all(['700 20px "Cinzel Decorative"', '900 20px "Cinzel Decorative"', '20px Almendra', '700 20px Almendra', 'italic 700 20px Almendra', '20px "Almendra SC"'].map((f) => (document.fonts ? document.fonts.load(f) : 0))), new Promise((r) => setTimeout(r, 2500))]).then(menu, menu);
})();
