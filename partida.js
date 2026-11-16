/* =====================================================================
   COLISEO · PARTIDA
   Estado de la partida y reglas entre peleas: economía, 30 casilleros,
   subastas, eventos, preparación, recompensas, recuperación y final.
   Sin interfaz: la UI llama a estas funciones.
   ===================================================================== */
(function (root) {
const R = root.REGLAS, M = root.Motor;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------- economía: solo oro (decidido por Merlin) ---------- */
const total = (b) => b.oro;
function pagar(b, monto) {
  monto = Math.round(monto);
  if (monto <= 0) return true;
  if (b.oro < monto) return false;
  b.oro -= monto; return true;
}
function cobrar(b, c) { b.oro += Math.round(c.oro || 0); }
function fmtMonto(m) { return `${Math.round(m)} oro`; }

/* ---------- partida ---------- */
const NOMBRES_EMP = ['Vos', 'Augusto', 'Calígula', 'Nerón', 'Adriano', 'Cómodo'];
const NOMBRES_BOT = ['Augusto', 'Calígula', 'Nerón', 'Adriano', 'Cómodo', 'Tiberio'];
// jugadores: [{ nombre, humano }] (sin lista = vos + bots)
/* ---------- números de la partida para logros y estadísticas (los anota el anfitrión; viajan con la partida) ---------- */
function est(e) {
  if (!e.est) e.est = { compras: 0, minCompra: null, maxCompra: 0, vendidos: 0, oroVentas: 0, monstruosVendidos: [], items: 0, armados: {}, nArmados: 0, insp: 0, ojos: 0,
    fusiones: 0, fusFail: 0, internados: 0, ejecutados: 0, perdonados: 0, muertes: 0, decap: 0, ganadas: 0, perdidas: 0, bajas: 0, sinBajas: 0, sinPiedad: 0,
    usoMonstruo: 0, torre: 0, cdh: 0, ganoHistoria: 0, ganoPartida: 0, jugadores: 0 };
  return e.est;
}
function nueva(n, seed, jugadores) {
  seed = seed || 1 + Math.floor(Math.random() * 1e9);
  const G = { seed, uid: seed + '-' + Date.now().toString(36), rng: M.mulberry32(seed), casillero: 1, emperadores: [], log: [], terminada: false, deudas: [] };
  jugadores = jugadores || Array.from({ length: n }, (_, i) => ({ nombre: i === 0 ? 'Vos' : NOMBRES_EMP[i], humano: i === 0 }));
  for (let i = 0; i < n; i++) {
    const j = jugadores[i];
    G.emperadores.push({
      id: i, nombre: j.nombre, color: R.EQUIPOS[i].color, equipo: R.EQUIPOS[i].nombre, esJugador: !!j.humano,
      bolsa: { ...R.ECONOMIA.inicial }, puntos: 0, escuderia: [], caidos: [], ojeador: false, inspecciones: 0,
      plan: 'agresivo', formacion: 'linea', temple: 0.8 + G.rng() * 0.45, victorias: 0, logros: 0,
    });
  }
  // personalidades de los bots: un tercio medio tontos (al menos uno si hay 2 o más), el resto astutos
  const bots = G.emperadores.filter((e) => !e.esJugador), nT = bots.length >= 2 ? Math.max(1, Math.round(bots.length / 3)) : 0;
  const orden = bots.map((e) => [G.rng(), e]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  orden.forEach((e, i) => { e.perfil = i < nT ? 'tonto' : 'astuto'; });
  return G;
}
const perfilDe = (emp) => R.BOTS.perfiles[emp.perfil || 'astuto'];
const fase = (G) => R.TABLERO[G.casillero - 1];
const esUltimaPelea = (G) => !R.TABLERO.slice(G.casillero).includes('pelea');
const ciclo = (G) => Math.floor((G.casillero - 1) / R.FASES.length) + 1;
function avanzar(G) {
  if (G.casillero >= R.CASILLEROS) { G.terminada = true; return false; }
  G.casillero++;
  for (const e of G.emperadores) for (const g of vivos(e)) g.vida = Math.min(100, (g.vida ?? 100) + R.VIDA.porCasillero);   // +10% por cada casillero
  return true;
}
const vivos = (e) => e.escuderia.filter((g) => g.vivo);

/* ---------- lo que se ve de un gladiador antes de comprarlo ---------- */
function salud(g) {
  const s = Object.values(g.lesiones).reduce((a, v) => a + v, 0), v = g.vida ?? 100;
  return s <= 0.01 && v >= 90 ? 'Sano' : s < 0.6 && v >= 45 ? 'Lastimado' : 'Muy herido';
}
function vista(G, emp, g, carro) {
  const out = { raza: g.raza, salud: salud(g), stats: {}, tier: null, completo: false };
  if (carro && carro.inspeccionadoPor && carro.inspeccionadoPor.includes(emp.id)) {
    for (const s of R.STATS) out.stats[s.key] = g.stats[s.key];
    out.tier = g.tier; out.completo = true; return out;
  }
  for (const k of g.visibles) out.stats[k] = g.stats[k];
  if (emp.ojeador) { for (const k of g.ocultasOjeador) out.stats[k] = g.stats[k]; out.tier = g.tier; }
  return out;
}

/* ---------- subasta ---------- */
function crearSubasta(G, opt = {}) {
  const r = G.rng, carros = [];
  const n = R.SUBASTA.carrosPorEmperador * G.emperadores.length;
  for (let i = 0; i < n; i++) {
    let lote;
    if (r() < R.SUBASTA.heridoProb) {   // doc §13: muy herido, extraordinario, de mucho potencial
      const g = M.generarGladiador(r, opt.dist ? { dist: opt.dist } : { mejorDe: 3 });
      const ks = Object.keys(g.lesiones); g.lesiones[ks[Math.floor(r() * ks.length)]] = 0.6 + r() * 0.3; g.lesiones[ks[Math.floor(r() * ks.length)]] += 0.3 + r() * 0.3;
      for (const k of ks) g.lesiones[k] = Math.min(1, g.lesiones[k]);
      g.edad = 18 + Math.floor(r() * 5); g.margen = 22 + Math.floor(r() * 8); g.potencial = 'Alto'; g.vida = 25 + Math.floor(r() * 25);
      lote = [g];
    } else {
      let raza;   // subastas especiales: algunas traen más de ciertas razas
      if (opt.razas) { const e = Object.entries(opt.razas); let x = r() * e.reduce((a, [, v]) => a + v, 0); for (const [k, v] of e) { x -= v; if (x <= 0) { raza = k; break; } } }
      lote = M.generarLote(r, { dist: opt.dist, raza, tamanio: opt.grandes ? 3 + Math.floor(r() * 2) : undefined });
    }
    for (const g of lote) {
      const keys = R.STATS.map((s) => s.key).sort(() => r() - 0.5);
      g.visibles = keys.slice(0, R.SUBASTA.statsVisibles);
      g.ocultasOjeador = keys.slice(R.SUBASTA.statsVisibles, R.SUBASTA.statsVisibles + R.SUBASTA.ojeadorStats);
    }
    carros.push({ lote, pujas: G.emperadores.map(() => 0), lider: null, inspeccionadoPor: [] });
  }
  return { carros, idx: 0 };
}
// cuánto vale un lote para un bot, con lo que ese bot puede ver
function valorBot(G, emp, carro) {
  const B = R.BOTS; let v = 0;
  for (const g of carro.lote) {
    const vis = vista(G, emp, g, carro);
    const vals = Object.values(vis.stats);
    let calidad = vals.reduce((a, x) => a + x, 0) / vals.length;
    if (vis.tier) calidad = 0.5 * calidad + 0.5 * R.TIERS[vis.tier].media;
    const sal = vis.salud === 'Sano' ? 1 : vis.salud === 'Lastimado' ? 0.75 : 0.5;   // la salud visible ya incluye la vida
    v += (B.valorBase[g.raza] || B.valorBase.humano) * (0.35 + calidad / 55) * sal;
  }
  const n = vivos(emp).length;
  const necesidad = n === 0 ? 1.45 : n < 3 ? 1.15 : n >= 6 ? 0.45 : 0.85;
  const turnos = 1 - 0.08 * (ciclo(G) - 1);   // al final de la partida el oro vale menos para invertir
  const PF = perfilDe(emp);
  let k = PF.valor * (1 - PF.ruido + G.rng() * 2 * PF.ruido);
  if (PF.antojo && G.rng() < PF.antojo) k *= 1.6;   // el tonto a veces se encapricha con cualquier cosa
  // el astuto mira la competencia: si nadie más tiene oro para pelearlo, no regala; si el lote es lo mejor que va a venir, se juega más
  if (emp.perfil !== 'tonto') {
    const otros = G.emperadores.filter((e) => e.id !== emp.id).map((e) => total(e.bolsa));
    if (Math.max(0, ...otros) < total(emp.bolsa) * 0.35) k *= 0.85;
    if (n < 4) k *= 1.1;
  }
  // el astuto se guarda una reserva para las próximas subastas (salvo que no tenga gladiadores)
  const reserva = emp.perfil === 'tonto' || n === 0 ? 0 : Math.min(total(emp.bolsa) * 0.5, R.ECONOMIA.inicial.oro * 0.22);
  return Math.max(0, Math.min(v * necesidad * emp.temple * turnos * k, total(emp.bolsa) * PF.tope, total(emp.bolsa) - reserva));
}
// puja válida: tirar monedas que suman `monto` (en oro) más a lo ya tirado
function pujar(G, carro, emp, monto) {
  const nueva = carro.pujas[emp.id] + monto;
  if (nueva > total(emp.bolsa)) return false;
  carro.pujas[emp.id] = nueva;
  const max = Math.max(...carro.pujas.filter((_, i) => i !== emp.id));
  if (nueva > max) carro.lider = emp.id;
  return true;
}
function maxPuja(carro) { return Math.max(0, ...carro.pujas); }
// se sube de a 1 o de a 5 (decidido por Merlin)
function incremento(m, r) { return m >= 12 && r() < 0.6 ? 5 : 1; }
// decisión del bot: ¿cuánto agrega ahora? (0 = no puja)
function botPuja(G, emp, carro, reloj = 10, humanos = []) {
  if (carro.lider === emp.id) return 0;
  if (carro.valor === undefined) carro.valor = {};
  if (carro.valor[emp.id] === undefined) carro.valor[emp.id] = valorBot(G, emp, carro);
  const PF = perfilDe(emp), mio = carro.pujas[emp.id], max = maxPuja(carro), bolsa = total(emp.bolsa);
  let valor = carro.valor[emp.id];
  if (PF.distraido && G.rng() < PF.distraido) return 0;                            // el tonto se distrae
  // el astuto le infla el precio a un humano que va ganando (aunque el lote no le importe tanto)
  if (PF.inflar && humanos.includes(carro.lider) && G.rng() < PF.inflar) valor = Math.max(valor, Math.min(bolsa * PF.tope, valor * 1.15 + 2));
  const necesito = max + 1 - mio;                                                   // lo que me falta tirar para pasar al que va ganando
  if (max + 1 > valor || max + 1 > bolsa) return 0;
  // el astuto acecha: si hay tiempo, espera al final para no calentar el precio
  if (PF.acecha && !mio && reloj > 3.5 && carro.lider !== null && max + 6 < valor && G.rng() < PF.acecha) return 0;   // acecha una sola vez por carro (si no, gotea de a 1 cada 4 s)
  // de a 5 si le falta mucho o si quiere asustar (el astuto salta fuerte cuando todavía le sobra margen)
  // de a 1 solo cuando ya está cerca de su tope; si le sobra margen, salta de a 5
  const salto = emp.perfil === 'tonto' ? (G.rng() < 0.5 ? 5 : 1) : (valor - max >= 6 ? 5 : 1);
  if (mio + salto > bolsa || (salto === 5 && mio + 5 > valor + (PF.inflar ? 2 : 0))) return mio + 1 <= bolsa ? 1 : 0;
  return salto;
}
const reaccionBot = (emp) => { const r = perfilDe(emp).reaccion; return r[0] + Math.random() * (r[1] - r[0]); };
function cerrarCarro(G, carro) {
  if (carro.lider === null) return null;
  const emp = G.emperadores[carro.lider], monto = carro.pujas[carro.lider];
  pagar(emp.bolsa, monto);
  { const E = est(emp); E.compras++; E.maxCompra = Math.max(E.maxCompra, monto); E.minCompra = E.minCompra == null ? monto : Math.min(E.minCompra, monto); }
  for (const g of carro.lote) { g.dueno = emp.id; g.orden = 'cercano'; g.inspeccionado = true; emp.escuderia.push(g); }   // al tenerlo ya sabés su honor y sus rasgos
  G.log.push(`${emp.nombre} compró ${carro.lote.length > 1 ? `un lote de ${carro.lote.length}` : carro.lote[0].nombre} por ${fmtMonto(monto)}.`);
  return { emp, monto };
}
// los bots usan su inspección en el lote que más les interesa (el primero grande que ven)
function botInspecciona(G, emp, carro) {
  if (emp.inspecciones > 0 && carro.lote.length >= 1 && G.rng() < perfilDe(emp).inspecciona * 0.5) { emp.inspecciones--; carro.inspeccionadoPor.push(emp.id); if (carro.valor) delete carro.valor[emp.id]; }
}

/* ---------- eventos (secretos) ---------- */
function sortearEventos(G) {
  const out = {};
  for (const e of G.emperadores) {
    const disp = R.EVENTOS.filter((ev) => !(ev.id === 'ojeador' && e.ojeador));
    let x = G.rng() * disp.reduce((a, ev) => a + ev.peso, 0), elegido = disp[0];
    for (const ev of disp) { x -= ev.peso; if (x <= 0) { elegido = ev; break; } }
    const inst = { ...elegido };
    if (inst.id === 'nigromante' || inst.id === 'luna' || inst.id === 'cementerio') { const g = M.generarGladiador(G.rng, { raza: inst.id === 'luna' ? 'lobo' : inst.id === 'cementerio' ? 'ghoul' : 'esqueleto', tier: G.rng() < 0.6 ? 'C' : 'B' }); const ks = R.STATS.map((s) => s.key).sort(() => G.rng() - 0.5); g.visibles = ks.slice(0, 2); g.ocultasOjeador = ks.slice(2, 4); inst.gladiador = g; }
    if (inst.id === 'callejero') { const g = M.generarGladiador(G.rng, { tier: G.rng() < 0.6 ? 'D' : 'C' }); const ks = R.STATS.map((s) => s.key).sort(() => G.rng() - 0.5); g.visibles = ks.slice(0, 2); g.ocultasOjeador = ks.slice(2, 4); inst.gladiador = g; }
    out[e.id] = inst;
  }
  return out;
}
const pickG = (G, arr) => arr[Math.floor(G.rng() * arr.length)];
// aplica un evento; acepta = true/false para los que tienen opciones. Devuelve el texto del resultado.
function resolverEvento(G, emp, ev, acepta) {
  const vs = vivos(emp), r = G.rng;
  const nombreStat = (k) => R.STATS.find((s) => s.key === k).label;
  switch (ev.id) {
    case 'ojeador':
      if (!acepta) return 'Lo dejaste ir.';
      if (!pagar(emp.bolsa, ev.costo)) return 'No te alcanzó el oro.';
      emp.ojeador = true; return 'Contrataste al ojeador: en las subastas vas a ver el tier y 2 stats más.';
    case 'mecenas': cobrar(emp.bolsa, { oro: 5 }); return '+5 oro.';
    case 'ladrones': { const m = Math.min(4, total(emp.bolsa)); pagar(emp.bolsa, m); return `Perdiste ${fmtMonto(m)}.`; }
    case 'medico': {
      const g = [...vs].sort((a, b) => sum(b.lesiones) - sum(a.lesiones))[0];
      if (!g || sum(g.lesiones) === 0) return 'Nadie de tu escudería estaba lastimado. El médico se fue con las manos vacías.';
      for (const k in g.lesiones) g.lesiones[k] = 0; return `${g.nombre} quedó sano.`;
    }
    case 'nigromante': case 'luna': case 'cementerio':
    case 'callejero':
      if (!acepta) return ev.id === 'cementerio' ? 'El enterrador se llevó al ghoul de vuelta a la tumba.' : ev.id === 'nigromante' ? 'El nigromante se fue con su esqueleto.' : ev.id === 'luna' ? 'El extraño se perdió en la noche.' : 'Lo dejaste en la calle.';
      if (!pagar(emp.bolsa, ev.costo)) return 'No te alcanzó el oro.';
      ev.gladiador.dueno = emp.id; ev.gladiador.orden = 'cercano'; emp.escuderia.push(ev.gladiador); return `${ev.gladiador.nombre} se une a tu escudería.`;
    case 'apuesta':
      if (!acepta) return 'No apostaste.';
      if (!pagar(emp.bolsa, ev.costo)) return 'No te alcanzó el oro.';
      if (r() < 0.5) { cobrar(emp.bolsa, { oro: 5 }); return '¡Ganaste! +5 oro.'; } return 'Perdiste los 2 oro.';
    case 'entrenador': {
      if (!acepta) return 'No le pagaste.';
      if (!vs.length) return 'No tenés gladiadores para entrenar.';
      if (!pagar(emp.bolsa, ev.costo)) return 'No te alcanzó el oro.';
      const g = pickG(G, vs), k = R.STATS[Math.floor(r() * 6)].key; g.stats[k] = Math.min(99, g.stats[k] + 4); return `${g.nombre} sube ${nombreStat(k)} a ${g.stats[k]}.`;
    }
    case 'herrero': {
      const g = vs.find((x) => x.equipo.armadura === 'ninguna' && x.raza !== 'gigante') || vs.find((x) => x.equipo.armadura === 'ninguna');
      if (!g) return 'Todos tus gladiadores ya tenían armadura. Le agradeciste igual.';
      g.equipo.armadura = 'ligera'; return `${g.nombre} recibe una armadura ligera.`;
    }
    case 'inspector': emp.inspecciones++; return 'En la próxima subasta vas a poder inspeccionar un lote.';
    case 'taberna': {
      if (!vs.length) return 'Por suerte todavía no tenías gladiadores.';
      const g = pickG(G, vs), k = pickG(G, ['eye', 'nose', 'rib', 'cheek']); g.lesiones[k] = Math.min(1, g.lesiones[k] + 0.25); return `${g.nombre}: ${M.INJ.label[k].toLowerCase()}.`;
    }
    case 'augures': {
      if (!vs.length) return 'Los presagios no encontraron a nadie en tu escudería.';
      const g = pickG(G, vs); g.stats.frialdad = Math.min(99, g.stats.frialdad + 5); return `${g.nombre} sube Frialdad a ${g.stats.frialdad}.`;
    }
    case 'prestamista':
      if (!acepta) return 'No aceptaste el préstamo.';
      cobrar(emp.bolsa, { oro: 10 }); G.deudas.push({ emp: emp.id, monto: 13 }); return '+10 oro. En la recuperación vas a devolver 13.';
  }
  return '';
}
const sum = (o) => Object.values(o).reduce((a, v) => a + v, 0);
function botAceptaEvento(G, emp, ev) {
  const b = total(emp.bolsa);
  switch (ev.id) {
    case 'ojeador': return b > 300 && G.rng() < 0.6;
    case 'callejero': return vivos(emp).length < 3 && b > 150;
    case 'nigromante': case 'luna': case 'cementerio': return b > 20 && G.rng() < 0.7;
    case 'apuesta': return G.rng() < 0.4 && b > 100;
    case 'entrenador': return vivos(emp).length > 0 && b > 100;
    case 'prestamista': return b < 80;
  }
  return false;
}

/* ---------- preparación (doc §12) ---------- */
const precioItem = (tipo, id) => (tipo === 'arma' ? R.ARMAS : tipo === 'escudo' ? R.ESCUDOS : R.ARMADURAS)[id].precio;
function comprarItem(G, emp, g, tipo, id) {
  if (tipo === 'arma' && R.ARMAS[id] && R.ARMAS[id].oculta) return 'Eso no se vende.';
  const W = R.ARMAS[tipo === 'arma' ? id : g.equipo.arma];
  if (tipo === 'escudo' && id !== 'ninguno' && (W.manos === 2 || W.sinEscudo)) return 'Con esa arma no puede llevar escudo.';
  if (tipo === 'armadura' && id === 'pesada' && g.raza === 'gigante') { /* permitido */ }
  if (g.equipo[tipo] === id) return 'Ya lo tiene.';
  if (!pagar(emp.bolsa, precioItem(tipo, id))) return 'No te alcanza.';
  g.equipo[tipo] = id;
  { const E = est(emp); E.items++; if (tipo === 'arma' || tipo === 'armadura') { const k = E.armados[g.id] || 0, b = tipo === 'arma' ? 1 : 2; if (!(k & b)) { E.armados[g.id] = k | b; if ((k | b) === 3) E.nArmados++; } } }
  if (tipo === 'arma' && (R.ARMAS[id].manos === 2 || R.ARMAS[id].sinEscudo)) g.equipo.escudo = 'ninguno';
  return 'ok';
}
function entrenar(G, emp, g, stat) {
  const T = R.TIENDA.entrenar;
  if (g.entrenoCiclo === ciclo(G)) return 'Ya entrenó en esta preparación.';
  if (!pagar(emp.bolsa, T.precio)) return 'No te alcanza.';
  g.entrenoCiclo = ciclo(G);
  if (g.margen <= 0) return `${g.nombre} ya está en su techo: no mejora.`;
  const s = Math.min(T.suma, g.margen); g.stats[stat] = Math.min(99, g.stats[stat] + s); g.margen -= s;
  if (g.margen <= 0) g.potencial = 'En su techo';
  return 'ok';
}
function curar(G, emp, g) {
  if (sum(g.lesiones) <= 0) return 'Está sano.';
  if (!pagar(emp.bolsa, R.TIENDA.curar.precio)) return 'No te alcanza.';
  for (const k in g.lesiones) { g.lesiones[k] = +(g.lesiones[k] * (1 - R.TIENDA.curar.reduce)).toFixed(2); if (g.lesiones[k] < 0.05) g.lesiones[k] = 0; }   // lo que queda chiquito se cura del todo
  return 'ok';
}
function inspeccionar(G, emp, g) {
  if (g.inspeccionado) return 'Ya lo inspeccionaste.';
  if (!pagar(emp.bolsa, R.TIENDA.inspector.precio)) return 'No te alcanza.';
  g.inspeccionado = true; est(emp).insp++; return 'ok';
}
// fusión chamánica: a y b del mismo tier. Sale bien → a sube un tier (stats nuevas del tier, nunca peores) y b se va. Sale mal → se van los dos
// el chamán (decidido por Merlin): cada mejora suma 20 puntos a todas las chances; mejoras de 100, 200 y 300 oro
const chanceFusion = (emp, tier) => Math.min(1, (R.TIENDA.fusion.chance[tier] || 0) + R.TIENDA.fusion.mejora * (emp.chaman || 0));
function mejorarChaman(G, emp) {
  const n = emp.chaman || 0, precio = R.TIENDA.fusion.precios[n];
  if (precio == null) return 'El chamán ya está al máximo.';
  if (!pagar(emp.bolsa, precio)) return 'No te alcanza.';
  emp.chaman = n + 1; return 'ok';
}
// el médico del multijugador: cura a todos los lastimados de una (cobra por cada uno; a los sanos no los toca)
function curarLastimados(G, emp) {
  const ls = vivos(emp).filter((g) => sum(g.lesiones) > 0 && !g.jefe);
  if (!ls.length) return 'Nadie está lastimado.';
  if (!pagar(emp.bolsa, R.TIENDA.curar.precio * ls.length)) return 'No te alcanza.';
  for (const g of ls) for (const k in g.lesiones) { g.lesiones[k] = +(g.lesiones[k] * (1 - R.TIENDA.curar.reduce)).toFixed(2); if (g.lesiones[k] < 0.05) g.lesiones[k] = 0; }
  return 'ok';
}
function fusionable(g) { return g && g.vivo && !g.internado && !g.jefe && !g.esbirro && !g.inmortal && !g.resucitado && R.TIENDA.fusion.chance[g.tier] !== undefined; }
function fusionar(G, emp, a, b) {
  if (!fusionable(a) || !fusionable(b) || a === b || a.tier !== b.tier) return 'No se pueden fusionar.';
  if (!emp.escuderia.includes(a) || !emp.escuderia.includes(b)) return 'No están en tu escudería.';
  const sale = G.rng() < chanceFusion(emp, a.tier);
  const quitar = (g) => { const i = emp.escuderia.indexOf(g); if (i >= 0) emp.escuderia.splice(i, 1); };
  quitar(b);
  if (!sale) { est(emp).fusFail++; quitar(a); G.log.push(`${emp.nombre} perdió a ${a.nombre} y ${b.nombre} en una fusión chamánica.`); return { ok: false, a: a.nombre, b: b.nombre }; }
  const sig = R.TIER_ORDEN[R.TIER_ORDEN.indexOf(a.tier) + 1];
  const nuevo = M.generarGladiador(G.rng, { tier: sig, raza: R.RAZAS[a.raza] ? a.raza : 'humano' });
  for (const s of R.STATS) a.stats[s.key] = Math.max(a.stats[s.key], nuevo.stats[s.key]);
  const antes = a.tier; a.tier = sig; est(emp).fusiones++;
  G.log.push(`${emp.nombre} fusionó a ${a.nombre} con ${b.nombre}: ahora es tier ${sig}.`);
  return { ok: true, a: a.nombre, b: b.nombre, de: antes, a2: sig };
}
function botPreparacion(G, emp) {
  const r = G.rng, plan = Object.keys(M.PLANES);
  emp.plan = r() < 0.3 ? plan[Math.floor(r() * plan.length)] : emp.plan;
  emp.formacion = ['linea', 'cunia', 'columna', 'circulo'][Math.floor(r() * 4)];
  let presupuesto = total(emp.bolsa) * 0.3;
  const gastar = (m) => { if (m > presupuesto) return false; presupuesto -= m; return true; };
  for (const g of vivos(emp)) {
    if (sum(g.lesiones) > 0.3 && gastar(R.TIENDA.curar.precio)) curar(G, emp, g);
    if (g.equipo.armadura === 'ninguna' && gastar(precioItem('armadura', 'ligera'))) comprarItem(G, emp, g, 'armadura', 'ligera');
    g.orden = r() < 0.2 ? 'vulnerables' : 'cercano';
  }
}

/* ---------- pelea ---------- */
// fuerza estimada (para ordenar a quién convocar por defecto)
const fuerzaG = (g) => Object.values(g.stats).reduce((a, v) => a + v, 0) * (1 - 0.5 * Math.min(1, sum(g.lesiones))) * (0.3 + 0.7 * (g.vida ?? 100) / 100);
// los convocados: los que el emperador marcó (si siguen vivos); si faltan, completa con los mejores
function convocados(e) {
  const max = R.PELEA.maxPorEquipo, vs = vivos(e).filter((g) => !g.internado);   // los que están en la sala del curandero no pelean
  const marc = vs.filter((g) => g.convocado);
  // los que nunca se tocaron (convocado undefined) completan los lugares; los desconvocados a mano (false) quedan afuera
  const resto = vs.filter((g) => g.convocado === undefined).sort((a, b) => fuerzaG(b) - fuerzaG(a));
  const l = [...marc.slice(0, max), ...resto].slice(0, max);
  if (l.length) return l;
  // nadie quedó convocado (murieron los convocados y el resto estaba en reserva): pelean los mejores que estén en condiciones
  return vs.filter((g) => !(g.inmortal && (g.vida ?? 100) <= 0)).sort((a, b) => fuerzaG(b) - fuerzaG(a)).slice(0, max);
}
// pelea de campeones: cada emperador manda a uno solo (el que eligió; los bots, al más fuerte)
const mejorDe = (e) => [...vivos(e)].sort((a, b) => fuerzaG(b) - fuerzaG(a))[0] || null;
function armarCampeones(G, eleccion) {
  const equipos = [];
  for (const e of G.emperadores) {
    const g = vivos(e).find((x) => x.id === eleccion[e.id]) || mejorDe(e);
    if (!g) continue;
    equipos.push({ empId: e.id, riqueza: total(e.bolsa), nombre: e.nombre, color: e.color, esJugador: e.esJugador, plan: 'agresivo', formacion: 'linea', glads: [{ g, orden: 'cercano', protege: 0 }] });
  }
  return { seed: Math.floor(G.rng() * 1e9), modo: 'campeones', equipos };
}
function armarPelea(G, soloIds) {
  const regalos = [];
  const emps = G.emperadores.filter((e) => !soloIds || soloIds.includes(e.id));
  for (const e of emps) if (!convocados(e).length) {   // decidido: si no tiene gladiadores (que puedan pelear), recibe uno gratis
    const g = M.generarGladiador(G.rng, { tier: R.GRATIS.tier }); g.dueno = e.id; g.orden = 'cercano'; g.regalo = true;
    e.escuderia.push(g); regalos.push({ emp: e, g });
  }
  for (const e of emps) e.convocados = convocados(e);
  const cfg = {
    seed: Math.floor(G.rng() * 1e9),
    equipos: emps.map((e) => ({
      empId: e.id, riqueza: total(e.bolsa), nombre: e.nombre, color: e.color, esJugador: e.esJugador, plan: e.plan, formacion: e.formacion,
      glads: e.convocados.map((g, i) => ({ g, orden: g.orden || 'cercano', protege: g.protegeIdx ?? (i === 0 ? 1 : 0) })),
    })),
    ultima: !soloIds && esUltimaPelea(G),   // la última pelea da 6 puntos al ganador
  };
  return { cfg, regalos };
}
// aplica el resultado de la pelea a la partida: récord, lesiones, muertes, oro, plata, puntos
function aplicarPelea(G, s, cfg, esFinal) {
  M.aplicarResultado(s);
  const res = [];
  s.fin.equipos.forEach((fe, i) => {
    const e = G.emperadores[cfg.equipos[i].empId];
    if (!esFinal) {
      cobrar(e.bolsa, { oro: fe.oro });
      e.puntos += fe.puntos; e.logros += fe.logros.length; if (s.fin.ganador === i) e.victorias++;
    }
    res.push({ e, ...fe });
    // números de esta pelea para las estadísticas de cada emperador
    const E = est(e), mios = s.fighters.filter((f) => f.team === i), sum = (k) => mios.reduce((a, f) => a + (f.st[k] || 0), 0);
    const gano = s.fin.ganador === i, bajas = mios.filter((f) => f.estado === 'muerto').length, rem = sum('remates'), per = s.fighters.filter((v) => v.team !== i && (v.perdonadoPor || []).some((id) => s.fighters[id] && s.fighters[id].team === i)).length;   // caídos perdonados por los tuyos (cada uno una vez)
    E.ejecutados += rem; E.perdonados += per; E.muertes += sum('muertes'); E.decap += sum('decap'); E.bajas += bajas;
    if (gano) E.ganadas++; else E.perdidas++;
    if (gano && !bajas) E.sinBajas++;
    if (gano && rem >= 3 && !per) E.sinPiedad++;
    if (gano && cfg.modo === 'campeones') E.torre++;
    if (mios.some((f) => f.g && (f.g.inmortal || (f.g.jefe && f.g.dueno === e.id)))) E.usoMonstruo = 1;
  });
  for (const e of G.emperadores) {
    const muertos = e.escuderia.filter((g) => !g.vivo);
    e.caidos.push(...muertos.map((g) => ({ nombre: g.nombre, raza: g.raza, ciclo: ciclo(G) })));
  }
  return res;
}

/* ---------- recuperación ---------- */
function recuperar(G) {
  const lineas = [];
  for (const e of G.emperadores) {
    const muertos = e.escuderia.filter((g) => !g.vivo);
    if (muertos.length) lineas.push({ e, txt: `despide a ${muertos.map((g) => g.nombre).join(', ')}.` });
    e.escuderia = e.escuderia.filter((g) => g.vivo);
    for (const g of e.escuderia) {
      const v0 = g.vida ?? 100; g.vida = Math.min(100, v0 + R.VIDA.recuperacion);
      if (e.esJugador && v0 < 100) lineas.push({ e, txt: `${g.nombre}: vida ${v0}% → ${g.vida}%.` });
      const antes = sum(g.lesiones);
      for (const k in g.lesiones) { g.lesiones[k] = +(g.lesiones[k] * (1 - R.RECUPERACION.curaNatural)).toFixed(2); if (g.lesiones[k] < 0.05) g.lesiones[k] = 0; }
      if (antes > 0 && e.esJugador) lineas.push({ e, txt: `${g.nombre}: las lesiones bajan (${salud(g).toLowerCase()}).` });
    }
  }
  for (const d of G.deudas.splice(0)) {
    const e = G.emperadores[d.emp];
    const paga = Math.min(d.monto, total(e.bolsa)); pagar(e.bolsa, paga);
    lineas.push({ e, txt: `le devuelve ${fmtMonto(paga)} al prestamista.` });
  }
  return lineas;
}

// 10 oro: todos al 100% (vida y lesiones) — decidido por Merlin
function curarTodo(G, emp) {
  if (!vivos(emp).length) return 'No tenés gladiadores.';
  if (!pagar(emp.bolsa, R.VIDA.curaTotalOro)) return 'No te alcanza.';
  for (const g of vivos(emp)) { g.vida = 100; for (const k in g.lesiones) g.lesiones[k] = 0; }
  return 'ok';
}
function botRecuperacion(G, emp) {
  const vs = vivos(emp); if (!vs.length) return false;
  const prom = vs.reduce((a, g) => a + (g.vida ?? 100), 0) / vs.length;
  if (prom < 60 && total(emp.bolsa) > 25) return curarTodo(G, emp) === 'ok';
  return false;
}

/* ---------- venta de gladiadores ---------- */
function precioVenta(g) {
  const V = R.VENTA, prom = Object.values(g.stats).reduce((a, v) => a + v, 0) / R.STATS.length;
  const k = clamp((prom - V.promMin) / (V.promMax - V.promMin), 0, 1);
  const prot = Object.keys(g.protesis || {}).length;   // cada prótesis le baja el precio
  return Math.max(V.minOro, Math.round((V.minOro + k * (V.maxOro - V.minOro)) * (1 - R.CUERPO.ventaProtesis * prot)));   // en oro
}
function vender(G, emp, g) {
  const i = emp.escuderia.indexOf(g); if (i < 0 || !g.vivo) return 'No está en tu escudería.';
  const oro = precioVenta(g);
  emp.escuderia.splice(i, 1); cobrar(emp.bolsa, { oro });
  { const E = est(emp); E.vendidos++; E.oroVentas += oro; if (g.inmortal && g.jefe && !E.monstruosVendidos.includes(g.jefe)) E.monstruosVendidos.push(g.jefe); }
  G.log.push(`${emp.nombre} vendió a ${g.nombre} por ${oro} oro.`);
  return 'ok';
}

/* ---------- final (doc §4) ---------- */
function ranking(G) { return [...G.emperadores].sort((a, b) => b.puntos - a.puntos || b.victorias - a.victorias); }
function empatados(G) { const r = ranking(G), top = r[0].puntos; return r.filter((e) => e.puntos === top); }

// copia serializable de la partida (sin funciones) para mandar por la red
function serializar(G) { return JSON.parse(JSON.stringify(G, (k, v) => (typeof v === 'function' ? undefined : v))); }

root.Partida = {
  serializar, NOMBRES_BOT,
  total, pagar, cobrar, fmtMonto, nueva, fase, ciclo, avanzar, vivos, salud, vista,
  crearSubasta, valorBot, pujar, maxPuja, incremento, botPuja, reaccionBot, perfilDe, cerrarCarro, botInspecciona,
  sortearEventos, resolverEvento, botAceptaEvento,
  precioItem, comprarItem, entrenar, curar, inspeccionar, fusionable, fusionar, chanceFusion, mejorarChaman, curarLastimados, botPreparacion, armarCampeones, mejorDe, esUltimaPelea,
  precioVenta, vender, est,
  armarPelea, aplicarPelea, convocados, fuerzaG, recuperar, curarTodo, botRecuperacion, ranking, empatados,
};
if (typeof module !== 'undefined') module.exports = root.Partida;
})(typeof window !== 'undefined' ? window : globalThis);
