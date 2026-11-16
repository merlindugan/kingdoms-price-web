/* =====================================================================
   COLISEO · SPRITES DE GLADIADORES (pixel art generado por código)
   64x64, anatomía de ~7 cabezas de alto, sombreado con luz desde la izquierda.
   2 frames por gladiador: 0 = quieto/caminando, 1 = golpe.
   Cuando lleguen los sprites de Merlin se reemplaza frames() por la carga de sus
   PNG (misma interfaz: devuelve [canvas0, canvas1]).
   ===================================================================== */
(function (root) {
const W = 64, H = 64, Y0 = 62;   // Y0: fila de los pies
// proporciones en píxeles por raza (total = altura del cuerpo en px)
const PROP = {
  humano:  { total: 54, head: [6, 7], neck: 2, shoulder: 15, chest: 10, waist: 10, abd: 7, hip: 11, thigh: 12, shin: 13, leg: 4, upper: 9, fore: 9, arm: 3 },
  orco:    { total: 56, head: [7, 7], neck: 2, shoulder: 20, chest: 12, waist: 14, abd: 7, hip: 14, thigh: 12, shin: 12, leg: 6, upper: 10, fore: 10, arm: 5, jaw: true },
  gigante: { total: 58, head: [7, 7], neck: 3, shoulder: 24, chest: 13, waist: 17, abd: 7, hip: 17, thigh: 13, shin: 12, leg: 7, upper: 11, fore: 11, arm: 6, beard: true },
  goblin:  { total: 42, head: [8, 8], neck: 1, shoulder: 10, chest: 8, waist: 7, abd: 5, hip: 8, thigh: 8, shin: 9, leg: 3, upper: 7, fore: 7, arm: 2, ears: true, hunch: 2 },
  esqueleto: { total: 54, head: [6, 7], neck: 3, shoulder: 14, chest: 10, waist: 5, abd: 7, hip: 10, thigh: 12, shin: 13, leg: 2, upper: 9, fore: 9, arm: 2, skel: true },
  ghoul:   { total: 54, head: [6, 7], neck: 2, shoulder: 14, chest: 10, waist: 9, abd: 7, hip: 10, thigh: 12, shin: 13, leg: 3, upper: 10, fore: 10, arm: 3, hunch: 2, ghoul: true },
  loboT:   { total: 60, head: [8, 7], neck: 2, shoulder: 21, chest: 13, waist: 12, abd: 7, hip: 13, thigh: 13, shin: 13, leg: 6, upper: 11, fore: 11, arm: 5, hunch: 3, wolf: true },
};
const PELOS = ['#2a1a10', '#3d2615', '#5a3a1c', '#1a1a1a', '#7a4a20', '#8a7a6a', '#b07a3a'];

function hexA(hex) { const c = parseInt(hex.slice(1), 16); return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
function tone(hex, k) {
  const [r, g, b] = hexA(hex); const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function frames(spec) { return [dibujar(spec, 0), dibujar(spec, 1)]; }

function dibujar(spec, frame) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const P = PROP[spec.raza] || PROP.humano;
  const piel = spec.piel, tun = spec.color, sem = hash((spec.id || '') + spec.raza);
  const pelo = spec.raza === 'goblin' ? null : PELOS[sem % PELOS.length];
  const px = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // bloque sombreado: highlight a la izquierda, sombra a la derecha y abajo
  const vol = (x, y, w, h, base, k = 1) => {
    px(x, y, w, h, tone(base, 1 * k));
    if (w >= 3) { px(x, y, 1, h, tone(base, 1.18)); px(x + w - Math.max(1, Math.round(w * 0.3)), y, Math.max(1, Math.round(w * 0.3)), h, tone(base, 0.78 * k)); }
    if (h >= 4) px(x, y + h - 1, w, 1, tone(base, 0.72 * k));
  };
  const lean = frame ? 2 : 0;                  // en el golpe se inclina hacia adelante
  const hunch = P.hunch || 0;
  const cx = 23;
  const legTop = Y0 - P.thigh - P.shin + 1;
  const abdTop = legTop - P.abd;
  const chestTop = abdTop - P.chest;
  const neckTop = chestTop - P.neck;
  const headTop = neckTop - P.head[1] + 1;
  const tx = cx + lean;                         // eje del torso
  const arm = spec.armadura, pesada = arm === 'pesada', ligera = arm === 'ligera';

  /* ---------- piernas ---------- */
  const pierna = (x, back) => {
    const k = back ? 0.82 : 1;
    vol(x, legTop, P.leg, P.thigh, piel, k);                                   // muslo
    px(x + (back ? 0 : 1), legTop + P.thigh - 1, Math.max(1, P.leg - 1), 1, tone(piel, 1.12 * k));   // rodilla
    vol(x, legTop + P.thigh, P.leg, P.shin, piel, k);                          // canilla
    if (pesada) vol(x, legTop + P.thigh + 1, P.leg, P.shin - 3, '#9aa3ad', k); // grebas
    for (let y = Y0 - 4; y <= Y0 - 1; y += 2) px(x, y, P.leg, 1, tone('#5a3a20', k));   // tiras de la sandalia
    px(x, Y0, P.leg + 2, 1, tone('#3a2614', k));                               // suela
  };
  const sep = Math.max(1, Math.round(P.hip / 2 - P.leg));
  const lunge = frame ? 3 : 0;
  pierna(tx - P.leg - sep + 1 - lunge, true);
  pierna(tx + sep - 1 + lunge + Math.round(hunch / 2), false);

  /* ---------- brazo de atrás (el del arma) ---------- */
  const shY = chestTop + 1, shXback = tx - Math.round(P.shoulder / 2) + 1 + hunch;
  let mano;
  if (!frame) {
    // brazo bajo, codo flexionado, arma en alto
    vol(shXback - 1, shY, P.arm, P.upper, piel, 0.82);
    vol(shXback - 1, shY + P.upper - 1, P.arm, P.fore, piel, 0.82);
    mano = { x: shXback - 1 + Math.floor(P.arm / 2), y: shY + P.upper + P.fore - 2 };
    px(mano.x - 1, mano.y - 1, P.arm + 1, 2, tone(piel, 0.75));
  } else {
    // brazo extendido hacia adelante a la altura del hombro
    const ax = tx + 1 + hunch, ay = shY + 1;
    vol(ax, ay, P.upper + P.fore + 2, P.arm, piel, 0.95);
    px(ax + 3, ay, 3, 1, tone(piel, 1.15));                                    // bíceps
    mano = { x: ax + P.upper + P.fore + 2, y: ay + Math.floor(P.arm / 2) };
    px(mano.x - 1, mano.y - 1, 2, P.arm, tone(piel, 0.85));
  }

  /* ---------- torso ---------- */
  const filasTorso = P.chest + P.abd;
  for (let i = 0; i < filasTorso; i++) {
    const k = i < P.chest ? i / P.chest : 1;
    const wdt = Math.round(P.shoulder + (P.waist - P.shoulder) * Math.min(1, k * 1.1));
    const x = tx - Math.floor(wdt / 2) + Math.round(hunch * (1 - i / filasTorso));
    const y = chestTop + i;
    px(x, y, wdt, 1, tone(piel, 1));
    px(x, y, 1, 1, tone(piel, 1.2));
    px(x + wdt - Math.max(2, Math.round(wdt * 0.28)), y, Math.max(2, Math.round(wdt * 0.28)), 1, tone(piel, 0.76));
  }
  // anatomía: pectorales, abdominales, hombro
  if (!pesada && !ligera) {
    px(tx - Math.floor(P.shoulder / 2) + 2 + hunch, chestTop + Math.round(P.chest * 0.55), P.shoulder - 4, 1, tone(piel, 0.7));
    px(tx + hunch, chestTop + 2, 1, Math.round(P.chest * 0.5), tone(piel, 0.78));
    for (let y = abdTop + 1; y < abdTop + P.abd - 1; y += 2) { px(tx - 2, y, 1, 1, tone(piel, 0.72)); px(tx + 1, y, 1, 1, tone(piel, 0.72)); }
  }
  px(tx - Math.floor(P.shoulder / 2) + hunch, chestTop, 3, 2, tone(piel, 1.15));   // deltoides con luz

  // túnica / exomis del color del equipo: cruza el pecho en diagonal y cae como falda
  const faldaTop = abdTop + P.abd - 2, faldaH = Math.round(P.thigh * 0.55) + 2;
  const hw = Math.floor(P.hip / 2) + 1;
  for (let i = 0; i < faldaH; i++) {
    const wdt = P.hip + 2 + Math.round(i * 0.35);
    const x = tx - Math.floor(wdt / 2);
    px(x, faldaTop + i, wdt, 1, tone(tun, 1));
    px(x + wdt - 3, faldaTop + i, 3, 1, tone(tun, 0.72));
    if (i > 1) for (let fx = x + 2; fx < x + wdt - 2; fx += 3) px(fx, faldaTop + i, 1, 1, tone(tun, 0.8));   // pliegues
  }
  px(tx - Math.floor((P.hip + 2 + Math.round((faldaH - 1) * 0.35)) / 2), faldaTop + faldaH - 1, P.hip + 2 + Math.round((faldaH - 1) * 0.35), 1, tone(tun, 0.6));
  if (!pesada && !ligera) {   // la banda diagonal del exomis
    for (let i = 0; i < P.chest + P.abd - 1; i++) {
      const x = tx - Math.floor(P.shoulder / 2) + 1 + Math.round(i * (P.shoulder - 3) / (P.chest + P.abd)) + Math.round(hunch * (1 - i / filasTorso));
      px(x, chestTop + i, 3, 1, tone(tun, i % 3 ? 1 : 0.82));
    }
  }
  if (ligera) {   // coraza de cuero + pteruges
    for (let i = 0; i < P.chest + P.abd - 1; i++) {
      const k = i / (P.chest + P.abd); const wdt = Math.round(P.shoulder - 2 + (P.waist - P.shoulder) * Math.min(1, k * 1.1));
      const x = tx - Math.floor(wdt / 2) + Math.round(hunch * (1 - k));
      px(x, chestTop + 1 + i, wdt, 1, tone('#8a5a33', 1)); px(x + wdt - 2, chestTop + 1 + i, 2, 1, tone('#8a5a33', 0.7)); px(x, chestTop + 1 + i, 1, 1, tone('#8a5a33', 1.25));
    }
    px(tx - 2, chestTop + 3, 4, 1, tone('#8a5a33', 0.75));
    for (let x = tx - hw; x < tx + hw; x += 2) px(x, faldaTop - 1, 1, 4, '#6b4424');
  }
  if (pesada) {   // lorica segmentata
    for (let i = 0; i < P.chest + P.abd - 1; i++) {
      const k = i / (P.chest + P.abd); const wdt = Math.round(P.shoulder + (P.waist - P.shoulder) * Math.min(1, k * 1.1));
      const x = tx - Math.floor(wdt / 2) + Math.round(hunch * (1 - k));
      const band = i % 3 === 0 ? 0.7 : i % 3 === 1 ? 1.2 : 1;
      px(x, chestTop + i, wdt, 1, tone('#a7b0b9', band)); px(x + wdt - 2, chestTop + i, 2, 1, tone('#a7b0b9', 0.65));
    }
    px(tx - Math.floor(P.shoulder / 2) - 1 + hunch, chestTop - 1, 5, 3, tone('#c5ccd3', 1));   // hombrera
  }
  // cinturón
  px(tx - Math.floor(P.waist / 2) - 1, abdTop + P.abd - 2, P.waist + 2, 2, '#5a3a20');
  px(tx - 1, abdTop + P.abd - 2, 2, 2, '#d9b444');

  /* ---------- cabeza ---------- */
  const [hw2, hh] = P.head;
  const hx = tx - Math.floor(hw2 / 2) + 1 + hunch + (frame ? 1 : 0);
  px(tx - 1 + hunch, neckTop, 3, P.neck + 1, tone(piel, 0.8));                 // cuello
  vol(hx, headTop, hw2, hh, piel);
  if (P.jaw) { px(hx + 1, headTop + hh - 2, hw2, 2, tone(piel, 0.9)); px(hx + hw2, headTop + hh - 2, 1, 2, '#f2efe0'); px(hx + hw2 - 2, headTop + hh - 1, 1, 1, '#f2efe0'); }
  px(hx + hw2, headTop + Math.floor(hh * 0.45), 1, 2, tone(piel, 0.9));          // nariz
  px(hx + hw2 - 2, headTop + Math.floor(hh * 0.38), 1, 1, '#121212');           // ojo
  px(hx + hw2 - 3, headTop + Math.floor(hh * 0.38) - 1, 3, 1, tone(piel, 0.62)); // ceja
  px(hx + 1, headTop + Math.floor(hh * 0.4), 1, 2, tone(piel, 0.7));            // oreja
  if (P.ears) { px(hx - 3, headTop + 2, 3, 2, piel); px(hx - 5, headTop + 1, 2, 1, piel); px(hx - 4, headTop + 3, 2, 1, tone(piel, 0.7)); }
  if (spec.raza === 'goblin') { px(hx + hw2, headTop + 3, 2, 2, tone(piel, 0.85)); px(hx + 2, headTop + hh - 1, hw2 - 2, 1, '#2a1a10'); }
  if (P.beard) { px(hx + 1, headTop + hh - 3, hw2, 4, pelo); px(hx + hw2 - 1, headTop + hh - 3, 1, 1, tone(piel, 1)); }
  if (pesada) {   // galea con cresta del color del equipo y carrilleras
    px(hx - 1, headTop - 1, hw2 + 2, 3, tone('#a7b0b9', 1)); px(hx - 1, headTop - 1, hw2 + 2, 1, tone('#c5ccd3', 1.1));
    px(hx - 1, headTop + 2, 2, hh - 2, tone('#a7b0b9', 0.8)); px(hx + hw2 - 2, headTop + 2, 1, 3, tone('#a7b0b9', 0.9));
    px(hx, headTop - 3, hw2, 2, tone(tun, 1)); px(hx + 1, headTop - 4, hw2 - 2, 1, tone(tun, 1.15));
  } else if (ligera) {
    px(hx - 1, headTop - 1, hw2 + 1, 3, tone('#7a4a28', 1)); px(hx - 1, headTop - 1, hw2 + 1, 1, tone('#9a6a3a', 1));
  } else if (pelo) {
    px(hx - 1, headTop - 1, hw2 + 1, 2, pelo); px(hx - 1, headTop, 2, Math.floor(hh / 2) + 1, pelo);
  }

  /* ---------- arma (en la mano de atrás) ---------- */
  arma(px, spec.arma, frame, mano, P);

  /* ---------- brazo de adelante + escudo ---------- */
  const shXf = tx + Math.floor(P.shoulder / 2) - P.arm + hunch;
  if (spec.escudo === 'grande') {
    const sx = tx + Math.floor(P.shoulder / 2) - 2 + hunch - (frame ? 1 : 0), sy = chestTop - 1, sh = P.chest + P.abd + 6, sw = Math.max(6, Math.round(P.shoulder * 0.55));
    px(sx, sy, sw, sh, '#5a3a1a');
    for (let i = 1; i < sh - 1; i++) { px(sx + 1, sy + i, sw - 2, 1, tone(tun, i < sh / 2 ? 1 : 0.88)); }
    px(sx + 1, sy + 1, 1, sh - 2, tone(tun, 1.25)); px(sx + sw - 2, sy + 1, 1, sh - 2, tone(tun, 0.65));
    px(sx + 1, sy + 1, sw - 2, 1, '#d9b444'); px(sx + 1, sy + sh - 2, sw - 2, 1, '#d9b444');
    px(sx + Math.floor(sw / 2) - 1, sy + Math.floor(sh / 2) - 1, 3, 3, '#e8c85a'); px(sx + Math.floor(sw / 2), sy + Math.floor(sh / 2), 1, 1, '#fff1a0');
  } else if (spec.escudo === 'chico') {
    const r = Math.max(4, Math.round(P.shoulder * 0.33)), ccx = tx + Math.floor(P.shoulder / 2) + 1 + hunch - (frame ? 1 : 0), ccy = chestTop + Math.round(P.chest * 0.7);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y); if (d > r + 0.3) continue;
      px(ccx + x, ccy + y, 1, 1, d > r - 1 ? '#5a3a1a' : d > r - 2 ? '#d9b444' : tone(tun, x < 0 ? 1.15 : 0.85));
    }
    px(ccx - 1, ccy - 1, 2, 2, '#e8c85a');
  } else if (spec.arma !== 'cestus' || frame === 0) {
    // brazo libre, un poco adelantado
    vol(shXf + 1, shY, P.arm, P.upper, piel); vol(shXf + 2, shY + P.upper - 1, P.arm, P.fore, piel);
    if (spec.arma === 'cestus') px(shXf + 1, shY + P.upper + P.fore - 2, P.arm + 2, 3, '#6b4424');
  }
  contorno(g);
  return c;
}

function arma(px, a, frame, h, P) {
  const steel = '#cfd6dc', steelD = '#8d969e', steelL = '#f4f8fb', wood = '#7b5530', woodD = '#5a3a1c', gold = '#d9b444';
  const S = P.total / 54;                     // las armas escalan un poco con el cuerpo
  const L = (n) => Math.round(n * S);
  if (a === 'gladius') {
    if (!frame) { px(h.x, h.y - L(13), 2, L(12), steel); px(h.x, h.y - L(13), 1, L(12), steelL); px(h.x, h.y - L(14), 1, 1, steelL); px(h.x - 2, h.y - 1, 6, 1, gold); px(h.x, h.y, 2, 2, woodD); }
    else { const e = Math.min(L(12), 62 - h.x); px(h.x + 1, h.y - 1, e, 2, steel); px(h.x + 1, h.y - 1, e, 1, steelL); px(h.x + e + 1, h.y, 1, 1, steelL); px(h.x, h.y - 3, 1, 6, gold); }
  } else if (a === 'daga') {
    if (!frame) { px(h.x, h.y - L(7), 1, L(6), steelL); px(h.x + 1, h.y - L(7), 1, L(6), steelD); px(h.x - 1, h.y - 1, 4, 1, gold); }
    else { px(h.x + 1, h.y - 1, L(7), 1, steelL); px(h.x + 1, h.y, L(7), 1, steelD); px(h.x, h.y - 2, 1, 4, gold); }
  } else if (a === 'lanza') {
    if (!frame) { px(h.x, h.y - L(30), 2, L(36), wood); px(h.x, h.y - L(30), 1, L(36), '#9a7040'); px(h.x - 1, h.y - L(35), 4, 5, steel); px(h.x, h.y - L(37), 2, 2, steelL); }
    else { const e = Math.min(L(22), 62 - 7 - h.x); px(h.x - L(16), h.y - 1, e + L(16), 2, wood); px(h.x - L(16), h.y - 1, e + L(16), 1, '#9a7040'); px(h.x + e, h.y - 2, 5, 4, steel); px(h.x + e + 5, h.y - 1, 2, 2, steelL); }
  } else if (a === 'martillo') {
    if (!frame) { px(h.x, h.y - L(20), 2, L(22), wood); px(h.x - 4, h.y - L(25), 10, 6, steelD); px(h.x - 4, h.y - L(25), 10, 2, steel); px(h.x - 4, h.y - L(25), 1, 6, steelL); }
    else { const e = Math.min(L(9), 63 - 6 - h.x); px(h.x, h.y - 1, e, 2, wood); px(h.x + e, h.y - 5, 6, 10, steelD); px(h.x + e, h.y - 5, 2, 10, steel); px(h.x + e + 5, h.y - 5, 1, 10, '#5a6168'); }
  } else if (a === 'garrote') {
    if (!frame) { px(h.x, h.y - L(16), 3, L(18), wood); px(h.x - 1, h.y - L(22), 5, 7, woodD); px(h.x - 1, h.y - L(22), 2, 7, wood); px(h.x + 2, h.y - L(20), 1, 1, '#2a1a0c'); }
    else { const e = Math.min(L(8), 63 - 7 - h.x); px(h.x, h.y - 1, e, 3, wood); px(h.x + e, h.y - 3, 7, 6, woodD); px(h.x + e, h.y - 3, 7, 2, wood); }
  } else if (a === 'cestus') {
    px(h.x - 1, h.y - 1, 4, 4, '#6b4424'); px(h.x - 1, h.y - 1, 4, 1, '#8a5a33'); px(h.x + 2, h.y, 1, 1, '#c9ccd0');
  }
}
function contorno(g) {
  const d = g.getImageData(0, 0, W, H), p = d.data, out = new Uint8ClampedArray(p);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (p[i + 3]) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && p[(yy * W + xx) * 4 + 3]) { out[i] = 22; out[i + 1] = 15; out[i + 2] = 10; out[i + 3] = 255; break; } }
  }
  d.data.set(out); g.putImageData(d, 0, 0);
}
// altura del cuerpo en px (para escalar al tamaño real en el mundo)
const alturaPx = (raza) => (PROP[raza] || PROP.humano).total + 3;
root.Sprites = { frames, PROP, W, H, alturaPx };
})(window);
