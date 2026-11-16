/* =====================================================================
   COLISEO · ARENA (Three.js): la pelea en tiempo real + resultados
   Arena.abrir(contenedor, cfg, alTerminar) — el jugador solo mira.
   ===================================================================== */
(function () {
const R = window.REGLAS, M = window.Motor, S = window.Sprites;
const $ = (q) => document.querySelector(q);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (html) e.innerHTML = html; return e; };
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/* =====================================================================
   THREE.JS: ESCENA
   ===================================================================== */
let renderer, scene, camera, cam = { th: 0.6, ph: 0.95, d: 30 };
let stage = null;
function canvasTex(w, h, fn, nearest) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; } return t;
}
let coliseoG = null, torreG = null, publicoG = null;
const gradaY = (st) => -1.4 + st * 0.6;
/* ---------- la torre de la pelea de campeones: plataforma sin bordes colgando de cadenas, sobre el vacío ---------- */
function crearTorre() {
  const G = new THREE.Group(), RT = R.CAMPEONES.radioTorre;
  const piedra = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8d8478'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < w; x += 64) { g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.12})`; g.fillRect(x, y, 62, 30); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, y, 62, 2); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(110,20,10,.18)'; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 2 + Math.random() * 4); }
  });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(RT, RT * 0.96, 0.8, 48), [new THREE.MeshLambertMaterial({ color: '#5e564c' }), new THREE.MeshLambertMaterial({ map: piedra }), new THREE.MeshLambertMaterial({ color: '#3e3830' })]);
  top.position.y = -0.4; G.add(top);
  // el borde se marca con piedras rotas (no protegen: se ve el vacío)
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + Math.random() * 0.1; const b = new THREE.Mesh(new THREE.BoxGeometry(0.4 + Math.random() * 0.5, 0.15 + Math.random() * 0.2, 0.35), new THREE.MeshLambertMaterial({ color: '#6a6157' })); b.position.set(Math.cos(a) * (RT - 0.2), 0.05, Math.sin(a) * (RT - 0.2)); b.rotation.y = -a; G.add(b); }
  // la torre se afina hacia abajo y se pierde en la niebla
  const col = new THREE.Mesh(new THREE.CylinderGeometry(RT * 0.9, 1.2, 30, 24, 1, true), new THREE.MeshLambertMaterial({ map: piedra, color: '#9a9080' }));
  col.position.y = -15.8; G.add(col);
  // cadenas: de cuatro puntos del borde hacia arriba
  const esl = new THREE.MeshLambertMaterial({ color: '#4a4a50' });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, x0 = Math.cos(a) * (RT - 0.3), z0 = Math.sin(a) * (RT - 0.3);
    for (let i = 0; i < 40; i++) {
      const t = i / 40, l = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 4, 8), esl);
      l.position.set(x0 * (1 + t * 0.6), 0.3 + t * 30, z0 * (1 + t * 0.6)); l.rotation.y = a + (i % 2 ? Math.PI / 2 : 0); l.rotation.z = Math.PI / 2; G.add(l);
    }
  }
  // gradas flotantes alrededor: ahí miran las escuadras (escalones en arco, colgados de sus propias cadenas)
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 - Math.PI / 4 + 0.14, len = Math.PI / 2 - 0.28;
    for (let st = 0; st < 3; st++) {
      const r = RT + 3.2 + st * 1.2, y = gradaY(st);
      const tapa = new THREE.Mesh(new THREE.RingGeometry(r, r + 1.2, 20, 1, a0, len), new THREE.MeshLambertMaterial({ color: st % 2 ? '#6b4a2c' : '#7d5735', side: THREE.DoubleSide }));
      tapa.rotation.x = Math.PI / 2; tapa.position.y = y; G.add(tapa);
      const frente = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 20, 1, true, Math.PI / 2 - a0 - len, len), new THREE.MeshLambertMaterial({ color: '#4a321e', side: THREE.DoubleSide }));
      frente.position.y = y - 0.3; G.add(frente);
    }
  }
  // nubes / niebla abajo
  const nube = new THREE.Mesh(new THREE.CircleGeometry(120, 32), new THREE.MeshBasicMaterial({ color: '#3a3044', transparent: true, opacity: 0.85 }));
  nube.rotation.x = -Math.PI / 2; nube.position.y = -26; G.add(nube);
  return G;
}
// el público de la torre: las escuadras sentadas en las gradas
function ponerPublico(cfg) {
  if (publicoG) { scene.remove(publicoG); publicoG = null; }
  if (!cfg.publico || !window.Rig) return;
  publicoG = new THREE.Group(); scene.add(publicoG);
  const RT = R.CAMPEONES.radioTorre, porGrada = [[], [], [], []];
  cfg.publico.forEach((p, i) => porGrada[i % 4].push(...p.glads.map((sp) => ({ sp, color: p.color }))));
  porGrada.forEach((lista, k) => {
    const a0 = k * Math.PI / 2 - Math.PI / 4 + 0.2, a1 = a0 + Math.PI / 2 - 0.4;
    lista.slice(0, 18).forEach((it, j) => {
      const st = j % 3, n = Math.ceil(Math.min(18, lista.length) / 3), a = a0 + (a1 - a0) * ((Math.floor(j / 3) + 0.5) / Math.max(1, n));
      const rig = window.Rig.crear(it.sp); rig.anim('sentado'); for (let q = 0; q < 20; q++) rig.paso(0.1);
      const tex = new THREE.CanvasTexture(rig.canvas); tex.magFilter = tex.minFilter = THREE.NearestFilter;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 }));
      const alto = (it.sp.altura || 1.75) * 0.95, k2 = alto / rig.alto;
      sp.scale.set(Rig.W * k2 * (Math.cos(a) > 0 ? -1 : 1), Rig.H * k2, 1); sp.center.set(Rig.RAIZ_X / Rig.W, (Rig.H - Rig.SUELO) / Rig.H);
      const r = RT + 3.75 + st * 1.2; sp.position.set(Math.cos(a) * r, gradaY(st), Math.sin(a) * r);
      publicoG.add(sp);
    });
  });
}
/* ---------- el coliseo por arriba: cielo, ático, toldo, puertas, estandartes, rayos de sol y polvo en el aire ---------- */
let fxG = null, decorT = null, puertasG = null;
/* ---------- ARENAS: el coliseo de historia (piedra, gradas marcadas, columnas, palco), el de entretenimiento (madera)
   y las mazmorras (arenas abandonadas en ruinas, una por monstruo). El público solo se ve con gráficos Altos ---------- */
let gHist = null, gCde = null, gMaz = {}, cieloMesh = null, pisoMat = null, muroMat = null, luzHemi = null, luzSol = null, brasas = null, publicoH = null, publicoC = null, escActual = '';
const TEX_MURO = {};
// arma gradas: anillos horizontales (pisadas) y verticales (escalones) con color por tramo, en una sola malla
function gradas() {
  const P = [], N = [], C = [], col = new THREE.Color();
  const push = (pts, n, hex, k = 1) => { col.set(hex).multiplyScalar(k); for (const i of [0, 1, 2, 0, 2, 3]) { P.push(...pts[i]); N.push(...n); C.push(col.r, col.g, col.b); } };
  const SEG = 180;
  return {
    pisada(r0, r1, y, colFn, salta) { for (let k = 0; k < SEG; k++) { if (salta && salta(k)) continue; const a0 = k / SEG * Math.PI * 2, a1 = (k + 1) / SEG * Math.PI * 2; push([[Math.cos(a0) * r0, y, Math.sin(a0) * r0], [Math.cos(a0) * r1, y, Math.sin(a0) * r1], [Math.cos(a1) * r1, y, Math.sin(a1) * r1], [Math.cos(a1) * r0, y, Math.sin(a1) * r0]], [0, 1, 0], colFn(k), 1); } },
    escalon(r, y0, y1, colFn, salta) { for (let k = 0; k < SEG; k++) { if (salta && salta(k)) continue; const a0 = k / SEG * Math.PI * 2, a1 = (k + 1) / SEG * Math.PI * 2, am = (a0 + a1) / 2; push([[Math.cos(a0) * r, y0, Math.sin(a0) * r], [Math.cos(a0) * r, y1, Math.sin(a0) * r], [Math.cos(a1) * r, y1, Math.sin(a1) * r], [Math.cos(a1) * r, y0, Math.sin(a1) * r]], [-Math.cos(am), 0, -Math.sin(am)], colFn(k), 0.8); } },
    malla() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); },
    SEG,
  };
}
// un muro con puertitas oscuras (vomitorios): por ahí entra y sale el público
const texVomitorio = (piedra, rep) => { const t = canvasTex(512, 64, (g, w, h) => { g.fillStyle = piedra; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < w; x += 24) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.fillRect(x, y, 23, 11); } g.fillStyle = '#140d08'; g.beginPath(); g.moveTo(232, h); g.lineTo(232, 26); g.arc(256, 26, 24, Math.PI, 0); g.lineTo(280, h); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 3); }); t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); return t; };
// público: gente sentada (torso y cabeza), en una malla instanciada
// público PINTADO (celulares): cada espectador es un dibujito plano en vez de dos cajas 3D. Un solo dibujo para todo el estadio
let texPublico = null;
function publicoPintado(asientos, par) {
  const n = asientos.length;
  if (!texPublico) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    const tun = ['#8a3a2c', '#c9bfa8', '#4a5f7a', '#9a8440', '#5a4434', '#6a4a6e', '#4f6a44', '#2e5bb0'], pieles = ['#f0caa4', '#d8a27a', '#b9825a', '#8e5a38', '#f0caa4', '#6a4028', '#d8a27a', '#b9825a'];
    for (let i = 0; i < 8; i++) {
      const x0 = i * 32;
      g.fillStyle = tun[i]; g.fillRect(x0 + 5, 28, 22, 36);                                  // torso
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 + 21, 28, 6, 36);                      // sombra del costado
      g.fillStyle = pieles[i]; g.fillRect(x0 + 10, 8, 12, 14);                              // cabeza
      g.fillStyle = i % 3 ? '#2e1c10' : '#6a4020'; g.fillRect(x0 + 10, 6, 12, 4);           // pelo
      if (i % 2) { g.fillStyle = pieles[i]; g.fillRect(x0 + 1, 14 + (i % 4) * 2, 4, 18); }    // un brazo arriba (alienta)
    }
    texPublico = new THREE.CanvasTexture(c); texPublico.magFilter = THREE.NearestFilter;
  }
  const geo = new THREE.PlaneGeometry(0.42, 0.84); geo.translate(0, 0.42, 0);
  const vari = new Float32Array(n); geo.setAttribute('iVar', new THREE.InstancedBufferAttribute(vari, 1));
  const mat = new THREE.MeshLambertMaterial({ map: texPublico, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute float iVar;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv.x = (vUv.x + iVar) / 8.0;'); };
  const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  asientos.forEach(([x, y, z, a], i) => {
    e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e); const k = 0.9 + Math.random() * 0.2;
    m4.compose(v.set(x, y + 0.02, z), q, sc.set(k, k, k)); im.setMatrixAt(i, m4); im.setColorAt(i, c.setScalar(0.82 + Math.random() * 0.25)); vari[i] = (Math.random() * 8) | 0;
  });
  const g = new THREE.Group(); g.add(im); par.add(g); g.userData.n = n; return g;
}
function crearPublico(asientos, par) {
  const n = asientos.length; if (!n) return null;
  if (AJ().celu()) return publicoPintado(asientos, par);
  const g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const torso = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.44, 0.26), new THREE.MeshLambertMaterial(), n), cab = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), new THREE.MeshLambertMaterial(), n);
  const tun = ['#8a3a2c', '#c9bfa8', '#4a5f7a', '#9a8440', '#5a4434', '#6a4a6e', '#4f6a44', '#b8a888', '#7a2a24', '#d8d0bc', '#2e5bb0', '#c0392b'], pieles = ['#f0caa4', '#d8a27a', '#b9825a', '#8e5a38', '#6a4028', '#4a2c1c'];
  asientos.forEach(([x, y, z, a], i) => {
    e.set(0, -a + Math.PI / 2, (Math.random() - 0.5) * 0.12); q.setFromEuler(e);
    m4.compose(v.set(x, y + 0.26, z), q, s); torso.setMatrixAt(i, m4); torso.setColorAt(i, c.set(tun[(Math.random() * tun.length) | 0]).multiplyScalar(0.8 + Math.random() * 0.3));
    m4.compose(v.set(x, y + 0.6, z), q, s); cab.setMatrixAt(i, m4); cab.setColorAt(i, c.set(pieles[(Math.random() * pieles.length) | 0]));
  });
  g.add(torso, cab); par.add(g); g.userData.n = n; return g;
}
// el coliseo de historia
function crearHistoria(RA) {
  const g = new THREE.Group(), G2 = gradas(), A = G2.SEG, asientos = [];
  const pasillo = (k) => k % 12 === 0;                                   // escaleras cada 24°
  const palco = (k) => { const a = (k + 0.5) / A * Math.PI * 2, ap = Math.PI / 2 + Math.PI / 6; return Math.abs(Math.atan2(Math.sin(a - ap), Math.cos(a - ap))) < 0.13; };
  const muros = [];
  // parapeto de mármol arriba del podio
  G2.escalon(RA + 0.55, 2.6, 3.0, () => '#e6dcc6'); G2.pisada(RA + 0.5, RA + 0.6, 3.0, () => '#f0e8d6');
  let r = RA + 0.6, y = 3.0;
  for (let i = 0; i < 3; i++) {
    if (i > 0) { muros.push([r, y, y + 0.8]); y += 0.8; }                // muro entre pisos, con vomitorios
    G2.pisada(r, r + 0.4, y, (k) => (pasillo(k) ? '#9a8466' : '#b8a27e')); r += 0.4;   // pasillo
    for (let s2 = 0; s2 < 4; s2++) {
      G2.escalon(r, y, y + 0.3, (k) => (pasillo(k) ? '#6e5a42' : '#8d7759'));
      y += 0.3;
      G2.pisada(r, r + 0.5, y, (k) => (pasillo(k) ? '#a08c6c' : (s2 % 2 ? '#c2ab88' : '#cfba98')));
      for (let k = 0; k < A; k++) { if (pasillo(k) || palco(k)) continue; for (const f of [0.25, 0.5, 0.75]) { if (Math.random() < 0.18) continue; const a = (k + f) / A * Math.PI * 2; asientos.push([Math.cos(a) * (r + 0.25), y, Math.sin(a) * (r + 0.25), a]); } }
      r += 0.5;
    }
  }
  const Rtop = r, Ytop = y;
  G2.pisada(Rtop, Rtop + 0.9, Ytop, () => '#b8a27e');                  // galería de arriba, con columnas
  g.add(G2.malla());
  const tv = texVomitorio('#a8916c', 15);
  for (const [rr, y0, y1] of muros) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, y1 - y0, 90, 1, true), new THREE.MeshLambertMaterial({ map: tv, side: THREE.BackSide })); m.position.y = (y0 + y1) / 2; g.add(m); }
  // columnata de la galería y su cornisa
  const NC = 60, col = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.19, 2.6, 8), new THREE.MeshLambertMaterial({ color: '#e2d6bc' }), NC), cap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.18, 0.46), new THREE.MeshLambertMaterial({ color: '#efe6d0' }), NC * 2), m4 = new THREE.Matrix4();
  for (let k = 0; k < NC; k++) { const a = k / NC * Math.PI * 2, x = Math.cos(a) * (Rtop + 0.45), z = Math.sin(a) * (Rtop + 0.45); m4.makeTranslation(x, Ytop + 1.3, z); col.setMatrixAt(k, m4); m4.makeTranslation(x, Ytop + 0.09, z); cap.setMatrixAt(k * 2, m4); m4.makeTranslation(x, Ytop + 2.65, z); cap.setMatrixAt(k * 2 + 1, m4); }
  g.add(col, cap);
  const corn = new THREE.Mesh(new THREE.CylinderGeometry(Rtop + 0.75, Rtop + 0.75, 0.35, 90, 1, true), new THREE.MeshLambertMaterial({ color: '#d8caa8', side: THREE.DoubleSide })); corn.position.y = Ytop + 2.92; g.add(corn);
  // el palco del emperador
  { const ap = Math.PI / 2 + Math.PI / 6, p = new THREE.Group(); p.position.set(Math.cos(ap) * (RA + 1.9), 0, Math.sin(ap) * (RA + 1.9)); p.rotation.y = -ap - Math.PI / 2; g.add(p);
    const b = (w, h, d, hex, x, y2, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex })); m.position.set(x, y2, z); p.add(m); return m; };
    b(4.2, 0.5, 2.8, '#efe6d0', 0, 3.25, 0); b(4.4, 0.18, 3.0, '#d4a52a', 0, 3.55, 0);
    for (const x of [-1.9, 1.9]) for (const z of [-1.2, 1.2]) b(0.3, 2.4, 0.3, '#f2ead8', x, 4.8, z);
    b(4.6, 0.3, 3.2, '#d4a52a', 0, 6.1, 0); b(4.2, 0.9, 2.8, '#8e1a12', 0, 6.65, 0);
    b(1.2, 1.4, 0.4, '#7a1a6a', 0, 4.2, -0.9); b(3.6, 1.6, 0.06, '#6a1a5a', 0, 2.2, 1.45); b(3.6, 0.12, 0.08, '#d4a52a', 0, 3.0, 1.47); }
  decorarColiseo(g, RA, Rtop + 1.0, Ytop);
  publicoH = crearPublico(asientos, g); if (publicoH) publicoH.visible = false;
  return g;
}
// el coliseo de entretenimiento: tribunas de madera, toldos de colores y banderines
function crearEntretenimiento(RA) {
  const g = new THREE.Group(), G2 = gradas(), A = G2.SEG, asientos = [], pasillo = (k) => k % 15 === 0;
  let r = RA + 0.6, y = 2.6;
  for (let i = 0; i < 2; i++) {
    G2.pisada(r, r + 0.35, y, (k) => (pasillo(k) ? '#5a3c22' : '#7a5230')); r += 0.35;
    for (let s2 = 0; s2 < 5; s2++) {
      G2.escalon(r, y, y + 0.32, (k) => (k % 2 ? '#5a3c22' : '#4e3420')); y += 0.32;
      G2.pisada(r, r + 0.45, y, (k) => (pasillo(k) ? '#6a4a2a' : (k % 3 ? '#8a6038' : '#946a40')));
      for (let k = 0; k < A; k++) { if (pasillo(k)) continue; for (const f of [0.3, 0.7]) { if (Math.random() < 0.3) continue; const a = (k + f) / A * Math.PI * 2; asientos.push([Math.cos(a) * (r + 0.22), y, Math.sin(a) * (r + 0.22), a]); } }
      r += 0.45;
    }
  }
  G2.escalon(r, y, y + 0.9, (k) => (k % 2 ? '#6a4a2a' : '#5a3c22'));   // baranda de atrás
  g.add(G2.malla());
  // postes, toldos rayados y banderines
  const NP = 24, post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1, 0.22), new THREE.MeshLambertMaterial({ color: '#4a3220' }), NP), m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let k = 0; k < NP; k++) { const a = k / NP * Math.PI * 2; m4.compose(v.set(Math.cos(a) * (r + 0.1), (y + 4.2) / 2, Math.sin(a) * (r + 0.1)), q.identity(), sc.set(1, y + 4.2, 1)); post.setMatrixAt(k, m4); }
  g.add(post);
  const rayas = ['#c0392b', '#e0b31c', '#2e6fd8', '#2f9e44'].map((hx) => canvasTex(64, 64, (c, w, h) => { for (let x = 0; x < w; x += 16) { c.fillStyle = (x / 16) % 2 ? '#f2ead8' : hx; c.fillRect(x, 0, 16, h); } c.fillStyle = hx; for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, h - 8); c.lineTo(x + 8, h); c.lineTo(x + 16, h - 8); c.fill(); } }));
  for (let k = 0; k < NP; k += 2) {
    const a0 = k / NP * Math.PI * 2, a1 = (k + 2) / NP * Math.PI * 2, am = (a0 + a1) / 2, rr = r + 0.1, yT = y + 4.2;
    const geo = new THREE.BufferGeometry(), pts = [[Math.cos(a0) * rr, yT, Math.sin(a0) * rr], [Math.cos(a1) * rr, yT, Math.sin(a1) * rr], [Math.cos(am) * (rr - 3.2), yT - 1.6, Math.sin(am) * (rr - 3.2)]];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: rayas[(k / 2) % 4], side: THREE.DoubleSide })));
  }
  const NB = 160, band = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.38), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), NB), cc = new THREE.Color(), e = new THREE.Euler();
  for (let k = 0; k < NB; k++) { const a = (k + 0.5) / NB * Math.PI * 2, sag = Math.sin(((k % (NB / NP)) / (NB / NP)) * Math.PI) * 0.5; e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e); m4.compose(v.set(Math.cos(a) * (r + 0.1), y + 3.5 - sag, Math.sin(a) * (r + 0.1)), q, sc.set(1, 1, 1)); band.setMatrixAt(k, m4); band.setColorAt(k, cc.set(['#c0392b', '#e0b31c', '#2e6fd8', '#2f9e44', '#f2ead8'][k % 5])); }
  g.add(band);
  publicoC = crearPublico(asientos, g); if (publicoC) publicoC.visible = false;
  return g;
}
// una mazmorra: arena abandonada en ruinas, cada una con las cosas de su monstruo
const MAZ_LOOK = {
  minotauro: { fog: '#2a1610', cielo: ['#0c0606', '#3a1a10', '#5a2a18'], piedra: '#7a6656', luz: 0.6 },
  medusa:    { fog: '#16241a', cielo: ['#050a08', '#1a3424', '#2e4a34'], piedra: '#6e7266', luz: 0.55 },
  aquiles:   { fog: '#3a2414', cielo: ['#1a1030', '#a0502a', '#f0a050'], piedra: '#a08c6c', luz: 0.75 },
  licaon:    { fog: '#0e1626', cielo: ['#04060e', '#142040', '#2a3a5a'], piedra: '#5e6470', luz: 0.5 },
  arbol:     { fog: '#16261a', cielo: ['#060c06', '#1e3a1a', '#3a5a2a'], piedra: '#5e6a4e', luz: 0.55 },
  ciclope:   { fog: '#2a2a2e', cielo: ['#0e0e12', '#3a3a44', '#6a6a70'], piedra: '#80786c', luz: 0.6 },
  talos:     { fog: '#2a140a', cielo: ['#0a0402', '#4a1a08', '#a04010'], piedra: '#6a5a50', luz: 0.65 },
};
function crearMazmorra(RA, jefe) {
  const L = MAZ_LOOK[jefe] || MAZ_LOOK.minotauro, g = new THREE.Group(), G2 = gradas(), A = G2.SEG;
  let sr = jefe.length * 9973 + 7; const rnd = () => { sr = (sr * 16807) % 2147483647; return (sr - 1) / 2147483646; };
  const roto = new Array(A).fill(0).map(() => rnd()); for (let k = 0; k < A; k++) roto[k] = (roto[k] + roto[(k + 1) % A] + roto[(k + 2) % A]) / 3;
  const c = new THREE.Color(L.piedra), tono = (k, f) => { const x = c.clone().multiplyScalar(f * (0.85 + roto[k] * 0.3)); if (roto[k] > 0.55) x.lerp(new THREE.Color('#3e5a2e'), 0.35); return '#' + x.getHexString(); };
  let r = RA + 0.6, y = 2.6;
  for (let i = 0; i < 3; i++) {
    const salta = (k) => i > 0 && roto[k] > 0.62 - i * 0.06;   // los pisos de arriba están derrumbados en partes
    if (i > 0) { G2.escalon(r, y, y + 0.8, (k) => tono(k, 0.75), salta); y += 0.8; }
    G2.pisada(r, r + 0.4, y, (k) => tono(k, 0.95), salta); r += 0.4;
    for (let s2 = 0; s2 < 4; s2++) { G2.escalon(r, y, y + 0.3, (k) => tono(k, 0.7), salta); y += 0.3; G2.pisada(r, r + 0.5, y, (k) => tono(k, s2 % 2 ? 0.9 : 1), salta); r += 0.5; }
  }
  g.add(G2.malla());
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), cc = new THREE.Color();
  const lam = (hex) => new THREE.MeshLambertMaterial({ color: hex }), bas = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const inst = (geo, mat, lista) => { const im = new THREE.InstancedMesh(geo, mat, lista.length); lista.forEach(([x, y2, z, sx, sy, sz, ry, rx, hex], k) => { e.set(rx || 0, ry || 0, 0); q.setFromEuler(e); m4.compose(v.set(x, y2, z), q, sc.set(sx, sy, sz)); im.setMatrixAt(k, m4); if (hex) im.setColorAt(k, cc.set(hex)); }); g.add(im); return im; };
  // columnas rotas arriba, escombros en la arena y tambores de columna caídos
  const cols = [], esc = [], tamb = [];
  for (let k = 0; k < 40; k++) { if (rnd() < 0.35) continue; const a = k / 40 * Math.PI * 2, h2 = 0.6 + rnd() * 2.4; cols.push([Math.cos(a) * (r + 0.45), y + h2 / 2, Math.sin(a) * (r + 0.45), 1, h2, 1]); }
  inst(new THREE.CylinderGeometry(0.17, 0.2, 1, 7), lam(c.clone().multiplyScalar(1.1)), cols);
  for (let k = 0; k < 70; k++) { const a = rnd() * Math.PI * 2, rr = rnd() < 0.6 ? RA - 0.3 - rnd() * 2.2 : RA + 1 + rnd() * 7, s = 0.25 + rnd() * 0.6; esc.push([Math.cos(a) * rr, s / 2 + (rr > RA ? 2.6 + (rr - RA - 0.6) * 0.85 : 0), Math.sin(a) * rr, s * (0.8 + rnd()), s, s * (0.8 + rnd()), rnd() * 3, 0, '#' + c.clone().multiplyScalar(0.7 + rnd() * 0.4).getHexString()]); }
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), esc);
  for (let k = 0; k < 5; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.55 + rnd() * 0.35); tamb.push([Math.cos(a) * rr, 0.22, Math.sin(a) * rr, 1, 1.1 + rnd() * 0.8, 1, rnd() * 3, Math.PI / 2]); }
  inst(new THREE.CylinderGeometry(0.4, 0.4, 1, 10), lam(c.clone().multiplyScalar(1.05)), tamb);
  // braseros en el podio
  const llamas = []; const _push = llamas.push.bind(llamas); llamas.push = (...xs) => { xs.forEach((x) => { if (x && x.userData) x.userData.mover = true; }); return _push(...xs); };   // las llamas se mueven: no se funden
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, x = Math.cos(a) * (RA + 0.25), z = Math.sin(a) * (RA + 0.25); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.4, 8), lam('#3a2a20')); p.position.set(x, 2.8, z); g.add(p); const f = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.26), bas(jefe === 'medusa' || jefe === 'arbol' ? '#7af07a' : '#ff9a30')); f.position.set(x, 3.2, z); g.add(f); llamas.push(f); }
  // lo de cada monstruo
  const P = [];
  if (jefe === 'minotauro') { for (let k = 0; k < 7; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.62 + rnd() * 0.25); P.push([Math.cos(a) * rr, 0.9, Math.sin(a) * rr, 2.4 + rnd() * 2, 1.8, 0.45, -a + (rnd() < 0.5 ? 0 : Math.PI / 2), 0, '#6a5446']); } inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), P); }
  if (jefe === 'medusa') { const st = []; for (let k = 0; k < 12; k++) { const a = rnd() * Math.PI * 2, rr = RA + 1.2 + rnd() * 5, yy = 2.6 + (rr - RA - 0.6) * 0.85; st.push([Math.cos(a) * rr, yy + 0.5, Math.sin(a) * rr, 0.42, 1, 0.3, -a, 0, '#8a8a84'], [Math.cos(a) * rr, yy + 1.15, Math.sin(a) * rr, 0.26, 0.28, 0.26, -a, 0, '#9a9a94'], [Math.cos(a) * rr + 0.25, yy + 1.2, Math.sin(a) * rr, 0.1, 0.6, 0.1, 0, 0.6, '#8a8a84']); } for (let k = 0; k < 4; k++) { const a = rnd() * Math.PI * 2, rr = RA * 0.6; st.push([Math.cos(a) * rr, 0.6, Math.sin(a) * rr, 0.5, 1.2, 0.34, -a, 0, '#7e7e78'], [Math.cos(a) * rr, 1.4, Math.sin(a) * rr, 0.3, 0.3, 0.3, -a, 0, '#8e8e88']); } inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), st); }
  if (jefe === 'aquiles') { const lz = [], es = []; for (let k = 0; k < 26; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.4 + rnd() * 0.55); lz.push([Math.cos(a) * rr, 1.0, Math.sin(a) * rr, 1, 2.2, 1, rnd() * 3, (rnd() - 0.5) * 0.6, '#8a6a40']); if (k % 2) es.push([Math.cos(a) * rr + 0.4, 0.45, Math.sin(a) * rr, 1, 0.08, 1, rnd() * 3, Math.PI / 2 - 0.4, '#b08a3a']); } inst(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), new THREE.MeshLambertMaterial(), lz); inst(new THREE.CylinderGeometry(0.45, 0.45, 1, 12), new THREE.MeshLambertMaterial(), es); }
  if (jefe === 'licaon' || jefe === 'arbol') { const tr = [], ra = []; for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, rr = RA + 1.5 + rnd() * 5.5, yy = 2.6 + (rr - RA - 0.6) * 0.85, h2 = 2.5 + rnd() * 3; tr.push([Math.cos(a) * rr, yy + h2 / 2, Math.sin(a) * rr, 0.35, h2, 0.35, 0, 0, '#3a2a1e']); for (let b2 = 0; b2 < 3; b2++) ra.push([Math.cos(a) * rr + (rnd() - 0.5) * 0.8, yy + h2 * (0.55 + b2 * 0.15), Math.sin(a) * rr + (rnd() - 0.5) * 0.8, 0.12, 1.4, 0.12, rnd() * 3, 0.7 + rnd() * 0.5, '#3a2a1e']); if (jefe === 'arbol') ra.push([Math.cos(a) * rr, yy + h2 + 0.5, Math.sin(a) * rr, 2, 1.4, 2, 0, 0, '#2e5a24']); } inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), tr); inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), ra);
    if (jefe === 'arbol') { for (let k = 0; k < 6; k++) { const a = rnd() * Math.PI * 2, raiz = new THREE.Mesh(new THREE.TorusGeometry(2.2 + rnd() * 1.5, 0.28, 6, 14, Math.PI), lam('#4a3424')); raiz.position.set(Math.cos(a) * (RA - 1.5), 0, Math.sin(a) * (RA - 1.5)); raiz.rotation.y = -a; g.add(raiz); } const hon = []; for (let k = 0; k < 30; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.5 + rnd() * 0.45); hon.push([Math.cos(a) * rr, 0.12, Math.sin(a) * rr, 0.22, 0.24, 0.22, 0, 0, rnd() < 0.5 ? '#9af07a' : '#d8f0a0']); } inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), hon); } }
  if (jefe === 'ciclope') { const ro = [], hu = []; for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.5 + rnd() * 0.45), s = 0.6 + rnd() * 1.4; ro.push([Math.cos(a) * rr, s * 0.45, Math.sin(a) * rr, s, s * 0.8, s, rnd() * 3, rnd(), '#7a746a']); } for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.3 + rnd() * 0.65); hu.push([Math.cos(a) * rr, 0.05, Math.sin(a) * rr, 0.08, 0.08, 0.5 + rnd() * 0.4, rnd() * 3, 0, '#e8e0cc']); } inst(new THREE.DodecahedronGeometry(0.6), new THREE.MeshLambertMaterial(), ro); inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), hu); }
  if (jefe === 'talos') { const yu = []; for (let k = 0; k < 6; k++) { const a = rnd() * Math.PI * 2, rr = RA * (0.55 + rnd() * 0.35); yu.push([Math.cos(a) * rr, 0.35, Math.sin(a) * rr, 0.9, 0.7, 0.5, rnd() * 3, 0, '#2a2a2e'], [Math.cos(a) * rr, 0.78, Math.sin(a) * rr, 1.3, 0.2, 0.5, rnd() * 3, 0, '#3a3a40']); } inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), yu);
    const lava = new THREE.Mesh(new THREE.RingGeometry(RA - 1.2, RA - 0.7, 64), new THREE.MeshBasicMaterial({ color: '#ff6a10', transparent: true, opacity: 0.85 })); lava.rotation.x = -Math.PI / 2; lava.position.y = 0.015; g.add(lava); llamas.push(lava); }
  if (jefe === 'licaon' || jefe === 'medusa') { const luna = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: jefe === 'licaon' ? '#f2f0e0' : '#c8f0c0', fog: false })); luna.position.set(-40, 42, -70); luna.lookAt(0, 0, 0); g.add(luna); }
  g.userData.anim = (t) => { llamas.forEach((f, i) => { if (f.geometry.type === 'RingGeometry') f.material.opacity = 0.7 + Math.sin(t * 2) * 0.15; else { f.scale.y = 1 + Math.sin(t * 13 + i) * 0.25; f.scale.x = f.scale.z = 1 + Math.sin(t * 9 + i * 2) * 0.12; } }); };
  return g;
}
const cieloTex = (a, b, c2) => canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(0.42, b); gr.addColorStop(0.5, c2); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const CIELOS = {};
// pone la arena que le toca a esta pelea
/* ---------- ARENA EN POCAS PIEZAS: todo lo que no se mueve y comparte material se funde en un solo dibujo ----------
   (gradas, columnas, muros, palco… eran decenas de dibujos sueltos; ahora uno por material) */
const _fm = new THREE.Matrix4(), _fn = new THREE.Matrix3(), _fv = new THREE.Vector3(), _blanco = new THREE.Color(1, 1, 1);
function fusionar(g, saltar = new Set()) {
  if (!g) return;
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), grupos = new Map();
  const visitar = (o) => {
    for (const c of o.children.slice()) {
      if (saltar.has(c) || c.userData.mover) continue;
      if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && c.visible && !c.children.length && !Array.isArray(c.material) && !c.material.transparent && c.geometry && c.geometry.attributes.position && c.material.side !== undefined) {
        // materiales "iguales" (mismo tipo, color, imagen y lado) se tratan como uno solo
        const mt = c.material, ga = c.geometry.attributes;
        // el color de cada pieza pasa a los vértices: así piezas de distinto color comparten un solo dibujo
        const firma = (mt === pisoMat || mt === muroMat ? mt.uuid : [mt.type, mt.map ? mt.map.uuid : '', mt.side, mt.fog, mt.emissive ? mt.emissive.getHexString() : '', mt.depthWrite, mt.alphaTest].join(',')) + '|' + (ga.normal ? 'n' : '') + (ga.uv ? 'u' : '');
        if (!grupos.has(firma)) grupos.set(firma, []); grupos.get(firma).push(c);
      }
      if (c.visible && !c.isInstancedMesh) visitar(c);
    }
  };
  visitar(g);
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    let nv = 0, ni = 0; for (const m of lista) { const gg = m.geometry; nv += gg.attributes.position.count; ni += gg.index ? gg.index.count : gg.attributes.position.count; }
    const fijo = lista[0].material === pisoMat || lista[0].material === muroMat;
    const a0 = lista[0].geometry.attributes, P = new Float32Array(nv * 3), N = a0.normal ? new Float32Array(nv * 3) : null, U = a0.uv ? new Float32Array(nv * 2) : null, C = fijo ? null : new Float32Array(nv * 3), I = new Uint32Array(ni);
    let v0 = 0, i0 = 0;
    for (const m of lista) {
      const gg = m.geometry, A = gg.attributes, n = A.position.count;
      _fm.multiplyMatrices(inv, m.matrixWorld); _fn.getNormalMatrix(_fm);
      for (let k = 0; k < n; k++) {
        _fv.fromBufferAttribute(A.position, k).applyMatrix4(_fm); P.set([_fv.x, _fv.y, _fv.z], (v0 + k) * 3);
        if (N) { _fv.fromBufferAttribute(A.normal, k).applyMatrix3(_fn).normalize(); N.set([_fv.x, _fv.y, _fv.z], (v0 + k) * 3); }
        if (U) { U[(v0 + k) * 2] = A.uv.getX(k); U[(v0 + k) * 2 + 1] = A.uv.getY(k); }
        if (C) { const mc = m.material.color || _blanco, vc = m.material.vertexColors && A.color; C[(v0 + k) * 3] = mc.r * (vc ? A.color.getX(k) : 1); C[(v0 + k) * 3 + 1] = mc.g * (vc ? A.color.getY(k) : 1); C[(v0 + k) * 3 + 2] = mc.b * (vc ? A.color.getZ(k) : 1); }
      }
      // si la pieza estaba espejada (escala negativa), se dan vuelta los triángulos para que no queden al revés
      const esp = _fm.determinant() < 0;
      if (gg.index) { const ia = gg.index.array; for (let k = 0; k < ia.length; k += 3) { I[i0 + k] = ia[k] + v0; I[i0 + k + 1] = ia[esp ? k + 2 : k + 1] + v0; I[i0 + k + 2] = ia[esp ? k + 1 : k + 2] + v0; } i0 += ia.length; }
      else { for (let k = 0; k < n; k += 3) { I[i0 + k] = v0 + k; I[i0 + k + 1] = v0 + k + (esp ? 2 : 1); I[i0 + k + 2] = v0 + k + (esp ? 1 : 2); } i0 += n; }
      v0 += n;
      m.parent.remove(m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); if (N) geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); if (C) geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere();
    let mat = lista[0].material; if (C) { mat = mat.clone(); if (mat.color) mat.color.set('#ffffff'); mat.vertexColors = true; }
    const una = new THREE.Mesh(geo, mat); una.renderOrder = lista[0].renderOrder; g.add(una);
  }
}
function ponerEscenario(esc) {
  const RA = R.COMBATE.arenaRadio, alto = AJ().nivel() === 'alto', fx = AJ().fx();
  const maz = esc.startsWith('maz:') ? esc.slice(4) : null;
  if (esc === 'cde' && !gCde) { gCde = crearEntretenimiento(RA); coliseoG.add(gCde); fusionar(gCde, new Set([publicoC])); }
  if (maz && !gMaz[maz]) { gMaz[maz] = crearMazmorra(RA, maz); coliseoG.add(gMaz[maz]); fusionar(gMaz[maz]); }
  gHist.visible = esc === 'cdh' || esc === 'diablo'; if (gCde) gCde.visible = esc === 'cde';
  for (const k in gMaz) gMaz[k].visible = k === maz;
  const conPublico = alto || (AJ().celu() && AJ().nivel() === 'medio');   // en celular el público pintado es liviano: también se ve en Medios
  if (publicoH) publicoH.visible = conPublico && esc === 'cdh'; if (publicoC) publicoC.visible = conPublico && esc === 'cde';
  if (fxG) fxG.visible = fx && (esc === 'cdh' || esc === 'cde');
  if (brasas) brasas.visible = fx && esc === 'diablo';
  const L = maz ? MAZ_LOOK[maz] : null;
  const ck = maz ? 'maz:' + maz : esc;
  if (!CIELOS[ck]) CIELOS[ck] = L ? cieloTex(...L.cielo) : esc === 'diablo' ? cieloTex('#1a0402', '#6a1008', '#c03010') : esc === 'cde' ? cieloTex('#5a94d0', '#a8d0e8', '#f0d8a8') : cieloTex('#4f86c2', '#9cc0dc', '#ecd2a2');
  if (cieloMesh) { cieloMesh.material.map = CIELOS[ck]; cieloMesh.material.needsUpdate = true; }
  const fog = L ? L.fog : esc === 'diablo' ? '#4a0e08' : esc === 'cde' ? '#e0c898' : '#d2b488';
  scene.background = new THREE.Color(fog); scene.fog = L || esc === 'diablo' ? new THREE.Fog(fog, 30, 95) : new THREE.Fog(fog, 55, 150);
  if (luzHemi) { luzHemi.intensity = L ? L.luz : esc === 'diablo' ? 0.6 : 0.82; luzHemi.color.set(esc === 'diablo' ? '#ffb0a0' : L ? '#c8d0e8' : '#fff0d4'); }
  if (luzSol) { luzSol.intensity = L ? 0.35 : esc === 'diablo' ? 0.5 : 0.68; luzSol.color.set(esc === 'diablo' ? '#ff6a40' : maz === 'talos' ? '#ff9a50' : L ? '#a8b8e0' : '#ffd9a0'); }
  if (pisoMat) pisoMat.color.set(L ? '#8a7a68' : esc === 'diablo' ? '#a07060' : esc === 'cde' ? '#fff4e0' : '#ffffff');
  if (muroMat) { muroMat.map = esc === 'cde' ? TEX_MURO.madera : L ? TEX_MURO.ruina : TEX_MURO.piedra; muroMat.color.set(L ? L.piedra : '#ffffff'); if (L) muroMat.color.multiplyScalar(1.5); muroMat.needsUpdate = true; }
  escActual = esc;
}
function animEscenario(t, dt) {
  const maz = escActual && escActual.startsWith('maz:') ? gMaz[escActual.slice(4)] : null;
  if (maz && maz.userData.anim) maz.userData.anim(t);
  if (brasas && brasas.visible) { const p = brasas.geometry.attributes.position, a = p.array; for (let i = 0; i < a.length; i += 3) { a[i + 1] += dt * (1.2 + (i % 7) * 0.2); a[i] += Math.sin(t * 2 + i) * dt * 0.3; if (a[i + 1] > 12) a[i + 1] = 0.2; } p.needsUpdate = true; }
}

function decorarColiseo(g, RA, R3, Y3) {
  const B = THREE.MeshBasicMaterial, L = THREE.MeshLambertMaterial;
  // cielo: de azul arriba a bruma dorada en el horizonte
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 12), new B({ side: THREE.BackSide, fog: false, map: canvasTex(8, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4f86c2'); gr.addColorStop(0.38, '#9cc0dc'); gr.addColorStop(0.5, '#ecd2a2'); gr.addColorStop(1, '#c9a878'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }) }));
  coliseoG.add(cielo); cieloMesh = cielo;
  // ático: el muro alto detrás de la última tribuna, con arcos y cornisa
  const aticoTex = canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#b79c78'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { c.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`; c.fillRect(x, y, 31, 15); }
    for (let x = 14; x < w; x += 64) { c.fillStyle = '#3a2a1c'; c.beginPath(); c.moveTo(x, h - 14); c.lineTo(x, 50); c.arc(x + 18, 50, 18, Math.PI, 0); c.lineTo(x + 36, h - 14); c.fill(); c.fillStyle = '#cdb590'; c.fillRect(x + 42, 18, 12, h - 18); c.fillStyle = '#e0cba6'; c.fillRect(x + 40, 14, 16, 6); }
    c.fillStyle = '#8a7252'; c.fillRect(0, 0, w, 10); c.fillStyle = '#e0cba6'; c.fillRect(0, 10, w, 3); c.fillStyle = '#8a7252'; c.fillRect(0, h - 12, w, 12);
  });
  aticoTex.wrapS = THREE.RepeatWrapping; aticoTex.repeat.set(5, 1);
  const atico = new THREE.Mesh(new THREE.CylinderGeometry(R3 + 0.2, R3, 3.4, 72, 1, true), new L({ map: aticoTex, side: THREE.BackSide })); atico.position.y = Y3 + 1.7; g.add(atico);
  // toldo (velarium): gajos de tela que salen del borde y dejan un ojo abierto al cielo; solo se ve desde abajo, así la cámara de arriba no lo tiene delante
  { const N = 28, pos = [], col = [], c1 = new THREE.Color('#f2e6c8'), c2 = new THREE.Color('#b3261a'), yA = Y3 + 3.5, yB = Y3 + 2.3, rB = RA * 0.62;
    for (let k = 0; k < N; k++) { const a0 = (k + 0.08) / N * Math.PI * 2, a1 = (k + 0.92) / N * Math.PI * 2, am = (a0 + a1) / 2, c = k % 4 === 0 ? c2 : c1;
      const p = [[Math.cos(a0) * R3, yA, Math.sin(a0) * R3], [Math.cos(a1) * R3, yA, Math.sin(a1) * R3], [Math.cos(am + 0.05) * rB, yB, Math.sin(am + 0.05) * rB], [Math.cos(am - 0.05) * rB, yB, Math.sin(am - 0.05) * rB]];
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); const s = i >= 2 ? 0.8 : 1; col.push(c.r * s, c.g * s, c.b * s); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, new B({ vertexColors: true, side: THREE.FrontSide, transparent: true, opacity: 0.93 })));
    // mástiles del toldo
    const mast = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), new L({ color: '#5a3c22' }), N), m4 = new THREE.Matrix4();
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; m4.makeTranslation(Math.cos(a) * (R3 + 0.1), Y3 + 4.3, Math.sin(a) * (R3 + 0.1)); mast.setMatrixAt(k, m4); } g.add(mast); }
  // estandartes colgando del muro de la arena y sombra suave al pie del muro
  { const tela = (hex) => canvasTex(32, 64, (c, w, h) => { c.fillStyle = hex; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h - 14); c.lineTo(w / 2, h); c.lineTo(0, h - 14); c.fill(); c.fillStyle = '#f0c24a'; c.fillRect(0, 0, w, 4); c.beginPath(); c.arc(w / 2, 26, 7, 0, 7); c.fill(); });
    const mats = ['#8e1a12', '#6a4a8a'].map((hx) => new L({ map: tela(hx), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2, m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), mats[k % 2]); m.position.set(Math.cos(a) * (RA + 0.42), 1.65, Math.sin(a) * (RA + 0.42)); m.rotation.y = -a - Math.PI / 2; g.add(m); }
    const ao = new THREE.Mesh(new THREE.RingGeometry(RA - 2.2, RA + 0.4, 72, 1), new B({ transparent: true, depthWrite: false, map: canvasTex(4, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,24,10,0.55)'); gr.addColorStop(1, 'rgba(40,24,10,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }) }));
    // (el degradé va del borde hacia adentro: las uv del anillo no son radiales, así que se pinta por vértice)
    const uv = ao.geometry.attributes.uv, p = ao.geometry.attributes.position; for (let i = 0; i < uv.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, 0.5, (r - (RA - 2.2)) / 2.6); }
    ao.rotation.x = -Math.PI / 2; ao.position.y = 0.006; g.add(ao); }
  // luces volumétricas: haces de sol que entran por el ojo del toldo, con manchas de luz en la arena y polvo flotando
  fxG = new THREE.Group(); coliseoG.add(fxG);
  const hazTex = canvasTex(64, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,236,190,0.95)'); gr.addColorStop(0.55, 'rgba(255,226,170,0.35)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); const g2 = c.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.3, 'rgba(0,0,0,0)'); g2.addColorStop(0.7, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = g2; c.fillRect(0, 0, w, h); });
  const poolTex = canvasTex(64, 64, (c, w) => { const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,236,190,0.9)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
  const dir = new THREE.Vector3(-0.42, -1, -0.28).normalize(), haces = [];
  [[2, 1, 1.5], [-5, 4, 1.1], [6, -5, 1.3], [-3, -7, 0.9], [-9, -2, 1.0], [8, 6, 0.8]].forEach(([x, z, w], i) => {
    const largo = 15, m = new THREE.MeshBasicMaterial({ map: hazTex, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const ry of [0, Math.PI / 2]) {   // dos planos cruzados: se ve con volumen desde cualquier lado
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.1, largo), m); const pivote = new THREE.Group();
      pl.rotation.y = ry; pivote.add(pl); pivote.position.set(x - dir.x * largo / 2, largo / 2 * -dir.y, z - dir.z * largo / 2);
      pivote.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); fxG.add(pivote);
    }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(w * 4.4, w * 3.4), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.012, z); fxG.add(pool);
    haces.push({ m, pool, f: 0.4 + i * 0.13 });
  });
  const NP = 220, pp = new Float32Array(NP * 3), pv = [];
  for (let i = 0; i < NP; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RA; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = 0.3 + Math.random() * 8; pp[i * 3 + 2] = Math.sin(a) * r; pv.push([(Math.random() - 0.5) * 0.25, 0.05 + Math.random() * 0.12, (Math.random() - 0.5) * 0.25, Math.random() * 6]); }
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const motas = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: '#ffe9b8', size: 0.07, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); fxG.add(motas);
  decorT = (t, dt) => {
    if (!fxG.visible || !coliseoG.visible) return;
    haces.forEach((h) => { h.m.opacity = 0.085 + Math.sin(t * h.f) * 0.03; h.pool.material.opacity = 0.11 + Math.sin(t * h.f) * 0.035; });
    for (let i = 0; i < NP; i++) { const v = pv[i]; pp[i * 3] += (v[0] + Math.sin(t * 0.5 + v[3]) * 0.08) * dt; pp[i * 3 + 1] += v[1] * dt; pp[i * 3 + 2] += (v[2] + Math.cos(t * 0.4 + v[3]) * 0.08) * dt; if (pp[i * 3 + 1] > 8.5) pp[i * 3 + 1] = 0.2; }
    pgeo.attributes.position.needsUpdate = true;
  };
}
/* ---------- la entrada: cada equipo sale por su puerta mientras la cámara lo muestra (se puede saltear) ---------- */
let intro = null;
const INTRO_SEG = 2.4, INTRO_CAMINA = 1.4;
const angEquipo = (ti) => (ti / pelea.equipos.length) * Math.PI * 2 + Math.PI / 2;   // el mismo ángulo con el que el motor los ubica
const introK = (ti) => (intro ? Math.max(0, Math.min(1, (intro.t - ti * INTRO_SEG) / (INTRO_SEG * 0.8))) : 1);
// cada gladiador sale por la puerta de su equipo, en fila de a tres, y camina hasta su lugar
function introKf(f) {
  const eq = pelea.equipos[f.team], j = Math.max(0, eq.miembros.indexOf(f.id)), paso = Math.min(0.16, 0.95 / Math.max(1, eq.miembros.length));
  return Math.max(0, Math.min(1, (intro.t - f.team * INTRO_SEG - j * paso) / INTRO_CAMINA));
}
function introPos(f, k) {
  const RA = R.COMBATE.arenaRadio, a = angEquipo(f.team), ca = Math.cos(a), sa = Math.sin(a), tx = -sa, tz = ca;
  const j = Math.max(0, pelea.equipos[f.team].miembros.indexOf(f.id)), lat = ((j % 3) - 1) * 0.75;
  const p0 = [ca * (RA + 1.2) + tx * lat, sa * (RA + 1.2) + tz * lat], p1 = [ca * (RA - 2.2) + tx * lat, sa * (RA - 2.2) + tz * lat], e = k * k * (3 - 2 * k), u = 1 - e;
  return [u * u * p0[0] + 2 * u * e * p1[0] + e * e * f.x, u * u * p0[1] + 2 * u * e * p1[1] + e * e * f.z];
}
function introFuera(ti, k) { const a = angEquipo(ti), d = (1 - k * k * (3 - 2 * k)) * (R.COMBATE.arenaRadio * 0.36 + 2); return [Math.cos(a) * d, Math.sin(a) * d]; }
function ponerPuertas() {
  if (puertasG) { coliseoG.remove(puertasG); puertasG = null; }
  if (!pelea || pelea.cfg.modo === 'campeones') return;
  puertasG = new THREE.Group(); coliseoG.add(puertasG);
  const RA = R.COMBATE.arenaRadio;
  pelea.equipos.forEach((eq, ti) => {
    const a = angEquipo(ti), g = new THREE.Group(); g.position.set(Math.cos(a) * (RA + 0.44), 0, Math.sin(a) * (RA + 0.44)); g.rotation.y = -a - Math.PI / 2; puertasG.add(g);
    const caja = (w, h, d, hex, x, y, z, basic) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic ? new THREE.MeshBasicMaterial({ color: hex }) : new THREE.MeshLambertMaterial({ color: hex })); m.position.set(x, y, z); g.add(m); return m; };
    caja(3.4, 2.5, 0.12, '#0c0806', 0, 1.25, 0, true);                                   // el túnel oscuro
    caja(0.45, 2.9, 0.4, '#c9b08a', -1.9, 1.45, 0.1); caja(0.45, 2.9, 0.4, '#c9b08a', 1.9, 1.45, 0.1); caja(4.6, 0.5, 0.5, '#d8c29c', 0, 2.95, 0.1);   // marco de piedra
    for (let k = -3; k <= 3; k++) caja(0.07, 0.7, 0.07, '#2a2622', k * 0.45, 2.35, 0.12);   // la reja levantada
    caja(3.4, 0.08, 0.08, '#2a2622', 0, 2.02, 0.12);
    caja(1.5, 1.0, 0.06, eq.color, 0, 3.75, 0.16); caja(1.7, 0.1, 0.1, '#f0c24a', 0, 4.28, 0.16);   // el estandarte del equipo arriba de su puerta
  });
  fusionar(puertasG);   // las puertas no se mueven: un solo dibujo para todas
}
function empezarIntro(no) {
  const viejo = document.getElementById('introB'); if (viejo) viejo.remove();
  ponerPuertas();
  if (no || !pelea || !stage) { intro = null; return; }
  intro = { t: -0.5, dur: pelea.equipos.length * INTRO_SEG + 0.9, eq: -1, cam: null };
  const b = document.createElement('div'); b.id = 'introB'; b.innerHTML = '<div class="inom"></div><button class="isal">Saltar ▸▸</button>'; stage.appendChild(b);
  b.onclick = terminarIntro;
}
function terminarIntro() { intro = null; const b = document.getElementById('introB'); if (b) b.remove(); for (const k in V) if (V[k] && V[k].grp) V[k].grp.visible = true; cam.dd = undefined; }
function pasoIntro(dt) {
  intro.t += dt;
  if (remoto && pelea.t > 0.3) return terminarIntro();   // el anfitrión ya arrancó
  const ti = Math.max(0, Math.min(pelea.equipos.length - 1, Math.floor(intro.t / INTRO_SEG)));
  if (ti !== intro.eq && intro.t >= 0) {
    intro.eq = ti; const eq = pelea.equipos[ti], b = document.querySelector('#introB .inom');
    if (b) { b.innerHTML = `<small>entra</small><b style="color:${eq.color}">${eq.nombre}</b><small>${eq.miembros.length} gladiador${eq.miembros.length === 1 ? '' : 'es'}</small>`; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    if (window.Sonido) Sonido.publico('ovacion', 0.55);
  }
  if (intro.t >= intro.dur) terminarIntro();
}
const _ci = new THREE.Vector3(), _cl = new THREE.Vector3();
function camIntro(dt) {
  const RA = R.COMBATE.arenaRadio, ti = Math.max(0, intro.eq), a = angEquipo(ti), k = introK(ti);
  // la cámara está adentro de la arena, baja, mirando la puerta; va retrocediendo mientras el equipo avanza
  const lado = a + 0.5, dC = RA * (0.16 - 0.12 * k);
  _ci.set(Math.cos(lado) * dC, 1.5 + k * 0.6, Math.sin(lado) * dC); _cl.set(Math.cos(a) * RA * (0.95 - 0.25 * k), 1.5, Math.sin(a) * RA * (0.95 - 0.25 * k));
  if (!intro.cam) { intro.cam = { p: _ci.clone(), l: _cl.clone() }; }
  const q = 1 - Math.exp(-dt * 3.5); intro.cam.p.lerp(_ci, q); intro.cam.l.lerp(_cl, q);
  camera.position.copy(intro.cam.p); camera.lookAt(intro.cam.l); foco.copy(intro.cam.l);
  return true;
}
function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });   // bordes suaves siempre (sin dientes de sierra)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  initPost(); initManoPost();
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a130d');
  scene.fog = new THREE.Fog('#1a130d', 45, 90);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  luzHemi = new THREE.HemisphereLight('#fff0d4', '#4a3420', 0.82); scene.add(luzHemi);
  const sun = new THREE.DirectionalLight('#ffd9a0', 0.68); sun.position.set(10, 30, 8); scene.add(sun); luzSol = sun;
  const RA = R.COMBATE.arenaRadio;
  // arena de arena
  const sand = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c9a46b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 20 + Math.random() * 50); const x = Math.random() * w, y = Math.random() * h; g.save(); g.translate(x, y); gr.addColorStop(0, Math.random() < 0.5 ? 'rgba(120,85,45,.18)' : 'rgba(240,215,160,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-70, -70, 140, 140); g.restore(); }
    for (let i = 0; i < 9000; i++) { const v = 150 + Math.random() * 70; g.fillStyle = `rgba(${v},${v * 0.8},${v * 0.52},${0.35})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(110,80,45,.12)'; g.lineWidth = 1; for (let y = 4; y < h; y += 7) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 1.5); g.stroke(); }   // rastrillado
    for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < 0.5 ? '#9a8060' : '#e2cfa0'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2); }   // piedritas
    g.strokeStyle = 'rgba(120,85,50,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2); g.stroke();
  });
  // todo el coliseo va en un grupo: en la pelea de campeones se esconde y aparece la torre
  coliseoG = new THREE.Group(); scene.add(coliseoG);
  const scene0 = scene; scene = coliseoG;   // (lo que sigue se agrega al grupo del coliseo)
  pisoMat = new THREE.MeshLambertMaterial({ map: sand });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(RA + 0.4, 72), pisoMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // muro con arcos
  const wallTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#9c8566'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.fillRect(x, y, 31, 15); }
    for (let x = 32; x < w; x += 128) { g.fillStyle = '#2a1d13'; g.beginPath(); g.moveTo(x, h); g.lineTo(x, 60); g.arc(x + 30, 60, 30, Math.PI, 0); g.lineTo(x + 60, h); g.fill(); }
    g.fillStyle = '#6e5a42'; g.fillRect(0, 0, w, 8);
  });
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(6, 1);
  TEX_MURO.piedra = wallTex;
  TEX_MURO.madera = canvasTex(1024, 128, (g, w, h) => { for (let x = 0; x < w; x += 24) { g.fillStyle = ['#7a5230', '#6e4a2a', '#84593a'][(x / 24) % 3]; g.fillRect(x, 0, 24, h); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 2, h); g.fillStyle = '#2a1a0c'; g.fillRect(x + 10, 20, 3, 3); g.fillRect(x + 10, h - 24, 3, 3); } g.fillStyle = '#4a3220'; g.fillRect(0, 34, w, 10); g.fillRect(0, h - 40, w, 10); });
  TEX_MURO.madera.wrapS = THREE.RepeatWrapping; TEX_MURO.madera.repeat.set(6, 1);
  TEX_MURO.ruina = canvasTex(1024, 128, (g, w, h) => { g.fillStyle = '#8a8070'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { if (Math.random() < 0.08) continue; g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.14})`; g.fillRect(x, y, 31, 15); } g.strokeStyle = 'rgba(20,14,10,.6)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { let x = Math.random() * w, y = 0; g.beginPath(); g.moveTo(x, y); while (y < h) { x += (Math.random() - 0.5) * 14; y += 8 + Math.random() * 10; g.lineTo(x, y); } g.stroke(); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,90,40,.45)'; g.beginPath(); g.ellipse(Math.random() * w, h - Math.random() * 30, 10 + Math.random() * 30, 6 + Math.random() * 10, 0, 0, 7); g.fill(); } });
  TEX_MURO.ruina.wrapS = THREE.RepeatWrapping; TEX_MURO.ruina.repeat.set(6, 1);
  muroMat = new THREE.MeshLambertMaterial({ map: wallTex, side: THREE.BackSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(RA + 0.5, RA + 0.5, 2.6, 72, 1, true), muroMat);
  wall.position.y = 1.3; scene.add(wall);
  gHist = crearHistoria(RA); scene.add(gHist);
  { const NB = 260, pos = new Float32Array(NB * 3); for (let i = 0; i < NB; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RA; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = Math.sin(a) * r; }
    const gb = new THREE.BufferGeometry(); gb.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    brasas = new THREE.Points(gb, new THREE.PointsMaterial({ color: '#ff7a2a', size: 0.12, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); brasas.visible = false; scene.add(brasas); }
  scene = scene0;
  fusionar(gHist, new Set([publicoH, fxG]));
  torreG = crearTorre(); torreG.visible = false; scene.add(torreG); fusionar(torreG);
  // control de cámara: arrastrar = girar, rueda / pellizco = zoom, tocar = seguir a un gladiador
  const cv = renderer.domElement; cv.style.touchAction = 'none';
  const ptrs = new Map(); let toque = null, pellizco = 0;
  const zoom = (k) => { cam.pausaAuto = 6; if (sel != null) cam.dl = Math.max(4, Math.min(30, cam.dl * k)); else cam.d = Math.max(12, Math.min(48, cam.d * k)); };
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    toque = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), mov: 0 } : null;
    if (ptrs.size === 2) { const [p1, p2] = [...ptrs.values()]; pellizco = Math.hypot(p1.x - p2.x, p1.y - p2.y); }
  });
  cv.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId); if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size >= 2) { const [p1, p2] = [...ptrs.values()]; const d = Math.hypot(p1.x - p2.x, p1.y - p2.y); if (pellizco > 0 && d > 0) zoom(pellizco / d); pellizco = d; return; }
    if (toque) toque.mov += Math.abs(dx) + Math.abs(dy);
    if (pov) return;   // en primera persona se mira hacia donde mira el gladiador
    cam.th -= dx * 0.006; cam.ph = Math.max(0.35, Math.min(1.35, cam.ph - dy * 0.004));
  });
  const soltar = (e) => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pellizco = 0;
    if (e.type === 'pointerup' && toque && toque.mov < 10 && performance.now() - toque.t < 450) tocar(e.clientX, e.clientY);
    toque = null;
  };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('wheel', (e) => { zoom(e.deltaY > 0 ? 1.08 : 0.93); e.preventDefault(); }, { passive: false });
  window.addEventListener('resize', () => stage && resize());
}
function resize() {
  if (!stage) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (post) { const d = renderer.getDrawingBufferSize(new THREE.Vector2()); post.rt.setSize(d.x, d.y); post.mat.uniforms.px.value.set(1 / d.x, 1 / d.y); }
  if (manoPost) { const d = renderer.getDrawingBufferSize(new THREE.Vector2()); manoPost.rt.setSize(d.x, d.y); manoPost.mat.uniforms.res.value.set(d.x, d.y); }
}
/* ---------- CÁMARA EN MANO: un camarógrafo que va saltando de plano en plano; se ve como grabado (ojo de pez + CRT) ---------- */
let mano = null, manoPost = null, manoPref = false;
function initManoPost() {
  const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const mat = new THREE.ShaderMaterial({
    uniforms: { tC: { value: rt.texture }, res: { value: new THREE.Vector2(800, 450) }, t: { value: 0 }, corte: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tC; uniform vec2 res; uniform float t, corte; varying vec2 vUv;
      float rnd(vec2 p){ p = mod(p, 211.0); return fract(sin(dot(p, vec2(12.9898, 78.233)) + t * 7.1) * 43758.5453); }
      vec2 pez(vec2 uv, float k){ vec2 c = uv - 0.5; c.x *= res.x / res.y; float r2 = dot(c, c); c *= 1.0 + k * r2; c.x /= res.x / res.y; return c + 0.5; }
      void main(){
        vec2 uv = pez(vUv, 0.24);                       // ojo de pez
        vec2 crt = pez(vUv, 0.05);                      // la pantalla curva del CRT
        if (crt.x < 0.0 || crt.x > 1.0 || crt.y < 0.0 || crt.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        uv = clamp(uv, 0.001, 0.999);
        float ab = 0.0015 + corte * 0.006;               // separación de colores (más fuerte justo en el corte)
        vec3 col = vec3(texture2D(tC, uv + vec2(ab, 0.0)).r, texture2D(tC, uv).g, texture2D(tC, uv - vec2(ab, 0.0)).b);
        float y = crt.y * res.y;
        col *= 0.94 + 0.06 * sin(y * 3.14159 * 0.5);   // líneas de barrido
        col *= 0.985 + 0.015 * sin(t * 60.0);             // parpadeo leve
        col += (rnd(floor(vUv * res / 2.0)) - 0.5) * 0.04;   // grano
        vec2 v = crt - 0.5; col *= 1.0 - dot(v, v) * 0.9;   // viñeta
        col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), 0.1) * vec3(1.02, 1.0, 0.96);   // un poco lavado y cálido
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const esc = new THREE.Scene(); esc.add(quad);
  manoPost = { rt, mat, esc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}
// los planos: metida en el quilombo mirando a uno y a otro, un muerto con zoom, desde arriba, desde abajo, los ojos de un gladiador, sobre el hombro, la cara, general
const PLANOS = { quilombo: 3, pov: 2.2, muerto: 2.2, cenital: 1.4, bajo: 1.4, hombro: 1.3, primer: 1.3, general: 0.6 };
function manoPesoGlad(f, evitar) { return (f.id === evitar ? 0.15 : 1) * (1 + (f.action ? 2 : 0) + (f.fxv && f.fxv.hurt > 0 ? 2.5 : 0) + (f.stagger > 0 ? 1 : 0) + (hpDe(f) < 0.4 ? 2 : 0) + (f.g.jefe ? 2 : 0)); }
function sortear(lista, peso) { const ps = lista.map(peso); let r = Math.random() * ps.reduce((a, b) => a + b, 0), i = 0; while (r > ps[i] && i < ps.length - 1) r -= ps[i++]; return lista[i]; }
function manoSoltarPov() { if (mano && mano.povId != null && V[mano.povId]) V[mano.povId].spr.visible = true; if (mano) mano.povId = null; }
function manoElegir(s, nuevo) {
  manoSoltarPov();
  const enPie = s.fighters.filter((f) => M.enPie(f)), vivos = s.fighters.filter((f) => f.estado !== 'muerto' && f.estado !== 'rendido');
  const muertos = s.fighters.filter((f) => f.estado === 'muerto' && !(mano.vistos || []).includes(f.id));
  if (!vivos.length) return;
  const tipos = Object.keys(PLANOS).filter((t) => t !== mano.tipo && (t !== 'muerto' || muertos.length) && (t !== 'pov' || enPie.length) && (t !== 'quilombo' || enPie.length > 1));
  const tipo = sortear(tipos, (t) => PLANOS[t] * (t === 'muerto' && muertos.length ? 1.5 : 1));
  let f;
  if (tipo === 'muerto') { f = muertos[muertos.length - 1]; (mano.vistos = mano.vistos || []).push(f.id); }
  else if (tipo === 'pov') {   // los ojos de alguien distinto cada vez: un goblin, después un orco, después un gigante…
    const otra = enPie.filter((g) => g.g.raza !== mano.ultRaza); f = sortear(otra.length ? otra : enPie, (g) => manoPesoGlad(g, mano.obj) * (g.target != null ? 2 : 0.5));
    mano.ultRaza = f.g.raza; mano.povId = f.id; if (V[f.id]) V[f.id].spr.visible = false; mano.povAng = f.facing;
  } else f = sortear(tipo === 'quilombo' || tipo === 'hombro' ? enPie : vivos, (g) => manoPesoGlad(g, nuevo ? mano.obj : -1));
  // en el quilombo: los que están alrededor, para ir mirando a uno y a otro
  const cerca = tipo === 'quilombo' ? enPie.filter((g) => Math.hypot(g.x - f.x, g.z - f.z) < 5).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z)).slice(0, 4).map((g) => g.id) : [];
  Object.assign(mano, { obj: f.id, tipo, t: 0, hold: 0, muerto: 0, ang: Math.random() * Math.PI * 2, corte: 1, primero: true, dur: tipo === 'muerto' ? 3.2 : tipo === 'quilombo' ? 3.6 : 2.4 + Math.random() * 1.3, cerca, mira: 0, miraT: 0, punch: Math.random() < 0.5 ? 10 : 0 });
}
function camMano(dt) {
  const s = pelea; mano.reloj = (mano.reloj || 0) + dt; mano.t += dt; mano.corte = Math.max(0, mano.corte - dt * 4);
  let f = mano.obj != null ? s.fighters[mano.obj] : null;
  if (f && f.estado === 'muerto' && mano.tipo !== 'muerto') mano.muerto += dt;
  // corta cada ~3 s; si el que muestra tiene menos del 25% de vida, se queda a ver si lo matan (hasta 12 s); si muere, 2 s más y corta
  const enPeligro = f && mano.tipo !== 'muerto' && f.estado !== 'muerto' && hpDe(f) < 0.25 && mano.hold < 12;
  if (enPeligro) mano.hold += dt;
  const povRoto = mano.tipo === 'pov' && f && !M.enPie(f);
  if (!f || povRoto || (f.estado === 'muerto' && mano.tipo !== 'muerto' ? mano.muerto > 2 : (mano.t >= mano.dur && !enPeligro)) || f.estado === 'rendido') { manoElegir(s, true); f = s.fighters[mano.obj]; }
  if (!f) return;
  const alt = f.g.altura, rot = mano.ang + mano.t * 0.12, u = Math.min(1, mano.t / mano.dur);
  let px, py, pz, lx = f.x, ly = alt * 0.62, lz = f.z, fov = 55, kPos = 2.6, kMira = 4.5, amp = 0.05;
  const alrededor = (d, h) => { px = f.x + Math.cos(rot) * d; pz = f.z + Math.sin(rot) * d; py = h; };
  if (mano.tipo === 'quilombo') {
    // adentro del lío: a la altura del pecho, entre ellos; va mirando a uno y a otro con paneos rápidos
    const ids = mano.cerca.filter((id) => s.fighters[id] && s.fighters[id].estado !== 'muerto');
    mano.miraT -= dt; if (mano.miraT <= 0 && ids.length) { mano.mira = (mano.mira + 1 + ((Math.random() * (ids.length - 1)) | 0)) % ids.length; mano.miraT = 0.7 + Math.random() * 0.6; }
    const m = s.fighters[ids[mano.mira % Math.max(1, ids.length)]] || f;
    let cx = 0, cz = 0; for (const id of ids) { cx += s.fighters[id].x; cz += s.fighters[id].z; } cx /= ids.length || 1; cz /= ids.length || 1;
    if (!ids.length) { cx = f.x; cz = f.z; }
    px = cx + Math.cos(rot) * 1.6; pz = cz + Math.sin(rot) * 1.6; py = 1.35;
    lx = m.x; lz = m.z; ly = m.g.altura * 0.7; fov = 64; kPos = 1.8; kMira = 9; amp = 0.09;
  } else if (mano.tipo === 'muerto') {
    // el muerto: arranca abierto y se va metiendo hasta la cara
    const d = 5 - 3.6 * u * u, h = 2.4 - 1.5 * u;
    alrededor(d, h); lx = f.x; lz = f.z; ly = 0.25; fov = 52 - 20 * u; kPos = 6; kMira = 8; amp = 0.035;
  } else if (mano.tipo === 'cenital') {
    const r2 = mano.ang + mano.t * 0.35; px = f.x + Math.cos(r2) * 1.2; pz = f.z + Math.sin(r2) * 1.2; py = 8.5 + alt; lx = f.x; lz = f.z; ly = 0; fov = 50; amp = 0.07;
  } else if (mano.tipo === 'pov') {
    // con sus ojos: mira hacia donde mira él (si tiene a quién pegarle, a ese)
    const o = f.target != null && s.fighters[f.target] && s.fighters[f.target].estado !== 'muerto' ? s.fighters[f.target] : null;
    let d = f.facing - mano.povAng; d = Math.atan2(Math.sin(d), Math.cos(d)); mano.povAng += d * Math.min(1, dt * 7);
    const dx = Math.cos(mano.povAng), dz = Math.sin(mano.povAng), h = alt * 0.92;
    px = f.x + dx * 0.08; pz = f.z + dz * 0.08; py = h;
    if (o) { lx = o.x; lz = o.z; ly = o.g.altura * 0.8; } else { lx = f.x + dx * 6; lz = f.z + dz * 6; ly = h * 0.7; }
    fov = 70; kPos = 30; kMira = 8; amp = 0.04;
  } else if (mano.tipo === 'primer') { alrededor(1.4 + alt * 0.55, alt * 0.88); ly = alt * 0.84; fov = 50 - 10 * u; }
  else if (mano.tipo === 'bajo') { alrededor(2.6 + alt * 0.6, 0.3); ly = alt * 0.75; fov = 64; }
  else if (mano.tipo === 'general') { alrededor(13 - 3 * u, 6.5); ly = 0.6; fov = 52; amp = 0.1; }
  else if (mano.tipo === 'hombro') {
    const o = f.target != null && s.fighters[f.target] && M.enPie(s.fighters[f.target]) ? s.fighters[f.target] : null;
    if (o) { const dx = f.x - o.x, dz = f.z - o.z, dd = Math.hypot(dx, dz) || 1; px = o.x - dx / dd * 2.1 + (-dz / dd) * 0.9; pz = o.z - dz / dd * 2.1 + (dx / dd) * 0.9; py = o.g.altura * 1.18; ly = alt * 0.7; fov = 58; }
    else alrededor(5, 1.7);
  }
  // que no se meta entre el público
  if (s.cfg.modo !== 'campeones') { const L = R.COMBATE.arenaRadio - 0.6, rr = Math.hypot(px, pz); if (rr > L) { px *= L / rr; pz *= L / rr; } }
  // pulso de camarógrafo: va atrás del objetivo con retraso y tiembla un poco
  const T = mano.reloj, k = mano.primero ? 1 : Math.min(1, dt * kPos), kl = mano.primero ? 1 : Math.min(1, dt * kMira);
  mano.p = mano.p || new THREE.Vector3(); mano.l = mano.l || new THREE.Vector3();
  if (![px, py, pz, lx, ly, lz, fov].every(Number.isFinite)) { mano.t = mano.dur; return; }   // toma rota: corta a otra
  mano.p.lerp(new THREE.Vector3(px, py, pz), k); mano.l.lerp(new THREE.Vector3(lx, ly, lz), kl); mano.primero = false;
  if (![mano.p.x, mano.p.y, mano.p.z, mano.l.x, mano.l.y, mano.l.z].every(Number.isFinite)) { mano.p.set(px, py, pz); mano.l.set(lx, ly, lz); }   // que un NaN no deje la cámara en negro para siempre
  const tb = (a, b, c) => Math.sin(T * a) * 0.5 + Math.sin(T * b + 1.3) * 0.3 + Math.sin(T * c + 2.1) * 0.2;
  camera.position.set(mano.p.x + tb(1.3, 2.9, 7.1) * amp, mano.p.y + tb(1.7, 3.3, 8.3) * amp, mano.p.z + tb(1.1, 2.3, 6.7) * amp);
  // "poom": algunas tomas entran con un zoom de golpe que se acomoda
  mano.punch = Math.max(0, (mano.punch || 0) - dt * 30);
  const fv = fov - mano.punch * 1.2; if (Math.abs(camera.fov - fv) > 0.05) { camera.fov = fv; camera.updateProjectionMatrix(); }
  camera.lookAt(mano.l.x + tb(0.9, 2.1, 5.3) * amp * 0.8, mano.l.y + tb(1.2, 2.6, 6.1) * amp * 0.8, mano.l.z + tb(0.8, 1.9, 4.7) * amp * 0.8);
  camera.rotateZ(tb(0.5, 1.1, 2.7) * (mano.tipo === 'quilombo' ? 0.05 : 0.025));   // torcida, como a pulso
  foco.copy(mano.l);
}
function manoOn(v) {
  manoSoltarPov();
  mano = v ? { obj: null, tipo: null, t: 0, hold: 0, muerto: 0, reloj: 0, corte: 1 } : null;
  if (v) { sel = null; pov = false; const cs = document.getElementById('camSel'); if (cs) cs.hidden = true; if (pelea) manoElegir(pelea, false); }
  else { camera.fov = 38; camera.updateProjectionMatrix(); }
  const b = document.getElementById('bMano'); if (b) b.classList.toggle('on', !!v);
  const rec = document.getElementById('recMano'); if (rec) rec.hidden = !v;
}

/* ---------- bokeh: desenfoque leve de lo que está lejos del gladiador que se mira ---------- */
let post = null, bokeh = 0;
function initPost() {
  if (!renderer.capabilities.isWebGL2 && !renderer.extensions.has('WEBGL_depth_texture')) return;   // sin textura de profundidad no hay bokeh
  // con WebGL2 el dibujo intermedio también lleva bordes suaves (si no, el desenfoque dejaba dientes de sierra en lo que está en foco)
  const rt = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }) : new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  if (rt.samples != null) rt.samples = 4;
  rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.UnsignedIntType;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, px: { value: new THREE.Vector2(0.001, 0.001) }, near: { value: 0.1 }, far: { value: 200 }, foco: { value: 10 }, fuerza: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tC, tD; uniform vec2 px; uniform float near, far, foco, fuerza; varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
      float coc(vec2 uv){ float z = lin(texture2D(tD, uv).x); return clamp(abs(z - foco) / (foco * 0.55) - 0.12, 0.0, 1.0); }
      void main(){
        float c0 = coc(vUv), r = c0 * fuerza * 5.0 / max(px.x * 1400.0, 0.5) * 1.0;
        vec4 suma = texture2D(tC, vUv); float n = 1.0;
        if (r > 0.35) {
          for (int i = 0; i < 16; i++) {   // disco en espiral (ángulo dorado)
            float fi = float(i) + 0.5, rr = sqrt(fi / 16.0) * r, a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * rr * px;
            float ci = coc(vUv + o);
            float w = ci >= c0 * 0.6 ? 1.0 : 0.25;   // lo enfocado de adelante no se derrama sobre el fondo
            suma += texture2D(tC, vUv + o) * w; n += w;
          }
        }
        gl_FragColor = suma / n;
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const esc = new THREE.Scene(); esc.add(quad);
  post = { rt, mat, esc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}
function dibujarEscena(dt) {
  // cuánto bokeh: lockeado en un gladiador o en cinemática = todo; con zoom = según qué tan cerca
  if (mano && manoPost) {   // cámara en mano: todo pasa por el filtro (sin barras de vida, es una toma de TV)
    const u = manoPost.mat.uniforms; u.t.value = (performance.now() / 1000) % 60; u.corte.value = mano.corte || 0;   // el tiempo acotado: con números grandes los celus se quedan sin precisión y la imagen se va a negro
    renderer.setRenderTarget(manoPost.rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(manoPost.esc, manoPost.cam);
    const rec = document.getElementById('recT'); if (rec) { const tt = mano.reloj || 0; rec.textContent = `${String(Math.floor(tt / 60)).padStart(2, '0')}:${String(Math.floor(tt % 60)).padStart(2, '0')}:${String(Math.floor((tt % 1) * 24)).padStart(2, '0')}`; }
    return;
  }
  const meta = !post || pov || AJ().nivel() !== 'alto' ? 0 : (sel != null || cine) ? 1 : Math.max(0, Math.min(1, (17 - (cam.dd || 30)) / 7));
  bokeh += (meta - bokeh) * Math.min(1, dt * 3);
  if (!post || bokeh < 0.03) { camera.layers.enable(1); renderer.render(scene, camera); camera.layers.disable(1); return; }   // sin desenfoque: una sola pasada con las barras incluidas
  else {
    const u = post.mat.uniforms;
    u.near.value = camera.near; u.far.value = camera.far; u.fuerza.value = bokeh;
    u.foco.value = Math.max(2, camera.position.distanceTo(foco));
    renderer.setRenderTarget(post.rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(post.esc, post.cam);
  }
  // las barras de vida van en su propia capa y se dibujan encima, después del desenfoque: así nunca se ven borrosas
  const ac = renderer.autoClear, bg = scene.background; renderer.autoClear = false; scene.background = null; camera.layers.set(1);   // (un fondo de color forzaría a borrar la pantalla)
  renderer.render(scene, camera);
  camera.layers.set(0); scene.background = bg; renderer.autoClear = ac;
}
let shake = 0;
/* ---------- seguir a un gladiador / su punto de vista ---------- */
let sel = null, pov = false, povAng = 0;
const foco = new THREE.Vector3(0, 0.5, 0);
cam.dl = 10;
function tocar(cx, cy) {
  if (!pelea) return;
  const r = renderer.domElement.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
  let mejor = null, md = Infinity;
  const v3 = new THREE.Vector3();
  for (const f of pelea.fighters) {
    const pie = v3.set(f.x, 0, f.z).project(camera); if (pie.z > 1) continue;
    const bx = (pie.x + 1) / 2 * r.width, by = (1 - pie.y) / 2 * r.height;
    const tope = v3.set(f.x, f.g.altura, f.z).project(camera); const ty = (1 - tope.y) / 2 * r.height;
    const alto = Math.max(24, by - ty), ancho = Math.max(22, alto * 0.55);
    if (px < bx - ancho / 2 || px > bx + ancho / 2 || py < ty - 6 || py > by + 6) continue;
    const d = Math.hypot(px - bx, py - (by + ty) / 2) - (M.enPie(f) ? 8 : 0);
    if (d < md) { md = d; mejor = f; }
  }
  if (mejor) seguir(mejor.id); else if (!pov) seguir(null);
}
function empezarCine(f, tipo) {
  cine = { id: f.id, t: 0, dur: tipo === 'lobo' ? 3.2 : 2.6, tipo };
  const st = document.getElementById('stage'); if (!st) return;
  const old = document.getElementById('cineB'); if (old) old.remove();
  const t = pelea.equipos[f.team];
  const b = document.createElement('div'); b.id = 'cineB'; b.className = 'cine ' + tipo;
  b.innerHTML = `<div class="cb1">${tipo === 'lobo' ? '¡HOMBRE LOBO!' : '¡SE REARMA!'}</div><div class="cb2" style="color:${t.color}">${f.g.nombre} · ${t.nombre}</div>`;
  st.appendChild(b);
  shake = Math.max(shake, 0.35);
}
function seguir(id) {
  if (id != null && mano) manoOn(false);   // tocar a uno saca la cámara en mano
  if (sel != null && V[sel]) V[sel].spr.visible = true;
  pov = false; sel = id;
  if (id != null) { const f = pelea.fighters[id]; cam.dl = Math.max(6, f.g.altura * 4.5); }
  pintarSel();
}
function verPov(on) {
  if (sel == null) return;
  pov = on;
  const v = V[sel]; v.spr.visible = !on;
  if (on) povAng = pelea.fighters[sel].facing;
  pintarSel();
}
function pintarSel() {
  document.querySelectorAll('#right .row2').forEach((r) => r.classList.toggle('sel', sel != null && r.id === 'fr' + sel));
  const box = document.getElementById('camSel'); if (!box) return;
  if (sel == null || !pelea) { box.hidden = true; return; }
  const f = pelea.fighters[sel], t = pelea.equipos[f.team];
  box.hidden = false;
  box.innerHTML = `<span class="sw" style="background:${t.color}"></span><b>${f.g.nombre}</b><span class="meta">${razaVis(f)}</span>
    <button id="camPov" class="${pov ? 'on' : ''}" title="Ver con sus ojos">👁</button><button id="camX" title="Soltar la cámara">✕</button>`;
  box.querySelector('#camPov').onclick = () => verPov(!pov);
  box.querySelector('#camX').onclick = () => seguir(null);
}
function updateCamera(dt) {
  shake = Math.max(0, shake - dt * 2.5);
  const sx = (Math.random() - 0.5) * shake * 0.6, sy = (Math.random() - 0.5) * shake * 0.6;
  const f = sel != null && pelea ? pelea.fighters[sel] : null;
  if (f && pov) {
    // si cae, se rinde o muere, la cámara vuelve a seguirlo desde afuera
    if (!M.enPie(f)) { verPov(false); }
    else {
      let d = f.facing - povAng; d = Math.atan2(Math.sin(d), Math.cos(d)); povAng += d * Math.min(1, dt * 7);
      const dx = Math.cos(povAng), dz = Math.sin(povAng), h = f.g.altura * 0.9;
      camera.fov = 62; camera.updateProjectionMatrix();
      camera.position.set(f.x - dx * 0.12 + sx * 0.3, h + sy * 0.3, f.z - dz * 0.12);
      camera.lookAt(f.x + dx * 6, h * 0.62, f.z + dz * 6);
      return;
    }
  }
  if (!mano && camera.fov !== 38) { camera.fov = 38; camera.updateProjectionMatrix(); }
  if (intro && camIntro(dt)) return;
  if (cine && pelea && pelea.fighters[cine.id]) {   // la cámara va al que se transforma / se rearma
    const cf = pelea.fighters[cine.id], kc = Math.min(1, dt * 4);
    foco.lerp(new THREE.Vector3(cf.x, cf.g.altura * 0.55, cf.z), kc);
    cam.dd = cam.dd === undefined ? 8 : cam.dd + (Math.max(4.5, cf.g.altura * 3) - cam.dd) * kc;
    cam.th += dt * 0.35;
    camera.position.set(foco.x + Math.sin(cam.th) * Math.sin(0.95) * cam.dd + sx, foco.y + Math.cos(0.95) * cam.dd + sy, foco.z + Math.cos(cam.th) * Math.sin(0.95) * cam.dd);
    camera.lookAt(foco);
    return;
  }
  if (mano && pelea) { camMano(dt); return; }
  const k = Math.min(1, dt * 5);
  let dist = f ? cam.dl : cam.d;
  if (f) foco.lerp(new THREE.Vector3(f.x, f.g.altura * 0.45, f.z), k);
  else if (cam.auto && pelea && (cam.pausaAuto = Math.max(0, (cam.pausaAuto || 0) - dt)) <= 0) {
    // cámara automática: va a donde está la acción (los que pegan y reciben pesan más) y se acerca o aleja según lo desparramada que esté
    let sx2 = 0, sz2 = 0, sw = 0; const pts = [];
    for (const g of pelea.fighters) {
      if (!M.enPie(g)) continue;
      const w = 1 + (g.action ? 2.5 : 0) + (g.fxv.hurt > 0 ? 3 : 0) + (g.stagger > 0 ? 1.5 : 0);
      sx2 += g.x * w; sz2 += g.z * w; sw += w; pts.push([g, w]);
    }
    if (sw > 0) {
      const cx = sx2 / sw, cz = sz2 / sw;
      let esp = 0, ew = 0; for (const [g, w] of pts) { esp += Math.hypot(g.x - cx, g.z - cz) * w; ew += w; }
      esp /= ew;
      const ka = Math.min(1, dt * 1.2);
      foco.lerp(new THREE.Vector3(cx, 0.7, cz), ka);
      cam.dAuto = cam.dAuto === undefined ? cam.d : cam.dAuto + (Math.max(11, Math.min(30, esp * 2.6 + 9)) - cam.dAuto) * ka;
      dist = cam.dAuto;
    }
  } else foco.lerp(new THREE.Vector3(0, 0.5, 0), k);
  cam.dd = cam.dd === undefined ? dist : cam.dd + (dist - cam.dd) * k;
  camera.position.set(foco.x + Math.sin(cam.th) * Math.sin(cam.ph) * cam.dd + sx, foco.y + Math.cos(cam.ph) * cam.dd + sy, foco.z + Math.cos(cam.th) * Math.sin(cam.ph) * cam.dd);
  // si queda detrás del muro, la subo para que no se meta entre el público
  // si quedaría detrás del muro (entre el público), la acerco por la misma línea hasta quedar dentro de la arena
  if (!pelea || pelea.cfg.modo !== 'campeones') {
    const L = R.COMBATE.arenaRadio - 0.8, ox = camera.position.x - foco.x, oz = camera.position.z - foco.z;
    if (Math.hypot(camera.position.x, camera.position.z) > L) {
      const a = ox * ox + oz * oz, b = 2 * (foco.x * ox + foco.z * oz), c = foco.x * foco.x + foco.z * foco.z - L * L;
      const t = Math.max(0.45, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a));
      if (t < 1) { camera.position.x = foco.x + ox * t; camera.position.z = foco.z + oz * t; camera.position.y = foco.y + (camera.position.y - foco.y) * Math.max(t, 0.8) + (1 - t) * 3; }
    }
  }
  camera.lookAt(foco);
}

/* ---------- luchadores ---------- */
let V = [];   // visuales por luchador
/* ---------- gladiadores 3D de cubitos (carne por capas) ---------- */
let VX = null;   // efectos compartidos: sangre y cubitos sueltos
const AJ = () => window.Ajustes || { q: () => 1, pr: () => Math.min(2, window.devicePixelRatio), fx: () => true, nivel: () => 'alto' };
const CALIDAD3D = () => AJ().q();
const MODO3D = () => !!window.Voxel && Voxel.modo3D();
const hexDe = (c) => (typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c);
function crear3D(f, v, color, lobo) {
  if (v.G) v.G.limpiar();
  const mat = new THREE.MeshLambertMaterial();
  const G = Voxel.gladiador(scene, VX, { material: mat });
  const raza = lobo ? 'lobo' : f.g.raza === 'esqueleto' ? 'esqueleto' : M.razaVisual(f.g, false) === 'loboT' ? 'lobo' : (Voxel.RAZAS.includes(M.razaVisual(f.g, false)) ? M.razaVisual(f.g, false) : 'humano');
  G.nuevo({ semilla: String(f.g.id), raza, altura: f.g.altura * (lobo ? R.RAZAS.lobo.transforma.crece : 1), tela: hexDe(color), arma: lobo ? 'garras' : f.g.equipo.arma, escudo: lobo ? 'ninguno' : f.g.equipo.escudo, armadura: f.g.equipo.armadura, protesis: lobo ? null : f.g.protesis, jefe: f.g.jefe, esbirro: f.g.esbirro, ojosRojos: !!f.g.resucitado, piel: !lobo && (f.g.jefe || f.g.esbirro || f.g.raza === 'humano' || f.g.raza === 'lobo') ? parseInt(M.pielDe(f.g).slice(1), 16) : undefined, motor: true, padre: v.grp });
  v.G = G; v.mat = mat; v.spr = G.raiz; v.esLobo = !!lobo;
  v.rot = v.rot == null ? Math.atan2(Math.cos(f.facing), Math.sin(f.facing)) : v.rot;
}
// por la espalda se pega estocada (lo calcula cada pantalla, así lo ve igual el que mira de afuera)
const deEspalda = (f) => { const a = f.action, t = a && a.target != null && pelea.fighters[a.target]; if (!t) return false; let d = Math.atan2(f.z - t.z, f.x - t.x) - t.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) > R.COMBATE.espalda; };
// qué golpe tira: depende del arma, de a dónde apunta (cabeza o cuerpo), de si es un golpe cargado y va variando para que no repita
const LARGO_ARMA = { gladius: 0.62, lanza: 1.7, martillo: 0.85, cestus: 0.08, daga: 0.3, garras: 0.15 };
// de qué lado le llega el golpe al que lo recibe (para que se doble hacia el otro)
const ladoDe = (a, d) => (Math.sin(Math.atan2(a.z - d.z, a.x - d.x) - d.facing) >= 0 ? -1 : 1);
function clipArma(f, n = 0) {
  if (lobOn(f)) return 'zarpazo';
  const a = f.action || {}, arma = armaDe(f), cab = a.zone ? a.zone === 'head' : n % 2 === 0;
  if (a.tipo === 'remate') return arma === 'cestus' ? 'gancho' : arma === 'martillo' ? 'mazazo' : 'ejecucion';
  if (arma === 'lanza') return 'estocada';
  if (arma === 'martillo') return cab || a.heavy && n % 3 ? 'mazazo' : 'barrido';
  if (arma === 'cestus') return a.heavy ? 'gancho' : ['directo', 'cruzado', 'gancho', 'directo'][n % 4];
  if (arma === 'daga') return deEspalda(f) ? 'punalada' : cab ? ['tajo', 'reves'][n % 2] : ['punalada', 'tajoBajo', 'punalada'][n % 3];
  if (deEspalda(f)) return 'estocada';
  if (a.heavy) return cab ? 'tajo' : ['barrido', 'tajoBajo'][n % 2];
  return cab ? ['tajo', 'reves', 'tajo'][n % 3] : ['tajoBajo', 'estocada', 'reves'][n % 3];
}
const PIXH = (raza) => S.alturaPx(raza);
// cómo se ve cada luchador (el hombre lobo parece humano hasta que se transforma)
const lobOn = (f) => !!(f.lobo && f.lobo.on);
function specVis(f, color) {
  // hd: dibujo al doble con carne por capas · motor: las fracturas y cortes los decide la pelea, la carne solo los muestra
  if (lobOn(f)) return { id: f.g.id, raza: 'loboT', color, piel: R.RAZAS.lobo.pelaje, arma: 'garras', escudo: 'ninguno', armadura: f.g.equipo.armadura, hd: true, motor: true, sinContorno: true };
  return { id: f.g.id, raza: M.razaVisual(f.g, false), color, piel: M.pielDe(f.g), ...f.g.equipo, protesis: f.g.protesis || null, hd: true, motor: true, sinContorno: true };
}
const razaVis = (f) => (lobOn(f) ? R.RAZAS.lobo.label : M.razaLabel(f.g, false));
// el lobo se transforma: cambia su muñeco por el de la bestia (más grande)
// cada cuánto se redibuja un gladiador: los que se ven chicos (lejos) se actualizan menos, para que ande en el celu
function rigHz(f, v) {
  if (sel === f.id || (cine && cine.id === f.id)) return 30;
  const d = camera.position.distanceTo(new THREE.Vector3(f.x, f.g.altura * 0.5, f.z));
  const px = (f.g.altura / Math.max(0.1, d)) * (renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360)));
  return px > 60 ? 30 : px > 30 ? 20 : 15;
}
// material del gladiador: el contorno oscuro de 1 pixel lo dibuja la placa de video (mucho más barato que en el lienzo)
function matGladiador(tex, E) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 });
  m.userData.px = { value: new THREE.Vector2(E / tex.image.width, E / tex.image.height) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPx = m.userData.px;
    sh.fragmentShader = 'uniform vec2 uPx;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 texelColor = texture2D( map, vUv );
      if (texelColor.a < 0.5) {
        float a = max(max(texture2D(map, vUv + vec2(uPx.x, 0.0)).a, texture2D(map, vUv - vec2(uPx.x, 0.0)).a), max(texture2D(map, vUv + vec2(0.0, uPx.y)).a, texture2D(map, vUv - vec2(0.0, uPx.y)).a));
        if (a > 0.5) texelColor = vec4(0.086, 0.059, 0.039, 1.0);
      }
      texelColor = mapTexelToLinear( texelColor );
      diffuseColor *= texelColor;`);
  };
  return m;
}
function aLobo(f, v) {
  const t = pelea.equipos[f.team];
  if (v.G) { crear3D(f, v, t.color, true); v.G.anim('festejo'); v.anim = 'victoria'; const row = document.getElementById('fr' + f.id); if (row) { const im = row.querySelector('img'); im.src = mini(f, t.color); im.title = razaVis(f); } if (sel === f.id) pintarSel(); return; }
  v.rig = window.Rig.crear(specVis(f, t.color)); v.rig.anim('victoria');
  v.tex.dispose(); v.tex = new THREE.CanvasTexture(v.rig.canvas); v.tex.magFilter = THREE.NearestFilter; filtroLejos(v.tex);
  v.mat.map = v.tex; v.mat.userData.px.value.set((v.rig.escala || 1) / v.rig.canvas.width, (v.rig.escala || 1) / v.rig.canvas.height); v.mat.needsUpdate = true;
  const alto = f.g.altura * R.RAZAS.lobo.transforma.crece, k = alto / v.rig.alto;
  v.size = { w: Rig.W * k, h: Rig.H * k }; v.bar.position.y = alto + 0.22;
  v.esLobo = true; v.anim = 'victoria'; v.rigAcc = 1;
  const row = document.getElementById('fr' + f.id); if (row) { const im = row.querySelector('img'); im.src = mini(f, t.color); im.title = razaVis(f); }
  if (sel === f.id) pintarSel();
}
const blobTex = () => canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
let BLOB;
/* ---------- sombras y aros de equipo de TODOS los gladiadores en dos dibujos (antes eran dos por gladiador) ----------
   Cada gladiador tiene una "sombra" y un "aro" de mentira (no se dibujan): guardan dónde van, tamaño y transparencia,
   y cada cuadro se copian a dos mallas compartidas. */
let sombrasIM = null, arosIM = null;
function capaAlfa(mat) {   // agrega transparencia por gladiador a una malla compartida
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float iAlfa;\nvarying float vAlfa;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlfa = iAlfa;');
    sh.fragmentShader = 'varying float vAlfa;\n' + sh.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.a *= vAlfa;\n#include <fog_fragment>');
  };
  return mat;
}
function armarCompartidos(n) {
  for (const im of [sombrasIM, arosIM]) if (im) { scene.remove(im); im.geometry.dispose(); }
  const pg = new THREE.PlaneGeometry(1, 1); pg.setAttribute('iAlfa', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1));
  sombrasIM = new THREE.InstancedMesh(pg, capaAlfa(new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false })), n);
  const rg = new THREE.RingGeometry(1.15, 1.45, 28); rg.setAttribute('iAlfa', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1));
  arosIM = new THREE.InstancedMesh(rg, capaAlfa(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })), n);
  for (const im of [sombrasIM, arosIM]) { im.frustumCulled = false; im.count = n; scene.add(im); }
  sombrasIM.renderOrder = -1;
}
// todas las barras de vida en un solo dibujo (antes una imagen por gladiador que se volvía a subir cada vez que cambiaba)
let barrasIM = null;
function armarBarras(n) {
  if (barrasIM) { scene.remove(barrasIM); barrasIM.geometry.dispose(); }
  const geo = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(1, 1);
  geo.index = q.index; geo.attributes.position = q.attributes.position; geo.attributes.uv = q.attributes.uv;
  const at = (nom, k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * k), k); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(nom, a); return a; };
  at('iPos', 3); at('iTam', 2); at('iDat', 4); at('iAlfa', 1); geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `attribute vec3 iPos; attribute vec2 iTam; attribute vec4 iDat; attribute float iAlfa; varying vec2 vUv; varying vec4 vDat; varying float vA;
      void main(){ vUv = uv; vDat = iDat; vA = iAlfa; vec4 mv = modelViewMatrix * vec4(iPos, 1.0); mv.xy += position.xy * iTam; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec4 vDat; varying float vA;
      void main(){ if (vDat.z < 0.5 || vA < 0.01) discard; float px = floor(vUv.x * 40.0), fila = floor((1.0 - vUv.y) * 4.0);
        vec4 c = vec4(0.04, 0.024, 0.016, 0.75);
        if (fila < 3.0) { if (px < floor(40.0 * vDat.x + 0.5)) c = vec4(vDat.x > 0.5 ? vec3(0.486, 0.788, 0.373) : vDat.x > 0.2 ? vec3(0.91, 0.659, 0.235) : vec3(0.878, 0.227, 0.165), 1.0); }
        else if (px < floor(40.0 * vDat.y + 0.5)) c = vec4(vDat.w > 0.5 ? vec3(0.541, 0.478, 0.227) : vec3(0.941, 0.863, 0.416), 1.0);
        gl_FragColor = vec4(c.rgb, c.a * vA); }` });
  barrasIM = new THREE.Mesh(geo, mat); barrasIM.frustumCulled = false; barrasIM.renderOrder = 10; barrasIM.layers.set(1); scene.add(barrasIM);
}
const _bp = new THREE.Vector3();
function pasarBarras() {
  if (!barrasIM) return;
  const A = barrasIM.geometry.attributes;
  V.forEach((v, i) => {
    if (v.barC !== null) return;   // (las de 2D se dibujan solas)
    v.bar.getWorldPosition(_bp);
    A.iPos.setXYZ(i, _bp.x, _bp.y, _bp.z); A.iTam.setXY(i, v.bar.scale.x, v.bar.scale.y);
    const d = v.barDat || [1, 1, 0, 0]; A.iDat.setXYZW(i, d[0], d[1], d[2], d[3]);
    A.iAlfa.setX(i, v.bar.visible && v.grp.visible ? v.bar.material.opacity : 0);
  });
  for (const k of ['iPos', 'iTam', 'iDat', 'iAlfa']) A[k].needsUpdate = true;
}
const _col = new THREE.Color();
function pasarCompartidos() {
  pasarBarras();
  if (!sombrasIM) return;
  const aS = sombrasIM.geometry.attributes.iAlfa, aR = arosIM.geometry.attributes.iAlfa;
  V.forEach((v, i) => {
    if (!v.sombraF) return;
    v.grp.updateMatrixWorld();
    const sh = v.sombraF, rg = v.aroF;
    sh.updateMatrixWorld(); rg.updateMatrixWorld();
    sombrasIM.setMatrixAt(i, sh.matrixWorld); aS.array[i] = sh.visible && v.grp.visible ? sh.material.opacity : 0;
    arosIM.setMatrixAt(i, rg.matrixWorld); aR.array[i] = rg.visible && v.grp.visible ? rg.material.opacity : 0;
    arosIM.setColorAt(i, _col.set(v.colorEq));
  });
  sombrasIM.instanceMatrix.needsUpdate = arosIM.instanceMatrix.needsUpdate = true; aS.needsUpdate = aR.needsUpdate = true;
  if (arosIM.instanceColor) arosIM.instanceColor.needsUpdate = true;
}
function crearVisuales(s) {
  for (const v of V) { if (v.G) v.G.limpiar(); scene.remove(v.grp); }
  V = [];
  BLOB = BLOB || blobTex();
  const tres = MODO3D();
  if (tres) { Voxel.calidad(CALIDAD3D() * (s.fighters.length > 12 ? 0.9 : 1)); if (!VX) VX = Voxel.crearEfectos(scene, false); armarCompartidos(s.fighters.length); armarBarras(s.fighters.length); }
  else for (const im of [sombrasIM, arosIM, barrasIM]) if (im) { scene.remove(im); }   // con muchos en la arena, un poquito menos de detalle
  for (const f of s.fighters) {
    const t = s.equipos[f.team];
    if (tres) {
      const grp = new THREE.Group(); scene.add(grp);
      // sombra y aro "de mentira": se dibujan todos juntos en pasarCompartidos()
      const shadow = new THREE.Object3D(); shadow.material = { opacity: 1 };
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(f.radio * 3.2, f.radio * 2.2, 1);
      const ring = new THREE.Object3D(); ring.material = { opacity: 0.85 }; ring.scale.setScalar(f.radio);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
      // barra de vida "de mentira": todas las barras se dibujan juntas (pasarCompartidos)
      const barC = null, barT = null, bar = new THREE.Object3D(); bar.material = { opacity: 0 };
      bar.scale.set(0.62, 0.062, 1); bar.position.y = f.g.altura + 0.22;
      grp.add(shadow, ring, bar);
      const v = { sombraF: shadow, aroF: ring, colorEq: t.color, shadow, px: f.x, pz: f.z, paso: 0, pie: 0, rastro: 0, grp, anim: 'quieto', evAnim: null, evT: 0, quietoT: 0, prevHurt: 0, prevFase: null, ring, bar, barC, barT, flip: 1, lastBar: '', flag: null, size: { w: 1, h: 1 } };
      crear3D(f, v, t.color, lobOn(f));
      V.push(v);
      continue;
    }
    // gladiador articulado (rig.js): se redibuja en su lienzo y se sube como textura
    const rig = window.Rig.crear(specVis(f, t.color));
    const tex = new THREE.CanvasTexture(rig.canvas); tex.magFilter = THREE.NearestFilter; filtroLejos(tex);
    const mat = matGladiador(tex, rig.escala || 1);
    const spr = new THREE.Sprite(mat);
    const k = f.g.altura / rig.alto, size = { w: Rig.W * k, h: Rig.H * k };
    spr.center.set(Rig.RAIZ_X / Rig.W, (Rig.H - Rig.SUELO) / Rig.H);
    const grp = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(f.radio * 3.2, f.radio * 2.2, 1);
    const ring = new THREE.Mesh(new THREE.RingGeometry(f.radio * 1.15, f.radio * 1.45, 28), new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    const barC = document.createElement('canvas'); barC.width = 40; barC.height = 4;
    const barT = new THREE.CanvasTexture(barC); barT.magFilter = THREE.NearestFilter;
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false, transparent: true }));
    bar.scale.set(0.62, 0.062, 1); bar.position.y = f.g.altura + 0.22; bar.renderOrder = 10; bar.layers.set(1);
    grp.add(shadow, ring, spr, bar);
    scene.add(grp);
    shadow.material.opacity = 1;
    V.push({ shadow, px: f.x, pz: f.z, paso: 0, pie: 0, rastro: 0, grp, spr, mat, tex, rig, anim: 'quieto', evAnim: null, evT: 0, rigAcc: 1, quietoT: 0, prevHurt: 0, prevFase: null, size, ring, bar, barC, barT, flip: 1, walk: Math.random() * 6, lastBar: '', flag: null });
  }
}
// de lejos: promedia los píxeles (mipmaps) para que no titilen; de cerca siguen nítidos
function filtroLejos(tex) { if (renderer.capabilities.isWebGL2) { tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; } else tex.minFilter = THREE.NearestFilter; }
const LUZ_SOL = new THREE.Color(1, 0.96, 0.9), LUZ_TORRE = new THREE.Color(0.86, 0.84, 1);
// lo que deja cada gladiador en el piso: huellas, polvo, rastro de sangre y charco
const HUELLA = () => (HUELLA.m = HUELLA.m || new THREE.MeshBasicMaterial({ map: canvasTex(16, 24, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(8, 15, 5, 8, 0, 0, Math.PI * 2); g.fill(); }), color: '#8a6a40', transparent: true, opacity: 0.16, depthWrite: false }));
// CALCOS EN EL PISO: manchas, charcos y huellas. Antes cada uno era un objeto aparte (cientos de dibujos por cuadro, lo que más traba al celular);
// ahora todos los de un mismo material van en un solo InstancedMesh, como un anillo: cuando se llena, el más viejo se reemplaza
const CALCOS = new Map(), calcoDum = new THREE.Object3D();
function calco(mat, cap, x, y, z, rz, sx, sy) {
  let c = CALCOS.get(mat);
  if (!c) { const im = new THREE.InstancedMesh(PLANO, mat, cap); im.count = 0; im.frustumCulled = false; im.renderOrder = 1; scene.add(im); c = { im, cap, i: 0, d: [] }; CALCOS.set(mat, c); }
  const id = c.i; c.i = (c.i + 1) % c.cap; if (c.im.count < c.cap) c.im.count++;
  const d = c.d[id] = { x, y, z, rz, sx, sy, gen: (c.d[id] ? c.d[id].gen + 1 : 0) }, gen = d.gen;
  const poner = () => { calcoDum.position.set(d.x, d.y, d.z); calcoDum.rotation.set(-Math.PI / 2, 0, d.rz); calcoDum.scale.set(d.sx, d.sy, 1); calcoDum.updateMatrix(); c.im.setMatrixAt(id, calcoDum.matrix); c.im.instanceMatrix.needsUpdate = true; };
  poner();
  // se devuelve algo con .scale.set() como un Mesh (los charcos crecen); si ya lo pisó uno nuevo, no hace nada
  return { scale: { set(a, b) { if (c.d[id] !== d || d.gen !== gen) return; d.sx = a; d.sy = b; poner(); } } };
}
function limpiarCalcos() { for (const c of CALCOS.values()) { c.im.count = 0; c.i = 0; c.d = []; c.im.instanceMatrix.needsUpdate = true; } }
let huellas = [];
function piso(f, v, dt) {
  const dx = f.x - v.px, dz = f.z - v.pz, d = Math.hypot(dx, dz);
  v.px = f.x; v.pz = f.z;
  if (pelea.cfg.modo !== 'campeones' && M.enPie(f) && d > 0.0005) {
    v.paso += d;
    if (v.paso > 0.75) {   // huella (alterna pie izquierdo y derecho)
      v.paso = 0; v.pie = 1 - v.pie;
      if (window.Sonido) Sonido.paso(posF(f), pesadoF(f));
      const nx = -dz / d, nz = dx / d, o = (v.pie ? 1 : -1) * f.radio * 0.35;
      calco(HUELLA(), 260, f.x + nx * o, 0.009, f.z + nz * o, -Math.atan2(dz, dx) - Math.PI / 2, 0.1 * f.esc, 0.13 * f.esc);
      polvo(f.x + nx * o, f.z + nz * o, d / Math.max(dt, 1e-3) > 2.2 ? 3 : 1, d / Math.max(dt, 1e-3) > 2.2 ? 0.55 : 0.3);   // cada pisada levanta arena
    }
  }
  const sinSangre = f.esp && f.esp.sinSangre;
  // rastro de sangre del que camina herido
  if (!sinSangre && f.sangrado > 0.15 && d > 0) { v.rastro += d; if (v.rastro > 0.22) { v.rastro = 0; mancha(f.x + (Math.random() - 0.5) * 0.2, f.z + (Math.random() - 0.5) * 0.2, 0.025 + Math.min(0.06, f.sangrado * 0.02), dx * 20, dz * 20); } }
  // charco debajo del que está tirado sangrando o muerto
  if (!sinSangre && !v.cae && !M.enPie(f) && f.estado !== 'rendido' && (f.estado === 'muerto' || f.sangrado > 0.1 || Math.max(f.dmg.head, f.dmg.body) > 100)) {
    const meta = f.estado === 'muerto' ? 0.42 + Math.min(0.35, (f.sangrado || 0) * 0.12) : 0.18 + Math.min(0.3, (f.sangrado || 0) * 0.12);
    if (!v.charco) { v.charco = mancha(f.x + f.radio * 1.2 * v.flip, f.z, 0.04, 0, 0, 'charco'); v.charcoR = 0.04; }
    if (v.charcoR < meta) { v.charcoR = Math.min(meta, v.charcoR + dt * 0.05); v.charco.scale.set(v.charcoR * 2.4, v.charcoR * 1.7, 1); }
  }
}
/* ---------- PARTÍCULAS EN UN SOLO DIBUJO ----------
   Sangre, polvo, chispas, astillas, humo y destellos eran cada uno un dibujo aparte (cientos en una pelea grande).
   Ahora cada partícula es "de mentira" (solo datos) y todas se dibujan juntas: una tanda normal y otra encima de todo (destellos). */
const LOTE_MAX = 420;
let lotes = null, atlasPart = null;
function armarAtlas() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32);                                                   // 0: cuadradito (polvo, chispas…)
  TEXS.gota = TEXS.gota || texGota(); g.drawImage(TEXS.gota.image, 32 + 8, 0, 16, 32);              // 1: gota
  g.drawImage(IMPACTO().image, 64, 0, 32, 32); g.drawImage(GARRA().image, 96, 0, 32, 32);           // 2: destello · 3: garrazo
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; return t;
}
function tileDe(map) { if (map === TEXS.gota) return 1; if (map === IMPACTO.t) return 2; if (map === GARRA.t) return 3; return 0; }
function SP(o) {   // como un Sprite, pero no es un objeto de la escena
  const tile = tileDe(o.map), col = new THREE.Color(o.color || (o.map && o.map.colDot) || '#ffffff');
  return { position: new THREE.Vector3(), scale: new THREE.Vector3(1, 1, 1), material: { rotation: 0, opacity: o.opacity != null ? o.opacity : 1, dispose() {} }, tile, col, encima: o.depthTest === false, renderOrder: 0 };
}
function crearLote(encima) {
  const geo = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
  geo.index = q.index; geo.attributes.position = q.attributes.position; geo.attributes.uv = q.attributes.uv;
  const at = (n, k) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(LOTE_MAX * k), k); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, a); return a; };
  const A = { pos: at('iPos', 3), tam: at('iTam', 3), col: at('iCol', 4) };   // tam = ancho, alto, giro · col = rgb + opacidad (+ tile en la parte entera de r)
  const mat = new THREE.ShaderMaterial({
    uniforms: { mapa: { value: atlasPart } }, transparent: true, depthWrite: false, depthTest: !encima,
    vertexShader: `attribute vec3 iPos; attribute vec3 iTam; attribute vec4 iCol; varying vec2 vUv; varying vec4 vCol;
      void main(){ float tile = floor(iCol.r); vCol = vec4(iCol.r - tile, iCol.gba); vUv = vec2((tile + uv.x) / 4.0, uv.y);
        float c = cos(iTam.z), s = sin(iTam.z); vec2 p = vec2(position.x * iTam.x, position.y * iTam.y); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0); mv.xy += p; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D mapa; varying vec2 vUv; varying vec4 vCol; void main(){ vec4 t = texture2D(mapa, vUv); gl_FragColor = vec4(t.rgb * vCol.rgb, t.a * vCol.a); if (gl_FragColor.a < 0.02) discard; }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = encima ? 16 : 2; scene.add(m);
  return { m, geo, A };
}
function dibujarParticulas() {
  if (!lotes) { atlasPart = armarAtlas(); lotes = [crearLote(false), crearLote(true)]; }
  const n = [0, 0];
  for (const p of parts) {
    const sp = p.sp; if (!sp || sp.tile == null) continue;
    const L = lotes[sp.encima ? 1 : 0], i = n[sp.encima ? 1 : 0]; if (i >= LOTE_MAX) continue;
    L.A.pos.setXYZ(i, sp.position.x, sp.position.y, sp.position.z);
    L.A.tam.setXYZ(i, sp.scale.x, sp.scale.y, sp.material.rotation || 0);
    L.A.col.setXYZW(i, sp.tile + Math.min(0.999, sp.col.r), sp.col.g, sp.col.b, sp.material.opacity);
    n[sp.encima ? 1 : 0]++;
  }
  lotes.forEach((L, k) => { L.geo.instanceCount = n[k]; for (const a of Object.values(L.A)) a.needsUpdate = true; L.m.visible = n[k] > 0; });
}
function polvo(x, z, n, fuerza = 1) {
  if (!AJ().fx() || parts.length > PART_MAX() * 0.8) return;
  for (let i = 0; i < n; i++) {
    const sp = SP(({ map: dot(Math.random() < 0.5 ? '#d8bd8a' : '#c4a676'), transparent: true, opacity: 0.7 }));
    const k = (0.07 + Math.random() * 0.13) * (0.8 + fuerza * 0.5); sp.scale.set(k, k, 1); sp.position.set(x + (Math.random() - 0.5) * 0.3, 0.05, z + (Math.random() - 0.5) * 0.3);
    parts.push({ sp, vx: (Math.random() - 0.5) * 1.6 * fuerza, vy: 0.4 + Math.random() * 1.2 * fuerza, vz: (Math.random() - 0.5) * 1.6 * fuerza, life: 0.5 + Math.random() * 0.3, polvo: true });
  }
}
// garrazo del hombre lobo: tres tajos blancos que se abren en el aire
const GARRA = () => (GARRA.t = GARRA.t || canvasTex(64, 64, (g) => { g.strokeStyle = '#fff'; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.lineWidth = 5 - i * 0.6; g.beginPath(); g.moveTo(10 + i * 14, 6 + i * 3); g.quadraticCurveTo(30 + i * 13, 30, 18 + i * 15, 58 - i * 3); g.stroke(); } }));
function garrazo(x, y, z) {
  const sp = SP(({ map: GARRA(), color: '#fff0e0', transparent: true, depthTest: false }));
  sp.position.set(x, y, z); sp.renderOrder = 16;
  parts.push({ sp, vx: 0, vy: 0, vz: 0, life: 0.22, flash: true, s0: 0.95, rot: (Math.random() - 0.5) * 1.2 + (Math.random() < 0.5 ? 0 : Math.PI / 2) });
}
// destello de impacto: estrella blanca que aparece y se achica en el punto donde pegó
const IMPACTO = () => (IMPACTO.t = IMPACTO.t || canvasTex(32, 32, (g) => { g.fillStyle = '#fff'; g.translate(16, 16); for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-2, 0); g.lineTo(0, i % 2 ? -9 : -15); g.lineTo(2, 0); g.fill(); } g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill(); }));
function impactoFx(x, y, z, fuerte) {
  const sp = SP(({ map: IMPACTO(), color: fuerte ? '#ffe27a' : '#ffffff', transparent: true, depthTest: false }));
  sp.position.set(x, y, z); sp.renderOrder = 15;
  parts.push({ sp, vx: 0, vy: 0, vz: 0, life: fuerte ? 0.16 : 0.11, flash: true, s0: fuerte ? 0.7 : 0.45, rot: Math.random() * Math.PI });
}
function camRight() { return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); }

// qué ve la cámara este cuadro (para animar menos seguido a los lejanos o a los que quedan fuera de cuadro)
const _frus = new THREE.Frustum(), _pv = new THREE.Matrix4(), _esf = new THREE.Sphere();
function actualizarVisuales(s, dt, realDt = dt) {
  camera.updateMatrixWorld(); _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frus.setFromProjectionMatrix(_pv);
  const right = camRight();
  for (const f of s.fighters) {
    const v = V[f.id];
    // transformación: primero tiembla y crece, después aparece la bestia
    let crece = 1;
    if (lobOn(f) && !v.esLobo) {
      const enCine = cine && cine.id === f.id && cine.tipo === 'lobo';
      if (enCine && cine.t < 1.1) { crece = 1 + 0.18 * (cine.t / 1.1); v.grp.position.set(f.x + (Math.random() - 0.5) * 0.08, 0, f.z); if (Math.random() < 0.3) humo(f.x, f.g.altura * 0.5, f.z, 2); }
      else { aLobo(f, v); v.flash = 0.12; humo(f.x, f.g.altura * 0.7, f.z, 20); if (cine && cine.id === f.id) { const b = document.getElementById('cineB'); if (b) b.classList.add('aullido'); } }
    }
    if (v.esqCine === undefined) v.esqCine = 0;
    if (cine && cine.id === f.id && cine.tipo === 'esqueleto' && Math.random() < 0.5) huesos(f.x + (Math.random() - 0.5) * 1.2, 0.2 + Math.random() * f.g.altura, f.z + (Math.random() - 0.5) * 1.2, 1, (Math.random() - 0.5), (Math.random() - 0.5));
    v.grp.position.set(f.x, 0, f.z);
    const kIn = intro ? introKf(f) : 1;
    if (intro) { const p = introPos(f, kIn); v.grp.position.x = p[0]; v.grp.position.z = p[1]; v.grp.visible = kIn > 0; } else if (!v.grp.visible) v.grp.visible = true;
    if (v.cae) {   // se cayó de la torre: sale despedido y se pierde en el vacío
      v.cae.t += realDt; const r = Math.hypot(f.x, f.z) || 1, out = 1.5 * v.cae.t;
      v.grp.position.set(f.x + f.x / r * out, -4.9 * v.cae.t * v.cae.t, f.z + f.z / r * out);
      v.ring.visible = false; v.bar.visible = false;
    }
    const dot = Math.cos(f.facing) * right.x + Math.sin(f.facing) * right.z;
    if (Math.abs(dot) > 0.15) v.flip = dot < 0 ? -1 : 1;
    let sx = 1, sy = 1, off = 0, anim = 'quieto', ritmo = 1;
    const tint = new THREE.Color(1, 1, 1);
    const a = f.action;
    if (v.evT > 0) v.evT -= dt;
    if (M.enPie(f)) {
      const sp = Math.hypot(f.vx, f.vz);
      if (sp > 0.25) { anim = 'caminar'; ritmo = Math.min(1.6, 0.5 + sp * 0.6); }
      if (f.fxv.hurt > v.prevHurt + 0.01) { v.evAnim = 'herido'; v.evT = 0.22; }
      v.prevHurt = f.fxv.hurt;
      if (v.evT > 0 && v.evAnim) anim = v.evAnim;
      if (a && a.tipo === 'ataque') {
        if (a.phase === 'carga') { anim = 'carga'; const k = Math.min(1, a.t / a.carga); if (a.heavy) tint.setRGB(1, 0.92 - 0.25 * k, 0.8 - 0.4 * k); }
        else if (a.t < a.recup * 0.6) { anim = 'golpe'; off = 0.3 * Math.max(0, 1 - a.t / 0.2) * f.g.altura * 0.4; }
      }
      if (a && a.tipo === 'remate') { anim = 'remate'; tint.setRGB(1, 0.8, 0.8); }
      if (f.stagger > 0 && anim !== 'golpe') { anim = 'herido'; }
      if (f.fxv.hurt > 0) { const k = f.fxv.hurt / 0.25; tint.setRGB(1, 1 - 0.5 * k, 1 - 0.5 * k); off += (Math.random() - 0.5) * 0.06 * k; }
      if (f.comiendo) anim = 'comer';
      if (v.victoria) anim = 'victoria';
      v.ring.material.opacity = 0.85;
    } else if (f.estado === 'caido') { anim = 'caido'; tint.setRGB(0.75, 0.7, 0.68); v.ring.material.opacity = 0.35; }
    else if (f.estado === 'rendido') { anim = 'rendido'; tint.setRGB(0.85, 0.85, 0.88); v.ring.material.opacity = 0.35; if (!v.flag) { v.flag = texto('🏳', '#fff', 0.5); v.flag.position.y = f.g.altura * 0.85; v.grp.add(v.flag); } }
    else if (f.estado === 'muerto') { anim = 'muerto'; if (f.comido) { v.comidoK = Math.min(1, (v.comidoK || 0) + realDt * 0.8); v.mat.opacity = 1 - v.comidoK; v.mat.transparent = true; } tint.setRGB(0.7, 0.4, 0.38); v.ring.material.opacity = 0.12; if (v.flag) { v.grp.remove(v.flag); v.flag = null; } }
    if (kIn < 1 && M.enPie(f)) { anim = 'caminar'; ritmo = 1.25; }
    if (v.G) { visual3D(f, v, anim, a, ritmo, tint, dt, realDt); continue; }
    // el cuerpo: miembros, cabeza, sangre y cansancio (expresiones)
    if (f.miembros) v.rig.cuerpo({ miembros: f.miembros, decap: !!f.decapitado, sangrado: f.sangrado || 0, cansado: !!f.gassed, malherido: Math.max(f.dmg.head, f.dmg.body) > 65 });
    if (f.sangrado > 0.05 && f.estado !== 'muerto' && Math.random() < f.sangrado * realDt * 2.5) { sangre(f.x, f.g.altura * 0.45, f.z, 1, 0.15); }
    if (!(f.esp && f.esp.sinSangre)) chorrosArterias(f, v, realDt);
    // el golpe arranca cada vez que entra en la fase de impacto
    const fase = a ? a.tipo + a.phase : null;
    if (anim === 'golpe' && v.prevFase !== fase) v.rig.anim('golpe');
    else if (anim !== v.anim) v.rig.anim(anim);
    v.anim = anim; v.prevFase = fase;
    // redibujar a ~30 cuadros; los que ya quedaron tirados se congelan
    const quieto = anim === 'muerto' || anim === 'caido' || anim === 'rendido';
    v.quietoT = quieto ? v.quietoT + realDt : 0;
    v.rigAcc += dt * ritmo;
    const hz = rigHz(f, v);
    if (v.quietoT < 2 && (v.rigAcc >= 1 / hz || (hitStop > 0 && hz >= 24))) { if (hitStop <= 0) v.rig.paso(v.rigAcc); v.rigAcc = 0; v.tex.needsUpdate = true; }
    if (v.flash > 0) { v.flash -= realDt; tint.setRGB(6, 6, 6); }
    // luz del lugar: más oscuro contra la pared, cálido al sol (en la torre, frío)
    const rr2 = Math.hypot(f.x, f.z) / (pelea.cfg.modo === 'campeones' ? R.CAMPEONES.radioTorre : R.COMBATE.arenaRadio);
    const luz = 1 - 0.22 * Math.max(0, (rr2 - 0.55) / 0.45);
    v.mat.color.copy(tint).multiply(pelea.cfg.modo === 'campeones' ? LUZ_TORRE : LUZ_SOL).multiplyScalar(luz);
    // sombra: más larga si está tirado
    const tirado = !M.enPie(f) && f.estado !== 'rendido';
    v.shadow.scale.set(f.radio * (tirado ? 7 : 3.4), f.radio * (tirado ? 2.6 : 2.3), 1);
    v.shadow.position.x = tirado ? f.radio * 1.2 * v.flip : 0;
    piso(f, v, realDt);
    v.spr.scale.set(v.size.w * sx * v.flip * crece, v.size.h * sy * crece, 1);
    v.spr.position.set(Math.cos(f.facing) * off, 0, Math.sin(f.facing) * off);
    // en primera persona: no se ve a sí mismo y las barras de los que tiene encima no tapan la vista
    if (pov && sel != null) { const o = s.fighters[sel]; v.bar.visible = f.id !== sel && Math.hypot(f.x - o.x, f.z - o.z) > 3; }
    else v.bar.visible = !v.cae;
    // barras: vida (zona más castigada) y aire
    const hp = hpDe(f), en = f.energy / 100;
    // barra finita: solo se ve si está lastimado, sin aire o lo estás siguiendo; de cerca se achica para no tapar la cara
    const mostrar = M.enPie(f) && (hp < 0.97 || en < 0.8 || sel === f.id || v.barVista > 0);
    if (hp < 0.97) v.barVista = 3; else v.barVista = Math.max(0, (v.barVista || 0) - realDt);
    v.bar.material.opacity += ((mostrar ? 1 : 0) - v.bar.material.opacity) * Math.min(1, realDt * 6);
    const dCam = camera.position.distanceTo(v.grp.position), kb = Math.min(1, Math.max(0.35, dCam / 22));
    v.bar.scale.set(0.62 * kb, 0.062 * kb, 1);
    const key = `${(hp * 30) | 0}|${(en * 15) | 0}|${f.estado}|${f.gassed}`;
    if (key !== v.lastBar) {
      v.lastBar = key;
      const g = v.barC.getContext('2d'); g.clearRect(0, 0, 40, 4);
      if (M.enPie(f)) {
        g.fillStyle = 'rgba(10,6,4,.75)'; g.fillRect(0, 0, 40, 4);
        g.fillStyle = hp > 0.5 ? '#7cc95f' : hp > 0.2 ? '#e8a83c' : '#e03a2a'; g.fillRect(0, 0, Math.round(40 * hp), 3);
        g.fillStyle = f.gassed ? '#8a7a3a' : '#f0dc6a'; g.fillRect(0, 3, Math.round(40 * en), 1);
      }
      v.barT.needsUpdate = true;
    }
  }
}

// la parte 3D de actualizarVisuales: pose, mirar hacia donde va, estado del cuerpo
function visual3D(f, v, anim, a, ritmo, tint, dt, realDt) {
  if (v.G.rag && f.estado !== 'muerto') crear3D(f, v, pelea.equipos[f.team].color, lobOn(f));   // el esqueleto se rearma: cuerpo nuevo
  const G = v.G;
  // gira hacia donde mira (suave)
  // cuando ataca, el cuerpo apunta derecho al rival (así el arma llega a donde tiene que llegar)
  const ob = a && (a.tipo === 'ataque' ? pelea.fighters[a.target] : a.tipo === 'remate' ? pelea.fighters[a.v != null ? a.v : a.target] : null);
  const meta = ob && ob !== f ? Math.atan2(ob.x - f.x, ob.z - f.z) : Math.atan2(Math.cos(f.facing), Math.sin(f.facing));
  let d = meta - v.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); v.rot += d * Math.min(1, realDt * 12);
  if (!G.rag) v.grp.rotation.y = v.rot;
  G.sincronizar(f.miembros, !!f.decapitado);
  const fase = a ? a.tipo + a.phase : null;
  if (f.estado === 'muerto') { if (!G.rag) { G.ultDir = v.ultDir || null; G.caer(true); } }
  else {
    G.modo = M.enPie(f) ? (f.comiendo ? 'comer' : 'pie') : f.estado === 'caido' ? 'tirado' : f.estado === 'rendido' ? 'rendido' : 'pie';
    // un golpe nuevo: se elige cuál (va variando) y se calcula cuánto hay que estirarse y a qué altura apuntar
    if (fase && fase !== v.prevFase && (anim === 'carga' || !v.clipAct || (anim === 'remate'))) { v.nAtk = (v.nAtk || 0) + 1; v.clipAct = clipArma(f, v.nAtk + f.id); }
    const ci = v.clipAct && Voxel.clipInfo(v.clipAct);
    if (ci && ob && (anim === 'carga' || anim === 'golpe' || anim === 'remate')) {
      const dist = Math.hypot(ob.x - f.x, ob.z - f.z), esc = f.g.altura / 1.75, tirado = !M.enPie(ob);
      G.lunge = Math.max(-0.3, Math.min(0.8, dist - ob.radio * 0.5 - (0.5 + (LARGO_ARMA[lobOn(f) ? 'garras' : armaDe(f)] || 0.5)) * esc));
      const hObj = tirado ? 0.15 : ob.g.altura * (a.zone === 'body' ? 0.55 : 0.88), hHombro = f.g.altura * 0.78;
      G.aim = tirado ? 0 : Math.max(-0.6, Math.min(0.6, Math.atan2(hObj - hHombro, Math.max(0.6, dist)) + (a.zone === 'body' ? 0.12 : 0)));
    }
    if ((anim === 'carga' || anim === 'remate') && ci) {
      const sw = ci.imp - ci.tw, cg = anim === 'remate' ? a.dur || a.carga || 1 : a.carga || 0.25, falta = cg - a.t;
      G.carga = v.clipAct; G.cargaT = falta > sw ? ci.tw * (() => { const u = Math.min(1, a.t / Math.max(0.05, cg - sw)); return u * u * (3 - 2 * u); })() : Math.max(0, ci.imp - falta);
    } else G.carga = null;
    if (ci && ((anim === 'golpe' && v.prevFase !== fase) || (v.anim === 'remate' && anim !== 'remate'))) G.anim(v.clipAct, ci.imp);   // el contacto: de acá en más, el arma sigue de largo y vuelve a la guardia
    if (anim === 'victoria' && v.anim !== 'victoria') G.anim('festejo');
    else if (anim === 'caminar') { if (G.base !== 'caminar') G.anim('caminar'); const vf = f.vx * Math.cos(f.facing) + f.vz * Math.sin(f.facing); G.ritmo = vf < -0.3 ? -ritmo * 0.85 : ritmo; }   // si retrocede, camina para atrás
    else if (anim === 'quieto' || anim === 'herido') { if (G.base !== 'quieto') G.anim('quieto'); G.ritmo = 1; }
    if (f.gassed && G.expr === 'normal') G.expresion('dolor', 0.3);
  }
  v.anim = anim; v.prevFase = fase;
  // animar menos seguido (15 por segundo) a los que están lejos o fuera de cuadro: de lejos no se nota
  _esf.center.set(f.x, f.g.altura * 0.5, f.z); _esf.radius = f.g.altura;
  const lejos = !_frus.intersectsSphere(_esf) || camera.position.distanceTo(_esf.center) > 22;
  v.pasoAcc = (v.pasoAcc || 0) + dt;
  if (hitStop <= 0 && (!lejos || v.pasoAcc >= 1 / 15 || a)) { G.paso(v.pasoAcc); v.pasoAcc = 0; }
  if (v.flash > 0) { v.flash -= realDt; tint.setRGB(1.8, 1.8, 1.8); }
  const rr2 = Math.hypot(f.x, f.z) / (pelea.cfg.modo === 'campeones' ? R.CAMPEONES.radioTorre : R.COMBATE.arenaRadio);
  const luz = 1 - 0.22 * Math.max(0, (rr2 - 0.55) / 0.45);
  v.mat.color.copy(tint).multiply(pelea.cfg.modo === 'campeones' ? LUZ_TORRE : LUZ_SOL).multiplyScalar(luz);
  const tirado = !M.enPie(f) && f.estado !== 'rendido';
  v.shadow.visible = !G.rag; v.shadow.scale.set(f.radio * (tirado ? 6 : 3.4), f.radio * (tirado ? 3 : 2.3), 1);
  piso(f, v, realDt);
  // barras igual que en 2D
  if (pov && sel != null) { const o = pelea.fighters[sel]; v.bar.visible = f.id !== sel && Math.hypot(f.x - o.x, f.z - o.z) > 3; } else v.bar.visible = !v.cae;
  const hp = hpDe(f), en = f.energy / 100;
  const mostrar = M.enPie(f) && (hp < 0.97 || en < 0.8 || sel === f.id || v.barVista > 0);
  if (hp < 0.97) v.barVista = 3; else v.barVista = Math.max(0, (v.barVista || 0) - realDt);
  v.bar.material.opacity += ((mostrar ? 1 : 0) - v.bar.material.opacity) * Math.min(1, realDt * 6);
  const dCam = camera.position.distanceTo(v.grp.position), kb = Math.min(1, Math.max(0.35, dCam / 22));
  v.bar.scale.set(0.62 * kb, 0.062 * kb, 1);
  v.barDat = [hp, en, M.enPie(f) ? 1 : 0, f.gassed ? 1 : 0];
  const key = `${(hp * 30) | 0}|${(en * 15) | 0}|${f.estado}|${f.gassed}`;
  if (v.barC && key !== v.lastBar) {
    v.lastBar = key;
    const g = v.barC.getContext('2d'); g.clearRect(0, 0, 40, 4);
    if (M.enPie(f)) { g.fillStyle = 'rgba(10,6,4,.75)'; g.fillRect(0, 0, 40, 4); g.fillStyle = hp > 0.5 ? '#7cc95f' : hp > 0.2 ? '#e8a83c' : '#e03a2a'; g.fillRect(0, 0, Math.round(40 * hp), 3); g.fillStyle = f.gassed ? '#8a7a3a' : '#f0dc6a'; g.fillRect(0, 3, Math.round(40 * en), 1); }
    v.barT.needsUpdate = true;
  }
}
// dirección de un golpe de a hacia d (en el mundo)
const dirGolpe = (a, d) => { const v = new THREE.Vector3(d.x - a.x, (Math.random() - 0.6) * 0.3, d.z - a.z); if (v.lengthSq() < 1e-6) v.set(1, 0, 0); return v.normalize(); };

/* ---------- partículas, manchas y textos ---------- */
let parts = [], stains = [], texts = [];
const dotTex = {};
function dot(col) { if (!dotTex[col]) { dotTex[col] = canvasTex(4, 4, (g) => { g.fillStyle = col; g.fillRect(0, 0, 4, 4); }, true); dotTex[col].colDot = col; } return dotTex[col]; }
/* ---------- sangre: gotas alargadas en el aire; en el piso, salpicaduras con dirección, charcos y rastros ---------- */
const SANGRES = ['#7a0f0b', '#8e1610', '#a01c14', '#6a0c08'];
function texGota() { return canvasTex(8, 16, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(4, 10, 3, 5.5, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(1.5, 8); g.lineTo(4, 0); g.lineTo(6.5, 8); g.fill(); }); }
// manchas de piso dibujadas a mano: irregulares, con gotitas alrededor
function texMancha(tipo, seed) {
  let a = seed; const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#fff';
    const blob = (x, y, rad) => { g.beginPath(); for (let i = 0; i <= 14; i++) { const t = (i / 14) * Math.PI * 2, rr = rad * (0.75 + r() * 0.45); i ? g.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr) : g.moveTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } g.fill(); };
    if (tipo === 'charco') { blob(32, 32, 26); for (let i = 0; i < 6; i++) blob(32 + (r() - 0.5) * 40, 32 + (r() - 0.5) * 40, 4 + r() * 6); }
    else if (tipo === 'chorro') {   // salpicadura alargada: sale hacia +x
      g.beginPath(); g.ellipse(14, 32, 10, 7, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 12; i++) { const x = 18 + r() * 42, y = 32 + (r() - 0.5) * (4 + x * 0.35), rr = Math.max(0.8, 4.5 - x * 0.06) * (0.5 + r() * 0.7); g.beginPath(); g.ellipse(x, y, rr * 1.8, rr, 0, 0, Math.PI * 2); g.fill(); }
      g.fillRect(14, 30, 30, 4);
    } else { blob(32, 32, 12); for (let i = 0; i < 9; i++) { const t = r() * Math.PI * 2, d = 14 + r() * 14; blob(32 + Math.cos(t) * d, 32 + Math.sin(t) * d, 1.5 + r() * 2.5); } }
  });
}
const TEXS = { gota: null, mancha: [], chorro: [], charco: [] };
const matsMancha = new Map();
function matMancha(tipo, k) {
  const key = tipo + k;
  if (!matsMancha.has(key)) {
    if (!TEXS[tipo].length) for (let i = 0; i < 4; i++) TEXS[tipo].push(texMancha(tipo, 17 + i * 31 + tipo.length * 7));
    matsMancha.set(key, new THREE.MeshBasicMaterial({ map: TEXS[tipo][k % 4], color: SANGRES[k % SANGRES.length], transparent: true, opacity: tipo === 'charco' ? 0.88 : 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  }
  return matsMancha.get(key);
}
const PLANO = new THREE.PlaneGeometry(1, 1);
// cuántas partículas sueltas puede haber a la vez (cada una es un dibujo): en gráficos bajos, muchas menos
const PART_MAX = () => ({ alto: 260, medio: 160, bajo: 110 }[AJ().nivel()] || 160);   // ahora todas las gotas van en un solo dibujo: se puede volver a tener mucha sangre
const cupo = (n) => Math.max(0, Math.min(Math.ceil(n * ({ alto: 1, medio: 0.6, bajo: 0.35 }[AJ().nivel()] || 0.6)), PART_MAX() - parts.length));
function sangre(x, y, z, n, fuerza, dirx = 0, dirz = 0) {
  TEXS.gota = TEXS.gota || texGota(); n = cupo(n);
  for (let i = 0; i < n; i++) {
    const sp = SP(({ map: TEXS.gota, color: SANGRES[(Math.random() * 3) | 0], transparent: true }));
    const s = 0.025 + Math.random() * 0.035; sp.scale.set(s, s * 2, 1); sp.position.set(x, y, z);
   
    parts.push({ sp, s, vx: dirx * fuerza * (0.5 + Math.random()) + (Math.random() - 0.5) * 1.6, vy: 0.6 + Math.random() * 2.6 * fuerza, vz: dirz * fuerza * (0.5 + Math.random()) + (Math.random() - 0.5) * 1.6, life: 2, blood: true });
  }
}
function chispas(x, y, z, n) {
  n = cupo(n);
  for (let i = 0; i < n; i++) {
    const sp = SP(({ map: dot('#ffe08a'), transparent: true }));
    sp.scale.set(0.06, 0.06, 1); sp.position.set(x, y, z);
    parts.push({ sp, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 5, life: 0.35 });
  }
}
// astillas de hueso (el esqueleto no sangra) y humo (transformación)
function huesos(x, y, z, n, dirx = 0, dirz = 0) {
  n = cupo(n);
  for (let i = 0; i < n; i++) {
    const sp = SP(({ map: dot(Math.random() < 0.5 ? '#e4dcc4' : '#bfb59a') }));
    const k = 0.05 + Math.random() * 0.06; sp.scale.set(k, k, 1); sp.position.set(x, y, z);
    parts.push({ sp, vx: dirx * 2 + (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: dirz * 2 + (Math.random() - 0.5) * 3, life: 1.2 });
  }
}
function humo(x, y, z, n) {
  n = cupo(n);
  for (let i = 0; i < n; i++) {
    const sp = SP(({ map: dot(Math.random() < 0.5 ? '#8a8078' : '#5e564f'), transparent: true, opacity: 0.8 }));
    const k = 0.15 + Math.random() * 0.2; sp.scale.set(k, k, 1); sp.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.6);
    parts.push({ sp, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 1.5, life: 0.7 });
  }
}
function mancha(x, z, r, dirx = 0, dirz = 0, tipo) {
  const largo = Math.hypot(dirx, dirz), t = tipo || (largo > 0.8 ? 'chorro' : 'mancha');
  const mat = matMancha(t, (Math.random() * 4) | 0), y = 0.011 + Math.random() * 0.004, cap = t === 'charco' ? 64 : 240;
  if (t === 'chorro') return calco(mat, cap, x, y, z, -Math.atan2(dirz, dirx), r * (2.2 + Math.min(3, largo * 0.6)), r * 1.3);
  return calco(mat, cap, x, y, z, Math.random() * Math.PI * 2, r * 2, r * 2);
}
// los carteles flotantes (números, ¡CRACK!...) se dibujan una vez y se reusan: antes cada golpe hacía una textura nueva que nunca se borraba
const texCache = new Map();
function texDe(txt, col) {
  const key = txt + '|' + col;
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = "700 40px 'Cinzel Decorative', Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = '#140d08'; g.strokeText(txt, 128, 34); g.fillStyle = col; g.fillText(txt, 128, 34);
  t = new THREE.CanvasTexture(c);
  if (texCache.size > 300) { for (const v of texCache.values()) v.dispose(); texCache.clear(); }
  texCache.set(key, t); return t;
}
function texto(txt, col, size = 0.45) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texDe(txt, col), transparent: true, depthTest: false }));
  sp.scale.set(size * 4, size, 1); sp.renderOrder = 20; sp.layers.set(1); return sp;   // capa de arriba: nítido y fuera de la cámara en mano
}
function flotar(f, txt, col, size) {
  const sp = texto(txt, col, size); sp.position.set(f.x, f.g.altura + 0.8, f.z); scene.add(sp); texts.push({ sp, life: 1.5, max: 1.5 });
}
function numero(f, pts, crit, bloq) {
  const v = Math.max(1, Math.round(pts));
  const sp = texto(String(v), bloq ? '#9fb3c8' : crit ? '#ffd040' : '#ffffff', crit ? 0.85 : 0.5 + Math.min(0.3, v / 60));
  sp.position.set(f.x + (Math.random() - 0.5) * 0.5, f.g.altura + 0.3, f.z + (Math.random() - 0.5) * 0.3);
  scene.add(sp); texts.push({ sp, life: 0.9, max: 0.9, rise: 1.6 });
}
// miembros cortados y cabezas: salen volando, giran y quedan tirados en la arena
let trozos = [];
function lanzarTrozo(f, parte, desde) {
  if (!window.Rig) return;
  const t = pelea.equipos[f.team], cv = window.Rig.suelto(specVis(f, t.color), parte);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 }));
  const k = f.g.altura / (V[f.id] ? V[f.id].rig.alto : 100);
  sp.scale.set(cv.width * k, cv.height * k, 1);
  const y = parte === 'cabeza' ? f.g.altura * 0.9 : parte[0] === 'p' ? f.g.altura * 0.3 : f.g.altura * 0.62;
  sp.position.set(f.x, y, f.z); scene.add(sp);
  let dx = 0, dz = 0; if (desde) { dx = f.x - desde.x; dz = f.z - desde.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; }
  trozos.push({ sp, vx: dx * 2.5 + (Math.random() - 0.5) * 1.5, vy: 3 + Math.random() * 2, vz: dz * 2.5 + (Math.random() - 0.5) * 1.5, giro: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6), quieto: false, alto: cv.height * k });
  sangre(f.x, y, f.z, 34, 1.4, dx, dz);
}
function actualizarTrozos(dt) {
  for (const t of trozos) {
    if (t.quieto) continue;
    t.vy -= 9.8 * dt; t.sp.position.x += t.vx * dt; t.sp.position.y += t.vy * dt; t.sp.position.z += t.vz * dt;
    t.sp.material.rotation += t.giro * dt;
    if (Math.random() < 0.4) sangre(t.sp.position.x, t.sp.position.y, t.sp.position.z, 1, 0.2);
    if (t.sp.position.y <= t.alto * 0.25) { t.sp.position.y = t.alto * 0.25; if (Math.abs(t.vy) > 1.5) { t.vy = -t.vy * 0.3; t.vx *= 0.5; t.vz *= 0.5; t.giro *= 0.4; mancha(t.sp.position.x, t.sp.position.z, 0.25); } else { t.quieto = true; t.sp.material.rotation = Math.round(t.sp.material.rotation / (Math.PI / 2)) * (Math.PI / 2) + 0.2; mancha(t.sp.position.x, t.sp.position.z, 0.35); } }
  }
}
function actualizarParticulas(dt) {
  actualizarTrozos(dt);
  parts = parts.filter((p) => {
    p.life -= dt;
    if (p.flash) { const k = Math.max(0, p.life) / 0.16; p.sp.scale.set(p.s0 * (0.6 + k), p.s0 * (0.6 + k), 1); p.sp.material.rotation = p.rot; p.sp.material.opacity = Math.min(1, k * 2); if (p.life <= 0) { scene.remove(p.sp); p.sp.material.dispose(); return false; } return true; }
    if (p.polvo) { p.vx *= 0.92; p.vz *= 0.92; p.vy *= 0.9; p.sp.material.opacity = Math.max(0, p.life * 1.2); } else p.vy -= 9.8 * dt;
    p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt;
    if (p.blood) {   // la gota apunta hacia donde va y se estira con la velocidad
      const a = p.sp.position.clone().project(camera), b = p.sp.position.clone().add(new THREE.Vector3(p.vx, p.vy, p.vz).multiplyScalar(0.05)).project(camera);
      p.sp.material.rotation = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
      const sp = Math.hypot(p.vx, p.vy, p.vz); p.sp.scale.set(p.s, p.s * (1.4 + Math.min(2.2, sp * 0.35)), 1);
    }
    if (p.sp.position.y <= 0.02) { if (p.blood && Math.random() < 0.45) mancha(p.sp.position.x, p.sp.position.z, 0.04 + Math.random() * 0.06, p.vx, p.vz); scene.remove(p.sp); p.sp.material.dispose(); return false; }
    if (p.life <= 0) { scene.remove(p.sp); p.sp.material.dispose(); return false; }
    return true;
  });
  texts = texts.filter((t) => { t.life -= dt; t.sp.position.y += dt * (t.rise || 0.7); t.sp.material.opacity = Math.min(1, t.life / 0.5); if (t.life <= 0) { scene.remove(t.sp); t.sp.material.dispose(); return false; } return true; });
}

/* ---------- sonido: qué suena con cada cosa que pasa ---------- */
const SND = () => window.Sonido;
const posF = (f) => ({ x: f.x, y: f.g.altura * 0.55, z: f.z });
const armaDe = (f) => Object.keys(R.ARMAS).find((k) => R.ARMAS[k] === f.W) || f.g.equipo.arma;
const razaSon = (f) => (lobOn(f) ? 'loboT' : f.g.raza);
const pesadoF = (f) => f.g.raza === 'gigante' || f.g.raza === 'orco' || lobOn(f);
function oyenteArena(pos) {
  const v = new THREE.Vector3(pos.x, pos.y, pos.z), d = camera.position.distanceTo(v);
  const p = v.clone().project(camera);
  return [Math.max(0.06, Math.min(1.15, 10 / (d + 4))), p.z > 1 ? 0 : Math.max(-0.85, Math.min(0.85, p.x * 0.8))];
}
// qué herida deja cada arma en la carne
function tipoHerida(a) {
  const k = armaDe(a);
  return k === 'lanza' ? 'estocada' : k === 'garras' ? 'garras' : ['martillo', 'garrote', 'cestus', 'munon'].includes(k) ? 'contundente' : Math.random() < 0.25 ? 'estocada' : 'tajo';
}
// chorros de las arterias abiertas: del lienzo del muñeco al mundo
const _der = new THREE.Vector3();
function chorrosArterias(f, v, dt) {
  if (v.G) return;
  v.chorroT = (v.chorroT || 0) - dt; if (v.chorroT > 0 || !v.rig.chorros) return;
  v.chorroT = 0.07;
  const cs = v.rig.chorros(); if (!cs.length) return;
  _der.setFromMatrixColumn(camera.matrixWorld, 0);
  const E = v.rig.escala || 1, k = v.size.w / Rig.W, fl = Math.sign(v.spr.scale.x) || 1, vivo = f.estado !== 'muerto';
  for (const c of cs) {
    if (!vivo && Math.random() < 0.7) continue;
    const lx = (c.x / E - Rig.RAIZ_X) * k * fl, ly = (Rig.SUELO - c.y / E) * k, n = Math.hypot(c.dx, c.dy) || 1;
    const dx = (c.dx / n) * fl, fuerza = c.munon ? 0.9 : 0.5 + 0.5 * Math.max(0, Math.sin(performance.now() / 120));
    sangre(f.x + _der.x * lx, ly, f.z + _der.z * lx, c.munon ? 2 : 1, fuerza, _der.x * dx, _der.z * dx);
  }
}
function sonarEvento(s, e) {
  const S = SND(); if (!S) return;
  const F = s.fighters, a = F[e.a], d = F[e.d];
  switch (e.tipo) {
    case 'ataque': if (a) { S.zumbido(posF(a), e.heavy); if (Math.random() < (e.heavy ? 0.7 : 0.3)) S.voz(razaSon(a), 'esfuerzo', posF(a)); } break;
    case 'golpe': {
      if (!a || !d) break;
      S.golpe({ ...posF(d), arma: armaDe(a), armadura: d.g.equipo.armadura, escudo: d.g.equipo.escudo, res: e.res, fuerza: 0.45 + (e.pts || 0) / 18, esqueleto: d.g.raza === 'esqueleto' });
      if (e.res === 'limpio') {
        if (e.pts > 4 && Math.random() < 0.75) S.voz(razaSon(d), 'dolor', posF(d));
        if (e.crit || e.pts > 12) S.publico('ooh', 0.8 + (e.pts || 0) / 25);
      }
      break;
    }
    case 'caido': if (d) { S.derribo(posF(d), pesadoF(d)); S.voz(razaSon(d), 'dolor', posF(d)); S.publico('ooh', 1); } break;
    case 'agarre': if (e.ok && d) S.derribo(posF(d), pesadoF(d)); break;
    case 'rendicion': S.publico('abucheo', 1); break;
    case 'perdon': S.publico('aplausos', 1); break;
    case 'muerte': if (d) { if (d.g.raza === 'esqueleto') S.huesos(posF(d), 18); else S.voz(razaSon(d), 'muerte', posF(d)); S.derribo(posF(d), pesadoF(d)); S.publico('ovacion', 1); } break;
    case 'fractura': if (d) { S.hueso(posF(d)); S.voz(razaSon(d), 'grito', posF(d)); S.publico('ooh', 1.3); } break;
    case 'corte': if (d) { S.corte(posF(d)); S.voz(razaSon(d), 'grito', posF(d)); S.publico('grito', 1.3); } break;
    case 'decapita': if (d) { S.corte(posF(d)); S.publico('ovacion', 1.4); } break;
    case 'transforma': if (d) { S.aullido(posF(d)); S.publico('ooh', 1.4); } break;
    case 'desarma': if (d) S.huesos(posF(d), 18); break;
    case 'rearma': if (d) { S.huesos(posF(d), 10); S.publico('ooh', 1.2); } break;
    case 'come': if (a) S.masticar(posF(a)); break;
    case 'cae': if (d) { S.voz(razaSon(d), 'grito', posF(d)); S.publico('ooh', 1.5); } break;
    case 'cierre': S.publico('ovacion', 1.2); break;
  }
}
function procesarEventos(s) {
  for (const e of s.eventos) {
    try { sonarEvento(s, e); } catch (er) { /* el sonido nunca rompe la pelea */ }
    if ((e.tipo === 'caido' || e.tipo === 'muerte') && s.fighters[e.d] && pelea.cfg.modo !== 'campeones') polvo(s.fighters[e.d].x, s.fighters[e.d].z, 10, 1.2);
    if (e.tipo === 'golpe') {
      const a = s.fighters[e.a], d = s.fighters[e.d];
      const dx = (d.x - a.x), dz = (d.z - a.z), dd = Math.hypot(dx, dz) || 1;
      const y = d.g.altura * (e.zone === 'head' ? 0.85 : 0.55);
      if (pelea.cfg.modo !== 'campeones') { polvo(a.x, a.z, 4, 0.8); if (e.res === 'esquive' || e.res === 'bloqueo') polvo(d.x, d.z, 3, 0.7); else if (e.pts > 8) polvo(d.x, d.z, 5, 1); }   // movimientos bruscos: el que pega se planta, el que esquiva resbala
      if (lobOn(a) && e.res !== 'esquive') garrazo(a.x + dx * 0.72, y, a.z + dz * 0.72);
      if (e.res === 'limpio' || e.res === 'bloqueo') impactoFx(a.x + (d.x - a.x) * 0.7, y, a.z + (d.z - a.z) * 0.7, e.crit || e.pts > 12);
      if (e.res === 'limpio') {
        if (V[d.id]) { V[d.id].ultZona = e.res === 'limpio' ? e.zone : V[d.id].ultZona; V[d.id].ultT = performance.now(); }
        if (V[d.id] && V[d.id].G && e.pts > 2) { const dir = dirGolpe(a, d); V[d.id].ultDir = dir; V[d.id].G.golpeZona(e.zone === 'head' ? 'cabeza' : Math.random() < 0.55 || e.espalda ? 'torso' : ['bA', 'bE', 'pA', 'pB'][Math.floor(Math.random() * 4)], e.espalda ? 'estocada' : tipoHerida(a), Math.min(1.3, 0.3 + e.pts / 22) * (e.crit ? 1.25 : 1), dir); }
        else if (V[d.id] && V[d.id].rig && e.pts > 2) V[d.id].rig.herida(e.zone === 'head' ? 'cabeza' : Math.random() < 0.55 ? 'torso' : ['bA', 'bE', 'pA', 'pB'][Math.floor(Math.random() * 4)], tipoHerida(a), Math.min(1.3, 0.3 + e.pts / 22) * (e.crit ? 1.25 : 1));
        if (d.esp && d.esp.sinSangre) huesos(d.x, y, d.z, Math.min(14, 2 + Math.round(e.pts * 0.4)), dx / dd, dz / dd);
        else sangre(d.x, y, d.z, Math.min(26, 2 + Math.round(e.pts * 0.7)), 0.6 + e.pts / 25, dx / dd, dz / dd);
        numero(d, e.pts, e.crit);
        if (V[d.id] && V[d.id].G && V[d.id].G.reaccion && M.enPie(d)) V[d.id].G.reaccion(e.zone === 'head' ? 'cabeza' : 'cuerpo', 0.35 + e.pts / 14 + (e.crit ? 0.3 : 0), ladoDe(a, d));
        V[d.id].flash = 0.09;                                                    // hitframe: destello blanco   // (sin hit-stop: pedido de Merlin, que no se frene nunca)
        if (e.crit) shake = Math.max(shake, 0.25 + e.pts / 60);
      } else if (e.res === 'esquive') { const vd = V[d.id]; vd.evAnim = 'esquive'; vd.evT = 0.35; if (vd.G && vd.G.reaccion) vd.G.reaccion('esquive', 1, ladoDe(a, d)); }
      else if (e.res === 'bloqueo') { const vd = V[d.id]; vd.evAnim = 'bloqueo'; vd.evT = 0.3; if (vd.G && vd.G.reaccion) vd.G.reaccion('bloqueo', 0.8 + (e.pts || 0) / 10, ladoDe(a, d)); chispas(d.x - dx / dd * 0.25, y, d.z - dz / dd * 0.25, 6); if (e.pts >= 1) numero(d, e.pts, false, true); }
    } else if (e.tipo === 'caido') { const d = s.fighters[e.d]; flotar(d, 'CAE', '#ffb36b', 0.5); shake = Math.max(shake, 0.25); }
    else if (e.tipo === 'rendicion') { flotar(s.fighters[e.d], '¡SE RINDE!', '#ffffff', 0.45); }
    else if (e.tipo === 'transforma') { const d = s.fighters[e.d]; empezarCine(d, 'lobo'); humo(d.x, d.g.altura * 0.6, d.z, 26); }
    else if (e.tipo === 'desarma') { const d = s.fighters[e.d]; huesos(d.x, d.g.altura * 0.6, d.z, 22, 0, 0); flotar(d, 'se desarma…', '#e4dcc4', 0.4); }
    else if (e.tipo === 'rearma') { const d = s.fighters[e.d]; huesos(d.x, 0.3, d.z, 12, 0, 0); empezarCine(d, 'esqueleto'); }
    else if (e.tipo === 'fractura') { const d = s.fighters[e.d]; flotar(d, '¡CRACK!', '#e8e0c8', 0.55); huesos(d.x, d.g.altura * 0.5, d.z, 6, 0, 0); shake = Math.max(shake, 0.25); if (V[d.id]) { if (V[d.id].G) V[d.id].G.fracturarMiembro(e.m); else V[d.id].rig.herida(e.m); } }
    else if (e.tipo === 'corte') { const d = s.fighters[e.d]; flotar(d, '¡SE LO CORTÓ!', '#ff4a3a', 0.6); if (V[d.id] && V[d.id].G) V[d.id].G.cortarMiembro(e.m); else lanzarTrozo(d, e.m, s.fighters[e.a]); shake = Math.max(shake, 0.45); }
    else if (e.tipo === 'decapita') { const d = s.fighters[e.d]; d.decapitado = true; if (V[d.id] && V[d.id].G) { V[d.id].ultDir = dirGolpe(s.fighters[e.a], d); V[d.id].G.decapitar(); } else lanzarTrozo(d, 'cabeza', s.fighters[e.a]); flotar(d, '¡DECAPITADO!', '#ff4a3a', 0.7); shake = Math.max(shake, 0.6); }
    else if (e.tipo === 'come') { const a = s.fighters[e.a]; flotar(a, '¡A COMER!', '#c8e04a', 0.5); }
    else if (e.tipo === 'comido') { const a = s.fighters[e.a], d = s.fighters[e.d]; flotar(a, `+${Math.round(e.cura * 100)}% vida`, '#7ee07a', 0.6); if (V[d.id]) for (let i = 0; i < 3; i++) { if (V[d.id].G) V[d.id].G.golpeZona('torso', 'mordida', 1.1, new THREE.Vector3(0, -1, 0)); else V[d.id].rig.herida('torso', 'mordida', 1.1); } sangre(d.x, 0.2, d.z, 16, 0.6); mancha(d.x, d.z, 0.9); }
    else if (e.tipo === 'cae') { const d = s.fighters[e.d]; V[d.id].cae = { t: 0, vx: d.vx, vz: d.vz }; flotar(d, '¡AL VACÍO!', '#ff6a4a', 0.55); }
    else if (e.tipo === 'muerte' && s.fighters[e.d].esp && s.fighters[e.d].esp.sinSangre) { const d = s.fighters[e.d]; huesos(d.x, 0.5, d.z, 24, 0, 0); flotar(d, 'HUESOS', '#e4dcc4', 0.55); shake = Math.max(shake, 0.4); }
    else if (e.tipo === 'muerte') { const d = s.fighters[e.d]; const vd = V[d.id];
      if (vd && vd.G && !d.decapitado && vd.ultZona === 'head' && performance.now() - (vd.ultT || 0) < 400) vd.G.romperCraneo(vd.ultDir || dirGolpe(s.fighters[e.a] || d, d)); /* golpe mortal en la cabeza: cráneo roto */
      sangre(d.x, 0.4, d.z, 30, 1.2); for (let i = 0; i < 4; i++) mancha(d.x + (Math.random() - 0.5) * 0.8, d.z + (Math.random() - 0.5) * 0.8, 0.2 + Math.random() * 0.25); flotar(d, 'MUERTE', '#ff4a3a', 0.6); shake = Math.max(shake, 0.6); }
    else if (e.tipo === 'perdon') flotar(s.fighters[e.a], 'PERDONA', '#e0b44c', 0.4);
    else if (e.tipo === 'agarre' && e.ok) flotar(s.fighters[e.d], '¡DERRIBO!', '#d0e0ff', 0.34);
    else if (e.tipo === 'ataque' && e.remate) flotar(s.fighters[e.a], 'remata…', '#ff6a5a', 0.32);
    else if (e.tipo === 'cierre') { for (const f of s.fighters) if (M.enPie(f)) V[f.id].victoria = true; }
    if (e.tipo === 'cierre' && !remoto) setTimeout(() => { const cb = alTerminar; const p = pelea; cerrar(); cb && cb(p); }, 1800);
  }
  s.eventos.length = 0;
}

/* =====================================================================
   PANEL DERECHO: todos los gladiadores con raza, vida y estado (íconos)
   ===================================================================== */
const miniCache = {};
function mini(f, color) {
  const k = f.g.id + color + (lobOn(f) ? 'L' : '');
  if (!miniCache[k] && window.Rig) {
    const c = document.createElement('canvas'); c.width = 28; c.height = 28; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(window.Rig.retrato(specVis(f, color)), 0, 0, 28, 28); miniCache[k] = c.toDataURL();
  }
  if (!miniCache[k]) {
    const fr = S.frames({ id: f.g.id, raza: f.g.raza, color, piel: M.pielDe(f.g), ...f.g.equipo })[0];
    // recorta al cuerpo (sin el arma estirada) y lo encaja en 28x28
    const d = fr.getContext('2d').getImageData(0, 0, fr.width, fr.height).data; let x0 = 99, y0 = 99, x1 = 0, y1 = 0;
    for (let y = 0; y < fr.height; y++) for (let x = 8; x < 40; x++) if (d[(y * fr.width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const sz = Math.max(x1 - x0, y1 - y0) + 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const c = document.createElement('canvas'); c.width = 28; c.height = 28; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(fr, cx - sz / 2, cy - sz / 2, sz, sz, 0, 0, 28, 28); miniCache[k] = c.toDataURL();
  }
  return miniCache[k];
}
function estadoIcono(f) {
  if (f.rearmar !== null && f.rearmar !== undefined && f.estado === 'caido') return ['🦴', 'se está rearmando'];
  if (f.estado === 'muerto') return ['💀', 'muerto'];
  if (f.estado === 'rendido') return ['🏳️', 'rendido'];
  if (f.estado === 'caido') return ['🩸', 'caído'];
  if (f.action && (f.action.tipo === 'ataque' || f.action.tipo === 'remate')) return ['⚔️', 'en pelea'];
  if (Math.hypot(f.vx, f.vz) > 0.35) return ['🏃', 'moviéndose'];
  return ['⚔️', 'en pelea'];
}
let panelBuilt = false;
function renderEquipos(s) {
  const P = $('#right');
  if (!panelBuilt) {
    P.innerHTML = s.equipos.map((t) => `<div class="team"><div class="th"><span class="sw" style="background:${t.color}"></span><span>${t.nombre}</span></div>
      ${t.miembros.map((id) => { const f = s.fighters[id]; return `<div class="row2" id="fr${id}"><img src="${mini(f, t.color)}" title="${razaVis(f)}"><span class="bar"><i></i></span><span class="st"></span></div>`; }).join('')}</div>`).join('');
    panelBuilt = true;
    P.querySelectorAll('.row2').forEach((r) => { r.onclick = () => { const id = +r.id.slice(2); seguir(sel === id ? null : id); }; });
    P.classList.toggle('denso', s.fighters.length > 14);
  }
  for (const f of s.fighters) {
    const row = document.getElementById('fr' + f.id); if (!row) continue;
    const hp = M.enPie(f) || f.estado === 'rendido' ? 100 * hpDe(f) : f.estado === 'muerto' ? 0 : 3;
    // solo se toca la página si algo cambió (cada cambio obliga al navegador a recalcular el panel)
    const hpR = Math.round(hp), key = hpR + (M.enPie(f) ? 'p' : 'c');
    if (row._k !== key) { row._k = key; const i = row.querySelector('i'); i.style.width = hpR + '%'; i.style.background = hp > 50 ? '#6fb35a' : hp > 20 ? '#e0a03c' : '#d23a2a'; row.classList.toggle('out', !M.enPie(f)); }
    const [ic, tt] = estadoIcono(f); const st = row.querySelector('.st'); if (st.textContent !== ic) { st.textContent = ic; st.title = tt; }
  }
}

/* =====================================================================
   CICLO
   ===================================================================== */
let cine = null;   // cinemática: transformación del lobo / rearme del esqueleto (la ven todos)
// la barra de vida: los gladiadores se caen a 100 de daño; los monstruos no se caen, mueren recién en el daño letal (165 cabeza / 190 cuerpo), así que su barra se mide contra eso
function hpDe(f) { if (f.g && f.g.jefe) { const L = R.COMBATE.letal; return Math.max(0, 1 - Math.max(f.dmg.head / L.head, f.dmg.body / L.body)); } return Math.max(0, 1 - Math.max(f.dmg.head, f.dmg.body) / 100); }
let fpsN = 0, fpsT = 0, hitStop = 0, pelea = null, speed = 1, paused = false, acc = 0, last = performance.now(), uiT = 0, alTerminar = null, activo = false;
function limpiarEscena() { if (VX) VX.limpiar(); for (const h of huellas) scene.remove(h); huellas = []; for (const t of trozos) scene.remove(t.sp); trozos = []; for (const p of parts) scene.remove(p.sp); limpiarCalcos(); for (const t of texts) scene.remove(t.sp); parts = []; stains = []; texts = []; }
let remoto = false, emitir = null, evBuf = [], snapT = 0;
function abrir(cont, cfg, cb, titulo, opts = {}) {
  remoto = !!opts.remoto; emitir = opts.emitir || null; evBuf = []; snapT = 0;
  if (!renderer) initScene();
  cont.innerHTML = `<div class="app">
    <header><h1>KINGDOM'S PRICE</h1><span class="hide-s" style="color:var(--mute)">${titulo || 'La pelea'}</span><span class="sp"></span>
      <span class="clock" id="clock">0:00</span><button id="bAuto" class="on" title="La cámara sigue la acción">🎥 Auto</button><button id="bSon" title="Sonido">${window.Sonido && Sonido.mudo ? '🔇' : '🔊'}</button><button id="bMus" title="Música" class="${window.Musica && Musica.apagada ? '' : 'on'}">${window.Musica && Musica.apagada ? '🎵✕' : '🎵'}</button><span id="fps" class="meta" style="min-width:52px;text-align:right"></span>${opts.remoto ? '<span class="meta">la pelea la transmite el anfitrión</span>' : `<button id="bPause">❚❚</button>
      <button data-sp="1" class="spd">x1</button><button data-sp="2" class="spd">x2</button><button data-sp="4" class="spd">x4</button>`}</header>
    <main id="stage"><div id="camSel" class="camsel" hidden></div><button id="bMano" class="bmano" title="Cámara en mano" aria-label="Cámara en mano"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="7" width="13" height="10" rx="2" fill="currentColor"/><path d="M15 10.5 L21 7.5 V16.5 L15 13.5 Z" fill="currentColor"/><circle cx="6" cy="5" r="2" fill="currentColor"/><circle cx="11" cy="5" r="2" fill="currentColor"/></svg></button><div class="camhint">tocá un gladiador para seguirlo</div></main>
    <aside id="right"></aside>
  </div>`;
  panelBuilt = false;
  stage = $('#stage'); stage.prepend(renderer.domElement); resize();
  $('#bMano').onclick = () => { manoPref = !mano; manoOn(manoPref); };
  alTerminar = cb; activo = true; cine = null;
  if (window.Sonido) {
    Sonido.sinPublico = String(cfg.escenario || '').startsWith('maz:');   // la mazmorra está abandonada: no hay público
    Sonido.oyente = oyenteArena; Sonido.ambiente(true);
    const bm = document.getElementById('bMus'); if (bm && window.Musica) bm.onclick = () => { Musica.apagar(!Musica.apagada); bm.textContent = Musica.apagada ? '🎵✕' : '🎵'; bm.classList.toggle('on', !Musica.apagada); };
    const bs = document.getElementById('bSon'); if (bs) bs.onclick = () => { Sonido.silenciar(!Sonido.mudo); bs.textContent = Sonido.mudo ? '🔇' : '🔊'; if (!Sonido.mudo) Sonido.ambiente(true); };
  }
  // escenario: coliseo o la torre de campeones
  const torre = cfg.modo === 'campeones';
  coliseoG.visible = !torre; torreG.visible = torre;
  renderer.setPixelRatio(AJ().pr()); resize();
  if (torre) { scene.background = new THREE.Color('#2a2236'); scene.fog = new THREE.Fog('#2a2236', 30, 75); luzHemi.intensity = 0.82; luzSol.intensity = 0.68; } else ponerEscenario(cfg.escenario || 'cdh');
  cam.d = torre ? 21 : 34; cam.dd = undefined; if (torre) cam.th = Math.PI / 2 - 0.25;
  ponerPublico(torre ? cfg : {});
  pelea = M.crearPelea(cfg);
  sel = null; pov = false; foco.set(0, 0.5, 0);
  limpiarEscena(); crearVisuales(pelea);
  manoOn(manoPref);
  renderEquipos(pelea);
  paused = false;
  empezarIntro(torre || opts.sinIntro);
  if (remoto) { for (const f of pelea.fighters) { f._tx = f.x; f._tz = f.z; } return pelea; }
  $('#bPause').onclick = () => { paused = !paused; $('#bPause').textContent = paused ? '▶' : '❚❚'; };
  const ba = document.getElementById('bAuto'); cam.auto = true; cam.pausaAuto = 0;
  if (ba) ba.onclick = () => { cam.auto = !cam.auto; ba.classList.toggle('on', cam.auto); cam.pausaAuto = 0; };
  document.querySelectorAll('.spd').forEach((b) => { b.classList.toggle('on', +b.dataset.sp === speed); b.onclick = () => { speed = +b.dataset.sp; document.querySelectorAll('.spd').forEach((x) => x.classList.toggle('on', x === b)); }; });
  return pelea;
}
function cerrar() { intro = null; if (window.Sonido) { Sonido.ambiente(false); Sonido.oyente = null; Sonido.sinPublico = false; } activo = false; alTerminar = null; if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); stage = null; }
const cineK = () => 1;   // sin cámara lenta (pedido de Merlin): la cámara va al que se transforma, pero el juego no se frena
function simular(dt, max = 40) {
  acc += dt * speed * cineK();
  const step = R.COMBATE.dt; let n = 0;
  while (acc >= step && n < max && hitStop <= 0) { M.paso(pelea); acc -= step; n++; if (pelea.eventos.length) { if (emitir) evBuf.push(...pelea.eventos); procesarEventos(pelea); } }
  if (n >= max) acc = 0;
}
// si el anfitrión minimiza la pestaña, el navegador frena requestAnimationFrame: la pelea sigue igual con un intervalo
let lastHidden = performance.now();
setInterval(() => {
  const now = performance.now(), dt = Math.min(1.2, (now - lastHidden) / 1000); lastHidden = now;
  if (!document.hidden || !activo || !pelea || remoto || paused) return;
  hitStop = 0; simular(dt, 400);
  if (emitir) { emitir({ t: 'snap', d: foto(pelea), e: evBuf }); evBuf = []; }
}, 200);
// la resolución queda FIJA (nítida). Para que ande fluido en celular, se dibuja a 30 cuadros parejos (no 60 que se caen a 15)
const TOPE_FPS = () => (AJ().celu() ? 30 : 0);
let ultimoDibujo = 0;
function loop(now) {
  if (activo && window.Carga && Carga.activa) { last = now; requestAnimationFrame(loop); return; }   // mientras se ve la pantalla de carga, la pelea espera
  const tope = TOPE_FPS();
  if (tope && activo && now - ultimoDibujo < 1000 / tope - 4) { requestAnimationFrame(loop); return; }   // todavía no toca dibujar
  ultimoDibujo = now;
  const dtReal = (now - last) / 1000;
  const dt = Math.min(0.25, (now - last) / 1000) * (window.__lento || 1); last = now;
  if (activo && pelea) {
    if (hitStop > 0) hitStop -= dt;
    if (intro) pasoIntro(dt);
    if (decorT) decorT(now / 1000, dt);
    animEscenario(now / 1000, dt);
    if (cine) { cine.t += dt; if (cine.t >= cine.dur) { cine = null; const b = document.getElementById('cineB'); if (b) b.remove(); } }
    if (remoto) {
      // cliente: suaviza hacia la última foto que mandó el anfitrión
      const k = Math.min(1, dt * 12);
      for (const f of pelea.fighters) { if (f._tx === undefined) continue; f.x += (f._tx - f.x) * k; f.z += (f._tz - f.z) * k; }
      uiT -= dt;
      if (uiT <= 0) { uiT = 0.15; renderEquipos(pelea); $('#clock').textContent = pelea.fase === 'pelea' ? fmtT(pelea.t) : pelea.fase === 'pos' ? 'caídos…' : 'fin'; }
    } else if (!paused && hitStop <= 0 && !intro) {
      simular(dt);
      uiT -= dt;
      if (uiT <= 0) { uiT = 0.15; renderEquipos(pelea); $('#clock').textContent = pelea.fase === 'pelea' ? fmtT(pelea.t) : pelea.fase === 'pos' ? 'caídos…' : 'fin'; }
    }
    if (emitir) { snapT -= dt; if (snapT <= 0) { snapT = 0.06; emitir({ t: 'snap', d: foto(pelea), e: evBuf }); evBuf = []; } }
    actualizarVisuales(pelea, paused || hitStop > 0 ? 0 : dt * (remoto ? 1 : speed), dt);
    pasarCompartidos();
    actualizarParticulas(paused ? 0 : dt * speed);
    dibujarParticulas();
    if (VX) VX.paso(paused ? 0 : dt * speed * (cine ? 0.35 : 1));
    fpsN++; fpsT += dt; if (fpsT >= 0.5) { const e = document.getElementById('fps'); if (e) e.textContent = Math.round(fpsN / fpsT) + ' fps'; fpsN = 0; fpsT = 0; }
    updateCamera(dt);
    dibujarEscena(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
/* ---------- multijugador: fotos de la pelea (anfitrión → clientes) ---------- */
const EST = ['pelea', 'caido', 'rendido', 'muerto'];
const r2 = (v) => Math.round(v * 100) / 100;
function foto(s) {
  return { t: r2(s.t), fase: s.fase, f: s.fighters.map((f) => { const a = f.action; return [r2(f.x), r2(f.z), r2(f.vx), r2(f.vz), r2(f.facing), EST.indexOf(f.estado), r2(f.dmg.head), r2(f.dmg.body), r2(f.energy), r2(f.guardHp),
    a ? (a.tipo === 'ataque' ? 1 : 2) : 0, a && a.phase === 'recup' ? 1 : 0, a ? r2(a.t) : 0, a ? r2(a.carga || a.dur || 0) : 0, a ? r2(a.recup || 0) : 0, a && a.heavy ? 1 : 0,
    r2(f.stagger), f.trabado ? 1 : 0, r2(f.dizzy), r2(f.fxv.hurt), f.gassed ? 1 : 0, a && a.target != null ? a.target : -1, lobOn(f) ? 1 : 0, f.rearmar !== null ? 1 : 0, f.comiendo ? 1 : 0, f.comido ? 1 : 0, f.alVacio ? 1 : 0, f.miembros ? ['bA', 'bE', 'pA', 'pB'].map((m) => f.miembros[m][0]).join('') : 'oooo', r2(f.sangrado || 0), f.decapitado ? 1 : 0]; }) };
}
function recibir(msg) {
  if (!remoto || !pelea || msg.t !== 'snap') return;
  const d = msg.d; pelea.t = d.t; pelea.fase = d.fase;
  d.f.forEach((v, i) => {
    const f = pelea.fighters[i]; if (!f) return;
    f._tx = v[0]; f._tz = v[1]; f.vx = v[2]; f.vz = v[3]; f.facing = v[4]; f.estado = EST[v[5]]; f.dmg.head = v[6]; f.dmg.body = v[7]; f.energy = v[8]; f.guardHp = v[9];
    f.action = v[10] ? { tipo: v[10] === 1 ? 'ataque' : 'remate', phase: v[11] ? 'recup' : 'carga', t: v[12], carga: v[13], dur: v[13], recup: v[14], heavy: !!v[15], target: v[21] >= 0 ? v[21] : null } : null;
    f.stagger = v[16]; f.trabado = !!v[17]; f.dizzy = v[18]; f.fxv.hurt = v[19]; f.gassed = !!v[20];
    if (f.lobo && v[22]) f.lobo.on = true;
    f.rearmar = v[23] ? 1 : null; f.comiendo = v[24] ? (f.comiendo || { t: 0 }) : null; f.comido = !!v[25]; f.alVacio = !!v[26];
    if (v[27]) { const M2 = { o: 'ok', f: 'fractura', c: 'cortado', p: 'protesis' }; f.miembros = { bA: M2[v[27][0]], bE: M2[v[27][1]], pA: M2[v[27][2]], pB: M2[v[27][3]] }; }
    f.sangrado = v[28] || 0; if (v[29]) f.decapitado = true;
  });
  if (msg.e && msg.e.length) { pelea.eventos.push(...msg.e); procesarEventos(pelea); }
}
function salir() { if (activo) cerrar(); }
// antes de empezar: se preparan todos los programas de dibujo y se dibuja un cuadro (así el primer golpe no traba)
function precalentar() {
  if (!renderer || !pelea) return;
  try {
    if (window.Voxel && Voxel.hornearTodo) Voxel.hornearTodo();   // todos los movimientos precalculados
    actualizarVisuales(pelea, 0, 0); pasarCompartidos(); dibujarParticulas();
    camera.layers.enable(1); renderer.compile(scene, camera); renderer.render(scene, camera); camera.layers.disable(1);
    // la sangre y los destellos también: un cuadro con una partícula de cada una (invisible para el jugador, la tapa la carga)
  } catch (e) { console.warn('precalentar', e); }
}
window.Arena = { abrir, precalentar, recibir, salir, get pelea() { return pelea; }, get cam() { return cam; }, get camara() { return camera; }, get escena() { return scene; }, get renderer() { return renderer; } };
})();
