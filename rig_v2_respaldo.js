/* =====================================================================
   COLISEO · RIG 2D POR PARTES (cut-out) · versión 2
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
  const c = lienzo(W, H), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const capa = lienzo(W, H), gc = capa.getContext('2d'); gc.imageSmoothingEnabled = false;   // figura sin contorno
  const sil = lienzo(W, H), gs = sil.getContext('2d');                                          // silueta para el contorno
  const pr = spec.protesis || {};
  const cuerpo = { miembros: { bA: pr.bA ? 'protesis' : 'ok', bE: pr.bE ? 'protesis' : 'ok', pA: pr.pA ? 'protesis' : 'ok', pB: pr.pB ? 'protesis' : 'ok' }, decap: false, sangrado: 0, cansado: false, malherido: false };
  const st = { nombre: 'quieto', t: 0, tt: 0, pose: { ...poseDe('quieto', 0, clase, P0) }, vel: {}, estela: [], estelaOn: false, armaSuelo: null, heridas: [], caras: new Map(), parpadeo: 0, proxParpadeo: 2 + Math.random() * 3 };
  for (const k in st.pose) st.vel[k] = 0;
  const raiz = { x: RAIZ_X, y: SUELO - (P.thigh + P.shin) };
  const rr = rnd(hash(spec.id || 'x'));
  const obj = {
    canvas: c, spec, clase, alto: P.total, ancho: W, altoLienzo: H, sueloFila: SUELO,
    anim(n) {
      if (n === st.nombre && n !== 'golpe' && n !== 'herido') return;
      // con una pierna menos no se para: se arrastra
      if ((n === 'caido') && (cuerpo.miembros.pA === 'cortado' || cuerpo.miembros.pB === 'cortado')) n = 'arrastrarse';
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
      dibujar();
    },
  };
  const cara = () => {
    const e = cuerpo.decap ? 'muerto' : exprDe(st.nombre, cuerpo, st.tt), k = e + (st.parpadeo > 0 ? 'p' : '');
    if (!st.caras.has(k)) st.caras.set(k, pintarCara(pz, spec, e, st.parpadeo > 0));
    return st.caras.get(k);
  };
  // heridas pintadas encima de una pieza (en sus coordenadas locales)
  const heridasDe = (nombre, pc, ox, oy, lim, rect) => {
    for (const w of st.heridas) {
      if (w.pieza !== nombre) continue;
      const x = rect ? rect[0] + w.u * rect[2] : -ox + 2 + w.u * (pc.c.width - 4), y = rect ? rect[1] + w.v * rect[3] : -oy + 2 + w.v * Math.min(lim || pc.c.height, pc.c.height) * 0.85;
      if (spec.raza === 'esqueleto') { gc.fillStyle = '#5a4a32'; gc.fillRect(R2(x), R2(y), w.r + 1, 1); continue; }
      gc.fillStyle = SANGRE_D; gc.fillRect(R2(x) - 1, R2(y) - 1, w.r + 2, w.r + 1);
      gc.fillStyle = SANGRE; gc.fillRect(R2(x), R2(y), w.r, w.r);
      gc.fillStyle = SANGRE_L; gc.fillRect(R2(x), R2(y), 1, 1);
      if (w.gotea) { gc.fillStyle = SANGRE; gc.fillRect(R2(x) + 1, R2(y) + w.r, 1, 3 + w.r * 2); }
    }
  };
  // muñón: el corte con hueso a la vista
  const munon = (w) => { gc.fillStyle = SANGRE_D; gc.fillRect(-w / 2 - 1, -1, w + 2, 3); gc.fillStyle = SANGRE; gc.fillRect(-w / 2, -1, w, 2); gc.fillStyle = HUESO; gc.fillRect(-1, -1, 2, 2); if (cuerpo.sangrado > 0) { gc.fillStyle = SANGRE_L; gc.fillRect(-1, 1, 2, 2 + R2(Math.random() * 3)); } };
  // versión oscurecida de una pieza (lado lejano): se calcula una vez (los filtros de canvas son lentísimos)
  const osc = new Map();
  const dk = (pc, on) => { if (!on) return pc; if (!osc.has(pc)) { const c2 = lienzo(pc.c.width, pc.c.height), x = c2.getContext('2d'); x.drawImage(pc.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(20,10,5,0.24)'; x.fillRect(0, 0, c2.width, c2.height); osc.set(pc, { ...pc, c: c2 }); } return osc.get(pc); };
  const trozo = (pc, frac) => gc.drawImage(pc.c, 0, 0, pc.c.width, Math.max(1, R2(pc.largo * frac)), -pc.ox, 0, pc.c.width, Math.max(1, R2(pc.largo * frac)));
  // dibuja la parte baja de un miembro: con fractura se dobla raro a la mitad
  const quebrado = (pc, kink) => {
    const mid = R2(pc.largo * 0.5);
    gc.drawImage(pc.c, 0, 0, pc.c.width, mid, -pc.ox, 0, pc.c.width, mid);
    gc.save(); gc.translate(0, mid); gc.rotate(kink);
    gc.drawImage(pc.c, 0, mid, pc.c.width, pc.c.height - mid, -pc.ox, 0, pc.c.width, pc.c.height - mid);
    gc.fillStyle = '#5a3a6a'; gc.fillRect(-pc.ox + 1, -2, pc.c.width - 2, 3);   // moretón
    gc.fillStyle = HUESO; gc.fillRect(pc.c.width / 2 - pc.ox, -3, 2, 2);        // hueso asomando
    gc.restore();
  };
  function pierna(x, cad, rod, oscura, m) {
    const e = cuerpo.miembros[m], A = m === 'pA' ? 'A' : 'B';
    gc.save(); gc.translate(x, 0); gc.rotate(-cad);
    const mu = dk(pz.muslo, oscura), ca = dk(pz.canilla, oscura);
    if (e === 'cortado') { trozo(mu, 0.55); heridasDe('muslo' + A, mu, mu.ox, 0, mu.largo * 0.55); gc.translate(0, R2(mu.largo * 0.55)); munon(mu.c.width - 2); gc.restore(); return; }
    gc.drawImage(mu.c, -mu.ox, 0); heridasDe('muslo' + A, mu, mu.ox, 0);
    gc.translate(0, mu.largo); gc.rotate(rod);
    if (e === 'protesis') gc.drawImage(dk(pz.pata, oscura).c, -pz.pata.ox, 0);
    else if (e === 'fractura') quebrado(ca, -0.55);
    else { gc.drawImage(ca.c, -ca.ox, 0); heridasDe('canilla' + A, ca, ca.ox, 0); }
    gc.restore();
  }
  // brazo: devuelve la punta del arma (para la estela) o la matriz del escudo
  function brazo(hx, hy, hom, codo, oscuro, m) {
    const e = cuerpo.miembros[m], conArma = m === 'bA', conEsc = m === 'bE', A = m === 'bA' ? 'A' : 'E';
    gc.save(); gc.translate(hx, hy); gc.rotate(-hom);
    const br = dk(pz.brazo, oscuro);
    if (e === 'cortado') { trozo(br, 0.5); gc.translate(0, R2(br.largo * 0.5)); munon(br.c.width - 2); gc.restore(); return null; }
    gc.drawImage(br.c, -br.ox, 0); heridasDe('brazo' + A, br, br.ox, 0);
    gc.translate(0, br.largo); gc.rotate(-codo);
    const ante = dk(e === 'protesis' ? pz.garfio : pz.antebrazo, oscuro);
    if (e === 'fractura') quebrado(ante, 0.7); else { gc.drawImage(ante.c, -ante.ox, 0); if (e !== 'protesis') heridasDe('antebrazo' + A, ante, ante.ox, 0); }
    let punta = null;
    if (conArma && st.pose.suelta < 0.5 && e !== 'fractura') {
      gc.translate(0, ante.largo + 2); gc.rotate(-st.pose.bW);
      gc.drawImage(pz.arma.c, -pz.arma.ox, -pz.arma.oy);
      const mm = gc.getTransform(); punta = { x: mm.e + mm.c * pz.arma.punta, y: mm.f + mm.d * pz.arma.punta, gx: mm.e, gy: mm.f };
    }
    // el escudo va atado a la muñeca y tapa la mano, de frente (casi derecho, se inclina apenas con el brazo)
    if (conEsc && pz.escudo && e !== 'fractura') {
      gc.translate(0, ante.largo - 2); gc.rotate((hom + codo) * 0.88 - st.pose.torso);
      gc.drawImage(pz.escudo.c, -pz.escudo.ox, -pz.escudo.oy);
    }
    gc.restore();
    return punta;
  }
  function dibujar() {
    const p = st.pose;
    gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, W, H);
    // arma en el suelo (rendido / muerto / brazo cortado o quebrado)
    const sinArma = cuerpo.miembros.bA === 'cortado' || cuerpo.miembros.bA === 'fractura';
    if ((p.suelta >= 0.5 || sinArma) && spec.arma !== 'cestus' && spec.arma !== 'garras') {
      if (!st.armaSuelo) st.armaSuelo = { x: raiz.x + (sinArma ? -18 : 28), rot: -Math.PI / 2 + 0.1 };
      gc.save(); gc.translate(st.armaSuelo.x, SUELO - 2); gc.rotate(st.armaSuelo.rot); gc.drawImage(pz.arma.c, -pz.arma.ox, -pz.arma.c.width / 2); gc.restore();
    } else st.armaSuelo = null;
    gc.translate(R2(raiz.x + p.rx * K), R2(raiz.y + p.ry * K)); gc.rotate(p.rr);
    const sep = Math.max(2, R2(P.hip / 2 - P.leg / 2));
    const T = pz.torso, hu = (P.hunch || 0);
    // brazo lejano: el del arma (la hoja asoma por delante del escudo)
    gc.save(); gc.translate(0, -4); gc.rotate(p.torso);
    const punta = brazo(T.hombroX - 3 + hu, T.hombroY + 2, p.bH, p.bC, true, 'bA');
    gc.restore();
    pierna(-sep, p.piBH, p.piBK, true, 'pB');
    gc.save(); gc.translate(0, -4); gc.rotate(p.torso); gc.drawImage(T.c, -T.ox + hu, -T.oy); heridasDe('torso', T, T.ox - hu, T.oy);
    // cabeza (con cara) o el cuello cortado
    gc.save(); gc.translate(hu + 2, -T.alto + 2); gc.rotate(p.cabeza);
    if (cuerpo.decap) { munon(P.arm * 1.1); }
    else { const cv = cara(); gc.drawImage(cv, -pz.cabeza.ox, -pz.cabeza.oy); const cf = pz.cabeza.cara; heridasDe('cabeza', pz.cabeza, 0, 0, 0, [-pz.cabeza.ox + cf.hx + 1, -pz.cabeza.oy + cf.ht + 1, cf.hw - 4, cf.hh - 4]); }
    gc.restore();
    gc.restore();
    gc.drawImage(pz.falda.c, -pz.falda.ox, -6); heridasDe('falda', pz.falda, pz.falda.ox, 6);
    pierna(sep, p.piFH, p.piFK, false, 'pA');
    // brazo cercano: el del escudo (o la mano libre en guardia)
    gc.save(); gc.translate(0, -4); gc.rotate(p.torso);
    brazo(-T.hombroX + 5 + hu, T.hombroY + 2, p.fH, p.fC, false, 'bE');
    gc.restore();
    gc.setTransform(1, 0, 0, 1, 0, 0);
    // contorno oscuro (silueta corrida 1 px en 4 direcciones) + figura encima
    gs.globalCompositeOperation = 'source-over'; gs.clearRect(0, 0, W, H); gs.drawImage(capa, 0, 0);
    gs.globalCompositeOperation = 'source-in'; gs.fillStyle = '#160f0a'; gs.fillRect(0, 0, W, H);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.drawImage(sil, -1, 0); g.drawImage(sil, 1, 0); g.drawImage(sil, 0, -1); g.drawImage(sil, 0, 1); g.drawImage(sil, 1, 1);
    g.drawImage(capa, 0, 0);
    // estela del arma
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
