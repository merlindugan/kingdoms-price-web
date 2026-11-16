/* AJUSTES del jugador (se eligen en el menú): 3D/2D, nivel de gráficos y si quiere luces y partículas */
(function (root) {
  const leer = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const poner = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin storage */ } };
  root.Ajustes = {
    // en celular arranca en gráficos bajos (el jugador lo puede subir en Ajustes); en compu, altos
    celu() { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '') || (root.matchMedia && root.matchMedia('(pointer: coarse)').matches); },
    nivel(v) { if (v) poner('coliseo_nivel', v); return leer('coliseo_nivel', this.celu() ? 'bajo' : 'alto'); },               // alto | medio | bajo
    fx(v) { if (v != null) poner('coliseo_fx', v ? '1' : '0'); return leer('coliseo_fx', '1') !== '0'; },   // luces volumétricas y polvo
    q() { return { alto: 0.8, medio: 0.65, bajo: 0.55 }[this.nivel()] || 0.8; },                        // cubitos por unidad (detalle de los cuerpos 3D): personajes simplificados, misma silueta
    // resolución: siempre la de la pantalla (nítido); en celulares con pantallas muy densas se pone un tope para no dibujar de más
    pr() { const d = root.devicePixelRatio || 1; return Math.max(1, Math.min(d, { alto: 2, medio: 1.75, bajo: 1.5 }[this.nivel()] || 1.75)); },   // resolución de la pelea
  };
})(typeof window !== 'undefined' ? window : globalThis);
/* =====================================================================
   COLISEO · CARNE 3D EN VOXELS · versión 2 (laboratorio)
   Gladiador articulado hecho de cubitos, con anatomía por raza y animación.
   - El cuerpo se modela con formas redondeadas (elipsoides y perfiles) que
     se funden entre sí; después se "voxeliza" y se rellena por profundidad:
     piel → músculo → venas/arterias/órganos → hueso.
   - Los golpes le sacan vida a los cubitos; lo que queda sin unión se cae.
   - Cara y sangre son 2D (decisión de Merlin).
   Interfaz:
     const M = Voxel.crearMundo(canvas)
     M.nuevo({ raza })            M.anim('caminar')
     M.golpearPantalla(x, y, tipo, fuerza)     M.golpeAzar(tipo, fuerza)
     M.rayos(n)   M.estado()   M.paso(dt)   M.tam(w, h)
   ===================================================================== */
(function (root) {
const T = root.THREE;
let Q = 1.4;            // cubitos por unidad anatómica (más = más detalle; en el juego se usa menos)
const U = 0.022;        // una unidad anatómica = 2,2 cm
let S = U / Q;          // tamaño del cubito
const V = { piel: 1, musculo: 2, vena: 3, arteria: 4, organo: 5, hueso: 6, cerebro: 7, pelo: 8, tela: 9, cinto: 10, pulmon: 11, corazon: 12, tripa: 13, medula: 14, unia: 15, higado: 16, colmillo: 17, nariz: 18, metal: 19, cuero: 20, madera: 21, toga: 22, oro: 23 };
const HP = [0, 1, 1.6, 0.8, 0.8, 0.9, 4.5, 0.8, 0.4, 0.7, 0.9, 0.9, 1, 0.9, 3, 0.8, 1, 2, 0.8, 4, 1.8, 3, 0.7, 4];
const CAPA = [0, 0, 1, 2, 2, 2, 3, 2, 0, 0, 0, 2, 2, 2, 3, 0, 2, 0, 0, 0, 0, 0, 0, 0];   // para los rayos X
const COL = [0, 0, 0xa3281f, 0x4a2a7a, 0xe8261c, 0xd97a8a, 0xeee4cc, 0xd8a8a8, 0x2e1c10, 0xb03a2e, 0x6a4320, 0xd88a8a, 0x7a0e14, 0xd9909a, 0xb46a5a, 0xe8dcc0, 0x6e2a1e, 0xeee6cc, 0x1a1412, 0x9aa2ac, 0x7a4a24, 0x8a6236, 0xeee8da, 0xd4a52a];
const NOMBRE = { pelvis: 'Cadera', pecho: 'Torso', cabeza: 'Cabeza', brazoD: 'Brazo (arma)', anteD: 'Antebrazo (arma)', brazoI: 'Brazo izquierdo', anteI: 'Antebrazo izquierdo', musloD: 'Muslo derecho', piernaD: 'Pierna derecha', musloI: 'Muslo izquierdo', piernaI: 'Pierna izquierda', faldaF: 'Falda', faldaT: 'Falda' };
const hash = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------------------
   RAZAS: proporciones y rasgos (medidas en unidades anatómicas)
   --------------------------------------------------------------------- */
const BASE = {
  esc: 1, piel: 0xc8956a, pelo: 0x2e1c10, ruido: 0.07,
  hombros: 11.6, cadera: 4.7, pechoAlto: 22.5,
  pecho: [10.4, 5.7], costillar: [9.4, 5.4], cintura: [7.5, 4.5], caderas: [8.7, 5.3], hombroTop: [9.2, 4.6],
  panza: 0, pecs: 1, traps: 1, pared: 2.3,
  brazo: 15.5, ante: 13.5, rBrazo: 3.0, rAnte: 2.6, mano: 1, garras: false,
  muslo: 21, pierna: 19.5, rMuslo: 4.8, rPierna: 3.2, pie: 1,
  cuello: [2.9, 3.0, 4.2], cabeza: [5.2, 6.3, 6.0], cabN: 2.5, mandibula: 1,
  orejas: 'normal', peinado: 'corto', barba: false, colmillos: false, ceja: false, hocico: false, cola: false, flaco: false, ojeras: false,
  joroba: 0, cara: { ojo: 2, sep: 4, boca: 6, color: '#16100c' },
  altura: 1.8, hueso: 1, presion: 1,   // altura promedio en metros · grosor de huesos · presión de la sangre
};
const RAZAS = {
  humano: {},
  orco: { altura: 2.0, hueso: 1.05, piel: 0x6f8f45, pelo: 0x141414, hombros: 14.2, pecho: [12.8, 6.9], costillar: [11.2, 6.4], cintura: [8.9, 5.4], caderas: [9.4, 5.8], hombroTop: [11.4, 5.6], traps: 1.5, pecs: 1.15,
    brazo: 17, ante: 15, rBrazo: 4.3, rAnte: 3.7, mano: 1.35, muslo: 19, pierna: 18, rMuslo: 6.0, rPierna: 4.1, pie: 1.15,
    cuello: [3.9, 3.9, 2.4], cabeza: [5.7, 5.7, 6.2], mandibula: 1.22, orejas: 'punta', peinado: 'cresta', colmillos: true, ceja: true, joroba: 0.2, cara: { ojo: 2, sep: 4, boca: 7, color: '#120c08' } },
  goblin: { altura: 1.1, hueso: 0.72, piel: 0x93a548, pelo: 0x2a2010, hombros: 8.8, pecho: [7.6, 4.9], costillar: [7.4, 5.0], cintura: [7.0, 5.0], caderas: [7.2, 4.8], hombroTop: [6.6, 3.9], panza: 4.2, pecs: 0.85, traps: 0.85,
    brazo: 14.5, ante: 14, rBrazo: 2.6, rAnte: 2.4, mano: 1.2, muslo: 13.5, pierna: 13, rMuslo: 4.1, rPierna: 3.0, pie: 1.3, pechoAlto: 19,
    cuello: [2.3, 2.4, 2.6], cabeza: [6.9, 6.6, 6.8], cabN: 2.3, mandibula: 0.82, orejas: 'goblin', peinado: 'calvo', joroba: 0.24, cara: { ojo: 3, sep: 5, boca: 8, color: '#141008' } },
  gigante: { altura: 3.0, hueso: 1.55, presion: 1.6, piel: 0xb98a68, pelo: 0x4a3018, hombros: 14.6, pecho: [13.6, 7.6], costillar: [12.8, 7.6], cintura: [11.6, 7.2], caderas: [11.4, 7.0], hombroTop: [11.6, 6.0], panza: 6.6, pecs: 1.1, traps: 1.3, pared: 2.8,
    brazo: 16, ante: 14, rBrazo: 4.2, rAnte: 3.6, mano: 1.4, muslo: 20, pierna: 19, rMuslo: 6.6, rPierna: 4.5, pie: 1.3, cadera: 5.8,
    cuello: [4.0, 4.0, 2.6], cabeza: [5.0, 5.9, 5.7], mandibula: 1.1, peinado: 'corto', barba: true, cara: { ojo: 2, sep: 4, boca: 5, color: '#16100c' } },
  ghoul: { altura: 1.8, piel: 0x8d9a86, pelo: 0x1a1a1a, hombros: 10.2, pecho: [8.8, 4.7], costillar: [8.2, 4.6], cintura: [5.4, 3.5], caderas: [7.0, 4.4], hombroTop: [8.2, 4.0], pecs: 0.45, traps: 0.7, pared: 1.7,
    brazo: 17.5, ante: 16.5, rBrazo: 2.0, rAnte: 1.8, mano: 1.15, garras: true, muslo: 21, pierna: 20, rMuslo: 3.3, rPierna: 2.3,
    cuello: [2.3, 2.4, 4.6], cabeza: [4.8, 6.5, 5.8], mandibula: 0.9, peinado: 'calvo', flaco: true, ojeras: true, joroba: 0.36, cara: { ojo: 2, sep: 4, boca: 8, color: '#0c0a08', estilo: 'ghoul' } },
  lobo: { altura: 2.0, hueso: 1.05, piel: 0x5c4a3a, pelo: 0x2e241c, ruido: 0.2, hombros: 13.6, pecho: [12.2, 7.4], costillar: [10.4, 6.6], cintura: [6.8, 4.8], caderas: [7.8, 5.2], hombroTop: [11, 5.8], traps: 1.6, pecs: 1.1,
    brazo: 17, ante: 15.5, rBrazo: 3.6, rAnte: 3.0, mano: 1.3, garras: true, muslo: 20, pierna: 19, rMuslo: 5.0, rPierna: 3.0, pie: 1.25,
    cuello: [3.8, 3.9, 2.6], cabeza: [4.9, 5.5, 5.6], mandibula: 0.9, orejas: 'lobo', peinado: 'calvo', hocico: true, cola: true, joroba: 0.3, cara: { ojo: 2, sep: 4, boca: 0, color: '#f2c832', estilo: 'lobo' } },
};
const razaDe = (n) => { const r = { ...BASE, ...(RAZAS[n] || {}) }; r.cara = { ...BASE.cara, ...((RAZAS[n] || {}).cara || {}) }; r.nombre = n; return r; };

/* ---------------------------------------------------------------------
   FORMAS: elipsoides (e) y perfiles a lo largo del eje Y (p)
   --------------------------------------------------------------------- */
const E = (c, r, n) => ({ t: 'e', c, r, n: n || 2 });
const P = (st, o = {}) => ({ t: 'p', st, n: o.n || 2, cap0: o.cap0, cap1: o.cap1 });
const tubo = (x, z, y0, y1, r) => P([[y0, x, z, r, r], [y1, x, z, r, r]], { cap0: r, cap1: r });
const capDe = (p, fin) => { const s = fin ? p.st[p.st.length - 1] : p.st[0], c = fin ? p.cap1 : p.cap0; return c != null ? c : Math.min(s[3], s[4]) * 0.8; };
function dPrim(p, x, y, z) {
  if (p.t === 'e') {
    const a = Math.abs((x - p.c[0]) / p.r[0]), b = Math.abs((y - p.c[1]) / p.r[1]), c = Math.abs((z - p.c[2]) / p.r[2]);
    return p.n === 2 ? Math.sqrt(a * a + b * b + c * c) : Math.pow(Math.pow(a, p.n) + Math.pow(b, p.n) + Math.pow(c, p.n), 1 / p.n);
  }
  const st = p.st, m = st.length - 1;
  let cx, cz, rx, rz, e = 0;
  if (y <= st[0][0]) { [, cx, cz, rx, rz] = st[0]; e = (st[0][0] - y) / capDe(p, 0); }
  else if (y >= st[m][0]) { [, cx, cz, rx, rz] = st[m]; e = (y - st[m][0]) / capDe(p, 1); }
  else {
    let i = 0; while (y > st[i + 1][0]) i++;
    const a = st[i], b = st[i + 1]; let t = (y - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t);
    cx = lerp(a[1], b[1], t); cz = lerp(a[2], b[2], t); rx = lerp(a[3], b[3], t); rz = lerp(a[4], b[4], t);
  }
  const a = Math.abs((x - cx) / rx), c = Math.abs((z - cz) / rz);
  const d = p.n === 2 ? Math.sqrt(a * a + c * c) : Math.pow(Math.pow(a, p.n) + Math.pow(c, p.n), 1 / p.n);
  return e ? Math.sqrt(d * d + e * e) : d;
}
const KF = 9;   // qué tan suave se funden las formas entre sí
function campo(prims, x, y, z) { let s = 0; for (let i = 0; i < prims.length; i++) { const d = dPrim(prims[i], x, y, z); if (d < 2) s += Math.exp(-KF * d); } return s > 0 ? -Math.log(s) / KF : 9; }
const dentroDe = (prims, x, y, z) => { for (let i = 0; i < prims.length; i++) if (dPrim(prims[i], x, y, z) < 1) return true; return false; };

/* ---------------------------------------------------------------------
   PARTE: grilla de cubitos con su articulación en el origen
   def = { prims, extras:[{prims,tipo,si}], interior:[{prims,tipo,prof}], relleno, superficie, pinta, ancla, clipY, largo }
   --------------------------------------------------------------------- */
function crearParte(nombre, def) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  const caja = (p) => {
    if (p.t === 'e') for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p.c[a] - p.r[a] * 1.16); mx[a] = Math.max(mx[a], p.c[a] + p.r[a] * 1.16); }
    else { mn[1] = Math.min(mn[1], p.st[0][0] - capDe(p, 0) * 1.16); mx[1] = Math.max(mx[1], p.st[p.st.length - 1][0] + capDe(p, 1) * 1.16); for (const s of p.st) { mn[0] = Math.min(mn[0], s[1] - s[3] * 1.16); mx[0] = Math.max(mx[0], s[1] + s[3] * 1.16); mn[2] = Math.min(mn[2], s[2] - s[4] * 1.16); mx[2] = Math.max(mx[2], s[2] + s[4] * 1.16); } }
  };
  def.prims.forEach(caja); (def.extras || []).forEach((x) => x.prims.forEach(caja));
  if (def.clipY != null) mn[1] = Math.max(mn[1], def.clipY);
  const g0 = mn.map((v) => Math.floor(v * Q) - 2), g1 = mx.map((v) => Math.ceil(v * Q) + 2);
  const nx = g1[0] - g0[0] + 1, ny = g1[1] - g0[1] + 1, nz = g1[2] - g0[2] + 1, n = nx * ny * nz;
  const tipo = new Uint8Array(n), D = new Float32Array(n);
  const id = (i, j, k) => i + nx * (k + nz * j);
  // 1) qué cubitos son cuerpo
  for (let j = 0; j < ny; j++) { const y = (j + g0[1]) / Q; if (def.clipY != null && y < def.clipY) continue; for (let k = 0; k < nz; k++) { const z = (k + g0[2]) / Q; for (let i = 0; i < nx; i++) if (campo(def.prims, (i + g0[0]) / Q, y, z) < 1) D[id(i, j, k)] = 1e9; } }
  // 2) profundidad de cada cubito bajo la superficie (transformada de distancia en dos pasadas)
  const offs = []; for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) if (dj < 0 || (dj === 0 && (dk < 0 || (dk === 0 && di < 0)))) offs.push([di, dj, dk, Math.hypot(di, dj, dk)]);
  const pasada = (sg) => {
    for (let jj = 0; jj < ny; jj++) for (let kk = 0; kk < nz; kk++) for (let ii = 0; ii < nx; ii++) {
      const i = sg > 0 ? ii : nx - 1 - ii, j = sg > 0 ? jj : ny - 1 - jj, k = sg > 0 ? kk : nz - 1 - kk, q = id(i, j, k);
      if (!D[q]) continue; let m = D[q];
      for (const [di, dj, dk, w] of offs) { const a = i + di * sg, b = j + dj * sg, c = k + dk * sg; const v = (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) ? 0 : D[id(a, b, c)]; if (v + w < m) m = v + w; }
      D[q] = m;
    }
  };
  pasada(1); pasada(-1);
  // 3) qué es cada cubito
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const q = id(i, j, k), x = (i + g0[0]) / Q, y = (j + g0[1]) / Q, z = (k + g0[2]) / Q;
    if (!D[q]) { for (const ex of def.extras || []) if ((!ex.si || ex.si(x, y, z)) && dentroDe(ex.prims, x, y, z)) { tipo[q] = ex.tipo; break; } continue; }
    if (D[q] <= 1.001) { tipo[q] = (def.superficie && def.superficie(x, y, z)) || V.piel; continue; }
    const dU = D[q] / Q; let t = 0;
    for (const it of def.interior || []) if (dU >= (it.prof || 0) && dentroDe(it.prims, x, y, z)) { t = it.tipo; break; }
    tipo[q] = t || (def.relleno && def.relleno(x, y, z, dU)) || V.musculo;
  }
  // 4) sombreado fijo de la superficie: huecos más oscuros, salientes más claros, más las líneas pintadas del músculo
  const sombra = new Float32Array(n).fill(1);
  const lleno = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && tipo[id(i, j, k)] !== 0;
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const q = id(i, j, k); if (!tipo[q]) continue;
    if (lleno(i + 1, j, k) && lleno(i - 1, j, k) && lleno(i, j + 1, k) && lleno(i, j - 1, k) && lleno(i, j, k + 1) && lleno(i, j, k - 1)) continue;
    let c = 0; for (let dj = -2; dj <= 2; dj++) for (let dk = -2; dk <= 2; dk++) for (let di = -2; di <= 2; di++) if (lleno(i + di, j + dj, k + dk)) c++;
    let f = clamp(1 + (0.6 - c / 125) * 1.05, 0.62, 1.2);
    if (def.pinta && tipo[q] === V.piel) f *= def.pinta((i + g0[0]) / Q, (j + g0[1]) / Q, (k + g0[2]) / Q);
    sombra[q] = f;
  }
  const p = { nombre, nx, ny, nz, g0, tipo, orig: tipo.slice(), sombra, hp: new Float32Array(n), grieta: new Float32Array(n), moreton: new Float32Array(n), sangre: new Float32Array(n), vivo: new Uint8Array(n), hijos: [], chorros: [], roto: null, suelto: false, venas: 0, arterias: 0, largo: def.largo || 0, padre: null };
  for (let q = 0; q < n; q++) if (tipo[q]) { p.vivo[q] = 1; p.hp[q] = HP[tipo[q]]; }
  p.vivos0 = p.vivo.reduce((a, b) => a + b, 0);
  p.ancla = (i, j, k) => def.ancla((i + g0[0]) / Q, (j + g0[1]) / Q, (k + g0[2]) / Q);
  if (p.largo) { p.huesoFila = new Uint16Array(ny); for (let q = 0; q < n; q++) if (tipo[q] === V.hueso || tipo[q] === V.medula) p.huesoFila[(q / (nx * nz)) | 0]++; }
  p.lista = (cond) => { const out = []; for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const q = id(i, j, k); if (tipo[q] && cond((i + g0[0]) / Q, (j + g0[1]) / Q, (k + g0[2]) / Q, tipo[q])) out.push(q); } return out; };
  p.grupo = new T.Group(); p.grupo.name = nombre;
  return p;
}
function soloHuesos(p, cab) {
  const deja = [V.hueso, V.medula, V.colmillo, V.tela, V.cinto, V.metal, V.cuero, V.toga, V.oro], ropa = [V.tela, V.cinto, V.metal, V.cuero, V.toga, V.oro];
  const { nx, ny, nz, tipo } = p, n = tipo.length, carne = (t) => t && t !== V.pelo && !ropa.includes(t);
  const lleno = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && carne(tipo[i + nx * (k + nz * j)]);
  // con pocos cubitos (calidad baja) los huesos finitos desaparecen: la cabeza queda calavera maciza y los miembros flacos se quedan con el centro
  let hue = 0, cuerpo = 0; for (let q = 0; q < n; q++) { if (carne(tipo[q])) cuerpo++; if (tipo[q] === V.hueso || tipo[q] === V.medula) hue++; }
  let nucleo = null;
  if (cab) nucleo = (q) => carne(tipo[q]);
  else if (p.nombre === 'pecho' && hue < cuerpo * 0.3) {   // torso: costillas a rayas y la columna atrás
    const sup = (j) => j > ny * 0.38 && j < ny * 0.92;
    nucleo = (q) => { const t = tipo[q]; if (t === V.hueso || t === V.medula) return true; if (!carne(t)) return false; const j = (q / (nx * nz)) | 0, k = ((q / nx) | 0) % nz, i = q % nx; return (sup(j) && (j & 1) === 0) || (Math.abs(i - (nx - 1) / 2) < 1 && k < nz * 0.55); };
  } else if (cuerpo && hue < Math.max(6, ny * 1.2)) {
    const cen = new Uint8Array(n); let c = 0;
    for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const q = i + nx * (k + nz * j); if (carne(tipo[q]) && lleno(i + 1, j, k) && lleno(i - 1, j, k) && lleno(i, j, k + 1) && lleno(i, j, k - 1)) { cen[q] = 1; c++; } }
    nucleo = c >= Math.max(4, cuerpo * 0.1) ? (q) => cen[q] || tipo[q] === V.hueso || tipo[q] === V.medula : (q) => carne(tipo[q]);
  }
  for (let q = 0; q < n; q++) {
    if (nucleo && nucleo(q)) { tipo[q] = p.orig[q] = V.hueso; p.hp[q] = HP[V.hueso]; p.vivo[q] = 1; continue; }
    if (tipo[q] && !deja.includes(tipo[q])) { tipo[q] = 0; p.orig[q] = 0; p.vivo[q] = 0; } else if (tipo[q] === V.medula) { tipo[q] = p.orig[q] = V.hueso; p.hp[q] = HP[V.hueso]; }
  }
  p.vivos0 = p.vivo.reduce((a, b) => a + b, 0); p.sombra.fill(1);
  if (cab && p.caraInfo) {   // cuencas de los ojos, agujero de la nariz y dientes, pintados oscuros en el frente de la calavera
    const ci = p.caraInfo, hx = ci.lado / 1.96, ojoY = ci.y + ci.dy / 2, bocaY = ci.y - ci.dy / 2, r = Math.max(0.75, 1.25 * Q);
    const frente = (x, y) => { const i = Math.round(x * Q - p.g0[0]), j = Math.round(y * Q - p.g0[1]); if (i < 0 || j < 0 || i >= nx || j >= ny) return -1; for (let k = nz - 1; k >= 0; k--) if (tipo[i + nx * (k + nz * j)]) return i + nx * (k + nz * j); return -1; };
    const pintar = (x, y, rr, f) => { for (let dx = -rr; dx <= rr; dx += 0.5 / Q) for (let dy = -rr; dy <= rr; dy += 0.5 / Q) if (dx * dx + dy * dy <= rr * rr) { const q = frente(x + dx, y + dy); if (q >= 0) p.sombra[q] = Math.min(p.sombra[q], f); } };
    for (const s of [-1, 1]) pintar(s * hx * 0.42, ojoY, r / Q * 0.9, 0.16);
    pintar(0, (ojoY + bocaY) / 2, 0.45 / Q, 0.3);
    for (let x = -hx * 0.4; x <= hx * 0.4; x += 1 / Q) { const q = frente(x, bocaY); if (q >= 0) p.sombra[q] = (Math.round(x * Q) & 1) ? 0.35 : 0.8; }
  }
}
const idx = (p, i, j, k) => i + p.nx * (k + p.nz * j);
const dentro = (p, i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < p.nx && j < p.ny && k < p.nz;
const posLocal = (p, i, j, k, out) => out.set((i + p.g0[0]) * S, (j + p.g0[1]) * S, (k + p.g0[2]) * S);
const aGrilla = (p, u) => [u[0] * Q - p.g0[0], u[1] * Q - p.g0[1], u[2] * Q - p.g0[2]];

/* ---------------------------------------------------------------------
   ANATOMÍA: arma todas las partes de una raza
   --------------------------------------------------------------------- */
function anatomia(R) {
  const k = R.pechoAlto / 22.5, wp = R.pecho[0] / 10.4, [cw, cd] = R.cintura, [pw, pd] = R.pecho;
  /* ---- pelvis (raíz) ---- */
  const gl = R.rMuslo / 4.8, [hw, hd] = R.caderas, hb = R.hueso;
  const pelvisPr = [E([0, 0.6, 0], [hw, 6.2, hd], 2.4), E([-R.cadera * 0.85, -1.2, -hd * 0.5], [4.3 * gl, 4.6 * gl, 3.6 * gl]), E([R.cadera * 0.85, -1.2, -hd * 0.5], [4.3 * gl, 4.6 * gl, 3.6 * gl])];
  if (R.cola) pelvisPr.push(E([0, 1, -hd - 1.6], [1.6, 1.6, 3.2]), E([0, -0.6, -hd - 5], [1.5, 1.7, 3.2]), E([0, -3.4, -hd - 7.8], [1.3, 2.6, 2.3]));
  const pelvis = crearParte('pelvis', {
    prims: pelvisPr,
    superficie: (x, y, z) => (R.armadura === 'toga' ? (y > 3.2 && y < 4.6 ? V.tela : V.toga) : z < -hd - 0.6 ? V.piel : y > 3.2 ? V.cinto : V.tela),
    interior: [
      { tipo: V.hueso, prims: [E([-3.7, 1.2, -0.4], [3.3 * hb, 3.5 * hb, 2.6 * hb]), E([3.7, 1.2, -0.4], [3.3 * hb, 3.5 * hb, 2.6 * hb]), E([0, 1.6, -hd + 2.4], [2 * hb, 3.6, 1.5 * hb])], prof: 1.5 },
      { tipo: V.arteria, prims: [tubo(-1.5, -0.4, -3, 7, 0.75)] }, { tipo: V.vena, prims: [tubo(1.5, -0.4, -3, 7, 0.75)] },
    ],
    relleno: (x, y, z, d) => (d > 2.2 ? V.tripa : V.musculo),
    ancla: (x, y) => y > -0.5 && y < 2.5,
  });
  /* ---- pecho (abdomen + tórax) ---- */
  const perfil = [[-5, 0, 0, cw * 1.02, cd * 1.04], [1 * k, 0, 0.1, cw, cd], [6 * k, 0, 0.2, lerp(cw, R.costillar[0], 0.55), lerp(cd, R.costillar[1], 0.55)], [11.5 * k, 0, 0.3, R.costillar[0], R.costillar[1]], [16.5 * k, 0, 0.4, pw, pd], [20 * k, 0, 0, pw * 0.97, pd * 0.92], [22.6 * k, 0, -0.3, R.hombroTop[0], R.hombroTop[1]]];
  const sr = R.rBrazo / 3, yH = 19.4 * k;
  const pechoPr = [P(perfil, { n: 2.6, cap1: 1.7, cap0: 2 }),
    E([-4.5 * wp, 15.8 * k, pd * 0.7], [4.7 * wp * R.pecs, 3.5 * R.pecs, 2.7 * R.pecs]), E([4.5 * wp, 15.8 * k, pd * 0.7], [4.7 * wp * R.pecs, 3.5 * R.pecs, 2.7 * R.pecs]),
    E([-(R.hombros - 0.8), yH, -0.2], [3.4 * sr, 3.2 * sr, 3.6 * sr]), E([R.hombros - 0.8, yH, -0.2], [3.4 * sr, 3.2 * sr, 3.6 * sr]),
    E([-4 * wp, 21.6 * k, -1.2], [5 * wp, 2.6 * R.traps, 3.3 * R.traps]), E([4 * wp, 21.6 * k, -1.2], [5 * wp, 2.6 * R.traps, 3.3 * R.traps]),
    E([-7.4 * wp, 12.5 * k, -pd * 0.4], [3.2 * wp, 6.5, 3.2]), E([7.4 * wp, 12.5 * k, -pd * 0.4], [3.2 * wp, 6.5, 3.2])];
  if (R.panza) pechoPr.push(E([0, 5 * k, cd * 0.5], [cw * 0.94, 6.6 * k, R.panza]));
  if (R.hocico) pechoPr.push(E([0, 20.5 * k, -pd * 0.5], [pw * 0.8, 4.2, 4.6]));   // lomo y melena del lobo
  const zCol = (st) => st[2] - st[4] + 2.8, colSt = perfil.map((s) => [s[0], 0, zCol(s), 1.3 * hb, 1.3 * hb]);
  const yRib = 9.5 * k, pared = R.pared;
  const pecho = crearParte('pecho', {
    prims: pechoPr,
    superficie: (x, y, z) => {
      const Y = y / k;
      if (R.armadura === 'toga') { if (y < -0.4) return y > -1.9 ? V.tela : V.toga; const banda = Math.abs(x * 0.75 - (Y - 12) * (z > 0 ? 1 : -1)) < 1.6 && Y > 1 && Y < 22.5; return banda ? V.tela : (x < -2 * wp && Y > 15.5 && z > -1) ? 0 : V.toga; }   // toga blanca con la banda del color; el hombro del brazo del arma al aire
      if (y < -0.4) return y > -1.9 ? V.cinto : V.tela;
      if (R.armadura === 'pesada' && Y > 3 && Y < 21.5) return (Math.abs(Y - 12) < 0.4 || Math.abs(x) < 0.4) ? V.cuero : V.metal;   // coraza
      if (R.armadura === 'ligera' && ((Math.abs(x * 0.62 * (z > 0 ? 1 : -1) - (Y - 12)) < 1.2 && Y > 3 && Y < 21) || (Y > 2 && Y < 4.2))) return V.cuero;   // correas cruzadas
      return 0;
    },
    interior: [
      { tipo: V.hueso, prims: [P(colSt, { cap0: 1, cap1: 1 })], prof: 1 },
      { tipo: V.hueso, prims: [E([-5.4 * wp, 20.5 * k, pd * 0.42], [5.5 * wp, 0.9, 0.95]), E([5.4 * wp, 20.5 * k, pd * 0.42], [5.5 * wp, 0.9, 0.95]), E([-6 * wp, 15.5 * k, -pd + 2.3], [3.2, 4.2, 0.95]), E([6 * wp, 15.5 * k, -pd + 2.3], [3.2, 4.2, 0.95])], prof: 0.9 },
      { tipo: V.arteria, prims: [P(colSt.filter((s) => s[0] < 18 * k).map((s) => [s[0], -1.2, s[2] + 2.3, 0.85, 0.85]), { cap0: 0.8, cap1: 0.8 }), E([-6.4 * wp, 19 * k, 0.2], [6.2 * wp, 0.75, 0.75]), E([6.4 * wp, 19 * k, 0.2], [6.2 * wp, 0.75, 0.75])], prof: 1.4 },
      { tipo: V.vena, prims: [P(colSt.filter((s) => s[0] < 18 * k).map((s) => [s[0], 1.4, s[2] + 2.3, 0.85, 0.85]), { cap0: 0.8, cap1: 0.8 }), E([-6.4 * wp, 17.9 * k, -0.5], [6 * wp, 0.7, 0.7]), E([6.4 * wp, 17.9 * k, -0.5], [6 * wp, 0.7, 0.7])], prof: 1.4 },
      { tipo: V.corazon, prims: [E([1.3, 14.6 * k, 1.0], [2.7, 3.1, 2.5])], prof: pared + 0.9 },
      { tipo: V.higado, prims: [E([-3.2 * wp, 8.4 * k, 1], [4.2 * wp, 2.4, 3.2])], prof: pared + 0.6 },
    ],
    relleno: (x, y, z, d) => {
      if (d <= pared) return V.musculo;
      if (y < yRib) return V.tripa;
      if (d <= pared + 1.35 * hb) {   // la jaula: costillas en anillos y esternón adelante
        if (z > 0 && Math.abs(x) < 1.4 && y > 12.5 * k && y < 20.5 * k) return V.hueso;
        const arco = z > 0 && y < yRib + Math.max(0, 4.5 - Math.abs(x) * 0.55);
        if (!arco && y < 20.8 * k && ((y - yRib) % 2.9) < 1.5) return V.hueso;
        return V.musculo;
      }
      return V.pulmon;
    },
    pinta: (x, y, z) => {
      let f = 1; const Y = y / k, ax = Math.abs(x);
      if (z > 1.2) {
        if (ax < 0.5 && Y > 0.5 && Y < 19.5) f *= 0.85;                                         // línea media
        if (!R.panza && Y > 1.2 && Y < 11.4 && ax < cw * 0.6 && ((Y - 1.2) % 3.3) < 0.75) f *= 0.85;   // abdominales
        const yp = 12.8 + 0.036 * (ax / wp - 4.5) ** 2; if (ax > 0.6 && ax < 9.4 * wp && Math.abs(Y - yp) < 0.55) f *= 0.8;   // borde del pectoral
        if (Math.hypot(ax - 4.8 * wp, Y - 15.1) < 0.62) f *= 0.7;
        if (Math.hypot(x, Y - 2.6) < 0.6) f *= 0.6;                                              // ombligo
        if (R.flaco && Y > 6 && Y < 13 && ax > 1.2 && ((Y - 6) % 2.3) < 0.8) f *= 0.8;            // costillas marcadas
      } else if (z < -1.2) {
        if (ax < 0.55 && Y > 0 && Y < 21) f *= 0.84;                                             // surco de la columna
        if (Math.abs(ax - (3.2 + (Y - 10) * 0.22) * wp) < 0.5 && Y > 10 && Y < 18) f *= 0.9;     // escápulas
        if (R.flaco && Y > 6 && Y < 17 && ax > 1.5 && ((Y - 6) % 2.3) < 0.8) f *= 0.82;
        if (R.hocico) f *= 0.85;                                                                 // lomo más oscuro
      }
      return f;
    },
    ancla: (x, y) => y < -1.2,
  });
  const cabeza = cabezaParte(R);
  const nl = R.cuello[2], hyR = R.cabeza[1];
  /* ---- brazos ---- */
  const brazo = (lado) => {
    const s = lado === 'D' ? -1 : 1, L = R.brazo, r = R.rBrazo;
    const p = crearParte('brazo' + lado, {
      prims: [P([[-L, 0, 0, r * 0.8, r * 0.84], [-L * 0.72, 0, 0, r * 0.95, r], [-L * 0.42, 0, 0.15, r * 1.08, r * 1.14], [-L * 0.12, 0, 0, r * 1.05, r * 1.1], [0.5, 0, 0, r, r]], { cap0: r * 0.8, cap1: r * 0.9 }),
        E([s * 0.9, -1.6, 0], [r * 1.22, r * 1.45, r * 1.28]), E([0, -L * 0.45, r * 0.42], [r * 0.8, L * 0.3, r * 0.8]), E([0, -L * 0.42, -r * 0.45], [r * 0.82, L * 0.33, r * 0.8])],
      interior: [
        { tipo: V.medula, prims: [tubo(0, 0, -L + 2, -2, 0.55 * hb)], prof: 1 },
        { tipo: V.hueso, prims: [P([[-L - 0.4, 0, 0, 1.6 * hb, 1.6 * hb], [-L + 1.8, 0, 0, 1.08 * hb, 1.08 * hb], [-1.8, 0, 0, 1.08 * hb, 1.08 * hb], [0.2, 0, 0, 1.75 * hb, 1.75 * hb]], { cap0: 1, cap1: 1 })], prof: 0.9 },
        { tipo: V.arteria, prims: [tubo(-s * r * 0.36, 0.4, -L - 1, 1, 0.7)], prof: 1.3 }, { tipo: V.vena, prims: [tubo(-s * r * 0.3, -r * 0.5, -L - 1, 1, 0.7)], prof: 0.7 },
      ],
      superficie: (x, y) => (R.armadura === 'pesada' && y > -L * 0.32 ? V.metal : R.armadura === 'ligera' && y > -L * 0.12 ? V.cuero : R.armadura === 'toga' && s > 0 && y > -L * 0.55 ? V.toga : 0),
      ancla: (x, y) => y > -1.4, largo: L,
    });
    return p;
  };
  const ante = (lado) => {
    const s = lado === 'D' ? -1 : 1, A = R.ante, r = R.rAnte, m = R.mano;
    const ex = []; if (R.garras) for (const kx of [-1, 0, 1]) ex.push({ tipo: V.unia, prims: [E([kx * 1.15 * m, -A - 4.4 * m, 1.5 * m], [0.55, 1.9, 0.6])] });
    const p = crearParte('ante' + lado, {
      prims: [P([[-A, 0, 0, r * 0.68, r * 0.6], [-A * 0.7, 0, 0, r * 0.85, r * 0.8], [-A * 0.3, 0, 0.1, r * 1.15, r * 1.08], [0, 0, 0, r, r]], { cap0: 0.6, cap1: r * 0.85 }), E([0, -A - 2 * m, 0.5 * m], [1.75 * m, 2.2 * m, 2.4 * m], 2.6)],
      extras: ex,
      interior: [
        { tipo: V.hueso, prims: [tubo(0.8 * hb, 0.1, -A, 0, 0.72 * hb), tubo(-0.8 * hb, -0.1, -A, 0, 0.72 * hb), E([0, -A - 1.8 * m, 0.4], [1.05 * m, 1.5 * m, 1.5 * m])], prof: 0.7 },
        { tipo: V.arteria, prims: [tubo(-s * 0.2, r * 0.42, -A, 1, 0.66)], prof: 0.7 }, { tipo: V.vena, prims: [tubo(s * 0.2, -r * 0.42, -A, 1, 0.66)], prof: 0.7 },
      ],
      ancla: (x, y) => y > -1.4, largo: A,
    });
    p.mano = [0, -A - 2 * m, 0.7 * m];
    return p;
  };
  /* ---- piernas ---- */
  const muslo = (lado) => {
    const s = lado === 'D' ? -1 : 1, L = R.muslo, r = R.rMuslo;
    return crearParte('muslo' + lado, {
      prims: [P([[-L, 0, 0.2, r * 0.66, r * 0.68], [-L * 0.75, 0, 0.1, r * 0.74, r * 0.78], [-L * 0.4, 0, 0.2, r * 0.98, r * 1.04], [-L * 0.1, 0, 0, r * 1.06, r * 1.08], [1, 0, 0, r, r]], { cap0: r * 0.6, cap1: r * 0.8 }),
        E([0, -L * 0.42, r * 0.36], [r * 0.78, L * 0.34, r * 0.72]), E([0, -L * 0.45, -r * 0.36], [r * 0.74, L * 0.32, r * 0.7]), E([0, -L, 0.5], [r * 0.64, r * 0.62, r * 0.68])],
      superficie: (x, y) => (R.armadura === 'toga' ? V.toga : y > -3.4 ? V.tela : 0),
      interior: [
        { tipo: V.medula, prims: [tubo(0, 0, -L + 2.5, -2.5, 0.62 * hb)], prof: 1 },
        { tipo: V.hueso, prims: [P([[-L - 0.3, 0, 0.2, 2.0 * hb, 2.0 * hb], [-L + 2.2, 0, 0, 1.36 * hb, 1.36 * hb], [-2.2, 0, 0, 1.36 * hb, 1.36 * hb], [0.2, 0, 0, 2.1 * hb, 2.1 * hb]], { cap0: 1.2, cap1: 1.2 })], prof: 0.9 },
        { tipo: V.arteria, prims: [tubo(-s * r * 0.3, r * 0.3, -L - 1, 1.5, 0.75)], prof: 1.6 }, { tipo: V.vena, prims: [tubo(-s * r * 0.5, 0, -L - 1, 1.5, 0.75)], prof: 0.8 },
      ],
      ancla: (x, y) => y > -1.4, largo: L,
    });
  };
  const pierna = (lado) => {
    const s = lado === 'D' ? -1 : 1, G = R.pierna, r = R.rPierna, f = R.pie, yS = -G - 2.4;
    const ex = []; if (R.garras) for (const kx of [-1, 0, 1]) ex.push({ tipo: V.unia, prims: [E([kx * 1.2 * f, -G - 1.7, 7.4 * f], [0.5, 0.6, 1.3])] });
    const p = crearParte('pierna' + lado, {
      prims: [P([[-G, 0, 0, r * 0.6, r * 0.62], [-G * 0.72, 0, 0, r * 0.66, r * 0.7], [-G * 0.3, 0, -0.2, r * 1.04, r * 1.12], [0, 0, 0, r * 0.98, r]], { cap0: 0.8, cap1: r * 0.8 }),
        E([0, -G * 0.3, -r * 0.5], [r * 0.8, G * 0.24, r * 0.78]), E([0, -G - 1.4, 2.4 * f], [2.3 * f, 1.9, 5 * f], 2.4), E([0, -G - 1.2, -0.9], [2 * f, 1.8, 2.3 * f])],
      extras: ex, clipY: yS,
      superficie: (x, y, z) => (R.armadura === 'toga' && y > -G * 0.42 ? (y > -G * 0.5 + 1 ? V.toga : V.tela) : y < -G - 1.75 || (y > -G + 1 && y < -G + 2.1) || (y < -G && z > 2.6 * f && z < 3.7 * f) ? V.cinto : 0),
      interior: [
        { tipo: V.hueso, prims: [tubo(0, 0.4, -G, 0, 1.16 * hb), tubo(s * 1.0 * hb, -0.5, -G, -1, 0.62 * hb), E([0, -G - 1.3, 1.8 * f], [1.2 * f, 0.8, 3.6 * f])], prof: 0.7 },
        { tipo: V.arteria, prims: [tubo(-s * 0.9, -0.6, -G, 1, 0.68)], prof: 0.7 }, { tipo: V.vena, prims: [tubo(-s * 0.2, -r * 0.6, -G, 1, 0.68)], prof: 0.7 },
      ],
      ancla: (x, y) => y > -1.4, largo: G,
    });
    p.suelas = [new T.Vector3(0, yS * U, -2.6 * f * U), new T.Vector3(0, yS * U, 7 * f * U)];
    p.pie = p.lista((x, y) => y < -G - 0.3);
    return p;
  };
  /* ---- falda: dos paños que cuelgan del cinturón ---- */
  const pano = (nombre, largo, ancho) => crearParte(nombre, {
    prims: [E([0, -largo / 2 - 0.2, 0], [ancho, largo / 2 + 0.6, 0.8], 4)],
    superficie: (x, y) => (R.armadura === 'toga' ? (y < -largo + 1.2 ? V.tela : V.toga) : y < -largo + 0.6 ? V.cinto : V.tela), relleno: () => (R.armadura === 'toga' ? V.toga : V.tela),
    pinta: (x) => (Math.abs(x) % 2.4 < 0.75 ? 0.82 : 1),
    ancla: (x, y) => y > -1.2,
  });
  const partes0 = { pelvis, pecho, cabeza, brazoD: brazo('D'), anteD: ante('D'), brazoI: brazo('I'), anteI: ante('I'), musloD: muslo('D'), piernaD: pierna('D'), musloI: muslo('I'), piernaI: pierna('I'), faldaF: pano('faldaF', R.armadura === 'toga' ? 22 : 11, hw * (R.armadura === 'toga' ? 0.9 : 0.6)), faldaT: pano('faldaT', R.armadura === 'toga' ? 22 : 9.5, hw * (R.armadura === 'toga' ? 0.95 : 0.66)) };
  const partes = partes0;
  if (R.soloHueso) for (const p of Object.values(partes)) soloHuesos(p);
  const juntas = { pecho: ['pelvis', [0, 5, 0]], cabeza: ['pecho', [0, 22.2 * k, -0.3]], brazoD: ['pecho', [-R.hombros, yH, -0.3]], brazoI: ['pecho', [R.hombros, yH, -0.3]], anteD: ['brazoD', [0, -R.brazo, 0]], anteI: ['brazoI', [0, -R.brazo, 0]],
    musloD: ['pelvis', [-R.cadera, -1.6, 0]], musloI: ['pelvis', [R.cadera, -1.6, 0]], piernaD: ['musloD', [0, -R.muslo, 0]], piernaI: ['musloI', [0, -R.muslo, 0]], faldaF: ['pelvis', [0, 3.6, hd * 0.86]], faldaT: ['pelvis', [0, 3.6, -hd * 0.9]] };
  return { partes, juntas, alto: (R.muslo + R.pierna + 2.4 + 1.6 + 5 + 22.2 * k + nl + hyR * 1.9) * U * R.esc };
}

// la cabeza va aparte: es la única parte que cambia de un gladiador a otro (peinado y barba)
function cabezaParte(R) {
  const hb = R.hueso;
  const [nx0, nz0, nl] = R.cuello, [hx, hyR, hz] = R.cabeza, hy = nl + hyR * 0.92, mdb = R.mandibula;
  const ojoY = hy + hyR * (R.hocico ? 0.22 : 0.08), bocaY = hy - hyR * 0.52;
  const cabPr = [P([[-3, 0, -0.2, nx0 * 1.12, nz0 * 1.12], [0, 0, -0.2, nx0, nz0], [nl + 1.5, 0, 0, nx0 * 0.95, nz0 * 0.95]], { cap0: 1.2, cap1: 2 }),
    E([0, hy, 0.5], [hx, hyR, hz], R.cabN), E([0, hy - hyR * 0.6, 1.4], [hx * 0.8 * mdb, hyR * 0.52, hz * 0.74 * mdb], 2.6)];
  const extras = [];
  for (const s of [-1, 1]) {
    if (R.orejas === 'normal') cabPr.push(E([s * (hx + 0.1), hy - 0.3, 0], [0.9, 1.7, 1.2]));
    if (R.orejas === 'punta') cabPr.push(E([s * (hx + 0.5), hy + 0.5, -0.2], [1.2, 2.3, 1.1]), E([s * (hx + 1.3), hy + 2.2, -0.5], [0.8, 1.4, 0.8]));
    if (R.orejas === 'goblin') cabPr.push(E([s * (hx + 2), hy + 0.6, -0.3], [3.2, 1.6, 0.9]), E([s * (hx + 4.8), hy + 1.6, -0.6], [2.6, 1.15, 0.8]), E([s * (hx + 7), hy + 2.5, -0.8], [1.5, 0.8, 0.7]));
    if (R.orejas === 'lobo') cabPr.push(E([s * hx * 0.66, hy + hyR + 0.6, -0.8], [1.6, 3.2, 1.2]));
    if (R.colmillos) extras.push({ tipo: V.colmillo, prims: [E([s * 2, bocaY + 0.9, 1.4 + hz * 0.74 * mdb + 0.1], [0.62, 1.7, 0.62])] });
  }
  if (R.ceja) cabPr.push(E([0, ojoY + 1.7, hz * 0.74], [hx * 0.82, 0.95, 1.7]));
  if (R.hocico) { cabPr.push(E([0, hy - hyR * 0.44, hz + 1.6], [2.5, 2.0, 4.3])); extras.push({ tipo: V.nariz, prims: [E([0, hy - hyR * 0.44 + 0.9, hz + 5.7], [1.15, 0.95, 0.95])] }, { tipo: V.colmillo, prims: [E([-1.5, hy - hyR * 0.44 - 2.2, hz + 3.6], [0.5, 1.1, 0.5]), E([1.5, hy - hyR * 0.44 - 2.2, hz + 3.6], [0.5, 1.1, 0.5])] }); }
  const cara = (x, y, z) => z > hz * 0.42 && y < hy + hyR * 0.5;
  // peinados (humano, gigante, ghoul) y crestas (orco, goblin)
  const casco = (g) => ({ tipo: V.pelo, prims: [E([0, hy + 0.3, 0.2], [hx + g, hyR + g - 0.1, hz + g - 0.1], R.cabN)], si: (x, y, z) => !cara(x, y, z) && (y > hy + 0.6 || (z < -0.8 && y > hy - hyR * 0.7)) });
  const pz = R.peinado;
  if (pz === 'corto' || pz === 'coleta' || pz === 'rodete') extras.push(casco(1.1));
  if (pz === 'rapado') extras.push(casco(0.55));
  if (pz === 'largo') extras.push({ tipo: V.pelo, prims: [E([0, hy - hyR * 0.15, -0.5], [hx + 1.2, hyR + 2.8, hz + 1.0], R.cabN)], si: (x, y, z) => !cara(x, y, z) && (y > hy + 0.6 || z < -0.4 || (Math.abs(x) > hx * 0.9 && y > hy - hyR * 0.6)) });
  if (pz === 'coleta') extras.push({ tipo: V.pelo, prims: [E([0, hy + 0.6, -hz - 1.2], [1.3, 1.3, 1.6]), E([0, hy - 2.6, -hz - 2.0], [1.15, 3.6, 1.15])] });
  if (pz === 'rodete') extras.push({ tipo: V.pelo, prims: [E([0, hy + hyR + 0.4, -1.6], [2.3, 1.7, 2.3])] });
  if (pz === 'cresta') extras.push({ tipo: V.pelo, prims: [E([0, hy + hyR * 0.8, -1.2], [1.25, 3.4, hz * 0.95]), E([0, hy + hyR * 0.2, -hz - 0.6], [1.1, 4.4, 1.6])] });
  if (pz === 'crestaAlta') extras.push({ tipo: V.pelo, prims: [E([0, hy + hyR * 0.95, -0.8], [1.2, 4.8, hz * 0.85]), E([0, hy + hyR * 0.3, -hz - 0.4], [1.1, 4.2, 1.5])] });
  if (pz === 'crestaLarga') extras.push({ tipo: V.pelo, prims: [E([0, hy + hyR * 0.8, -1.2], [1.25, 3.2, hz * 0.95]), E([0, hy + hyR * 0.1, -hz - 0.8], [1.1, 4.4, 1.6]), E([0, hy - hyR * 0.9, -hz - 1.6], [1.0, 5.2, 1.3])] });
  // barbas y bigotes
  const bz = R.barba, zB = hz * 0.74 * mdb + 1.4;
  const barbaLlena = { tipo: V.pelo, prims: [E([0, hy - hyR * 0.78, 2.0], [hx * 0.9 * mdb, hyR * 0.52, hz * 0.72 * mdb])], si: (x, y) => y < bocaY - 0.8 || Math.abs(x) > hx * 0.62 };
  const bigote = { tipo: V.pelo, prims: [E([0, bocaY + 0.95, zB - 0.2], [hx * 0.42, 0.6, 0.75]), E([-hx * 0.4, bocaY + 0.1, zB - 0.6], [0.55, 1.3, 0.6]), E([hx * 0.4, bocaY + 0.1, zB - 0.6], [0.55, 1.3, 0.6])] };
  if (bz === 'corta' || bz === true) extras.push(barbaLlena);
  if (bz === 'larga') extras.push(barbaLlena, { tipo: V.pelo, prims: [E([0, hy - hyR * 1.35, zB - 1.2], [hx * 0.62 * mdb, hyR * 0.75, 1.9])] });
  if (bz === 'candado') extras.push(bigote, { tipo: V.pelo, prims: [E([0, hy - hyR * 0.98, zB - 0.6], [hx * 0.38, hyR * 0.32, 1.3])] });
  if (bz === 'bigote') extras.push(bigote);
  if (R.jefe === 'minotauro' || R.jefe === 'diablo' || R.cuernos) for (const s of [-1, 1]) {   // cuernos de toro
    const pts = [[s * (hx - 0.6), hy + hyR * 0.5, 0.6, 1.5], [s * (hx + 1.6), hy + hyR * 0.68, 0.9, 1.25], [s * (hx + 3.2), hy + hyR * 0.92, 1.3, 1.0], [s * (hx + 4.3), hy + hyR * 1.3, 1.8, 0.75], [s * (hx + 4.8), hy + hyR * 1.65, 2.1, 0.5]];
    extras.push({ tipo: V.colmillo, prims: pts.map(([x, y, z, r]) => E([x, y, z], [r * 1.3, r, r])) });
  }
  if (R.jefe === 'arbol' || R.ramas) {   // ramas que le salen de la cabeza, con hojas
    const ramas = [], hojas = [];
    for (const [s, k] of [[-1, 1], [1, 1], [0, 1.3], [-0.5, 0.8], [0.6, 0.9]]) {
      const b = [s * 2.2, hy + hyR * 0.8, -0.3], d = [s * 1.6, 2.4 * k, -0.6];
      for (let i = 0; i < 5; i++) ramas.push(E([b[0] + d[0] * i, b[1] + d[1] * i, b[2] + d[2] * i], [0.9 - i * 0.1, 1.3, 0.9 - i * 0.1]));
      hojas.push(E([b[0] + d[0] * 4.6, b[1] + d[1] * 4.8, b[2] + d[2] * 4.6], [2.4, 1.6, 2.2]));
    }
    extras.push({ tipo: V.madera, prims: ramas }, { tipo: V.pelo, prims: hojas });
  }
  if (R.corona) {   // corona de laureles de oro: hojitas alrededor de la cabeza, abierta en la frente
    const yc = hy + hyR * 0.42, hojas = [];
    for (let a = -140; a <= 140; a += 12) { const r = a * Math.PI / 180, cx = Math.sin(r) * (hx + 0.7), cz = 0.5 - Math.cos(r) * (hz + 0.7); hojas.push(E([cx, yc + 0.9, cz], [1.25, 0.8, 1.25]), E([cx * 1.04, yc - 0.3, cz * 1.04], [1.15, 0.75, 1.15])); }
    extras.unshift({ tipo: V.oro, prims: hojas });
  }
  const yCab = nl + 0.8;
  const cabeza = crearParte('cabeza', {
    prims: cabPr, extras,
    interior: [
      { tipo: V.hueso, prims: [tubo(0, -1.0, -3, nl + 1, 1.15 * hb)], prof: 1 },
      { tipo: V.arteria, prims: [tubo(-nx0 * 0.56, 0.8, -3, nl + 1, 0.7), tubo(nx0 * 0.56, 0.8, -3, nl + 1, 0.7)], prof: 0.9 },
      { tipo: V.vena, prims: [tubo(-nx0 * 0.7, -0.3, -3, nl + 1, 0.7), tubo(nx0 * 0.7, -0.3, -3, nl + 1, 0.7)], prof: 0.9 },
    ],
    relleno: (x, y, z, d) => {
      if (y < yCab || Math.abs(x) > hx) return V.musculo;
      if (d <= 0.72 + 1.15 * Math.min(hb, 1.25)) return V.hueso;   // la tapa del cráneo
      const caraZ = z > hz * 0.42 && y < ojoY + 0.6;                  // detrás de la cara (ojos, nariz, boca) hay músculo y hueso de la cara
      if (y > ojoY - 1.2 && !caraZ) return V.cerebro;
      if (y > bocaY + 0.6 && z < hz * 0.1 && y > hy - hyR * 0.75) return V.cerebro;   // el cerebelo, atrás y abajo
      return y < bocaY + 0.6 && Math.abs(x) < hx * 0.75 ? V.hueso : V.musculo;       // mandíbula
    },
    pinta: (x, y, z) => { let f = 1; if (R.ojeras && z > hz * 0.5) for (const s of [-1, 1]) if (Math.hypot(x - s * hx * 0.42, y - ojoY) < 1.7) f *= 0.66; if (R.flaco && z > 2 && Math.abs(Math.abs(x) - hx * 0.62) < 0.9 && y < hy - 0.8 && y > bocaY - 0.5) f *= 0.8; return f; },
    ancla: (x, y) => y < -0.8,
  });
  cabeza.craneo = cabeza.lista((x, y, z, t) => y > yCab + 1 && (t === V.hueso || t === V.cerebro));
  cabeza.cerebro = cabeza.lista((x, y, z, t) => t === V.cerebro);
  // dónde va la cara pintada: justo delante de la superficie de la cara
  let zc = -1e9; const y0c = R.hocico ? ojoY - 0.8 : bocaY - 1.2, y1c = ojoY + 1.4;
  for (const q of cabeza.lista((x, y, z, t) => Math.abs(x) < hx * 0.8 && y > y0c && y < y1c && t !== V.pelo && t !== V.colmillo && t !== V.nariz && t !== V.oro)) { const kk = ((q / cabeza.nx) | 0) % cabeza.nz; zc = Math.max(zc, (kk + cabeza.g0[2]) / Q); }
  cabeza.caraInfo = { y: (ojoY + bocaY) / 2, z: zc + 0.72 / Q, lado: hx * 1.96, dy: ojoY - bocaY };
  return cabeza;
}
const _cacheAn = new Map(), _cacheCab = new Map();
function anatomiaDe(R) {
  const key = [R.nombre, R.armadura || '', R.soloHueso ? 1 : 0, Q].join('|'), kc = key + '|' + R.peinado + '|' + R.barba + '|' + (R.corona ? 1 : 0) + '|' + (R.jefe || '') + '|' + (R.esbirro || '') + (R.ojosRojos ? 'r' : '');
  if (!_cacheAn.has(key)) _cacheAn.set(key, anatomia(R));
  if (!_cacheCab.has(kc)) { const c = cabezaParte(R); if (R.soloHueso) soloHuesos(c, true); _cacheCab.set(kc, c); }
  const A = _cacheAn.get(key), partes = {};
  for (const [n, p0] of Object.entries(A.partes)) {
    const p = n === 'cabeza' ? _cacheCab.get(kc) : p0;
    partes[n] = { ...p, hp: p.hp.slice(), grieta: p.grieta.slice(), moreton: p.moreton.slice(), sangre: new Float32Array(p.vivo.length), vivo: p.vivo.slice(), hijos: [], chorros: [], roto: null, suelto: false, venas: 0, arterias: 0, padre: null, malla: null, grupo: new T.Group() };
    partes[n].grupo.name = n;
  }
  return { partes, juntas: A.juntas };
}
/* ---------------------------------------------------------------------
   ANIMACIÓN: poses por articulación (ángulos en radianes) y clips
   --------------------------------------------------------------------- */
const ARTIC = ['pelvis', 'pecho', 'cabeza', 'brazoD', 'anteD', 'brazoI', 'anteI', 'musloD', 'piernaD', 'musloI', 'piernaI'];
const ESCALARES = ['rx', 'rz', 'salto', 'muneca'];
const poseVacia = () => { const o = {}; for (const a of ARTIC) o[a] = [0, 0, 0]; for (const e of ESCALARES) o[e] = 0; return o; };
function guardia(o, R) {
  o.pelvis[1] = -0.22; o.pecho[0] = 0.1 + R.joroba; o.pecho[1] = -0.12; o.cabeza[0] = -0.04 - R.joroba * 0.8; o.cabeza[1] = 0.3;
  o.brazoD[0] = 0.22; o.brazoD[2] = -0.26; o.anteD[0] = -1.5; o.muneca = -0.25;
  o.brazoI[0] = -0.5; o.brazoI[2] = 0.36; o.anteI[0] = -1.3;
  o.musloI[0] = -0.4; o.piernaI[0] = 0.36; o.musloI[2] = 0.13; o.musloD[0] = 0.2; o.piernaD[0] = 0.3; o.musloD[2] = -0.14;
  return o;
}
// curva suave que pasa por las claves sin frenar en cada una (cúbica de Hermite, monótona: no se pasa de largo en las pausas)
const kfPend = (k, i) => { if (i <= 0 || i >= k.length - 1) return 0; const a = (k[i][1] - k[i - 1][1]) / (k[i][0] - k[i - 1][0]), b = (k[i + 1][1] - k[i][1]) / (k[i + 1][0] - k[i][0]); return a * b <= 0 ? 0 : (2 * a * b) / (a + b); };
const kf = (t, k) => { if (t <= k[0][0]) return k[0][1]; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const h = k[i][0] - k[i - 1][0], u = (t - k[i - 1][0]) / h, u2 = u * u, u3 = u2 * u, m0 = kfPend(k, i - 1) * h, m1 = kfPend(k, i) * h; return (2 * u3 - 3 * u2 + 1) * k[i - 1][1] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * k[i][1] + (u3 - u2) * m1; } return k[k.length - 1][1]; };
// MOVIMIENTOS PRECALCULADOS: cada movimiento (tajo, estocada, caminar…) se calcula una sola vez, cuadro por cuadro,
// y después solo se "lee" (antes se recalculaban las curvas de cada articulación de cada gladiador en cada cuadro)
const HORNO_PASO = 1 / 60, _horno = new WeakMap();
function hornear(P2) {
  let tmax = 0; for (const key in P2) { const k = P2[key]; tmax = Math.max(tmax, k[k.length - 1][0]); }
  const n = Math.ceil(tmax / HORNO_PASO) + 2, pistasH = [];
  for (const key in P2) { const [a, c] = key.split('.'), arr = new Float32Array(n); for (let j = 0; j < n; j++) arr[j] = kf(j * HORNO_PASO, P2[key]); pistasH.push({ a, c: c == null ? -1 : +c, arr }); }
  const H = { n, pistasH }; _horno.set(P2, H); return H;
}
const pistas = (o, t, P2) => {
  const H = _horno.get(P2) || hornear(P2), f = Math.max(0, t / HORNO_PASO), i = Math.min(H.n - 2, f | 0), u = Math.min(1, f - i);
  for (const p of H.pistasH) { const v = p.arr[i] + (p.arr[i + 1] - p.arr[i]) * u; if (p.c < 0) o[p.a] = v; else o[p.a][p.c] = v; }
};
const CLIPS = {
  quieto: { fn(t, o) { const b = Math.sin(t * 2.3); o.pecho[0] += b * 0.022; o.brazoD[0] += b * 0.03; o.brazoI[0] += b * 0.035; o.anteI[0] -= b * 0.05; o.anteD[0] -= b * 0.03; o.cabeza[0] -= b * 0.018; o.rx = Math.sin(t * 0.9) * 0.5; o.pelvis[2] = Math.sin(t * 0.9) * 0.02; o.musloI[0] -= b * 0.015; o.piernaI[0] += b * 0.03; o.piernaD[0] += b * 0.03; } },
  caminar: { fn(t, o) {
    const f = t * 6.6, s = Math.sin(f);
    for (const [L, ph] of [['D', f], ['I', f + Math.PI]]) { o['muslo' + L][0] = -0.1 - 0.5 * Math.sin(ph); o['pierna' + L][0] = 0.12 + 0.85 * Math.pow(Math.max(0, Math.cos(ph)), 1.3); o['muslo' + L][2] = L === 'D' ? -0.04 : 0.04; }
    o.pelvis[1] = 0.1 * s; o.pelvis[2] = 0.035 * Math.cos(f); o.pecho[1] = -0.2 * s; o.pecho[0] += 0.04; o.cabeza[1] = 0.1 * s;
    o.brazoI[0] = -0.3 - 0.4 * s; o.anteI[0] = -0.8 + 0.25 * s; o.brazoD[0] = 0.12 + 0.28 * s; o.anteD[0] = -1.35;
  } },
  correr: { fn(t, o) {
    const f = t * 10.5, s = Math.sin(f);
    for (const [L, ph] of [['D', f], ['I', f + Math.PI]]) { o['muslo' + L][0] = -0.3 - 0.85 * Math.sin(ph); o['pierna' + L][0] = 0.3 + 1.25 * Math.pow(Math.max(0, Math.cos(ph)), 1.2); o['muslo' + L][2] = 0; }
    o.pelvis[1] = 0.16 * s; o.pecho[1] = -0.3 * s; o.pecho[0] += 0.26; o.cabeza[0] -= 0.2; o.cabeza[1] = 0.12 * s; o.salto = 1.6 * Math.abs(Math.cos(f));
    o.brazoI[0] = -0.2 - 0.9 * s; o.anteI[0] = -1.5; o.brazoD[0] = 0.1 + 0.7 * s; o.anteD[0] = -1.55;
  } },
  tajo: { dur: 0.95, tw: 0.26, imp: 0.4, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.26, -2.55], [0.38, -1.05], [0.46, -0.55], [0.62, -0.5], [0.95, 0.22]], 'brazoD.2': [[0, -0.26], [0.26, -0.5], [0.4, 0.4], [0.62, 0.45], [0.95, -0.26]],
    'anteD.0': [[0, -1.5], [0.26, -1.0], [0.38, -0.3], [0.62, -0.5], [0.95, -1.5]], muneca: [[0, -0.25], [0.26, -0.9], [0.4, 0.85], [0.62, 0.7], [0.95, -0.25]],
    'pecho.1': [[0, -0.12], [0.26, -0.55], [0.42, 0.5], [0.62, 0.45], [0.95, -0.12]], 'pecho.0': [[0, 0.1], [0.26, -0.02], [0.42, 0.4], [0.62, 0.32], [0.95, 0.1]], 'pelvis.1': [[0, -0.22], [0.26, -0.4], [0.42, 0.05], [0.95, -0.22]],
    'musloI.0': [[0, -0.4], [0.36, -0.72], [0.62, -0.7], [0.95, -0.4]], 'piernaI.0': [[0, 0.36], [0.36, 0.7], [0.62, 0.66], [0.95, 0.36]], 'musloD.0': [[0, 0.2], [0.4, 0.42], [0.95, 0.2]],
    'brazoI.0': [[0, -0.55], [0.3, -0.2], [0.45, 0.3], [0.95, -0.55]], rz: [[0, 0], [0.4, 3], [0.62, 3], [0.95, 0]] } },
  estocada: { dur: 0.85, tw: 0.24, imp: 0.36, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.24, 0.75], [0.36, -1.32], [0.52, -1.32], [0.85, 0.22]], 'brazoD.2': [[0, -0.26], [0.36, -0.05], [0.85, -0.26]],
    'anteD.0': [[0, -1.5], [0.24, -2.05], [0.36, -0.14], [0.52, -0.14], [0.85, -1.5]], muneca: [[0, -0.25], [0.24, 0.9], [0.36, 1.42], [0.52, 1.42], [0.85, -0.25]],
    'pecho.1': [[0, -0.12], [0.24, -0.5], [0.36, 0.5], [0.52, 0.5], [0.85, -0.12]], 'pecho.0': [[0, 0.1], [0.36, 0.42], [0.52, 0.42], [0.85, 0.1]],
    'musloI.0': [[0, -0.4], [0.36, -0.95], [0.52, -0.95], [0.85, -0.4]], 'piernaI.0': [[0, 0.36], [0.36, 0.95], [0.52, 0.95], [0.85, 0.36]], 'musloD.0': [[0, 0.2], [0.36, 0.55], [0.52, 0.55], [0.85, 0.2]], 'piernaD.0': [[0, 0.3], [0.36, 0.12], [0.52, 0.12], [0.85, 0.3]],
    'brazoI.0': [[0, -0.55], [0.36, 0.5], [0.85, -0.55]], rz: [[0, 0], [0.36, 5], [0.52, 5], [0.85, 0]] } },
  // el hombre lobo no usa armas: un zarpazo con cada garra
  zarpazo: { dur: 0.8, tw: 0.2, imp: 0.33, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.2, -2.35], [0.32, -0.9], [0.45, -0.15], [0.8, 0.22]], 'brazoD.2': [[0, -0.26], [0.2, -0.75], [0.34, 0.75], [0.5, 0.5], [0.8, -0.26]], 'anteD.0': [[0, -1.5], [0.2, -0.95], [0.32, -0.2], [0.5, -0.6], [0.8, -1.5]],
    'brazoI.0': [[0, -0.55], [0.3, -0.5], [0.42, -2.35], [0.55, -0.9], [0.66, -0.2], [0.8, -0.55]], 'brazoI.2': [[0, 0.2], [0.42, 0.75], [0.56, -0.75], [0.7, -0.4], [0.8, 0.2]], 'anteI.0': [[0, -1.25], [0.42, -0.95], [0.55, -0.2], [0.8, -1.25]],
    'pecho.1': [[0, -0.12], [0.2, -0.55], [0.34, 0.55], [0.44, 0.5], [0.56, -0.55], [0.8, -0.12]], 'pecho.0': [[0, 0.1], [0.34, 0.5], [0.56, 0.55], [0.8, 0.1]], 'cabeza.0': [[0, -0.04], [0.3, -0.3], [0.8, -0.04]],
    'musloI.0': [[0, -0.4], [0.34, -0.8], [0.56, -0.75], [0.8, -0.4]], 'piernaI.0': [[0, 0.36], [0.34, 0.75], [0.56, 0.7], [0.8, 0.36]], 'musloD.0': [[0, 0.2], [0.4, 0.45], [0.8, 0.2]], rz: [[0, 0], [0.34, 4], [0.6, 4], [0.8, 0]] } },
  // revés: el arma cruza al otro lado del cuerpo y corta de adentro hacia afuera, a la altura del cuello
  reves: { dur: 0.9, tw: 0.26, imp: 0.4, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.26, -1.25], [0.4, -1.45], [0.56, -1.2], [0.9, 0.22]], 'brazoD.2': [[0, -0.26], [0.26, 1.05], [0.4, 0.1], [0.56, -0.95], [0.9, -0.26]],
    'anteD.0': [[0, -1.5], [0.26, -1.75], [0.4, -0.25], [0.56, -0.3], [0.9, -1.5]], muneca: [[0, -0.25], [0.26, -0.5], [0.4, 0.9], [0.56, 0.8], [0.9, -0.25]],
    'pecho.1': [[0, -0.12], [0.26, 0.6], [0.4, 0.05], [0.58, -0.6], [0.9, -0.12]], 'pecho.0': [[0, 0.1], [0.26, 0.18], [0.42, 0.28], [0.9, 0.1]], 'pelvis.1': [[0, -0.22], [0.26, 0.1], [0.42, -0.25], [0.9, -0.22]],
    'cabeza.1': [[0, 0.3], [0.26, -0.2], [0.42, 0.45], [0.9, 0.3]],
    'musloI.0': [[0, -0.4], [0.38, -0.7], [0.58, -0.66], [0.9, -0.4]], 'piernaI.0': [[0, 0.36], [0.38, 0.66], [0.58, 0.6], [0.9, 0.36]], 'musloD.0': [[0, 0.2], [0.4, 0.4], [0.9, 0.2]],
    'brazoI.0': [[0, -0.55], [0.26, -0.75], [0.42, -0.1], [0.9, -0.55]], rz: [[0, 0], [0.4, 3], [0.58, 3], [0.9, 0]] } },
  // tajo bajo: se agacha y corta a las piernas o la panza, de afuera hacia adentro
  tajoBajo: { dur: 0.95, tw: 0.27, imp: 0.42, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.27, 0.75], [0.42, -0.85], [0.58, -0.95], [0.95, 0.22]], 'brazoD.2': [[0, -0.26], [0.27, -0.85], [0.42, 0.15], [0.58, 0.55], [0.95, -0.26]],
    'anteD.0': [[0, -1.5], [0.27, -0.9], [0.42, -0.15], [0.58, -0.35], [0.95, -1.5]], muneca: [[0, -0.25], [0.27, -0.7], [0.42, 0.7], [0.58, 0.6], [0.95, -0.25]],
    'pecho.1': [[0, -0.12], [0.27, -0.65], [0.44, 0.45], [0.6, 0.5], [0.95, -0.12]], 'pecho.0': [[0, 0.1], [0.27, 0.2], [0.44, 0.62], [0.6, 0.55], [0.95, 0.1]], 'cabeza.0': [[0, -0.04], [0.44, -0.4], [0.6, -0.36], [0.95, -0.04]],
    'musloI.0': [[0, -0.4], [0.4, -1.0], [0.6, -0.95], [0.95, -0.4]], 'piernaI.0': [[0, 0.36], [0.4, 1.1], [0.6, 1.05], [0.95, 0.36]], 'musloD.0': [[0, 0.2], [0.42, 0.5], [0.95, 0.2]], 'piernaD.0': [[0, 0.3], [0.42, 0.75], [0.6, 0.7], [0.95, 0.3]],
    'brazoI.0': [[0, -0.55], [0.3, -0.3], [0.45, 0.35], [0.95, -0.55]], rz: [[0, 0], [0.42, 4], [0.6, 4], [0.95, 0]] } },
  // mazazo: el arma arriba de la cabeza con las dos manos, el cuerpo se arquea y baja con todo el peso
  mazazo: { dur: 1.15, tw: 0.34, imp: 0.5, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.34, -3.0], [0.5, -1.0], [0.62, -0.7], [0.82, -0.75], [1.15, 0.22]], 'brazoD.2': [[0, -0.26], [0.34, 0.12], [0.5, 0.22], [0.82, 0.2], [1.15, -0.26]],
    'anteD.0': [[0, -1.5], [0.34, -0.75], [0.5, -0.18], [0.82, -0.3], [1.15, -1.5]], muneca: [[0, -0.25], [0.34, -1.1], [0.5, 1.0], [0.82, 1.05], [1.15, -0.25]],
    'brazoI.0': [[0, -0.55], [0.34, -2.95], [0.5, -1.05], [0.62, -0.75], [0.82, -0.8], [1.15, -0.55]], 'brazoI.2': [[0, 0.36], [0.34, -0.2], [0.5, -0.4], [0.82, -0.38], [1.15, 0.36]], 'anteI.0': [[0, -1.3], [0.34, -0.85], [0.5, -0.3], [0.82, -0.4], [1.15, -1.3]],
    'pecho.0': [[0, 0.1], [0.34, -0.32], [0.52, 0.72], [0.82, 0.66], [1.15, 0.1]], 'pecho.1': [[0, -0.12], [0.34, -0.2], [0.52, 0.12], [1.15, -0.12]], 'cabeza.0': [[0, -0.04], [0.34, -0.2], [0.52, -0.45], [0.82, -0.4], [1.15, -0.04]],
    'pelvis.1': [[0, -0.22], [0.5, -0.05], [1.15, -0.22]], salto: [[0, 0], [0.3, 1.6], [0.46, 0.4], [0.52, 0], [1.15, 0]],
    'musloI.0': [[0, -0.4], [0.34, -0.3], [0.52, -0.95], [0.82, -0.9], [1.15, -0.4]], 'piernaI.0': [[0, 0.36], [0.34, 0.25], [0.52, 1.05], [0.82, 1.0], [1.15, 0.36]],
    'musloD.0': [[0, 0.2], [0.34, 0.1], [0.52, 0.45], [0.82, 0.45], [1.15, 0.2]], 'piernaD.0': [[0, 0.3], [0.34, 0.2], [0.52, 0.8], [0.82, 0.75], [1.15, 0.3]], rz: [[0, 0], [0.5, 4], [0.82, 4], [1.15, 0]] } },
  // barrido: un golpe horizontal con las dos manos y toda la cintura, de derecha a izquierda
  barrido: { dur: 1.1, tw: 0.32, imp: 0.48, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.32, -1.15], [0.48, -1.3], [0.66, -1.1], [1.1, 0.22]], 'brazoD.2': [[0, -0.26], [0.32, -1.25], [0.48, -0.05], [0.66, 0.75], [1.1, -0.26]],
    'anteD.0': [[0, -1.5], [0.32, -1.1], [0.48, -0.2], [0.66, -0.45], [1.1, -1.5]], muneca: [[0, -0.25], [0.32, -0.3], [0.48, 0.75], [0.66, 0.6], [1.1, -0.25]],
    'brazoI.0': [[0, -0.55], [0.32, -1.2], [0.48, -1.35], [0.66, -1.15], [1.1, -0.55]], 'brazoI.2': [[0, 0.36], [0.32, -0.75], [0.48, -0.45], [0.66, 0.5], [1.1, 0.36]], 'anteI.0': [[0, -1.3], [0.32, -1.5], [0.48, -0.5], [0.66, -0.7], [1.1, -1.3]],
    'pecho.1': [[0, -0.12], [0.32, -0.9], [0.5, 0.55], [0.68, 0.85], [1.1, -0.12]], 'pelvis.1': [[0, -0.22], [0.32, -0.6], [0.5, 0.15], [0.68, 0.3], [1.1, -0.22]], 'pecho.0': [[0, 0.1], [0.32, 0.05], [0.5, 0.3], [1.1, 0.1]],
    'cabeza.1': [[0, 0.3], [0.32, 0.75], [0.5, -0.1], [0.68, -0.35], [1.1, 0.3]],
    'musloI.0': [[0, -0.4], [0.44, -0.8], [0.68, -0.75], [1.1, -0.4]], 'piernaI.0': [[0, 0.36], [0.44, 0.8], [0.68, 0.75], [1.1, 0.36]], 'musloD.0': [[0, 0.2], [0.5, 0.5], [1.1, 0.2]], 'piernaD.0': [[0, 0.3], [0.5, 0.55], [1.1, 0.3]],
    rz: [[0, 0], [0.48, 3], [0.68, 3], [1.1, 0]] } },
  // puñalada: corta y rápida, de abajo hacia arriba
  punalada: { dur: 0.62, tw: 0.16, imp: 0.27, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.16, 0.7], [0.27, -0.95], [0.38, -1.0], [0.62, 0.22]], 'brazoD.2': [[0, -0.26], [0.16, -0.4], [0.27, 0.12], [0.62, -0.26]],
    'anteD.0': [[0, -1.5], [0.16, -1.7], [0.27, -0.45], [0.38, -0.5], [0.62, -1.5]], muneca: [[0, -0.25], [0.16, 0.6], [0.27, 1.35], [0.38, 1.3], [0.62, -0.25]],
    'pecho.1': [[0, -0.12], [0.16, -0.45], [0.28, 0.42], [0.4, 0.4], [0.62, -0.12]], 'pecho.0': [[0, 0.1], [0.28, 0.38], [0.4, 0.34], [0.62, 0.1]],
    'musloI.0': [[0, -0.4], [0.27, -0.8], [0.4, -0.78], [0.62, -0.4]], 'piernaI.0': [[0, 0.36], [0.27, 0.8], [0.4, 0.78], [0.62, 0.36]], 'musloD.0': [[0, 0.2], [0.27, 0.42], [0.62, 0.2]],
    'brazoI.0': [[0, -0.55], [0.27, 0.25], [0.62, -0.55]], rz: [[0, 0], [0.27, 4], [0.4, 4], [0.62, 0]] } },
  // puños: directo, gancho y el cruzado con la otra mano
  directo: { dur: 0.5, tw: 0.1, imp: 0.2, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.1, 0.1], [0.2, -1.5], [0.28, -1.45], [0.5, 0.22]], 'brazoD.2': [[0, -0.26], [0.2, 0.1], [0.5, -0.26]], 'anteD.0': [[0, -1.5], [0.1, -1.9], [0.2, -0.08], [0.28, -0.2], [0.5, -1.5]],
    'pecho.1': [[0, -0.12], [0.1, -0.35], [0.21, 0.45], [0.3, 0.4], [0.5, -0.12]], 'pecho.0': [[0, 0.1], [0.21, 0.26], [0.5, 0.1]], 'pelvis.1': [[0, -0.22], [0.21, 0.05], [0.5, -0.22]],
    'musloI.0': [[0, -0.4], [0.2, -0.62], [0.5, -0.4]], 'piernaI.0': [[0, 0.36], [0.2, 0.6], [0.5, 0.36]], 'brazoI.0': [[0, -0.5], [0.2, -0.75], [0.5, -0.5]], rz: [[0, 0], [0.2, 3], [0.3, 3], [0.5, 0]] } },
  gancho: { dur: 0.66, tw: 0.18, imp: 0.3, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.18, -0.9], [0.3, -1.4], [0.42, -1.35], [0.66, 0.22]], 'brazoD.2': [[0, -0.26], [0.18, -1.3], [0.3, 0.05], [0.42, 0.7], [0.66, -0.26]], 'anteD.0': [[0, -1.5], [0.18, -1.45], [0.3, -1.5], [0.42, -1.55], [0.66, -1.5]],
    'pecho.1': [[0, -0.12], [0.18, -0.75], [0.32, 0.6], [0.44, 0.8], [0.66, -0.12]], 'pelvis.1': [[0, -0.22], [0.18, -0.5], [0.32, 0.2], [0.66, -0.22]], 'pecho.0': [[0, 0.1], [0.32, 0.2], [0.66, 0.1]], 'pecho.2': [[0, 0], [0.18, -0.12], [0.32, 0.14], [0.66, 0]],
    'musloI.0': [[0, -0.4], [0.3, -0.6], [0.66, -0.4]], 'piernaI.0': [[0, 0.36], [0.3, 0.58], [0.66, 0.36]], 'musloD.0': [[0, 0.2], [0.3, 0.38], [0.66, 0.2]], 'piernaD.0': [[0, 0.3], [0.3, 0.5], [0.66, 0.3]],
    'brazoI.0': [[0, -0.5], [0.3, -0.8], [0.66, -0.5]], rz: [[0, 0], [0.3, 2.5], [0.44, 2.5], [0.66, 0]] } },
  cruzado: { dur: 0.56, tw: 0.12, imp: 0.23, cara: 'furia', P: {
    'brazoI.0': [[0, -0.5], [0.12, -0.3], [0.23, -1.5], [0.32, -1.45], [0.56, -0.5]], 'brazoI.2': [[0, 0.36], [0.23, -0.35], [0.56, 0.36]], 'anteI.0': [[0, -1.3], [0.12, -1.8], [0.23, -0.1], [0.32, -0.22], [0.56, -1.3]],
    'pecho.1': [[0, -0.12], [0.12, 0.25], [0.24, -0.38], [0.34, -0.35], [0.56, -0.12]], 'pecho.0': [[0, 0.1], [0.24, 0.26], [0.56, 0.1]], 'pelvis.1': [[0, -0.22], [0.24, -0.32], [0.56, -0.22]],
    'brazoD.0': [[0, 0.22], [0.23, -0.2], [0.56, 0.22]], 'musloI.0': [[0, -0.4], [0.23, -0.6], [0.56, -0.4]], 'piernaI.0': [[0, 0.36], [0.23, 0.58], [0.56, 0.36]], rz: [[0, 0], [0.23, 3], [0.33, 3], [0.56, 0]] } },
  // remate: el arma arriba y clavada hacia abajo, sobre el caído
  ejecucion: { dur: 1.2, tw: 0.4, imp: 0.58, cara: 'furia', P: {
    'brazoD.0': [[0, 0.22], [0.4, -2.75], [0.58, -0.75], [0.9, -0.7], [1.2, 0.22]], 'brazoD.2': [[0, -0.26], [0.4, 0.05], [0.58, 0.15], [1.2, -0.26]], 'anteD.0': [[0, -1.5], [0.4, -1.2], [0.58, -0.25], [0.9, -0.3], [1.2, -1.5]],
    muneca: [[0, -0.25], [0.4, 1.2], [0.58, 2.2], [0.9, 2.2], [1.2, -0.25]],
    'pecho.0': [[0, 0.1], [0.4, -0.2], [0.6, 0.95], [0.9, 0.9], [1.2, 0.1]], 'cabeza.0': [[0, -0.04], [0.6, -0.3], [0.9, -0.3], [1.2, -0.04]],
    'musloI.0': [[0, -0.4], [0.6, -1.05], [0.9, -1.0], [1.2, -0.4]], 'piernaI.0': [[0, 0.36], [0.6, 1.15], [0.9, 1.1], [1.2, 0.36]], 'musloD.0': [[0, 0.2], [0.6, 0.35], [1.2, 0.2]], 'piernaD.0': [[0, 0.3], [0.6, 0.95], [0.9, 0.9], [1.2, 0.3]],
    'brazoI.0': [[0, -0.55], [0.4, -1.2], [0.6, 0.2], [1.2, -0.55]], rz: [[0, 0], [0.58, 2], [0.9, 2], [1.2, 0]] } },
  bloqueo: { dur: 0.9, P: {
    'brazoI.0': [[0, -0.55], [0.14, -1.5], [0.7, -1.5], [0.9, -0.55]], 'brazoI.2': [[0, 0.2], [0.14, -0.4], [0.7, -0.4], [0.9, 0.2]], 'anteI.0': [[0, -1.25], [0.14, -1.6], [0.7, -1.6], [0.9, -1.25]],
    'brazoD.0': [[0, 0.22], [0.14, -1.25], [0.7, -1.25], [0.9, 0.22]], 'brazoD.2': [[0, -0.26], [0.14, 0.3], [0.7, 0.3], [0.9, -0.26]], 'anteD.0': [[0, -1.5], [0.14, -1.35], [0.7, -1.35], [0.9, -1.5]], muneca: [[0, -0.25], [0.14, -0.9], [0.7, -0.9], [0.9, -0.25]],
    'pecho.0': [[0, 0.1], [0.14, 0.02], [0.7, 0.02], [0.9, 0.1]], 'cabeza.0': [[0, -0.04], [0.14, 0.2], [0.7, 0.2], [0.9, -0.04]],
    'musloI.0': [[0, -0.4], [0.14, -0.62], [0.7, -0.62], [0.9, -0.4]], 'piernaI.0': [[0, 0.36], [0.14, 0.7], [0.7, 0.7], [0.9, 0.36]], 'musloD.0': [[0, 0.2], [0.14, 0.05], [0.7, 0.05], [0.9, 0.2]], 'piernaD.0': [[0, 0.3], [0.14, 0.6], [0.7, 0.6], [0.9, 0.3]], rz: [[0, 0], [0.14, -1.5], [0.7, -1.5], [0.9, 0]] } },
  festejo: { cara: 'furia', fn(t, o) { const b = Math.sin(t * 7); o.pelvis[1] = 0; o.pecho[0] = -0.16; o.pecho[1] = 0; o.cabeza[0] = -0.3; o.cabeza[1] = 0; o.brazoD[0] = -2.85 + b * 0.12; o.brazoD[2] = -0.25; o.anteD[0] = -0.2; o.muneca = -0.1; o.brazoI[0] = -2.5 - b * 0.25; o.brazoI[2] = 0.45; o.anteI[0] = -0.7 + b * 0.3; o.musloI[0] = -0.12; o.piernaI[0] = 0.15; o.musloD[0] = -0.05; o.piernaD[0] = 0.12; o.musloI[2] = 0.14; o.musloD[2] = -0.14; o.salto = Math.max(0, b) * 1.2; } },
};
const ANIMS = ['quieto', 'caminar', 'correr', 'tajo', 'reves', 'tajoBajo', 'mazazo', 'barrido', 'estocada', 'punalada', 'directo', 'gancho', 'cruzado', 'ejecucion', 'zarpazo', 'bloqueo', 'festejo'];

/* ---------------------------------------------------------------------
   MALLA: solo se dibujan los cubitos que dan al aire
   --------------------------------------------------------------------- */
let GEO = new T.BoxGeometry(S, S, S);
// sin "carne": en la arena los golpes no sacan cubitos (se pintan de rojo); el laboratorio sigue cortando
const PINTA = (M) => M.motor && !(root.Voxel && root.Voxel.carne === true);   // el laboratorio puede volver a prender la carne con Voxel.carne = true
function calidad(q) { if (q === Q) return; Q = q; S = U / Q; GEO = new T.BoxGeometry(S, S, S); }
const _m = new T.Matrix4(), _v = new T.Vector3(), _c = new T.Color(), _c2 = new T.Color();
const SANGRE_OSC = new T.Color(0x2a0303), SANGRE_F = new T.Color(0x8a0c08), SANGRE = new T.Color(0x5a0606), MORETON = new T.Color(0x4a2a5a), VECINOS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// la malla de una parte: solo las caras de los cubitos que dan al aire (mucho menos para dibujar que cubos enteros)
function armarMalla(p, material) {
  if (!material.vertexColors) { material.vertexColors = true; material.needsUpdate = true; }
  p.malla = new T.Mesh(new T.BufferGeometry(), material);
  p.malla.castShadow = true; p.malla.receiveShadow = true;
  p.malla.userData.parte = p; p.malla.count = 0;
  p.mapa = new Int32Array(p.vivos0 + 8);
  p.grupo.add(p.malla);
}
// caras del cubo: normal y sus 4 esquinas (en medios cubitos), en orden antihorario visto desde afuera
const CARAS = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], 0.92],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]], 0.92],
  [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], 1.0],
  [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]], 0.72],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], 0.96],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], 0.88],
];
function colorCubito(p, mundo, q, i, j, k) {
  const R = mundo.raza, { tipo, vivo, orig } = p;
  const t = tipo[q], h = hash(i + p.g0[0], j + p.g0[1], k + p.g0[2]);
  _c.setHex(t === V.piel ? R.piel : t === V.pelo ? R.pelo : t === V.tela && R.tela != null ? R.tela : COL[t]);
  let f = p.sombra[q] * (1 - (t === V.piel || t === V.pelo ? R.ruido : 0.1) * (h - 0.5) * 2 * 0.6);
  if (t === V.musculo) f *= (Math.floor((j + p.g0[1]) * 0.9 + (i + p.g0[0]) * 0.45) & 1) ? 0.86 : 1.05;   // fibras
  if (t === V.cerebro) f *= (Math.sin((i + p.g0[0]) * 1.7 + Math.sin((j + p.g0[1]) * 1.3) * 2) + Math.sin((k + p.g0[2]) * 1.5 + (j + p.g0[1]) * 0.7)) > 0.3 ? 1.08 : 0.8;
  if (t === V.tripa) f *= (Math.sin((i + p.g0[0]) * 1.1) + Math.sin((j + p.g0[1]) * 1.3 + (k + p.g0[2]) * 0.6)) > 0.2 ? 1.06 : 0.82;
  _c.multiplyScalar(f);
  if (p.moreton[q] > 0.05) _c.lerp(MORETON, Math.min(0.7, p.moreton[q] * 0.6));
  let heridos = 0;
  for (const [a, b, c] of VECINOS) { if (!dentro(p, i + a, j + b, k + c)) continue; const r = idx(p, i + a, j + b, k + c); if (orig[r] && !vivo[r]) heridos++; }
  if (heridos && t !== V.hueso && t !== V.tela && t !== V.colmillo && t !== V.metal && !R.sinSangre) _c.lerp(SANGRE, Math.min(0.75, 0.25 + heridos * 0.18));
  const sg = p.sangre[q];
  if (sg > 0.05 && !R.sinSangre) {
    const k = Math.min(t === V.hueso || t === V.medula ? 0.7 : t === V.metal ? 0.55 : 0.88, sg * (0.75 + h * 0.3));
    _c.lerp(sg > 1.15 ? SANGRE_OSC : sg > 0.6 ? SANGRE : SANGRE_F, k);   // empapado: más oscuro donde hay más
  } else if (heridos && t === V.hueso) _c.lerp(_c2.setHex(0xc89a8a), 0.3);
  if (p.grieta[q] > 0.9 && t === V.hueso) _c.lerp(_c2.setHex(0x3a2a1a), Math.min(0.6, (p.grieta[q] - 0.9) * 0.6));
  if (mundo.srgb) _c.convertSRGBToLinear();
}
let _bufP = new Float32Array(1 << 16), _bufN = new Float32Array(1 << 16), _bufC = new Float32Array(1 << 16), _bufI = new Uint32Array(1 << 15);
function reconstruir(p, mundo) {
  const vis = (t) => t && CAPA[t] >= mundo.rayosN;
  const { nx, ny, nz, tipo, vivo } = p;
  if (!p.vIni || p.vIni.length !== vivo.length) { p.vIni = new Int32Array(vivo.length); p.vCaras = new Uint8Array(vivo.length); } else p.vCaras.fill(0);
  let n = 0, nv = 0, ni = 0;
  const ok = (i, j, k) => { if (!dentro(p, i, j, k)) return false; const q = idx(p, i, j, k); return vivo[q] && vis(tipo[q]); };
  const h2 = S / 2;
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const q = idx(p, i, j, k); if (!vivo[q] || !vis(tipo[q])) continue;
    const exp = [!ok(i + 1, j, k), !ok(i - 1, j, k), !ok(i, j + 1, k), !ok(i, j - 1, k), !ok(i, j, k + 1), !ok(i, j, k - 1)];
    if (!(exp[0] || exp[1] || exp[2] || exp[3] || exp[4] || exp[5])) continue;
    colorCubito(p, mundo, q, i, j, k);
    posLocal(p, i, j, k, _v);
    p.vIni[q] = nv; p.vCaras[q] = (exp[0] ? 1 : 0) | (exp[1] ? 2 : 0) | (exp[2] ? 4 : 0) | (exp[3] ? 8 : 0) | (exp[4] ? 16 : 0) | (exp[5] ? 32 : 0);
    for (let fc = 0; fc < 6; fc++) {
      if (!exp[fc]) continue;
      if (nv * 3 + 12 > _bufP.length) { const g = (a) => { const x = new a.constructor(a.length * 2); x.set(a); return x; }; _bufP = g(_bufP); _bufN = g(_bufN); _bufC = g(_bufC); }
      if (ni + 6 > _bufI.length) { const x = new Uint32Array(_bufI.length * 2); x.set(_bufI); _bufI = x; }
      const [nn, es, luz] = CARAS[fc];
      for (const e of es) {
        const o = nv * 3;
        _bufP[o] = _v.x + e[0] * h2; _bufP[o + 1] = _v.y + e[1] * h2; _bufP[o + 2] = _v.z + e[2] * h2;
        _bufN[o] = nn[0]; _bufN[o + 1] = nn[1]; _bufN[o + 2] = nn[2];
        _bufC[o] = _c.r * luz; _bufC[o + 1] = _c.g * luz; _bufC[o + 2] = _c.b * luz;
        nv++;
      }
      const b0 = nv - 4; _bufI[ni++] = b0; _bufI[ni++] = b0 + 1; _bufI[ni++] = b0 + 2; _bufI[ni++] = b0; _bufI[ni++] = b0 + 2; _bufI[ni++] = b0 + 3;
    }
    p.mapa[n] = q; n++;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(_bufP.slice(0, nv * 3), 3));
  geo.setAttribute('normal', new T.BufferAttribute(_bufN.slice(0, nv * 3), 3));
  const atC = new T.BufferAttribute(_bufC.slice(0, nv * 3), 3); atC.setUsage(T.DynamicDrawUsage); geo.setAttribute('color', atC);
  geo.setIndex(new T.BufferAttribute(_bufI.slice(0, ni), 1));
  geo.computeBoundingSphere();
  if (p.malla.geometry) p.malla.geometry.dispose();
  p.malla.geometry = geo;
  p.malla.count = n;
  mundo.unirSucio = true;   // si el gladiador es una sola malla, hay que rearmarla
}

// repinta solo los cubitos que cambiaron (sangre, moretones): no se rearma la malla, se cambian colores
function recolorear(p, mundo, lista) {
  const at = p.malla.geometry && p.malla.geometry.attributes.color; if (!at || !p.vCaras) return;
  const arr = at.array, pl = p.nx * p.nz;
  for (let a = 0; a < lista.length; a++) {
    const q = lista[a], caras = p.vCaras[q]; if (!caras) continue;
    colorCubito(p, mundo, q, q % p.nx, (q / pl) | 0, ((q / p.nx) | 0) % p.nz);
    let v = p.vIni[q];
    for (let fc = 0; fc < 6; fc++) {
      if (!(caras & (1 << fc))) continue;
      const luz = CARAS[fc][2];
      for (let e = 0; e < 4; e++, v++) { const o = v * 3; arr[o] = _c.r * luz; arr[o + 1] = _c.g * luz; arr[o + 2] = _c.b * luz; }
    }
  }
  at.needsUpdate = true;
  if (mundo.unirColor) mundo.unirColor(p.malla);
}
/* ---------------------------------------------------------------------
   MUNDO
   --------------------------------------------------------------------- */
/* ---------------------------------------------------------------------
   ARMAS Y ESCUDOS (cajitas; el arma apunta a +Z desde la mano)
   --------------------------------------------------------------------- */
// junta todas las piezas de un arma o escudo en UNA sola malla con colores por vértice: el celular la dibuja de una vez (antes eran ~9 dibujos por arma)
function fundir(g2) {
  const pos = [], nor = [], col = [], v = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3();
  g2.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(g2.matrixWorld).invert();
  for (const m of g2.children.slice()) {
    if (!m.isMesh) continue;
    const mw = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mw);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, P = g.attributes.position, N = g.attributes.normal, c = m.material.color;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(mw); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); }
    g2.remove(m); m.geometry.dispose();
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const una = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true })); una.castShadow = true; g2.add(una);
  return g2;
}
function armaMesh(tipo, srgb) {
  const g2 = new T.Group(), mats = {};
  const mat = (col) => mats[col] || (mats[col] = new T.MeshLambertMaterial({ color: srgb ? new T.Color(col).convertSRGBToLinear() : new T.Color(col) }));
  const mk = (w, h, d, col, z, y = 0, x = 0) => { const m = new T.Mesh(new T.BoxGeometry(U * w, U * h, U * d), mat(col)); m.position.set(U * x, U * y, U * z); m.castShadow = true; g2.add(m); return m; };
  let largo = 30;
  if (tipo === 'gladius') { mk(0.9, 2.6, 24, 0xbfc5cf, 15); mk(1.0, 0.7, 24, 0xf2f4f8, 15, 1.3); mk(1.0, 0.7, 24, 0x8f97a4, 15, -1.3); mk(0.9, 1.8, 2, 0xbfc5cf, 28); mk(0.9, 1, 1.4, 0xbfc5cf, 29.6); mk(2, 6.4, 1.5, 0xc8a640, 2.2); mk(1.5, 1.5, 4.4, 0x5a3a1c, -0.2); mk(2.2, 2.2, 1.6, 0xc8a640, -3); }
  else if (tipo === 'daga') { mk(0.8, 2, 13, 0xc4cad3, 9.5); mk(0.9, 0.6, 13, 0xf2f4f8, 9.5, 1); mk(1.6, 4.4, 1.2, 0x8a6a30, 2.4); mk(1.4, 1.4, 4, 0x3a2414, 0); largo = 16; }
  else if (tipo === 'lanza') { mk(1.3, 1.3, 70, 0x8a6236, 14); mk(0.8, 3, 8, 0xc4cad3, 52); mk(0.9, 1.8, 3, 0xc4cad3, 57); mk(1.8, 1.8, 2, 0x5a5f66, 47.5); largo = 58; }
  else if (tipo === 'martillo') { mk(1.6, 1.6, 30, 0x7a5430, 12); mk(5.5, 5.5, 9, 0x6e737a, 27, 0); mk(6, 6, 1, 0x4a4e54, 27, 0); largo = 32; }
  else if (tipo === 'garrote') { mk(2, 2, 12, 0x7a5430, 3); mk(3.2, 3.2, 12, 0x6a4626, 14); mk(4.2, 4.2, 8, 0x5c3c20, 23); for (let i = 0; i < 5; i++) mk(1, 1, 1, 0x3a2414, 14 + i * 2.6, 2 * (i % 2 ? 1 : -1), 2 * (i % 3 ? 1 : -1)); largo = 27; }
  else return null;   // cestus, garras y a mano limpia: no hay nada en la mano
  g2.userData.caja = new T.Box3(new T.Vector3(-U * 3, -U * 3, -U * 4), new T.Vector3(U * 3, U * 3, U * largo));
  return fundir(g2);
}
function escudoMesh(tipo, srgb) {
  if (!tipo || tipo === 'ninguno') return null;
  const g2 = new T.Group(), c = (col) => (srgb ? new T.Color(col).convertSRGBToLinear() : new T.Color(col));
  if (tipo === 'chico') {   // broquel redondo
    const m = new T.Mesh(new T.CylinderGeometry(U * 7.5, U * 7.5, U * 1.4, 18), new T.MeshLambertMaterial({ color: c(0x8a6236) })); m.rotation.z = Math.PI / 2; g2.add(m);
    const b = new T.Mesh(new T.CylinderGeometry(U * 2.6, U * 3, U * 2.4, 12), new T.MeshLambertMaterial({ color: c(0xa8adb4) })); b.rotation.z = Math.PI / 2; b.position.x = U * 1.2; g2.add(b);
    const aro = new T.Mesh(new T.TorusGeometry(U * 7.4, U * 0.7, 6, 18), new T.MeshLambertMaterial({ color: c(0x7a7e84) })); aro.rotation.y = Math.PI / 2; g2.add(aro);
    g2.userData.caja = new T.Box3(new T.Vector3(-U, -U * 7.5, -U * 7.5), new T.Vector3(U * 2.4, U * 7.5, U * 7.5));
  } else {   // escudo grande rectangular (scutum), un poco curvo
    for (let i = -2; i <= 2; i++) { const m = new T.Mesh(new T.BoxGeometry(U * 1.4, U * 26, U * 4.2), new T.MeshLambertMaterial({ color: c(0x8e1a12) })); m.position.set(U * (0.6 - Math.abs(i) * 0.45), 0, U * i * 4); m.rotation.y = -i * 0.12; g2.add(m); }
    const r1 = new T.Mesh(new T.BoxGeometry(U * 1.6, U * 1, U * 21), new T.MeshLambertMaterial({ color: c(0xc8a640) })); r1.position.set(U * 0.8, U * 12.6, 0); g2.add(r1); const r2 = r1.clone(); r2.position.y = -U * 12.6; g2.add(r2);
    const b = new T.Mesh(new T.BoxGeometry(U * 2.4, U * 5, U * 5), new T.MeshLambertMaterial({ color: c(0xc8a640) })); b.position.x = U * 1.4; g2.add(b);
    g2.userData.caja = new T.Box3(new T.Vector3(-U, -U * 13, -U * 11), new T.Vector3(U * 2.6, U * 13, U * 11));
  }
  return fundir(g2);
}

/* ---------------------------------------------------------------------
   EFECTOS compartidos por todos los gladiadores de una escena:
   gotas de sangre (2D), manchas en la arena y cubitos sueltos
   --------------------------------------------------------------------- */
function crearEfectos(escena, srgb) {
  const _v = new T.Vector3(), _m = new T.Matrix4(), _c = new T.Color();
  /* ---------- sangre 2D: gotas (sprites) y manchas planas ---------- */
  const tex2 = (c) => { const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; if (srgb) t.encoding = T.sRGBEncoding; return t; };
  const texGota = (() => { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.fillStyle = '#9a1410'; x.fillRect(2, 1, 4, 6); x.fillRect(1, 2, 6, 4); x.fillStyle = '#c4201a'; x.fillRect(3, 2, 2, 2); return tex2(c); })();
  const texMancha = [0, 1, 2].map((s) => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#6e0a08'; for (let i = 0; i < 9 + s * 3; i++) { const r = 2 + Math.random() * 7, a = Math.random() * 6.3, d = Math.random() * 8; x.beginPath(); x.arc(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, r, 0, 7); x.fill(); } x.fillStyle = '#8e0f0f'; x.fillRect(12, 12, 6, 5); return tex2(c); });
  const matGota = new T.SpriteMaterial({ map: texGota, transparent: true });
  const matMancha = texMancha.map((m) => new T.MeshBasicMaterial({ map: m, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const planoM = new T.PlaneGeometry(1, 1);
  // gotas: todas en UN solo objeto de puntos (antes era un sprite por gota: cientos de dibujos)
  const NG = 600, gPos = new Float32Array(NG * 3), gGeo = new T.BufferGeometry();
  gGeo.setAttribute('position', new T.BufferAttribute(gPos, 3).setUsage(T.DynamicDrawUsage)); gGeo.setDrawRange(0, 0);
  const gPts = new T.Points(gGeo, new T.PointsMaterial({ map: texGota, transparent: true, alphaTest: 0.3, size: 0.03, sizeAttenuation: true, depthWrite: false }));
  gPts.frustumCulled = false; escena.add(gPts);
  let gotas = [];
  function gota(pos, vel, tam = 1) {
    if (gotas.length >= NG) gotas.shift();
    gotas.push({ p: pos.clone(), v: vel.clone(), tam });
  }
  // manchas: un InstancedMesh por textura, como anillo (el más viejo se reemplaza)
  const NM = 160, mDum = new T.Object3D();
  const mIM = matMancha.map((mt) => { const im = new T.InstancedMesh(planoM, mt, NM); im.count = 0; im.frustumCulled = false; escena.add(im); return { im, i: 0 }; });
  function mancha(x, z, tam) {
    const c = mIM[(Math.random() * 3) | 0];
    mDum.position.set(x, 0.002 + Math.random() * 0.0015, z); mDum.rotation.set(-Math.PI / 2, 0, Math.random() * 6.3); mDum.scale.set(tam, tam, 1); mDum.updateMatrix();
    c.im.setMatrixAt(c.i, mDum.matrix); c.i = (c.i + 1) % NM; if (c.im.count < NM) c.im.count++; c.im.instanceMatrix.needsUpdate = true;
  }
  function salpicar(pos, dir, n, fuerza) { for (let i = 0; i < n; i++) gota(pos, _v.set(dir.x * fuerza + (Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.8 * fuerza, dir.z * fuerza + (Math.random() - 0.5) * 1.6), Math.random() < 0.3 ? 1.6 : 1); }

  /* ---------- pedacitos (cubitos sueltos) ---------- */
  const NB = 900, bits = new T.InstancedMesh(GEO, new T.MeshLambertMaterial(), NB); bits.castShadow = true; bits.frustumCulled = false; escena.add(bits);
  for (let k = 0; k < NB; k++) bits.setColorAt(k, _c.setHex(0x8e0f0f)); bits.count = 0;
  const bitDat = []; let bitI = 0;
  function bit(pos, color) {
    let b; if (bitDat.length < NB) { b = { p: new T.Vector3(), v: new T.Vector3(), r: 0 }; bitDat.push(b); } else b = bitDat[bitI = (bitI + 1) % NB];
    b.p.copy(pos); b.v.set((Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4); b.quieto = false; b.r = Math.random() * 6;
    bits.setColorAt(bitDat.indexOf(b), srgb ? color.convertSRGBToLinear() : color); bits.instanceColor.needsUpdate = true;
  }
  function paso(dt) {
    for (const g2 of gotas) { g2.v.y -= 9.8 * dt; g2.p.addScaledVector(g2.v, dt); if (g2.p.y <= 0.003) { mancha(g2.p.x, g2.p.z, 0.02 + Math.random() * 0.03 * g2.tam); g2.muerta = true; } }
    if (gotas.some((g2) => g2.muerta)) gotas = gotas.filter((g2) => !g2.muerta);
    for (let k = 0; k < gotas.length; k++) { const p = gotas[k].p; gPos[k * 3] = p.x; gPos[k * 3 + 1] = p.y; gPos[k * 3 + 2] = p.z; }
    gGeo.setDrawRange(0, gotas.length); gGeo.attributes.position.needsUpdate = true;
    for (let k = 0; k < bitDat.length; k++) {
      const b = bitDat[k];
      if (b.quieto) continue;
      b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt); b.r += dt * 8; if (b.p.y < S / 2) { b.p.y = S / 2; b.v.multiplyScalar(0.35); b.v.y = Math.abs(b.v.y) * 0.3; if (b.v.lengthSq() < 0.02) b.quieto = true; }
      _m.makeRotationY(b.r); _m.setPosition(b.p); bits.setMatrixAt(k, _m); bits.instanceMatrix.needsUpdate = true;
    }
    bits.count = bitDat.length;
  }
  function limpiar() {
    gotas = []; gGeo.setDrawRange(0, 0); for (const c of mIM) { c.im.count = 0; c.i = 0; }
    bitDat.length = 0; bits.count = 0;
  }
  return { gota, mancha, salpicar, bit, paso, limpiar };
}

function crearMundo(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const escena = new T.Scene(); escena.background = new T.Color(0x1c140e); escena.fog = new T.Fog(0x1c140e, 9, 20);
  const camara = new T.PerspectiveCamera(36, 1, 0.05, 40);
  escena.add(new T.HemisphereLight(0xfff0dc, 0x6a5038, 0.62));
  const sol = new T.DirectionalLight(0xffe0b4, 1.0); sol.position.set(2.2, 5, 3.4); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048); Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 4.2, bottom: -1, near: 0.5, far: 14 }); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.012; escena.add(sol);
  const contra = new T.DirectionalLight(0x9db6ff, 0.42); contra.position.set(-3, 2.5, -3.5); escena.add(contra);   // luz de contra: recorta la silueta
  // piso de arena y muro del coliseo
  const ca = document.createElement('canvas'); ca.width = ca.height = 256; const g = ca.getContext('2d');
  g.fillStyle = '#c9a46b'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) { const v = 150 + Math.random() * 70; g.fillStyle = `rgba(${v},${v * 0.8},${v * 0.52},0.4)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const ta = new T.CanvasTexture(ca); ta.wrapS = ta.wrapT = T.RepeatWrapping; ta.repeat.set(8, 8); ta.magFilter = T.NearestFilter; ta.encoding = T.sRGBEncoding;
  const piso = new T.Mesh(new T.CircleGeometry(9, 48), new T.MeshLambertMaterial({ map: ta })); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; escena.add(piso);
  const cm = document.createElement('canvas'); cm.width = 64; cm.height = 32; const gm = cm.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 118 + Math.random() * 30; gm.fillStyle = `rgb(${v},${v * 0.78},${v * 0.55})`; gm.fillRect(x * 16 + (y % 2) * 8 - 8, y * 8, 15, 7); gm.fillRect(x * 16 + (y % 2) * 8 + 56, y * 8, 15, 7); }
  const tm = new T.CanvasTexture(cm); tm.wrapS = tm.wrapT = T.RepeatWrapping; tm.repeat.set(24, 2); tm.magFilter = T.NearestFilter; tm.encoding = T.sRGBEncoding;
  const muro = new T.Mesh(new T.CylinderGeometry(9, 9, 1.9, 48, 1, true), new T.MeshLambertMaterial({ map: tm, side: T.BackSide })); muro.position.y = 0.95; escena.add(muro);
  const grada = new T.Mesh(new T.CylinderGeometry(13, 9, 3, 48, 1, true), new T.MeshLambertMaterial({ color: 0x3a2a1e, side: T.BackSide })); grada.position.y = 3.4; escena.add(grada);
  const material = new T.MeshLambertMaterial();
  const vara = new T.Group(); escena.add(vara);
  { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const x = cv.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f2e6cc' : '#8e1a12'; x.fillRect(0, 64 - (i + 1) * 8, 4, 8); }
    const tv = new T.CanvasTexture(cv); tv.magFilter = T.NearestFilter; tv.encoding = T.sRGBEncoding;
    const palo = new T.Mesh(new T.BoxGeometry(0.03, 4, 0.03), new T.MeshLambertMaterial({ map: tv })); palo.position.y = 2; palo.castShadow = true; vara.add(palo);
    for (let m = 1; m <= 3; m++) { const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 32; const x2 = c2.getContext('2d'); x2.fillStyle = '#f2e6cc'; x2.font = 'bold 22px sans-serif'; x2.fillText(m + ' m', 4, 24); const t2 = new T.CanvasTexture(c2); t2.encoding = T.sRGBEncoding; const sp = new T.Sprite(new T.SpriteMaterial({ map: t2, transparent: true })); sp.scale.set(0.24, 0.12, 1); sp.position.set(0.15, m, 0); vara.add(sp); const tick = new T.Mesh(new T.BoxGeometry(0.1, 0.012, 0.012), new T.MeshBasicMaterial({ color: 0xf2e6cc })); tick.position.set(0.04, m, 0); vara.add(tick); } }

  const ef = crearEfectos(escena, true);
  const M = instalar({ renderer, escena, camara, srgb: true, cam: { th: 0.55, ph: 1.36, d: 3.2, foco: new T.Vector3(0, 1, 0) }, lento: false }, escena, ef, material);
  const nuevoG = M.nuevo, pasoG = M.paso;
  M.nuevo = (op) => { ef.limpiar(); nuevoG(op); vara.position.set(Math.max(0.55, M.alto * 0.32), 0, -0.25); M.cam.foco.set(0, M.alto * 0.53, 0); M.cam.d = Math.max(2.2, M.alto * 1.95); };
  M.paso = (dt) => {
    if (M.lento) dt *= 0.25;
    pasoG(dt); ef.paso(dt);
    const c = M.cam;
    camara.position.set(c.foco.x + Math.sin(c.th) * Math.sin(c.ph) * c.d, Math.max(0.08, c.foco.y + Math.cos(c.ph) * c.d), c.foco.z + Math.cos(c.th) * Math.sin(c.ph) * c.d);
    camara.lookAt(c.foco);
    renderer.render(escena, camara);
  };
  M.tam = (w, h) => { renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); };
  return M;
}

/* ---------------------------------------------------------------------
   GLADIADOR: instala en M todo lo de un cuerpo (armar, posar, lastimar, ragdoll)
   --------------------------------------------------------------------- */
function instalar(M, escena, ef, material) {
  const { gota, mancha, salpicar, bit } = ef;
  const tex2 = (c) => { const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; if (M.srgb) t.encoding = T.sRGBEncoding; return t; };
  const _v = new T.Vector3(), _m = new T.Matrix4(), _c = new T.Color();
  Object.assign(M, { rayosN: 0, raza: razaDe('humano'), partes: [], N: {}, cuerpos: [], t: 0 });

  const colorDe = (t) => _c.setHex(t === V.piel ? M.raza.piel : t === V.pelo ? M.raza.pelo : COL[t] || 0x8e0f0f);

  /* ---------- cara 2D: ojos de punto y boca, sin nariz ---------- */
  function caraTex(expr, info, cfg) {
    const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d');
    const px = info.lado / 24, h = info.dy / 2 / px, ey = Math.round(12 - h - cfg.ojo / 2), by = Math.round(12 + h), s = cfg.sep, o = cfg.ojo, bw = cfg.boca, bx = 12 - bw / 2;
    const tinta = '#16100c'; x.fillStyle = cfg.color;
    const ojo = (cx) => {
      const x0 = Math.round(cx - o / 2);
      if (expr === 'muerto') { x.fillStyle = tinta; x.fillRect(x0 - 1, ey, 1, 1); x.fillRect(x0 + o, ey, 1, 1); x.fillRect(x0, ey + 1, o, 1); x.fillRect(x0 - 1, ey + 2, 1, 1); x.fillRect(x0 + o, ey + 2, 1, 1); }
      else if (expr === 'dolor') { x.fillStyle = tinta; x.fillRect(x0 - 1, ey + 1, o + 2, 1); x.fillRect(cx < 12 ? x0 + o : x0 - 1, ey, 1, 1); }
      else if (expr === 'parpadeo') { x.fillStyle = tinta; x.fillRect(x0, ey + o - 1, o, 1); }
      else { x.fillStyle = cfg.color; x.fillRect(x0, ey, o, o); if (cfg.estilo === 'lobo') { x.fillStyle = tinta; x.fillRect(x0 + (cx < 12 ? o - 1 : 0), ey, 1, o); } if (expr === 'furia' || cfg.estilo === 'lobo') { x.fillStyle = tinta; for (let i = 0; i < o + 2; i++) x.fillRect(cx < 12 ? x0 - 1 + i : x0 + o - i, ey - 2 + Math.round(i * 0.5), 1, 1); } }
    };
    if (cfg.ojoUnico) ojo(12); else { ojo(12 - s); ojo(12 + s); }
    if (bw) {
      x.fillStyle = tinta;
      if (expr === 'dolor' || expr === 'furia' || cfg.estilo === 'ghoul') {
        const alto = expr === 'dolor' ? 4 : 3; x.fillRect(bx, by - 1, bw, alto);
        x.fillStyle = '#5a0e0a'; x.fillRect(bx + 1, by, bw - 2, alto - 2);
        x.fillStyle = '#f2efe0'; if (expr === 'dolor') x.fillRect(bx + 1, by, bw - 2, 1); else for (let i = 1; i < bw - 1; i++) if (cfg.estilo !== 'ghoul' || i % 2) x.fillRect(bx + i, by, 1, cfg.estilo === 'ghoul' ? 1 : alto - 2);
      } else if (expr === 'muerto') { x.fillRect(bx, by, bw, 1); x.fillStyle = '#b4504a'; x.fillRect(bx + bw - 3, by + 1, 2, 2); }
      else { x.fillRect(bx, by, bw, 1); x.fillRect(bx - 1, by + 1, 1, 1); x.fillRect(bx + bw, by + 1, 1, 1); }
    }
    return tex2(c);
  }
  function limpiar() {
    for (const c of M.cuerpos) if (c.obj.parent) c.obj.parent.remove(c.obj);
    for (const p of M.partes) if (p.grupo.parent === escena) escena.remove(p.grupo);
    M.rag = null;
    if (M.raiz && M.raiz.parent) M.raiz.parent.remove(M.raiz);
    for (const p of M.partes) if (p.malla && p.malla.geometry) p.malla.geometry.dispose();
    M.partes = []; M.cuerpos = []; M.N = {}; M.caido = false;
    if (M.unida) { M.unida.parent && M.unida.parent.remove(M.unida); M.unida.geometry.dispose(); M.unida = null; }
    if (M.tiraCaras) { M.tiraCaras.dispose(); M.tiraCaras = null; }
  }
  const cache = {};
  function nuevo(op = {}) {
    limpiar();
    const R = razaDe(op.raza === 'esqueleto' ? 'humano' : op.raza || 'humano'); M.raza = R;
    if (op.altura) R.altura = op.altura;
    rasgos(R, op.raza, op.semilla != null ? op.semilla : (Math.random() * 1e9) | 0);
    if (op.tela != null) R.tela = op.tela;
    if (op.piel != null) R.piel = op.piel;
    if (op.pelo != null) R.pelo = op.pelo;
    R.armadura = op.armadura || 'ninguna'; R.corona = !!op.corona;
    if (op.peinado) R.peinado = op.peinado; if (op.barba) R.barba = op.barba;
    if (op.raza === 'esqueleto') { R.soloHueso = true; R.sinSangre = true; }
    if (op.esbirro && LOOK_ESBIRRO[op.esbirro]) { const L = LOOK_ESBIRRO[op.esbirro]; R.esbirro = op.esbirro; Object.assign(R, L, { cara: { ...R.cara, ...(L.cara || {}) } }); }
    if (op.ojosRojos) { R.ojosRojos = true; R.cara = { ...R.cara, color: '#ff1a1a' }; }   // los resucitados del Diablo
    if (op.jefe && LOOK_JEFE[op.jefe]) { const L = LOOK_JEFE[op.jefe]; R.jefe = op.jefe; Object.assign(R, L, { cara: { ...R.cara, ...(L.cara || {}) } }); }
    const A = anatomiaDe(R);
    const raiz = new T.Group(); (op.padre || escena).add(raiz); M.raiz = raiz; M.op = op;
    M.N = A.partes; M.partes = Object.values(A.partes);
    for (const p of M.partes) armarMalla(p, material);
    raiz.add(A.partes.pelvis.grupo);
    for (const [h, [pa, u]] of Object.entries(A.juntas)) { const padre = A.partes[pa], hijo = A.partes[h]; hijo.grupo.position.set(u[0] * U, u[1] * U, u[2] * U); padre.grupo.add(hijo.grupo); padre.hijos.push({ parte: hijo, obj: hijo.grupo, junta: aGrilla(padre, u) }); hijo.padre = padre; }
    raiz.parent.updateMatrixWorld(true); const pInv = new T.Matrix4().copy(raiz.parent.matrixWorld).invert();
    raiz.updateMatrixWorld(true);
    { const cb = A.partes.cabeza; let top = -1e9; for (const q of cb.craneo) { const j = (q / (cb.nx * cb.nz)) | 0; if (j > top) top = j; }
      M.cabTop = (top + cb.g0[1]) * S; const yTop = cb.grupo.localToWorld(new T.Vector3(0, M.cabTop + 1.3 * U, 0)).applyMatrix4(pInv).y;
      let yBot = 1e9; for (const L of ['D', 'I']) for (const s0 of A.partes['pierna' + L].suelas) yBot = Math.min(yBot, A.partes['pierna' + L].grupo.localToWorld(s0.clone()).applyMatrix4(pInv).y);
      R.esc = R.altura / (yTop - yBot); raiz.scale.setScalar(R.esc); M.alto = R.altura; }
    // arma en la mano derecha y escudo en el antebrazo izquierdo
    const aD = A.partes.anteD, esp = armaMesh(op.arma || 'gladius', M.srgb); M.espada = null; M.arma = op.arma || 'gladius';
    if (esp) { esp.position.set(aD.mano[0] * U, aD.mano[1] * U, aD.mano[2] * U); aD.grupo.add(esp); M.espada = esp; aD.hijos.push({ obj: esp, junta: aGrilla(aD, aD.mano), solido: true, caja: esp.userData.caja }); }
    const aI = A.partes.anteI, esc = escudoMesh(op.escudo, M.srgb); M.escudo = esc;
    if (esc) { const pz = [R.rAnte * 1.1, -R.ante * 0.55, 0.4]; esc.position.set(pz[0] * U, pz[1] * U, pz[2] * U); aI.grupo.add(esc); aI.hijos.push({ obj: esc, junta: aGrilla(aI, [0, pz[1], 0]), solido: true, caja: esc.userData.caja }); }
    // cara pintada
    const cb = A.partes.cabeza, ci = cb.caraInfo;
    M.caras = {}; for (const e of ['normal', 'dolor', 'muerto', 'furia', 'parpadeo']) M.caras[e] = caraTex(e, ci, R.cara);
    const cara = new T.Mesh(new T.PlaneGeometry(ci.lado * U, ci.lado * U), new T.MeshLambertMaterial({ map: M.caras.normal, transparent: true, alphaTest: 0.5 }));
    cara.position.set(0, ci.y * U, ci.z * U); cb.grupo.add(cara); M.cara = cara; if (R.soloHueso) { cara.visible = false; M.caraBorrada = true; }
    cb.hijos.push({ obj: cara, junta: aGrilla(cb, [0, ci.y, ci.z - 1.5]), cara: true });
    for (const p of M.partes) reconstruir(p, M);
    Object.assign(M, { caraBorrada: !!R.soloHueso, muerto: false, expr: 'normal', exprT: 0, parp: 2, clip: 'quieto', clipT: 0, base: 'quieto', cur: guardia(poseVacia(), R), flinch: { x: 0, z: 0, vx: 0, vz: 0 } });
    M.tirado = 0; M.arrodillado = 0; M.cortados = {}; M.fracturados = {}; M.decap = false; M.modo = 'pie'; M.motor = !!op.motor;
    if (op.protesis) for (const [m, t] of Object.entries(op.protesis)) if (t) protesis(m, t);
    aplicarPose(0, true);
    M.unir = !!op.motor && op.unir !== false; M.matUnida = material;
    if (M.unir) armarUnida();
  }
  function expresion(e, dur = 0.7) { if (M.muerto && e !== 'muerto') return; M.expr = e; M.exprT = dur; if (M.cara) M.cara.material.map = M.caras[e]; if (M.unida) uvCara(); }
  // reacción encima de la pose: 'cabeza' | 'cuerpo' | 'bloqueo' | 'esquive' · k = qué tan fuerte · lado = -1 / 1
  function reaccion(tipo, k = 1, lado = 1) { if (M.caido || M.muerto) return; M.reac = { tipo, k: Math.min(1.4, Math.max(0.25, k)), lado, t: 0, dur: tipo === 'cabeza' ? 0.5 : tipo === 'cuerpo' ? 0.58 : tipo === 'bloqueo' ? 0.45 : 0.5 }; }
  function anim(n, desde = 0) { if (M.caido || !CLIPS[n]) return; if (CLIPS[n].dur) { M.clip = n; M.clipT = desde; M.carga = null; } else { M.base = n; if (!CLIPS[M.clip].dur) { M.clip = n; } } if (CLIPS[n].cara) expresion(CLIPS[n].cara, CLIPS[n].dur || 1.2); }
  const conectado = (p) => { for (; p; p = p.padre) if (p.suelto) return false; return true; };
  const vivosDe = (p, lista) => { let c = 0; for (const q of lista) if (p.vivo[q]) c++; return lista.length ? c / lista.length : 0; };

  /* ---------- pose: del clip a las articulaciones ---------- */
  const obj = poseVacia(), _mInv = new T.Matrix4(), _o = new T.Vector3();
  function aplicarPose(dt, ya) {
    const R = M.raza, N = M.N, cur = M.cur;
    for (const a of ARTIC) obj[a][0] = obj[a][1] = obj[a][2] = 0; for (const e of ESCALARES) obj[e] = 0;
    M.tA = (M.tA || 0) + dt * (M.ritmo || 1);
    const modo = M.modo || 'pie';
    if (M.caido || modo === 'tirado') { obj.pecho[0] = 0.25; obj.cabeza[0] = 0.3; obj.brazoD[2] = -0.5; obj.brazoI[2] = 0.6; obj.anteD[0] = -0.4; obj.anteI[0] = -0.5; obj.musloD[0] = -0.3; obj.piernaD[0] = 0.5; obj.musloI[0] = 0.1; obj.piernaI[0] = 0.25; obj.muneca = cur.muneca; }
    else if (modo === 'rendido') { obj.musloD[0] = obj.musloI[0] = 0.05; obj.musloD[2] = -0.12; obj.musloI[2] = 0.12; obj.piernaD[0] = obj.piernaI[0] = 1.55; obj.pecho[0] = 0.45 + R.joroba; obj.cabeza[0] = 0.5; obj.brazoD[0] = 0.15; obj.anteD[0] = -0.35; obj.brazoI[0] = 0.1; obj.anteI[0] = -0.3; obj.muneca = 0.4; }
    else if (modo === 'comer') { const b = Math.sin(M.t * 9); obj.musloD[0] = obj.musloI[0] = -1.35; obj.musloD[2] = -0.25; obj.musloI[2] = 0.25; obj.piernaD[0] = obj.piernaI[0] = 2.0; obj.pecho[0] = 0.75 + b * 0.06; obj.cabeza[0] = -0.2 + b * 0.15; obj.brazoD[0] = -0.9; obj.anteD[0] = -0.9 + b * 0.2; obj.brazoI[0] = -1.0; obj.anteI[0] = -0.7 - b * 0.2; obj.muneca = 0.6; }
    else if (modo === 'paseo') {   // cinemáticas: camina tranquilo y erguido (M.andar 0..1) y gesticula cuando habla (M.habla)
      const an = M.andar || 0, f = M.tA * 5.2, sn = Math.sin(f), b = Math.sin(M.tA * 1.9);
      for (const [L, ph] of [['D', f], ['I', f + Math.PI]]) { obj['muslo' + L][0] = an * (-0.08 - 0.42 * Math.sin(ph)); obj['pierna' + L][0] = an * (0.1 + 0.7 * Math.pow(Math.max(0, Math.cos(ph)), 1.3)); obj['muslo' + L][2] = L === 'D' ? -0.04 : 0.04; }
      obj.pelvis[1] = 0.08 * sn * an; obj.pecho[1] = -0.12 * sn * an; obj.pecho[0] = -0.05 + b * 0.015; obj.cabeza[0] = -0.07; obj.cabeza[1] = (M.mirar || 0) + 0.06 * sn * an;
      obj.brazoD[0] = 0.05 + 0.22 * sn * an; obj.brazoD[2] = -0.12; obj.anteD[0] = -0.25; obj.brazoI[0] = 0.05 - 0.22 * sn * an; obj.brazoI[2] = 0.12; obj.anteI[0] = -0.25;
      if (M.sentado) { obj.musloD[0] = obj.musloI[0] = -1.45; obj.musloD[2] = -0.1; obj.musloI[2] = 0.1; obj.piernaD[0] = 1.4; obj.piernaI[0] = 1.55; obj.pelvis[1] = 0; obj.pecho[0] = 0.08 + b * 0.015; obj.brazoD[0] = obj.brazoI[0] = -0.35; obj.anteD[0] = obj.anteI[0] = -0.9; }
      if (M.contar && !M.habla) {   // cuenta monedas sobre la mesa: las manos van y vienen, la cabeza mira para abajo
        const c1 = Math.sin(M.tA * 6.3), c2 = Math.sin(M.tA * 6.3 + 2.1);
        obj.brazoD[0] = -0.55 + 0.12 * c1; obj.anteD[0] = -0.75 + 0.25 * c1; obj.brazoD[2] = -0.25; obj.brazoI[0] = -0.5 + 0.1 * c2; obj.anteI[0] = -0.8 + 0.2 * c2; obj.brazoI[2] = 0.25; obj.muneca = 0.4 * c1;
        obj.cabeza[0] = 0.32 + 0.04 * Math.sin(M.tA * 1.1); obj.pecho[0] += 0.12;
      }
      if (M.habla) {   // habla: las dos manos acompañan lo que dice, asiente y gira la cabeza
        const g1 = Math.sin(M.tA * 2.3), g2 = Math.sin(M.tA * 3.7 + 1), g3 = Math.sin(M.tA * 1.3 + 2), g4 = Math.max(0, Math.sin(M.tA * 0.9 + 0.5));
        obj.brazoD[0] = -0.55 + 0.28 * g1; obj.brazoD[2] = -0.32 - 0.12 * g3; obj.anteD[0] = -1.15 + 0.38 * g2; obj.muneca = 0.3 * g2;
        obj.brazoI[0] = 0.05 - 0.5 * g4 + 0.12 * g2; obj.brazoI[2] = 0.15 + 0.2 * g4; obj.anteI[0] = -0.3 - 0.8 * g4 - 0.2 * g1;
        obj.cabeza[0] = -0.05 + 0.08 * g2; obj.cabeza[1] += 0.14 * g3; obj.cabeza[2] = 0.07 * g1; obj.pecho[1] += 0.1 * g1; obj.pecho[0] += 0.03 * g2;
      } else if (an < 0.3) {   // escucha: respira, mira un poco alrededor y asiente de a ratos
        obj.cabeza[1] += 0.1 * Math.sin(M.tA * 0.45); obj.cabeza[0] += 0.04 * Math.max(0, Math.sin(M.tA * 1.6)) * Math.max(0, Math.sin(M.tA * 0.3));
        obj.anteI[0] = -0.25 - 0.1 * b; obj.anteD[0] = -0.25 + 0.08 * Math.sin(M.tA * 0.7);
      }
    }
    else if (modo === 'erguido') { const b = Math.sin(M.tA * 1.9); obj.pecho[0] = -0.06 + b * 0.02; obj.cabeza[0] = -0.08 - b * 0.015; obj.cabeza[1] = Math.sin(M.tA * 0.37) * 0.25; obj.brazoD[0] = 0.08; obj.brazoD[2] = -0.1; obj.anteD[0] = -0.2 + b * 0.03; obj.brazoI[0] = -0.15; obj.brazoI[2] = 0.08; obj.anteI[0] = -1.15 - b * 0.03; obj.musloD[2] = -0.04; obj.musloI[2] = 0.04; obj.rx = Math.sin(M.tA * 0.6) * 0.3; }
    else {
      guardia(obj, R);
      const c = CLIPS[M.clip];
      let cc = null, ct = 0;
      if (M.carga && CLIPS[M.carga]) { if (c.dur) { M.clip = M.base; M.clipT = 0; } cc = CLIPS[M.carga]; ct = M.cargaT != null ? M.cargaT : cc.tw || 0.25; pistas(obj, ct, cc.P); obj.pecho[0] += R.joroba; obj.cabeza[0] -= R.joroba * 0.8; }   // lleva el arma atrás y la trae: el contacto cae justo cuando la pelea dice que pegó
      else if (c.dur) { M.clipT += dt; if (M.clipT >= c.dur) { M.clip = M.base; M.clipT = 0; CLIPS[M.base].fn(M.tA, obj); } else { pistas(obj, M.clipT, c.P); cc = c; ct = M.clipT; } if (c.dur && M.clip !== M.base) { obj.pecho[0] += R.joroba; obj.cabeza[0] -= R.joroba * 0.8; } }
      else c.fn(M.tA, obj);
      // el golpe va a buscar al rival: se estira lo que falte para llegar y apunta a la altura donde pega
      if (cc && cc.imp) {
        const e = ct <= cc.imp ? Math.pow(ct / cc.imp, 2) : Math.max(0, 1 - (ct - cc.imp) / 0.3);
        obj.rz += ((M.lunge || 0) / (U * R.esc)) * e;
        const pch = (M.aim || 0) * e; obj.brazoD[0] -= pch * 0.9; obj.pecho[0] -= pch * 0.4; obj.cabeza[0] -= pch * 0.3;
      }
      // reacción a lo que le hicieron: se suma arriba de lo que esté haciendo
      const rc = M.reac;
      if (rc) {
        rc.t += dt; const u = rc.t / rc.dur;
        if (u >= 1) M.reac = null;
        else {
          const w = rc.k * (u < 0.16 ? u / 0.16 : Math.pow(1 - (u - 0.16) / 0.84, 1.5)), L = rc.lado;
          if (rc.tipo === 'cabeza') { obj.cabeza[0] -= 0.65 * w; obj.cabeza[2] += 0.4 * w * L; obj.pecho[0] -= 0.3 * w; obj.pecho[1] += 0.3 * w * L; obj.rz -= 3.5 * w; obj.musloD[0] += 0.2 * w; obj.brazoI[0] += 0.35 * w; obj.brazoD[2] -= 0.25 * w; }
          else if (rc.tipo === 'cuerpo') { obj.pecho[0] += 0.55 * w; obj.cabeza[0] += 0.3 * w; obj.pecho[2] += 0.22 * w * L; obj.rz -= 3 * w; obj.piernaD[0] += 0.35 * w; obj.piernaI[0] += 0.35 * w; obj.musloI[0] -= 0.2 * w; obj.brazoI[0] += 0.45 * w; obj.brazoI[2] -= 0.3 * w; obj.anteD[0] -= 0.2 * w; }
          else if (rc.tipo === 'bloqueo') {
            const m = Math.min(1, w * 1.4), a = (arr, i, v) => { arr[i] += (v - arr[i]) * m; };
            if (M.op && M.op.escudo && M.op.escudo !== 'ninguno') { a(obj.brazoI, 0, -1.45); a(obj.brazoI, 2, -0.38); a(obj.anteI, 0, -1.6); obj.pecho[1] += 0.25 * w; }
            else { a(obj.brazoD, 0, -1.4); a(obj.brazoD, 2, 0.5); a(obj.anteD, 0, -1.25); obj.muneca += (-1.0 - obj.muneca) * m; obj.pecho[1] -= 0.2 * w; }
            obj.rz -= 2.5 * w; obj.cabeza[0] += 0.18 * w; obj.piernaD[0] += 0.3 * w; obj.piernaI[0] += 0.25 * w; obj.pecho[0] -= 0.08 * w;
          }
          else if (rc.tipo === 'esquive') { obj.pecho[0] -= 0.42 * w; obj.pecho[2] += 0.5 * w * L; obj.cabeza[2] += 0.25 * w * L; obj.cabeza[0] -= 0.15 * w; obj.rx += 5 * w * L; obj.rz -= 4 * w; obj.piernaD[0] += 0.45 * w; obj.piernaI[0] += 0.45 * w; obj.musloI[0] -= 0.25 * w; obj.brazoD[2] -= 0.3 * w; obj.brazoI[2] += 0.3 * w; }
        }
      }
    }
    const kk = ya ? 1 : 1 - Math.exp(-dt * (M.caido ? 5 : M.carga || CLIPS[M.clip].dur ? 30 : 16));
    for (const a of ARTIC) for (let i = 0; i < 3; i++) cur[a][i] += (obj[a][i] - cur[a][i]) * kk;
    for (const e of ESCALARES) cur[e] += (obj[e] - cur[e]) * kk;
    // sacudón del golpe (resorte)
    const fl = M.flinch, h = Math.min(dt, 0.03);
    fl.vx += (-130 * fl.x - 13 * fl.vx) * h; fl.x += fl.vx * h; fl.vz += (-130 * fl.z - 13 * fl.vz) * h; fl.z += fl.vz * h;
    for (const a of ARTIC) { const p = N[a]; if (!p || !conectado(p)) continue; const r = cur[a]; p.grupo.rotation.set(r[0], r[1], r[2]); }
    if (conectado(N.pecho)) { N.pecho.grupo.rotation.x += fl.x; N.pecho.grupo.rotation.z += fl.z; }
    if (conectado(N.cabeza)) { N.cabeza.grupo.rotation.x += fl.x * 0.7; N.cabeza.grupo.rotation.z += fl.z * 0.7; }
    if (M.espada && M.espada.parent === N.anteD.grupo) M.espada.rotation.x = cur.muneca;
    // los paños de la falda siguen a los muslos
    if (conectado(N.faldaF)) N.faldaF.grupo.rotation.x = Math.min(cur.musloD[0], cur.musloI[0], 0) * 0.92 - 0.04;
    if (conectado(N.faldaT)) N.faldaT.grupo.rotation.x = Math.max(cur.musloD[0], cur.musloI[0], 0) * 0.9 + 0.04;
    if (M.caido) return;
    // tirado en la arena: el cuerpo entero se inclina hacia atrás hasta quedar acostado
    M.tilt = (M.tilt || 0) + ((modo === 'tirado' ? 1 : 0) - (M.tilt || 0)) * (ya ? 1 : 1 - Math.exp(-dt * 7));
    const raiz = M.raiz; raiz.rotation.x = -1.45 * M.tilt;
    // apoyar los pies (o la espalda): la raíz sube o baja hasta que lo más bajo toca la arena
    raiz.position.set(cur.rx * U * R.esc, 0, cur.rz * U * R.esc); raiz.updateMatrixWorld(true);
    const pInv = _mInv.copy(raiz.parent.matrixWorld).invert();
    let minY = 1e9; const toca = (p, loc) => { if (!p || !conectado(p)) return; _v.copy(loc); p.grupo.localToWorld(_v).applyMatrix4(pInv); if (_v.y < minY) minY = _v.y; };
    for (const L of ['D', 'I']) for (const s0 of N['pierna' + L].suelas) toca(N['pierna' + L], s0);
    if (modo === 'rendido') for (const L of ['D', 'I']) toca(N['pierna' + L], _o.set(0, 0, 0));
    if (M.tilt > 0.02) { toca(N.pelvis, _o.set(0, 0, 0)); toca(N.pecho, _o.set(0, 16 * U, 0)); toca(N.cabeza, _o.set(0, M.cabTop, 0)); }
    if (minY < 1e8) raiz.position.y = -minY + cur.salto * U * R.esc + M.tilt * 0.085 * M.alto;
  }

  /* ---------- daño ---------- */
  const _inv = new T.Matrix4(), _h = new T.Vector3(), _d = new T.Vector3(), _w = new T.Vector3(), _n = new T.Vector3(), _r = new T.Vector3(), _p = new T.Vector3();
  function danar(p, hMundo, dMundo, tipoG, I) {
    _inv.copy(p.grupo.matrixWorld).invert();
    _h.copy(hMundo).applyMatrix4(_inv).divideScalar(S); _h.x -= p.g0[0]; _h.y -= p.g0[1]; _h.z -= p.g0[2];
    _d.copy(dMundo).transformDirection(_inv);
    _w.set(0, 1, 0).cross(_d); if (_w.lengthSq() < 0.01) _w.set(1, 0, 0); _w.normalize().applyAxisAngle(_d, (Math.random() - 0.5) * 0.9);
    _n.copy(_d).cross(_w).normalize();
    const ER = M.raza.esc, Rr = ((tipoG === 'estocada' ? 16 * I + 2 : 11) * Q) / ER;
    const i0 = Math.max(0, Math.floor(_h.x - Rr)), i1 = Math.min(p.nx - 1, Math.ceil(_h.x + Rr));
    const j0 = Math.max(0, Math.floor(_h.y - Rr)), j1 = Math.min(p.ny - 1, Math.ceil(_h.y + Rr));
    const k0 = Math.max(0, Math.floor(_h.z - Rr)), k1 = Math.min(p.nz - 1, Math.ceil(_h.z + Rr));
    if (i0 > i1 || j0 > j1 || k0 > k1) return null;
    const res = { quitados: 0, tocado: false, arteria: null, vena: 0 }, sacados = []; pintados.length = 0; sucios.length = 0;
    // en el juego (pintar): solo se miran los cubitos que se ven (la piel), no toda la caja del golpe
    const soloPiel = PINTA(M), pl = p.nx * p.nz, nVis = soloPiel ? p.malla.count : 0;
    const total = soloPiel ? nVis : (j1 - j0 + 1) * (k1 - k0 + 1) * (i1 - i0 + 1);
    for (let it = 0; it < total; it++) {
      let i, j, k, q;
      if (soloPiel) { q = p.mapa[it]; i = q % p.nx; k = ((q / p.nx) | 0) % p.nz; j = (q / pl) | 0; if (i < i0 || i > i1 || j < j0 || j > j1 || k < k0 || k > k1) continue; }
      else { const w = i1 - i0 + 1, d = k1 - k0 + 1; i = i0 + (it % w); k = k0 + (((it / w) | 0) % d); j = j0 + ((it / (w * d)) | 0); q = idx(p, i, j, k); }
      if (!p.vivo[q]) continue;
      _r.set((i - _h.x) / Q, (j - _h.y) / Q, (k - _h.z) / Q).multiplyScalar(ER);   // en unidades de mundo (un arma mide lo mismo sobre un goblin que sobre un gigante)
      const prof = _r.dot(_d), dw = _r.dot(_w), dn = _r.dot(_n);
      let dm = 0, gr = 0, mo = 0;
      if (tipoG === 'tajo') { if (Math.abs(dn) < 1.0 && prof > -1.5 && Math.abs(dw) < 9.5) dm = I * 4.2 * Math.max(0, 1 - Math.max(0, prof) / (7.5 * I)) * (1 - Math.pow(Math.abs(dw) / 9.5, 3)); }
      else if (tipoG === 'estocada') { const rad = Math.hypot(dw, dn); if (rad < 1.4 && prof > -1 && prof < 15 * I) dm = I * 3.4 * (1 - prof / (16 * I)); else if (rad < 2.6 && prof > -1 && prof < 4) mo = 0.5 * I; }
      else if (tipoG === 'contundente') { const d = _r.length(); if (d < 4.6 && prof < 1.6) { dm = 0.7 * I * (1 - d / 4.6); mo = I * 1.2 * (1 - d / 4.6); } if (d < 8) gr = 2.3 * I * (1 - d / 8); }
      else if (tipoG === 'garras') { for (const off of [-2.6, 0, 2.6]) if (Math.abs(dn - off) < 0.6 && Math.abs(dw) < 6.5 && prof > -1 && prof < 3.8 * I) dm = Math.max(dm, I * 2.4 * (1 - Math.max(0, prof) / (3.8 * I))); }
      else if (tipoG === 'mordida') { const e = (dw / 4.2) ** 2 + (dn / 3.2) ** 2 + (Math.max(0, prof) / (4.2 * I)) ** 2; if (e <= 1 && prof > -1.5) dm = I * 3.2 * (1 - e * 0.5); }
      const t = p.tipo[q];
      if (M.motor && (t === V.hueso || t === V.medula || t === V.metal)) continue;
      if (gr && (t === V.hueso || t === V.medula)) { p.grieta[q] += gr; res.tocado = true; }
      if (mo) { p.moreton[q] += mo; res.tocado = true; if (soloPiel) sucios.push(q); }
      if (!dm) continue;
      if (PINTA(M)) { pintados.push(q, dm); continue; }   // sin carne: no se saca nada, se pinta de rojo donde pegó
      p.hp[q] -= dm * (0.85 + hash(i, j, k + 7) * 0.3);
      if (p.hp[q] <= 0) {
        p.vivo[q] = 0; res.quitados++; if (sacados.length < 600) sacados.push(q);
        if (t === V.arteria && !res.arteria) res.arteria = [i, j, k];
        if (t === V.vena) res.vena++;
        if (Math.random() < 0.05 && t !== V.tela) { posLocal(p, i, j, k, _p); p.grupo.localToWorld(_p); bit(_p, colorDe(t)); }
      }
    }
    if (pintados.length && !M.raza.sinSangre) { pintar(p, I); res.tocado = true; }
    if (sacados.length && !M.raza.sinSangre) empapar(p, sacados, I, res.arteria);
    if (res.arteria && p.chorros.length < 5) { p.chorros.push({ g: res.arteria, dir: _d.clone().negate(), vida: 26, fuerza: 1 }); p.arterias++; }
    p.venas += res.vena;
    if (soloPiel && sucios.length) res.sucios = sucios.slice();
    return res;
  }
  // pintada de sangre: cada golpe en el mismo lugar lo oscurece (rojo → rojo oscuro → casi negro), con unos hilos que chorrean
  const pintados = [], sucios = [];
  function pintar(p, I) {
    const pl = p.nx * p.nz; let maxDm = 0;
    for (let a = 0; a < pintados.length; a += 2) maxDm = Math.max(maxDm, pintados[a + 1]);
    for (let a = 0; a < pintados.length; a += 2) {
      const q = pintados[a], k = pintados[a + 1] / maxDm;   // más fuerte en el centro del golpe
      if (k < 0.15) continue;
      p.sangre[q] = Math.min(1.7, Math.max(p.sangre[q], 0.12) + 0.42 * k * Math.min(1.3, 0.55 + I * 0.5));
      sucios.push(q);
    }
    const n = Math.min(6, 1 + Math.round(I * 3));   // chorreaduras cortas
    for (let c = 0; c < n; c++) {
      const q = pintados[2 * ((Math.random() * (pintados.length / 2)) | 0)], i = q % p.nx, k = ((q / p.nx) | 0) % p.nz, j = (q / pl) | 0;
      const L = Math.round((2 + Math.random() * 6 * I) * Q);
      for (let d = 1; d <= L; d++) { const jj = j - d; if (jj < 0) break; const qq = idx(p, i, jj, k); if (p.vivo[qq]) { p.sangre[qq] = Math.max(p.sangre[qq], 0.7 - (d / L) * 0.4); sucios.push(qq); } }
    }
  }
  // la sangre de la herida moja todo lo que la rodea y chorrea para abajo
  function empapar(p, sacados, I, arteria) {
    const r = Math.round(2.2 * Q), pl = p.nx * p.nz;
    for (let s0 = 0; s0 < sacados.length; s0 += (sacados.length > 200 ? 3 : 1)) {
      const q = sacados[s0], i = q % p.nx, k = ((q / p.nx) | 0) % p.nz, j = (q / pl) | 0;
      for (let dj = -r; dj <= r; dj++) for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) {
        const ii = i + di, jj = j + dj, kk = k + dk; if (!dentro(p, ii, jj, kk)) continue;
        const qq = idx(p, ii, jj, kk); if (!p.vivo[qq]) continue;
        const v = 1.05 - Math.hypot(di, dj, dk) / (r + 1); if (v > p.sangre[qq]) p.sangre[qq] = v;
      }
    }
    // chorreaduras: hilos de sangre que bajan desde el borde de la herida
    const n = Math.min(40, Math.ceil(sacados.length / 6) + (arteria ? 10 : 2));
    for (let c = 0; c < n; c++) {
      const q = sacados[(Math.random() * sacados.length) | 0], i = q % p.nx, k = ((q / p.nx) | 0) % p.nz, j = (q / pl) | 0;
      const L = Math.round((3 + Math.random() * (arteria ? 16 : 9) * Math.min(1.4, I + 0.3)) * Q);
      let ii = i, kk = k;
      for (let d = 1; d <= L; d++) {
        const jj = j - d; if (jj < 0) break;
        if (Math.random() < 0.15) ii += Math.random() < 0.5 ? -1 : 1;   // el hilo serpentea un poco
        for (const [ai, ak] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = ii + ai, b2 = kk + ak; if (!dentro(p, a2, jj, b2)) continue; const qq = idx(p, a2, jj, b2); if (p.vivo[qq]) p.sangre[qq] = Math.max(p.sangre[qq], 0.95 - (d / L) * 0.4 - (ai || ak ? 0.25 : 0)); }
      }
    }
  }
  function revisarFractura(p) {
    if (!p.huesoFila || p.roto != null || p.suelto) return null;
    for (let j = 0; j < p.ny; j++) {
      const y = (j + p.g0[1]) / Q; if (y > -2.5 || y < -p.largo + 2.5 || !p.huesoFila[j]) continue;
      let malo = 0, quedan = 0, carne = 0;
      for (let k = 0; k < p.nz; k++) for (let i = 0; i < p.nx; i++) { const q = idx(p, i, j, k), t = p.orig[q]; if (p.vivo[q]) carne++; if (t !== V.hueso && t !== V.medula) continue; if (!p.vivo[q] || p.grieta[q] > 1.15) malo++; if (p.vivo[q]) quedan++; }
      if (malo / p.huesoFila[j] >= 0.6 && carne > quedan + 6) return j;   // hueso roto pero todavía hay carne: fractura
    }
    return null;
  }
  function dividir(p, quedan, nombre) {
    const n = p.nx * p.ny * p.nz;
    const nueva = { ...p, nombre, tipo: p.tipo.slice(), orig: p.orig.slice(), hp: p.hp.slice(), grieta: p.grieta.slice(), moreton: p.moreton.slice(), sangre: p.sangre.slice(), vivo: new Uint8Array(n), hijos: [], chorros: [], roto: null, padre: null, venas: 0, arterias: 0, ancla: null, huesoFila: null, suelto: false };
    let c = 0; for (let q = 0; q < n; q++) if (p.vivo[q] && !quedan[q]) { nueva.vivo[q] = 1; p.vivo[q] = 0; c++; }
    nueva.vivos0 = c; nueva.grupo = new T.Group(); nueva.grupo.name = nombre;
    armarMalla(nueva, material);
    return nueva;
  }
  function fracturar(p, j) {
    p.roto = j;
    const n = p.nx * p.ny * p.nz, quedan = new Uint8Array(n);
    for (let q = 0; q < n; q++) if (((q / (p.nx * p.nz)) | 0) > j) quedan[q] = 1;
    const abajo = dividir(p, quedan, p.nombre + '·abajo');
    abajo.roto = j; abajo.ancla = (i, jj) => jj === j || jj === j - 1;
    const piv = new T.Group(); piv.position.set(0, (j + p.g0[1]) * S, 0); p.grupo.add(piv);
    piv.rotation.set((Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4), 0, (Math.random() - 0.5) * 0.5);
    abajo.grupo.position.copy(piv.position).negate(); piv.add(abajo.grupo);
    for (const h of p.hijos.slice()) if (h.junta[1] <= j) { abajo.grupo.attach(h.obj); p.hijos.splice(p.hijos.indexOf(h), 1); abajo.hijos.push(h); if (h.parte) h.parte.padre = abajo; }
    abajo.padre = p; p.hijos.push({ parte: abajo, obj: piv, junta: [-p.g0[0], j, -p.g0[2]], fractura: true });
    M.partes.push(abajo);
    reconstruir(p, M); reconstruir(abajo, M);
  }
  const RJ = Math.round(2 * Q), CHICO = Math.round(30 * Q * Q * Q);
  function cerca(p, vivoArr, g, extra) { for (let dj = -RJ; dj <= RJ; dj++) for (let dk = -RJ; dk <= RJ; dk++) for (let di = -RJ; di <= RJ; di++) { const ii = Math.round(g[0]) + di, jj = Math.round(g[1]) + dj, kk = Math.round(g[2]) + dk; if (!dentro(p, ii, jj, kk)) continue; const r = idx(p, ii, jj, kk); if (vivoArr[r] && (!extra || extra[r])) return true; } return false; }
  // qué sigue unido: se recorre desde la articulación; lo que no se alcanza, se cae
  function revisarUnion(p) {
    if (p.suelto || !p.ancla) return 0;
    const n = p.nx * p.ny * p.nz, alc = new Uint8Array(n), cola = [], pl = p.nx * p.nz;
    for (let j = 0; j < p.ny; j++) for (let k = 0; k < p.nz; k++) for (let i = 0; i < p.nx; i++) { const q = idx(p, i, j, k); if (p.vivo[q] && p.ancla(i, j, k)) { alc[q] = 1; cola.push(q); } }
    while (cola.length) {
      const q = cola.pop(), i = q % p.nx, k = ((q / p.nx) | 0) % p.nz, j = (q / pl) | 0;
      for (const [a, b, c] of VECINOS) { const ii = i + a, jj = j + b, kk = k + c; if (!dentro(p, ii, jj, kk)) continue; const r = idx(p, ii, jj, kk); if (!alc[r] && p.vivo[r]) { alc[r] = 1; cola.push(r); } }
    }
    let sueltos = 0; for (let q = 0; q < n; q++) if (p.vivo[q] && !alc[q]) sueltos++;
    let cortes = 0;
    if (sueltos && sueltos < CHICO) {   // pedacitos: cubitos que vuelan
      for (let q = 0; q < n; q++) if (p.vivo[q] && !alc[q]) { p.vivo[q] = 0; if (Math.random() < 0.5) { posLocal(p, q % p.nx, (q / pl) | 0, ((q / p.nx) | 0) % p.nz, _p); p.grupo.localToWorld(_p); bit(_p, colorDe(p.tipo[q])); } }
    } else if (sueltos) {               // un trozo grande: cae entero, con lo que cuelgue de él
      const trozo = dividir(p, alc, p.nombre + '·trozo');
      p.grupo.updateMatrixWorld(true); p.grupo.matrixWorld.decompose(trozo.grupo.position, trozo.grupo.quaternion, trozo.grupo.scale);
      escena.add(trozo.grupo); trozo.suelto = true; trozo.grupo.updateMatrixWorld(true);
      for (const h of p.hijos.slice()) if (!h.fractura && cerca(p, trozo.vivo, h.junta) && !cerca(p, p.vivo, h.junta)) { trozo.grupo.attach(h.obj); p.hijos.splice(p.hijos.indexOf(h), 1); trozo.hijos.push(h); if (h.parte) h.parte.padre = trozo; }
      for (const h of p.hijos.slice()) if (h.fractura && !cerca(p, p.vivo, h.junta)) { trozo.grupo.attach(h.obj); p.hijos.splice(p.hijos.indexOf(h), 1); trozo.hijos.push(h); h.parte.padre = trozo; }
      M.partes.push(trozo); reconstruir(trozo, M); cuerpoFisico(trozo.grupo, trozo); cortes++;
      // el muñón chorrea de los dos lados
      let cx = 0, cy = 0, cz = 0, cn = 0;
      for (let q = 0; q < n; q++) if (trozo.vivo[q]) { const i = q % p.nx, k = ((q / p.nx) | 0) % p.nz, j = (q / pl) | 0; for (const [a, b, c] of VECINOS) { if (!dentro(p, i + a, j + b, k + c)) continue; const r = idx(p, i + a, j + b, k + c); if (p.orig[r] && !p.vivo[r] && !trozo.vivo[r]) { cx += i; cy += j; cz += k; cn++; break; } } }
      if (cn) { const gq = [cx / cn, cy / cn, cz / cn], d = new T.Vector3(0, p.largo ? -1 : 1, 0); p.chorros.push({ g: gq, dir: d.clone().add(new T.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)), vida: 30, fuerza: 1.6, munon: true }); trozo.chorros.push({ g: gq, dir: d.clone().negate(), vida: 6, fuerza: 1, munon: true }); }
    }
    // hijos cuya articulación ya no existe: se caen solos
    for (const h of p.hijos.slice()) {
      if (h.fractura || cerca(p, p.vivo, h.junta)) continue;
      p.hijos.splice(p.hijos.indexOf(h), 1);
      if (h.cara) { h.obj.visible = false; M.caraBorrada = true; continue; }
      if (h.parte) { h.parte.suelto = true; }
      escena.attach(h.obj); cuerpoFisico(h.obj, h.parte, h.caja); if (h.parte) cortes++;
    }
    return cortes;
  }
  function esquinas(p, caja) {
    if (caja) { const a = caja.min, b = caja.max; return [[a.x, a.y, a.z], [b.x, a.y, a.z], [a.x, b.y, a.z], [b.x, b.y, a.z], [a.x, a.y, b.z], [b.x, a.y, b.z], [a.x, b.y, b.z], [b.x, b.y, b.z]].map((v) => new T.Vector3(...v)); }
    let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9, k0 = 1e9, k1 = -1e9; const pl = p.nx * p.nz;
    for (let q = 0; q < p.vivo.length; q++) if (p.vivo[q]) { const i = q % p.nx, k = ((q / p.nx) | 0) % p.nz, j = (q / pl) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; if (k < k0) k0 = k; if (k > k1) k1 = k; }
    const out = []; if (i0 > i1) return out; for (const i of [i0, i1]) for (const j of [j0, j1]) for (const k of [k0, k1]) out.push(posLocal(p, i, j, k, new T.Vector3()));
    return out;
  }
  // física simple: cae, rebota en la arena y se queda
  function cuerpoFisico(obj2, parte, caja) {
    const pts = [], junta = (o, p2, c) => { for (const v of esquinas(p2, c)) pts.push({ o, v }); };
    if (parte) { junta(parte.grupo, parte); const rec = (pp) => { for (const h of pp.hijos) { if (h.parte) { junta(h.parte.grupo, h.parte); rec(h.parte); } else if (h.caja) junta(h.obj, null, h.caja); } }; rec(parte); }
    else junta(obj2, null, caja);
    const c = { obj: obj2, v: new T.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6), w: new T.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9), pts, quieto: 0 };
    M.cuerpos.push(c); return c;
  }
  // golpe completo
  function golpe(punto, dir, tipoG, I) { const t0 = root.__vxProf ? performance.now() : 0; const r = golpe0(punto, dir, tipoG, I); if (t0) { root.__vxProf.ms += performance.now() - t0; root.__vxProf.n++; root.__vxProf.max = Math.max(root.__vxProf.max, performance.now() - t0); } return r; }
  function golpe0(punto, dir, tipoG, I) {
    M.raiz.updateMatrixWorld(true); for (const c of M.cuerpos) c.obj.updateMatrixWorld(true);
    const out = { arteria: false, vena: false, fractura: 0, corte: 0, decap: false, muere: false, cae: false };
    const tocadas = [];
    for (const p of M.partes.slice()) {
      if (!p.malla.parent) continue;
      const r = danar(p, punto, dir, tipoG, I); if (!r) continue;
      if (r.sucios) { recolorear(p, M, r.sucios); continue; }   // solo cambió el color: no se rearma nada
      if (r.quitados || r.tocado) tocadas.push(p);
      if (r.arteria) out.arteria = true; if (r.vena) out.vena = true;
    }
    for (const p of tocadas) {
      if (!M.motor) { const j = revisarFractura(p); if (j != null) { fracturar(p, j); out.fractura++; } out.corte += revisarUnion(p); }
      reconstruir(p, M);
    }
    if (!M.raza.sinSangre) {
      salpicar(punto, _v.copy(dir).negate(), tipoG === 'contundente' ? 3 : 8 + Math.round(I * 6), 0.8 + I * 0.4);
      if (tipoG !== 'contundente' || I > 0.9) mancha(punto.x + dir.x * 0.3, punto.z + dir.z * 0.3, 0.05 + Math.random() * 0.06);
    } else for (let i = 0; i < 4; i++) bit(punto, _c.setHex(COL[V.hueso]));
    M.flinch.vx += dir.z * I * 3.2; M.flinch.vz += -dir.x * I * 3.2; expresion('dolor'); M.ultDir = dir.clone();
    if (M.rag) empujarRag(punto, dir, I);
    if (!M.muerto && !M.motor) {
      const N = M.N, cab = N.cabeza;
      const cerebroRoto = cab.cerebro && cab.cerebro.length - Math.round(vivosDe(cab, cab.cerebro) * cab.cerebro.length) >= 2;
      const sinCabeza = !conectado(cab), cabezaRota = !sinCabeza && (cerebroRoto || vivosDe(cab, cab.craneo) < 0.55);
      const sinPierna = ['D', 'I'].some((L) => { const p = N['pierna' + L]; return !conectado(p) || vivosDe(p, p.pie) < 0.3; });
      if (sinCabeza || cabezaRota) { out.decap = sinCabeza; out.cerebro = !sinCabeza; out.muere = true; caer(true); }
      else if (sinPierna && !M.caido) { out.cae = true; caer(false); }
    }
    return out;
  }
  /* ---------- RAGDOLL: al morir (o perder una pierna) el cuerpo se desploma con física ----------
     Cada articulación es un punto con inercia; unos "palitos" de largo fijo los mantienen unidos
     (Verlet). Después cada parte del cuerpo se acomoda entre sus dos puntos. */
  const _a = new T.Vector3(), _b = new T.Vector3(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3(), _mb = new T.Matrix4(), _qa = new T.Quaternion();
  function caer(muere) {
    if (muere) { M.muerto = true; expresion('muerto', 1e9); }
    if (M.rag) return;
    M.caido = true;
    const N = M.N, R = M.raza, k = M.alto / 1.8;
    M.raiz.updateMatrixWorld(true);
    const pts = {}, pt = (id, parte, local, r) => { if (!parte || !conectado(parte)) return; const v = parte.grupo.localToWorld(local.clone()); pts[id] = { p: v, o: v.clone(), r: r * k }; };
    const O = new T.Vector3();
    pt('pel', N.pelvis, O, 0.07); pt('pch', N.pecho, O, 0.08); pt('nk', N.cabeza, O, 0.045); pt('hd', N.cabeza, new T.Vector3(0, M.cabTop, 0.2 * U), 0.06);
    for (const L of ['D', 'I']) {
      pt('sh' + L, N.pecho, N['brazo' + L].grupo.position, 0.05); pt('el' + L, N['ante' + L], O, 0.03); pt('ha' + L, N['ante' + L], new T.Vector3(...N['ante' + L].mano.map((v) => v * U)), 0.03);
      pt('hi' + L, N.pelvis, N['muslo' + L].grupo.position, 0.055); pt('kn' + L, N['pierna' + L], O, 0.035); pt('an' + L, N['pierna' + L], new T.Vector3(0, N['pierna' + L].suelas[0].y, 0), 0.03);
    }
    // empujón inicial: hacia donde vino el último golpe, más fuerte arriba (se va de espaldas o de costado)
    const em = (M.ultDir || new T.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)).clone().setY(0).normalize();
    for (const [id, q] of Object.entries(pts)) { const alto = q.p.y / M.alto; q.o.addScaledVector(em, -(0.004 + alto * 0.02)); }
    // palitos: largo fijo (eq) o con rango (para que la columna y el cuello se doblen un poco, pero no de más)
    const cons = [], c = (a2, b2, min = 1, max = 1) => { if (!pts[a2] || !pts[b2]) return; const L = pts[a2].p.distanceTo(pts[b2].p); cons.push([pts[a2], pts[b2], L * min, L * max]); };
    const rigido = (ids) => { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) c(ids[i], ids[j]); };
    rigido(['pel', 'pch', 'hiD', 'hiI']); rigido(['pch', 'nk', 'shD', 'shI']);
    c('pel', 'nk', 0.82, 1.02); c('pel', 'shD', 0.85, 1.05); c('pel', 'shI', 0.85, 1.05); c('hiD', 'shD', 0.85, 1.06); c('hiI', 'shI', 0.85, 1.06); c('hiD', 'shI', 0.85, 1.06); c('hiI', 'shD', 0.85, 1.06);
    c('nk', 'hd'); c('pch', 'hd', 0.88, 1.03); c('shD', 'hd', 0.8, 1.15); c('shI', 'hd', 0.8, 1.15);
    for (const L of ['D', 'I']) {
      c('sh' + L, 'el' + L); c('el' + L, 'ha' + L); c('sh' + L, 'ha' + L, 0.35, 1);   // el codo no se cierra del todo
      c('hi' + L, 'kn' + L); c('kn' + L, 'an' + L); c('hi' + L, 'an' + L, 0.3, 1);   // la rodilla se dobla (casi del todo)
      c('pel', 'kn' + L, 0.6, 1.2);
    }
    // cada parte sabe entre qué puntos va y cómo estaba orientada al morir
    const mano = [];
    const tronco = (nombre, origen, ar, ab, uA, uB) => { const p = N[nombre]; if (!p || !conectado(p) || !pts[origen] || !pts[ar] || !pts[ab] || !pts[uA] || !pts[uB]) return; const q0 = p.grupo.getWorldQuaternion(new T.Quaternion()); const B = base(pts[ar].p, pts[ab].p, pts[uA].p, pts[uB].p); mano.push({ p, origen, ar, ab, uA, uB, off: B.invert().multiply(q0) }); };
    const palo = (nombre, a2, b2) => { const p = N[nombre]; if (!p || !conectado(p) || !pts[a2] || !pts[b2]) return; mano.push({ p, origen: a2, a: a2, b: b2, q0: p.grupo.getWorldQuaternion(new T.Quaternion()), d0: pts[b2].p.clone().sub(pts[a2].p).normalize() }); };
    tronco('pelvis', 'pel', 'hiI', 'hiD', 'pel', 'pch'); tronco('pecho', 'pch', 'shI', 'shD', 'pch', 'nk'); tronco('cabeza', 'nk', 'shI', 'shD', 'nk', 'hd');
    for (const L of ['D', 'I']) { palo('brazo' + L, 'sh' + L, 'el' + L); palo('ante' + L, 'el' + L, 'ha' + L); palo('muslo' + L, 'hi' + L, 'kn' + L); palo('pierna' + L, 'kn' + L, 'an' + L); }
    for (const m of mano) escena.attach(m.p.grupo);   // desde ahora cada parte se mueve sola en el mundo
    M.rag = { pts, cons, mano, quieto: 0, t: 0, em: em.clone() };
    // suelta la espada y los paños de la falda quedan colgando
    const aD = N.anteD, h = aD.hijos.find((x) => x.obj === M.espada);
    if (h) { aD.hijos.splice(aD.hijos.indexOf(h), 1); escena.attach(M.espada); const cc = cuerpoFisico(M.espada, null, h.caja); cc.v.multiplyScalar(0.6); }
    if (N.faldaF) N.faldaF.grupo.rotation.set(0.15, 0, 0); if (N.faldaT) N.faldaT.grupo.rotation.set(-0.15, 0, 0);
  }
  function base(a2, b2, u1, u2) {
    _x.copy(a2).sub(b2).normalize(); _y.copy(u2).sub(u1); _y.addScaledVector(_x, -_y.dot(_x)).normalize(); _z.crossVectors(_x, _y);
    return new T.Quaternion().setFromRotationMatrix(_mb.makeBasis(_x, _y, _z));
  }
  function pasoRag(dt) {
    const G = M.rag; if (G.quieto > 2) return;
    const h = Math.min(dt, 1 / 30) / 2;
    for (let sub = 0; sub < 2; sub++) {
      let mov = 0;
      G.t += h;
      // un muerto no aguanta su peso: mientras la cadera siga alta, las rodillas se doblan y el cuerpo se va hacia adelante del golpe
      const pel = G.pts.pel || G.pts.pch;
      if (pel && G.t < 4 && pel.p.y > 0.22 * M.alto) {
        const k = h * h * 9.8 * (G.t < 0.3 ? 0.6 : 1.4);
        for (const id of ['pch', 'nk', 'hd', 'shD', 'shI']) if (G.pts[id]) { G.pts[id].p.addScaledVector(G.em, k); G.pts[id].p.y -= k * 0.3; }
        for (const L of ['D', 'I']) if (G.pts['kn' + L]) G.pts['kn' + L].p.addScaledVector(G.em, -k * 0.8);
        for (const L of ['D', 'I']) if (G.pts['an' + L]) { const a = G.pts['an' + L]; a.o.x = a.p.x - (a.p.x - a.o.x) * 0.2; a.o.z = a.p.z - (a.p.z - a.o.z) * 0.2; }   // los pies quedan clavados
        G.quieto = 0;
      }
      for (const q of Object.values(G.pts)) {
        _a.copy(q.p).sub(q.o).multiplyScalar(0.992); q.o.copy(q.p); q.p.add(_a); q.p.y -= 9.8 * h * h;
        if (q.p.y < q.r) { q.p.y = q.r; const vx = q.p.x - q.o.x, vz = q.p.z - q.o.z; q.o.x = q.p.x - vx * 0.55; q.o.z = q.p.z - vz * 0.55; }   // la arena frena
        mov += _a.lengthSq();
      }
      for (let it = 0; it < 10; it++) for (const [A2, B2, mn, mx] of G.cons) {
        _a.copy(B2.p).sub(A2.p); const d = _a.length() || 1e-6, L = d < mn ? mn : d > mx ? mx : d; if (L === d) continue;
        _a.multiplyScalar((d - L) / d * 0.5); A2.p.add(_a); B2.p.sub(_a);
      }
      for (const q of Object.values(G.pts)) if (q.p.y < q.r) q.p.y = q.r;
      if (!(pel && G.t < 4 && pel.p.y > 0.22 * M.alto)) G.quieto = mov < 1e-9 ? G.quieto + h : 0;
    }
    // acomodar las partes entre sus puntos
    for (const m of G.mano) {
      if (!conectado(m.p) || m.p.grupo.parent !== escena) continue;
      const P2 = G.pts;
      if (m.off) { const B = base(P2[m.ar].p, P2[m.ab].p, P2[m.uA].p, P2[m.uB].p); m.p.grupo.quaternion.copy(B.multiply(m.off)); }
      else { _b.copy(P2[m.b].p).sub(P2[m.a].p).normalize(); _qa.setFromUnitVectors(m.d0, _b); m.p.grupo.quaternion.copy(_qa).multiply(m.q0); }
      m.p.grupo.position.copy(P2[m.origen].p);
    }
  }
  // un golpe al cuerpo tirado lo sacude
  function empujarRag(punto, dir, I) {
    let mejor = null, dm = 1e9; for (const q of Object.values(M.rag.pts)) { const d = q.p.distanceTo(punto); if (d < dm) { dm = d; mejor = q; } }
    if (mejor) { mejor.o.addScaledVector(dir, -0.035 * I); M.rag.quieto = 0; }
  }

  /* ---------- entrada ---------- */
  const ray = new T.Raycaster(), _ndc = new T.Vector2();
  const mallas = () => M.partes.filter((p) => p.malla.parent && p.malla.count).map((p) => p.malla);
  function golpearPantalla(x, y, tipoG, I) {
    const r = M.renderer.domElement.getBoundingClientRect();
    _ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(_ndc, M.camara);
    const hit = ray.intersectObjects(mallas(), false)[0];
    if (!hit) return null;
    const donde = hit.object.userData.parte.nombre, res = golpe(hit.point.clone(), ray.ray.direction.clone(), tipoG, I);
    res.donde = donde; return res;
  }
  // atacante: raza de quien pega. Un goblin no llega a la cabeza de un gigante pero le vive cortando las piernas.
  const ALCANCE = 1.15, ARMA = 0.55;   // brazo estirado hacia arriba ≈ 1,15 × altura, más la espada
  function golpeAtacante(tipoG, I, atacante) {
    const h = razaDe(atacante).altura, tope = h * ALCANCE + ARMA, hombro = h * 0.78;
    const vivos = M.partes.filter((p) => !p.suelto && conectado(p) && p.malla.count && !p.nombre.startsWith('falda'));
    if (!vivos.length) return null;
    M.raiz.updateMatrixWorld(true);
    // apunta a la altura que le queda cómoda: la de su pecho, o más abajo si el otro es más chico
    const centro = Math.min(h * 0.68, M.alto * 0.62);
    let y = centro + (Math.random() + Math.random() + Math.random() - 1.5) * h * 0.36;
    if (y > tope) return { fuera: true, altura: y, tope };
    y = Math.max(0.05, y);
    const cand = []; let mejor = null, dm = 1e9;
    for (let t = 0; t < 600 && cand.length < 24; t++) {
      const p = vivos[(Math.random() * vivos.length) | 0], q = p.mapa[(Math.random() * p.malla.count) | 0];
      const pt = posLocal(p, q % p.nx, (q / (p.nx * p.nz)) | 0, ((q / p.nx) | 0) % p.nz, new T.Vector3()); p.grupo.localToWorld(pt);
      if (pt.y > tope) continue;
      const d = Math.abs(pt.y - y); if (d < 0.09) cand.push(pt); if (d < dm) { dm = d; mejor = pt; }
    }
    if (!cand.length && mejor) cand.push(mejor);
    if (!cand.length) return { fuera: true, altura: y, tope };
    const pt = cand[(Math.random() * cand.length) | 0];
    const a = -0.6 + Math.random() * 1.2 + (Math.random() < 0.5 ? 0 : Math.PI);   // de adelante o de atrás, más o menos
    const desde = new T.Vector3(pt.x + Math.sin(a) * 1.4, clamp(hombro, pt.y - 0.5, pt.y + 0.5), pt.z + Math.cos(a) * 1.4);
    const dir = pt.clone().sub(desde).normalize();
    ray.set(desde, dir);
    const hit = ray.intersectObjects(mallas(), false)[0];
    if (!hit || hit.point.y > tope + 0.05) return { fuera: true, altura: y, tope };
    const donde = hit.object.userData.parte.nombre, res = golpe(hit.point.clone(), dir, tipoG, I); res.donde = donde; res.altura = hit.point.y; return res;
  }
  function golpeAzar(tipoG, I, atacante) {
    if (atacante) return golpeAtacante(tipoG, I, atacante);
    const vivos = M.partes.filter((p) => !p.suelto && conectado(p) && p.malla.count && !p.nombre.startsWith('falda'));
    if (!vivos.length) return null;
    const pesos = vivos.map((p) => (p.nombre === 'pecho' ? 3 : p.nombre === 'cabeza' ? 0.7 : 1.2));
    let t = Math.random() * pesos.reduce((a, b) => a + b, 0), p = vivos[0];
    for (let i = 0; i < vivos.length; i++) if ((t -= pesos[i]) <= 0) { p = vivos[i]; break; }
    const q = p.mapa[(Math.random() * p.malla.count) | 0];
    p.grupo.updateMatrixWorld(true);
    const pt = posLocal(p, q % p.nx, (q / (p.nx * p.nz)) | 0, ((q / p.nx) | 0) % p.nz, new T.Vector3()); p.grupo.localToWorld(pt);
    const a = Math.random() * Math.PI * 2, desde = new T.Vector3(pt.x + Math.cos(a) * 1.4, pt.y + (Math.random() - 0.3) * 0.5, pt.z + Math.sin(a) * 1.4);
    const dir = pt.clone().sub(desde).normalize();
    ray.set(desde, dir);
    const hit = ray.intersectObjects(mallas(), false)[0];
    if (!hit) return null;
    const donde = hit.object.userData.parte.nombre, res = golpe(hit.point.clone(), dir, tipoG, I); res.donde = donde; return res;
  }

  /* ---------- cada cuadro ---------- */
  const _q = new T.Quaternion(), _ax = new T.Vector3();
  function paso(dt) {
    M.t += dt;
    if (M.unir) revisarUnida();
    if (M.rag) pasoRag(dt); else if (M.raiz) aplicarPose(dt);
    if (M.exprT > 0 && M.exprT < 1e8) { M.exprT -= dt; if (M.exprT <= 0 && !M.muerto) expresion('normal', 0); }
    if (!M.muerto && M.expr === 'normal') { M.parp -= dt; if (M.parp <= 0) { M.parp = 2 + Math.random() * 3; expresion('parpadeo', 0.12); } }
    for (const c of M.cuerpos) {
      if (c.quieto > 1.5) continue;
      c.v.y -= 9.8 * dt; c.obj.position.addScaledVector(c.v, dt);
      const w = c.w.length(); if (w > 1e-4) { _ax.copy(c.w).divideScalar(w); _q.setFromAxisAngle(_ax, w * dt); c.obj.quaternion.premultiply(_q); }
      c.obj.updateMatrixWorld(true);
      let minY = 1e9; for (const p of c.pts) { _v.copy(p.v); p.o.localToWorld(_v); if (_v.y < minY) minY = _v.y; }
      if (minY < 0) { c.obj.position.y -= minY; if (c.v.y < 0) c.v.y *= -0.22; c.v.x *= 0.55; c.v.z *= 0.55; c.w.multiplyScalar(c.raiz ? 0.55 : 0.6); }
      if (c.v.lengthSq() < 0.01 && c.w.lengthSq() < 0.04 && minY < 0.01) c.quieto += dt; else c.quieto = 0;
    }
    for (const p of M.partes) {
      if (!p.malla.parent || !p.chorros.length || M.raza.sinSangre) continue;
      p.grupo.updateMatrixWorld(true);
      for (const ch of p.chorros) {
        if (ch.vida <= 0) continue; ch.vida -= dt;
        const late = ch.munon ? 0.6 + 0.4 * Math.sin(M.t * 9) : Math.max(0, Math.sin(M.t * 7.5));
        if (Math.random() > Math.min(0.98, (ch.munon ? 0.9 : 0.75) * late * Math.min(1, ch.vida / 6) * M.raza.presion)) continue;
        posLocal(p, ch.g[0], ch.g[1], ch.g[2], _p); p.grupo.localToWorld(_p);
        _d.copy(ch.dir).transformDirection(p.grupo.matrixWorld);
        const vel = (ch.munon ? 1.4 : 1.9) * ch.fuerza * (0.5 + late * 0.6) * Math.sqrt(M.raza.presion);
        gota(_p, _v.set(_d.x * vel + (Math.random() - 0.5) * 0.3, _d.y * vel + 0.5 * late + (Math.random() - 0.3) * 0.3, _d.z * vel + (Math.random() - 0.5) * 0.3), ch.munon ? 1.4 : 1);
      }
    }
  }
  function rayos(n) { M.rayosN = n; for (const p of M.partes) if (p.malla.parent) reconstruir(p, M); if (M.cara) M.cara.visible = n === 0 && !M.caraBorrada; if (M.espada) M.espada.visible = true; }
  function estado() {
    const out = [];
    for (const nombre of ['cabeza', 'pecho', 'pelvis', 'brazoD', 'anteD', 'brazoI', 'anteI', 'musloD', 'piernaD', 'musloI', 'piernaI']) {
      const p = M.N[nombre]; if (!p) continue;
      let mus = 0, mus0 = 0, piel = 0, piel0 = 0, vivos = 0;
      const fam = M.partes.filter((x) => x === p || x.nombre === nombre + '·abajo');
      for (let q = 0; q < p.orig.length; q++) { const t = p.orig[q]; if (!t) continue; const v = fam.some((x) => x.vivo[q]); if (v) vivos++; if (t === V.musculo) { mus0++; if (!v) mus++; } if (t === V.piel) { piel0++; if (!v) piel++; } }
      const cortado = !conectado(p) || vivos / p.vivos0 < 0.5 || M.partes.some((x) => x.nombre === nombre + '·trozo' && x.vivos0 > p.vivos0 * 0.2);
      out.push({ nombre: NOMBRE[nombre], musculo: mus0 ? mus / mus0 : 0, piel: piel0 ? piel / piel0 : 0, arterias: M.partes.filter((x) => x.nombre.split('·')[0] === nombre).reduce((a, x) => a + x.arterias, 0), venas: p.venas, fractura: p.roto != null, cortado });
    }
    return out;
  }
  /* ---------- lo que pide el juego ---------- */
  const ZONAS = { cabeza: ['cabeza'], torso: ['pecho', 'pecho', 'pelvis'], bA: ['brazoD', 'anteD'], bE: ['brazoI', 'anteI'], pA: ['musloD', 'piernaD'], pB: ['musloI', 'piernaI'] };
  // un golpe a una zona, entrando por el lado de donde vino (dir: dirección del golpe en el mundo)
  function golpeZona(zona, tipoG, I, dir) {
    const ops = (ZONAS[zona] || ZONAS.torso).map((n) => M.N[n]).filter((p) => p && conectado(p) && p.malla.count);
    if (!ops.length) return null;
    const p = ops[(Math.random() * ops.length) | 0];
    M.raiz.updateMatrixWorld(true);
    let mejor = null, sc = 1e9;
    for (let t = 0; t < 10; t++) {
      const q = p.mapa[(Math.random() * p.malla.count) | 0];
      const pt = posLocal(p, q % p.nx, (q / (p.nx * p.nz)) | 0, ((q / p.nx) | 0) % p.nz, new T.Vector3()); p.grupo.localToWorld(pt);
      const v = pt.dot(dir); if (v < sc) { sc = v; mejor = pt; }   // el más expuesto hacia el atacante
    }
    return golpe(mejor, dir.clone().normalize(), tipoG, I);
  }
  const PARTES_M = { bA: ['brazoD', 'anteD'], bE: ['brazoI', 'anteI'], pA: ['musloD', 'piernaD'], pB: ['musloI', 'piernaI'] };
  // corte decidido por el motor: una franja de la parte desaparece y lo de abajo se cae
  function cortarFranja(p, yU, ancho = 1.6) {
    const j0 = Math.round(yU * Q - p.g0[1]), dj = Math.max(1, Math.round(ancho * Q / 2));
    for (let j = j0 - dj; j <= j0 + dj; j++) if (j >= 0 && j < p.ny) for (let k = 0; k < p.nz; k++) for (let i = 0; i < p.nx; i++) p.vivo[idx(p, i, j, k)] = 0;
    const mot = M.motor; M.motor = false; const c = revisarUnion(p); M.motor = mot;
    reconstruir(p, M);
    p.grupo.updateMatrixWorld(true);
    const pt = new T.Vector3(0, yU * U, 0); p.grupo.localToWorld(pt);
    if (!M.raza.sinSangre) { salpicar(pt, _v.set(0, 1, 0), 26, 1.5); mancha(pt.x, pt.z, 0.12); }
    return c;
  }
  function romperCraneo(dir) {
    const cb = M.N.cabeza; if (!cb || !conectado(cb) || M.decap) return;
    M.raiz.updateMatrixWorld(true);
    // el punto del cráneo más expuesto hacia el golpe
    let mejor = null, sc = 1e9; const pt = new T.Vector3(), pl = cb.nx * cb.nz;
    for (let t = 0; t < 40; t++) {
      const q = cb.craneo[(Math.random() * cb.craneo.length) | 0]; if (cb.tipo[q] !== V.hueso) continue;
      posLocal(cb, q % cb.nx, (q / pl) | 0, ((q / cb.nx) | 0) % cb.nz, pt); cb.grupo.localToWorld(pt);
      const v = pt.dot(dir); if (v < sc) { sc = v; mejor = q; }
    }
    if (mejor == null) return;
    const i0 = mejor % cb.nx, k0 = ((mejor / cb.nx) | 0) % cb.nz, j0 = (mejor / pl) | 0, R1 = 3.2 * Q, R2 = 5.5 * Q, sacados = [];
    for (let j = j0 - R2; j <= j0 + R2; j++) for (let k = k0 - R2; k <= k0 + R2; k++) for (let i = i0 - R2; i <= i0 + R2; i++) {
      const ii = Math.round(i), jj = Math.round(j), kk = Math.round(k); if (!dentro(cb, ii, jj, kk)) continue;
      const q = idx(cb, ii, jj, kk); if (!cb.vivo[q]) continue;
      const d = Math.hypot(ii - i0, jj - j0, kk - k0);
      if (d < R1 * (0.75 + hash(ii, jj, kk) * 0.5) && !(cb.tipo[q] === V.cerebro && d > R1 * 0.6)) { cb.vivo[q] = 0; sacados.push(q); }   // el hueso se hunde y se abre
      else if (d < R2) { cb.grieta[q] += 2 * (1 - d / R2); cb.moreton[q] += 0.8 * (1 - d / R2); }
    }
    if (!M.raza.sinSangre) empapar(cb, sacados, 1.4, true);
    reconstruir(cb, M);
    posLocal(cb, i0, j0, k0, pt); cb.grupo.localToWorld(pt);
    for (let n = 0; n < 14; n++) bit(pt, _c.setHex(n % 3 ? COL[V.cerebro] : COL[V.hueso]));
    if (!M.raza.sinSangre) salpicar(pt, _v.copy(dir).negate(), 22, 1.4);
    expresion('muerto', 1e9);
  }
  function cortarMiembro(m) {
    if (M.cortados[m]) return; M.cortados[m] = true;
    const [a, b] = PARTES_M[m] || []; const pa = M.N[a], pb = M.N[b];
    const p = (Math.random() < 0.6 && pb && conectado(pb)) ? pb : pa; if (!p || !conectado(p)) return;
    cortarFranja(p, -p.largo * (0.3 + Math.random() * 0.4));
    M.flinch.vx += 3;
  }
  function fracturarMiembro(m) {
    if (M.fracturados && M.fracturados[m]) return; M.fracturados = { ...(M.fracturados || {}), [m]: true };
    const [a, b] = PARTES_M[m] || []; const p = M.N[Math.random() < 0.65 ? b : a];
    if (!p || !conectado(p) || p.roto != null) return;
    const j = Math.round(-p.largo * (0.4 + Math.random() * 0.2) * Q - p.g0[1]);
    for (let k = 0; k < p.nz; k++) for (let i = 0; i < p.nx; i++) for (let dj = -1; dj <= 1; dj++) { const q = idx(p, i, j + dj, k); if (p.vivo[q]) p.moreton[q] += 0.8; }
    fracturar(p, j);
  }
  function decapitar() {
    if (M.decap) return; M.decap = true;
    const cb = M.N.cabeza; if (!cb || !conectado(cb)) return;
    cortarFranja(cb, M.raza.cuello[2] * 0.45, 1.2);
    expresion('muerto', 1e9);
  }
  // estado de los miembros que manda el motor (sirve también para el que entra tarde a la partida)
  function sincronizar(miembros, decap) {
    if (miembros) for (const m of ['bA', 'bE', 'pA', 'pB']) { if (miembros[m] === 'cortado') cortarMiembro(m); else if (miembros[m] === 'fractura') fracturarMiembro(m); }
    if (decap) decapitar();
  }
  // prótesis: la pata de palo o el garfio reemplazan la parte de abajo
  function protesis(m, tipo) {
    const p = M.N[m[0] === 'b' ? (m === 'bA' ? 'anteD' : 'anteI') : (m === 'pA' ? 'piernaD' : 'piernaI')]; if (!p) return;
    p.vivo.fill(0); p.protesis = true; for (const h of p.hijos.slice()) { if (h.obj.parent) h.obj.parent.remove(h.obj); } p.hijos = [];
    reconstruir(p, M);
    const mat = new T.MeshLambertMaterial({ color: M.srgb ? new T.Color(0x7a5430).convertSRGBToLinear() : new T.Color(0x7a5430) });
    const L = p.largo + (m[0] === 'p' ? 2.4 : 2);
    const palo = new T.Mesh(new T.CylinderGeometry(U * 1.3, U * (m[0] === 'p' ? 1.0 : 1.2), U * L, 8), mat); palo.position.y = -U * L / 2; p.grupo.add(palo);
    const tope = new T.Mesh(new T.CylinderGeometry(U * 2.6, U * 2.2, U * 3, 10), mat); tope.position.y = -U * 1.5; p.grupo.add(tope);
    if (m[0] === 'b') { const metal = new T.MeshLambertMaterial({ color: 0x9aa0a8 }); const g = new T.Mesh(new T.TorusGeometry(U * 2.2, U * 0.5, 5, 10, Math.PI * 1.3), metal); g.position.set(0, -U * (L + 2), U * 1.6); g.rotation.y = Math.PI / 2; p.grupo.add(g); }
  }

  /* ---------- UN GLADIADOR = UNA SOLA MALLA ----------
     Antes cada parte del cuerpo (brazos, piernas, torso, arma, escudo, cara…) era un dibujo aparte: unos 20 por gladiador.
     Ahora se juntan en una sola malla y cada parte "dobla" su pedazo por dentro, como un muñeco con esqueleto:
     las partes originales siguen moviéndose (son los huesos) pero no se dibujan. Un dibujo por gladiador. */
  const CAP_OCULTA = 2;   // capa que la cámara no dibuja
  const EXPRS = ['normal', 'dolor', 'muerto', 'furia', 'parpadeo'];
  // ¿esta pieza está colgada de la escena y a la vista? (lo de afuera del gladiador —su grupo en la arena— no cuenta: eso prende o apaga la malla entera)
  const afuera = new Set();
  const enEscena = (o) => { for (let x = o; x; x = x.parent) { if (x === escena) return true; if (!x.visible && !afuera.has(x)) return false; } return false; };
  const marcarAfuera = () => { afuera.clear(); for (let x = M.raiz; x && x !== escena; x = x.parent) afuera.add(x); };   // la raíz también: esconder al gladiador entero apaga la malla, no la vacía
  const todoVisible = () => { for (const x of afuera) if (!x.visible) return false; return true; };
  function piezas() {
    const L = [];
    for (const p of M.partes) if (p.malla && p.malla.count && enEscena(p.malla)) L.push(p.malla);
    const ver = new Set(L);
    const mirar = (o) => o && o.traverse((x) => { if (x.isMesh && !ver.has(x) && x !== M.unida && !x.userData.parte && !x.isSprite && enEscena(x)) { ver.add(x); L.push(x); } });
    for (const p of M.partes) for (const c of p.grupo.children) if (!c.userData.parte && !(c.userData && c.userData.esGrupoParte)) mirar(c);
    if (M.espada) mirar(M.espada); if (M.escudo) mirar(M.escudo);
    return L.filter((x) => x.geometry && x.geometry.attributes.position && (!x.material || !x.material.transparent || x === M.cara));
  }
  // la tira con las 5 caras de este gladiador (una sola imagen) y un cuadradito blanco para el resto del cuerpo
  function armarTira() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 32); x.fillStyle = '#fff'; x.fillRect(214, 2, 40, 28);
    EXPRS.forEach((e, i) => { if (M.caras && M.caras[e]) x.drawImage(M.caras[e].image, i * 40 + 4, 4, 24, 24); });
    const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; if (M.srgb) t.encoding = T.sRGBEncoding;
    return t;
  }
  function uvCara() {
    const g = M.unida && M.unida.geometry, o = M.cara && M.cara.userData.uOff; if (!g || o == null) return;
    const i = Math.max(0, EXPRS.indexOf(M.expr)), uv = g.attributes.uv, src = M.cara.geometry.attributes.uv;
    for (let k = 0; k < src.count; k++) uv.setXY(o + k, (i * 40 + 4 + src.getX(k) * 24) / 256, (4 + src.getY(k) * 24) / 32);
    uv.needsUpdate = true;
  }
  let firma = '';
  const firmaDe = (L) => L.length + ':' + L.map((m) => m.id).join(',');
  function revisarUnida() {
    marcarAfuera(); if (M.unida) M.unida.visible = todoVisible();
    if (!M.unida || M.unirSucio) return armarUnida();
    for (const m of M.unidaPiezas) if (!enEscena(m)) return armarUnida();
    if (M.cara && M.cara.visible !== M.unidaCara) return armarUnida();
  }
  const _luz = new T.Vector3(0.4, 0.8, 0.45).normalize(), _nn = new T.Vector3();
  function armarUnida() {
    M.unirSucio = false; marcarAfuera();
    const L = piezas(); M.unidaPiezas = L; M.unidaCara = !!(M.cara && M.cara.visible);
    let nv = 0, ni = 0;
    for (const m of L) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), NN = new Float32Array(nv * 3), C = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), I = new Uint32Array(ni);
    let v0 = 0, i0 = 0;
    L.forEach((m, b) => {
      const g = m.geometry, pa = g.attributes.position, n = pa.count, ca = g.attributes.color, na = g.attributes.normal, esParte = !!m.userData.parte, esCara = m === M.cara;
      for (let k = 0; k < n; k++) { P[(v0 + k) * 3] = pa.getX(k); P[(v0 + k) * 3 + 1] = pa.getY(k); P[(v0 + k) * 3 + 2] = pa.getZ(k); if (na) { NN[(v0 + k) * 3] = na.getX(k); NN[(v0 + k) * 3 + 1] = na.getY(k); NN[(v0 + k) * 3 + 2] = na.getZ(k); } else NN[(v0 + k) * 3 + 2] = 1; }
      const mc = m.material && m.material.color ? m.material.color : _c.setRGB(1, 1, 1);
      for (let k = 0; k < n; k++) {
        let r = 1, gg = 1, bb = 1;
        if (esCara) { r = gg = bb = 1; }
        else if (ca) { r = ca.getX(k); gg = ca.getY(k); bb = ca.getZ(k); }
        else { r = mc.r; gg = mc.g; bb = mc.b; }
        // armas, escudo y prótesis no traen la luz pintada: se la pone según hacia dónde mira cada cara
        if (!esParte && !esCara && na && M.matUnida.isMeshBasicMaterial) { _nn.set(na.getX(k), na.getY(k), na.getZ(k)); const l = 0.72 + 0.28 * Math.max(0, _nn.dot(_luz)); r *= l; gg *= l; bb *= l; }
        C[(v0 + k) * 3] = r; C[(v0 + k) * 3 + 1] = gg; C[(v0 + k) * 3 + 2] = bb;
        UV[(v0 + k) * 2] = 234 / 256; UV[(v0 + k) * 2 + 1] = 16 / 32;
        SI[(v0 + k) * 4] = b; SW[(v0 + k) * 4] = 1;
      }
      if (g.index) { const ia = g.index.array; for (let k = 0; k < ia.length; k++) I[i0 + k] = ia[k] + v0; i0 += ia.length; }
      else { for (let k = 0; k < n; k++) I[i0 + k] = v0 + k; i0 += n; }
      m.userData.uOff = v0; m.layers.set(CAP_OCULTA);
      v0 += n;
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(NN, 3));
    const atC = new T.BufferAttribute(C, 3); atC.setUsage(T.DynamicDrawUsage); geo.setAttribute('color', atC);
    const atU = new T.BufferAttribute(UV, 2); atU.setUsage(T.DynamicDrawUsage); geo.setAttribute('uv', atU);
    geo.setAttribute('skinIndex', new T.BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
    geo.setIndex(new T.BufferAttribute(I, 1));
    if (!M.tiraCaras) M.tiraCaras = armarTira();
    const mat = M.matUnida;
    if (mat.map !== M.tiraCaras) { mat.map = M.tiraCaras; mat.skinning = true; mat.vertexColors = true; mat.alphaTest = 0.5; mat.needsUpdate = true; }
    const skel = new T.Skeleton(L, L.map(() => new T.Matrix4()));
    if (!M.unida) { M.unida = new T.SkinnedMesh(geo, mat); M.unida.frustumCulled = false; escena.add(M.unida); }
    else { M.unida.geometry.dispose(); M.unida.geometry = geo; if (M.unida.skeleton && M.unida.skeleton.dispose) M.unida.skeleton.dispose(); }
    M.unida.visible = todoVisible();
    M.unida.bind(skel, new T.Matrix4());
    if (M.cara) M.cara.userData.uOff = L.includes(M.cara) ? M.cara.userData.uOff : null;
    uvCara();
  }
  M.unirColor = (malla) => {
    if (!M.unida || malla.userData.uOff == null || !M.unidaPiezas || !M.unidaPiezas.includes(malla)) return;
    const dst = M.unida.geometry.attributes.color; dst.array.set(malla.geometry.attributes.color.array, malla.userData.uOff * 3); dst.needsUpdate = true;
  };
  Object.assign(M, { golpeZona, romperCraneo, cortarMiembro, fracturarMiembro, decapitar, sincronizar, protesis, razaDe, nuevo, paso, golpearPantalla, golpeAzar, rayos, estado, expresion, caer, anim, reaccion, limpiar });
  return M;
}
// peinado, barba y color de pelo de cada gladiador (siempre los mismos para la misma semilla)
// goblins y orcos: solo crestas y barbas · humanos, gigantes y ghouls: peinados y barbas
const RASGOS = {
  humano: { pein: ['calvo', 'rapado', 'corto', 'corto', 'largo', 'coleta', 'rodete'], barba: ['ninguna', 'ninguna', 'ninguna', 'corta', 'larga', 'candado', 'bigote'], pelo: [0x2e1c10, 0x1a1412, 0x6a4020, 0xb08040, 0x8a3a18, 0x8a8a88] },
  gigante: { pein: ['calvo', 'rapado', 'corto', 'largo', 'largo', 'coleta', 'rodete'], barba: ['ninguna', 'corta', 'larga', 'larga', 'candado', 'bigote'], pelo: [0x4a3018, 0x6a4020, 0x8a3a18, 0x2e1c10, 0xa08060] },
  ghoul: { pein: ['calvo', 'calvo', 'rapado', 'largo', 'corto'], barba: ['ninguna', 'ninguna', 'ninguna', 'corta', 'larga', 'bigote'], pelo: [0x1a1a1a, 0x5a5a58, 0x3a3430] },
  orco: { pein: ['calvo', 'cresta', 'crestaAlta', 'crestaLarga'], barba: ['ninguna', 'ninguna', 'corta', 'larga'], pelo: [0x141414, 0x2a1a10, 0x3a3a3a] },
  goblin: { pein: ['calvo', 'calvo', 'cresta', 'crestaAlta', 'crestaLarga'], barba: ['ninguna', 'ninguna', 'corta', 'larga'], pelo: [0x2a2010, 0x141008, 0x4a3a20] },
};
// cómo se ven los jefes de mazmorra (encima de su raza base)
// cómo se ven los esbirros de cada mazmorra
const LOOK_ESBIRRO = {
  minotauro: { cuernos: true, peinado: 'rapado', barba: 'corta', pelo: 0x2a1a10, cara: { boca: 8 } },
  medusa: { peinado: 'rapado', barba: 'ninguna', pelo: 0x2e4a22, cara: { color: '#e8d040', estilo: 'lobo' } },
  aquiles: { peinado: 'crestaAlta', barba: 'corta', pelo: 0xb3261a },
  arbol: { ramas: true, peinado: 'rapado', barba: 'larga', pelo: 0x4a7a2a, cara: { color: '#7ad040' } },
  ciclope: { peinado: 'rapado', barba: 'corta', pelo: 0x3a2a1a, cara: { ojoUnico: true, ojo: 4 } },
  talos: { peinado: 'rapado', barba: 'ninguna', pelo: 0x6a4a1a, cara: { color: '#f0a020', boca: 0 } },
};
const LOOK_JEFE = {
  diablo: { peinado: 'rapado', barba: 'candado', pelo: 0x1a0a0a, cara: { color: '#ffd000', boca: 8 } },
  minotauro: { peinado: 'rapado', barba: 'corta', pelo: 0x2a1a10, cara: { boca: 8, estilo: 'ghoul' } },
  medusa: { peinado: 'largo', barba: 'ninguna', pelo: 0x1e4a16, cara: { color: '#e8d040', estilo: 'lobo' } },
  aquiles: { peinado: 'coleta', barba: 'corta', pelo: 0xc89a3a },
  licaon: { pelo: 0x2a2420 },
  arbol: { peinado: 'rapado', barba: 'larga', pelo: 0x4a7a2a, cara: { color: '#7ad040' } },
  ciclope: { peinado: 'rapado', barba: 'corta', pelo: 0x3a2a1a, cara: { ojoUnico: true, ojo: 4, boca: 8 } },
  talos: { peinado: 'rapado', barba: 'ninguna', pelo: 0x6a4a1a, cara: { color: '#f0a020', boca: 0 } },
};
function rasgos(R, raza, semilla) {
  const T2 = RASGOS[raza]; if (!T2) return;
  let h = (typeof semilla === 'string' ? [...semilla].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) : semilla | 0) >>> 0;
  const r = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  const de = (l) => l[(r() * l.length) | 0];
  R.peinado = de(T2.pein); R.barba = de(T2.barba); R.pelo = de(T2.pelo);
}
function modo3D(v) {
  if (v != null) { try { localStorage.setItem('coliseo_g', v ? '3d' : '2d'); } catch (e) { /* sin storage */ } return !!v; }
  const q = new URLSearchParams(location.search).get('g'); if (q) return q !== '2d';
  try { return localStorage.getItem('coliseo_g') !== '2d'; } catch (e) { return true; }
}
// figura para escenas tranquilas: un gladiador de cubitos dentro de un grupo, con .animar(dt, anim) como los sprites
const EF_NADA = { gota() {}, mancha() {}, salpicar() {}, bit() {}, paso() {}, limpiar() {} };
function figura(spec, altura, escena) {
  calidad(root.Ajustes.q());
  const s = new T.Group(), dentro = new T.Group(); s.add(dentro);
  const G = instalar({ srgb: false }, escena || s, EF_NADA, new T.MeshLambertMaterial());
  const raza = spec.raza === 'loboT' ? 'lobo' : spec.raza === 'esqueleto' ? 'esqueleto' : RAZAS[spec.raza] ? spec.raza : 'humano';
  G.nuevo({ semilla: spec.id != null ? String(spec.id) : undefined, raza, altura, tela: typeof spec.color === 'string' ? parseInt(spec.color.replace('#', ''), 16) : spec.color, arma: spec.arma, escudo: spec.escudo, armadura: spec.armadura, protesis: spec.protesis, jefe: spec.jefe, esbirro: spec.esbirro, ojosRojos: spec.ojosRojos, piel: (spec.jefe || spec.esbirro || raza === 'humano') && spec.piel ? parseInt(String(spec.piel).replace('#', ''), 16) : undefined, motor: true, padre: dentro });
  let px = null, pz = null, rot = 0;
  s.voxel = G;
  s.animar = (dt, anim) => {
    // gira hacia donde camina (las escenas dan vuelta el sprite con scale.x: acá se usa para saber el sentido)
    if (px != null) { const dx = s.position.x - px, dz = s.position.z - pz; if (Math.hypot(dx, dz) > 1e-4) { const m = Math.atan2(dx, dz); let d = m - rot; d = Math.atan2(Math.sin(d), Math.cos(d)); rot += d * Math.min(1, dt * 8); } else rot *= Math.max(0, 1 - dt * 2); }
    px = s.position.x; pz = s.position.z; s.scale.set(1, 1, 1); dentro.rotation.y = rot;
    if (anim === 'caminar') { if (G.base !== 'caminar') G.anim('caminar'); } else if (G.base !== 'quieto') G.anim('quieto');
    G.paso(dt);
  };
  return s;
}
// un emperador de cubitos: toga, banda de su color y corona de laureles; se anima solo (no hace falta llamar .animar)
// look (editor del multijugador): { raza, piel: '#hex', peinado, pelo: '#hex' }
function emperador(color, altura, raza, look) {
  if (look && look.raza) raza = look.raza;
  calidad(root.Ajustes.q());
  const s = new T.Group(), dentro = new T.Group(); s.add(dentro);
  const mat = new T.MeshLambertMaterial();
  const G = instalar({ srgb: false }, s, EF_NADA, mat);
  const hex = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
  const rz = RAZAS[raza] && raza !== 'lobo' ? raza : 'humano', PH = root.Motor && root.Motor.PIELES_HUMANAS;
  G.nuevo({ semilla: 'emp' + color + (raza || ''), raza: rz, ...(look && look.peinado ? { peinado: look.peinado } : {}), ...(look && look.pelo ? { pelo: parseInt(String(look.pelo).replace('#', ''), 16) } : {}), piel: look && look.piel ? parseInt(String(look.piel).replace('#', ''), 16) : rz === 'humano' && PH ? parseInt(PH[[...String(color)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % PH.length][0].slice(1), 16) : undefined, altura, tela: hex, armadura: 'toga', corona: true, arma: 'nada', escudo: 'ninguno', motor: true, padre: dentro });
  G.modo = 'erguido';
  s.voxel = G;
  // opacidad como los sprites (el salón los hace aparecer de a poco)
  s.material = { get opacity() { return mat.opacity; }, set opacity(v) { const t = v < 0.999; s.traverse((o) => { if (o.material && o.material.isMaterial) { o.material.transparent = t || !!o.material.map; o.material.opacity = v; } }); } };
  let px = null, pz = null, rot = 0;
  s.animar = (dt) => {
    if (px != null) { const dx = s.position.x - px, dz = s.position.z - pz; if (Math.hypot(dx, dz) > 1e-4) { const m = Math.atan2(dx, dz); let d = m - rot; d = Math.atan2(Math.sin(d), Math.cos(d)); rot += d * Math.min(1, dt * 8); } else rot *= Math.max(0, 1 - dt * 2); }
    px = s.position.x; pz = s.position.z; dentro.rotation.y = rot;
    G.paso(dt);
  };
  _emps.add(s); s.userData.sinPadre = 0; if (!_empLoop) { _empLoop = true; requestAnimationFrame(_empPaso); }
  return s;
}
// todos los emperadores en escena se animan solos (respiran y miran alrededor)
const _emps = new Set(); let _empLoop = false, _empT = 0;
function _empPaso(now) {
  const t = now / 1000, dt = _empT ? Math.min(0.1, t - _empT) : 0; _empT = t;
  for (const e of _emps) {
    if (!e.parent) { e.userData.sinPadre += dt; if (e.userData.sinPadre > 15) _emps.delete(e); continue; }
    e.userData.sinPadre = 0; if (dt > 0 && e.visible && !e.userData.manual) e.animar(dt);
  }
  if (_emps.size) requestAnimationFrame(_empPaso); else _empLoop = false;
}
root.Voxel = { hornearTodo: () => { for (const c of Object.values(CLIPS)) if (c.P && !_horno.has(c.P)) hornear(c.P); }, clipInfo: (n) => CLIPS[n] || null, modo3D, figura, emperador, rasgosRaza: (r) => RASGOS[r], crearMundo, crearEfectos, calidad, gladiador: (escena, ef, op = {}) => instalar({ srgb: !!op.srgb }, escena, ef, op.material || new T.MeshLambertMaterial()), RAZAS: Object.keys(RAZAS), ANIMS, NOMBRE, V };
})(window);
