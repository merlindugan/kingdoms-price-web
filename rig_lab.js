/* =====================================================================
   COLISEO · RIG 2D POR PARTES · versión LABORATORIO con CARNE POR CAPAS
   Cada gladiador = piezas pixel art (cabeza con cara, torso con anatomía,
   falda, brazos, piernas, arma, escudo) unidas por un esqueleto 2D.
   El doble de resolución que la v1, articulaciones con resortes
   (anticipación y rebote), caras con expresiones (ojos y boca, sin nariz),
   heridas que quedan marcadas, fracturas, miembros cortados y prótesis.
   Interfaz:
     const g = Rig.crear(spec)          // spec: { id, raza, color, piel, arma, escudo, armadura, protesis }
     g.anim('golpe')                    // cambia de animación
     g.cuerpo({ miembros, decap, sangrado, cansado })   // estado del cuerpo (lo pone la arena)
     g.herida(zona)                     // marca una herida (zona: 'cabeza' | 'torso' | 'bA' | 'bE' | 'pA' | 'pB')
     g.paso(dt)                         // avanza y redibuja
     g.canvas                           // lienzo listo para usar como textura
     Rig.suelto(spec, parte)            // lienzo de un miembro cortado o de la cabeza (para que vuele)
   ===================================================================== */
(function (root) {
const K = 2;   // resolución: cada "píxel de diseño" de la v1 son K×K píxeles acá
// proporciones (en píxeles de diseño); el rig tiene lienzo propio, así que los gigantes pueden ser gigantes
const PROP = Object.assign({}, root.Sprites.PROP, {
  loboT: { total: 68, head: [9, 8], neck: 2, shoulder: 24, chest: 15, waist: 13, abd: 8, hip: 14, thigh: 15, shin: 15, leg: 7, upper: 12, fore: 12, arm: 6, hunch: 3, wolf: true },
  gigante: { total: 72, head: [8, 8], neck: 3, shoulder: 28, chest: 17, waist: 21, abd: 9, hip: 21, thigh: 17, shin: 16, leg: 9, upper: 14, fore: 14, arm: 7, beard: true },
});
const W = 144 * K, H = 124 * K, SUELO = 120 * K, RAIZ_X = 64 * K;
const PELOS = ['#2a1a10', '#3d2615', '#5a3a1c', '#1a1a1a', '#7a4a20', '#8a7a6a', '#b07a3a'];
const hx2 = (h) => parseInt(h.slice(1), 16);
const C_MUS = hx2('#a3281f'), C_MUS_D = hx2('#741813'), C_MUS_M = hx2('#8e2019'), C_MUS_L = hx2('#c8473a'), C_MUS_P = hx2('#5a0e0a');
const C_ART = hx2('#ff3a2a'), C_VEN = hx2('#5a2c78'), C_PUL = hx2('#d07a7a'), C_PUL_D = hx2('#a8505a'), C_ORG = hx2('#e08a96'), C_ORG_D = hx2('#a94a5e');
const C_HUE = hx2('#efe6cf'), C_HUE_L = hx2('#fffaee'), C_HUE_D = hx2('#bcae8c'), C_MED = hx2('#c99a7a'), C_HUE_R = hx2('#d8cba8'), C_HUE_R2 = hx2('#e6dcc0'), C_GRIETA = hx2('#3a2a1a');
const C_CAV = hx2('#200404'), C_DIENTE = hx2('#f2efe0'), C_SANG = hx2('#9a1410'), C_SANG_D = hx2('#5e0806'), C_MOR = hx2('#7a4a7a'), C_MOR_D = hx2('#3e2050');
const F_T1 = 0.25, F_T2 = 0.5, F_T3 = 0.78;   // umbrales: piel → músculo → venas/órganos → hueso
const SANGRE = '#8e0f0f', SANGRE_L = '#c4201a', SANGRE_D = '#4e0606', HUESO = '#efe6cf', MADERA = '#7b5530';
function hexA(hex) { if (hex.startsWith('rgb')) return hex.match(/\d+/g).map(Number); const c = parseInt(hex.slice(1), 16); return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
function tone(hex, k) { const [r, g, b] = hexA(hex); const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function mezcla(a, b, k) { const A = hexA(a), B = hexA(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R2 = Math.round;

/* =====================================================================
   PINTURA
   ===================================================================== */
// Scale2x (EPX): duplica la resolución del pixel art redondeando las diagonales sin borronear
function escalar2x(src) {
  const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const p32 = new Uint32Array(d.buffer.slice(0)), W2 = w * 2, out = lienzo(W2, h * 2), ctx = out.getContext('2d'), od = ctx.createImageData(W2, h * 2), o32 = new Uint32Array(od.data.buffer);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : p32[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = p32[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A;
    if (A === B && A !== C && B !== D) e1 = B;
    if (D === C && D !== B && C !== A) e2 = C;
    if (B === D && B !== A && D !== C) e3 = D;
    const i = y * 2 * W2 + x * 2; o32[i] = e0; o32[i + 1] = e1; o32[i + W2] = e2; o32[i + W2 + 1] = e3;
  }
  ctx.putImageData(od, 0, 0);
  return out;
}
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function pintor(c) {
  const g = c.getContext('2d');
  const px = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(R2(x), R2(y), R2(w), R2(h)); };
  // fila sombreada: luz a la izquierda, sombra a la derecha (el sol viene de arriba a la izquierda)
  const fila = (x, y, w, base, k = 1) => {
    w = R2(w); x = R2(x); if (w <= 0) return;
    px(x, y, w, 1, tone(base, k));
    if (w >= 3) px(x, y, 1, 1, tone(base, 1.28 * k));
    if (w >= 5) px(x + 1, y, Math.max(1, R2(w * 0.18)), 1, tone(base, 1.12 * k));
    const s = Math.max(1, R2(w * 0.3)); px(x + w - s, y, s, 1, tone(base, 0.78 * k));
    if (w >= 4) px(x + w - 1, y, 1, 1, tone(base, 0.62 * k));
  };
  return { g, px, fila };
}
// miembro con forma: ancho que va de w0 a w1, con un músculo que abulta entre t0 y t1
function miembro(len, w0, w1, base, musc = null, extra = null) {
  const wMax = Math.max(w0, w1) + (musc ? musc[2] : 0) + 2;
  const c = lienzo(wMax, len + 2), { px, fila } = pintor(c);
  for (let y = 0; y < len; y++) {
    const t = y / Math.max(1, len - 1);
    let w = lerp(w0, w1, t);
    if (musc) { const [t0, t1, amp] = musc; if (t > t0 && t < t1) w += amp * Math.sin(Math.PI * (t - t0) / (t1 - t0)); }
    const x = (wMax - w) / 2 + (musc ? musc[2] * 0.25 * (t > musc[0] && t < musc[1] ? 1 : 0) : 0);
    fila(x, y, w, base);
  }
  if (musc) {   // línea que separa el músculo
    const yy = R2(len * musc[1]); px(R2(wMax / 2), yy, 2, 1, tone(base, 0.72));
  }
  if (extra) extra(px, wMax, len);
  return { c, ox: wMax / 2, oy: 0, largo: len };
}

/* =====================================================================
   PIEZAS
   ===================================================================== */
function piezas(spec) {
  const P0 = PROP[spec.raza] || PROP.humano;
  const P = {}; for (const k in P0) P[k] = typeof P0[k] === 'number' ? P0[k] * K : Array.isArray(P0[k]) ? P0[k].map((v) => v * K) : P0[k];
  const piel = spec.piel, tun = spec.color, sem = hash((spec.id || '') + spec.raza), r = rnd(sem);
  const esq = !!P.skel, lob = !!P.wolf, gho = !!P.ghoul, orc = !!P.jaw, gob = !!P.ears, gig = !!P.beard;
  const pelo = gob || esq || lob ? null : PELOS[sem % PELOS.length];
  const peinado = sem % 5;   // 0 corto · 1 rapado · 2 largo · 3 cresta · 4 coleta
  const pesada = spec.armadura === 'pesada', ligera = spec.armadura === 'ligera';
  const S = P.total / (54 * K);
  const out = { P, P0 };
  const acero = '#b8c0c8', aceroD = '#7d8690', aceroL = '#eef3f7', cuero = '#8a5a33', cueroD = '#5a3a20', oro = '#d9b444';
  // hueso (para el esqueleto)
  const hueso = (len, w) => miembro(len, w, w, piel, null, (px, wm, l) => { px(wm / 2 - w / 2 - 1, 0, w + 2, 3, tone(piel, 0.95)); px(wm / 2 - w / 2 - 1, l - 3, w + 2, 3, tone(piel, 0.9)); px(wm / 2 - 1, 4, 1, l - 8, tone(piel, 1.2)); });

  // ---- piernas ----
  out.muslo = esq ? hueso(P.thigh + K, Math.max(2, P.leg * 0.5))
    : miembro(P.thigh + K, P.leg * 1.08, P.leg * 0.78, piel, [0.15, 0.75, P.leg * 0.18], (px, wm, l) => {
      if (lob) for (let y = 2; y < l - 2; y += 4) px(1, y, 2, 2, tone(piel, 0.7));
      if (pesada) { for (let y = 0; y < 5; y++) px(1, y, wm - 2, 1, tone(acero, y % 2 ? 0.8 : 1.05)); }
    });
  out.canilla = (() => {
    if (esq) { const h = hueso(P.shin, Math.max(2, P.leg * 0.45)); const { px } = pintor(h.c); return h; }
    const len = P.shin, wm = P.leg + 8, c = lienzo(wm, len + 6), { px, fila } = pintor(c), cx = P.leg / 2 + 1;
    for (let y = 0; y < len; y++) {
      const t = y / len, calf = t > 0.08 && t < 0.55 ? Math.sin(Math.PI * (t - 0.08) / 0.47) * P.leg * 0.22 : 0;
      const w = lerp(P.leg * 0.86, P.leg * 0.55, t) + calf;
      fila(cx - w / 2 - calf * 0.6, y, w, piel);
    }
    if (lob) { px(0, len - 2, P.leg + 6, 4, tone(piel, 0.8)); for (let x = P.leg; x < P.leg + 7; x += 2) px(x, len + 2, 1, 2, '#f2efe0'); }
    else {
      if (pesada) for (let y = 2; y < len - 10; y++) fila(cx - P.leg * 0.5, y, P.leg + 1, acero, y % 4 === 0 ? 0.85 : 1);   // grebas
      // sandalia con tiras
      for (let y = len - 10; y < len; y += 3) px(cx - P.leg * 0.45, y, P.leg * 0.95, 1, cueroD);
      px(cx - P.leg * 0.5, len, P.leg + 6, 3, '#3a2614'); px(cx - P.leg * 0.5, len, P.leg + 6, 1, '#5a3a20');
      px(cx + P.leg * 0.4, len - 2, 5, 2, tone(piel, 0.92));   // empeine
    }
    return { c, ox: cx, oy: 0, largo: len };
  })();
  // pata de palo (prótesis)
  out.pata = (() => {
    const len = P.shin + 2, c = lienzo(P.leg + 2, len + 2), { px } = pintor(c), cx = (P.leg + 2) / 2;
    px(cx - P.leg * 0.45, 0, P.leg * 0.9, 5, cueroD); px(cx - P.leg * 0.45, 2, P.leg * 0.9, 1, oro);
    for (let y = 5; y < len; y++) { const w = lerp(P.leg * 0.55, P.leg * 0.3, (y - 5) / (len - 5)); px(cx - w / 2, y, w, 1, MADERA); px(cx - w / 2, y, 1, 1, tone(MADERA, 1.3)); px(cx + w / 2 - 1, y, 1, 1, tone(MADERA, 0.7)); }
    px(cx - 2, len - 1, 4, 2, '#3a2614');
    return { c, ox: cx, oy: 0, largo: len };
  })();

  // ---- brazos ----
  out.brazo = esq ? hueso(P.upper + K, Math.max(2, P.arm * 0.5))
    : miembro(P.upper + K, P.arm * 1.1, P.arm * 0.82, piel, [0.12, 0.68, P.arm * 0.32], (px, wm, l) => {
      if (pesada) { for (let y = 0; y < 7; y++) px(0, y, wm, 1, tone(acero, y % 3 === 0 ? 0.75 : 1.05)); px(1, 7, wm - 2, 1, aceroD); }
      else if (ligera) { px(0, 0, wm, 5, cuero); px(0, 4, wm, 1, cueroD); }
      if (lob) for (let y = 3; y < l; y += 4) px(0, y, 2, 2, tone(piel, 0.7));
    });
  out.antebrazo = (() => {
    const len = P.fore, wm = P.arm + 6, c = lienzo(wm, len + 8), { px, fila } = pintor(c), cx = wm / 2;
    if (esq) { for (let y = 0; y < len; y++) { px(cx - 2, y, 1, 1, tone(piel, 1.05)); px(cx + 1, y, 1, 1, tone(piel, 0.85)); } px(cx - 3, 0, 6, 3, tone(piel, 0.95)); px(cx - 3, len, 6, 2, tone(piel, 0.9)); for (let i = 0; i < 4; i++) px(cx - 3 + i * 2, len + 2, 1, 4, tone(piel, 0.85)); return { c, ox: cx, oy: 0, largo: len + 2 }; }
    for (let y = 0; y < len; y++) {
      const t = y / len, musc = t < 0.45 ? Math.sin(Math.PI * t / 0.45) * P.arm * 0.22 : 0;
      fila(cx - lerp(P.arm * 0.88, P.arm * 0.6, t) / 2 - musc / 2, y, lerp(P.arm * 0.88, P.arm * 0.6, t) + musc, piel);
    }
    if (lob) { px(cx - P.arm / 2 - 1, len, P.arm + 3, 5, tone(piel, 0.9)); for (let x = cx - P.arm / 2 - 1; x < cx + P.arm / 2 + 2; x += 2) px(x, len + 5, 1, 3, '#f2efe0'); return { c, ox: cx, oy: 0, largo: len + 2 }; }
    if (pesada) for (let y = len - 9; y < len - 2; y++) fila(cx - P.arm / 2 - 1, y, P.arm + 2, acero, y % 3 === 0 ? 0.8 : 1);
    else for (let y = len - 7; y < len - 2; y++) fila(cx - P.arm / 2, y, P.arm + 1, cuero, y % 2 ? 0.85 : 1);   // brazal
    if (spec.arma === 'cestus') { for (let y = len - 1; y < len + 6; y++) fila(cx - P.arm / 2 - 1, y, P.arm + 3, cuero, y % 2 ? 0.8 : 1); px(cx + P.arm / 2, len + 1, 2, 2, acero); px(cx + P.arm / 2, len + 4, 2, 2, acero); }
    else { for (let y = len - 1; y < len + 5; y++) fila(cx - P.arm / 2, y, P.arm + 1 + (y > len + 1 ? 1 : 0), tone(piel, 0.95)); px(cx + P.arm / 2, len + 1, 2, 3, tone(piel, 0.8)); }   // mano (puño)
    return { c, ox: cx, oy: 0, largo: len + 2 };
  })();
  // garfio (prótesis de brazo)
  out.garfio = (() => {
    const len = P.fore, wm = P.arm + 8, c = lienzo(wm, len + 12), { px } = pintor(c), cx = wm / 2;
    for (let y = 0; y < len; y++) { const w = lerp(P.arm * 0.85, P.arm * 0.6, y / len); px(cx - w / 2, y, w, 1, MADERA); px(cx - w / 2, y, 1, 1, tone(MADERA, 1.3)); px(cx + w / 2 - 1, y, 1, 1, tone(MADERA, 0.7)); }
    px(cx - P.arm / 2, 0, P.arm, 4, cueroD); px(cx - P.arm / 2, 2, P.arm, 1, oro);
    px(cx - 1, len, 2, 4, aceroD); px(cx - 1, len + 4, 2, 4, acero); px(cx + 1, len + 7, 3, 2, acero); px(cx + 3, len + 5, 2, 2, aceroL);   // gancho
    return { c, ox: cx, oy: 0, largo: len + 3 };
  })();

  // ---- torso (pivote abajo al centro: la cintura) ----
  out.torso = (() => {
    const h = P.chest + P.abd, w = P.shoulder + 6, c = lienzo(w, h + 2), { px, fila } = pintor(c);
    const cx = w / 2;
    if (esq && !pesada && !ligera) {   // costillas, esternón, columna y pelvis
      for (let i = 0; i < h; i++) px(cx - 2, i, 4, 1, tone(piel, i % 4 < 2 ? 0.95 : 0.78));   // columna
      for (let i = 3; i < P.chest; i += 4) { const wd = R2(P.shoulder - 6 - i * 0.45), x = R2(cx - wd / 2); for (let k = 0; k < 2; k++) { px(x, i + k, wd, 1, tone(piel, k ? 0.88 : 1.02)); } px(x, i, 2, 2, tone(piel, 1.2)); px(x + wd - 3, i, 3, 2, tone(piel, 0.7)); }
      px(cx - P.shoulder / 2, 0, P.shoulder, 2, tone(piel, 1.05));   // clavículas
      px(cx + 2, 2, 3, P.chest - 6, tone(piel, 1.08));   // esternón
      px(cx - P.hip / 2 + 2, h - 6, P.hip - 4, 4, tone(piel, 0.9)); px(cx - P.hip / 2 + 4, h - 2, 4, 2, tone(piel, 0.75)); px(cx + P.hip / 2 - 8, h - 2, 4, 2, tone(piel, 0.75));   // pelvis
      return { c, ox: cx, oy: h, alto: h, hombroX: P.shoulder / 2 - 3, hombroY: -h + 2 };
    }
    for (let i = 0; i < h; i++) {
      const k = i < P.chest ? i / P.chest : 1;
      const wd = P.shoulder + (P.waist - P.shoulder) * Math.min(1, Math.pow(k, 0.8) * 1.05);
      const base = pesada ? acero : ligera ? cuero : piel;
      const band = pesada ? (i % 6 === 0 ? 0.62 : i % 6 === 1 ? 1.25 : i % 6 === 5 ? 0.82 : 1) : 1;
      fila(cx - wd / 2, i, wd, base, band);
    }
    const desnudo = !pesada && !ligera;
    if (lob && desnudo) {   // pelaje: pecho más claro, mechones
      for (let i = 2; i < P.chest; i++) px(cx - 3, i, 9 - i * 0.2, 1, tone(piel, 1.22));
      for (let i = 0; i < h - 4; i += 4) { px(cx - P.shoulder / 2 - 2, i, 4, 2, tone(piel, 0.7)); px(cx + 4, i + 2, 2, 1, tone(piel, 0.8)); }
    } else if (desnudo) {
      // pectorales (vista de 3/4: el de adelante más grande)
      const py = R2(P.chest * 0.62);
      for (let x = -P.shoulder / 2 + 4; x < P.shoulder / 2 - 2; x++) { const curva = R2(Math.sin(((x + P.shoulder / 2) / P.shoulder) * Math.PI * 2) * 1.5); px(cx + x, py + curva, 1, 1, tone(piel, 0.7)); px(cx + x, py + curva - 1, 1, 1, tone(piel, 1.08)); }
      px(cx + 1, 3, 2, py - 2, tone(piel, 0.8));   // esternón
      // abdominales: tres filas de dos
      const ay = P.chest + 1, ah = Math.max(3, R2((P.abd - 4) / 3));
      if (!gob) for (let rr = 0; rr < 3; rr++) { const y = ay + rr * ah; px(cx - 5, y, 4, ah - 1, tone(piel, 1.06)); px(cx + 2, y, 4, ah - 1, tone(piel, 0.95)); px(cx - 5, y + ah - 1, 11, 1, tone(piel, 0.74)); }
      if (!gob) px(cx, ay, 1, ah * 3, tone(piel, 0.72));
      px(cx - P.waist / 2 + 1, P.chest - 2, 2, P.abd - 2, tone(piel, 0.82));   // oblicuo
      if (gho) for (let i = 4; i < P.chest; i += 3) px(cx - P.shoulder / 2 + 3, i, P.shoulder * 0.4, 1, tone(piel, 0.78));   // costillas marcadas
      if (gig || orc) for (let i = 0; i < 18; i++) px(cx - 4 + r() * 9, 3 + r() * (P.chest - 4), 1, 1, tone(pelo || piel, gig ? 0.55 : 0.8));   // pelos del pecho / cicatrices
      // exomis: la túnica cruzada sobre un hombro
      for (let i = 0; i < h - 2; i++) px(R2(cx - P.shoulder / 2 + 2 + i * (P.shoulder - 6) / h), i, 6, 1, tone(tun, i % 4 === 0 ? 0.8 : i % 4 === 1 ? 1.15 : 1));
    }
    if (ligera) {   // coraza de cuero con tachas
      px(cx - P.shoulder / 2 + 3, 2, P.shoulder - 6, 2, tone(cuero, 1.3));
      for (let y = 6; y < h - 6; y += 6) for (let x = cx - P.waist / 2 + 3; x < cx + P.waist / 2 - 2; x += 6) px(x, y, 2, 2, oro);
      px(cx - 1, 3, 2, h - 8, tone(cuero, 0.7));
    }
    if (pesada) for (let y = 3; y < h - 4; y += 6) { px(cx - P.waist / 2 + 2, y, 2, 2, aceroL); px(cx + P.waist / 2 - 4, y, 2, 2, aceroD); }   // remaches de la lorica
    // cinturón
    for (let y = h - 4; y < h; y++) fila(cx - P.waist / 2 - 2, y, P.waist + 4, cueroD, y === h - 4 ? 1.3 : 1);
    px(cx - 2, h - 4, 4, 4, oro); px(cx - 1, h - 3, 2, 2, '#fff1a0');
    return { c, ox: cx, oy: h, alto: h, hombroX: P.shoulder / 2 - 3, hombroY: -h + 2 };
  })();

  // ---- falda (pivote arriba al centro) ----
  out.falda = (() => {
    const fh = R2(P.thigh * 0.55) + 4, w = P.hip + 10 + R2(fh * 0.4), c = lienzo(w, fh + 2), { px, fila } = pintor(c);
    for (let i = 0; i < fh; i++) {
      const wd = P.hip + 4 + i * 0.4, x = w / 2 - wd / 2;
      fila(x, i, wd, tun);
      if (i > 2) for (let fx = x + 3; fx < x + wd - 3; fx += 5) px(fx, i, 1, 1, tone(tun, 0.72));   // pliegues
    }
    const wd = P.hip + 4 + (fh - 1) * 0.4; px(w / 2 - wd / 2, fh - 2, wd, 2, tone(tun, 0.55));
    if (ligera || pesada) for (let x = w / 2 - P.hip / 2; x < w / 2 + P.hip / 2; x += 4) { px(x, 0, 3, 10, pesada ? aceroD : cuero); px(x, 9, 3, 1, oro); }   // pteruges
    return { c, ox: w / 2, oy: 0 };
  })();

  // ---- cabeza (pivote: base del cuello). La cara se dibuja aparte (expresiones) ----
  out.cabeza = (() => {
    const [hw0, hh0] = P.head, hw = hw0 + 2, hh = hh0 + 2, w = hw + 24, h = hh + P.neck + 18, c = lienzo(w, h), { px, fila } = pintor(c);
    const hx = 9, ht = 10;
    const cara = { hx, ht, hw, hh, ojoY: ht + R2(hh * 0.4), bocaY: ht + R2(hh * 0.74), ojoX: hx + hw - R2(hw * 0.32), ojoX2: hx + hw - R2(hw * 0.72) };
    const cuello = () => { for (let y = ht + hh - 4; y < ht + hh + P.neck + 2; y++) fila(hx + hw / 2 - P.arm * 0.55, y, P.arm * 1.15, tone(piel, 0.92)); };
    if (esq) {   // calavera
      cuello();
      for (let y = 0; y < hh - 3; y++) { const t = y / (hh - 3), wd = hw * (t < 0.7 ? 1 : 1 - (t - 0.7) * 1.2); fila(hx + (hw - wd) / 2, ht + y, wd, piel); }
      px(hx + 2, ht + hh - 4, hw - 3, 4, tone(piel, 0.9));   // mandíbula
      return { c, ox: hx + hw / 2, oy: ht + hh + P.neck, cara };
    }
    if (lob) {   // cabeza de lobo: hocico, orejas, melena
      cuello();
      for (let y = 0; y < hh; y++) fila(hx, ht + y, hw, piel);
      for (let y = 0; y < 8; y++) fila(hx + hw - 2, ht + 6 + y * 0.6, 10 - y * 0.3, tone(piel, y > 4 ? 0.85 : 1));   // hocico
      px(hx + hw + 6, ht + 6, 3, 3, '#120c08');   // trufa
      px(hx + 2, ht - 7, 4, 7, tone(piel, 0.85)); px(hx + 3, ht - 5, 2, 4, '#5a3030'); px(hx + 8, ht - 5, 4, 5, tone(piel, 0.8));   // orejas
      for (let y = 2; y < hh + 4; y += 3) px(hx - 3, ht + y, 4, 2, tone(piel, 0.7));   // melena
      cara.ojoX = hx + hw - 5; cara.ojoX2 = -99; cara.bocaY = ht + hh - 2;
      return { c, ox: hx + hw / 2, oy: ht + hh + P.neck, cara };
    }
    cuello();
    // cráneo con mandíbula: más ancho arriba, mentón hacia adelante
    // cabeza redondeada: cráneo ovalado arriba y mandíbula que se curva hasta el mentón (hacia adelante)
    for (let y = 0; y < hh; y++) {
      const t = y / (hh - 1);
      let wd, x;
      if (t < 0.6) { const u = (t - 0.6) / 0.6; wd = hw * Math.sqrt(Math.max(0.05, 1 - u * u * 0.85)); x = hx + (hw - wd) / 2; }
      else { const u = (t - 0.6) / 0.4; wd = hw * (1 - u * u * (orc ? 0.25 : 0.55)); x = hx + (hw - wd) * 0.9; }
      fila(x, ht + y, wd, piel);
    }
    if (orc) { px(hx + hw - 2, ht + hh - 5, 2, 3, '#f2efe0'); px(hx + hw - 6, ht + hh - 4, 2, 3, '#f2efe0'); }   // colmillos
    // oreja (lado lejano)
    if (gob) { for (let i = 0; i < 6; i++) px(hx - 2 - i, ht + 4 - i * 0.5, 3 + i * 0.3, 3, tone(piel, i % 2 ? 0.92 : 1)); px(hx + hw, ht + 6, 3, 4, tone(piel, 0.85)); }
    else { px(hx + 2, cara.ojoY - 1, 3, 5, tone(piel, 0.8)); px(hx + 3, cara.ojoY, 1, 3, tone(piel, 0.6)); }
    if (gho) { px(hx + 1, ht + 2, hw - 3, 1, tone(piel, 0.8)); px(hx + hw - 3, ht + hh - 6, 2, 1, tone(piel, 0.7)); }   // piel tirante
    if (gig) { for (let y = ht + hh - 7; y < ht + hh + 4; y++) px(hx + 2, y, hw - 2 + (y > ht + hh ? -2 : 0), 1, tone(pelo, y % 2 ? 0.85 : 1)); }   // barba
    // pelo / casco
    if (pesada) {   // galea con penacho del color del equipo y carrillera
      for (let y = -2; y < 6; y++) fila(hx - 2, ht + y, hw + 3, acero, y === -2 ? 1.25 : 1);
      px(hx - 2, ht + 5, 4, hh - 6, aceroD); px(hx + hw - 4, ht + 5, 3, 7, acero);
      for (let y = 0; y < 6; y++) px(hx + 1 - y * 0.5, ht - 3 - y, hw - 1, 1, tone(tun, y % 2 ? 0.8 : 1.1));   // penacho
      px(hx + hw - 1, ht - 2, 2, 8, aceroL);
    } else if (ligera) { for (let y = -2; y < 4; y++) fila(hx - 2, ht + y, hw + 2, cuero, y === -2 ? 1.25 : 1); px(hx - 2, ht + 3, 3, 6, cueroD); }
    else if (pelo) {
      if (peinado === 0) { for (let y = -2; y < 3; y++) fila(hx - 1, ht + y, hw + 1 - (y < 0 ? 2 : 0), pelo); px(hx - 1, ht + 2, 4, 6, pelo); }
      else if (peinado === 1) { for (let y = -1; y < 2; y++) px(hx, ht + y, hw - 2, 1, tone(pelo, 0.9)); }
      else if (peinado === 2) { for (let y = -2; y < 3; y++) fila(hx - 1, ht + y, hw + 1, pelo); for (let y = 2; y < hh + 4; y++) px(hx - 2, ht + y, 5, 1, tone(pelo, y % 3 ? 1 : 0.8)); }
      else if (peinado === 3) { for (let y = -5; y < 2; y++) px(hx + 2, ht + y, hw - 5, 1, tone(pelo, y % 2 ? 0.85 : 1.1)); }
      else { for (let y = -2; y < 3; y++) fila(hx - 1, ht + y, hw + 1, pelo); px(hx - 5, ht + 2, 5, 3, pelo); px(hx - 7, ht + 4, 3, 7, pelo); }
    }
    return { c, ox: hx + hw / 2, oy: ht + hh + P.neck, cara };
  })();

  // ---- arma: "colgando" del puño (pivote = empuñadura), apuntando hacia +y ----
  out.arma = (() => {
    const L = (n) => R2(n * S * K), a = spec.arma;
    const madera = MADERA, maderaL = '#9a7040', maderaD = '#5a3a1c';
    let c, ox = 4, oy = 4, punta = 20;
    const hoja = (px, x, y0, len, w) => { for (let y = 0; y < len; y++) { const ww = y > len - w ? len - y : w; px(x, y0 + y, ww, 1, acero); px(x, y0 + y, 1, 1, aceroL); if (ww > 2) px(x + ww - 1, y0 + y, 1, 1, aceroD); } px(x + 1, y0 + 2, 1, len - w - 2, aceroD); };
    if (a === 'gladius') { c = lienzo(12, L(17)); const { px } = pintor(c); px(4, 0, 4, 2, oro); px(4, 2, 4, 5, maderaD); px(5, 2, 1, 5, madera); px(0, 7, 12, 2, oro); px(0, 7, 12, 1, '#fff1a0'); hoja(px, 3, 9, L(12), 6); ox = 6; oy = 3; punta = 9 + L(12); }
    else if (a === 'daga') { c = lienzo(10, L(11)); const { px } = pintor(c); px(4, 0, 2, 6, maderaD); px(1, 6, 8, 2, oro); hoja(px, 3, 8, L(6), 4); ox = 5; oy = 3; punta = 8 + L(6); }
    else if (a === 'lanza') { c = lienzo(12, L(46)); const { px } = pintor(c); px(4, 0, 4, L(40), madera); px(4, 0, 1, L(40), maderaL); px(7, 0, 1, L(40), maderaD); for (let y = L(14) - 6; y < L(14) + 6; y += 2) px(4, y, 4, 1, cueroD); for (let y = 0; y < 14; y++) { const ww = y < 4 ? 8 : 8 - (y - 4) * 0.7; px(6 - ww / 2, L(40) + y, ww, 1, acero); px(6 - ww / 2, L(40) + y, 1, 1, aceroL); } ox = 6; oy = L(14); punta = L(40) + 14 - L(14); }
    else if (a === 'martillo') { c = lienzo(24, L(27)); const { px } = pintor(c); px(10, 0, 4, L(20), madera); px(10, 0, 1, L(20), maderaL); for (let y = 2; y < 12; y += 2) px(10, y, 4, 1, cueroD); for (let y = 0; y < 14; y++) { px(0, L(19) + y, 24, 1, y < 3 ? acero : aceroD); px(0, L(19) + y, 2, 1, aceroL); px(22, L(19) + y, 2, 1, tone(aceroD, 0.7)); } px(10, L(19) - 2, 4, 2, oro); ox = 12; oy = 3; punta = L(22); }
    else if (a === 'garrote') { c = lienzo(18, L(25)); const { px } = pintor(c); for (let y = 0; y < L(24); y++) { const ww = lerp(5, 13, Math.pow(y / L(24), 2)); px(9 - ww / 2, y, ww, 1, y > L(15) ? maderaD : madera); px(9 - ww / 2, y, 1, 1, maderaL); } for (let i = 0; i < 6; i++) px(4 + (i * 5) % 10, L(16) + i * 3, 2, 2, aceroD); ox = 9; oy = 3; punta = L(22); }
    else { c = lienzo(1, 1); punta = 4; }   // cestus / garras: el puño ya está en el antebrazo
    return { c, ox, oy, punta };
  })();
  // ---- escudo ----
  out.escudo = (() => {
    if (spec.escudo === 'grande') {   // scutum: curvo, del color del equipo, con umbo y rayos
      const sh = P.chest + P.abd + 6, sw = Math.max(12, R2(P.shoulder * 0.46)), c = lienzo(sw, sh), { px } = pintor(c);
      px(0, 0, sw, sh, '#4a2e14');
      for (let i = 2; i < sh - 2; i++) for (let x = 2; x < sw - 2; x++) { const curva = (x - sw / 2) / (sw / 2); px(x, i, 1, 1, tone(tun, 1.15 - curva * 0.35 - (i > sh / 2 ? 0.08 : 0))); }
      px(2, 2, sw - 4, 2, oro); px(2, sh - 4, sw - 4, 2, oro); px(2, 2, 2, sh - 4, oro);
      for (let k = 0; k < 4; k++) { px(sw / 2 - 1, 6 + k * 3, 2, 2, tone(oro, 0.9)); px(sw / 2 - 1, sh - 8 - k * 3, 2, 2, tone(oro, 0.9)); }   // rayos
      px(sw / 2 - 4, sh / 2 - 4, 8, 8, '#c8a640'); px(sw / 2 - 3, sh / 2 - 3, 5, 5, '#e8c85a'); px(sw / 2 - 2, sh / 2 - 2, 2, 2, '#fff1a0');   // umbo
      return { c, ox: sw / 2 - 2, oy: sh / 2 };
    }
    if (spec.escudo === 'chico') {   // parma redonda
      const rr = Math.max(8, R2(P.shoulder * 0.34)), d = rr * 2 + 1, c = lienzo(d, d), { px } = pintor(c);
      for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) { const dd = Math.hypot(x, y); if (dd > rr + 0.3) continue; px(rr + x, rr + y, 1, 1, dd > rr - 1.5 ? '#4a2e14' : dd > rr - 3 ? (Math.atan2(y, x) * 4 % 1 > 0.5 ? oro : tone(oro, 0.8)) : tone(tun, 1.12 - (x + y) / (rr * 4))); }
      px(rr - 3, rr - 3, 6, 6, '#c8a640'); px(rr - 2, rr - 2, 3, 3, '#fff1a0');
      return { c, ox: rr, oy: rr };
    }
    return null;
  })();
  return out;
}

/* =====================================================================
   CARAS: ojos y boca, sin nariz (decidido por Merlin)
   ===================================================================== */
const OJO = '#f4efe2', PUPILA = '#16100c';
function pintarCara(pz, spec, expr, parpadeo) {
  const base = pz.cabeza, cv = lienzo(base.c.width, base.c.height), g = cv.getContext('2d');
  g.drawImage(base.c, 0, 0);
  const { px } = pintor(cv), f = base.cara, P = pz.P, piel = spec.piel;
  const esq = !!P.skel, lob = !!P.wolf, gho = !!P.ghoul, gob = !!P.ears;
  const oy = f.ojoY, ox = f.ojoX, ox2 = f.ojoX2, by = f.bocaY, bx = f.hx + f.hw - 9;
  const ojoGrande = gob ? 1 : 0;
  const ceja = (x, y, inclin) => { for (let i = 0; i < 5; i++) px(x - 1 + i, y + R2(inclin * (i - 2) / 2), 1, 2, esq ? 'rgba(0,0,0,0)' : tone(piel, 0.45)); };
  // ojos: puntos negros (decidido por Merlin); cerrados = rayita; muerto = cruz
  const ojo = (x, y, tipo, chico) => {
    const d = chico ? 2 : 2 + ojoGrande;
    if (esq) { px(x - 1, y - 1, d + 3, d + 3, '#120c08'); if (tipo !== 'muerto' && tipo !== 'ko') px(x + 1, y + 1, 1, 1, tipo === 'furia' ? '#ff5a2a' : '#8fe0ff'); return; }
    if (lob) { px(x, y, 3, 2, tipo === 'muerto' ? '#3a3020' : '#ffd23a'); px(x + 2, y, 1, 2, PUPILA); return; }
    if (tipo === 'cerrado' || tipo === 'ko' || tipo === 'dolor') { px(x, y + 1, d + 1, 1, PUPILA); if (tipo === 'dolor') px(x + d, y, 1, 1, PUPILA); return; }
    if (tipo === 'muerto') { px(x, y, 1, 1, PUPILA); px(x + 2, y, 1, 1, PUPILA); px(x + 1, y + 1, 1, 1, PUPILA); px(x, y + 2, 1, 1, PUPILA); px(x + 2, y + 2, 1, 1, PUPILA); return; }
    const alto = tipo === 'miedo' ? d + 1 : tipo === 'cansado' ? 1 : d;
    px(x, y + (d - alto), d, alto, gho ? '#d8e04a' : PUPILA);
    if (!chico && tipo !== 'cansado' && !gho) px(x, y + (d - alto), 1, 1, '#5a4a40');   // brillito
  };
  // boca: formas curvas con dientes y lengua
  const D0 = '#3a0c0c', DI = '#f2efe0', LE = '#c24a4a', LB = tone(piel, 0.42);
  const forma = (x0, y0, filas, relleno) => { filas.forEach(([a, w], i) => px(x0 + a, y0 + i, w, 1, relleno(i, filas.length))); };
  const boca = (tipo) => {
    if (lob) {
      if (tipo === 'abierta' || tipo === 'grito' || tipo === 'furia') { px(f.hx + f.hw - 2, by - 1, 9, 4, '#2a0808'); for (let x = f.hx + f.hw - 1; x < f.hx + f.hw + 7; x += 2) { px(x, by - 1, 1, 2, DI); px(x, by + 2, 1, 1, DI); } }
      else px(f.hx + f.hw - 1, by + 1, 7, 1, LB);
      return;
    }
    if (esq) { for (let x = bx; x < bx + 8; x += 2) px(x, by, 1, tipo === 'grito' || tipo === 'furia' || tipo === 'abierta' ? 4 : 2, DI); if (tipo === 'grito' || tipo === 'furia' || tipo === 'abierta') px(bx, by + 1, 8, 2, '#2a2016'); return; }
    const x0 = bx;
    if (tipo === 'linea') { px(x0 + 1, by, 6, 1, LB); px(x0 + 7, by - 1, 1, 1, LB); }
    else if (tipo === 'sonrisa') { px(x0, by - 2, 1, 1, LB); px(x0 + 1, by - 1, 1, 1, LB); px(x0 + 2, by, 4, 1, LB); px(x0 + 6, by - 1, 1, 1, LB); px(x0 + 7, by - 2, 1, 1, LB); }
    else if (tipo === 'apretada') {   // dientes apretados, comisuras abajo
      forma(x0, by - 1, [[1, 6], [0, 8], [1, 6]], (i) => (i === 1 ? D0 : DI)); px(x0, by + 1, 1, 1, LB); px(x0 + 7, by + 1, 1, 1, LB);
    }
    else if (tipo === 'furia') {      // rugido: boca grande, dientes arriba y abajo, comisuras caídas
      forma(x0, by - 2, [[1, 6], [0, 8], [0, 8], [0, 8], [1, 6]], (i, n) => (i === 0 ? DI : i === n - 1 ? DI : i === n - 2 ? LE : D0));
      px(x0 - 1, by + 2, 1, 1, LB); px(x0 + 8, by + 2, 1, 1, LB);
    }
    else if (tipo === 'abierta') {    // dolor / sin aire: óvalo abierto con la lengua
      forma(x0 + 1, by - 2, [[1, 4], [0, 6], [0, 6], [1, 4]], (i, n) => (i === 0 ? DI : i === n - 1 ? LE : D0));
    }
    else if (tipo === 'o') { forma(x0 + 2, by - 2, [[1, 2], [0, 4], [1, 2]], () => D0); }
    else if (tipo === 'grito') {      // victoria: boca enorme hacia arriba
      forma(x0 - 1, by - 3, [[0, 10], [0, 10], [1, 8], [1, 8], [2, 6], [3, 4]], (i, n) => (i === 0 ? DI : i >= n - 2 ? LE : D0));
    }
    else if (tipo === 'flojo') { forma(x0 + 1, by - 1, [[0, 5], [1, 4], [2, 2]], (i) => (i === 2 ? LE : D0)); px(x0 + 4, by + 2, 2, 2, LE); }
    if (gho && tipo !== 'linea') { px(x0, by + 2, 2, 3, '#7a0a0a'); px(x0 + 6, by + 3, 1, 3, '#7a0a0a'); }
  };
  // expresiones
  const E = {
    neutral:  ['normal', 0, 'linea'],
    tenso:    ['furia', 2, 'apretada'],
    furia:    ['furia', 3, 'furia'],
    dolor:    ['dolor', -2, 'abierta'],
    cansado:  ['cansado', -1, 'abierta'],
    miedo:    ['miedo', -3, 'o'],
    ko:       ['ko', 0, 'abierta'],
    muerto:   ['muerto', 0, 'flojo'],
    victoria: ['normal', -2, 'grito'],
    comer:    ['furia', 2, 'furia'],
    contento: ['normal', -1, 'sonrisa'],
  }[expr] || ['normal', 0, 'linea'];
  let [ojoT, cejaK, bocaT] = E;
  if (parpadeo && ojoT === 'normal') ojoT = 'cerrado';
  ojo(ox - 2, oy, ojoT, false);
  if (ox2 > 0) ojo(ox2, oy, ojoT, true);
  if (!lob && !esq && Math.abs(cejaK) >= 2 && ojoT !== 'muerto' && ojoT !== 'ko') { ceja(ox, oy - 3, cejaK); if (ox2 > 0) ceja(ox2 + 1, oy - 3, cejaK); }
  boca(bocaT);
  return cv;
}

/* =====================================================================
   POSES (ángulos en radianes; positivo = hacia adelante)
   ===================================================================== */
const CLASE = { gladius: 'corta', daga: 'corta', lanza: 'lanza', martillo: 'pesada', garrote: 'pesada', cestus: 'puño', garras: 'puño', munon: 'puño' };
const BASE = { rx: 0, ry: 0, rr: 0, torso: 0.04, cabeza: 0, bH: 0.45, bC: 1.1, bW: 2.2, fH: 0.55, fC: 0.9, piBH: -0.12, piBK: 0.08, piFH: 0.16, piFK: 0.06, suelta: 0 };
const GUARDIA = {
  corta:  { bH: 0.75, bC: 0.85, bW: 0.75, fH: 0.5, fC: 1.0 },
  lanza:  { bH: 0.55, bC: 1.3, bW: -0.15, fH: 0.6, fC: 0.9 },
  pesada: { bH: 0.25, bC: 0.9, bW: 2.6, torso: 0.08 },
  puño:   { bH: 0.6, bC: 2.0, bW: 0, fH: 0.7, fC: 1.9 },
};
const CARGA = {
  corta:  { bH: -0.6, bC: 2.0, bW: 2.7, torso: -0.16, piFH: 0.32, piBH: -0.25, rx: -1 },
  lanza:  { bH: 0.15, bC: 2.15, bW: -0.75, torso: -0.18, fH: 0.9, fC: 0.6, rx: -2.5 },
  pesada: { bH: 3.0, bC: 1.05, bW: 0.5, torso: -0.24, cabeza: -0.18, piBH: -0.3, rx: -1 },
  puño:   { bH: 0.05, bC: 2.45, bW: 0, torso: -0.18, fH: 0.9, fC: 1.8, rx: -1 },
};
const GOLPE = {
  corta:  { bH: 1.6, bC: 0.05, bW: 0.0, torso: 0.26, piFH: 0.6, piFK: 0.22, piBH: -0.4, rx: 3, cabeza: 0.1 },
  lanza:  { bH: 1.52, bC: 0.0, bW: 0.05, torso: 0.28, fH: 1.3, fC: 0.2, piFH: 0.6, piBH: -0.45, rx: 5 },
  pesada: { bH: 0.7, bC: 0.12, bW: 0.25, torso: 0.42, cabeza: 0.2, piFH: 0.65, piFK: 0.4, piBH: -0.4, ry: 2.5, rx: 3 },
  puño:   { bH: 1.6, bC: 0.0, bW: 0, torso: 0.28, fH: 0.9, fC: 1.9, piFH: 0.5, piBH: -0.35, rx: 4 },
};
function poseDe(nombre, t, clase, P, cansado) {
  const p = { ...BASE, ...GUARDIA[clase] };
  const respira = Math.sin(t * (cansado ? 5 : 2.2)) * (cansado ? 1.8 : 1);
  if (nombre === 'quieto') { p.torso += 0.02 * respira + (cansado ? 0.12 : 0); p.bH += 0.03 * respira - (cansado ? 0.2 : 0); p.fH += 0.03 * respira; p.ry = -0.4 * Math.max(0, respira) + (cansado ? 1 : 0); p.cabeza = cansado ? 0.15 : 0.02 * Math.sin(t * 1.1); }
  else if (nombre === 'caminar') {
    const f = t * 9;
    p.piFH = 0.55 * Math.sin(f); p.piFK = 0.12 + 0.65 * Math.max(0, Math.sin(f - 1.3));
    p.piBH = -0.55 * Math.sin(f); p.piBK = 0.12 + 0.65 * Math.max(0, Math.sin(f + Math.PI - 1.3));
    p.ry = -Math.abs(Math.sin(f)) * 1.8 + 0.7;
    p.bH += 0.22 * Math.sin(f + Math.PI); p.fH += 0.22 * Math.sin(f); p.torso = 0.1 + 0.03 * Math.sin(f * 2); p.cabeza = -0.03 * Math.sin(f * 2);
  }
  else if (nombre === 'carga') Object.assign(p, CARGA[clase]);
  else if (nombre === 'golpe') Object.assign(p, GOLPE[clase]);
  else if (nombre === 'remate') { Object.assign(p, GOLPE[clase === 'lanza' ? 'lanza' : 'pesada']); p.torso = 0.6; p.bH = clase === 'lanza' ? 0.9 : 0.55 + 0.25 * Math.sin(t * 7); p.ry = 4; p.piFH = 0.85; p.piFK = 0.85; p.piBK = 0.6; }
  else if (nombre === 'bloqueo') { p.fH = 1.5; p.fC = 0.35; p.torso = -0.12; p.cabeza = -0.12; p.rx = -1.5; p.piBH = -0.3; p.piBK = 0.3; }
  else if (nombre === 'esquive') { p.rx = -7; p.torso = -0.45; p.cabeza = -0.3; p.piBH = -0.5; p.piBK = 0.65; p.piFH = 0.45; p.ry = 1.5; }
  else if (nombre === 'herido') { p.rx = -3.5; p.torso = -0.38; p.cabeza = -0.5; p.bH = 0.05; p.fH = 0.15; p.piFH = 0.35; p.piBK = 0.3; }
  else if (nombre === 'caido' || nombre === 'muerto') {
    p.rr = -Math.PI / 2 + 0.06; p.ry = P.thigh + P.shin - P.leg - 1; p.rx = 2;
    p.torso = 0; p.cabeza = nombre === 'muerto' ? -0.5 : -0.15 + 0.1 * Math.sin(t * 1.3);
    p.bH = nombre === 'muerto' ? 2.6 : 0.6 + 0.15 * Math.sin(t * 0.9); p.bC = 0.2; p.fH = nombre === 'muerto' ? -0.5 : 0.2; p.fC = 0.3;
    p.piFH = 0.25; p.piFK = nombre === 'muerto' ? 0 : 0.4 + 0.15 * Math.sin(t * 0.8); p.piBH = -0.05; p.piBK = 0.1;
    p.suelta = nombre === 'muerto' ? 1 : 0.6;
  }
  else if (nombre === 'arrastrarse') {   // sin una pierna: se arrastra con los brazos
    p.rr = -Math.PI / 2 + 0.25; p.ry = P.thigh + P.shin - P.leg - 3; p.rx = 2; p.cabeza = -0.35;
    p.bH = 2.2 + 0.5 * Math.sin(t * 3); p.bC = 0.5; p.fH = 2.2 + 0.5 * Math.sin(t * 3 + Math.PI); p.fC = 0.5; p.piFH = 0.2; p.piBH = 0.1; p.suelta = 1;
  }
  else if (nombre === 'rendido') {
    p.piFH = 1.45; p.piFK = 1.55; p.piBH = -0.15; p.piBK = 1.75; p.ry = P.thigh * 0.85; p.torso = -0.05;
    p.bH = 2.7 + 0.06 * respira; p.bC = 0.35; p.fH = 2.6 - 0.06 * respira; p.fC = 0.35; p.cabeza = 0.25 + 0.05 * Math.sin(t * 7); p.suelta = 1;
  }
  else if (nombre === 'comer') {
    p.piFH = 1.45; p.piFK = 1.55; p.piBH = -0.15; p.piBK = 1.75; p.ry = P.thigh * 0.85; p.rx = 3;
    p.torso = 0.75 + 0.06 * Math.sin(t * 9); p.cabeza = 0.45 + 0.15 * Math.sin(t * 9);
    p.bH = 1.0 + 0.45 * Math.sin(t * 8); p.bC = 0.5; p.fH = 1.0 + 0.45 * Math.sin(t * 8 + Math.PI); p.fC = 0.5;
  }
  else if (nombre === 'sentado') {
    p.piFH = 1.5; p.piFK = 1.45; p.piBH = 1.35; p.piBK = 1.4; p.ry = P.thigh * 0.95; p.torso = 0.08 + 0.02 * respira; p.cabeza = -0.05 + 0.08 * Math.sin(t * 0.7);
    p.bH = 0.5; p.bC = 0.9; p.fH = 0.7; p.fC = 0.7;
  }
  else if (nombre === 'victoria') { p.bH = 2.9 + 0.12 * Math.sin(t * 6); p.bC = 0.2; p.bW = 0.1; p.fH = 1.2 + 0.2 * Math.sin(t * 6 + 1); p.fC = 0.8; p.torso = -0.14; p.cabeza = -0.25; p.ry = -Math.abs(Math.sin(t * 6)) * 2.2; }
  return p;
}
// resortes por animación: k = rigidez, z = amortiguación (z < 1 rebota: le da peso a los golpes)
const RESORTE = {
  golpe: [1500, 0.55], remate: [900, 0.6], carga: [140, 0.9], herido: [900, 0.5], esquive: [500, 0.7], bloqueo: [600, 0.75],
  caido: [60, 0.85], muerto: [60, 0.9], arrastrarse: [80, 0.9], rendido: [45, 0.9], quieto: [120, 0.9], caminar: [300, 0.85],
  victoria: [140, 0.8], sentado: [70, 0.9], comer: [260, 0.8],
};
function exprDe(nombre, c, t) {
  if (nombre === 'muerto') return 'muerto';
  if (nombre === 'caido' || nombre === 'arrastrarse') return c.sangrado > 0.5 ? 'dolor' : 'ko';
  if (nombre === 'rendido') return 'miedo';
  if (nombre === 'carga' || nombre === 'golpe' || nombre === 'remate') return 'furia';
  if (nombre === 'herido') return 'dolor';
  if (nombre === 'bloqueo' || nombre === 'esquive') return 'tenso';
  if (nombre === 'victoria') return 'victoria';
  if (nombre === 'comer') return 'comer';
  if (c.cansado) return 'cansado';
  if (c.sangrado > 1 || c.malherido) return 'dolor';
  if (nombre === 'sentado') return (t % 9) < 2 ? 'contento' : 'neutral';
  return 'neutral';
}

/* =====================================================================
   GLADIADOR ANIMADO
   ===================================================================== */
function crear(spec) {
  const pz = piezas(spec), P = pz.P, P0 = pz.P0;
  const clase = CLASE[spec.arma] || 'corta';
  // calidad: el rig se dibuja E veces más grande (las piezas giran sin "dientes de sierra"); suave = bordes suavizados
  const Z = spec.hd ? 2 : 1;   // HD: las piezas de carne se pintan al doble (Scale2x) y la carne trabaja con ese detalle
  const E = Math.max(Z, spec.escala || 1), SUAVE = !!spec.suave, WE = W * E, HE = H * E;
  const c = lienzo(WE, HE), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const capa = lienzo(WE, HE), gc = capa.getContext('2d'); gc.imageSmoothingEnabled = SUAVE; gc.imageSmoothingQuality = 'high';   // figura sin contorno
  const sil = lienzo(WE, HE), gs = sil.getContext('2d');                                          // silueta para el contorno
  const pr = spec.protesis || {};
  const cuerpo = { miembros: { bA: pr.bA ? 'protesis' : 'ok', bE: pr.bE ? 'protesis' : 'ok', pA: pr.pA ? 'protesis' : 'ok', pB: pr.pB ? 'protesis' : 'ok' }, decap: false, sangrado: 0, cansado: false, malherido: false };
  const st = { nombre: 'quieto', t: 0, tt: 0, pose: { ...poseDe('quieto', 0, clase, P0) }, vel: {}, estela: [], estelaOn: false, armaSuelo: null, heridas: [], caras: new Map(), parpadeo: 0, proxParpadeo: 2 + Math.random() * 3 };
  for (const k in st.pose) st.vel[k] = 0;
  const raiz = { x: RAIZ_X, y: SUELO - (P.thigh + P.shin) };
  const rr = rnd(hash(spec.id || 'x'));
  const obj = {
    /* sinContorno: el contorno lo pone quien lo muestre (shader de la arena) */
    canvas: spec.sinContorno ? capa : c, escala: E, hd: Z, spec, clase, alto: P.total, ancho: W, altoLienzo: H, sueloFila: SUELO,
    anim(n) {
      if (n === st.nombre && n !== 'golpe' && n !== 'herido') return;
      // con una pierna menos no se para: se arrastra
      if ((n === 'caido') && (cuerpo.miembros.pA === 'cortado' || cuerpo.miembros.pB === 'cortado')) n = 'arrastrarse';
      if (n === 'herido') st.temblor = 1;
      st.nombre = n; st.t = 0; st.estelaOn = n === 'golpe' || n === 'remate'; if (!st.estelaOn) st.estela.length = 0;
    },
    get actual() { return st.nombre; },
    cuerpo(o) { Object.assign(cuerpo, o); if (o.miembros) cuerpo.miembros = { ...o.miembros }; },
    // marca una herida en la pieza: queda para toda la pelea
    herida(zona) {
      if (st.heridas.length > 26) st.heridas.shift();
      const pieza = zona === 'cabeza' ? 'cabeza' : zona === 'torso' || !zona ? (rr() < 0.75 ? 'torso' : 'falda') : zona === 'bA' ? (rr() < 0.5 ? 'brazoA' : 'antebrazoA') : zona === 'bE' ? (rr() < 0.5 ? 'brazoE' : 'antebrazoE') : zona === 'pA' ? (rr() < 0.5 ? 'musloA' : 'canillaA') : (rr() < 0.5 ? 'musloB' : 'canillaB');
      st.heridas.push({ pieza, u: rr(), v: rr(), r: 1 + R2(rr() * 2), gotea: rr() < 0.6 });
    },
    paso(dt) {
      st.t += dt; st.tt += dt;
      // parpadeo
      st.proxParpadeo -= dt; if (st.proxParpadeo <= 0) { st.parpadeo = 0.12; st.proxParpadeo = 2 + Math.random() * 4; } else st.parpadeo = Math.max(0, st.parpadeo - dt);
      const obj2 = poseDe(st.nombre, st.t, clase, P0, cuerpo.cansado);
      if (st.nombre === 'bloqueo' && !pz.escudo) { obj2.bH = 1.25; obj2.bC = 0.7; obj2.bW = 2.2; }
      if (cuerpo.miembros.bA === 'fractura') { obj2.bH = Math.min(obj2.bH, 0.4); obj2.bC = Math.min(obj2.bC, 0.6); }
      if (cuerpo.miembros.bE === 'fractura') { obj2.fH = 0.15; obj2.fC = 0.3; }
      // resortes (con subpasos para que no exploten)
      const [kk, z] = RESORTE[st.nombre] || [200, 0.85], amort = 2 * z * Math.sqrt(kk);
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = Math.min(dt, 0.25) / n;
      for (const key in obj2) {
        let x = st.pose[key], v = st.vel[key] || 0; const tg = obj2[key];
        if (key === 'rr' || key === 'suelta') { st.pose[key] = lerp(x, tg, Math.min(1, dt * 7)); continue; }
        for (let i = 0; i < n; i++) { v += (kk * (tg - x) - amort * v) * h; x += v * h; }
        st.pose[key] = x; st.vel[key] = v;
      }
      secundaria(dt);
      dibujar();
    },
  };
  // versión en alta de cada pieza con carne (mismas medidas × Z)
  const altas = new Map();
  const hi = (pc) => {
    if (Z === 1) return pc;
    if (!altas.has(pc)) {
      const o = { ...pc, c: escalar2x(pc.c), ox: pc.ox * Z, oy: (pc.oy || 0) * Z };
      if (pc.largo != null) o.largo = pc.largo * Z;
      if (pc.cara) { o.cara = {}; for (const k in pc.cara) o.cara[k] = pc.cara[k] * Z; }
      altas.set(pc, o);
    }
    return altas.get(pc);
  };
  const dibHi = (pc, x, y) => gc.drawImage(hi(pc).c, x, y, pc.c.width, pc.c.height);   // pieza sin carne, en alta si hay HD
  const cara = () => {
    const e = cuerpo.decap ? 'muerto' : exprDe(st.nombre, cuerpo, st.tt), k = e + (st.parpadeo > 0 ? 'p' : '');
    if (!st.caras.has(k)) { const cv = pintarCara(pz, spec, e, st.parpadeo > 0); st.caras.set(k, Z > 1 ? escalar2x(cv) : cv); }
    return st.caras.get(k);
  };

  /* =================================================================
     CARNE POR CAPAS (estilo FLESH): piel · músculo · venas/arterias/órganos · hueso
     Cada pieza tiene dos máscaras de daño por píxel: "corte" (va sacando capas)
     y "golpe" (moretones y huesos rotos). La pieza se recompone solo cuando cambia.
     ================================================================= */
  const carne = {};
  let pelar = 0;   // rayos X: 0 normal · 1 sin piel · 2 venas y órganos · 3 solo huesos
  const MIEMBRO_DE = { brazoA: 'bA', antebrazoA: 'bA', brazoE: 'bE', antebrazoE: 'bE', musloA: 'pA', canillaA: 'pA', musloB: 'pB', canillaB: 'pB' };
  const HIJO = { brazoA: 'antebrazoA', brazoE: 'antebrazoE', musloA: 'canillaA', musloB: 'canillaB' };
  function nuevaCarne(nombre, pc, tipo) {
    const w = pc.c.width, h = pc.c.height, d = pc.c.getContext('2d').getImageData(0, 0, w, h).data, n = w * h;
    const al = new Uint8Array(n), mus = new Int32Array(n).fill(-1), vas = new Int32Array(n).fill(-1), hue = new Int32Array(n).fill(-1), esArt = new Uint8Array(n);
    for (let i = 0; i < n; i++) al[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    const filas = []; for (let y = 0; y < h; y++) { let x0 = -1, x1 = -1; for (let x = 0; x < w; x++) if (al[y * w + x]) { if (x0 < 0) x0 = x; x1 = x; } filas.push([x0, x1]); }
    const set = (arr, x, y, col) => { if (x >= 0 && x < w && y >= 0 && y < h && al[y * w + x]) arr[y * w + x] = col; };
    const largo = pc.largo || h;
    for (let y = 0; y < h; y++) {
      const [x0, x1] = filas[y]; if (x0 < 0) continue;
      const wr = x1 - x0 + 1, c = (x0 + x1) / 2;
      for (let x = x0; x <= x1; x++) {
        // músculo: fibras a lo largo del miembro, luz a la izquierda
        const f = ((x - x0) + (y >> 1)) % 3, borde = x - x0 < Z ? 1 : x1 - x < Z ? 2 : 0;
        set(mus, x, y, borde === 1 ? C_MUS_L : borde === 2 ? C_MUS_D : f === 0 ? C_MUS_D : f === 1 ? C_MUS : C_MUS_M);
      }
      if (tipo === 'miembro') {
        if (y < largo) {
          const bw = Math.max(2 * Z, R2(wr * 0.38)) + (y < 3 * Z || y > largo - 4 * Z ? 2 * Z : 0);   // hueso con cabezas en las puntas
          const bx = R2(c - bw / 2);
          for (let x = bx; x < bx + bw; x++) set(hue, x, y, x - bx < Z ? C_HUE_L : bx + bw - 1 - x < Z ? C_HUE_D : (Math.abs(x - c) < Z * 0.6 && y > 3 * Z && y < largo - 4 * Z ? C_MED : C_HUE));
          for (let k = 0; k < Z; k++) { set(vas, R2(c + wr * 0.24 + Math.sin(y * 0.4 / Z) * 0.7 * Z) + k, y, C_ART); set(vas, R2(c - wr * 0.28 + Math.sin(y * 0.33 / Z + 2) * 0.7 * Z) - k, y, C_VEN); }
        } else { if (((y / Z) | 0) % 2 === 0) for (let x = x0 + Z; x < x1; x += 2 * Z) for (let k = 0; k < Z; k++) set(hue, x + k, y, C_HUE); }   // manos y pies: huesitos
      } else if (tipo === 'torso') {
        const pecho = P.chest * Z, H0 = h - 1, yy = y / Z, cc = R2(c);
        for (let x = cc - Z; x <= cc + Z; x++) set(hue, x, y, Math.abs(x - cc) < Z ? C_HUE : C_HUE_D);   // columna
        if (y < pecho) {
          const fr = (yy | 0) % 5, curva = R2(Math.abs(cc - 0) * 0);
          if (fr === 1 || fr === 2) for (let x = x0 + 2 * Z; x <= x1 - 2 * Z; x++) set(hue, x, y + R2(Math.abs(x - cc) * 0.12) - curva, fr === 1 ? C_HUE_L : C_HUE_D);   // costillas (un poco curvas)
          for (let x = x0 + 2 * Z; x <= x1 - 2 * Z; x++) if (hue[y * w + x] < 0 && vas[y * w + x] < 0) set(vas, x, y, ((((x / Z) | 0) + (yy | 0)) % 4 < 2) ? C_PUL : C_PUL_D);   // pulmones
          if (yy > 1 && yy < P.chest * 0.85) for (let k = 0; k < Z; k++) set(hue, cc + 4 * Z + k, y, C_HUE_L);   // esternón
        } else if (y < H0 - 5 * Z) {
          for (let x = x0 + 2 * Z; x <= x1 - 2 * Z; x++) if (hue[y * w + x] < 0) { const k = (Math.sin(x * 0.9 / Z) + Math.sin(yy * 1.1 + x * 0.3 / Z)) > 0.2; set(vas, x, y, k ? C_ORG : C_ORG_D); }   // tripas
        } else for (let x = x0 + 2 * Z; x <= x1 - 2 * Z; x++) set(hue, x, y, (((x / Z) | 0) + (yy | 0)) % 3 ? C_HUE : C_HUE_D);   // pelvis
        for (let k = 0; k < Z; k++) { set(vas, cc - 3 * Z - k, y, C_ART); set(vas, cc + 3 * Z + k, y, C_VEN); }   // aorta y cava
      } else if (tipo === 'cabeza') {
        const cf = pc.cara, cuelloY = cf.ht + cf.hh - 1;
        if (y < cuelloY) {   // calavera con cuencas y dientes
          for (let x = x0 + Z; x <= x1 - Z; x++) set(hue, x, y, x - x0 < 2 * Z ? C_HUE_L : x1 - x < 2 * Z ? C_HUE_D : C_HUE);
          if (Math.abs(y - cf.ojoY - Z) <= Z) { for (let x = cf.ojoX - 2 * Z; x < cf.ojoX + 2 * Z; x++) set(hue, x, y, C_CAV); for (let x = cf.ojoX2; x < cf.ojoX2 + 3 * Z; x++) set(hue, x, y, C_CAV); }
          if (y >= cf.bocaY && y < cf.bocaY + 2 * Z) for (let x = cf.hx + cf.hw - 10 * Z; x < cf.hx + cf.hw - Z; x++) set(hue, x, y, (((x / Z) | 0) % 2) ? C_DIENTE : C_CAV);
        } else {   // cuello: vértebras, carótida y yugular
          for (let x = R2(c) - Z; x <= R2(c) + Z; x++) set(hue, x, y, C_HUE);
          for (let k = 0; k < Z; k++) { set(vas, R2(c) + 3 * Z + k, y, C_ART); set(vas, R2(c) - 3 * Z - k, y, C_VEN); }
        }
      }
    }
    for (let i = 0; i < n; i++) esArt[i] = vas[i] === C_ART ? 1 : 0;
    return { nombre, pc, tipo, w, h, al, mus, vas, hue, esArt, corte: new Float32Array(n), golpe: new Float32Array(n), ver: 0, vista: null, vistaKey: '', osc: null, oscVer: -1, seccion: null, roto: null, chorros: [], venas: 0 };
  }
  const carneDe = (nombre, pc, tipo) => carne[nombre] || (carne[nombre] = nuevaCarne(nombre, pc, tipo));
  const pielData = new WeakMap();
  function componer(cn, piel) {
    const key = cn.ver + '|' + pelar + '|' + (piel === cn.pc.c ? 'b' : (piel.__id || (piel.__id = Math.random())));
    if (cn.vistaKey === key && cn.vista) return cn.vista;
    const { w, h, al, mus, vas, hue, corte, golpe } = cn;
    if (!pielData.has(piel)) pielData.set(piel, piel.getContext('2d').getImageData(0, 0, w, h));
    const src = pielData.get(piel).data, cv = cn.vista || lienzo(w, h), ctx = cv.getContext('2d'), out = ctx.createImageData(w, h), o = out.data;
    o.set(src);
    const put = (i, col) => { o[i * 4] = (col >> 16) & 255; o[i * 4 + 1] = (col >> 8) & 255; o[i * 4 + 2] = col & 255; o[i * 4 + 3] = 255; };
    const mezclar = (i, col, k) => { o[i * 4] += (((col >> 16) & 255) - o[i * 4]) * k; o[i * 4 + 1] += (((col >> 8) & 255) - o[i * 4 + 1]) * k; o[i * 4 + 2] += ((col & 255) - o[i * 4 + 2]) * k; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!al[i]) continue;
      const c = Math.max(corte[i], pelar === 1 ? F_T1 : pelar === 2 ? F_T2 : pelar === 3 ? F_T3 : 0), gg = golpe[i];
      if (pelar === 3 && hue[i] < 0) { o[i * 4 + 3] = corte[i] >= F_T3 ? 0 : 38; o[i * 4] = 60; o[i * 4 + 1] = 20; o[i * 4 + 2] = 20; continue; }
      if (pelar === 2 && vas[i] < 0 && hue[i] < 0 && corte[i] < F_T3) { put(i, C_MUS_P); o[i * 4 + 3] = 110; continue; }
      if (c < F_T1) {
        if (gg > 0.12) mezclar(i, gg > 0.7 ? C_MOR_D : C_MOR, Math.min(0.75, (gg - 0.12) * 1.1));   // moretón
        if (c > 0.08) mezclar(i, C_SANG_D, Math.min(0.8, (c - 0.08) * 5));                        // raspón / corte superficial
        continue;
      }
      // borde de la herida: piel levantada con sangre
      const bordeP = !pelar && ((x > 0 && corte[i - 1] < F_T1) || (x < w - 1 && corte[i + 1] < F_T1) || (y > 0 && corte[i - w] < F_T1) || (y < h - 1 && corte[i + w] < F_T1));
      if (c < F_T2) put(i, bordeP ? C_SANG_D : mus[i] >= 0 ? mus[i] : C_MUS);
      else if (c < F_T3) put(i, vas[i] >= 0 ? vas[i] : hue[i] >= 0 ? hue[i] : C_MUS_P);
      else if (hue[i] >= 0 && c < 1.35) put(i, gg > 1 ? C_HUE_R : hue[i] === C_CAV || hue[i] === C_DIENTE ? hue[i] : C_HUE_R2);
      else put(i, vas[i] >= 0 ? C_SANG_D : C_CAV);
      if (hue[i] >= 0 && gg > 1 && c >= F_T2 && (((x / Z) | 0) + ((y / Z) | 0)) % 3 === 0) put(i, C_GRIETA);   // hueso astillado
    }
    // la sangre chorrea hacia abajo desde las heridas abiertas
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!al[i] || corte[i] < F_T1) continue;
      if ((((x / Z | 0) * 7 + (y / Z | 0) * 13) % 5) !== 0 || x % Z) continue;
      for (let k = 1; k <= (1 + ((x * 3 + y) % 4)) * Z; k++) { const j = i + k * w; if (y + k >= h || !al[j] || corte[j] >= F_T1) break; put(j, ((k / Z) | 0) % 2 ? C_SANG_D : C_SANG); }
    }
    ctx.putImageData(out, 0, 0);
    cn.vista = cv; cn.vistaKey = key;
    return cv;
  }
  // lo que se dibuja de una pieza: la piel sana, o la pieza compuesta si tiene daño (y oscurecida si es del lado lejano)
  function imagen(nombre, pc, tipo, oscuro, piel) {
    const cn = carne[nombre]; piel = piel || pc.c;
    if (!cn || (cn.ver === 0 && !pelar)) return oscuro ? dk({ ...pc, c: piel }, true, piel).c : piel;
    const cv = componer(cn, piel);
    if (!oscuro) return cv;
    if (cn.oscVer !== cn.vistaKey || pelar) { cn.osc = cn.osc || lienzo(cv.width, cv.height); const x = cn.osc.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(20,10,5,0.24)'; x.fillRect(0, 0, cv.width, cv.height); cn.oscVer = cn.vistaKey; }
    return cn.osc;
  }
  let reg = [];   // dónde quedó dibujada cada pieza este cuadro (para saber qué se golpea)
  // dibuja una pieza en el transform actual. Con fractura se dobla en esa fila; con sección se corta ahí.
  // Deja el transform al final del hueso (para colgar la pieza siguiente) y devuelve si sigue entero.
  function pieza(nombre, pc, tipo, oscuro, piel) {
    if (Z === 1) return piezaZ(nombre, pc, tipo, oscuro, piel);
    gc.scale(1 / Z, 1 / Z); const r = piezaZ(nombre, hi(pc), tipo, oscuro, piel); gc.scale(Z, Z); return r;
  }
  function piezaZ(nombre, pc, tipo, oscuro, piel) {
    const cn = carneDe(nombre, pc, tipo), img = imagen(nombre, pc, tipo, oscuro, piel), w = img.width, h = img.height;
    const ox = pc.ox, oy = pc.oy || 0;
    if (tipo === 'cabeza' && cn.seccion != null) {   // decapitado: queda solo el cuello
      gc.drawImage(img, 0, cn.seccion, w, h - cn.seccion, -ox, -oy + cn.seccion, w, h - cn.seccion);
      reg.push({ nombre, cn, m: gc.getTransform(), ox, oy, y0: cn.seccion, y1: h, dy: 0 });
      return false;
    }
    const fin = cn.seccion != null ? cn.seccion : h;
    if (cn.roto != null && cn.roto < fin && tipo === 'miembro') {
      const r = cn.roto;
      gc.drawImage(img, 0, 0, w, r, -ox, -oy, w, r);
      reg.push({ nombre, cn, m: gc.getTransform(), ox, oy, y0: 0, y1: r, dy: 0 });
      gc.translate(0, r - oy); gc.rotate(cn.kink || 0.5);
      gc.drawImage(img, 0, r, w, fin - r, -ox, 0, w, fin - r);
      reg.push({ nombre, cn, m: gc.getTransform(), ox, oy: 0, y0: r, y1: fin, dy: r });
      gc.translate(0, (pc.largo || h) - r);
    } else {
      gc.drawImage(img, 0, 0, w, fin, -ox, -oy, w, fin);
      reg.push({ nombre, cn, m: gc.getTransform(), ox, oy, y0: 0, y1: fin, dy: 0 });
      if (tipo === 'miembro') gc.translate(0, pc.largo || h);
    }
    return cn.seccion == null;
  }
  // de coordenadas de la pieza al lienzo (usando cómo quedó dibujada este cuadro)
  function aCanvas(cn, px, py, def) {
    const ent = reg.filter((r) => r.cn === cn && py >= r.y0 - 1 && py <= r.y1).pop() || def || reg.filter((r) => r.cn === cn).pop();
    if (!ent) return null;
    const p = new DOMPoint(px - ent.ox, py - ent.oy - ent.dy).matrixTransform(ent.m);
    return { x: p.x, y: p.y, m: ent.m };
  }
  // un golpe en coordenadas de la pieza: estampa daño según el arma y avisa qué pasó
  function estampar(cn, lx, ly, tipo, I) {
    const { w, h, al, vas, hue, corte, golpe, esArt } = cn, rnd2 = Math.random;
    const antes = new Map(), sello = new Map();   // cada golpe deja su marca una sola vez por píxel (el máximo)
    const tocar = (x, y, dc, dg) => {
      x = R2(x); y = R2(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x; if (!al[i]) return;
      const v = sello.get(i); if (v) { v[0] = Math.max(v[0], dc); v[1] = Math.max(v[1], dg); } else sello.set(i, [dc, dg]);
    };
    const fila = (yy) => { let x0 = -1, x1 = -1; for (let x = 0; x < w; x++) if (al[yy * w + x]) { if (x0 < 0) x0 = x; x1 = x; } return [x0, x1]; };
    const [fx0, fx1] = fila(Math.max(0, Math.min(h - 1, ly))), ancho = Math.max(4, fx1 - fx0 + 1);
    const linea = (cx, cy, ang, largo, k, grosor = 1.7) => {
      grosor *= Z;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      for (let t = -largo; t <= largo; t += 0.5) for (let o = -grosor; o <= grosor; o += 0.5) {
        const q = 1 - Math.abs(o) / (grosor + 0.3), punta = 1 - Math.pow(Math.abs(t) / (largo + 1), 3);
        tocar(cx + dx * t - dy * o, cy + dy * t + dx * o, k * q * punta * (0.85 + rnd2() * 0.3), k * 0.15 * q);
      }
    };
    const disco = (cx, cy, r, kc, kg) => { r *= Z; for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) { const d = Math.hypot(x, y); if (d > r + 0.5) continue; const q = 1 - d / (r + 1); tocar(cx + x, cy + y, kc * q * (0.8 + rnd2() * 0.4), kg * q); } };
    const ang0 = (rnd2() - 0.5) * 0.9;   // los tajos cruzan el miembro de costado, un poco inclinados
    if (tipo === 'tajo') linea(lx, ly, ang0, ancho * 0.85, I * 0.7);
    else if (tipo === 'estocada') { disco(lx, ly, 3, I * 0.3, 0.1); disco(lx, ly, 1.6, I * 1.1, 0); }
    else if (tipo === 'contundente') {
      disco(lx, ly, 3.6, I * 0.28, I * 0.95);
      // el golpe seco llega al hueso aunque pegue de costado
      for (let y = ly - 2 * Z; y <= ly + 2 * Z; y++) for (let x = 0; x < w; x++) if (y >= 0 && y < h && hue[y * w + x] >= 0) tocar(x, y, 0, I * 0.6);
    }
    else if (tipo === 'garras') for (let k = -1; k <= 1; k++) linea(lx + k * 3 * Z * Math.cos(ang0 + 0.5), ly + k * Z * (3 * Math.sin(ang0 + 0.5) + 2), ang0 + 1.2, ancho * 0.5, I * 0.5, 0.9);
    else if (tipo === 'mordida') { for (let y = -3 * Z; y <= 3 * Z; y++) for (let x = -4 * Z; x <= 4 * Z; x++) { const d = (x * x) / (16 * Z * Z) + (y * y) / (9 * Z * Z); if (d <= 1) tocar(lx + x, ly + y, I * (d < 0.5 ? 0.8 : 0.45) * (0.85 + rnd2() * 0.3) + ((((x / Z) | 0) + ((y / Z) | 0)) % 2 ? 0 : I * 0.15), 0.1); } }
    for (const [i, [dc, dg]] of sello) { antes.set(i, corte[i]); corte[i] += dc; golpe[i] += dg; }
    cn.ver++;
    const res = { arteria: null, vena: false, fractura: false, seccion: null };
    for (const [i, c0] of antes) {
      if (vas[i] >= 0 && c0 < F_T2 && corte[i] >= F_T2) { if (esArt[i] && !res.arteria) res.arteria = { lx: i % w, ly: (i / w) | 0 }; else res.vena = true; }
    }
    if (res.arteria) cn.chorros.push({ lx: res.arteria.lx, ly: res.arteria.ly, fuerza: 1 });
    if (res.vena) cn.venas++;
    // fractura: casi todo el hueso de esa zona está roto
    if (cn.tipo === 'miembro' && cn.roto == null && !spec.motor) {   // en el juego las fracturas y cortes los decide el motor
      let nb = 0, rb = 0;
      for (let y = Math.max(0, ly - 2 * Z); y <= Math.min(h - 1, ly + 2 * Z); y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (hue[i] < 0) continue; nb++; if (golpe[i] > 0.9 || corte[i] >= F_T3 + 0.1) rb++; }
      if (nb > 0 && rb / nb > 0.5 && ly > 3 * Z && ly < (cn.pc.largo || h) - 3 * Z) { cn.roto = ly; cn.kink = (rnd2() < 0.5 ? -1 : 1) * (0.35 + rnd2() * 0.3); res.fractura = true; }
    }
    // sección: una fila cortada de lado a lado (miembros y cuello)
    if ((cn.tipo === 'miembro' || cn.tipo === 'cabeza') && !spec.motor) {
      const cuello = cn.tipo === 'cabeza' ? cn.pc.cara.ht + cn.pc.cara.hh - 1 : 0;
      for (let y = Math.max(cuello + 1, ly - 3 * Z); y <= Math.min(h - 2, ly + 3 * Z) && cn.seccion == null; y++) {
        if (cn.tipo === 'miembro' && y >= (cn.pc.largo || h) - 1) break;
        let n = 0, k = 0, hb = 0, hk = 0;
        for (let x = 0; x < w; x++) {
          const i = y * w + x; if (!al[i]) continue; n++;
          let c = corte[i]; for (let k = 1; k <= Z; k++) c = Math.max(c, y - k >= 0 ? corte[i - k * w] : 0, y + k < h ? corte[i + k * w] : 0);
          if (c >= F_T3 + 0.08) k++;
          if (hue[i] >= 0) { hb++; if (c >= F_T3 + 0.15 || golpe[i] > 1.6) hk++; }
        }
        if (n > 2 * Z && k / n >= 0.85 && (hb === 0 || hk / hb >= 0.95)) { cn.seccion = y; res.seccion = y; }
      }
    }
    return res;
  }
  // arma un lienzo con la parte que se desprende (de la fila de corte para abajo, y lo que cuelga de ahí)
  function trozoSuelto(e) {
    const cn = e.cn, pc = cn.pc, img = componer(cn, cn.tipo === 'cabeza' ? cara() : pc.c), w = img.width, h = img.height, s = cn.seccion;
    const c = lienzo(220 * Z, 280 * Z), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.translate(110 * Z, 40 * Z);
    if (cn.tipo === 'cabeza') { x.drawImage(img, 0, 0, w, s, -pc.ox, -s, w, s); }
    else {
      x.drawImage(img, 0, s, w, h - s, -pc.ox, 0, w, h - s);
      x.translate(0, (pc.largo || h) - s);
      const hijo = HIJO[cn.nombre];
      const ante = hijo ? hi(cn.nombre[0] === 'b' ? pz.antebrazo : pz.canilla) : null;
      if (ante) { const ch = carne[hijo]; x.drawImage(ch && ch.ver ? componer(ch, ante.c) : ante.c, -ante.ox, 0); x.translate(0, ante.largo); }
      const mano = cn.nombre.startsWith('antebrazo') || (hijo && hijo.startsWith('antebrazo'));
      x.scale(Z, Z);
      if (mano && cn.nombre.endsWith('A') && pz.arma.c.width > 1) { x.save(); x.translate(0, 2); x.rotate(-0.6); x.drawImage(pz.arma.c, -pz.arma.ox, -pz.arma.oy); x.restore(); }
      if (mano && cn.nombre.endsWith('E') && pz.escudo) x.drawImage(pz.escudo.c, -pz.escudo.ox, -pz.escudo.oy);
    }
    const org = aCanvas(cn, pc.ox, s, e);
    return { canvas: c, x: org.x, y: org.y, ang: Math.atan2(org.m.b, org.m.a), ax: 110 * Z, ay: 40 * Z, z: Z };
  }
  function golpear(x, y, tipo = 'tajo', fuerza = 1) {
    for (let k = reg.length - 1; k >= 0; k--) {
      const e = reg[k], inv = e.m.inverse(), q = new DOMPoint(x, y).matrixTransform(inv);
      const lx = R2(q.x + e.ox), yy = R2(q.y + e.oy + e.dy);
      if (lx < 0 || lx >= e.cn.w || yy < e.y0 || yy >= e.y1) continue;
      if (!e.cn.al[yy * e.cn.w + lx]) continue;
      st.temblor = 1;
      return aplicar(e, lx, yy, tipo, fuerza);
    }
    return null;
  }
  function aplicar(e, lx, ly, tipo, fuerza) {
    st.temblor = 1;
    const cn = e.cn, arm = spec.armadura === 'pesada' ? 0.55 : spec.armadura === 'ligera' ? 0.78 : 1;
    const res = estampar(cn, lx, ly, tipo, fuerza * (cn.tipo === 'cabeza' ? 1 : arm));
    res.pieza = cn.nombre; res.miembro = MIEMBRO_DE[cn.nombre] || (cn.tipo === 'cabeza' ? 'cabeza' : 'torso');
    res.punto = aCanvas(cn, lx, ly, e);
    if (res.seccion != null) {
      res.trozo = trozoSuelto(e);
      if (cn.tipo === 'cabeza') cuerpo.decap = true;
      else if (MIEMBRO_DE[cn.nombre]) cuerpo.miembros = { ...cuerpo.miembros, [MIEMBRO_DE[cn.nombre]]: 'cortado' };
    }
    return res;
  }
  // un golpe a una zona del cuerpo (para la pelea: el motor dice dónde, acá se elige el punto)
  function golpearZona(zona, tipo, fuerza) {
    const nombres = zona === 'cabeza' ? ['cabeza'] : zona === 'torso' ? ['torso'] : zona === 'bA' ? ['brazoA', 'antebrazoA'] : zona === 'bE' ? ['brazoE', 'antebrazoE'] : zona === 'pA' ? ['musloA', 'canillaA'] : zona === 'pB' ? ['musloB', 'canillaB'] : ['torso'];
    const cands = reg.filter((r) => nombres.includes(r.nombre));
    if (!cands.length) return null;
    const e = cands[(Math.random() * cands.length) | 0];
    for (let t = 0; t < 30; t++) { const lx = (Math.random() * e.cn.w) | 0, ly = e.y0 + ((Math.random() * (e.y1 - e.y0)) | 0); if (e.cn.al[ly * e.cn.w + lx]) return aplicar(e, lx, ly, tipo, fuerza); }
    return null;
  }
  // de dónde sale sangre a chorros ahora (arterias abiertas), en coordenadas del lienzo
  function chorros() {
    const out = [];
    for (const cn of Object.values(carne)) for (const ch of cn.chorros) {
      const p = aCanvas(cn, ch.lx, ch.ly); if (!p) continue;
      out.push({ x: p.x, y: p.y, dx: p.m.a * (ch.lx < cn.w / 2 ? -1 : 1), dy: p.m.b * (ch.lx < cn.w / 2 ? -1 : 1) });
    }
    for (const cn of Object.values(carne)) if (cn.seccion != null) {   // los muñones
      const yy = cn.tipo === 'cabeza' ? cn.seccion : cn.seccion - 1;
      const p = aCanvas(cn, cn.pc.ox, yy); if (!p) continue;
      const sg = cn.tipo === 'cabeza' ? -1 : 1;
      out.push({ x: p.x, y: p.y, dx: p.m.c * sg, dy: p.m.d * sg, munon: true });
    }
    return out;
  }
  // ---- herencia de la v2 (oscurecer piezas) ----
  const osc = new Map();
  const dk = (pc, on, key) => { if (!on) return pc; key = key || pc; if (!osc.has(key)) { const c2 = lienzo(pc.c.width, pc.c.height), x = c2.getContext('2d'); x.drawImage(pc.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(20,10,5,0.24)'; x.fillRect(0, 0, c2.width, c2.height); osc.set(key, { ...pc, c: c2 }); } return osc.get(key); };
  function pierna(x, cad, rod, oscura, m) {
    const A = m === 'pA' ? 'A' : 'B';
    gc.save(); gc.translate(x, 0); gc.rotate(-cad);
    if (pieza('muslo' + A, pz.muslo, 'miembro', oscura)) {
      gc.rotate(rod);
      if (cuerpo.miembros[m] === 'protesis') gc.drawImage(dk(pz.pata, oscura).c, -pz.pata.ox, 0);
      else pieza('canilla' + A, pz.canilla, 'miembro', oscura);
    }
    gc.restore();
  }
  function brazo(hx, hy, hom, codo, oscuro, m) {
    const conArma = m === 'bA', conEsc = m === 'bE', A = m === 'bA' ? 'A' : 'E';
    gc.save(); gc.translate(hx, hy); gc.rotate(-hom);
    let punta = null;
    if (pieza('brazo' + A, pz.brazo, 'miembro', oscuro)) {
      gc.rotate(-codo);
      const prot = cuerpo.miembros[m] === 'protesis';
      const sigue = prot ? (gc.drawImage(dk(pz.garfio, oscuro).c, -pz.garfio.ox, 0), gc.translate(0, pz.garfio.largo), true) : pieza('antebrazo' + A, pz.antebrazo, 'miembro', oscuro);
      const rotoA = carne['antebrazo' + A] && carne['antebrazo' + A].roto != null, rotoB = carne['brazo' + A] && carne['brazo' + A].roto != null;
      if (sigue && conArma && st.pose.suelta < 0.5 && !rotoA && !rotoB) {
        gc.translate(0, 2); gc.rotate(-st.pose.bW);
        dibHi(pz.arma, -pz.arma.ox, -pz.arma.oy);
        const mm = gc.getTransform(); punta = { x: mm.e + mm.c * pz.arma.punta, y: mm.f + mm.d * pz.arma.punta, gx: mm.e, gy: mm.f };
      }
      if (sigue && conEsc && pz.escudo && !rotoA) {
        gc.translate(0, -2); gc.rotate((hom + codo) * 0.88 - st.pose.torso);
        dibHi(pz.escudo, -pz.escudo.ox, -pz.escudo.oy);
      }
    }
    gc.restore();
    return punta;
  }
  // el motor del juego manda estados ('cortado', 'fractura'); si la carne no los tiene, se los marca
  const PIEZA_LEG = { bA: ['brazoA', hi(pz.brazo)], bE: ['brazoE', hi(pz.brazo)], pA: ['musloA', hi(pz.muslo)], pB: ['musloB', hi(pz.muslo)] };
  const PIEZA_FR = { bA: ['antebrazoA', hi(pz.antebrazo)], bE: ['antebrazoE', hi(pz.antebrazo)], pA: ['canillaA', hi(pz.canilla)], pB: ['canillaB', hi(pz.canilla)] };
  function legado() {
    for (const m in cuerpo.miembros) {
      const e = cuerpo.miembros[m];
      if (e === 'cortado') { const [n, pc] = PIEZA_LEG[m], cn = carneDe(n, pc, 'miembro'); if (cn.seccion == null) { const y = R2(pc.largo * 0.55); for (let x = 0; x < cn.w; x++) for (let k = -2 * Z; k <= Z; k++) if (y + k >= 0) cn.corte[(y + k) * cn.w + x] = 1.2; cn.seccion = y; cn.ver++; } }
      if (e === 'fractura') { const [n, pc] = PIEZA_FR[m], cn = carneDe(n, pc, 'miembro'); if (cn.roto == null) { cn.roto = R2(pc.largo * 0.5); cn.kink = m[0] === 'b' ? 0.7 : -0.55; for (let x = 0; x < cn.w; x++) cn.golpe[cn.roto * cn.w + x] = 0.9; cn.ver++; } }
    }
    if (cuerpo.decap) { const hc = hi(pz.cabeza), cn = carneDe('cabeza', hc, 'cabeza'); if (cn.seccion == null) { const y = hc.cara.ht + hc.cara.hh + Z; for (let x = 0; x < cn.w; x++) cn.corte[y * cn.w + x] = 1.2; cn.seccion = y; cn.ver++; } }
  }
  /* movimiento secundario: respiración, falda que se balancea, carne que tiembla con el golpe */
  Object.assign(st, { resp: 0, fase: Math.random() * 6, falda: 0, faldaV: 0, rxPrev: 0, temblor: 0 });
  function secundaria(dt) {
    const p = st.pose, quieto = ['muerto', 'caido', 'arrastrarse'].includes(st.nombre);
    st.fase += dt * (cuerpo.cansado ? 4.2 : st.nombre === 'quieto' ? 2 : 2.8);
    const amp = quieto ? (st.nombre === 'muerto' ? 0 : 0.35) : cuerpo.cansado ? 1.1 : 0.55;
    st.resp = lerp(st.resp, Math.sin(st.fase) * amp, Math.min(1, dt * 10));
    const vx = (p.rx - st.rxPrev) / Math.max(dt, 1e-3); st.rxPrev = p.rx;
    const meta = clamp(-vx * 0.06, -0.4, 0.4) + clamp((p.piFH + p.piBH) * 0.12, -0.25, 0.25) - p.rr * 0.5;
    st.faldaV += (140 * (meta - st.falda) - 7 * st.faldaV) * Math.min(dt, 0.05);   // resorte flojo: se pasa y vuelve
    st.falda = clamp(st.falda + st.faldaV * Math.min(dt, 0.05), -0.5, 0.5);
    st.temblor = Math.max(0, st.temblor - dt * 3.5);
  }
  obj.temblar = (k = 1) => { st.temblor = Math.max(st.temblor, k); };
  function dibujar() {
    const p = st.pose;
    const tY = -4 - st.resp * 0.7, tX = Math.sin(st.tt * 52) * st.temblor * 0.9;   // el pecho sube al respirar; la carne tiembla
    legado();
    reg = [];
    const bp = st.bb || [0, 0, WE, HE];   // solo se limpia y se contornea la zona donde está el muñeco (mucho más rápido)
    gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(bp[0], bp[1], bp[2] - bp[0], bp[3] - bp[1]); gc.setTransform(E, 0, 0, E, 0, 0);
    const cA = carne.brazoA, aA = carne.antebrazoA;
    const sinArma = (cA && (cA.seccion != null || cA.roto != null)) || (aA && (aA.seccion != null || aA.roto != null));
    if ((p.suelta >= 0.5 || sinArma) && spec.arma !== 'cestus' && spec.arma !== 'garras' && !(aA && aA.seccion != null) && !(cA && cA.seccion != null)) {
      if (!st.armaSuelo) st.armaSuelo = { x: raiz.x + (sinArma ? -18 : 28), rot: -Math.PI / 2 + 0.1 };
      gc.save(); gc.translate(st.armaSuelo.x, SUELO - 2); gc.rotate(st.armaSuelo.rot); dibHi(pz.arma, -pz.arma.ox, -pz.arma.c.width / 2); gc.restore();
    } else st.armaSuelo = null;
    gc.translate(R2((raiz.x + p.rx * K) * E) / E, R2((raiz.y + p.ry * K) * E) / E); gc.rotate(p.rr);
    const sep = Math.max(2, R2(P.hip / 2 - P.leg / 2));
    const T = pz.torso, hu = (P.hunch || 0);
    gc.save(); gc.translate(tX, tY); gc.rotate(p.torso);
    const punta = brazo(T.hombroX - 3 + hu, T.hombroY + 2, p.bH, p.bC, true, 'bA');
    gc.restore();
    pierna(-sep, p.piBH, p.piBK, true, 'pB');
    gc.save(); gc.translate(tX, tY); gc.rotate(p.torso);
    gc.save(); gc.translate(hu, 0); pieza('torso', T, 'torso', false); gc.restore();
    gc.save(); gc.translate(hu + 2, -T.alto + 2 + st.resp * 0.25); gc.rotate(p.cabeza + Math.sin(st.fase * 0.5) * 0.02 - tX * 0.02);
    pieza('cabeza', pz.cabeza, 'cabeza', false, cara());
    gc.restore();
    gc.restore();
    gc.save(); gc.translate(0, -6); gc.rotate(st.falda); dibHi(pz.falda, -pz.falda.ox, 0); gc.restore();
    pierna(sep, p.piFH, p.piFK, false, 'pA');
    gc.save(); gc.translate(tX, tY); gc.rotate(p.torso);
    brazo(-T.hombroX + 5 + hu, T.hombroY + 2, p.fH, p.fC, false, 'bE');
    gc.restore();
    gc.setTransform(1, 0, 0, 1, 0, 0);
    // caja de lo dibujado: piezas + punta del arma + arma en el suelo, con margen para escudo y armas largas
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const meter = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const e of reg) { const w = e.cn.w, a = -e.ox, b0 = e.y0 - e.oy - e.dy, b1 = e.y1 - e.oy - e.dy, m = e.m; for (const [px, py] of [[a, b0], [a + w, b0], [a, b1], [a + w, b1]]) meter(m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f); }
    if (punta) { meter(punta.x, punta.y); meter(punta.gx, punta.gy); }
    for (const q of st.estela) meter(q.x, q.y);
    if (st.armaSuelo) { meter((st.armaSuelo.x - 40) * E, (SUELO - 12) * E); meter((st.armaSuelo.x + 40) * E, (SUELO + 4) * E); }
    const mg = 34 * E, bb = reg.length ? [Math.max(0, Math.floor(x0 - mg)), Math.max(0, Math.floor(y0 - mg)), Math.min(WE, Math.ceil(x1 + mg)), Math.min(HE, Math.ceil(y1 + mg))] : [0, 0, WE, HE];
    const u = [Math.min(bb[0], bp[0]), Math.min(bb[1], bp[1]), Math.max(bb[2], bp[2]), Math.max(bb[3], bp[3])], uw = u[2] - u[0], uh = u[3] - u[1];
    st.bb = bb;
    if (spec.sinContorno) { estela(gc, punta); return; }
    const [bx, by] = bb, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    gs.globalCompositeOperation = 'source-over'; gs.clearRect(u[0], u[1], uw, uh); gs.drawImage(capa, bx, by, bw, bh, bx, by, bw, bh);
    gs.globalCompositeOperation = 'source-in'; gs.fillStyle = '#160f0a'; gs.fillRect(bx, by, bw, bh);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(u[0], u[1], uw, uh);
    const o = E;   // el contorno sigue siendo de 1 pixel del dibujo
    for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o], [o, o]]) g.drawImage(sil, bx, by, bw, bh, bx + ox, by + oy, bw, bh);
    g.drawImage(capa, bx, by, bw, bh, bx, by, bw, bh);
    estela(g, punta);
  }
  function estela(g, punta) {
    if (st.estelaOn && punta) { st.estela.push(punta); if (st.estela.length > 8) st.estela.shift(); }
    else if (st.estela.length) st.estela.shift();
    if (st.estela.length > 2) {
      g.save(); g.globalAlpha = 0.5; g.fillStyle = '#fff7d6';
      g.beginPath(); g.moveTo(st.estela[0].x, st.estela[0].y);
      for (const q of st.estela) g.lineTo(q.x, q.y);
      for (let i = st.estela.length - 1; i >= 0; i--) { const q = st.estela[i]; g.lineTo(lerp(q.gx, q.x, 0.55), lerp(q.gy, q.y, 0.55)); }
      g.closePath(); g.fill(); g.restore();
    }
  }
  // la herida de la v2 ahora es un tajito de verdad sobre la carne
  obj.herida = (zona, tipo = 'tajo', fuerza = 0.45) => golpearZona(zona === 'cabeza' ? 'cabeza' : zona || 'torso', tipo, fuerza);
  // resumen de lo que le pasó a cada pieza (lo que leería el motor de la pelea)
  function estado() {
    const out = {};
    for (const cn of Object.values(carne)) {
      let n = 0, piel = 0, mus = 0, prof = 0;
      for (let i = 0; i < cn.corte.length; i++) if (cn.al[i]) { n++; const c = cn.corte[i]; if (c >= F_T1) piel++; if (c >= F_T2) mus++; if (c >= F_T3) prof++; }
      out[cn.nombre] = { piel: piel / n, musculo: mus / n, hondo: prof / n, arterias: cn.chorros.length, venas: cn.venas, fractura: cn.roto != null, cortado: cn.seccion != null };
    }
    return out;
  }
  Object.defineProperty(obj, 'reg', { get: () => reg });
  Object.assign(obj, { golpear, golpearZona, chorros, estado, carne,
    rayos(n) { pelar = n | 0; dibujar(); },
    reiniciar() { for (const k in carne) delete carne[k]; cuerpo.miembros = { bA: pr.bA ? 'protesis' : 'ok', bE: pr.bE ? 'protesis' : 'ok', pA: pr.pA ? 'protesis' : 'ok', pB: pr.pB ? 'protesis' : 'ok' }; cuerpo.decap = false; st.armaSuelo = null; dibujar(); } });
  dibujar();
  return obj;
}

/* =====================================================================
   PARTES SUELTAS (miembros cortados y cabezas que vuelan)
   ===================================================================== */
function suelto(spec, parte) {
  const pz = piezas(spec), P = pz.P;
  const brazo = parte === 'bA' || parte === 'bE', cab = parte === 'cabeza';
  const c = lienzo(64 * K / 2 + 40, 64 * K / 2 + 40), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.translate(c.width / 2, 12);
  if (cab) {
    const cv = pintarCara(pz, spec, 'muerto', false); g.drawImage(cv, -pz.cabeza.ox, 0);
    g.fillStyle = SANGRE; g.fillRect(-P.arm * 0.5, pz.cabeza.oy - 2, P.arm, 3); g.fillStyle = HUESO; g.fillRect(-1, pz.cabeza.oy - 2, 2, 2);
  } else {
    const a = brazo ? pz.brazo : pz.muslo, b = brazo ? pz.antebrazo : pz.canilla, mitad = R2(a.largo * 0.5);
    g.fillStyle = SANGRE; g.fillRect(-a.ox, 0, a.c.width - 2, 3); g.fillStyle = HUESO; g.fillRect(-1, 0, 2, 2);
    g.drawImage(a.c, 0, mitad, a.c.width, a.c.height - mitad, -a.ox, 2, a.c.width, a.c.height - mitad);
    g.translate(0, a.largo - mitad + 2); g.rotate(brazo ? -0.5 : 0.3);
    g.drawImage(b.c, -b.ox, 0);
    if (parte === 'bA' && pz.arma.c.width > 1) { g.translate(0, b.largo + 2); g.rotate(-1.2); g.drawImage(pz.arma.c, -pz.arma.ox, -pz.arma.oy); }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // contorno
  const s = lienzo(c.width, c.height), gs = s.getContext('2d'); gs.drawImage(c, 0, 0); gs.globalCompositeOperation = 'source-in'; gs.fillStyle = '#160f0a'; gs.fillRect(0, 0, s.width, s.height);
  const o = lienzo(c.width, c.height), go = o.getContext('2d');
  go.drawImage(s, -1, 0); go.drawImage(s, 1, 0); go.drawImage(s, 0, -1); go.drawImage(s, 0, 1); go.drawImage(c, 0, 0);
  return o;
}

// retrato cuadrado (para fichas, tarjetas y el panel): el gladiador en guardia, recortado al cuerpo
const retratos = new Map();
function retrato(spec) {
  spec = { ...spec, hd: false, sinContorno: false, motor: false };
  const k = JSON.stringify(spec);
  if (retratos.has(k)) return retratos.get(k);
  const r = crear(spec); for (let i = 0; i < 6; i++) r.paso(0.2);
  const P = PROP[spec.raza] || PROP.humano, lado = R2(P.total * K * 1.12) + 12;
  const c = lienzo(lado, lado), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(r.canvas, R2(lado / 2 - RAIZ_X - 4), R2(lado - 4 - SUELO));
  retratos.set(k, c);
  return c;
}
// ícono de un objeto del mercado (arma, escudo o armadura)
const iconos = new Map();
function icono(tipo, id, color = '#b03a2e') {
  const kk = tipo + id + color; if (iconos.has(kk)) return iconos.get(kk);
  const N = 48, c = lienzo(N, N), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const spec = { id: 'icono', raza: 'humano', color, piel: '#c8956a', arma: tipo === 'arma' ? id : 'cestus', escudo: tipo === 'escudo' ? id : 'ninguno', armadura: tipo === 'armadura' ? id : 'ninguna' };
  const p = piezas(spec);
  const meter = (img, rot, max) => { const sc = Math.min(max, (N - 4) / Math.max(img.width, img.height) * (rot ? 1.3 : 1)); g.save(); g.translate(N / 2, N / 2); g.rotate(rot); g.scale(sc, sc); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore(); };
  if (tipo === 'arma') meter(id === 'cestus' ? p.antebrazo.c : p.arma.c, id === 'cestus' ? -Math.PI / 4 : Math.PI * 0.75, 1.2);
  else if (tipo === 'escudo') meter(p.escudo.c, 0, 1.5);
  else meter(p.torso.c, 0, 1.2);
  iconos.set(kk, c); return c;
}
function cara(spec, expr) { const pz = piezas(spec); return pintarCara(pz, spec, expr, false); }
root.Rig = { crear, retrato, icono, suelto, cara, EXPRESIONES: ['neutral', 'tenso', 'furia', 'dolor', 'cansado', 'miedo', 'ko', 'muerto', 'victoria', 'contento', 'comer'], W, H, SUELO, RAIZ_X, CLASE, K };
})(window);
