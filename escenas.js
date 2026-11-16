/* =====================================================================
   COLISEO · ESCENAS EN PIXEL ART (generadas por código, 320x180)
   prisión (menú) · salón romano · calle (subasta) · callejón (evento)
   mercado (preparación) · enfermería (recuperación) · emperadores · carro
   ===================================================================== */
(function (root) {
const W = 320, H = 180;
const rnd = (seed) => { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

/* ---------- capas estáticas cacheadas ---------- */
const cache = {};
function capa(key, fn) {
  if (!cache[key]) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); cache[key] = c; }
  return cache[key];
}
function ladrillos(g, x0, y0, w, h, base, seed, bw = 16, bh = 8) {
  const r = rnd(seed); R(g, x0, y0, w, h, base);
  for (let y = y0; y < y0 + h; y += bh) for (let x = x0 + ((y / bh) % 2 ? -bw / 2 : 0); x < x0 + w; x += bw) {
    const k = 0.85 + r() * 0.3; g.fillStyle = shade(base, k); g.fillRect(Math.max(x0, x) + 1, y + 1, Math.min(bw - 1, x0 + w - Math.max(x0, x) - 1), bh - 1);
  }
}
function shade(hex, k) {
  const c = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + ((1 << 24) | (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255)).toString(16).slice(1);
}
function antorcha(g, x, y, t) {
  R(g, x, y, 2, 8, '#5a3a20'); R(g, x - 1, y - 1, 4, 2, '#3a2a1a');
  const f = Math.sin(t * 13 + x) * 1.2 + Math.sin(t * 7.3 + x * 2);
  R(g, x - 1, y - 5 + f * 0.3, 4, 4, '#ff9a2a'); R(g, x, y - 7 + f * 0.5, 2, 3, '#ffd45a');
  const gr = g.createRadialGradient(x + 1, y - 4, 1, x + 1, y - 4, 34 + f * 2);
  gr.addColorStop(0, 'rgba(255,160,60,0.28)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = gr; g.fillRect(x - 40, y - 44, 82, 82);
}

/* ---------- PRISIÓN (menú) ---------- */
function prision(g, t) {
  g.drawImage(capa('prision', (c) => {
    ladrillos(c, 0, 0, W, 140, '#3d3630', 11);
    R(c, 0, 140, W, 40, '#2a241f'); for (let x = 0; x < W; x += 20) R(c, x, 140, 1, 40, '#221d18');
    // ventana con rejas y luz de luna
    R(c, 140, 22, 40, 30, '#141a2a'); R(c, 150, 26, 6, 6, '#dfe6f0');
    for (let x = 142; x < 180; x += 7) R(c, x, 22, 2, 30, '#191512');
    // cadenas
    for (const cx of [60, 250]) { for (let y = 40; y < 100; y += 4) R(c, cx + ((y / 4) % 2), y, 2, 3, '#6b6e72'); R(c, cx - 3, 100, 8, 5, '#6b6e72'); }
    // paja
    const r = rnd(4); for (let i = 0; i < 120; i++) R(c, 70 + r() * 180, 150 + r() * 22, 4, 1, r() < 0.5 ? '#8a7440' : '#a48a50');
  }), 0, 0);
  // haz de luna
  g.fillStyle = 'rgba(180,200,255,0.06)'; g.beginPath(); g.moveTo(140, 52); g.lineTo(180, 52); g.lineTo(230, 160); g.lineTo(110, 160); g.fill();
  antorcha(g, 30, 70, t); antorcha(g, 288, 70, t);
  // rejas en primer plano
  for (let x = 0; x < W; x += 24) { R(g, x, 0, 4, H, '#1d1916'); R(g, x + 1, 0, 1, H, '#3a332d'); }
  R(g, 0, 8, W, 4, '#1d1916'); R(g, 0, 166, W, 4, '#1d1916');
}

/* ---------- SALÓN ROMANO ---------- */
function salon(g, t) {
  g.drawImage(capa('salon', (c) => {
    R(c, 0, 0, W, 120, '#b9a07a');
    for (let x = 0; x < W; x += 4) R(c, x, 0, 2, 120, '#b39a73');
    // cortinas rojas
    for (const x of [0, 280]) { R(c, x, 0, 40, 120, '#8e1b1b'); for (let i = 0; i < 40; i += 6) R(c, x + i, 0, 2, 120, '#6e1414'); }
    R(c, 0, 0, W, 10, '#6b4a2a'); R(c, 0, 10, W, 3, '#e0b44c');
    // trono
    R(c, 145, 50, 30, 50, '#7a1c1c'); R(c, 141, 46, 38, 6, '#e0b44c'); R(c, 150, 70, 20, 14, '#5a1414'); R(c, 145, 96, 30, 4, '#e0b44c');
    // águila / estandarte
    R(c, 156, 18, 8, 6, '#e0b44c'); R(c, 150, 20, 6, 2, '#e0b44c'); R(c, 164, 20, 6, 2, '#e0b44c'); R(c, 159, 24, 2, 20, '#8a6a2a');
    // columnas
    for (const x of [54, 104, 206, 256]) { R(c, x, 14, 14, 106, '#e8e0cf'); for (let i = 2; i < 14; i += 4) R(c, x + i, 18, 1, 100, '#c8bfaa'); R(c, x - 3, 12, 20, 5, '#d8cfbc'); R(c, x - 3, 116, 20, 5, '#d8cfbc'); }
    // piso de mármol
    for (let y = 120; y < H; y += 10) for (let x = 0; x < W; x += 20) R(c, x + ((y / 10) % 2) * 10, y, 10, 10, '#d9d0c0'), R(c, x + 10 - ((y / 10) % 2) * 10, y, 10, 10, '#a99c86');
    R(c, 0, 120, W, 2, '#7a6a52');
  }), 0, 0);
  antorcha(g, 46, 60, t); antorcha(g, 272, 60, t);
}

/* ---------- CALLE ROMANA (subasta) ---------- */
function calle(g, t) {
  g.drawImage(capa('calle', (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 90); sky.addColorStop(0, '#6aa7d8'); sky.addColorStop(1, '#bfe0f0'); c.fillStyle = sky; c.fillRect(0, 0, W, 90);
    // coliseo a lo lejos
    R(c, 220, 30, 90, 40, '#c9b08a'); for (let x = 224; x < 306; x += 9) { R(c, x, 36, 5, 8, '#8a7456'); R(c, x, 50, 5, 8, '#8a7456'); }
    // edificios (insulae)
    const r = rnd(9);
    let x = 0; while (x < W) { const w = 40 + Math.floor(r() * 30), h = 50 + Math.floor(r() * 35), col = ['#c98a54', '#d8a46a', '#b8784a', '#e0b88a'][Math.floor(r() * 4)];
      R(c, x, 110 - h, w, h, col); R(c, x - 2, 110 - h - 4, w + 4, 5, '#8e3b26');
      for (let wy = 110 - h + 8; wy < 98; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) R(c, wx, wy, 6, 8, '#3a2618');
      x += w + 2; }
    // toldos
    R(c, 30, 92, 40, 4, '#a32d2d'); for (let i = 30; i < 70; i += 8) R(c, i, 96, 4, 3, '#a32d2d');
    R(c, 190, 92, 40, 4, '#2d5aa3'); for (let i = 190; i < 230; i += 8) R(c, i, 96, 4, 3, '#2d5aa3');
    // vereda y calle de piedra
    R(c, 0, 110, W, 6, '#a8977a');
    R(c, 0, 116, W, 64, '#8a7a62');
    for (let y = 116; y < H; y += 6) for (let x2 = ((y / 6) % 2) * 5; x2 < W; x2 += 10) R(c, x2, y, 9, 5, shade('#8a7a62', 0.88 + r() * 0.25));
  }), 0, 0);
}
// carro de madera con jaula; lleva los sprites del lote
function carro(g, x, y, sprites, t) {
  const bob = Math.sin(t * 9) * 0.6;
  // caballo
  R(g, x + 84, y - 22 + bob, 22, 12, '#6a4428'); R(g, x + 102, y - 30 + bob, 8, 12, '#6a4428'); R(g, x + 106, y - 32 + bob, 6, 5, '#5a3820');
  for (const lx of [86, 100]) R(g, x + lx, y - 10 + bob, 3, 10 + Math.abs(Math.sin(t * 9 + lx)) * 1, '#4a2e18');
  R(g, x + 76, y - 18, 10, 2, '#3a2a1a');
  // plataforma
  R(g, x, y - 8, 80, 6, '#7b5530'); R(g, x, y - 8, 80, 1, '#9a7040');
  // gladiadores
  let px = x + 6;
  for (const s of sprites) { const sz = s.px; g.drawImage(s.c, px - sz * 0.25, y - 8 - sz + 1 + bob * 0.3, sz, sz); px += Math.max(16, sz * 0.42); }
  // jaula
  R(g, x, y - 52, 80, 3, '#5a3d22');
  for (let bx = x; bx <= x + 78; bx += 8) R(g, bx, y - 52, 2, 46, '#5a3d22');
  // ruedas
  for (const wx of [x + 12, x + 64]) { const a = t * 6; g.fillStyle = '#4a3018'; g.beginPath(); g.arc(wx, y, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7b5530'; g.beginPath(); g.arc(wx, y, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a3018'; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(wx, y); g.lineTo(wx + Math.cos(a + k * 1.57) * 6, y + Math.sin(a + k * 1.57) * 6); g.stroke(); } }
}

/* ---------- CALLEJÓN (evento) ---------- */
function callejon(g, t) {
  g.drawImage(capa('callejon', (c) => {
    R(c, 0, 0, W, H, '#151018');
    // fondo: fin del callejón con luz
    R(c, 130, 30, 60, 90, '#2a2236'); R(c, 145, 40, 30, 80, '#3a2c3e');
    // paredes en perspectiva
    for (let i = 0; i < 130; i++) { const k = i / 130; R(c, i, 30 * k, 1, H - 30 * k - 60 * k * 0, shade('#4a3a32', 0.5 + k * 0.6)); R(c, W - 1 - i, 30 * k, 1, H - 30 * k, shade('#4a3a32', 0.5 + k * 0.6)); }
    const r = rnd(5); for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; if (x > 128 && x < 192) continue; R(c, x, y, 6, 3, 'rgba(0,0,0,0.25)'); }
    // piso
    for (let y = 120; y < H; y++) { const k = (y - 120) / 60; R(c, 130 - 130 * k, y, 60 + 260 * k, 1, shade('#2c2622', 0.7 + 0.5 * k)); }
    // cajas y barril
    R(c, 30, 140, 30, 24, '#5a3d22'); R(c, 32, 142, 26, 1, '#7b5530'); R(c, 260, 136, 22, 30, '#5a3d22'); R(c, 262, 140, 18, 2, '#3a2814');
    // figura encapuchada
    R(c, 152, 92, 16, 28, '#1a1418'); R(c, 155, 84, 10, 10, '#1a1418'); R(c, 158, 89, 4, 2, '#d0a050');
  }), 0, 0);
  antorcha(g, 120, 70, t);
  // niebla
  g.fillStyle = `rgba(150,130,170,${0.05 + 0.02 * Math.sin(t)})`; g.fillRect(0, 130, W, 50);
}

/* ---------- MERCADO / ARMERÍA (preparación) ---------- */
function mercado(g, t) {
  g.drawImage(capa('mercado', (c) => {
    ladrillos(c, 0, 0, W, 130, '#6b4e36', 21, 20, 10);
    R(c, 0, 130, W, 50, '#4a3626'); for (let x = 0; x < W; x += 16) R(c, x, 130, 1, 50, '#3a2a1c');
    // estantes con armas
    R(c, 20, 30, 120, 4, '#3a2814'); R(c, 20, 70, 120, 4, '#3a2814');
    for (let i = 0; i < 6; i++) { R(c, 28 + i * 19, 6, 2, 24, '#cfd6dc'); R(c, 26 + i * 19, 26, 6, 2, '#c9a227'); }
    for (let i = 0; i < 4; i++) { const x = 30 + i * 28; R(c, x, 40, 18, 22, '#8a5a2b'); R(c, x + 3, 43, 12, 16, ['#a32d2d', '#2d5aa3', '#2f9e44', '#c9a227'][i]); }
    // lanzas y martillo
    for (let i = 0; i < 3; i++) { R(c, 170 + i * 8, 10, 2, 100, '#7b5530'); R(c, 169 + i * 8, 6, 4, 6, '#cfd6dc'); }
    R(c, 205, 20, 2, 60, '#7b5530'); R(c, 199, 16, 14, 10, '#8d969e');
    // armaduras en maniquí
    for (const x of [235, 275]) { R(c, x, 40, 20, 26, '#9aa3ad'); R(c, x + 4, 30, 12, 10, '#9aa3ad'); R(c, x + 9, 66, 2, 40, '#5a3d22'); R(c, x, 44, 20, 2, '#c5ccd3'); }
    // yunque
    R(c, 120, 140, 34, 8, '#3a3d40'); R(c, 128, 148, 18, 14, '#2a2c2e'); R(c, 112, 140, 10, 4, '#3a3d40');
  }), 0, 0);
  // fragua
  const f = Math.sin(t * 9) * 2;
  R(g, 60, 130, 40, 30, '#2a1a10'); R(g, 66, 136 + f * 0.3, 28, 12, '#ff7a2a'); R(g, 72, 134 + f * 0.5, 16, 6, '#ffd45a');
  const gr = g.createRadialGradient(80, 140, 2, 80, 140, 60); gr.addColorStop(0, 'rgba(255,140,50,0.25)'); gr.addColorStop(1, 'rgba(255,140,50,0)'); g.fillStyle = gr; g.fillRect(20, 80, 120, 100);
}

/* ---------- ENFERMERÍA (recuperación) ---------- */
function enfermeria(g, t) {
  g.drawImage(capa('enfermeria', (c) => {
    R(c, 0, 0, W, 130, '#c8b48e'); for (let x = 0; x < W; x += 40) R(c, x, 0, 2, 130, '#b09a74');
    R(c, 0, 130, W, 50, '#8a7656');
    // camas
    for (const x of [30, 120, 210]) { R(c, x, 120, 70, 14, '#7b5530'); R(c, x, 112, 70, 10, '#e8e0cf'); R(c, x + 2, 108, 14, 6, '#f2ece0'); R(c, x + 2, 134, 4, 12, '#5a3d22'); R(c, x + 64, 134, 4, 12, '#5a3d22'); }
    // estante con vasijas
    R(c, 40, 50, 240, 3, '#5a3d22');
    for (let i = 0; i < 12; i++) R(c, 46 + i * 19, 36 + (i % 3), 10, 14 - (i % 3), ['#8e5a3a', '#6a7a4a', '#b08a5a'][i % 3]);
    // ventana
    R(c, 140, 70, 40, 30, '#9cc8e8'); R(c, 159, 70, 2, 30, '#7b5530'); R(c, 140, 84, 40, 2, '#7b5530');
  }), 0, 0);
  g.fillStyle = `rgba(255,240,200,${0.05 + 0.02 * Math.sin(t * 0.7)})`; g.fillRect(120, 70, 80, 110);
}

/* ---------- ESTABLO (preparación) ---------- */
function establo(g, t) {
  g.drawImage(capa('establo', (c) => {
    // pared de tablones
    R(c, 0, 0, W, 125, '#6b4a2c');
    const r = rnd(3);
    for (let x = 0; x < W; x += 10) { R(c, x, 0, 9, 125, shade('#6b4a2c', 0.85 + r() * 0.3)); R(c, x + 9, 0, 1, 125, '#3a2614'); }
    R(c, 0, 28, W, 6, '#4a3018'); R(c, 0, 30, W, 1, '#7b5530');   // viga
    // boxes (cuadras)
    for (let x = 6; x < W; x += 52) { R(c, x, 60, 4, 70, '#4a3018'); R(c, x, 60, 44, 4, '#4a3018'); R(c, x + 2, 90, 44, 3, '#5a3a20'); }
    // ventanita con luz
    R(c, 150, 8, 20, 14, '#e8d090'); R(c, 159, 8, 2, 14, '#4a3018');
    // piso de tierra y paja
    R(c, 0, 125, W, 55, '#5a4228');
    for (let i = 0; i < 380; i++) R(c, r() * W, 125 + r() * 55, 3 + r() * 4, 1, r() < 0.5 ? '#c8a858' : '#a88a40');
    // fardos
    for (const x of [10, 280]) { R(c, x, 140, 30, 20, '#c8a858'); R(c, x, 146, 30, 1, '#8a7030'); R(c, x, 153, 30, 1, '#8a7030'); }
    // herramientas colgadas
    R(c, 60, 36, 2, 20, '#7b5530'); R(c, 56, 34, 10, 3, '#8d969e'); R(c, 250, 36, 2, 22, '#7b5530'); R(c, 247, 54, 8, 4, '#8d969e');
  }), 0, 0);
  g.fillStyle = `rgba(255,220,140,${0.07 + 0.02 * Math.sin(t)})`; g.beginPath(); g.moveTo(150, 22); g.lineTo(170, 22); g.lineTo(200, 125); g.lineTo(120, 125); g.fill();
}

/* ---------- ESCENARIO (post pelea: la plata del pueblo) ---------- */
function escenario(g, t) {
  g.drawImage(capa('escenario', (c) => {
    // tribunas llenas
    R(c, 0, 0, W, 110, '#3b2d20');
    const r = rnd(12), cols = ['#7a3a2c', '#a89f8c', '#4a5f7a', '#8a7440', '#6a4a6e', '#4f6a44'];
    for (let y = 4; y < 100; y += 9) for (let x = (y % 2) * 3; x < W; x += 6) { if (r() < 0.15) continue; R(c, x, y + 2, 4, 5, cols[Math.floor(r() * cols.length)]); R(c, x + 1, y, 2, 2, '#b58a68'); }
    // palco con toldo
    R(c, 110, 0, 100, 14, '#8e1b1b'); for (let x = 110; x < 210; x += 10) R(c, x, 14, 6, 4, '#8e1b1b');
    // muro de la arena
    R(c, 0, 100, W, 18, '#9c8566'); for (let x = 0; x < W; x += 24) R(c, x, 100, 1, 18, '#7a6650');
    R(c, 0, 118, W, 62, '#c9a46b');
    for (let i = 0; i < 600; i++) R(c, r() * W, 118 + r() * 62, 1, 1, '#b8915a');
    // tarima de madera
    R(c, 30, 128, 260, 14, '#7b5530'); R(c, 30, 128, 260, 2, '#9a7040'); for (let x = 30; x < 290; x += 26) R(c, x, 130, 1, 12, '#5a3d22');
    R(c, 30, 142, 260, 4, '#4a3018');
  }), 0, 0);
  // pétalos/monedas que caen
  for (let i = 0; i < 26; i++) { const x = (i * 53 + t * (14 + (i % 5) * 4)) % W, y = ((i * 37) + t * (22 + (i % 3) * 7)) % 130; R(g, x, y, 2, 2, i % 3 ? '#e0b44c' : '#c0c8d0'); }
}

/* ---------- sprites de emperador ---------- */
const empCache = {};
function emperador(color, piel = '#d8a27a') {
  const k = color + piel; if (empCache[k]) return empCache[k];
  const c = document.createElement('canvas'); c.width = 20; c.height = 30; const g = c.getContext('2d');
  R(g, 6, 8, 8, 18, '#efe9dc'); R(g, 5, 10, 10, 14, '#efe9dc');      // toga
  R(g, 6, 9, 2, 15, color); R(g, 8, 11, 2, 2, color); R(g, 10, 13, 2, 2, color); R(g, 12, 15, 2, 9, color);   // banda del color
  R(g, 7, 2, 6, 7, piel); R(g, 11, 4, 1, 1, '#111');                  // cabeza
  R(g, 6, 1, 8, 2, '#c9a227'); R(g, 5, 2, 2, 2, '#c9a227'); R(g, 13, 2, 2, 2, '#c9a227');   // laureles
  R(g, 4, 12, 2, 8, piel); R(g, 14, 12, 2, 8, piel);                  // brazos
  R(g, 7, 26, 2, 3, '#5a3d29'); R(g, 11, 26, 2, 3, '#5a3d29');        // sandalias
  // contorno
  const d = g.getImageData(0, 0, 20, 30), p = d.data, o = new Uint8ClampedArray(p);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 20; x++) { const i = (y * 20 + x) * 4; if (p[i + 3]) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < 20 && yy < 30 && p[(yy * 20 + xx) * 4 + 3]) { o[i] = 20; o[i + 1] = 14; o[i + 2] = 10; o[i + 3] = 255; } } }
  d.data.set(o); g.putImageData(d, 0, 0);
  return (empCache[k] = c);
}

/* ---------- motor de escena: dibuja en un canvas 320x180 escalado ---------- */
function montar(canvas, draw) {
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  let alive = true; const t0 = performance.now();
  function frame(now) { if (!alive || !canvas.isConnected) return; requestAnimationFrame(frame); const t = (now - t0) / 1000; g.clearRect(0, 0, W, H); try { draw(g, t); } catch (e) { console.error(e); } }
  requestAnimationFrame(frame);
  return () => { alive = false; };
}
root.Escenas = { W, H, prision, salon, calle, carro, callejon, mercado, enfermeria, establo, escenario, emperador, montar, R };
})(window);
