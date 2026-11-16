/* =====================================================================
   COLISEO · MOTOR
   Generación de gladiadores + simulación de pelea todos contra todos.
   El núcleo de cada golpe (puntería, guardia, esquive, cardio/fondo, daño por
   zonas, críticos, lesiones) viene de Live, Eat & Box, adaptado a armas y a
   peleas de muchos contra muchos. No toca la vista: emite eventos y registro.
   ===================================================================== */
(function (root) {
const R = root.REGLAS;
const C = R.COMBATE;

/* ---------- utilidades ---------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const n = (v) => v / 100;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => (r() + r() + r() + r() - 2) * 1.73;
function pickW(r, entries) { let tot = 0; for (const [, w] of entries) tot += w; let x = r() * tot; for (const [k, w] of entries) { x -= w; if (x <= 0) return k; } return entries[entries.length - 1][0]; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
let UID = 1;
// al cargar una partida guardada, los ids nuevos tienen que arrancar después de los que ya existen (si no, se pisan retratos y gladiadores)
function subirUID(n) { if (n >= UID) UID = n + 1; }

/* =====================================================================
   GENERACIÓN (doc §6)
   ===================================================================== */
function tirarTier(r) { return pickW(r, R.TIER_ORDEN.map((t) => [t, R.TIERS[t].prob])); }
const tierIdx = (t) => R.TIER_ORDEN.indexOf(t);

function equipoInicial(r, raza, estilo) {
  let arma, escudo = 'ninguno', armadura = pickW(r, [['ninguna', 0.55], ['ligera', 0.35], ['pesada', 0.10]]);
  if (raza === 'gigante') { arma = r() < 0.6 ? 'garrote' : 'martillo'; if (armadura === 'pesada') armadura = 'ligera'; }
  else if (raza === 'goblin') { arma = pickW(r, [['daga', 0.55], ['cestus', 0.2], ['lanza', 0.25]]); if (r() < 0.3) escudo = 'chico'; if (armadura === 'pesada') armadura = 'ninguna'; }
  else if (estilo === 'agarres') arma = 'cestus';
  else if (estilo === 'distancia') { arma = 'lanza'; if (r() < 0.5) escudo = 'chico'; }
  else if (estilo === 'defensivo') { arma = 'gladius'; escudo = 'grande'; }
  else if (estilo === 'contraatacador') { arma = 'gladius'; if (r() < 0.6) escudo = 'chico'; }
  else { if (r() < 0.4) arma = 'martillo'; else { arma = 'gladius'; escudo = 'chico'; } }
  if (raza !== 'goblin' && estilo === 'agarres') arma = 'cestus';
  if (R.ARMAS[arma].manos === 2 || R.ARMAS[arma].sinEscudo) escudo = 'ninguno';
  return { arma, escudo, armadura };
}

// cómo se ve un gladiador: el hombre lobo parece humano hasta que se transforma
// color de piel de cada uno: los humanos (y el hombre lobo disfrazado) van de piel clara a piel africana; el resto, el de su raza
const PIELES_HUMANAS = [['#f0caa4', 0.16], ['#d8a27a', 0.24], ['#b9825a', 0.2], ['#8e5a38', 0.18], ['#6a4028', 0.12], ['#4a2c1c', 0.1]];
function pielDe(g) {
  if (g.jefe && R.JEFES[g.jefe] && R.JEFES[g.jefe].piel) return R.JEFES[g.jefe].piel;
  if (g.esbirro && R.ESBIRROS[g.esbirro] && R.ESBIRROS[g.esbirro].piel) return R.ESBIRROS[g.esbirro].piel;
  if (g.raza !== 'humano' && g.raza !== 'lobo') return R.RAZAS[g.raza].piel;
  if (g.piel) return g.piel;
  let h = 7; for (const c of String(g.id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;   // los viejos (sin piel guardada): siempre el mismo según su id
  let x = (h % 1000) / 1000; for (const [c, w] of PIELES_HUMANAS) { x -= w; if (x <= 0) return c; } return PIELES_HUMANAS[0][0];
}
const razaVisual = (g, transformado) => (g.raza === 'lobo' ? (transformado ? 'loboT' : 'humano') : g.raza);
// qué raza ve cada uno: solo el dueño sabe que es un hombre lobo
const razaLabel = (g, esDueno) => (g.raza === 'lobo' && !esDueno ? R.RAZAS.humano.label : R.RAZAS[g.raza].label);
function generarGladiador(r, opt = {}) {
  const raza = opt.raza || pickW(r, Object.entries(R.RAZAS).map(([k, v]) => [k, v.prob]));
  let tier = opt.tier || (opt.dist ? pickW(r, Object.entries(opt.dist)) : tirarTier(r));
  for (let i = 1; i < (opt.mejorDe || 1); i++) { const t2 = tirarTier(r); if (tierIdx(t2) > tierIdx(tier)) tier = t2; }
  const RZ = R.RAZAS[raza], T = R.TIERS[tier];
  const stats = {};
  for (const s of R.STATS) stats[s.key] = clamp(Math.round(T.media + RZ.tend[s.key] + gauss(r) * T.dispersion), 3, 99);
  // estilo según afinidad de stats (el más afín es el más probable, no seguro)
  const sc = Object.entries(R.ESTILOS).map(([k, e]) => { let v = 0, w = 0; for (const [s, a] of Object.entries(e.afinidad)) { v += stats[s] * a; w += a; } return [k, v / w]; });
  const mx = Math.max(...sc.map((x) => x[1]));
  const estilo = opt.estilo || pickW(r, sc.map(([k, v]) => [k, Math.exp((v - mx) / 6)]));
  const edad = 18 + Math.floor(r() * 20);
  // potencial: los jóvenes tienen margen; los veteranos están cerca de su techo  // PROVISIONAL
  const margen = clamp(Math.round((32 - edad) * 1.4 + gauss(r) * 6), 0, 30);
  const potencial = margen >= 18 ? 'Alto' : margen >= 9 ? 'Medio' : margen >= 3 ? 'Bajo' : 'En su techo';
  const altura = +(RZ.altura * (1 + gauss(r) * 0.045)).toFixed(2);
  const peso = Math.round(RZ.peso * (1 + gauss(r) * 0.09) * (0.88 + 0.24 * n(stats.fuerza)));
  const honor = clamp(Math.round(50 + gauss(r) * 22), 3, 97);
  const nr = pickW(r, [[0, R.RASGOS_PROB[0]], [1, R.RASGOS_PROB[1]], [2, R.RASGOS_PROB[2]]]);
  const rasgos = [];
  while (rasgos.length < nr) { const k = pick(r, Object.keys(R.RASGOS)); if (!rasgos.includes(k)) rasgos.push(k); }
  const lesiones = { eye: 0, cut: 0, nose: 0, rib: 0, cheek: 0 };
  if (r() < 0.1) lesiones[pick(r, Object.keys(lesiones))] = +(0.2 + 0.4 * r()).toFixed(2);   // llega con una lesión previa
  // récord oculto
  const peleas = Math.floor((edad - 18) * (0.4 + r()) * 0.9);
  const pv = 0.3 + 0.1 * tierIdx(tier);
  let v = 0; for (let i = 0; i < peleas; i++) if (r() < pv) v++;
  const record = { v, d: peleas - v, muertes: Math.floor(v * r() * 0.6), rendiciones: Math.floor((peleas - v) * r() * 0.5) };
  return {
    id: 'g' + (UID++), nombre: pick(r, R.NOMBRES[RZ.disfraz || raza] || R.NOMBRES.humano), raza, tier, stats, honor, estilo, rasgos, edad, potencial, margen,
    altura, peso, equipo: opt.equipo || equipoInicial(r, raza, estilo), lesiones, record, vivo: true, vida: 100,
    ...(raza === 'humano' || raza === 'lobo' ? { piel: pickW(r, PIELES_HUMANAS) } : {}),
  };
}

// lote según tendencias (doc §5): casi nunca mezcla razas, goblins en grupo, gigantes solos
function generarLote(r, opt = {}) {
  const raza = opt.raza || pickW(r, Object.entries(R.RAZAS).map(([k, v]) => [k, v.prob]));
  const tam = opt.tamanio || 1 + pickW(r, (R.LOTES.tamanio[raza] || [0.6, 0.3, 0.1]).map((w, i) => [i, w]));   // las razas especiales (ghoul…) no tienen tabla propia
  const out = [];
  for (let i = 0; i < tam; i++) {
    const rz = r() < R.LOTES.mezclaRazas && i > 0 ? pickW(r, Object.entries(R.RAZAS).map(([k, v]) => [k, v.prob])) : raza;
    // de vez en cuando aparece uno de raza especial (esqueleto u hombre lobo)
    const esp = !opt.raza && r() < R.ESPECIALES.probCarro ? pick(r, Object.keys(R.RAZAS).filter((k) => R.RAZAS[k].especial)) : null;
    out.push(generarGladiador(r, { dist: opt.dist, raza: esp || rz, mejorDe: !esp && tam === 1 && rz === 'goblin' ? R.LOTES.goblinSoloTierBonus : 1 }));
  }
  return out;
}

/* ---------- 6 stats visibles -> atributos internos de LE&B (0..1) ---------- */
const INJ = {
  label: { eye: 'Ojo hinchado', cut: 'Corte en la ceja', nose: 'Nariz rota', rib: 'Costilla fracturada', cheek: 'Pómulo fracturado', dizzy: 'Aturdido',
    fxA: 'Brazo del arma fracturado', fxE: 'Brazo del escudo fracturado', fxP: 'Pierna fracturada' },
  pen: {   // LE&B: penalizaciones con gravedad 100%
    vision: { reflexes: -0.45, evasion: -0.40, accuracy: -0.35 },
    nose: { cardio: -0.30, recovery: -0.45 },
    rib: { bodyTough: -0.45, agility: -0.30 },
    cheek: { chin: -0.45 },
    dizzy: { agility: -0.40, iq: -0.40, accuracy: -0.40 },
  },
};
function derivar(g, inj, dizzy) {
  const s = g.stats, F = n(s.fuerza), V = n(s.velocidad), Re = n(s.resistencia), T = n(s.tecnica), Fr = n(s.frialdad), P = n(s.percepcion);
  const ag = R.RAZAS[g.raza].aguante;
  const a = {
    strength: F, explosiveness: 0.6 * F + 0.4 * V, handSpeed: V, agility: V, reflexes: 0.5 * V + 0.5 * P,
    cardio: Re, recovery: 0.7 * Re + 0.3 * Fr, chin: 0.6 * Re + 0.2 * F + 0.2 * Fr + ag, bodyTough: 0.7 * Re + 0.3 * F + ag,
    accuracy: 0.7 * T + 0.3 * P, evasion: 0.5 * T + 0.3 * V + 0.2 * P, guard: 0.7 * T + 0.3 * Re,
    counter: 0.5 * T + 0.5 * P, iq: P, clinch: 0.5 * F + 0.5 * T, frialdad: Fr, honor: n(g.honor),
  };
  inj = inj || g.lesiones;
  const pen = {};
  const add = (tbl, k) => { for (const [x, v] of Object.entries(tbl)) pen[x] = (pen[x] || 0) + v * k; };
  add(INJ.pen.vision, Math.min(1, inj.eye + 0.9 * inj.cut)); add(INJ.pen.nose, inj.nose); add(INJ.pen.rib, inj.rib); add(INJ.pen.cheek, inj.cheek);
  if (dizzy) add(INJ.pen.dizzy, 1);
  // fracturas y prótesis
  const CU = R.CUERPO, pr = g.protesis || {};
  add(CU.penFractura.bA, inj.fxA || 0); add(CU.penFractura.bE, inj.fxE || 0); add(CU.penFractura.pierna, inj.fxP || 0);
  if (pr.bA) add(CU.penProtesis.bA, 1); if (pr.bE) add(CU.penProtesis.bE, 1);
  if (pr.pA || pr.pB) add(CU.penProtesis.pierna, (pr.pA ? 1 : 0) + (pr.pB ? 1 : 0));
  for (const k of Object.keys(a)) a[k] = clamp(a[k] + (pen[k] || 0), 0, 1);
  return a;
}

/* =====================================================================
   PELEA
   ===================================================================== */
const FORMACIONES = {
  linea:   (i, k) => ({ lat: (i - (k - 1) / 2) * 1.6, fwd: 0 }),
  cunia:   (i, k) => { const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2); return { lat: side * 1.4, fwd: -Math.abs(side) * 1.2 }; },
  columna: (i, k) => ({ lat: 0, fwd: -i * 1.5 }),
  circulo: (i, k) => (k === 1 ? { lat: 0, fwd: 0 } : { lat: Math.cos((i / k) * Math.PI * 2) * 1.3, fwd: Math.sin((i / k) * Math.PI * 2) * 1.3 }),
};
const PLANES = { agresivo: 'Agresivo', defensivo: 'Defensivo', concentracion: 'Concentrar objetivos', espacio: 'Control del espacio' };
const ORDENES = { cercano: 'Atacar al cercano', proteger: 'Proteger a un aliado', vulnerables: 'Perseguir vulnerables', distancia: 'Mantener distancia' };

function rasgosFx(g) {
  const fx = { rendicion: 0, remate: 0, agresividad: 0, danio: 1, rodeado: 0, rendicionAliados: 0 };
  for (const k of g.rasgos) { const t = R.RASGOS[k]; for (const key of Object.keys(fx)) if (t[key] !== undefined) fx[key] = key === 'danio' ? fx[key] * t[key] : fx[key] + t[key]; }
  return fx;
}

function crearLuchador(s, g, team, cfg) {
  const W = R.ARMAS[g.equipo.arma], S = R.ESCUDOS[g.equipo.escudo], A = R.ARMADURAS[g.equipo.armadura], E = R.ESTILOS[g.estilo];
  const esc = Math.sqrt(g.altura / 1.75);
  const inj = { eye: 0, cut: 0, nose: 0, rib: 0, cheek: 0, fxA: 0, fxE: 0, fxP: 0, ...g.lesiones };
  // estado de cada miembro: ok · fractura · cortado · protesis
  const pr = g.protesis || {}, miembros = {};
  for (const k of ['bA', 'bE', 'pA', 'pB']) miembros[k] = pr[k] ? 'protesis' : 'ok';
  if (inj.fxA > 0.3 && !pr.bA) miembros.bA = 'fractura';
  if (inj.fxE > 0.3 && !pr.bE) miembros.bE = 'fractura';
  if (inj.fxP > 0.3 && !pr.pA) miembros.pA = 'fractura';
  return {
    miembros, sangrado: 0, decapitado: false,
    id: s.fighters.length, g, team, nombre: g.nombre, W, S, A, E, esc, fx: rasgosFx(g),
    radio: 0.26 * Math.pow(g.altura / 1.75, 0.8) * Math.pow(g.peso / (78 * Math.pow(g.altura / 1.75, 2)), 0.25),
    masa: g.peso, inj, dizzy: 0, a: derivar(g, inj, false),
    x: 0, z: 0, vx: 0, vz: 0, facing: 0, mi: 0,
    energy: 100, reserve: 100, gassed: false,
    // la vida que trae de afuera (persistente entre peleas) arranca como daño ya recibido
    dmg: { head: 100 - (g.vida ?? 100), body: 100 - (g.vida ?? 100) }, rojo: { head: false, body: false }, fragile: 0,
    guardHp: 1, estado: 'pelea',
    action: null, cd: 0.4 + s.rng() * 0.6, stagger: 0, think: s.rng() * 0.25, exposed: 0, grabCd: 1.5,
    comboLeft: 0, target: null, victima: null, orden: cfg.orden || 'cercano', protege: cfg.protege ?? null,
    recent: 0, decididos: new Set(), porQuien: null, perdonadoPor: [], fxv: { flash: 0, atk: 0, hurt: 0 },
    st: { hecho: 0, recibido: 0, ataques: 0, aciertos: 0, bloqueados: 0, esquivados: 0, bloqueos: 0, esquives: 0, muertes: 0, incapacitados: 0, remates: 0, perdones: 0, decap: 0, maxGolpe: 0, ahogoT: null, lesiones: [] },
    causa: null, finT: null,
    // razas especiales
    esp: g.jefe ? { ...(R.RAZAS[g.raza].especial ? R.RAZAS[g.raza] : {}), especial: true, noSeRinde: true, nuncaPerdona: true } : g.sinPiedad ? { ...(R.RAZAS[g.raza].especial ? R.RAZAS[g.raza] : {}), especial: true, nuncaPerdona: true, ...(g.sinSangre ? { sinSangre: true } : {}) } : R.RAZAS[g.raza].especial ? R.RAZAS[g.raza] : null, rearmar: null, rearmado: false,
    lobo: R.RAZAS[g.raza].transforma ? { on: false, t: R.RAZAS[g.raza].transforma.desde + s.rng() * (R.RAZAS[g.raza].transforma.hasta - R.RAZAS[g.raza].transforma.desde) } : null,
  };
}
// recalcula atributos (lesiones / aturdido) sin perder el empuje del hombre lobo transformado
function rederivar(f, dizzy) {
  f.a = derivar(f.g, f.inj, dizzy);
  if (f.lobo && f.lobo.on) { const b = R.RAZAS.lobo.transforma.boost; for (const k of ['strength', 'explosiveness', 'handSpeed', 'agility', 'reflexes']) f.a[k] = clamp(f.a[k] + b, 0, 1); f.a.frialdad = clamp(f.a.frialdad - 0.2, 0, 1); }
}
function transformar(s, f) {
  const T = R.RAZAS.lobo.transforma;
  f.lobo.on = true; f.lobo.tOn = s.t;
  f.W = R.ARMAS.garras; f.S = R.ESCUDOS.ninguno; f.E = R.ESTILOS.agresivo;
  f.esc *= T.crece; f.radio *= T.crece; f.masa *= T.crece * T.crece;
  f.action = null; f.stagger = 0; f.energy = Math.min(100, f.energy + (T.aire || 0)); if (f.energy >= 30) f.gassed = false;
  for (const z of ['head', 'body']) f.dmg[z] = Math.max(0, f.dmg[z] - (T.cura || 0));
  rederivar(f, f.dizzy > 0);
  log(s, 'critico', `¡{f${f.id}} se transforma en hombre lobo!`, 3);
  ev(s, { tipo: 'transforma', d: f.id });
}

function crearPelea(cfg) {
  const s = {
    rng: mulberry32(cfg.seed || (Math.random() * 1e9) | 0), t: 0, fighters: [], equipos: [], eventos: [], log: [],
    fase: 'pelea', fin: null, posT: 0, primeraSangre: false, cfg,
  };
  const N = cfg.equipos.length;
  cfg.equipos.forEach((eq, ti) => {
    const ang = (ti / N) * Math.PI * 2 + Math.PI / 2;
    const cx = Math.cos(ang) * radioDe(s) * 0.68, cz = Math.sin(ang) * radioDe(s) * 0.68;
    const fwdx = -Math.cos(ang), fwdz = -Math.sin(ang), latx = -fwdz, latz = fwdx;
    const team = { id: ti, nombre: eq.nombre, color: eq.color, plan: eq.plan || 'agresivo', formacion: eq.formacion || 'linea', esJugador: !!eq.esJugador,
      foco: null, ancla: (eq.plan === 'espacio') ? { x: cx * 0.12, z: cz * 0.12 } : { x: cx + fwdx * 2, z: cz + fwdz * 2 }, centro: { x: cx, z: cz }, miembros: [] };
    s.equipos.push(team);
    const k = eq.glads.length;
    eq.glads.forEach((gc, i) => {
      const f = crearLuchador(s, gc.g, ti, gc);
      // más de 8 (la pelea contra el Diablo): en filas de a 8, una detrás de la otra
      const o = k > 8 ? { lat: ((i % 8) - (Math.min(8, k - Math.floor(i / 8) * 8) - 1) / 2) * 1.6, fwd: -Math.floor(i / 8) * 1.7 } : FORMACIONES[team.formacion](i, k);
      f.x = cx + latx * o.lat + fwdx * o.fwd; f.z = cz + latz * o.lat + fwdz * o.fwd;
      f.slot = { lat: o.lat, fwd: o.fwd };
      f.facing = Math.atan2(fwdz, fwdx);
      s.fighters.push(f); team.miembros.push(f.id);
    });
  });
  // "proteger": índice dentro del equipo -> id de luchador
  for (const f of s.fighters) if (f.orden === 'proteger') {
    const t = s.equipos[f.team]; const pid = t.miembros[f.protege ?? 0];
    f.protege = pid !== undefined && pid !== f.id ? pid : t.miembros.find((x) => x !== f.id) ?? null;
    if (f.protege === null) f.orden = 'cercano';
  }
  log(s, 'inicio', `Se abren las puertas: ${s.equipos.map((t) => `{t${t.id}}`).join(' · ')}`);
  return s;
}

/* ---------- registro legible: {f3} = nombre del luchador 3, {t1} = equipo 1 ---------- */
function log(s, tipo, txt, imp = 1) { s.log.push({ t: s.t, tipo, txt, imp }); }
const ev = (s, e) => s.eventos.push(e);

/* ---------- derivados (LE&B) ---------- */
const Fat = {
  raw: (f) => 1 - f.energy / 100,
  sev: (f) => 1.25 - 0.65 * f.a.cardio,
  eff(f) { return Math.min(1, Math.pow(this.raw(f), 1.4) * this.sev(f)); },
  workRateMul(f) { return Math.max(0.15, 1 - 0.75 * this.eff(f)); },
  mobilityMul(f) { return (1 - 0.45 * this.eff(f)) * (1 - 0.25 * f.inj.rib); },
  accuracyMul(f) { return f.energy >= 40 ? 1 : 1 - 0.3 * ((40 - f.energy) / 40) * this.sev(f); },
  powerMul(f) { return f.energy >= 30 ? 1 : 1 - 0.4 * ((30 - f.energy) / 30) * this.sev(f); },
  defenseMul(f) { return 1 - 0.35 * this.eff(f); },
  drainMul: (f) => (1.45 - 0.9 * f.a.cardio) * (1 + 0.5 * Math.min(1, f.dmg.body / 100)) * f.A.cardio * f.S.cardio,
  spend(s, f, amount) {
    if (f.esp && f.esp.sinCansancio) { f.energy = 100; return; }   // el esqueleto no se cansa
    const e = amount * this.drainMul(f);
    f.energy = clamp(f.energy - e, 0, 100);
    if (f.energy < 20) { if (!f.gassed && f.st.ahogoT === null) f.st.ahogoT = s.t; f.gassed = true; } else if (f.energy >= 30) f.gassed = false;
    f.reserve = Math.max(C.cardio.fondoPiso, f.reserve - e * C.cardio.fondo * (1.4 - 0.9 * f.a.cardio) * (f.gassed ? C.cardio.ahogoMul : 1));
  },
};
const handTimeMul = (f) => (1.35 - 0.7 * f.a.handSpeed) * (1 + 0.2 * Math.min(1, f.dmg.head / 100));
const piernaK = (f) => (f.miembros ? ((f.miembros.pA === 'fractura' || f.miembros.pB === 'fractura') ? 0.6 : 1) * ((f.miembros.pA === 'protesis' || f.miembros.pB === 'protesis') ? 0.8 : 1) : 1);
const maxSpeed = (f) => (1.3 + 2.3 * f.a.agility) * Math.pow(f.esc, 0.6) * f.A.movilidad * f.S.movilidad * Fat.mobilityMul(f) * piernaK(f);
const rango = (f) => ({ opt: f.W.opt * f.esc, min: f.W.min * f.esc, max: f.W.max * f.esc });
function distQ(f, d) {
  const r = rango(f), half = d < r.opt ? r.opt - r.min : r.max - r.opt, x = (d - r.opt) / half;
  if (Math.abs(x) <= 1) return 1 - 0.55 * x * x;
  return Math.max(0, 0.45 - (Math.abs(x) - 1) * 1.5);
}
const enPie = (f) => f.estado === 'pelea';
const caido = (f) => f.estado === 'caido' || f.estado === 'rendido';
const toughMul = (f, zone) => (1.3 - 0.7 * (zone === 'head' ? f.a.chin : f.a.bodyTough)) * (1 + f.fragile) * f.A.danio * f.fx.danio;

/* ---------- resolución de un ataque (LE&B resolve, adaptado) ---------- */
function porLaEspalda(att, def) {
  const ang = Math.atan2(att.z - def.z, att.x - def.x);
  return Math.abs(angDiff(ang, def.facing)) > C.espalda;
}
function aimChance(att, def, d, act) {
  const moving = 1 - 0.15 * Math.min(2.2, Math.hypot(def.vx, def.vz)) / 2.2;
  return clamp((0.6 + 0.38 * att.a.accuracy) * (0.6 + 0.4 * distQ(att, d)) * moving * Fat.accuracyMul(att) * (1 - 0.25 * Math.min(1, att.dmg.head / 100))
    + (act.counter ? 0.12 : 0) + (def.action && def.action.phase === 'recup' ? 0.1 * att.a.iq : 0) + (def.stagger > 0 ? 0.15 : 0), 0.05, 0.97);
}
function openMul(def) { const a = def.action; if (def.stagger > 0) return 0.5; if (!a || a.tipo !== 'ataque') return def.exposed > 0 ? 0.7 : 1; return a.heavy ? 0.45 : 0.7; }
const readMul = (att, def) => 1 + 0.15 * (def.a.iq - att.a.iq);
// acorralado: def pegado al muro y att del lado del centro (en la torre no hay muro: ahí el borde ya es la muerte)
function acorralado(s, att, def) {
  if (s.cfg.modo === 'campeones') return false;
  const rd = Math.hypot(def.x, def.z);
  return rd > radioDe(s) - def.radio - C.acorralado.borde && Math.hypot(att.x, att.z) < rd - 0.3;
}
function dodgeChance(att, def, espalda) {
  const threshold = (att.a.handSpeed + att.a.accuracy) / 2;
  const margin = def.a.evasion - threshold;
  const cap = 0.6;
  const base = margin >= 0 ? cap : cap * clamp(1 + margin / 0.5, 0, 1);
  return clamp(base * (0.8 + 0.4 * def.a.reflexes) * (1 - 0.35 * att.E.ritmo) * Fat.defenseMul(def) * (1 - 0.4 * Math.min(1, def.dmg.head / 100))
    * openMul(def) * readMul(att, def) * def.A.movilidad * (espalda ? 0.15 + 0.6 * def.a.iq : 1) * (def.dizzy > 0 ? 0.6 : 1), 0, 0.9);
}
function blockChance(att, def) {
  return clamp((0.35 + 0.6 * def.a.guard) * (0.6 + 0.4 * def.guardHp) * att.W.guardMod * def.S.bloqueo * (1 - 0.3 * Fat.eff(def)) * openMul(def) * readMul(att, def), 0, 0.95);
}
function guardPreference(def) {
  let p = def.E.guardia * (def.S === R.ESCUDOS.ninguno ? 0.65 : 1.15);
  if (def.guardHp < 0.35) p *= def.guardHp / 0.35;
  return clamp(p, 0, 1);
}
function guardWearWeight(g, heavy, liviana) {
  if (heavy) return 1.5;
  if (g >= 0.9999) return 0;
  if (g >= 0.85) return liviana ? 0 : 1;
  if (g >= 0.60) return liviana ? 0.35 : 1;
  return 1;
}
function impacto(att, d, r) {
  const brazo = att.miembros && att.miembros.bA === 'fractura' ? 0.65 : 1, dosManos = att.miembros && att.W.manos === 2 && att.miembros.bE === 'cortado' ? 0.6 : 1;
  return brazo * dosManos * att.W.dmg * (0.55 + 0.75 * att.a.strength) * (0.6 + 0.9 * att.a.explosiveness) * Fat.powerMul(att) * (0.85 + 0.25 * distQ(att, d)) * (0.85 + 0.3 * r())
    * Math.pow(att.masa / 78, 0.12)   // la masa empuja el golpe (gigante +15%, goblin -10%)
    * (att.g.jefe ? att.g.fuerzaJefe || 1 : 1);
}

function addDanio(s, att, def, zone, imp) {
  const pts = imp * C.zona[zone] * toughMul(def, zone) / (def.g.jefe ? def.g.aguanteJefe || 1 : 1);   // los jefes de mazmorra aguantan mucho más
  def.dmg[zone] += pts; def.ultimoGolpeDe = att.id;
  def.st.recibido += pts; att.st.hecho += pts;
  if (pts > att.st.maxGolpe) att.st.maxGolpe = pts;
  if (def.dmg[zone] >= C.incapacitaEn && !def.rojo[zone]) { def.rojo[zone] = true; def.fragile += C.fragil; }
  return pts;
}

function resolver(s, f, o, act) {
  const r = s.rng, d = dist(f, o), zone = act.zone;
  f.st.ataques++;
  if (!enPie(o) && !(caido(o) && act.remate)) return;
  if (d > rango(f).max * 1.12) { ev(s, { tipo: 'golpe', a: f.id, d: o.id, res: 'aire' }); Fat.spend(s, f, f.W.coste * C.cardio.ataque * 0.4); return; }
  const espalda = porLaEspalda(f, o);
  let res, imp = 0, pts = 0, crit = false;
  if (r() >= aimChance(f, o, d, act)) res = 'falla';
  else if (o.comiendo) res = 'limpio';   // el ghoul comiendo está regalado
  else if (!espalda && r() < guardPreference(o)) {
    if (r() < blockChance(f, o)) {
      res = 'bloqueo';
      const raw = impacto(f, d, r) * (act.heavy ? f.W.critMul * 0.6 : 1);
      const leak = raw * Math.max(C.guardia.fugaMin, 1 - o.guardHp) * o.S.fuga;
      const before = o.guardHp;
      o.guardHp = clamp(o.guardHp - raw * C.guardia.desgaste * guardWearWeight(o.guardHp, act.heavy, f.W.dmg < 6) * (1.9 - 1.6 * o.a.guard) * o.S.desgaste * f.W.rompe, 0, 1);
      pts = addDanio(s, f, o, zone, leak);
      o.st.bloqueos++; f.st.bloqueados++;
      if (before >= 0.25 && o.guardHp < 0.25) log(s, 'escudo', o.S === R.ESCUDOS.ninguno ? `{f${o.id}} ya casi no puede sostener la guardia: los golpes de {f${f.id}} se la rompieron.` : `El escudo de {f${o.id}} está destrozado: los golpes de {f${f.id}} lo rompieron.`);
    } else res = 'limpio';
  } else {
    Fat.spend(s, o, C.cardio.esquive);
    if (r() < dodgeChance(f, o, espalda) * (acorralado(s, f, o) ? C.acorralado.esquive : 1)) { res = 'esquive'; o.st.esquives++; f.st.esquivados++; const dx = (o.x - f.x) / (d || 1), dz = (o.z - f.z) / (d || 1), side = r() < 0.5 ? -1 : 1; o.vx += -dz * side * 0.9 + dx * 0.4; o.vz += dx * side * 0.9 + dz * 0.4; }
    else res = 'limpio';
  }
  if (res === 'falla' || res === 'esquive') {
    Fat.spend(s, f, f.W.coste * C.cardio.ataque * (res === 'falla' ? 0.5 : 0.3) * (act.heavy ? 1.3 : 1));
    f.exposed = act.heavy ? 0.7 : 0.35;
  }
  if (res === 'limpio') {
    imp = impacto(f, d, r);
    imp *= 1 + (0.6 * f.E.agresividad) * clamp((60 - o.energy) / 60, 0, 1);   // presión contra el que no tiene aire (LE&B AGG)
    if (act.counter) imp *= 1.2;
    if (espalda) imp *= 1.25;
    if (o.stagger > 0 && o.trabado) imp *= 1.3;
    crit = !!act.heavy || !!o.comiendo; if (crit) imp *= f.W.critMul;
    if (act.remate) imp *= 3;
    const wasRed = o.dmg[zone] >= C.incapacitaEn;
    pts = addDanio(s, f, o, zone, imp);
    f.st.aciertos++; s.ultimoGolpe = s.t;
    o.recent += 1;
    // empuje según masas: un gigante casi no se mueve, un goblin vuela
    const dx = (o.x - f.x) / (d || 1), dz = (o.z - f.z) / (d || 1);
    const push = Math.min(2.2, 0.06 * imp) * clamp(Math.sqrt(f.masa / o.masa), 0.35, 2.8);
    const haciaMuro = s.equipos[f.team].plan === 'espacio' && (o.x * dx + o.z * dz) > 0 ? C.espacio.empuje : 1;   // el que controla el espacio te manda contra el muro
    o.vx += dx * push * haciaMuro; o.vz += dz * push * haciaMuro; o.ultimoGolpeDe = f.id;
    o.stagger = Math.max(o.stagger, Math.min(0.8, 0.08 + imp * 0.015) * (o.g.jefe ? 0.2 : 1));
    o.fxv.hurt = 0.25;
    Fat.spend(s, o, imp * (zone === 'body' ? 0.12 : 0.03));
    if (!s.primeraSangre && pts > 1) { s.primeraSangre = true; log(s, 'sangre', `Primera sangre: {f${f.id}} alcanza a {f${o.id}} con ${f.W.label.toLowerCase()}.`); }
    if (crit && pts >= 8) log(s, 'critico', `¡Golpe cargado! {f${f.id}} le mete ${art(f.W)} ${zone === 'head' ? 'en la cabeza' : 'en el cuerpo'} a {f${o.id}} (${Math.round(pts)} de daño).`);
    ev(s, { tipo: 'golpe', a: f.id, d: o.id, res, zone, pts, crit, espalda, estocada: !!act.estocada });
    // el jefe barre: el golpe también agarra a los que están al lado
    if (f.g.jefe) for (const o2 of s.fighters) {
      if (o2 === o || o2.team === f.team || !enPie(o2) || dist(f, o2) > rango(f).max * 1.15) continue;
      const p2 = addDanio(s, f, o2, 'body', imp * 0.55); o2.stagger = Math.max(o2.stagger, 0.4);
      ev(s, { tipo: 'golpe', a: f.id, d: o2.id, res, zone: 'body', pts: p2, crit: false });
      if (o2.dmg.body >= C.letal.body) morir(s, o2, f, 'un barrido del monstruo');
    }
    // muerte por golpe brutal
    if (o.dmg[zone] >= C.letal[zone]) { desmembrarLetal(s, f, o, zone); morir(s, o, f, `${crit ? 'un golpe cargado' : 'un golpe'} brutal ${zone === 'head' ? 'en la cabeza' : 'en el cuerpo'}`); return; }
    if (caido(o)) return;
    let inc = wasRed;
    if (o.g.jefe) inc = false;   // el jefe no se cae: pelea hasta morir
    if (crit && !inc && !o.g.jefe) {   // caída relámpago (LE&B FLASH)
      const pow = 0.5 * f.a.strength + 0.5 * f.a.explosiveness, tough = zone === 'head' ? o.a.chin : o.a.bodyTough;
      const pf = clamp(C.flash.base + C.flash.k * (pow - tough) + C.flash.danioK * Math.min(1, o.dmg[zone] / 100), 0, C.flash.max) * (zone === 'body' ? 0.7 : 1) * (act.counter ? 1.25 : 1);
      if (r() < pf) { inc = true; log(s, 'critico', `{f${o.id}} se desploma de un solo golpe de {f${f.id}}: no tenía cómo aguantar esa potencia.`); }
    }
    lesionar(s, f, o, zone, imp, crit);
    if (inc) { incapacitar(s, o, f, zone); return; }
    if (espalda && r() < 0.5) log(s, 'golpe', act.estocada ? `{f${f.id}} le clava una estocada por la espalda a {f${o.id}}.` : `{f${f.id}} le entra por la espalda a {f${o.id}}.`, 0);
    if (act.counter && pts > 4) log(s, 'contra', `Contragolpe de {f${f.id}} sobre {f${o.id}}.`, 0);
  } else {
    ev(s, { tipo: 'golpe', a: f.id, d: o.id, res, zone, pts });
    if (res !== 'limpio' && enPie(o)) tryCounter(s, o, f, d);
  }
}
const art = (W) => (W.label === 'Lanza' ? 'un lanzazo' : W.label === 'Martillo' ? 'un martillazo' : W.label === 'Garrote' ? 'un garrotazo' : W.label === 'Cestus' ? 'un puñetazo' : W.label === 'Daga' ? 'una puñalada' : 'un tajo');

function tryCounter(s, def, att, d) {
  if (def.action || def.stagger > 0 || def.cd > 0.15) return;
  const r = rango(def);
  if (d < r.min * 0.8 || d > r.max) return;
  const p = def.E.contra * (0.4 + 0.6 * def.a.counter) * (att.action && att.action.heavy ? 1.3 : 0.8) * 0.55;
  if (s.rng() < p) iniciarAtaque(s, def, att, { counter: true });
}

/* ---------- lesiones (LE&B Inj.onHit, simplificado) ---------- */
/* ---------- el cuerpo: fracturas, cortes, desangrado (decidido por Merlin) ---------- */
function sangrar(def, k) { if (def.esp && def.esp.sinSangre) return; def.sangrado += k / (def.g.jefe ? def.g.aguanteJefe || 1 : 1); }
function traumaMiembro(s, att, def, imp, crit) {
  const CU = R.CUERPO, r = s.rng, ws = Object.keys(R.ARMAS).find((k) => R.ARMAS[k] === att.W) || 'gladius';
  const power = 0.5 * att.a.strength + 0.5 * att.a.explosiveness, k = Math.min(2, imp / 8) * (crit ? 3 : 1) * (0.5 + power);
  // a qué miembro va
  let m = null, x = r() * 1, acc = 0;
  for (const [mm, w] of Object.entries(CU.pesos)) { acc += w; if (x < acc) { m = mm; break; } }
  if (!m || def.miembros[m] === 'cortado' || def.miembros[m] === 'protesis') return;
  if (def.g.jefe && def.dmg.body < C.letal.body * 0.8) return;   // al jefe no le cortás nada hasta que está casi muerto
  const fract = def.miembros[m] === 'fractura';
  // corte
  if (r() < CU.corte * (CU.filo[ws] || 0) * k * (fract ? 2.5 : 1)) return cortarMiembro(s, att, def, m);
  // fractura
  if (!fract && r() < CU.fractura * (CU.contundente[ws] || 0.5) * k * (1.3 - def.a.bodyTough)) {
    def.miembros[m] = 'fractura';
    const kk = m === 'bA' ? 'fxA' : m === 'bE' ? 'fxE' : 'fxP';
    def.inj[kk] = Math.max(def.inj[kk] || 0, 0.8);
    rederivar(def, def.dizzy > 0);
    def.st.lesiones.push(kk);
    log(s, 'lesion', `¡CRACK! {f${att.id}} le fractura ${m[0] === 'b' ? 'el brazo' : 'la pierna'} a {f${def.id}}.`, 2);
    ev(s, { tipo: 'fractura', a: att.id, d: def.id, m });
    sangrar(def, CU.sangradoHerida);
  }
}
function cortarMiembro(s, att, def, m) {
  const CU = R.CUERPO;
  def.miembros[m] = 'cortado';
  sangrar(def, CU.sangradoCorte);
  def.st.lesiones.push('corte_' + m);
  log(s, 'critico', `¡{f${att.id}} le corta ${CU.miembros[m].replace('brazo', 'el brazo').replace('pierna', 'la pierna')} a {f${def.id}}!`, 3);
  ev(s, { tipo: 'corte', a: att.id, d: def.id, m });
  def.action = null; def.stagger = Math.max(def.stagger, 1.2);
  const mano = def.miembros;
  if (m === 'bA') { def.W = R.ARMAS.munon; }                                             // suelta el arma: le queda la otra mano
  if (m === 'bE') { def.S = R.ESCUDOS.ninguno; }
  if (mano.bA === 'cortado' && mano.bE === 'cortado' && enPie(def)) incapacitar(s, def, att, 'body');   // sin brazos no puede seguir
  if ((m === 'pA' || m === 'pB') && enPie(def)) incapacitar(s, def, att, 'body');           // sin una pierna, al piso: se arrastra
}
function lesionar(s, att, def, zone, imp, crit) {
  const r = s.rng, power = 0.5 * att.a.strength + 0.5 * att.a.explosiveness, cm = crit ? 4 : 1, filo = att.W === R.ARMAS.gladius || att.W === R.ARMAS.daga || att.W === R.ARMAS.lanza;
  const raise = (kind, step, first) => {
    if (kind === 'cut' && def.esp && def.esp.sinSangre) return;   // un esqueleto no sangra
    const was = def.inj[kind]; def.inj[kind] = clamp(was + (was > 0 ? step : first), 0, 1);
    rederivar(def, def.dizzy > 0);
    def.st.lesiones.push(kind);
    if (was === 0) log(s, 'lesion', `{f${def.id}}: ${INJ.label[kind].toLowerCase()}.`);
    ev(s, { tipo: 'lesion', d: def.id, kind });
  };
  if (zone === 'head') {
    if (r() < 0.04 * (1 + imp / 10)) raise('eye', 0.05 + 0.04 * power, 0.05 + 0.04 * power);
    if (r() < 0.006 * (0.5 + power) * (1.5 - def.a.guard) * cm * (filo ? 2.2 : 1) * (1 + 2.5 * def.inj.cut)) raise('cut', 0.18, 0.25);
    if (r() < 0.004 * (0.4 + power) * (1.4 - 0.8 * def.a.chin) * cm) raise('nose', 0.2, 0.35);
    if (r() < 0.004 * (0.4 + power) * (1.3 - def.a.chin) * cm * (filo ? 0.6 : 1.4)) raise('cheek', 0.25, 0.4);
    if (crit && r() < (filo ? 0.08 : 0.25) * (0.5 + power - 0.5 * def.a.chin) && def.dizzy <= 0) {
      def.dizzy = 6; rederivar(def, true);
      log(s, 'lesion', `{f${def.id}} queda aturdido.`); ev(s, { tipo: 'lesion', d: def.id, kind: 'dizzy' });
    }
  } else {
    if (r() < 0.007 * (0.4 + power) * (1.4 - def.a.bodyTough) * cm * (filo ? 0.7 : 1.5) * (1 + 2 * def.inj.rib)) raise('rib', 0.2, 0.3);
    if (r() < R.CUERPO.probMiembro) traumaMiembro(s, att, def, imp, crit);
  }
  if (filo && imp > 6) sangrar(def, R.CUERPO.sangradoHerida * Math.min(2, imp / 10));   // los tajos hacen sangrar
}

/* ---------- estados de salida de combate (doc §8) ---------- */
function incapacitar(s, o, f, zone) {
  // el esqueleto no queda tirado: se desarma y se vuelve a armar (una vez por pelea, y en cada pelea de nuevo)
  if (o.esp && o.esp.rearma && !o.rearmado && s.fase === 'pelea') return morir(s, o, f, 'un golpe que lo desarma');
  if (o.comiendo) { const c = s.fighters[o.comiendo.id]; if (c) c.comidoPor = null; o.comiendo = null; }
  o.estado = 'caido'; o.action = null; o.porQuien = f ? f.id : null; o.finT = s.t;
  o.causa = `incapacitado por {f${f.id}} (${zone === 'head' ? 'cabeza' : 'cuerpo'})`;
  if (f) f.st.incapacitados++;
  log(s, 'caido', `{f${o.id}} cae y no puede seguir. Lo dejó así {f${f.id}}.`, 2);
  ev(s, { tipo: 'caido', d: o.id });
}
function rendirse(s, o, motivo) {
  o.estado = 'rendido'; o.action = null; o.finT = s.t; o.causa = `se rindió (${motivo})`;
  log(s, 'rendicion', `{f${o.id}} suelta ${o.W.label === 'Lanza' ? 'la lanza' : 'el arma'} y se rinde: ${motivo}.`, 2);
  ev(s, { tipo: 'rendicion', d: o.id });
}
// el golpe que mata, a veces (25 %) se lleva lo que pegó: la cabeza o un brazo o una pierna
function desmembrarLetal(s, f, o, zone) {
  if (o.esp && o.esp.rearma && !o.rearmado) return;   // el esqueleto todavía se rearma
  if (s.rng() >= R.CUERPO.desmembrarLetal) return;
  if (zone === 'head') { if (o.decapitado) return; o.decapitado = true; f.st.decap++; ev(s, { tipo: 'decapita', a: f.id, d: o.id }); return; }
  const ops = ['bA', 'bE', 'pA', 'pB'].filter((m) => o.miembros && o.miembros[m] !== 'cortado' && o.miembros[m] !== 'protesis');
  if (!ops.length) return;
  let x = s.rng() * ops.reduce((a, m) => a + (R.CUERPO.pesos[m] || 1), 0), m = ops[0];
  for (const mm of ops) { x -= R.CUERPO.pesos[mm] || 1; if (x <= 0) { m = mm; break; } }
  o.miembros[m] = 'cortado'; sangrar(o, R.CUERPO.sangradoCorte); o.st.lesiones.push('corte_' + m);
  log(s, 'critico', `¡El golpe final de {f${f.id}} le arranca ${R.CUERPO.miembros[m].replace('brazo', 'el brazo').replace('pierna', 'la pierna')} a {f${o.id}}!`, 3);
  ev(s, { tipo: 'corte', a: f.id, d: o.id, m, letal: true });
}
function morir(s, o, f, como, caida) {
  // el esqueleto se desarma… y se vuelve a armar (una vez por pelea; si cae al vacío, no)
  if (o.esp && o.esp.rearma && !o.rearmado && s.fase === 'pelea' && !caida) {
    o.rearmado = true;
    if (s.rng() < o.esp.rearma) {
      o.estado = 'caido'; o.action = null; o.rearmar = s.t + 3.5; o.porQuien = f ? f.id : o.porQuien;
      log(s, 'caido', `{f${o.id}} se desarma en un montón de huesos… pero los huesos se mueven.`, 2);
      ev(s, { tipo: 'desarma', d: o.id });
      return;
    }
  }
  o.rearmar = null; if (o.comiendo) { const c = s.fighters[o.comiendo.id]; if (c) c.comidoPor = null; o.comiendo = null; }
  if (caida) o.alVacio = true;
  const antes = o.estado;
  o.estado = 'muerto'; o.action = null; o.finT = o.finT ?? s.t; o.porQuien = f ? f.id : o.porQuien;
  o.causa = `muerto por {f${f.id}}${como ? ' — ' + como : ''}`;
  if (f) f.st.muertes++;
  log(s, 'muerte', antes === 'pelea' ? `{f${f.id}} mata a {f${o.id}} con ${como}.` : `{f${f.id}} no tiene piedad: remata a {f${o.id}}${antes === 'rendido' ? ', que se había rendido' : ''}.`, 3);
  ev(s, { tipo: 'muerte', d: o.id, a: f.id });
}

/* ---------- presión psicológica -> rendición (doc §9) ---------- */
function chequearRendicion(s, f, dt) {
  if (f.esp && f.esp.noSeRinde) return;
  if (s.cfg.modo === 'campeones') return;   // en la pelea de campeones nadie se rinde
  const RR = R.RENDICION;
  const dmgF = Math.min(1.3, Math.max(f.dmg.head, f.dmg.body * 0.9) / 100);
  const cerca = s.fighters.filter((o) => enPie(o) && o.team !== f.team && dist(o, f) < 3.2).length;
  const t = s.equipos[f.team];
  const aliados = t.miembros.map((id) => s.fighters[id]);
  const caidos = aliados.filter((a) => !enPie(a)).length / aliados.length;
  const vivosAliados = aliados.filter((a) => enPie(a) && a !== f).length;
  const presion = RR.danio * dmgF * dmgF + RR.cansancio * Fat.raw(f) + RR.rodeado * Math.max(0, cerca - 1) * (1 + f.fx.rodeado * 3)
    + RR.equipoCaido * caidos + RR.golpesRecientes * Math.min(3, f.recent) / 3;
  const umbral = RR.umbralBase + RR.frialdadK * f.a.frialdad - f.fx.rendicion + (vivosAliados > 0 ? -f.fx.rendicionAliados : 0);
  const exceso = presion - umbral;
  if (exceso > 0 && s.rng() < exceso * RR.porSegundo * dt) {
    const m = dmgF > 0.8 ? 'está destrozado' : cerca >= 2 ? 'lo rodearon' : Fat.raw(f) > 0.7 ? 'no le queda aire' : caidos > 0.5 ? 'su equipo cayó' : 'el miedo pudo más';
    rendirse(s, f, m);
  }
}

/* ---------- decidir sobre un caído (doc §9: honor y frialdad) ---------- */
function probRemate(s, f, v) {
  if (f.esp && f.esp.nuncaPerdona) return 1;   // el ghoul nunca perdona
  if (s.cfg.modo === 'campeones') return 1;   // en la torre no hay piedad
  const RM = R.REMATE, t = s.equipos[f.team];
  let p = RM.base + RM.honorK * (1 - f.a.honor) + RM.frialdadK * (f.a.frialdad - 0.5) + f.fx.remate;
  if (f.a.honor < 0.4 && f.a.frialdad > 0.6) p += RM.combo;
  if (f.orden === 'vulnerables') p += RM.ordenVulnerables;
  if (t.plan === 'agresivo') p += RM.planAgresivo;
  if (v.estado === 'rendido') p *= RM.rendidoMul;
  return clamp(p, RM.min, RM.max);
}
function decidir(s, f, v) {
  f.decididos.add(v.id);
  if (s.rng() < probRemate(s, f, v)) {
    f.action = { tipo: 'remate', v: v.id, t: 0, dur: R.REMATE.tiempo };
    ev(s, { tipo: 'ataque', a: f.id, heavy: true, remate: true });
  } else {
    v.perdonadoPor.push(f.id); f.st.perdones++;
    const porque = f.a.honor > 0.65 ? 'por honor' : f.a.frialdad < 0.35 ? 'no se anima' : 'decide dejarlo vivir';
    log(s, 'perdon', `{f${f.id}} se para sobre {f${v.id}} y ${porque === 'decide dejarlo vivir' ? 'decide dejarlo vivir' : `lo perdona (${porque})`}.`, 2);
    ev(s, { tipo: 'perdon', a: f.id, d: v.id });
  }
}

/* ---------- IA ---------- */
function elegirObjetivo(s, f) {
  const t = s.equipos[f.team];
  const prot = f.orden === 'proteger' && f.protege !== null ? s.fighters[f.protege] : null;
  let best = null, bs = -1e9;
  for (const e of s.fighters) {
    if (e.team === f.team || !enPie(e)) continue;
    const d = dist(f, e);
    let sc = -d;
    if (e.target === f.id) sc += 2.5;
    const dmgF = Math.max(e.dmg.head, e.dmg.body) / 100;
    if (t.plan === 'concentracion' && t.foco === e.id) sc += 6;
    if (t.plan === 'defensivo' && !s.abucheo && dist(e, t.ancla) > 5.5) sc -= 6;
    if (t.plan === 'espacio' && !s.abucheo && Math.hypot(e.x, e.z) > radioDe(s) * C.espacio.zona + 3) sc -= 4;   // al que no entra a su zona no lo va a buscar
    if (f.orden === 'vulnerables') sc += dmgF * 6 + (e.energy < 30 ? 2 : 0) + (e.stagger > 0 ? 1 : 0);
    if (prot && enPie(prot)) { if (e.target === prot.id) sc += 8; sc -= 0.6 * dist(e, prot); }
    if (f.fx.agresividad > 0.05) sc += 2 * (e.g.tier === 'S' || e.g.tier === 'A' ? 1 : 0);   // ambición: busca al peligroso
    sc += f.E.agresividad * dmgF * 1.5;
    if (t.plan !== 'concentracion') { const sobre = s.fighters.filter((a) => a.team === f.team && a !== f && a.target === e.id && enPie(a)).length; if (sobre >= 2) sc -= 1.5 * (sobre - 1); }
    if (e.id === f.target) sc += 1.2;   // inercia: no cambia de objetivo a cada rato
    if (sc > bs) { bs = sc; best = e; }
  }
  return best;
}
function buscarVictima(s, f, enAftermath) {
  let best = null, bd = 1e9;
  for (const v of s.fighters) {
    if (v.team === f.team || !caido(v) || f.decididos.has(v.id)) continue;
    if (v.perdonadoPor.length && !(f.fx.remate > 0 || f.orden === 'vulnerables')) continue;   // ya lo perdonó alguien: solo vuelven por él los sanguinarios
    const d = dist(f, v);
    if (!enAftermath && d > 4.5) continue;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function actualizarFocos(s) {
  for (const t of s.equipos) {
    if (t.plan !== 'concentracion') continue;
    const vivos = t.miembros.map((i) => s.fighters[i]).filter(enPie);
    if (!vivos.length) continue;
    const cx = vivos.reduce((a, f) => a + f.x, 0) / vivos.length, cz = vivos.reduce((a, f) => a + f.z, 0) / vivos.length;
    let best = null, bs = -1e9;
    for (const e of s.fighters) {
      if (e.team === t.id || !enPie(e)) continue;
      const sc = -Math.hypot(e.x - cx, e.z - cz) * 0.6 + 4 * Math.max(e.dmg.head, e.dmg.body) / 100 - 0.02 * e.masa / 10 + (e.id === t.foco ? 1.5 : 0);
      if (sc > bs) { bs = sc; best = e; }
    }
    t.foco = best ? best.id : null;
  }
}

function pensar(s, f) {
  const t = s.equipos[f.team];
  const enemigosCerca = s.fighters.filter((o) => enPie(o) && o.team !== f.team && dist(o, f) < 2.5).length;
  // ¿hay un caído para decidir?
  f.victima = null;
  if (s.fase === 'pos') { const v = buscarVictima(s, f, true); if (v) { f.victima = v.id; f.target = null; return; } }
  else if (enemigosCerca === 0 || f.orden === 'vulnerables' || f.fx.remate > 0) {
    const v = buscarVictima(s, f, false);
    if (v && (enemigosCerca === 0 || dist(f, v) < 1.8)) { f.victima = v.id; }
  }
  const o = elegirObjetivo(s, f);
  f.target = o ? o.id : null;
}

function deseoMovimiento(s, f) {
  // devuelve punto deseado y la intensidad
  const t = s.equipos[f.team];
  if (f.victima !== null) {
    const v = s.fighters[f.victima];
    const r = rango(f).opt * 0.9;
    const d = dist(f, v) || 1;
    return { x: v.x + (f.x - v.x) / d * r, z: v.z + (f.z - v.z) / d * r, int: 0.55, mira: v };
  }
  if (f.target === null) {
    if (s.fase === 'pos') return { x: f.x, z: f.z, int: 0, mira: null };
    const a = t.ancla; return { x: a.x + f.slot.lat * 0.5, z: a.z + f.slot.fwd * 0.5, int: 0.4, mira: null };
  }
  const o = s.fighters[f.target];
  const d = dist(f, o) || 0.001;
  const rg = rango(f);
  let want = f.orden === 'distancia' ? rg.max * 0.95 : clamp(rg.opt * f.E.rango, rg.min * 1.05, rg.max * 0.98);
  if (f.E.agarre > 0.3 && f.grabCd <= 0) want = Math.min(want, C.agarre.distancia * 0.8 * f.esc);
  // descansar: IQ alto y sin aire se aleja a respirar
  if (!s.abucheo && f.energy < 22 && f.a.iq > 0.45 && f.E.agresividad < 0.8 && o.energy > f.energy + 15) want = Math.max(want, rg.max * 1.6);
  let dx = (f.x - o.x) / d, dz = (f.z - o.z) / d;
  if (t.plan === 'espacio') { const ro = Math.hypot(o.x, o.z) || 1, cxo = -o.x / ro, czo = -o.z / ro, mx = dx * 0.35 + cxo * 0.65, mz = dz * 0.35 + czo * 0.65, mm = Math.hypot(mx, mz) || 1; dx = mx / mm; dz = mz / mm; }
  // rodear un poco (los de distancia y contra se mueven más en lateral)
  // rodear: gira alrededor del rival manteniendo la distancia buscada
  const lat = (f.E.kite || f.E.contra > 0.6 ? 0.55 : 0.22) * Math.sin(s.t * 0.9 + f.id * 1.7);
  const ca = Math.cos(lat), sa = Math.sin(lat), rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
  let px = o.x + rx * want, pz = o.z + rz * want;
  // rodeado y con poca frialdad: retrocede
  const amen = s.fighters.filter((e) => enPie(e) && e.team !== f.team && dist(e, f) < 3);
  if (!s.abucheo && amen.length >= 2 && f.a.frialdad + (f.fx.rodeado ? -0.25 : 0) < 0.45) {
    const cx = amen.reduce((a, e) => a + e.x, 0) / amen.length, cz = amen.reduce((a, e) => a + e.z, 0) / amen.length;
    const dd = Math.hypot(f.x - cx, f.z - cz) || 1;
    px = f.x + (f.x - cx) / dd * 2.5; pz = f.z + (f.z - cz) / dd * 2.5;
  }
  // proteger: no alejarse mucho del protegido
  if (f.orden === 'proteger' && f.protege !== null && enPie(s.fighters[f.protege])) {
    const p = s.fighters[f.protege];
    if (Math.hypot(px - p.x, pz - p.z) > 3.5) { px = p.x + (px - p.x) * 0.5; pz = p.z + (pz - p.z) * 0.5; }
  }
  if (t.plan === 'defensivo' && !s.abucheo) { const da = Math.hypot(px - t.ancla.x, pz - t.ancla.z); if (da > 4.5) { px = t.ancla.x + (px - t.ancla.x) * 4.5 / da; pz = t.ancla.z + (pz - t.ancla.z) * 4.5 / da; } }
  const err = Math.abs(d - want);
  return { x: px, z: pz, int: clamp(0.25 + err * 0.6, 0.2, 1) * (f.energy < 15 ? 0.6 : 1), mira: o };
}

function iniciarAtaque(s, f, o, opt = {}) {
  const heavy = !opt.counter && s.rng() < f.E.pesado + 0.05 * f.a.strength;
  // por la espalda: estocada rápida al cuerpo (no hace falta cargar, el otro no lo ve venir)
  const estocada = porLaEspalda(f, o);
  const head = !estocada && s.rng() >= f.E.cuerpo;
  const pesado = heavy && !estocada;
  const k = handTimeMul(f) * (opt.combo ? 0.75 : 1) * (estocada ? 0.8 : 1);
  f.action = { tipo: 'ataque', target: o.id, zone: head ? 'head' : 'body', heavy: pesado, estocada, counter: !!opt.counter, phase: 'carga', t: 0,
    carga: f.W.carga * k * (pesado ? 1.3 : 1) * (opt.counter ? 0.7 : 1), recup: f.W.recup * k * (pesado ? 1.25 : 1) };
  Fat.spend(s, f, f.W.coste * C.cardio.ataque * (1 + 0.3 * f.E.ritmo) * (heavy ? 1 + 1.2 * f.a.explosiveness : 1 + 0.4 * f.a.explosiveness));
  ev(s, { tipo: 'ataque', a: f.id, heavy: pesado, estocada, counter: !!opt.counter });
}

function intentarAgarre(s, f, o) {
  f.grabCd = C.agarre.cd;
  const att = 0.5 * f.a.clinch + 0.3 * f.a.strength + 0.2 * Math.log2(f.masa / o.masa + 1);
  const def = 0.4 * o.a.strength + 0.3 * o.a.bodyTough + 0.3 * o.a.agility + 0.2 * Math.log2(o.masa / f.masa + 1);
  Fat.spend(s, f, 2.5);
  if (s.rng() < clamp(0.35 + (att - def) * 0.9, 0.05, 0.85)) {
    o.stagger = C.agarre.derribo; o.trabado = true; o.vx *= 0.2; o.vz *= 0.2;
    Fat.spend(s, o, 3);
    log(s, 'agarre', `{f${f.id}} traba y derriba a {f${o.id}}.`, 0);
    ev(s, { tipo: 'agarre', a: f.id, d: o.id, ok: true });
  } else ev(s, { tipo: 'agarre', a: f.id, d: o.id, ok: false });
}

function actuar(s, f, dt) {
  const r = s.rng;
  // acción en curso
  if (f.action) {
    const a = f.action;
    a.t += dt;
    if (a.tipo === 'remate') {
      const v = s.fighters[a.v];
      if (!caido(v)) { f.action = null; return; }
      if (dist(f, v) > rango(f).max * 1.3) { a.t = Math.min(a.t, a.dur * 0.5); return; }
      if (a.t >= a.dur) {
        f.action = null; f.cd = 0.6;
        // remate con filo: a veces le corta la cabeza
        const ws = Object.keys(R.ARMAS).find((k) => R.ARMAS[k] === f.W);
        if (!(v.esp && v.esp.rearma && !v.rearmado) && s.rng() < R.CUERPO.decapitarRemate * (R.CUERPO.filo[ws] || 0)) { v.decapitado = true; f.st.decap++; ev(s, { tipo: 'decapita', a: f.id, d: v.id }); }
        if (!v.decapitado) desmembrarLetal(s, f, v, s.rng() < 0.4 ? 'head' : 'body');
        f.st.remates++; morir(s, v, f, v.decapitado ? 'un tajo que le arranca la cabeza' : null);
      }
      return;
    }
    if (a.phase === 'carga' && a.t >= a.carga) {
      a.phase = 'recup'; a.t = 0;
      resolver(s, f, s.fighters[a.target], a);
      f.fxv.atk = 0.18;
    } else if (a.phase === 'recup' && a.t >= a.recup * (a.missMul || 1)) {
      f.action = null;
      if (f.comboLeft > 0) { f.comboLeft--; f.cd = 0.05; f.nextCombo = true; }
      else f.cd = 0.15 + (1 - f.E.ritmo) * 0.9 * (1.2 - f.a.handSpeed) + r() * 0.2;
    }
    return;
  }
  if (f.stagger > 0 || f.cd > 0) return;
  // remate/perdón
  if (f.victima !== null) {
    const v = s.fighters[f.victima];
    if (caido(v) && !f.decididos.has(v.id) && dist(f, v) <= rango(f).max * 1.15) decidir(s, f, v);
    if (s.fase === 'pos' || !f.target) return;
  }
  if (f.target === null) return;
  const o = s.fighters[f.target];
  if (!enPie(o)) return;
  const d = dist(f, o), rg = rango(f);
  // agarre
  if (f.E.agarre > 0 && f.grabCd <= 0 && d < C.agarre.distancia * f.esc && r() < f.E.agarre * 0.5) { intentarAgarre(s, f, o); f.cd = 0.4; return; }
  if (d < rg.min * 0.85 || d > rg.max) return;
  if (f.energy < 2 && r() < 0.5) { f.cd = 0.3; return; }   // ahogado: tira menos, pero tira
  const combo = !!f.nextCombo; f.nextCombo = false;
  const ritmo = (0.22 + 0.55 * f.E.ritmo) * Fat.workRateMul(f) * (0.6 + 0.4 * distQ(f, d));
  if (combo || r() < ritmo) {
    if (!combo && r() < f.E.combo * 0.6) f.comboLeft = 1 + Math.floor(r() * (1 + 2 * f.E.combo));
    iniciarAtaque(s, f, o, { combo });
  } else f.cd = 0.12;
}

function mover(s, f, dt) {
  let want = { x: f.x, z: f.z, int: 0, mira: null };
  if (enPie(f) && f.comiendo) { const c = s.fighters[f.comiendo.id]; want = { x: f.x, z: f.z, int: 0, mira: c }; }
  else if (enPie(f) && f.buscaCadaver != null && s.fase === 'pelea') { const c = s.fighters[f.buscaCadaver]; want = { x: c.x, z: c.z, int: 1, mira: c }; }
  else if (enPie(f) && f.stagger <= 0) want = deseoMovimiento(s, f);
  let ax = 0, az = 0;
  const vmax = enPie(f) ? maxSpeed(f) * (f.action ? (f.action.tipo === 'remate' ? 0.2 : 0.35) : 1) : 0;
  const dx = want.x - f.x, dz = want.z - f.z, dd = Math.hypot(dx, dz);
  let tvx = 0, tvz = 0;
  if (dd > 0.08 && vmax > 0) { const sp = Math.min(vmax * want.int, dd * 3); tvx = dx / dd * sp; tvz = dz / dd * sp; }
  // separación de cuerpos (de pie y caídos ocupan lugar; los muertos también)
  for (const o of s.fighters) {
    if (o === f) continue;
    const ox = f.x - o.x, oz = f.z - o.z, od = Math.hypot(ox, oz), min = f.radio + o.radio + 0.12;
    if (od < min && od > 1e-4) { const k = (min - od) / min * 6 * clamp(o.masa / f.masa, 0.3, 3); tvx += ox / od * k; tvz += oz / od * k; }
  }
  const acc = (5 + 7 * f.a.agility) / Math.pow(f.esc, 0.5);
  f.vx += clamp(tvx - f.vx, -acc * dt * 3, acc * dt * 3) * (enPie(f) ? 1 : 0);
  f.vz += clamp(tvz - f.vz, -acc * dt * 3, acc * dt * 3) * (enPie(f) ? 1 : 0);
  if (!enPie(f) || f.stagger > 0) { f.vx *= Math.pow(0.02, dt); f.vz *= Math.pow(0.02, dt); }
  f.x += f.vx * dt; f.z += f.vz * dt;
  const rr = Math.hypot(f.x, f.z), lim = radioDe(s) - f.radio;
  // en la torre de campeones no hay bordes: si un golpe lo saca de la plataforma, se cae y muere
  if (s.cfg.modo === 'campeones' && rr > lim + f.radio * 0.6 && (f.stagger > 0 || !enPie(f)) && f.estado !== 'muerto' && f.ultimoGolpeDe != null) {
    const k = s.fighters[f.ultimoGolpeDe];
    morir(s, f, k, 'un empujón al vacío', true);
    ev(s, { tipo: 'cae', d: f.id });
    return;
  }
  if (rr > lim) { f.x *= lim / rr; f.z *= lim / rr; const nx = f.x / rr, nz = f.z / rr, vn = f.vx * nx + f.vz * nz; if (vn > 0) { f.vx -= vn * nx; f.vz -= vn * nz; } }
  const sp = Math.hypot(f.vx, f.vz);
  f.mi = enPie(f) ? clamp(sp / Math.max(0.5, maxSpeed(f)), 0, 1) : 0;
  // orientación: mira al objetivo; si no hay, hacia donde camina
  if (enPie(f)) {
    let ang = null;
    if (f.action && f.action.tipo === 'ataque') { const o = s.fighters[f.action.target]; ang = Math.atan2(o.z - f.z, o.x - f.x); }
    else if (want.mira) ang = Math.atan2(want.mira.z - f.z, want.mira.x - f.x);
    else if (sp > 0.3) ang = Math.atan2(f.vz, f.vx);
    if (ang !== null) { const giro = C.giro / f.esc * (0.6 + 0.6 * f.a.reflexes) * dt; f.facing += clamp(angDiff(ang, f.facing), -giro, giro); }
  }
}

function cardio(s, f, dt) {
  if (!enPie(f)) return;
  Fat.spend(s, f, C.cardio.mover * f.mi * f.mi * dt);
  const still = Math.pow(clamp(1 - f.mi * 1.6, 0, 1), 1.5);
  const rate = (0.35 + C.cardio.quieto * f.a.recovery) * (0.3 + 0.7 * still) * (f.action ? 0.15 : 1) * (1 - 0.5 * Math.min(1, f.dmg.body / 100));
  if (f.energy < f.reserve) f.energy = Math.min(f.reserve, f.energy + rate * dt);
  f.energy = clamp(f.energy, 0, f.reserve);
}

/* ---------- paso de simulación ---------- */
function paso(s) {
  if (s.fin) return;
  const dt = C.dt;
  s.t += dt;
  if (Math.floor(s.t) !== Math.floor(s.t - dt)) {
    actualizarFocos(s);
    // el público empuja la pelea al centro: las anclas de cada equipo se van acercando
    if (s.t > C.anclaDesde) for (const t of s.equipos) { t.ancla.x *= 1 - C.anclaRitmo; t.ancla.z *= 1 - C.anclaRitmo; }
    const quieto = s.t - (s.ultimoGolpe || 0);
    if (s.fase === 'pelea' && !s.abucheo && quieto > C.abucheoTras) { s.abucheo = true; log(s, 'publico', 'El público abuchea: nadie se anima. Los lanistas mandan a todos al frente.', 1); }
    else if (s.abucheo && quieto < 2) s.abucheo = false;
  }
  // se actualizan en orden alternado: si no, el equipo que va primero en la lista tiene ventaja (o desventaja) en los cruces parejos
  s.tick = (s.tick || 0) + 1;
  for (const f of (s.tick % 2 ? s.fighters : s.fighters.slice().reverse())) {
    f.cd = Math.max(0, f.cd - dt); f.stagger = Math.max(0, f.stagger - dt); f.exposed = Math.max(0, f.exposed - dt); f.grabCd = Math.max(0, f.grabCd - dt);
    if (f.stagger <= 0) f.trabado = false;
    f.recent = Math.max(0, f.recent - dt * 0.35);
    for (const k of ['flash', 'atk', 'hurt']) f.fxv[k] = Math.max(0, f.fxv[k] - dt);
    if (f.dizzy > 0) { f.dizzy -= dt; if (f.dizzy <= 0) { f.dizzy = 0; rederivar(f, false); } }
    const activo = enPie(f) && (s.fase === 'pelea' || s.equipos[f.team].ganador);
    // ghoul: si ve un cadáver, va a comérselo aunque le estén pegando
    if (activo && f.esp && f.esp.come && s.fase === 'pelea' && ghoul(s, f, dt)) { mover(s, f, dt); cardio(s, f, dt); continue; }
    if (activo) {
      f.think -= dt;
      if (f.think <= 0) { pensar(s, f); f.think = 0.12 + 0.2 * (1 - f.a.iq); }
      actuar(s, f, dt);
    }
    // razas especiales
    if (f.rearmar !== null && f.estado === 'caido' && s.t >= f.rearmar) {
      f.rearmar = null;
      if (s.fase === 'pelea') { f.estado = 'pelea'; f.finT = null; f.causa = null; f.dmg.head = f.dmg.body = 45; f.stagger = 0.6; log(s, 'critico', `¡{f${f.id}} se vuelve a armar y sigue peleando!`, 3); ev(s, { tipo: 'rearma', d: f.id }); }
    }
    if (f.lobo && enPie(f) && s.fase === 'pelea') {
      if (!f.lobo.on && (s.t >= f.lobo.t || Math.max(f.dmg.head, f.dmg.body) >= R.RAZAS.lobo.transforma.danio)) transformar(s, f);
      if (f.lobo.on) for (const z of ['head', 'body']) f.dmg[z] = Math.max(0, f.dmg[z] - R.RAZAS.lobo.transforma.regen * dt);
    }
    // desangrado: el que sangra pierde vida; si está en el piso y se vacía, muere
    if (f.sangrado > 0 && f.estado !== 'muerto') {
      f.dmg.body += f.sangrado * dt; f.sangrado = Math.max(0, f.sangrado - R.CUERPO.coagula * dt);
      const quien = s.fighters[f.ultimoGolpeDe ?? f.porQuien] || f;
      if (enPie(f) && !f.g.jefe && f.dmg.body >= C.incapacitaEn * 1.15) incapacitar(s, f, quien, 'body');
      else if (caido(f) && f.dmg.body >= R.CUERPO.desangraEn) { log(s, 'muerte', `{f${f.id}} se desangra en la arena.`, 2); morir(s, f, quien, 'desangrado'); }
    }
    mover(s, f, dt);
    cardio(s, f, dt);
    if (enPie(f) && s.fase === 'pelea' && Math.floor(s.t * 2) !== Math.floor((s.t - dt) * 2)) chequearRendicion(s, f, 0.5);
  }
  chequearFin(s);
}

// el ghoul: busca cadáveres en su radio de visión (un cuarto del coliseo), tarda en comer y se cura según su tier
function ghoul(s, f, dt) {
  const CO = f.esp.come;
  if (f.comiendo) {
    const c = s.fighters[f.comiendo.id];
    f.comiendo.t += dt; f.action = null;
    if (f.comiendo.t >= CO.dur) {
      const cura = CO.cura[f.g.tier] ?? 0.1;
      for (const z of ['head', 'body']) f.dmg[z] = Math.max(0, f.dmg[z] - cura * 100);
      c.comido = true; f.comiendo = null; f.buscaCadaver = null;
      log(s, 'critico', `{f${f.id}} se termina de comer a {f${c.id}} y se cura ${Math.round(cura * 100)}%.`, 2);
      ev(s, { tipo: 'comido', a: f.id, d: c.id, cura });
    }
    return true;
  }
  const vision = radioDe(s) * 0.5;   // área = un cuarto del coliseo
  let mejor = null, md = vision;
  for (const c of s.fighters) {
    if (c.estado !== 'muerto' || c.comido || c.alVacio || (c.comidoPor != null && c.comidoPor !== f.id)) continue;
    const d = dist(f, c); if (d < md) { md = d; mejor = c; }
  }
  f.buscaCadaver = mejor ? mejor.id : null;
  if (!mejor) return false;
  f.action = null;
  if (md < 0.8) {
    f.comiendo = { id: mejor.id, t: 0 }; mejor.comidoPor = f.id;
    log(s, 'muerte', `{f${f.id}} se tira sobre el cadáver de {f${mejor.id}} y empieza a comer.`, 2);
    ev(s, { tipo: 'come', a: f.id, d: mejor.id });
  }
  return true;
}
const radioDe = (s) => (s.cfg.modo === 'campeones' ? R.CAMPEONES.radioTorre : C.arenaRadio);
function equiposActivos(s) { return s.equipos.filter((t) => t.miembros.some((id) => enPie(s.fighters[id]) || s.fighters[id].rearmar !== null)); }

function chequearFin(s) {
  if (s.fase === 'pelea') {
    const act = equiposActivos(s);
    let ganador = null, motivo = '';
    if (act.length === 1) { ganador = act[0]; motivo = 'los demás equipos se rindieron o cayeron'; }
    else if (act.length === 0) {
      // todos cayeron a la vez: gana el que hizo más daño  // PROVISIONAL
      ganador = [...s.equipos].sort((a, b) => danioEquipo(s, b) - danioEquipo(s, a))[0]; motivo = 'cayeron todos; gana el que más daño hizo (provisional)';
    } else if (s.t >= C.tiempoLimite) {
      // tiempo cumplido: más luchadores en pie, después más daño  // PROVISIONAL
      ganador = [...act].sort((a, b) => enPieEq(s, b) - enPieEq(s, a) || danioEquipo(s, b) - danioEquipo(s, a))[0];
      motivo = 'se cumplió el tiempo: más gladiadores en pie (provisional)';
      for (const t of act) if (t !== ganador) for (const id of t.miembros) { const f = s.fighters[id]; if (enPie(f)) { f.estado = 'rendido'; f.finT = s.t; f.causa = 'terminó en pie, pero su equipo perdió por tiempo'; } }
    }
    if (ganador) {
      ganador.ganador = true; s.ganador = ganador.id; s.motivo = motivo;
      log(s, 'fin', `¡{t${ganador.id}} gana la pelea! (${motivo}). Ahora decide sobre los caídos…`, 3);
      s.fase = 'pos'; s.posT = 0;
      ev(s, { tipo: 'finPelea', ganador: ganador.id });
    }
    return;
  }
  if (s.fase === 'pos') {
    s.posT += C.dt;
    const ganadores = s.equipos[s.ganador].miembros.map((i) => s.fighters[i]).filter(enPie);
    const pendientes = ganadores.some((f) => f.action || buscarVictima(s, f, true));
    if (!pendientes || s.posT >= C.posPelea) cerrar(s);
  }
}
const danioEquipo = (s, t) => t.miembros.reduce((a, id) => a + s.fighters[id].st.hecho, 0);
const enPieEq = (s, t) => t.miembros.filter((id) => enPie(s.fighters[id])).length;

/* ---------- cierre: récord, oro del pueblo, recompensas ---------- */
function cerrar(s) {
  s.fase = 'fin';
  const RC = R.RECOMPENSAS;
  for (const f of s.fighters) {
    const gan = f.team === s.ganador;
    if (f.estado === 'muerto') f.resultado = 'Muerte';
    else if (gan) f.resultado = 'Victoria';
    else if (f.estado === 'rendido') f.resultado = 'Rendición';
    else if (f.estado === 'caido') f.resultado = 'Incapacitado (perdonado)';
    else f.resultado = 'Derrota con supervivencia';
    if (gan && f.estado === 'caido') f.resultado = 'Victoria (cayó, pero su equipo ganó)';
  }
  const eqs = s.equipos.map((t) => {
    const m = t.miembros.map((i) => s.fighters[i]);
    return { id: t.id, muertes: m.reduce((a, f) => a + f.st.muertes, 0), sangre: m.filter((f) => f.estado === 'muerto').length,
      danio: Math.max(...m.map((f) => f.st.hecho)), danioQuien: m.reduce((b, f) => (f.st.hecho > b.st.hecho ? f : b)).id, vivos: m.filter((f) => f.estado !== 'muerto').length,
      oro: t.id === s.ganador ? RC.oroGanador : RC.oroResto, puntos: t.id === s.ganador ? (s.cfg.ultima ? RC.puntosUltimaPelea : RC.puntosPelea) : 0, logros: [] };
  });
  // pelea de campeones: sin oro del pueblo; el ganador se lleva 10 oro por jugador, 3 puntos y 1 por campeón que mató;
  // los que pierden ganan 1 punto si mataron a alguno (decidido por Merlin)
  if (s.cfg.modo === 'campeones') {
    const C = R.CAMPEONES;
    for (const e of eqs) {
      if (e.id === s.ganador) { e.oro = C.oroPorJugador * s.equipos.length; e.puntos = C.puntosGanador + e.muertes * C.puntoPorMuerte; }
      else { e.oro = 0; e.puntos = e.muertes > 0 ? C.puntoPerdedorQueMato : 0; }
    }
    s.logros = [];
    s.fin = { ganador: s.ganador, motivo: s.motivo, equipos: eqs, tiempo: s.t, modo: 'campeones' };
    log(s, 'fin', s.ganador !== null ? `¡{t${s.ganador}} gana la pelea de campeones!` : 'Nadie sobrevivió a la torre.', 3);
    ev(s, { tipo: 'cierre' });
    return;
  }
  const logros = [
    { k: 'muertes', label: 'Más muertes', val: (e) => e.muertes },
    { k: 'sangre', label: 'Más sangre perdida', val: (e) => e.sangre },
    { k: 'danio', label: 'Mayor daño individual', val: (e) => e.danio },
    { k: 'vivos', label: 'Más supervivientes', val: (e) => e.vivos },
  ];
  s.logros = [];
  for (const L of logros) {
    const mx = Math.max(...eqs.map(L.val));
    if (mx <= 0) { s.logros.push({ k: L.k, label: L.label, ganadores: [], nadie: true }); continue; }   // nadie lo consiguió: esa parte no se reparte  // PROVISIONAL
    let g = eqs.filter((e) => L.val(e) === mx);
    // empate: se lo lleva el que menos dinero tiene (decidido por Merlin)
    const empate = g.length > 1;
    if (empate) { const riq = (e) => (s.cfg.equipos[e.id].riqueza ?? 0); const min = Math.min(...g.map(riq)); g = [g.find((e) => riq(e) === min)]; }
    const parte = RC.reparto[L.k];
    for (const e of g) { e.oro += parte; e.puntos += RC.puntosLogro; e.logros.push(L.label); }
    s.logros.push({ k: L.k, label: L.label, ganadores: g.map((e) => e.id), valor: mx, parte, empate });
  }
  s.fin = { ganador: s.ganador, motivo: s.motivo, equipos: eqs, tiempo: s.t };
  // los caídos que quedaron sin decidir se salvan
  for (const f of s.fighters) if (caido(f) && f.team !== s.ganador) {
    if (!f.perdonadoPor.length) log(s, 'perdon', `{f${f.id}} queda con vida: nadie se acercó a rematarlo.`, 1);
  }
  log(s, 'fin', `Fin. ${s.logros.filter((l) => !l.nadie).map((l) => `${l.label}: ${l.ganadores.map((i) => `{t${i}}`).join(' y ')}`).join(' · ')}`, 3);
  ev(s, { tipo: 'cierre' });
}

/* ---------- aplicar resultado a los gladiadores (persisten lesiones y récord) ---------- */
function aplicarResultado(s) {
  for (const f of s.fighters) {
    const g = f.g, r = g.record;
    if (f.resultado.startsWith('Victoria')) r.v++; else r.d++;
    if (f.estado === 'rendido') r.rendiciones++;
    r.muertes += f.st.muertes;
    g.lesiones = { ...f.inj };
    g.vivo = f.estado !== 'muerto';
    // si sobrevive sin un miembro, el médico le pone una prótesis (garfio o pata de palo)
    if (g.vivo) for (const [m, e] of Object.entries(f.miembros)) {
      if (e === 'cortado') { g.protesis = { ...(g.protesis || {}), [m]: m[0] === 'b' ? 'garfio' : 'pata' }; g.lesiones[m === 'bA' ? 'fxA' : m === 'bE' ? 'fxE' : 'fxP'] = 0; }
    }
    g.vida = g.vivo ? Math.max(5, Math.min(100, Math.round(100 - Math.max(f.dmg.head, f.dmg.body)))) : 0;
  }
}

function simular(cfg, maxT = 600) {
  const s = crearPelea(cfg);
  while (!s.fin && s.t < maxT) paso(s);
  return s;
}

root.Motor = {
  mulberry32, subirUID, generarGladiador, generarLote, derivar, crearPelea, paso, simular, aplicarResultado,
  probRemate, rango, enPie, caido, INJ, PLANES, ORDENES, FORMACIONES, razaVisual, razaLabel, pielDe, PIELES_HUMANAS,
};
if (typeof module !== 'undefined') module.exports = root.Motor;
})(typeof window !== 'undefined' ? window : globalThis);
