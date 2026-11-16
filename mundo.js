/* =====================================================================
   COLISEO · MUNDO 3D (low-poly pixelado)
   Todas las escenas fuera de la arena: prisión, salón, tablero, calle de la
   subasta (carro + mesa + monedas), callejón, establo, enfermería, escenario.
   Se renderiza a baja resolución y se escala con "pixelated" para que el 3D
   combine con los sprites. Los gladiadores y emperadores son sprites 2D.
   ===================================================================== */
(function (root) {
const T = root.THREE;
const ALTO_INTERNO = 360;   // filas de píxeles internas (más bajo = más pixelado)

/* ---------- texturas pixel ---------- */
const texCache = {};
function tex(key, w, h, fn, rx = 1, ry = 1) {
  const k = key + '|' + rx + '|' + ry;
  if (texCache[k]) return texCache[k];
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter;
  t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry);
  return (texCache[k] = t);
}
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function shade(hex, k) {
  const c = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + ((1 << 24) | (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255)).toString(16).slice(1);
}
const TX = {
  ladrillo: (base, rx, ry) => tex('lad' + base, 32, 32, (g) => { g.fillStyle = shade(base, 0.6); g.fillRect(0, 0, 32, 32); for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < 32; x += 16) { g.fillStyle = shade(base, 0.85 + rnd() * 0.3); g.fillRect(x + 1, y + 1, 14, 6); } }, rx, ry),
  piedra: (base, rx, ry) => tex('pie' + base, 32, 32, (g) => { g.fillStyle = base; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 90; i++) { g.fillStyle = shade(base, 0.8 + rnd() * 0.35); g.fillRect(rnd() * 32, rnd() * 32, 2 + rnd() * 3, 2); } }, rx, ry),
  adoquin: (base, rx, ry) => tex('ado' + base, 32, 32, (g) => { g.fillStyle = shade(base, 0.55); g.fillRect(0, 0, 32, 32); for (let y = 0; y < 32; y += 6) for (let x = (y / 6) % 2 ? -4 : 0; x < 32; x += 8) { g.fillStyle = shade(base, 0.85 + rnd() * 0.3); g.fillRect(x + 1, y + 1, 7, 5); } }, rx, ry),
  madera: (base, rx, ry) => tex('mad' + base, 32, 32, (g) => { for (let x = 0; x < 32; x += 8) { g.fillStyle = shade(base, 0.85 + rnd() * 0.3); g.fillRect(x, 0, 8, 32); g.fillStyle = shade(base, 0.6); g.fillRect(x + 7, 0, 1, 32); for (let i = 0; i < 4; i++) { g.fillStyle = shade(base, 0.75); g.fillRect(x + 1 + rnd() * 5, rnd() * 32, 1, 3); } } }, rx, ry),
  marmol: (rx, ry) => tex('marmol', 32, 32, (g) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#a99c86' : '#e2dacb'; g.fillRect(x * 16, y * 16, 16, 16); } for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(120,110,95,.25)'; g.fillRect(rnd() * 32, rnd() * 32, 3, 1); } }, rx, ry),
  revoque: (base, rx, ry) => tex('rev' + base, 32, 32, (g) => { g.fillStyle = base; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 70; i++) { g.fillStyle = shade(base, 0.9 + rnd() * 0.18); g.fillRect(rnd() * 32, rnd() * 32, 2, 2); } }, rx, ry),
  edificio: (base, rx, ry) => tex('edi' + base, 32, 32, (g) => { g.fillStyle = base; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 40; i++) { g.fillStyle = shade(base, 0.9 + rnd() * 0.15); g.fillRect(rnd() * 32, rnd() * 32, 2, 2); } g.fillStyle = '#3a2618'; g.fillRect(10, 8, 12, 16); g.fillStyle = shade(base, 0.7); g.fillRect(9, 24, 14, 2); g.fillStyle = '#5a3a24'; g.fillRect(15, 8, 2, 16); }, rx, ry),
  teja: (rx, ry) => tex('teja', 16, 16, (g) => { g.fillStyle = '#7a2e1c'; g.fillRect(0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { g.fillStyle = '#a3402a'; g.fillRect(0, y, 16, 3); for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) { g.fillStyle = '#5a2010'; g.fillRect(x, y, 1, 3); } } }, rx, ry),
  panio: (col, rx, ry) => tex('pan' + col, 32, 32, (g) => { g.fillStyle = col; g.fillRect(0, 0, 32, 32); let h = 7; const r = () => { h = (h * 16807) % 2147483647; return h / 2147483647; }; for (let i = 0; i < 140; i++) { g.fillStyle = shade(col, 0.82 + r() * 0.34); g.fillRect((r() * 32) | 0, (r() * 32) | 0, 1, 1); } }, rx, ry),
  tela: (col, rx, ry) => tex('tel' + col, 16, 16, (g) => { for (let x = 0; x < 16; x += 4) { g.fillStyle = shade(col, 1); g.fillRect(x, 0, 3, 16); g.fillStyle = shade(col, 0.7); g.fillRect(x + 3, 0, 1, 16); } }, rx, ry),
  arena: (rx, ry) => tex('arena', 32, 32, (g) => { g.fillStyle = '#c9a46b'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 120; i++) { g.fillStyle = rnd() < 0.5 ? '#b8915a' : '#d8b880'; g.fillRect(rnd() * 32, rnd() * 32, 1, 1); } }, rx, ry),
  tierra: (rx, ry) => tex('tierra', 32, 32, (g) => { g.fillStyle = '#5a4228'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 60; i++) { g.fillStyle = rnd() < 0.5 ? '#c8a858' : '#a88a40'; g.fillRect(rnd() * 32, rnd() * 32, 2 + rnd() * 3, 1); } }, rx, ry),
  paja: (rx, ry) => tex('paja', 16, 16, (g) => { g.fillStyle = '#c8a858'; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 30; i++) { g.fillStyle = rnd() < 0.5 ? '#a88a40' : '#e0c070'; g.fillRect(rnd() * 16, rnd() * 16, 3, 1); } g.fillStyle = '#8a7030'; g.fillRect(0, 5, 16, 1); g.fillRect(0, 11, 16, 1); }, rx, ry),
  publico: (rx, ry) => tex('publico', 64, 32, (g) => { g.fillStyle = '#3b2d20'; g.fillRect(0, 0, 64, 32); const cols = ['#7a3a2c', '#a89f8c', '#4a5f7a', '#8a7440', '#6a4a6e', '#4f6a44', '#9a8a70']; for (let y = 2; y < 32; y += 8) for (let x = (y % 16 ? 2 : 0); x < 64; x += 4) { if (rnd() < 0.18) continue; g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x, y + 2, 3, 4); g.fillStyle = '#b58a68'; g.fillRect(x + 1, y, 2, 2); } }, rx, ry),
  arcos: (rx, ry) => tex('arcos', 32, 32, (g) => { g.fillStyle = '#c9b08a'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#6a5640'; g.fillRect(6, 6, 8, 10); g.fillRect(20, 6, 8, 10); g.fillRect(6, 20, 8, 10); g.fillRect(20, 20, 8, 10); g.fillStyle = '#b09878'; g.fillRect(0, 17, 32, 2); }, rx, ry),
  oro: () => tex('oroC', 8, 8, (g) => { g.fillStyle = '#d4a017'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#fff2a8'; g.fillRect(2, 2, 2, 2); g.fillStyle = '#8a6a10'; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8); }),
  plata: () => tex('plataC', 8, 8, (g) => { g.fillStyle = '#b8c0c8'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#ffffff'; g.fillRect(2, 2, 2, 2); g.fillStyle = '#6e767e'; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8); }),
};
const mat = (o) => new T.MeshLambertMaterial(o);
const matC = (color, extra = {}) => mat({ color, ...extra });
function caja(w, h, d, m, x = 0, y = 0, z = 0, par) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (par) par.add(o); return o; }
function cil(rt, rb, h, seg, m, x = 0, y = 0, z = 0, par) { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); if (par) par.add(o); return o; }
function plano(w, h, m, x = 0, y = 0, z = 0, rx = 0, par) { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.x = rx; if (par) par.add(o); return o; }

// sprite 2D parado en el mundo: canvas, altura del cuerpo en metros, píxeles de alto del cuerpo
function sprite(canvas, alturaM, cuerpoPx, pieFila) {
  const t = new T.CanvasTexture(canvas); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.1 }));
  const k = alturaM / cuerpoPx;
  s.scale.set(canvas.width * k, canvas.height * k, 1);
  s.center.set(0.5, (canvas.height - 1 - pieFila) / canvas.height);
  return s;
}
const spriteGlad = (canvas, altura, raza) => sprite(canvas, altura, root.Sprites.alturaPx(raza), 62);
// gladiador articulado (rig.js): sprite animado; .animar(dt, anim) lo redibuja a ~30 cuadros
function spriteRig(spec, alturaM) {
  const Rg = root.Rig, rig = Rg.crear(spec);
  const s = sprite(rig.canvas, alturaM, rig.alto, Rg.SUELO - 1);
  s.center.x = Rg.RAIZ_X / Rg.W;
  let acc = 0;
  s.rig = rig;
  s.animar = (dt, anim) => { if (anim && anim !== rig.actual) rig.anim(anim); acc += dt; if (acc >= 1 / 30) { rig.paso(acc); acc = 0; s.material.map.needsUpdate = true; } };
  return s;
}
const gladSprite = (g, altura) => (g.spec && root.Voxel && root.Voxel.modo3D() ? root.Voxel.figura(g.spec, altura) : g.spec && root.Rig ? spriteRig(g.spec, altura) : spriteGlad(g.canvas, altura, g.raza));
const spriteEmp = (color, h = 1.15, raza, look) => { if (look && look.raza) raza = look.raza; return root.Voxel && root.Voxel.modo3D() ? root.Voxel.emperador(color, h * (raza === 'gigante' ? 1.45 : raza === 'goblin' ? 0.68 : raza === 'orco' ? 1.1 : 1), raza, look) : sprite(root.Escenas.emperador(color, look && look.piel), h, 28, 29); };

// junta todo lo que no se mueve en una malla por material (cientos de cajitas = un puñado de dibujos; clave para el celular)
function fundirEstatico(grupo, scene) {
  grupo.updateMatrixWorld(true);
  const por = new Map();
  grupo.traverse((m) => { if (!m.isMesh) return; const k = m.material; if (!por.has(k)) por.set(k, []); por.get(k).push(m); });
  for (const [material, ms] of por) {
    const pos = [], nor = [], uv = [], v = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3();
    for (const m of ms) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      nm.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere(); scene.add(new T.Mesh(geo, material));
  }
}
const _matCache = new Map();
const matK = (col, extra) => { const k = col + JSON.stringify(extra || {}); if (!_matCache.has(k)) _matCache.set(k, matC(col, extra)); return _matCache.get(k); };   // mismo color = mismo material (así se funden juntos)
// un hombre de cubitos simple (estatuas, el carrero, el chamán) — color de piel/ropa
function hombrecito(par, x, z, col = { piel: '#c8956a', ropa: '#6a4a2a', pelo: '#2a1a10' }, alto = 1.75, rotY = 0) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; par.add(g); const k = alto / 1.75;
  const P = matK(col.piel), R = matK(col.ropa), H = matK(col.pelo || col.ropa);
  const piernaD = new T.Group(), piernaI = new T.Group(); piernaD.position.set(-0.12 * k, 0.8 * k, 0); piernaI.position.set(0.12 * k, 0.8 * k, 0); g.add(piernaD, piernaI);
  caja(0.18 * k, 0.8 * k, 0.2 * k, R, 0, -0.4 * k, 0, piernaD); caja(0.18 * k, 0.8 * k, 0.2 * k, R, 0, -0.4 * k, 0, piernaI);
  caja(0.5 * k, 0.65 * k, 0.28 * k, R, 0, 1.12 * k, 0, g);
  const brazoD = new T.Group(), brazoI = new T.Group(); brazoD.position.set(-0.32 * k, 1.42 * k, 0); brazoI.position.set(0.32 * k, 1.42 * k, 0); g.add(brazoD, brazoI);
  caja(0.13 * k, 0.6 * k, 0.15 * k, R, 0, -0.28 * k, 0, brazoD); caja(0.13 * k, 0.6 * k, 0.15 * k, R, 0, -0.28 * k, 0, brazoI);
  caja(0.12 * k, 0.12 * k, 0.13 * k, P, 0, -0.62 * k, 0, brazoD); caja(0.12 * k, 0.12 * k, 0.13 * k, P, 0, -0.62 * k, 0, brazoI);
  const cab = caja(0.3 * k, 0.32 * k, 0.3 * k, P, 0, 1.63 * k, 0, g); caja(0.32 * k, 0.1 * k, 0.32 * k, H, 0, 1.8 * k, -0.01 * k, g);
  caja(0.05 * k, 0.04 * k, 0.02 * k, matK('#1a120c'), -0.07 * k, 1.66 * k, 0.15 * k, g); caja(0.05 * k, 0.04 * k, 0.02 * k, matK('#1a120c'), 0.07 * k, 1.66 * k, 0.15 * k, g);
  return { g, piernaD, piernaI, brazoD, brazoI, cab };
}
// antorcha con luz que titila
function antorcha(par, x, y, z, fuerza = 1.4) {
  const g = new T.Group(); g.position.set(x, y, z); par.add(g);
  caja(0.08, 0.5, 0.08, matC('#5a3a20'), 0, 0, 0, g);
  const fl = new T.Sprite(new T.SpriteMaterial({ map: tex('llama', 8, 8, (c) => { c.fillStyle = '#ff8a20'; c.fillRect(2, 2, 4, 6); c.fillStyle = '#ffd45a'; c.fillRect(3, 3, 2, 4); c.fillStyle = '#fff2b0'; c.fillRect(3, 5, 2, 2); }), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  fl.scale.set(0.35, 0.45, 1); fl.position.y = 0.4; g.add(fl);
  const L = new T.PointLight('#ffa040', fuerza, 9, 1.6); L.position.y = 0.5; if (fuerza > 0) g.add(L);   // sin luz si es solo decorativo (cada luz cuesta)
  return (t) => { const f = Math.sin(t * 13 + x * 3) * 0.12 + Math.sin(t * 7.3 + z) * 0.1; L.intensity = fuerza * (1 + f); fl.scale.set(0.35 + f * 0.2, 0.45 + f * 0.3, 1); };
}
function luces(scene, cielo = '#ffe7c4', suelo = '#3a2a1a', hemi = 0.55, sol = 0.5) {
  scene.add(new T.HemisphereLight(cielo, suelo, hemi));
  const d = new T.DirectionalLight('#ffe0b0', sol); d.position.set(-6, 10, 6); scene.add(d);
  return d;
}

/* =====================================================================
   ESCENAS
   ===================================================================== */
const ESC = {};

ESC.prision = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#0d0a08'); scene.fog = new T.Fog('#0d0a08', 8, 22);
  luces(scene, '#8a9ab8', '#2a2018', 0.55, 0.2);
  caja(18, 0.2, 14, mat({ map: TX.piedra('#3a332c', 6, 5) }), 0, -0.1, -1, scene);
  caja(18, 9, 0.4, mat({ map: TX.ladrillo('#5a5048', 7, 4) }), 0, 4.5, -6, scene);
  caja(0.4, 9, 14, mat({ map: TX.ladrillo('#4a4038', 5, 4) }), -8, 4.5, -1, scene);
  caja(0.4, 9, 14, mat({ map: TX.ladrillo('#4a4038', 5, 4) }), 8, 4.5, -1, scene);
  // ventana con rejas y luna
  plano(2.2, 1.6, matC('#141a2e', { emissive: '#0c1226' }), 0, 6, -5.78, 0, scene);
  const luna = new T.Sprite(new T.SpriteMaterial({ color: '#e8eef8' })); luna.scale.set(0.35, 0.35, 1); luna.position.set(-0.5, 6.3, -5.75); scene.add(luna);
  for (let i = -3; i <= 3; i++) caja(0.07, 1.6, 0.07, matC('#1a1612'), i * 0.32, 6, -5.7, scene);
  const spot = new T.SpotLight('#9ab0ff', 1.2, 18, 0.45, 0.6, 1); spot.position.set(0, 6, -5.6); spot.target.position.set(0.6, 0, -1); scene.add(spot, spot.target);
  // cadenas
  for (const cx of [-3.6, 3.6]) { for (let i = 0; i < 9; i++) caja(0.07, 0.16, 0.05, matC('#6b6e72'), cx + (i % 2) * 0.03, 5.6 - i * 0.18, -5.6, scene); caja(0.35, 0.22, 0.1, matC('#6b6e72'), cx, 3.9, -5.6, scene); }
  // paja
  for (let i = 0; i < 70; i++) { const m = caja(0.4, 0.02, 0.06, matC(rnd() < 0.5 ? '#8a7440' : '#a48a50'), -3 + rnd() * 6, 0.02, -3 + rnd() * 4, scene); m.rotation.y = rnd() * 3; }
  const fl = [antorcha(scene, -6.5, 3.4, -5.6), antorcha(scene, 6.5, 3.4, -5.6)];
  // rejas en primer plano
  const reja = new T.Group(); reja.position.z = 3.5; scene.add(reja);
  for (let x = -9; x <= 9; x += 1.1) cil(0.06, 0.06, 10, 6, matC('#26201b'), x, 4, 0, reja);
  caja(20, 0.12, 0.12, matC('#26201b'), 0, 7.2, 0, reja); caja(20, 0.12, 0.12, matC('#26201b'), 0, 0.5, 0, reja);
  const camera = new T.PerspectiveCamera(50, 16 / 9, 0.1, 60); camera.position.set(0, 2.6, 7.6);
  return { scene, camera, update(t) { fl.forEach((f) => f(t)); camera.position.x = Math.sin(t * 0.25) * 0.25; camera.lookAt(0, 3.2, -3); } };
};

function salonBase() {
  const scene = new T.Scene(); scene.background = new T.Color('#140d08'); scene.fog = new T.Fog('#140d08', 20, 40);
  luces(scene, '#fff0d8', '#5a4030', 0.58, 0.42);
  const est = new T.Group();   // todo lo que no se mueve: al final se funde
  const Z0 = -6.5, Z1 = 10, ZC = (Z0 + Z1) / 2, D = Z1 - Z0, ORO = matK('#d9b444', { emissive: '#3a2a08' }), MARM = matK('#e6dccb'), MARM2 = matK('#cfc3ad');
  caja(24, 0.2, D, mat({ map: TX.marmol(12, 8) }), 0, -0.1, ZC, est);
  // alfombra roja con ribete dorado, desde la puerta hasta el trono
  caja(2.6, 0.03, D - 2.4, mat({ map: TX.panio('#7a1414', 3, 18) }), 0, 0.015, ZC + 0.8, est);
  for (const x of [-1.33, 1.33]) caja(0.1, 0.04, D - 2.4, ORO, x, 0.02, ZC + 0.8, est);
  // paredes, zócalo oscuro, friso dorado y techo con vigas
  const rev = mat({ map: TX.revoque('#c8b08a', 6, 3) }), revL = mat({ map: TX.revoque('#b89e78', 6, 3) });
  caja(24, 10, 0.4, rev, 0, 5, Z0, est); caja(24, 10, 0.4, revL, 0, 5, Z1, est);
  for (const x of [-12, 12]) caja(0.4, 10, D, revL, x, 5, ZC, est);
  for (const [w, d, x, z] of [[24, 0.5, 0, Z0 + 0.25], [24, 0.5, 0, Z1 - 0.25], [0.5, D, -11.75, ZC], [0.5, D, 11.75, ZC]]) { caja(w, 0.7, d, matK('#5a3a24'), x, 0.35, z, est); caja(w, 0.3, d, ORO, x, 6.6, z, est); caja(w, 0.2, d, matK('#7a1c1c'), x, 6.95, z, est); }
  caja(24, 0.3, D, matK('#24160c'), 0, 10, ZC, est);
  for (let z = Z0 + 1; z < Z1; z += 2.4) caja(24, 0.4, 0.4, matK('#4a2e18'), 0, 9.7, z, est);
  // portón de la entrada
  caja(3.6, 5.2, 0.25, mat({ map: TX.madera('#5a3418', 3, 3) }), 0, 2.6, Z1 - 0.3, est);
  caja(0.08, 5.2, 0.3, matK('#2a1a0c'), 0, 2.6, Z1 - 0.35, est);
  for (const y of [1.2, 2.6, 4]) caja(3.7, 0.12, 0.32, matK('#3a3a3e'), 0, y, Z1 - 0.32, est);
  caja(4.4, 0.5, 0.4, ORO, 0, 5.45, Z1 - 0.3, est);
  // dos filas de columnas de mármol a lo largo de la nave
  for (const x of [-5.2, 5.2]) for (const z of [-3.8, -0.4, 3, 6.4]) { cil(0.42, 0.46, 6.2, 12, MARM, x, 3.3, z, est); caja(1.15, 0.4, 1.15, MARM2, x, 0.2, z, est); caja(1.2, 0.35, 1.2, ORO, x, 6.55, z, est); }
  // ventanales en las paredes de los costados
  const vidrio = matK('#ffe2a0', { emissive: '#c09040' });
  for (const z of [-2.1, 1.3, 4.7, 8.1]) for (const sx of [-1, 1]) {
    const x = sx * 11.78;
    const v = plano(1.5, 3.4, vidrio, x, 4.6, z, 0, est); v.rotation.y = -sx * Math.PI / 2;
    caja(0.15, 0.15, 1.7, matK('#3a2410'), x, 4.6, z, est); caja(0.15, 3.6, 0.15, matK('#3a2410'), x, 4.6, z, est);
    caja(0.3, 0.25, 1.9, MARM2, x - sx * 0.05, 2.8, z, est); const ar = cil(0.95, 0.95, 0.3, 12, MARM2, x - sx * 0.05, 6.3, z, est); ar.rotation.x = Math.PI / 2; ar.rotation.z = Math.PI / 2; ar.scale.set(1, 1, 0.55);
  }
  // estandartes rojos con águila dorada colgando entre las ventanas
  const est1 = mat({ map: tex('estandarte', 16, 32, (g) => { g.fillStyle = '#8e1b1b'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#d9b444'; g.fillRect(0, 0, 16, 2); g.fillRect(0, 30, 16, 2); g.fillRect(6, 9, 4, 9); g.fillRect(2, 11, 12, 3); g.fillRect(4, 18, 2, 3); g.fillRect(10, 18, 2, 3); g.fillRect(7, 6, 2, 3); for (let x = 1; x < 16; x += 4) { g.fillStyle = '#5e1010'; g.fillRect(x, 26, 2, 4); } }), side: T.DoubleSide });
  for (const z of [-0.4, 3, 6.4]) for (const sx of [-1, 1]) { const b = plano(1.3, 3.6, est1, sx * 11.7, 5.2, z, 0, est); b.rotation.y = -sx * Math.PI / 2; caja(0.08, 0.08, 1.6, ORO, sx * 11.68, 7.05, z, est); }
  for (const x of [-9, 9]) { const c = plano(4, 9, mat({ map: TX.tela('#8e1b1b', 6, 1), side: T.DoubleSide }), x, 4.5, Z0 + 0.9, 0, est); c.rotation.y = x < 0 ? 0.5 : -0.5; }
  // estatuas de mármol con lanza, sobre pedestales, a los lados del trono
  for (const sx of [-1, 1]) { const x = sx * 3.6, z = Z0 + 1.4; caja(1.1, 1.3, 1.1, MARM2, x, 0.65, z, est); caja(1.25, 0.15, 1.25, ORO, x, 1.32, z, est); const H = hombrecito(est, x, z, { piel: '#e9e0cf', ropa: '#dcd2bf', pelo: '#d0c6b2' }, 2.2, sx * -0.35); H.g.position.y = 1.4; H.brazoD.rotation.x = -0.4; cil(0.04, 0.04, 3.2, 6, MARM2, -0.33 * sx, 1.4 + 1.3, 0.25, H.g).rotation.x = 0.12; }
  // trono sobre escalones, con dosel rojo
  const tr = new T.Group(); tr.position.set(0, 0, Z0 + 1.1); scene.add(tr);
  for (let k = 0; k < 3; k++) caja(4.2 - k * 0.7, 0.18, 2.6 - k * 0.4, k % 2 ? MARM : MARM2, 0, 0.09 + k * 0.18, 0.3, est).position.z = Z0 + 1.4;
  caja(2.2, 0.5, 1.6, matK('#e0c890'), 0, 0.79, 0.3, tr); caja(1.6, 0.6, 1.1, matK('#7a1c1c'), 0, 1.34, 0.3, tr);
  caja(1.6, 2.6, 0.3, matK('#7a1c1c'), 0, 2.54, -0.2, tr); caja(1.9, 0.25, 0.4, ORO, 0, 3.84, -0.2, tr);
  caja(0.2, 1, 1, ORO, -0.85, 1.84, 0.3, tr); caja(0.2, 1, 1, ORO, 0.85, 1.84, 0.3, tr);
  const dosel = mat({ map: TX.tela('#7a1414', 4, 1), side: T.DoubleSide });
  plano(4.4, 6.5, dosel, 0, 4.2, Z0 + 0.3, 0, est); caja(5, 0.4, 1.4, ORO, 0, 7.6, Z0 + 0.8, est);
  for (const x of [-2.3, 2.3]) cil(0.09, 0.09, 7.4, 8, ORO, x, 3.7, Z0 + 1.4, est);
  // escudos y lanzas cruzadas en la pared del fondo
  for (const sx of [-1, 1]) { const x = sx * 6.6; const e = cil(0.75, 0.75, 0.12, 16, matK('#8e1b1b'), x, 4.4, Z0 + 0.3, est); e.rotation.x = Math.PI / 2; const b = cil(0.22, 0.22, 0.16, 10, ORO, x, 4.4, Z0 + 0.32, est); b.rotation.x = Math.PI / 2;
    for (const r of [-0.7, 0.7]) { const l = cil(0.035, 0.035, 3.4, 5, matK('#6a4a2a'), x, 4.4, Z0 + 0.25, est); l.rotation.z = r; } }
  // ánforas, macetas con plantas y una mesa con frutas y vino
  for (const [x, z] of [[-10.6, -5.4], [10.6, -5.4], [-10.6, 8.8], [10.6, 8.8]]) { cil(0.3, 0.2, 0.7, 10, matK('#a0502a'), x, 0.35, z, est); for (let k = 0; k < 6; k++) { const h = caja(0.08, 0.9 + (k % 3) * 0.25, 0.3, matK(k % 2 ? '#3a6a2a' : '#4a7a32'), x, 1.1, z, est); h.rotation.set((k % 2 ? 0.3 : -0.3), k * 1.05, 0); } }
  for (const [x, z] of [[-7.6, 1.7], [7.6, 5.1]]) { cil(0.28, 0.16, 0.9, 10, matK('#b06a3a'), x, 0.45, z, est); cil(0.12, 0.28, 0.25, 10, matK('#b06a3a'), x, 1.02, z, est); caja(0.05, 0.4, 0.3, matK('#6a3a1e'), x + 0.27, 0.75, z, est); }
  { const x = -8.3, z = 5.2; caja(2.2, 0.12, 1, mat({ map: TX.madera('#6a4422', 2, 1) }), x, 0.95, z, est); for (const [dx, dz] of [[-0.95, -0.38], [0.95, -0.38], [-0.95, 0.38], [0.95, 0.38]]) caja(0.1, 0.9, 0.1, matK('#4a2e16'), x + dx, 0.45, z + dz, est);
    cil(0.35, 0.25, 0.1, 12, ORO, x - 0.4, 1.06, z, est); for (const [fx, fz, c] of [[-0.5, 0.05, '#c8302a'], [-0.32, -0.08, '#e0b030'], [-0.42, -0.1, '#6a2a6a'], [-0.28, 0.1, '#c8302a']]) caja(0.12, 0.12, 0.12, matK(c), x + fx, 1.17, z + fz, est);
    cil(0.08, 0.13, 0.4, 8, matK('#4a6a8a'), x + 0.45, 1.2, z, est); for (const dx of [0.75, 0.9]) cil(0.05, 0.04, 0.16, 6, ORO, x + dx, 1.09, z + 0.15, est); }
  fundirEstatico(est, scene);
  // braseros de bronce sobre trípodes a lo largo de la alfombra (con fuego)
  const fl = [antorcha(scene, -7.6, 3.2, Z0 + 0.4, 1.2), antorcha(scene, 7.6, 3.2, Z0 + 0.4, 1.2)];
  const bronce = matK('#8a5a2a', { emissive: '#2a1206' });
  for (const [x, z] of [[-2.3, -1.6], [2.3, -1.6], [-2.3, 4.6], [2.3, 4.6]]) {
    const b = new T.Group(); b.position.set(x, 0, z); scene.add(b);
    for (let k = 0; k < 3; k++) { const l = cil(0.03, 0.03, 1.15, 5, bronce, Math.cos(k * 2.1) * 0.22, 0.55, Math.sin(k * 2.1) * 0.22, b); l.rotation.set(Math.sin(k * 2.1) * 0.25, 0, -Math.cos(k * 2.1) * 0.25); }
    cil(0.42, 0.2, 0.28, 12, bronce, 0, 1.18, 0, b);
    fl.push(antorcha(b, 0, 1.12, 0, z < 0 ? 0.9 : 0)); b.children[b.children.length - 1].children[0].visible = false;
  }
  // arañas de velas colgando del techo
  for (const z of [0.6, 6]) { const a = new T.Group(); a.position.set(0, 7.4, z); scene.add(a); cil(0.015, 0.015, 2.3, 4, matK('#3a3a3e'), 0, 1.15, 0, a); const ar = new T.Mesh(new T.TorusGeometry(0.85, 0.05, 6, 20), ORO); ar.rotation.x = Math.PI / 2; a.add(ar);
    for (let k = 0; k < 8; k++) { const c = cil(0.035, 0.035, 0.22, 5, matK('#f2ead8'), Math.cos(k * 0.785) * 0.85, 0.12, Math.sin(k * 0.785) * 0.85, a); const fg = new T.Sprite(new T.SpriteMaterial({ map: tex('llama', 8, 8, () => {}), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); fg.scale.set(0.12, 0.18, 1); fg.position.set(c.position.x, 0.3, c.position.z); a.add(fg); } }
  // rayos de luz que entran por los ventanales
  const rayoT = tex('rayoLuz', 4, 32, (g) => { for (let y = 0; y < 32; y++) { g.fillStyle = `rgba(255,232,170,${(0.55 * (1 - y / 32)).toFixed(3)})`; g.fillRect(0, y, 4, 1); } });
  const rayoM = new T.MeshBasicMaterial({ map: rayoT, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0.32 });
  for (const z of [-2.1, 1.3, 4.7, 8.1]) for (const sx of [-1, 1]) { const r = new T.Mesh(new T.PlaneGeometry(1.4, 9), rayoM); r.position.set(sx * 8.6, 3, z); r.rotation.set(0, Math.PI / 2, sx * 0.62); scene.add(r); }
  return { scene, fl, trono: tr };
}
ESC.salon = (opts = {}) => {
  const { scene, fl } = salonBase();
  const anda = () => C.z > C.camino.z1;
  const emps = [], llegada = [];
  const camera = new T.PerspectiveCamera(45, 16 / 9, 0.1, 60);
  const pos = (i, n) => (i - (n - 1) / 2) * 1.9;
  let n = 0;
  const S = {
    scene, camera, emps,
    setN(k, colores, razas, looks) { n = k; colores.forEach((c, i) => { const rz = razas ? razas[i] : undefined, lk = looks && looks[i] ? JSON.stringify(looks[i]) : ''; if (emps[i] && (emps[i].userData.raza !== rz || emps[i].userData.color !== c || emps[i].userData.look !== lk)) { const vieja = emps[i]; scene.remove(vieja); emps[i] = null; } if (!emps[i]) { emps[i] = spriteEmp(c, 1.25, rz, looks && looks[i]); emps[i].userData.raza = rz; emps[i].userData.color = c; emps[i].userData.look = lk; scene.add(emps[i]); llegada[i] = null; } }); emps.forEach((e, i) => { e.visible = i < n; if (i >= n) llegada[i] = null; }); },
    update(t, dt) {
      fl.forEach((f) => f(t));
      emps.forEach((e, i) => { if (i >= n) return; if (llegada[i] === null) llegada[i] = t; const a = Math.min(1, (t - llegada[i]) * 2.5); e.position.set(pos(i, n) + (S.offX || 0), (1 - a) * 3 + Math.abs(Math.sin(t * 2 + i)) * 0.03, 1.2); e.material.opacity = a; });
      if (S.cineOn) return cineUpdate(t, dt || 0.016);
      camera.position.set(Math.sin(t * 0.2) * 0.3, 2.2, 8); camera.lookAt(0, 1.6, 0);
    },
    // ---- CINEMÁTICA: el rey y el prota caminan por la nave hablando; plano, contraplano y plano general ----
    cine(quienes) {
      if (S.cineOn) return; S.cineOn = true; n = 0; emps.forEach((e) => { if (e) e.visible = false; });
      const tres = root.Voxel && root.Voxel.modo3D();
      const mk = (q) => {
        if (q === 'rey') { const e = spriteEmp('#c8a640', 1.74); if (e.voxel) { e.voxel.modo = 'paseo'; } return e; }
        const spec = q === 'diablo' ? { id: 'diablo', raza: 'gigante', color: '#3a0a06', piel: '#a8221a', arma: 'lanza', escudo: 'ninguno', armadura: 'ninguna', jefe: 'diablo' }
          : { id: 'prota', raza: 'humano', color: '#6a5a44', piel: '#c8956a', arma: 'cestus', escudo: 'ninguno', armadura: 'ninguna' };
        const f = gladSprite({ spec }, q === 'diablo' ? 3.7 : 1.78); if (f.voxel) f.voxel.modo = 'paseo'; return f;
      };
      C.act = {};
      for (const q of quienes) { const o = mk(q); scene.add(o); C.act[q] = o; }
      // dónde arranca cada uno: caminan desde la puerta hacia el trono, uno al lado del otro (el diablo espera en el trono)
      // con el diablo: él está parado al pie del trono y el rey y Prota quietos frente a él (no caminan)
      C.camino = C.act.diablo ? { z0: 1.4, z1: 1.4, v: 0 } : { z0: 6.8, z1: -1.6, v: 0.42 };
      if (C.act.rey) C.act.rey.position.set(-0.6, 0, C.camino.z0);
      if (C.act.prota) C.act.prota.position.set(0.6, 0, C.camino.z0 + 0.15);
      if (C.act.diablo) { C.act.diablo.position.set(0, 0, -2.6); C.act.diablo.rotation.y = 0; }
      S.bokeh = 0; S.foco = new T.Vector3();
      C.z = C.camino.z0; C.tres = tres; C.plano = 'general0'; C.t0 = 0; C.cuenta = 0;
    },
    // a cada línea, un corte: el que habla en plano medio (sobre el hombro del otro), y cada tanto un general de la sala
    plano(q) {
      if (!S.cineOn) return;
      C.cuenta++; C.habla = q;
      for (const k in C.act) { const v = C.act[k].voxel; if (v) v.habla = k === q; }
      const hay = (k) => !!C.act[k];
      if (hay('diablo')) {   // con el diablo: contrapicado sobre el hombro de Prota cuando habla él; picado sobre el hombro del diablo cuando le contestan
        C.plano = !hay(q) || q === 'narrador' ? (C.cuenta % 2 ? 'general' : 'general0') : C.cuenta % 5 === 0 ? 'general0' : 'sobre:' + q;
        C.t0 = C.tt || 0; return;
      }
      if (!hay(q) || q === 'narrador') C.plano = C.cuenta % 2 ? 'general' : 'cenital';
      else if (C.cuenta % 4 === 0) C.plano = 'general';
      else C.plano = 'sobre:' + q;
      C.t0 = C.tt || 0;
    },
  };
  const C = {};
  const _v = new T.Vector3(), _l = new T.Vector3();
  function cineUpdate(t, dt) {
    C.tt = t; fl.forEach((f) => f(t));
    // caminan hasta cerca del trono y ahí se miran
    const anda = C.z > C.camino.z1; if (anda) C.z = Math.max(C.camino.z1, C.z - C.camino.v * dt);
    const pos = { rey: [-0.6, C.z], prota: [0.6, C.z + 0.15] };
    for (const k of ['rey', 'prota']) {
      const o = C.act[k]; if (!o) continue;
      o.position.set(pos[k][0], 0, pos[k][1]);
      const v = o.voxel; if (v) { v.andar += ((anda ? 1 : 0) - (v.andar || 0)) * Math.min(1, dt * 4); v.mirar = anda ? (C.habla && C.habla !== k ? (k === 'rey' ? 0.5 : -0.5) : 0) : 0; }
      if (o.animar && !o.voxel) o.animar(dt, anda ? 'caminar' : 'quieto');
      else if (o.animar && k !== 'rey') o.animar(dt, 'quieto');
      // al frenar se dan vuelta para mirarse
      // hacia dónde mira en el mundo: camina hacia el trono (-z); al frenar, el rey mira a +x y el prota a -x (se miran)
      C.w = C.w || {}; const meta = anda || C.act.diablo ? Math.PI : k === 'rey' ? Math.PI / 2 : -Math.PI / 2;
      if (C.w[k] == null) C.w[k] = Math.PI; let d = meta - C.w[k]; d = Math.atan2(Math.sin(d), Math.cos(d)); C.w[k] += d * Math.min(1, dt * 2.5);
      if (C.tres && o.children[0]) o.rotation.y = C.w[k] - o.children[0].rotation.y;   // (el cuerpo de adentro gira solo según se mueve: se compensa)
    }
    if (C.act.diablo && C.act.diablo.animar) { C.act.diablo.animar(dt, 'quieto'); const v = C.act.diablo.voxel; if (v) { v.andar = 0; v.mirar = C.habla === 'rey' ? -0.25 : C.habla === 'prota' ? 0.25 : 0; } }
    // cámara
    const u = t - (C.t0 || 0), R = C.act.rey, P = C.act.prota, cab = (o, h) => _l.set(o.position.x, h, o.position.z);
    let fov = 42;
    if (C.plano.startsWith('sobre:')) {
      const D = C.act.diablo, hab = C.act[C.plano.slice(6)], otro = D ? (hab === D ? P || R : D) : hab === R ? P : R;
      if (otro && otro !== hab) {
        const hH = hab === D ? 3.45 : 1.55, hO = otro === D ? 3.25 : 1.55;
        // detrás del hombro del que escucha, del lado de afuera, apuntando a la cara del que habla (un poco por delante: caminan hacia la cámara)
        const dx = hab.position.x - otro.position.x, dz = hab.position.z - otro.position.z, dd = Math.hypot(dx, dz) || 1;
        const fx = anda ? 0 : -dx / dd, fz = anda ? -1 : -dz / dd;   // "atrás" del que escucha
        const lado = otro.position.x >= hab.position.x ? 1 : -1;
        _v.set(otro.position.x + fx * 1.3 + (fz ? lado * 0.45 : 0), hO + 0.02, otro.position.z + fz * 1.3 + (fx ? 0.45 : 0));
        if (D) {   // detrás del que escucha, corrido al costado (el hombro del diablo es más ancho), siempre por fuera
          const ab = otro === D ? 2.1 : 1.25, cost = otro === D ? 1.55 : 0.42, sx = otro === D ? 1 : otro.position.x >= 0 ? 1 : -1;
          _v.set(otro.position.x + fx * ab + (-fz) * cost * sx, otro === D ? 3.0 : 1.35, otro.position.z + fz * ab + fx * cost * sx);
        }
        if (anda) _v.set(otro.position.x + lado * 0.45, hO + 0.02, otro.position.z - 2.7);
        _v.x += Math.sin(u * 0.7) * 0.05; _v.y += Math.sin(u * 1.1) * 0.03;
        const mira = otro === D && R && P ? _l.set((R.position.x + P.position.x) / 2 + (hab.position.x - (R.position.x + P.position.x) / 2) * 0.35, 1.4, (R.position.z + P.position.z) / 2) : cab(hab, hH);   // contraplano del diablo: los dos juntos, un poco más el que habla
        S.camera.position.copy(_v); S.camera.lookAt(mira); fov = (D ? (hab === D ? 40 : 36) : 34) - Math.min(4, u * 0.6);
        S.foco.copy(_l); S.bokeh = 1;
      }
    } else if (C.plano === 'cenital') {
      S.bokeh = 0;
      const m = R || P; S.camera.position.set(1.2 + u * 0.06, 6.2, m.position.z - 2.2); S.camera.lookAt(0, 0.3, m.position.z - 0.2); fov = 52;
    } else {   // general: la sala entera con ellos dos chiquitos caminando
      const m = R || P || C.act.diablo, k = C.plano === 'general0' ? 1 : 0, D = C.act.diablo;
      S.camera.position.set(-8.2 + u * 0.15, 4.2, Math.min(8.5, m.position.z + 3.2)); S.camera.lookAt(0, 1.3, m.position.z - 1.2); fov = 50;
      if (k) { S.camera.position.set(0.2 + Math.sin(u * 0.2) * 0.4, 2.4, 9.2); S.camera.lookAt(0, 1.8, m.position.z - 3); fov = 44; }
      if (D && k) { S.camera.position.set(0.15 + Math.sin(u * 0.2) * 0.2, 1.5, 4.6 - u * 0.08); S.camera.lookAt(0, 2.5, -2.6); fov = 46; }   // desde atrás de ellos: el diablo enorme adelante
      else if (D) { S.camera.position.set(-6.4 + u * 0.1, 2.6, 2.2); S.camera.lookAt(0, 1.9, -0.8); fov = 50; }   // de costado: los tres
      S.foco.set(0, 1.6, D ? (k ? -2.6 : -0.6) : m.position.z); S.bokeh = D ? 0.55 : 0.4;
    }
    if (Math.abs(S.camera.fov - fov) > 0.05) { S.camera.fov = fov; S.camera.updateProjectionMatrix(); }
  }
  return S;
};
ESC.final = (opts) => {
  const { scene, fl } = salonBase();
  const e = spriteEmp(opts.color, 1.3); e.position.set(0, 1.12, -5.1); scene.add(e);
  const camera = new T.PerspectiveCamera(45, 16 / 9, 0.1, 60);
  const L = new T.SpotLight('#ffe8a0', 1.6, 14, 0.35, 0.5, 1); L.position.set(0, 7, -2); L.target = e; scene.add(L);
  return { scene, camera, update(t) { fl.forEach((f) => f(t)); camera.position.set(Math.sin(t * 0.3) * 0.6, 2.6, 4.5); camera.lookAt(0, 1.8, -5); } };
};

/* ---------- TABLERO: mesa de marfil y oro con 30 casilleros ---------- */
ESC.tablero = (opts) => {
  const scene = new T.Scene(); scene.background = new T.Color('#120d09');
  luces(scene, '#fff4dc', '#3a2a1a', 0.7, 0.55);
  const L = new T.PointLight('#ffd890', 0.6, 40); L.position.set(0, 12, 0); scene.add(L);
  caja(30, 1, 22, mat({ map: TX.madera('#5a3a20', 8, 6) }), 0, -0.6, 0, scene);              // mesa
  caja(22.4, 0.3, 15.6, matC('#f3ead6'), 0, 0.05, 0, scene);                                   // tablero de marfil
  const meandro = tex('meandro', 32, 8, (g) => { g.fillStyle = '#f3ead6'; g.fillRect(0, 0, 32, 8); g.fillStyle = '#c9a23e'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 7, 32, 1); for (let x = 0; x < 32; x += 8) { g.fillRect(x + 1, 2, 5, 1); g.fillRect(x + 5, 2, 1, 4); g.fillRect(x + 3, 5, 3, 1); g.fillRect(x + 3, 4, 1, 1); g.fillRect(x + 1, 2, 1, 4); } }, 20, 1);
  for (const [w, d, x, z, ry] of [[22.4, 0.5, 0, -7.55, 0], [22.4, 0.5, 0, 7.55, 0], [15.6, 0.5, -10.95, 0, Math.PI / 2], [15.6, 0.5, 10.95, 0, Math.PI / 2]]) {
    const b = caja(w, 0.34, d, [matC('#d9b444'), matC('#d9b444'), mat({ map: meandro }), matC('#d9b444'), matC('#d9b444'), matC('#d9b444')], x, 0.07, z, scene); b.rotation.y = ry;
  }
  // contorno negro de todo el tablero: un borde oscuro por fuera + líneas en las aristas
  caja(23.3, 0.34, 16.5, matC('#0a0705'), 0, 0.04, 0, scene);
  const linea = (obj) => { const l = new T.LineSegments(new T.EdgesGeometry(obj.geometry), new T.LineBasicMaterial({ color: '#000000' })); obj.add(l); return l; };
  { const marco = new T.Mesh(new T.BoxGeometry(23.3, 0.36, 16.5)); marco.position.set(0, 0.05, 0); linea(marco); scene.add(marco); marco.material.visible = false; }
  // casilleros: 10 arriba (→), 5 a la derecha (↓), 10 abajo (←), 5 a la izquierda (↑)
  const paso = 2.05, x0 = -4.5 * paso, z0 = -3 * paso;
  const pos = [];
  for (let i = 0; i < 10; i++) pos.push([x0 + i * paso, z0]);
  for (let i = 1; i <= 5; i++) pos.push([x0 + 9 * paso, z0 + i * paso]);
  for (let i = 0; i < 10; i++) pos.push([x0 + (9 - i) * paso, z0 + 6 * paso]);
  for (let i = 5; i >= 1; i--) pos.push([x0, z0 + i * paso]);
  const ICON = { subasta: '⚖️', evento: '📜', preparacion: '⚒️', pelea: '⚔️', recuperacion: '🩹', campeones: '👑' };
  const celdas = pos.map(([x, z], i) => {
    const f = opts.fases[i % opts.fases.length];
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#fbf4e2'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c9a23e'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 61, 64, 3); g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
    g.fillStyle = '#e8d9b0'; g.fillRect(5, 5, 54, 1); g.fillRect(5, 58, 54, 1);
    g.font = '24px serif'; g.textAlign = 'center'; g.fillText(ICON[f], 32, 34);
    g.fillStyle = '#6b5420'; g.font = "bold 11px 'Almendra SC', Georgia, serif"; g.fillText(String(i + 1), 32, 52);
    const t = new T.CanvasTexture(c); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter;
    const top = mat({ map: t, emissive: new T.Color('#000000') }), side = matC('#d8c48c');
    const m = caja(1.85, 0.22, 1.85, [side, side, top, side, side, side], x, 0.3, z, scene);
    linea(m);
    // sombra negra debajo: contorno grueso alrededor de cada casillero
    caja(2.0, 0.2, 2.0, matC('#0a0705'), x, 0.12, z, scene);
    return { m, top, y: 0.3, hundir: 0 };
  });
  const tokens = opts.colores.map((col, i) => { const s = spriteEmp(col, 1.6, undefined, opts.looks && opts.looks[i]); scene.add(s); return { s, from: null, to: null, t0: 0 }; });
  const camera = new T.PerspectiveCamera(42, 16 / 9, 0.1, 80); camera.position.set(0, 19, 11.5); camera.lookAt(0, 0, 0.8);
  let cur = 1, hop = null, pisado = 1;   // pisado: casillero donde ya aterrizaron (se hunde y se ilumina)
  const brillo = new T.PointLight('#ffcc55', 0, 6); scene.add(brillo);
  const lugar = (cas, i) => { const [x, z] = pos[cas - 1]; return [x - 0.55 + (i % 3) * 0.55, z - 0.1 + Math.floor(i / 3) * 0.6]; };
  const S = {
    scene, camera,
    setCasillero(cas, animar) {
      celdas.forEach((c, i) => { c.top.color.set(i + 1 < cas ? '#b8ad94' : '#ffffff'); });
      if (animar && cur !== cas) { hop = { de: cur, a: cas, t0: null }; pisado = 0; if (window.Sonido) Sonido.salto(); } else { pisado = cas; tokens.forEach((k, i) => { const [x, z] = lugar(cas, i); k.s.position.set(x, 0.42, z); }); }
      cur = cas;
    },
    update(t) {
      celdas.forEach((c, i) => {
        const on = i + 1 === pisado;
        c.hundir += ((on ? 1 : 0) - c.hundir) * 0.18;
        c.m.position.y = c.y - 0.13 * c.hundir;
        const p = on ? 0.5 + 0.2 * Math.sin(t * 4) : 0;
        c.top.emissive.setRGB(p * 1.1, p * 0.8, p * 0.15);
      });
      if (pisado) { const [bx, bz] = pos[pisado - 1]; brillo.position.set(bx, 1.4, bz); brillo.intensity = 1.2 + 0.4 * Math.sin(t * 4); } else brillo.intensity = 0;
      if (hop) {
        if (hop.t0 === null) hop.t0 = t;
        const k = Math.min(1, (t - hop.t0) / 0.7);
        tokens.forEach((tk, i) => { const [x1, z1] = lugar(hop.de, i), [x2, z2] = lugar(hop.a, i); const kk = Math.min(1, Math.max(0, k * 1.3 - i * 0.06)); tk.s.position.set(x1 + (x2 - x1) * kk, 0.42 + Math.sin(kk * Math.PI) * 1.2, z1 + (z2 - z1) * kk); });
        if (k >= 1) { pisado = hop.a; hop = null; if (window.Sonido) Sonido.ficha(); }
      } else { const dy = pisado ? -0.13 * celdas[pisado - 1].hundir : 0; tokens.forEach((tk, i) => { tk.s.position.y = 0.42 + dy + Math.abs(Math.sin(t * 2.2 + i)) * 0.05; }); }
    },
  };
  return S;
};

/* ---------- CALLE DE LA SUBASTA: carro, mesa y monedas ---------- */
ESC.calle = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#8ec5e8'); scene.fog = new T.Fog('#bfe0f0', 22, 55);
  luces(scene, '#ffffff', '#8a7a62', 0.7, 0.75);
  caja(60, 0.2, 10, mat({ map: TX.adoquin('#8a7a62', 20, 4) }), 0, -0.1, -1, scene);       // calle
  caja(60, 0.35, 2, mat({ map: TX.piedra('#a8977a', 20, 1) }), 0, 0.05, -6.6, scene);    // vereda
  // casas medievales: planta baja de piedra, arriba revoque blanco con vigas de madera cruzadas, techo a dos aguas y chimenea
  const est = new T.Group();
  const viga = matK('#3a2414'), piedraB = mat({ map: TX.piedra('#8a7e6e', 3, 1) }), tejaM = mat({ map: TX.teja(4, 3) });
  const revs = ['#e8dcc0', '#dccaa4', '#efe4cc', '#d6c29a'].map((c) => mat({ map: TX.revoque(c, 2, 2) }));
  // techo a dos aguas: prisma triangular con la cumbrera a lo largo de la fachada (base en y = 0, ancho w, alto h, fondo d)
  const PRISMA = new T.CylinderGeometry(1, 1, 1, 3, 1); PRISMA.rotateZ(Math.PI / 2); PRISMA.rotateX(-Math.PI / 2); PRISMA.translate(0, 0.5, 0);
  const prisma = (w, h, d, m, x, y, z) => { const o = new T.Mesh(PRISMA, m); o.scale.set(w, h / 1.5, d / 1.732); o.position.set(x, y, z); est.add(o); return o; };
  let x = -30, nc = 0;
  while (x < 30) {
    const w = 3.2 + rnd() * 1.8, h1 = 2.4, h2 = 2 + rnd() * 1.6, d = 3.2, zc = -9.4, cx = x + w / 2, m2 = revs[nc++ % 4];
    caja(w, h1, d, piedraB, cx, h1 / 2, zc, est);                                    // planta baja de piedra
    caja(w + 0.5, h2, d + 0.5, m2, cx, h1 + h2 / 2, zc + 0.25, est);                // planta alta, sobresale
    caja(w + 0.6, 0.18, d + 0.6, viga, cx, h1 + 0.09, zc + 0.25, est);
    const fz = zc + 0.25 + (d + 0.5) / 2 + 0.03;                                      // vigas en la fachada
    for (let k = 0; k <= 3; k++) caja(0.14, h2, 0.08, viga, cx - (w + 0.5) / 2 + 0.07 + k * ((w + 0.36) / 3), h1 + h2 / 2, fz, est);
    caja(w + 0.5, 0.14, 0.08, viga, cx, h1 + h2 - 0.07, fz, est);
    for (let k = 0; k < 3; k++) { const cxk = cx - (w + 0.5) / 2 + (k + 0.5) * ((w + 0.5) / 3), b = caja(0.1, Math.hypot(h2, (w + 0.5) / 3) * 0.95, 0.07, viga, cxk, h1 + h2 / 2, fz + 0.01, est); b.rotation.z = (k % 2 ? 1 : -1) * Math.atan2((w + 0.5) / 3, h2); }
    // ventanitas con postigos y una puerta
    for (const vx of [-(w / 4), w / 4]) { caja(0.55, 0.6, 0.06, matK('#2a2018'), cx + vx, h1 + h2 * 0.55, fz + 0.03, est); caja(0.22, 0.62, 0.05, matK(nc % 2 ? '#3a5a3a' : '#6a2a1a'), cx + vx - 0.4, h1 + h2 * 0.55, fz + 0.05, est); }
    caja(0.9, 1.7, 0.08, mat({ map: TX.madera('#5a3418', 1, 2) }), cx + (rnd() - 0.5) * (w - 1.4), 0.85, zc + d / 2 + 0.03, est);
    caja(0.5, 0.45, 0.06, matK('#2a2018'), cx + w / 3, 1.5, zc + d / 2 + 0.03, est);
    // techo a dos aguas (prisma) con alero, y chimenea
    prisma(w + 0.8, 1.7 + rnd() * 0.9, d + 1.2, tejaM, cx, h1 + h2, zc + 0.25);
    if (rnd() < 0.6) caja(0.45, 1.6, 0.45, piedraB, cx + w * 0.25, h1 + h2 + 1.1, zc - 0.4, est);
    if (rnd() < 0.4) { const a = caja(w * 0.7, 0.06, 1.1, mat({ map: TX.tela(rnd() < 0.5 ? '#a32d2d' : '#2d5aa3', 4, 1) }), cx, 2.25, zc + d / 2 + 0.5, est); a.rotation.x = 0.35; }
    if (rnd() < 0.35) { cil(0.32, 0.28, 0.75, 8, matK('#6a4a2a'), cx - w / 3, 0.38, zc + d / 2 + 0.5, est); }   // barril
    x += w + 0.35;
  }
  // la fuente vacía al fondo: pileta octogonal seca, con musgo y una columna con la taza de arriba
  { const fx = 7.2, fz = -5.4, PI = matK('#9a8f7c'), PO = matK('#7c7262'), MU = matK('#4a5a32');
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, b = caja(1.45, 0.75, 0.32, PI, fx + Math.cos(a) * 1.75, 0.38, fz + Math.sin(a) * 1.75, est); b.rotation.y = -a + Math.PI / 2; caja(1.5, 0.12, 0.42, PO, fx + Math.cos(a) * 1.75, 0.8, fz + Math.sin(a) * 1.75, est).rotation.y = -a + Math.PI / 2; }
    cil(1.75, 1.75, 0.08, 8, matK('#5a5040'), fx, 0.06, fz, est);                       // fondo seco
    for (let k = 0; k < 9; k++) { const m = caja(0.3 + rnd() * 0.4, 0.02, 0.2 + rnd() * 0.3, k % 3 ? matK('#4a4232') : MU, fx + (rnd() - 0.5) * 2.4, 0.11, fz + (rnd() - 0.5) * 2.4, est); m.rotation.y = rnd() * 3; }
    cil(0.26, 0.34, 1.8, 8, PI, fx, 1, fz, est); cil(0.85, 0.35, 0.3, 10, PI, fx, 1.95, fz, est); cil(0.14, 0.18, 0.55, 8, PO, fx, 2.35, fz, est); cil(0.22, 0.1, 0.18, 8, PO, fx, 2.68, fz, est);
    caja(0.5, 0.06, 0.12, MU, fx + 0.6, 2.05, fz + 0.2, est); caja(0.25, 0.25, 0.25, PO, fx + 1.1, 0.13, fz + 1.4, est); }   // musgo y una piedra caída
  fundirEstatico(est, scene);
  // coliseo a lo lejos
  const col = new T.Mesh(new T.CylinderGeometry(8, 8, 6, 24, 1, true), mat({ map: TX.arcos(10, 2), side: T.DoubleSide })); col.position.set(16, 3, -32); scene.add(col);
  // el carro
  const carro = new T.Group(); scene.add(carro); carro.position.set(-22, 0, -1.2);
  const wood = mat({ map: TX.madera('#7b5530', 2, 1) }), woodD = matC('#4a3018');
  caja(4.2, 0.25, 1.9, wood, 0, 0.75, 0, carro);
  for (let bx = -2; bx <= 2.01; bx += 0.42) { caja(0.09, 2.2, 0.09, woodD, bx, 1.95, 0.9, carro); caja(0.09, 2.2, 0.09, woodD, bx, 1.95, -0.9, carro); }
  caja(4.3, 0.12, 1.95, woodD, 0, 3.05, 0, carro);
  const ruedas = [];
  for (const [wx, wz] of [[-1.4, 1.05], [1.4, 1.05], [-1.4, -1.05], [1.4, -1.05]]) {
    const r = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.14, 10), mat({ map: tex('rueda', 16, 16, (g) => { g.fillStyle = '#7b5530'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#4a3018'; g.fillRect(7, 0, 2, 16); g.fillRect(0, 7, 16, 2); g.fillRect(0, 0, 16, 1); }) }));
    r.rotation.x = Math.PI / 2; r.position.set(wx, 0.55, wz); carro.add(r); ruedas.push(r);
  }
  // caballo
  const cab = new T.Group(); cab.position.set(3.4, 0, 0); carro.add(cab);
  const pel = matC('#6a4428');
  caja(1.6, 0.7, 0.6, pel, 0.3, 1.45, 0, cab); caja(0.35, 0.8, 0.35, pel, 1.05, 2.0, 0, cab).rotation.z = -0.5; caja(0.6, 0.3, 0.3, pel, 1.4, 2.35, 0, cab);
  const patas = [[-0.3, 0.2], [-0.3, -0.2], [0.85, 0.2], [0.85, -0.2]].map(([px, pz]) => caja(0.16, 1.1, 0.16, matC('#4a2e18'), px, 0.55, pz, cab));
  caja(1.4, 0.08, 0.08, woodD, -0.7, 1.3, 0.35, cab); caja(1.4, 0.08, 0.08, woodD, -0.7, 1.3, -0.35, cab);
  // el carrero: camina al lado del caballo, de la rienda
  const carrero = hombrecito(cab, 1.2, 0.95, { piel: '#c8956a', ropa: '#5a6a3a', pelo: '#3a2a18' }, 1.72, 0);
  caja(0.36, 0.1, 0.36, matK('#6a4a2a'), 0, 1.86, 0, carrero.g); caja(0.24, 0.16, 0.24, matK('#6a4a2a'), 0, 1.95, 0, carrero.g);   // sombrero
  carrero.brazoI.rotation.x = -0.7; caja(0.03, 0.03, 0.7, matK('#2a1a0c'), 0.32, 1.12, -0.45, carrero.g).rotation.x = 0.4;   // la rienda
  carrero.g.rotation.y = Math.PI / 2;
  let gl = [];
  // la mesa de las pujas (primer plano): una sola mesa con paño, sin divisiones; cada rey tira sus monedas a su lugar
  const mesaY = 1.5, mesaG = new T.Group(); scene.add(mesaG);
  caja(20, 0.28, 3.8, mat({ map: TX.madera('#5e3e22', 10, 2) }), 0, mesaY - 0.14, 7.4, mesaG);
  caja(19.2, 0.02, 3.2, mat({ map: TX.panio('#6a1c16', 30, 5) }), 0, mesaY + 0.005, 7.4, mesaG);   // paño
  caja(19.3, 0.035, 0.06, matC('#c9a227', { emissive: '#3a2a00' }), 0, mesaY + 0.01, 5.78, mesaG);   // ribete dorado
  caja(19.3, 0.035, 0.06, matC('#c9a227', { emissive: '#3a2a00' }), 0, mesaY + 0.01, 9.02, mesaG);
  caja(20.2, 0.14, 0.22, matC('#3a2410'), 0, mesaY + 0.02, 5.5, mesaG);
  for (const x of [-9, 9]) caja(0.3, mesaY, 0.3, matC('#3a2410'), x, mesaY / 2, 6, mesaG);
  // monedas: todas en un InstancedMesh (miles sin que pese); no se borra ninguna hasta el próximo carro
  const MAXM = 4000, CH = 0.03, RAD = 0.085, COL = 20;
  const mon = new T.InstancedMesh(new T.CylinderGeometry(RAD, RAD, CH, 12), mat({ map: TX.oro(), emissive: '#3a2a00' }), MAXM);
  mon.instanceMatrix.setUsage(T.DynamicDrawUsage); mon.count = 0; mon.frustumCulled = false; scene.add(mon);
  const dummy = new T.Object3D(), monedas = [], cuenta = [];
  const camera = new T.PerspectiveCamera(44, 16 / 9, 0.1, 90); camera.position.set(0, 4.3, 11.5); camera.lookAt(0, 1.6, 0);
  const S = {
    scene, camera, carro, mesaY, mesaG, caballo: cab, carrero,
    setLote(lote) {   // lote: [{canvas, altura, raza}]
      gl.forEach((s) => carro.remove(s)); gl = [];
      lote.forEach((g, i) => { const s = gladSprite(g, Math.min(2.1, g.altura * 0.95)); s.position.set(-1.4 + (i + 0.5) * (2.8 / lote.length), 0.88, 0); carro.add(s); gl.push(s); });
    },
    setSpots(spots) { S.spots = spots; },   // spots: [{x, z}] lugar de cada rey sobre la mesa
    // una moneda = 1 oro: sale de abajo (de la mano del rey, fuera de cuadro) y cae en su pila
    moneda(i) {
      const sp = S.spots && S.spots[i]; if (!sp || mon.count >= MAXM) return;
      const k = cuenta[i] = (cuenta[i] || 0) + 1, n = k - 1, col = Math.floor(n / COL), alto = n % COL;
      const fila = Math.floor(col / 4), cc = col % 4;   // columnas de 20, de a 4 por fila, hacia atrás
      const tx = sp.x + (cc - 1.5) * (RAD * 2.25) + (fila % 2) * RAD, tz = sp.z - fila * (RAD * 2.2), ty = mesaY + 0.02 + CH / 2 + alto * CH;
      const o = { id: mon.count++, x0: sp.x * 0.85 + (rnd() - 0.5) * 0.8, y0: mesaY - 1.4, z0: 10.4, tx, ty, tz, t: 0, dur: 0.42 + rnd() * 0.12, alto: 0.7 + rnd() * 0.5, giro: (rnd() - 0.5) * 30, listo: false };
      monedas.push(o); S._pon(o, 0);
    },
    _pon(o, f) {
      const e = f < 1 ? f : 1, h = 4 * o.alto * e * (1 - e);
      dummy.position.set(o.x0 + (o.tx - o.x0) * e, o.y0 + (o.ty - o.y0) * e + h, o.z0 + (o.tz - o.z0) * e);
      if (f < 1) dummy.rotation.set(o.giro * f, 0, o.giro * 0.6 * f); else dummy.rotation.set(0, (o.id * 1.7) % 6.28, 0);
      dummy.updateMatrix(); mon.setMatrixAt(o.id, dummy.matrix); mon.instanceMatrix.needsUpdate = true;
    },
    limpiarMonedas() { monedas.length = 0; cuenta.length = 0; mon.count = 0; mon.instanceMatrix.needsUpdate = true; },
    // la mesita de los reyes (intro): mesa redonda con paño, tres banquitos y una pila de monedas por rey.
    // Los reyes se sientan del lado de atrás (z local -) mirando hacia +z local (hacia el carro).
    mesita(cx, cz, ang) {
      const g = new T.Group(); g.position.set(cx, 0, cz); g.rotation.y = ang; scene.add(g);
      const md = mat({ map: TX.madera('#5e3e22', 2, 2) }), osc = matC('#3a2410');
      cil(0.82, 0.82, 0.08, 18, md, 0, 0.6, 0, g); cil(0.76, 0.76, 0.012, 18, matC('#6a1c16'), 0, 0.646, 0, g); cil(0.83, 0.83, 0.02, 18, matC('#c9a227', { emissive: '#3a2a00' }), 0, 0.57, 0, g);
      cil(0.09, 0.16, 0.56, 8, osc, 0, 0.28, 0, g); cil(0.4, 0.4, 0.04, 10, osc, 0, 0.02, 0, g);
      const LX = [-0.62, 0, 0.62], asientos = [];
      for (const lx of LX) { cil(0.19, 0.17, 0.05, 10, md, lx, 0.4, -0.98, g); for (const [a2, b2] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) caja(0.04, 0.38, 0.04, osc, lx + a2, 0.19, -0.98 + b2, g); asientos.push(new T.Vector3(lx, 0, -0.98)); }
      g.updateMatrixWorld(true);
      // monedas de la mesita: una pila por rey, sale de su mano y cae en su pila
      const MX = 900, RM = 0.045, HM = 0.016;
      const im = new T.InstancedMesh(new T.CylinderGeometry(RM, RM, HM, 10), mat({ map: TX.oro(), emissive: '#3a2a00' }), MX); im.count = 0; im.frustumCulled = false; g.add(im);
      const pilas = [0, 0, 0], vuelo = [], d2 = new T.Object3D();
      const destino = (i, n) => { const col = Math.floor(n / 8), alto = n % 8; return new T.Vector3(LX[i] * 0.8 + (col % 3 - 1) * RM * 2.3, 0.652 + HM / 2 + alto * HM, -0.42 + Math.floor(col / 3) * RM * 2.3); };
      const pon = (o, f) => { const e = Math.min(1, f), h2 = 4 * 0.25 * e * (1 - e); d2.position.lerpVectors(o.a, o.b, e); d2.position.y += h2; d2.rotation.set(f < 1 ? f * 9 : 0, o.id, 0); d2.updateMatrix(); im.setMatrixAt(o.id, d2.matrix); im.instanceMatrix.needsUpdate = true; };
      const M2 = {
        grupo: g, asientos: asientos.map((v) => g.localToWorld(v.clone())), ang,
        // n monedas del rey i: de a una, desde su mano; sin animación si ya = true (las que tenía de antes)
        poner(i, n, ya) { for (let k = 0; k < n && im.count < MX; k++) { const o = { id: im.count++, a: new T.Vector3(LX[i], 0.95, -0.75), b: destino(i, pilas[i]++), t: ya ? 1 : -k * 0.07 }; if (ya) pon(o, 1); else vuelo.push(o); } },
        paso(dt) { for (let k = vuelo.length - 1; k >= 0; k--) { const o = vuelo[k]; o.t += dt; if (o.t < 0) continue; pon(o, o.t / 0.35); if (o.t >= 0.35) { vuelo.splice(k, 1); if (Math.random() < 0.5) root.Sonido && root.Sonido.moneda && root.Sonido.moneda(); } } },
        local: (x, y, z) => g.localToWorld(new T.Vector3(x, y, z)),
      };
      S._mesita = M2; return M2;
    },
    andando: 0,
    update(t, dt) {
      ruedas.forEach((r) => { r.rotation.y -= S.andando * dt * 1.8; });
      gl.forEach((s) => s.animar && s.animar(dt, 'quieto'));
      patas.forEach((p, i) => { p.rotation.z = S.andando ? Math.sin(t * 10 + i * 1.6) * 0.4 : 0; });
      { const a2 = S.andando ? Math.sin(t * 8) * 0.55 : 0; carrero.piernaD.rotation.x = a2; carrero.piernaI.rotation.x = -a2; carrero.brazoD.rotation.x = -a2 * 0.6; carrero.cab.rotation.y = S.andando ? 0 : Math.sin(t * 0.7) * 0.4; }
      for (const o of monedas) { if (o.listo) continue; o.t += dt; const f = o.t / o.dur; S._pon(o, f); if (f >= 1) o.listo = true; }
      if (S._mesita) S._mesita.paso(dt);
    },
  };
  return S;
};

/* ---------- EL CHAMÁN: claro del bosque con un círculo de piedras y el chamán en el medio ---------- */
ESC.chaman = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#0c1414'); scene.fog = new T.Fog('#0c1414', 10, 30);
  scene.add(new T.HemisphereLight('#7a9ab8', '#1a2014', 0.5));
  const luna = new T.DirectionalLight('#9ab4e0', 0.35); luna.position.set(-6, 10, -4); scene.add(luna);
  const est = new T.Group();
  cil(30, 30, 0.2, 24, mat({ map: TX.tierra(14, 14), color: '#5a6a4a' }), 0, -0.1, 0, est);
  for (let i = 0; i < 160; i++) { const a = rnd() * 6.28, r = 3.6 + rnd() * 22, m = caja(0.06, 0.25 + rnd() * 0.3, 0.06, matK(rnd() < 0.5 ? '#2e4a22' : '#3c5a2a'), Math.cos(a) * r, 0.12, Math.sin(a) * r, est); m.rotation.set(rnd() * 0.4, rnd() * 3, rnd() * 0.4); }
  // el círculo de piedras paradas (menhires), algunas con un dintel encima
  const PI = matK('#7a7a72'), PO = matK('#5e5e58'), MU = matK('#3c5030');
  const N = 12, RC = 4.2;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2, h = 2.2 + ((k * 37) % 7) * 0.12, x = Math.cos(a) * RC, z = Math.sin(a) * RC;
    const p = caja(0.75, h, 0.45, k % 3 ? PI : PO, x, h / 2, z, est); p.rotation.y = -a + Math.PI / 2; p.rotation.z = ((k * 13) % 5 - 2) * 0.025;
    caja(0.5, 0.2, 0.47, MU, x, 0.25 + (k % 4) * 0.4, z, est).rotation.y = -a + Math.PI / 2;
    if (k % 3 === 0) { const a2 = ((k + 1) / N) * Math.PI * 2, mx = (x + Math.cos(a2) * RC) / 2, mz = (z + Math.sin(a2) * RC) / 2, d = caja(2.3, 0.4, 0.5, PO, mx, h + 0.25, mz, est); d.rotation.y = -(a + a2) / 2 + Math.PI / 2 + Math.PI / 2; d.rotation.y = Math.atan2(-(Math.sin(a2) * RC - z), Math.cos(a2) * RC - x); }
  }
  // árboles alrededor (troncos + copas de pino en capas)
  for (let i = 0; i < 46; i++) {
    const a = rnd() * 6.28, r = 8 + rnd() * 16, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 3 + rnd() * 3;
    cil(0.18, 0.26, h, 6, matK('#3a2616'), x, h / 2, z, est);
    for (let c = 0; c < 3; c++) cil(0, 1.5 - c * 0.35, 1.8, 7, matK(c % 2 ? '#1e3a22' : '#24442a'), x, h * 0.55 + c * 1.1, z, est);
  }
  // el altar: losa de piedra con calaveras y velas
  caja(1.6, 0.5, 0.9, PO, 0, 0.25, -1.6, est); caja(1.7, 0.08, 1, PI, 0, 0.54, -1.6, est);
  for (const dx of [-0.55, 0.55]) { caja(0.22, 0.2, 0.22, matK('#e8e0cc'), dx, 0.68, -1.6, est); caja(0.06, 0.04, 0.02, matK('#1a120c'), dx - 0.05, 0.7, -1.49, est); caja(0.06, 0.04, 0.02, matK('#1a120c'), dx + 0.05, 0.7, -1.49, est); }
  fundirEstatico(est, scene);
  // la fogata del medio
  const fuego = antorcha(scene, 0, 0.1, 0.4, 1.3); scene.children[scene.children.length - 1].children[0].visible = false;
  for (let k = 0; k < 6; k++) { const l = caja(0.12, 0.12, 0.9, matK('#4a2e16'), Math.cos(k) * 0.2, 0.1, 0.4 + Math.sin(k) * 0.2, scene); l.rotation.y = k; }
  for (let k = 0; k < 9; k++) caja(0.22, 0.16, 0.22, PO, Math.cos(k * 0.7) * 0.6, 0.08, 0.4 + Math.sin(k * 0.7) * 0.6, scene);
  // el chamán: túnica, máscara de hueso, tocado de plumas y bastón
  const ch = hombrecito(scene, 0, -0.6, { piel: '#8a5a3a', ropa: '#4a3a5a', pelo: '#1a120c' }, 1.8, 0);
  caja(0.62, 0.7, 0.36, matK('#3a2a4a'), 0, 0.45, 0, ch.g);   // falda de la túnica
  caja(0.32, 0.22, 0.05, matK('#e8e0cc'), 0, 1.66, 0.16, ch.g); caja(0.06, 0.05, 0.02, matK('#1a120c'), -0.07, 1.68, 0.19, ch.g); caja(0.06, 0.05, 0.02, matK('#1a120c'), 0.07, 1.68, 0.19, ch.g);
  for (let k = -3; k <= 3; k++) { const pl = caja(0.05, 0.45, 0.03, matK(k % 2 ? '#c8302a' : '#e0b030'), k * 0.06, 2.0, -0.05, ch.g); pl.rotation.z = -k * 0.18; }
  const baston = new T.Group(); baston.position.set(0, -0.62, 0); ch.brazoD.add(baston);
  cil(0.03, 0.03, 1.9, 5, matK('#5a3a1e'), 0, 0.3, 0.05, baston); caja(0.16, 0.16, 0.16, matK('#e8e0cc'), 0, 1.25, 0.05, baston);
  const gema = new T.Mesh(new T.OctahedronGeometry(0.11), new T.MeshBasicMaterial({ color: '#7af0d0' })); gema.position.set(0, 1.45, 0.05); baston.add(gema);
  const brillo = new T.PointLight('#5ae0c0', 0.9, 7, 1.5); brillo.position.set(0, 2.6, -0.4); scene.add(brillo);
  // luciérnagas
  const NL = 40, lp = new Float32Array(NL * 3), lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(lp, 3));
  const luz = new T.Points(lg, new T.PointsMaterial({ color: '#d8ff8a', size: 0.09, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })); scene.add(luz);
  const semillas = Array.from({ length: NL }, () => [rnd() * 6.28, 2 + rnd() * 6, 0.4 + rnd() * 2.2, rnd() * 6]);
  // las piedras de los dos que se fusionan, a los costados del chamán
  const par = [null, null], ppos = [[-1.9, 0.3], [1.9, 0.3]];
  for (const [x, z] of ppos) cil(0.55, 0.65, 0.3, 10, PI, x, 0.15, z, scene);
  let fx = 0, fxOk = true;
  const anillo = new T.Mesh(new T.TorusGeometry(1, 0.06, 6, 40), new T.MeshBasicMaterial({ color: '#7af0d0', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); anillo.rotation.x = Math.PI / 2; anillo.position.y = 0.2; scene.add(anillo);
  const camera = new T.PerspectiveCamera(58, 16 / 9, 0.1, 80); camera.setViewOffset(1, 1, -0.2, 0, 1, 1);   // el panel tapa la izquierda: la escena se corre a la derecha
  const S = {
    scene, camera,
    setPar(a, b) { par.forEach((o, i) => { if (o) scene.remove(o); par[i] = null; }); [a, b].forEach((g, i) => { if (!g) return; const o = gladSprite(g, Math.min(2.4, g.altura || 1.8)); o.position.set(ppos[i][0], 0.3, ppos[i][1]); scene.add(o); par[i] = o; }); },
    fusion(ok) { fx = 1.6; fxOk = ok; },
    update(t, dt) {
      fuego(t);
      ch.brazoD.rotation.x = -0.5 + Math.sin(t * 1.3) * 0.12 - (fx > 0 ? 1.4 : 0); ch.brazoI.rotation.x = -0.3 + Math.sin(t * 1.3 + 1) * 0.3 - (fx > 0 ? 2.2 : 0); ch.brazoI.rotation.z = fx > 0 ? -0.5 : 0;
      ch.g.rotation.y = Math.sin(t * 0.4) * 0.25; ch.g.position.y = Math.abs(Math.sin(t * 1.3)) * 0.04 + (fx > 0 ? Math.sin(fx * 6) * 0.08 + 0.1 : 0);
      gema.rotation.y = t * 1.5; brillo.intensity = 0.9 + Math.sin(t * 2.3) * 0.25 + (fx > 0 ? fx * 3 : 0);
      for (let k = 0; k < NL; k++) { const [a, r, h, f] = semillas[k], aa = a + t * 0.08 * (k % 2 ? 1 : -1); lp[k * 3] = Math.cos(aa) * r + Math.sin(t * 0.7 + f) * 0.3; lp[k * 3 + 1] = h + Math.sin(t * 1.1 + f) * 0.25; lp[k * 3 + 2] = Math.sin(aa) * r; }
      lg.attributes.position.needsUpdate = true;
      par.forEach((o) => o && o.animar && o.animar(dt, 'quieto'));
      if (fx > 0) {
        fx = Math.max(0, fx - dt); const u = 1 - fx / 1.6;
        anillo.material.color.set(fxOk ? '#9af0ff' : '#ff4a3a'); anillo.material.opacity = Math.sin(u * Math.PI) * 0.9; anillo.scale.setScalar(0.3 + u * 4.5);
        par.forEach((o, i) => { if (!o) return; if (i === 1 || !fxOk) { o.position.x = ppos[i][0] * (1 - u * 0.9); o.position.y = 0.3 + Math.sin(u * Math.PI) * 0.8; } });
        if (fx === 0) { par.forEach((o, i) => { if (o && (i === 1 || !fxOk)) { scene.remove(o); par[i] = null; } }); anillo.material.opacity = 0; }
      }
      camera.position.set(Math.sin(t * 0.12) * 0.5, 2.5, 3.6); camera.lookAt(0, 1.15, -0.6);
    },
  };
  return S;
};

/* ---------- LA SALA DEL CURANDERO: 8 camas, hierbas colgando, frascos ---------- */
ESC.curandero = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#140e0a'); scene.fog = new T.Fog('#140e0a', 12, 26);
  luces(scene, '#ffe2b8', '#3a2a1a', 0.55, 0.3);
  const est = new T.Group();
  caja(14, 0.2, 12, mat({ map: TX.madera('#6a4a2a', 7, 6) }), 0, -0.1, 0, est);
  caja(14, 6, 0.4, mat({ map: TX.piedra('#8a7a66', 6, 3) }), 0, 3, -5.8, est);
  for (const x of [-7, 7]) caja(0.4, 6, 12, mat({ map: TX.piedra('#7a6a56', 5, 3) }), x, 3, 0, est);
  for (let z = -5; z <= 5; z += 2) caja(14, 0.3, 0.3, matK('#3a2414'), 0, 5.4, z, est);
  // ventana con luz de día
  plano(1.6, 1.8, matK('#ffe8b0', { emissive: '#b08a40' }), 0, 3.4, -5.58, 0, est); caja(0.12, 1.9, 0.1, matK('#3a2414'), 0, 3.4, -5.55, est); caja(1.7, 0.12, 0.1, matK('#3a2414'), 0, 3.4, -5.55, est);
  // estantes con frascos y hierbas colgando
  for (const sx of [-1, 1]) {
    for (const y of [1.6, 2.4, 3.2]) { caja(0.4, 0.08, 3.4, matK('#4a2e16'), sx * 6.6, y, -3.2, est); for (let k = 0; k < 7; k++) cil(0.08, 0.1, 0.24 + (k % 3) * 0.08, 6, matK(['#4a8a6a', '#8a4a2a', '#c8b07a', '#6a3a7a'][(k + y * 3) % 4 | 0]), sx * 6.6, y + 0.17, -4.6 + k * 0.45, est); }
    for (let k = 0; k < 8; k++) { const z = -4.5 + k * 1.3, h = 0.4 + (k % 3) * 0.15; caja(0.02, 0.4, 0.02, matK('#6a5a3a'), sx * 5.9, 5.1, z, est); for (let j = 0; j < 4; j++) caja(0.1, h, 0.05, matK(j % 2 ? '#5a7a3a' : '#7a8a4a'), sx * 5.9 + (j - 1.5) * 0.05, 4.9 - h / 2, z, est); }
  }
  // mesa de la curandera con mortero, vendas y una vela
  caja(2.2, 0.1, 1, matK('#6a4422'), 0, 0.95, -4.6, est); for (const [dx, dz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) caja(0.1, 0.9, 0.1, matK('#4a2e16'), dx, 0.45, -4.6 + dz, est);
  cil(0.16, 0.12, 0.2, 8, matK('#8a8a80'), -0.5, 1.1, -4.6, est); caja(0.4, 0.06, 0.2, matK('#e8e0cc'), 0.3, 1.03, -4.5, est); caja(0.3, 0.1, 0.25, matK('#e8e0cc'), 0.6, 1.05, -4.7, est);
  // las 8 camas: dos filas de 4
  const camas = [];
  for (let k = 0; k < 8; k++) {
    const fila = k < 4 ? -1 : 1, x = fila * 3.4, z = -2.6 + (k % 4) * 2;
    caja(2.1, 0.45, 1, mat({ map: TX.madera('#7a5430', 2, 1) }), x, 0.32, z, est);
    caja(1.95, 0.16, 0.9, matK('#d8ccb0'), x, 0.62, z, est);
    caja(0.38, 0.12, 0.6, matK('#ece4d4'), x - fila * 0.75, 0.75, z, est);   // almohada
    caja(0.12, 0.9, 1, matK('#5a3a1e'), x - fila * 1.05, 0.6, z, est);         // cabecera
    camas.push({ x, z, fila });
  }
  fundirEstatico(est, scene);
  const fl = [antorcha(scene, -6.6, 3.6, -1, 1.1), antorcha(scene, 6.6, 3.6, 3, 1.1)];
  // la curandera camina entre las camas
  const cu = hombrecito(scene, 0, 0, { piel: '#c89a72', ropa: '#6a7a8a', pelo: '#8a8a88' }, 1.65, 0);
  caja(0.6, 0.75, 0.36, matK('#5a6a7a'), 0, 0.42, 0, cu.g); caja(0.4, 0.3, 0.05, matK('#e8e0cc'), 0, 1.0, 0.15, cu.g);
  const ocup = new Map();   // índice de cama → { fig, manta, id }
  const mantaM = matK('#7a3a2a');
  const camera = new T.PerspectiveCamera(50, 16 / 9, 0.1, 60); camera.setViewOffset(1, 1, -0.2, 0, 1, 1);
  const S = {
    scene, camera, camas,
    // lista: [{ cama, g }] → acuesta a cada uno en su cama (de costado, tapado con la manta)
    setCamas(lista) {
      const ids = new Set(lista.map((c) => c.g.id + '@' + c.cama));
      for (const [k, o] of ocup) if (!ids.has(o.key)) { scene.remove(o.fig); scene.remove(o.manta); ocup.delete(k); }
      for (const { cama, g } of lista) {
        const key = g.id + '@' + cama; if (ocup.has(cama) && ocup.get(cama).key === key) continue;
        if (ocup.has(cama)) { const o = ocup.get(cama); scene.remove(o.fig); scene.remove(o.manta); }
        const c = camas[cama], fig = gladSprite(g, Math.min(1.9, g.altura || 1.8));
        if (fig.voxel) { fig.rotation.set(-Math.PI / 2, c.fila < 0 ? -Math.PI / 2 : Math.PI / 2, 0, 'YXZ'); fig.position.set(c.x + c.fila * 0.95, 0.86, c.z); }   // boca arriba, la cabeza en la almohada
        else fig.position.set(c.x, 0.7, c.z);
        scene.add(fig);
        const manta = caja(1.3, 0.14, 0.95, mantaM, c.x + c.fila * 0.25, 0.86, c.z, scene);
        ocup.set(cama, { fig, manta, key });
      }
    },
    update(t, dt) {
      fl.forEach((f) => f(t));
      for (const o of ocup.values()) if (o.fig.animar) o.fig.animar(dt, 'quieto');
      const ruta = (t * 0.18) % 1, a = ruta * Math.PI * 2; cu.g.position.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 3.2 + 0.4); cu.g.rotation.y = a + Math.PI / 2 * (Math.cos(a) > 0 ? 1 : 1);
      cu.g.rotation.y = Math.atan2(Math.cos(a) * 0.9, -Math.sin(a) * 3.2);
      const p = Math.sin(t * 6); cu.piernaD.rotation.x = p * 0.45; cu.piernaI.rotation.x = -p * 0.45; cu.brazoD.rotation.x = -p * 0.3;
      camera.position.set(Math.sin(t * 0.1) * 0.6, 5.2, 8.6); camera.lookAt(0, 0.6, -0.6);
    },
  };
  return S;
};

/* ---------- CALLEJÓN (evento) ---------- */
ESC.callejon = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#1a1420'); scene.fog = new T.Fog('#241c2c', 8, 26);
  luces(scene, '#9a8aba', '#2a2018', 0.6, 0.25);
  const fondo = new T.PointLight('#b8a0e0', 1.2, 14); fondo.position.set(0, 3, -18); scene.add(fondo);
  caja(4, 0.2, 30, mat({ map: TX.adoquin('#3a322c', 2, 15) }), 0, -0.1, -8, scene);
  caja(0.5, 9, 30, mat({ map: TX.ladrillo('#4a3a32', 15, 4) }), -2.2, 4.5, -8, scene);
  caja(0.5, 9, 30, mat({ map: TX.ladrillo('#4a3a32', 15, 4) }), 2.2, 4.5, -8, scene);
  plano(4, 6, matC('#3a2c40', { emissive: '#3a2c48' }), 0, 3, -22, 0, scene);
  caja(1, 0.8, 1, mat({ map: TX.madera('#5a3d22') }), -1.3, 0.4, -2.5, scene); caja(0.7, 0.6, 0.7, mat({ map: TX.madera('#5a3d22') }), -1.4, 1.1, -2.6, scene);
  cil(0.4, 0.45, 1.1, 8, mat({ map: TX.madera('#4a3018', 2, 1) }), 1.4, 0.55, -3.5, scene);
  // figura encapuchada
  const capa = matC('#1a1418');
  const fig = new T.Group(); fig.position.set(0.3, 0, -7.5); scene.add(fig);
  cil(0.28, 0.5, 1.7, 7, capa, 0, 0.85, 0, fig); cil(0.01, 0.3, 0.55, 7, capa, 0, 1.95, 0, fig);
  const ojos = caja(0.18, 0.04, 0.02, matC('#d0a050', { emissive: '#d0a050' }), 0, 1.82, 0.27, fig);
  const fl = [antorcha(scene, -1.9, 2.4, -5, 1.6)];
  const camera = new T.PerspectiveCamera(55, 16 / 9, 0.1, 60); camera.position.set(0, 1.7, 3.5);
  return { scene, camera, update(t) { fl.forEach((f) => f(t)); ojos.visible = Math.sin(t * 1.3) > -0.95; camera.position.x = Math.sin(t * 0.3) * 0.12; camera.lookAt(0, 1.5, -10); } };
};

/* ---------- ESTABLO (preparación) ---------- */
ESC.establo = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#1a120a'); scene.fog = new T.Fog('#1a120a', 14, 34);
  luces(scene, '#ffe2b0', '#3a2a14', 0.55, 0.4);
  caja(30, 0.2, 30, mat({ map: TX.tierra(10, 10) }), 0, -0.1, -6, scene);
  caja(30, 7, 0.4, mat({ map: TX.madera('#6b4a2c', 10, 2) }), 0, 3.5, -10, scene);
  caja(30, 0.4, 0.5, matC('#4a3018'), 0, 4.6, -9.6, scene);
  for (let x = -12; x <= 12; x += 4) caja(0.35, 7, 0.35, matC('#4a3018'), x, 3.5, -9.6, scene);
  for (const [x, z] of [[-9, -7], [9, -7.5], [-10, -2], [10, -1]]) { caja(1.6, 0.8, 1, mat({ map: TX.paja(2, 1) }), x, 0.4, z, scene); caja(1.6, 0.8, 1, mat({ map: TX.paja(2, 1) }), x + 0.2, 1.2, z, scene); }
  const haz = plano(3, 9, new T.MeshBasicMaterial({ color: '#ffe8a8', transparent: true, opacity: 0.08, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), 1, 3.6, -6, 0, scene); haz.rotation.z = 0.35;
  const L = new T.PointLight('#ffd890', 0.8, 30); L.position.set(0, 6, 0); scene.add(L);
  // corral libre: los gladiadores caminan despacio por el establo
  const AREA = { x1: -7.5, x2: 7.5, z1: -7.5, z2: 1.5 };
  const anillo = new T.Mesh(new T.RingGeometry(0.55, 0.75, 20), new T.MeshBasicMaterial({ color: '#e0b44c', transparent: true, opacity: 0.9, side: T.DoubleSide }));
  anillo.rotation.x = -Math.PI / 2; anillo.visible = false; scene.add(anillo);
  const camera = new T.PerspectiveCamera(46, 16 / 9, 0.1, 70); camera.position.set(0, 6.2, 9.5); camera.lookAt(0, 0.6, -3.2);
  const vivos = new Map();   // id -> item (conserva la posición entre redibujos)
  // el ancho del corral se adapta a lo que ve la cámara (en celular el establo es más angosto)
  const anchoVisible = () => Math.min(7.5, Math.max(2.6, camera.aspect * 3.3));
  const azar = () => { const hw = anchoVisible(); return { x: -hw + rnd() * 2 * hw, z: AREA.z1 + rnd() * (AREA.z2 - AREA.z1) }; };
  const S = {
    scene, camera, items: [], selId: null,
    setGladiadores(lista) {   // [{id, canvas, altura, raza}]
      const ids = new Set(lista.map((g) => g.id));
      for (const [id, it] of vivos) if (!ids.has(id)) { scene.remove(it.s); vivos.delete(id); }
      S.items = lista.map((g) => {
        let it = vivos.get(g.id);
        if (it && it.key !== (g.key || g.canvas)) { scene.remove(it.s); it = null; }
        if (!it) {
          const prev = vivos.get(g.id), p = prev ? { x: prev.x, z: prev.z } : azar();
          const s = gladSprite(g, g.altura * 0.75); scene.add(s);
          it = { id: g.id, key: g.key || g.canvas, s, x: p.x, z: p.z, alto: g.altura * 0.75, dest: azar(), pausa: rnd() * 3, vel: 0.35 + rnd() * 0.3, fase: rnd() * 6, ancho: s.scale.x };
          vivos.set(g.id, it);
        }
        it.slot = g.slot || null;   // {lat, fwd}: lugar en la formación (solo los convocados)
        return it;
      });
      S.ubicarSlots();
    },
    // la formación elegida, vista desde el frente del establo (adelante = hacia la cámara)
    ubicarSlots() {
      const con = S.items.filter((it) => it.slot); if (!con.length) return;
      const hw = anchoVisible();
      const mLat = Math.max(0.5, ...con.map((it) => Math.abs(it.slot.lat))), mFwd = Math.max(0.5, ...con.map((it) => Math.abs(it.slot.fwd)));
      const kl = Math.min(1.15, (hw - 0.4) / mLat), kf = Math.min(1.1, 6.2 / mFwd);
      const fwds = con.map((it) => it.slot.fwd), f0 = (Math.max(...fwds) + Math.min(...fwds)) / 2;
      for (const it of con) it.dest = { x: it.slot.lat * kl, z: -2.6 + (it.slot.fwd - f0) * kf, fijo: true };
    },
    update(t, dt) {
      haz.material.opacity = 0.07 + 0.02 * Math.sin(t);
      for (const it of S.items) {
        const quieto = it.id === S.selId;
        if (!quieto) {
          if (it.pausa > 0) it.pausa -= dt;
          else {
            const dx = it.dest.x - it.x, dz = it.dest.z - it.z, d = Math.hypot(dx, dz);
            it.llego = !!it.slot && d < 0.15;
            if (d < 0.15) { if (it.slot) { it.s.scale.x = it.ancho; } else { it.dest = azar(); it.pausa = 1.5 + rnd() * 4; } }
            else { const v = Math.min(d, it.vel * (it.slot ? 2.2 : 1) * dt); it.x += dx / d * v; it.z += dz / d * v; if (Math.abs(dx) > 0.05) it.s.scale.x = dx < 0 ? -it.ancho : it.ancho; it.fase += dt * 7; }
          }
        }
        // que no se encimen
        for (const o of S.items) { if (o === it || it.slot) continue; /* los de la formación no se empujan */ const ox = it.x - o.x, oz = it.z - o.z, od = Math.hypot(ox, oz); if (od < 0.9 && od > 1e-3) { it.x += ox / od * (0.9 - od) * 0.5; it.z += oz / od * (0.9 - od) * 0.5; } }
        const hw = anchoVisible(); if (!it.slot && Math.abs(it.dest.x) > hw) it.dest.x = Math.sign(it.dest.x) * hw * 0.9;
        it.x = Math.max(-hw, Math.min(hw, it.x)); it.z = Math.max(AREA.z1, Math.min(AREA.z2, it.z));
        const camina = !quieto && it.pausa <= 0 && !it.llego;
        if (it.s.animar) { it.s.animar(dt * (camina ? 0.6 + it.vel : 1), camina ? 'caminar' : 'quieto'); it.s.position.set(it.x, 0, it.z); }
        else it.s.position.set(it.x, camina ? Math.abs(Math.sin(it.fase)) * 0.05 : 0, it.z);
        if (it.id === S.selId) { anillo.visible = true; anillo.position.set(it.x, 0.03, it.z); }
      }
      if (!S.items.some((it) => it.id === S.selId)) anillo.visible = false;
    },
  };
  return S;
};

/* ---------- ENFERMERÍA (recuperación) ---------- */
ESC.enfermeria = () => {
  const scene = new T.Scene(); scene.background = new T.Color('#1a140e');
  luces(scene, '#fff4e0', '#4a3a2a', 0.6, 0.5);
  caja(20, 0.2, 14, mat({ map: TX.madera('#8a7656', 8, 6) }), 0, -0.1, 0, scene);
  caja(20, 7, 0.4, mat({ map: TX.revoque('#c8b48e', 6, 2) }), 0, 3.5, -5, scene);
  plano(2.4, 1.8, matC('#9cc8e8', { emissive: '#4a7898' }), 0, 4, -4.78, 0, scene);
  caja(0.1, 1.8, 0.1, matC('#7b5530'), 0, 4, -4.74, scene); caja(2.4, 0.1, 0.1, matC('#7b5530'), 0, 4, -4.74, scene);
  const sol = new T.SpotLight('#fff0c8', 1.1, 16, 0.5, 0.7, 1); sol.position.set(0, 4.5, -4.5); sol.target.position.set(0.5, 0, 0); scene.add(sol, sol.target);
  for (const x of [-5, 0, 5]) { caja(2.6, 0.4, 1.3, mat({ map: TX.madera('#7b5530') }), x, 0.6, -2.6, scene); caja(2.5, 0.25, 1.2, matC('#e8e0cf'), x, 0.9, -2.6, scene); caja(0.6, 0.2, 0.8, matC('#f6f0e2'), x - 0.85, 1.1, -2.6, scene); for (const [lx, lz] of [[-1.2, -0.55], [1.2, -0.55], [-1.2, 0.55], [1.2, 0.55]]) caja(0.12, 0.45, 0.12, matC('#5a3d22'), x + lx, 0.22, -2.6 + lz, scene); }
  caja(10, 0.12, 0.6, matC('#5a3d22'), 0, 2.4, -4.6, scene);
  for (let i = 0; i < 12; i++) cil(0.15, 0.2, 0.4 + (i % 3) * 0.1, 7, matC(['#8e5a3a', '#6a7a4a', '#b08a5a'][i % 3]), -4.6 + i * 0.84, 2.7, -4.6, scene);
  const camera = new T.PerspectiveCamera(45, 16 / 9, 0.1, 50); camera.position.set(0, 2.6, 7); camera.lookAt(0, 1.6, -2);
  return { scene, camera, update() {} };
};

/* ---------- ESCENARIO post pelea: suben los que ganaron la plata del pueblo ---------- */
ESC.escenario = (opts) => {
  const scene = new T.Scene(); scene.background = new T.Color('#1d150e');
  luces(scene, '#fff0d0', '#4a3a28', 0.65, 0.6);
  caja(40, 0.2, 20, mat({ map: TX.arena(12, 6) }), 0, -0.1, 0, scene);
  caja(40, 1.8, 0.6, mat({ map: TX.ladrillo('#9c8566', 14, 1) }), 0, 0.9, -6, scene);
  for (let i = 0; i < 4; i++) caja(40, 1.4, 1.6, mat({ map: TX.publico(10, 1) }), 0, 1.9 + i * 1.3, -7 - i * 1.5, scene);
  caja(8, 1.2, 0.3, mat({ map: TX.tela('#8e1b1b', 6, 1) }), 0, 7.2, -11, scene);
  caja(11, 0.6, 2.4, mat({ map: TX.madera('#7b5530', 6, 1) }), 0, 0.3, 0, scene);
  caja(11.2, 0.12, 2.5, matC('#4a3018'), 0, 0.62, 0, scene);
  const sprites = opts.colores.map((c, i, a) => { const s = spriteEmp(c, 1.35); s.position.set((i - (a.length - 1) / 2) * 2.6, 0.68, 0); scene.add(s); return s; });
  // lluvia de monedas
  const lluvia = [];
  for (let i = 0; i < 60; i++) { const m = new T.Mesh(new T.BoxGeometry(0.1, 0.02, 0.1), mat({ map: i % 3 ? TX.oro() : TX.plata(), emissive: '#2a2000' })); m.position.set((rnd() - 0.5) * 14, rnd() * 8, (rnd() - 0.5) * 4); scene.add(m); lluvia.push({ m, v: 0.8 + rnd() * 1.2, r: rnd() * 6 }); }
  const camera = new T.PerspectiveCamera(42, 16 / 9, 0.1, 60); camera.position.set(0, 2.6, 9); camera.lookAt(0, 1.7, 0);
  return { scene, camera, sprites, update(t, dt) {
    sprites.forEach((s, i) => { s.position.y = 0.68 + Math.abs(Math.sin(t * 3 + i)) * 0.12; });
    lluvia.forEach((o) => { o.m.position.y -= o.v * dt; o.m.rotation.x += o.r * dt; o.m.rotation.z += o.r * 0.7 * dt; if (o.m.position.y < 0) o.m.position.y = 8; });
  } };
};

/* =====================================================================
   MONTAR una escena en un contenedor
   ===================================================================== */
let renderer = null;
/* ---------- MAPA DEL REINO: una maqueta de cubitos sobre la mesa de guerra del rey ---------- */
/* ---------- LOS 10 MAPAS: una maqueta viva por cada coliseo de historia ---------- */
// cada mapa queda en una ciudad del reino, con su paisaje, su vegetación y sus animales
const REGIONES = [
  { nombre: 'Capua', donde: 'Las colinas verdes del oeste del reino', bioma: 'campo', agua: ['rio', 'lago'], cielo: '#bfe0f0',
    suelo: ['#5a7e34', '#6a8c3c', '#7a9a46'], orilla: '#c9b47a', lado: '#5a3e24', relieve: 0.5,
    plantas: { arbol: 34, olivo: 26, arbusto: 40, pasto: 260, flor: 140, roca: 22, casa: 7 }, animales: ['ciervo', 'conejo', 'pajaro', 'oveja'], aire: 'mariposas' },
  { nombre: 'Ostia', donde: 'La costa, donde el río se encuentra con el mar', bioma: 'costa', agua: ['mar', 'rio'], cielo: '#c4e6f4',
    suelo: ['#8a9050', '#9c9a5e', '#b0a672'], orilla: '#e6d39a', lado: '#6a4e30', relieve: 0.35,
    plantas: { pinoMar: 34, arbusto: 34, pasto: 180, flor: 50, roca: 30, casa: 8, bote: 4 }, animales: ['gaviota', 'cangrejo', 'cabra'], aire: null },
  { nombre: 'Fangal', donde: 'Los pantanos del sur', bioma: 'pantano', agua: ['charcas', 'charcas'], cielo: '#9fb0a0',
    suelo: ['#4f5e32', '#5c6a36', '#6c6f40'], orilla: '#5a5030', lado: '#3e3220', relieve: 0.25, aguaCol: '#3e5a44',
    plantas: { sauce: 30, muerto: 14, junco: 160, arbusto: 30, pasto: 160, hongo: 30, roca: 14 }, animales: ['rana', 'garza', 'pato'], aire: 'luciernagas' },
  { nombre: 'Bosquenegro', donde: 'El bosque cerrado del centro del reino', bioma: 'bosque', agua: ['rio'], cielo: '#8fb0a8',
    suelo: ['#3e5a2a', '#4a6a30', '#56763a'], orilla: '#7a6a44', lado: '#3a2a1a', relieve: 0.55,
    plantas: { pino: 120, arbol: 40, arbusto: 50, hongo: 50, pasto: 160, roca: 30 }, animales: ['ciervo', 'lobo', 'cuervo', 'jabali'], aire: 'luciernagas' },
  { nombre: 'Krag-Tor', donde: 'Las tierras de los orcos, al sudeste', bioma: 'estepa', agua: ['lago'], cielo: '#c8c0a0', montes: 1.6,
    suelo: ['#6c6c3e', '#7a7448', '#887c52'], orilla: '#8a7a54', lado: '#4a3a28', relieve: 0.9,
    plantas: { roca: 80, muerto: 18, arbusto: 50, pasto: 200, pino: 20, totem: 6 }, animales: ['jabali', 'cabra', 'cuervo'], aire: null },
  { nombre: 'Roca Roja', donde: 'Los cañones rojos del este', bioma: 'canon', agua: [], cielo: '#f0c89a',
    suelo: ['#b8623a', '#c8784a', '#d48c5a'], orilla: '#c8784a', lado: '#7a3a20', relieve: 0.45,
    plantas: { meseta: 12, cactus: 40, roca: 60, arbusto: 26, pasto: 80 }, animales: ['buitre', 'lagartija', 'coyote'], aire: 'polvo' },
  { nombre: 'Tumbaseca', donde: 'El desierto de las tumbas', bioma: 'desierto', agua: ['oasis'], cielo: '#f2dcae',
    suelo: ['#c4a468', '#ceae74', '#d8ba82'], orilla: '#c8a868', lado: '#8a6a3a', relieve: 0.5,
    plantas: { lapida: 40, hueso: 40, muerto: 16, cactus: 14, roca: 40, palmera: 8 }, animales: ['escorpion', 'buitre', 'serpiente'], aire: 'polvo' },
  { nombre: 'Hielofirme', donde: 'Las montañas heladas del norte', bioma: 'nieve', agua: ['hielo'], cielo: '#d8e6f0', montes: 2.2,
    suelo: ['#dfe8ee', '#eef3f6', '#ffffff'], orilla: '#b8ccdc', lado: '#5a6470', relieve: 0.8, aguaCol: '#a8cce0',
    plantas: { pinoNieve: 90, roca: 50, arbusto: 20 }, animales: ['loboBlanco', 'reno', 'pajaro'], aire: 'nieve' },
  { nombre: 'Pompeya', donde: 'A la sombra del volcán', bioma: 'volcan', agua: ['lava'], cielo: '#c08a6a', montes: 1.2, volcan: true,
    suelo: ['#4a3e36', '#5a4a3e', '#6a5444'], orilla: '#2a1e18', lado: '#2a1e18', relieve: 0.6, aguaCol: '#ff6a1a',
    plantas: { muerto: 30, roca: 80, arbusto: 20, pasto: 60, casa: 6 }, animales: ['cuervo', 'cabra'], aire: 'ceniza' },
  { nombre: 'Roma', donde: 'La capital del reino', bioma: 'roma', agua: ['rio'], cielo: '#c8e2f0',
    suelo: ['#648238', '#728e42', '#82984e'], orilla: '#c8b47a', lado: '#5a3e24', relieve: 0.4,
    plantas: { cipres: 40, pinoMar: 20, olivo: 20, arbusto: 30, pasto: 160, flor: 60, casa: 18, acueducto: 1 }, animales: ['oveja', 'paloma', 'caballo'], aire: null },
];
const MAPA_W = 30, MAPA_D = 18;   // tamaño de cada maqueta (más chica que el reino entero de antes)
// dónde va cada cosa en un mapa: Prota adelante, el coliseo de historia al fondo y 9 lugares alrededor
function regionLayout(k) {
  let s = (k + 1) * 7919; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const j = (v, a) => v + (r() - 0.5) * a;
  const base = [j(0, 2), 6.3];
  const cdh = [j(0, 6), -5.4];
  const slots = [[-10.5, -4.6], [-5.6, -1.8], [5.6, -1.8], [10.5, -4.6], [-11, 1.6], [-5.4, 3.4], [5.4, 3.4], [11, 1.6], [0, 0.6]]
    .map(([x, z]) => [j(x, 1.4), j(z, 0.9)]);
  return { base, cdh, slots };
}
ESC.mapa = (opts) => {
  const RG = REGIONES[Math.max(0, Math.min(9, opts.region | 0))], LY = regionLayout(opts.region | 0);
  let sr = (((opts.seed | 0) ^ ((opts.region | 0) * 104729)) % 2147483646 + 2147483646) % 2147483646 + 1;
  const rnd = () => { sr = (sr * 16807) % 2147483647; return (sr - 1) / 2147483646; };
  const scene = new T.Scene(); const bruma = new T.Color(RG.cielo).lerp(new T.Color(RG.suelo[1]), 0.35); scene.background = bruma; scene.fog = new T.Fog(bruma, 26, 52);
  scene.add(new T.HemisphereLight(RG.cielo, '#4a3a2c', RG.bioma === 'volcan' ? 0.5 : 0.6));
  const sol = new T.DirectionalLight(RG.bioma === 'volcan' ? '#ffb080' : '#fff0d0', 0.62); sol.position.set(-8, 14, 6); scene.add(sol);
  const camera = new T.PerspectiveCamera(38, 16 / 9, 0.1, 140);
  const W2 = MAPA_W / 2, D2 = MAPA_D / 2;
  const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  /* ---------- el terreno: lomas, agua y montañas del fondo ---------- */
  const fase = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  const libres = [[LY.base, 1.8], [LY.cdh, 2.8], ...LY.slots.map((p) => [p, 2.2])];   // lugares donde va algo: ahí el piso es plano
  const segs = [...LY.slots, LY.cdh].map((p) => [LY.base, p]);                       // los caminos desde Prota
  const distSeg = (x, z, [[ax, az], [bx, bz]]) => { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - ax - vx * t, z - az - vz * t); };
  const cerca = (x, z, extra = 0) => libres.some(([[px, pz], r]) => Math.hypot(x - px, z - pz) < r + extra) || segs.some((sg) => distSeg(x, z, sg) < 0.75 + extra * 0.5);
  // agua del mapa (lago, río, mar, charcas, lava, hielo)
  const aguas = [];
  for (const a of RG.agua) {
    if (a === 'rio') aguas.push({ t: 'rio', z0: -D2 + 1.0, amp: 0.9, f: 0.28 + rnd() * 0.1, ph: rnd() * 6, w: 1.0 });
    if (a === 'lago' || a === 'oasis' || a === 'hielo') { const lado = rnd() < 0.5 ? -1 : 1; aguas.push({ t: 'lago', x: lado * (W2 - 2.6), z: D2 - 2.4, r: a === 'oasis' ? 1.5 : 2.3 }); }
    if (a === 'mar') aguas.push({ t: 'mar', x0: -W2 + 2.2 });
    if (a === 'charcas') for (let i = 0, n = 0; i < 60 && n < 5; i++) { const x = (rnd() - 0.5) * (MAPA_W - 4), z = (rnd() - 0.5) * (MAPA_D - 3), r = 0.9 + rnd() * 1.1; if (!cerca(x, z, r + 0.4)) { aguas.push({ t: 'lago', x, z, r }); n++; } }
    if (a === 'lava') { aguas.push({ t: 'rio', z0: -D2 + 0.9, amp: 0.6, f: 0.35, ph: rnd() * 6, w: 0.8 }); for (let i = 0, n = 0; i < 40 && n < 2; i++) { const x = (rnd() - 0.5) * (MAPA_W - 4), z = (rnd() - 0.5) * (MAPA_D - 4), r = 0.8 + rnd() * 0.6; if (!cerca(x, z, r + 0.5)) { aguas.push({ t: 'lago', x, z, r }); n++; } } }
  }
  // cuánto "adentro del agua" está un punto (1 = agua honda, 0 = tierra)
  const mojado = (x, z) => {
    let m = 0;
    for (const a of aguas) {
      if (a.t === 'lago') m = Math.max(m, sm((a.r - Math.hypot(x - a.x, z - a.z)) / 0.8 + 0.5));
      else if (a.t === 'rio') { const zc = a.z0 + Math.sin(x * a.f + a.ph) * a.amp; m = Math.max(m, sm((a.w - Math.abs(z - zc)) / 0.5 + 0.5)); }
      else if (a.t === 'mar') { const xc = a.x0 + Math.sin(z * 0.6) * 0.5; m = Math.max(m, sm((xc - x) / 0.9 + 0.5)); }
    }
    return m;
  };
  const NIVEL_AGUA = -0.1;
  const alturaEn = (x, z) => {
    let h = (Math.sin(x * 0.42 + fase[0]) * Math.cos(z * 0.5 + fase[1]) + Math.sin(x * 0.9 + z * 0.7 + fase[2]) * 0.45 + Math.sin(z * 1.3 + fase[3]) * 0.2) * RG.relieve * 0.55 + RG.relieve * 0.35;
    // los lugares quedan en un llano
    let llano = 1; for (const [[px, pz], r] of libres) llano = Math.min(llano, sm((Math.hypot(x - px, z - pz) - r * 0.7) / (r * 0.8)));
    h = Math.max(0.02, h) * llano + 0.08 * (1 - llano);   // sin charcos sueltos: el agua es solo la que se diseñó
    // montañas al fondo
    if (RG.montes) { const f = sm((-z - (D2 - 3.2)) / 2.4) + sm((Math.abs(x) - (W2 - 2.6)) / 2.2) * 0.6 * sm((-z + 2) / 6); h += f * RG.montes * (1.2 + Math.sin(x * 1.7 + fase[0]) * 0.35 + Math.sin(x * 3.1) * 0.15); }
    // el volcán, en una esquina del fondo
    if (RG.volcan) { const d = Math.hypot(x - 10.5, z + 6.2); h += Math.max(0, 4.2 - d * 1.15) * (d < 1.1 ? 0.55 : 1); }
    // agua: se hunde el piso
    const m = mojado(x, z); if (m > 0) h = h * (1 - m) + (NIVEL_AGUA - 0.35) * m;
    return h;
  };

  // malla del terreno con colores por vértice (low poly)
  const OW = MAPA_W + 34, OD = MAPA_D + 26, NX = 128, NZ = 84;   // el terreno sigue más allá de lo que se juega
  const tg = new T.PlaneGeometry(OW, OD, NX, NZ); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3), c0 = new T.Color(), c1 = new T.Color();
  const pal = RG.suelo.map((x) => new T.Color(x)), orilla = new T.Color(RG.orilla), nieve = new T.Color('#f4f8fa'), roca = new T.Color(RG.bioma === 'canon' ? '#9a4a2a' : RG.bioma === 'volcan' ? '#2e2420' : '#7a746a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = alturaEn(x, z); pos.setY(i, y);
    const n = (Math.sin(x * 2.3 + z * 1.7) + Math.sin(x * 5.1 - z * 3.3) * 0.5) * 0.5 + (rnd() - 0.5) * 0.5;
    const k = Math.max(0, Math.min(1.999, 1 + n * 0.8)); c0.copy(pal[Math.floor(k)]).lerp(pal[Math.min(2, Math.floor(k) + 1)], k % 1);
    const m = mojado(x, z); if (m > 0.05) c0.lerp(orilla, Math.min(1, m * 2.2));
    if (y > 1.6) c0.lerp(roca, sm((y - 1.6) / 1.2)); if (y > 2.6 && RG.bioma !== 'volcan') c0.lerp(nieve, sm((y - 2.6) / 0.8));
    // los caminos: tierra pisada
    const dc = Math.min(...segs.map((sg) => distSeg(x, z, sg))); if (dc < 0.45) c0.lerp(c1.set(RG.bioma === 'nieve' ? '#c8d0d6' : RG.bioma === 'volcan' ? '#3a2e28' : '#a8885a'), 0.55 * (1 - dc / 0.45));
    cols[i * 3] = c0.r; cols[i * 3 + 1] = c0.g; cols[i * 3 + 2] = c0.b;
  }
  tg.setAttribute('color', new T.BufferAttribute(cols, 3));
  const tg2 = tg.toNonIndexed(); tg2.computeVertexNormals();
  scene.add(new T.Mesh(tg2, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  const anim = [];   // funciones (t, dt) de cosas que se mueven
  // el agua (o la lava, o el hielo): un plano a la altura del agua que solo se ve donde el piso está hundido
  if (aguas.length) {
    const lava = RG.bioma === 'volcan', hielo = RG.bioma === 'nieve';
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = lava ? '#ff5a10' : hielo ? '#b8d4e6' : (RG.aguaCol || '#3e7ea0'); g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 70; i++) { g.fillStyle = lava ? (i % 3 ? '#ffb030' : '#a02a08') : hielo ? '#e8f4fa' : 'rgba(255,255,255,0.35)'; g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 2 + Math.floor(rnd() * (hielo ? 10 : 5)), 1); }
    const tx = new T.CanvasTexture(cv); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(16, 10); tx.magFilter = T.NearestFilter;
    const am = lava ? new T.MeshBasicMaterial({ map: tx }) : new T.MeshLambertMaterial({ map: tx, transparent: !hielo, opacity: 0.86 });
    const ag = plano(OW, OD, am, 0, NIVEL_AGUA, 0, -Math.PI / 2, scene);
    if (!hielo) anim.push((t) => { tx.offset.set(t * (lava ? 0.01 : 0.02), Math.sin(t * 0.5) * 0.01); });
    if (lava) { const luz = new T.PointLight('#ff6a20', 1.2, 14); luz.position.set(0, 1.5, -D2 + 1); scene.add(luz); anim.push((t) => { luz.intensity = 1.1 + Math.sin(t * 3) * 0.2; }); }
  }

  /* ---------- vegetación y cosas del paisaje (todo instanciado: pocas llamadas de dibujo) ---------- */
  const PL = {
    arbol: [['caja', '#5a3a22', 0.18, 0.7, 0.18, 0, 0.35, 0], ['caja', 'verde', 0.95, 0.75, 0.95, 0, 1.0, 0], ['caja', 'verde2', 0.62, 0.45, 0.62, 0.05, 1.55, -0.05]],
    olivo: [['caja', '#6a5a48', 0.16, 0.55, 0.16, 0, 0.27, 0], ['caja', '#8a9a6a', 0.85, 0.45, 0.8, 0, 0.75, 0], ['caja', '#9aaa78', 0.5, 0.3, 0.55, 0.1, 1.05, 0]],
    pino: [['caja', '#4a3020', 0.14, 0.5, 0.14, 0, 0.25, 0], ['cono', '#2e5a2e', 0.62, 0.8, 0, 0, 0.8, 0], ['cono', '#356a34', 0.46, 0.7, 0, 0, 1.25, 0], ['cono', '#3e7a3a', 0.28, 0.55, 0, 0, 1.65, 0]],
    pinoNieve: [['caja', '#4a3020', 0.14, 0.5, 0.14, 0, 0.25, 0], ['cono', '#2e4a3a', 0.62, 0.8, 0, 0, 0.8, 0], ['cono', '#f2f6f8', 0.5, 0.45, 0, 0, 1.15, 0], ['cono', '#2e4a3a', 0.4, 0.6, 0, 0, 1.35, 0], ['cono', '#ffffff', 0.24, 0.4, 0, 0, 1.75, 0]],
    pinoMar: [['caja', '#6a4a30', 0.14, 1.3, 0.14, 0, 0.65, 0], ['caja', '#3e6a36', 1.3, 0.32, 1.2, 0, 1.4, 0], ['caja', '#4a7a3e', 0.8, 0.22, 0.8, 0.1, 1.6, 0]],
    cipres: [['caja', '#4a3020', 0.12, 0.3, 0.12, 0, 0.15, 0], ['caja', '#2e4a2a', 0.38, 1.6, 0.38, 0, 1.05, 0], ['caja', '#36562e', 0.24, 0.4, 0.24, 0, 1.95, 0]],
    sauce: [['caja', '#4a3a2a', 0.2, 0.8, 0.2, 0, 0.4, 0], ['caja', '#6a7a3a', 1.1, 0.5, 1.1, 0, 1.0, 0], ['caja', '#5a6a32', 0.12, 0.6, 1.1, 0.5, 0.55, 0], ['caja', '#5a6a32', 0.12, 0.6, 1.1, -0.5, 0.55, 0], ['caja', '#5a6a32', 1.1, 0.6, 0.12, 0, 0.55, 0.5]],
    muerto: [['caja', '#3e3430', 0.14, 1.0, 0.14, 0, 0.5, 0], ['caja', '#3e3430', 0.5, 0.08, 0.08, 0.2, 0.85, 0], ['caja', '#3e3430', 0.08, 0.08, 0.4, 0, 0.7, -0.15], ['caja', '#3e3430', 0.08, 0.35, 0.08, 0.42, 1.0, 0]],
    palmera: [['caja', '#8a6a40', 0.14, 1.4, 0.14, 0, 0.7, 0], ['caja', '#4a8a3a', 1.2, 0.08, 0.28, 0, 1.42, 0], ['caja', '#4a8a3a', 0.28, 0.08, 1.2, 0, 1.44, 0]],
    cactus: [['caja', '#4a7a3a', 0.24, 1.0, 0.24, 0, 0.5, 0], ['caja', '#4a7a3a', 0.4, 0.14, 0.14, 0.2, 0.45, 0], ['caja', '#4a7a3a', 0.14, 0.32, 0.14, 0.36, 0.65, 0], ['caja', '#4a7a3a', 0.14, 0.24, 0.14, -0.18, 0.7, 0]],
    arbusto: [['caja', 'verde', 0.55, 0.35, 0.5, 0, 0.17, 0], ['caja', 'verde2', 0.32, 0.22, 0.3, 0.12, 0.38, 0]],
    junco: [['caja', '#6a7a3a', 0.05, 0.7, 0.05, 0, 0.35, 0], ['caja', '#7a8a44', 0.05, 0.55, 0.05, 0.12, 0.27, 0.05], ['caja', '#5a3a22', 0.07, 0.16, 0.07, 0, 0.72, 0]],
    pasto: [['caja', 'verde2', 0.05, 0.22, 0.05, 0, 0.1, 0], ['caja', 'verde', 0.05, 0.16, 0.05, 0.08, 0.08, 0.04], ['caja', 'verde2', 0.05, 0.18, 0.05, -0.06, 0.09, -0.05]],
    flor: [['caja', '#4a7a3a', 0.03, 0.18, 0.03, 0, 0.09, 0], ['caja', 'flor', 0.1, 0.08, 0.1, 0, 0.2, 0]],
    hongo: [['caja', '#efe6d0', 0.07, 0.16, 0.07, 0, 0.08, 0], ['caja', '#c0302a', 0.22, 0.08, 0.22, 0, 0.18, 0]],
    roca: [['roca', 'roca', 0.4, 0.3, 0.4, 0, 0.1, 0]],
    meseta: [['caja', '#a8502e', 1.4, 1.0, 1.15, 0, 0.5, 0], ['caja', '#b8603a', 1.15, 0.45, 0.95, 0.06, 1.22, 0], ['caja', '#c87048', 0.75, 0.25, 0.65, -0.06, 1.56, 0]],
    lapida: [['caja', '#8a847a', 0.3, 0.42, 0.1, 0, 0.21, 0], ['caja', '#6a645a', 0.12, 0.08, 0.12, 0, 0.46, 0]],
    hueso: [['caja', '#ece4d0', 0.5, 0.06, 0.06, 0, 0.04, 0], ['caja', '#ece4d0', 0.06, 0.05, 0.3, -0.1, 0.04, 0], ['caja', '#ece4d0', 0.06, 0.05, 0.3, 0.1, 0.04, 0], ['caja', '#ece4d0', 0.16, 0.14, 0.16, 0.3, 0.07, 0]],
    totem: [['caja', '#5a4030', 0.2, 1.6, 0.2, 0, 0.8, 0], ['caja', '#e8dcc0', 0.3, 0.26, 0.3, 0, 1.7, 0], ['caja', '#8a2a1a', 0.5, 0.1, 0.1, 0, 1.3, 0]],
    casa: [['caja', '#e8dcc0', 0.8, 0.55, 0.65, 0, 0.27, 0], ['cono', '#b0503a', 0.66, 0.42, 0, 0, 0.76, 0], ['caja', '#4a3020', 0.16, 0.26, 0.04, 0.12, 0.13, 0.33]],
    bote: [['caja', '#7a5030', 0.9, 0.16, 0.36, 0, 0.0, 0], ['caja', '#e8e0d0', 0.04, 0.6, 0.04, 0, 0.35, 0], ['caja', '#efe8dc', 0.02, 0.4, 0.34, 0.03, 0.4, 0]],
  };
  const COLV = { verde: ['#4a7a2e', '#5a8a36', '#3e6a28'], verde2: ['#6a9a3e', '#7aaa48', '#5a8a36'], flor: ['#e84a4a', '#f0d040', '#f0f0f0', '#a86ae0', '#f08ac0'], roca: ['#8a847a', '#7a746a', '#9a948a'] };
  if (RG.bioma === 'bosque') { COLV.verde = ['#2e5a26', '#36662c', '#2a4e22']; COLV.verde2 = ['#3e6e30', '#467a36', '#36662c']; }
  if (RG.bioma === 'pantano') { COLV.verde = ['#4a5a2a', '#56662e', '#3e4e24']; COLV.verde2 = ['#5e6e34', '#6a7a3a', '#4e5e2c']; }
  if (RG.bioma === 'estepa' || RG.bioma === 'desierto' || RG.bioma === 'canon') { COLV.verde = ['#7a7a3a', '#8a8444', '#6a6a34']; COLV.verde2 = ['#9a9450', '#a8a05a', '#8a8444']; }
  if (RG.bioma === 'volcan') { COLV.verde = ['#4a4a2a', '#56522e', '#3e3e24']; COLV.verde2 = ['#5a5a32', '#66623a', '#4e4e2c']; COLV.roca = ['#2a2420', '#36302a', '#1e1a16']; }
  if (RG.bioma === 'canon') COLV.roca = ['#a8583a', '#b8684a', '#984a2e'];
  if (RG.bioma === 'nieve') COLV.roca = ['#8a9098', '#9aa0a8', '#7a8088'];
  if (RG.bioma === 'nieve') { COLV.verde = ['#3e5a4a', '#4a6656', '#2e4a3e']; COLV.verde2 = ['#dfe8ee', '#c8d4dc', '#eef3f6']; }
  const GEO = { caja: new T.BoxGeometry(1, 1, 1), cono: new T.ConeGeometry(1, 1, 4), roca: new T.DodecahedronGeometry(1, 0) };
  const instancias = {};   // tipo → lista de matrices
  const dum = new T.Object3D(), mm = new T.Matrix4();
  const lugarOk = (x, z, tipo) => {
    if (Math.abs(x) > OW / 2 - 0.4 || Math.abs(z) > OD / 2 - 0.4) return false;
    const m = mojado(x, z);
    if (tipo === 'junco') return m > 0.05 && m < 0.55 || (m === 0 && rnd() < 0.15);
    if (tipo === 'bote') return m > 0.75;
    if (m > 0.02) return false;
    if (tipo === 'meseta') return !cerca(x, z, 1.6);
    return !cerca(x, z, tipo === 'casa' || tipo === 'acueducto' ? 0.8 : tipo === 'pasto' || tipo === 'flor' ? -0.6 : 0);
  };
  for (const [tipo, n0] of Object.entries(RG.plantas)) {
    if (tipo === 'acueducto') continue;
    const n = ['meseta', 'casa', 'bote', 'totem', 'palmera'].includes(tipo) ? n0 : ['pasto', 'flor', 'hongo', 'lapida', 'hueso'].includes(tipo) ? Math.round(n0 * 1.6) : Math.round(n0 * 2.4);
    const L = instancias[tipo] = [];
    for (let i = 0, intentos = 0; i < n && intentos < n * 12; intentos++) {
      // 70% en la zona de juego, el resto en los alrededores (sin pasto ni flores afuera)
      const afuera = !['pasto', 'flor', 'casa', 'bote', 'meseta', 'totem', 'lapida', 'hueso'].includes(tipo) && i >= n * 0.7;
      let x = (rnd() - 0.5) * (afuera ? OW : MAPA_W), z = (rnd() - 0.5) * (afuera ? OD : MAPA_D);
      if (afuera && Math.abs(x) < W2 && Math.abs(z) < D2) continue;
      if (tipo === 'meseta') { const lado = rnd(); x = lado < 0.5 ? (rnd() < 0.5 ? -1 : 1) * (W2 - 1.5 - rnd() * 2) : x; z = lado >= 0.5 ? -D2 + 1.5 + rnd() * 2 : z; }
      if (tipo === 'casa' && i > 0 && rnd() < 0.7) { const p = L[Math.floor(rnd() * L.length)]; x = p.x + (rnd() - 0.5) * 3; z = p.z + (rnd() - 0.5) * 2.4; }   // las casas van en grupitos (aldeas)
      if (!lugarOk(x, z, tipo)) continue;
      // tamaño: a escala de los lugares (un coliseo mide ~2.5)
      const s = (tipo === 'pasto' || tipo === 'flor' ? 0.8 + rnd() * 0.6 : tipo === 'meseta' ? 0.8 + rnd() * 0.6 : 0.75 + rnd() * 0.55) * (tipo === 'meseta' ? 1 : tipo === 'pasto' || tipo === 'flor' || tipo === 'hongo' ? 0.8 : 0.55);
      L.push({ x, z, y: tipo === 'bote' ? NIVEL_AGUA + 0.05 : alturaEn(x, z), s, ry: tipo === 'casa' ? Math.round(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.3 : rnd() * Math.PI * 2, c: rnd() });
      i++;
    }
  }
  const mecen = [];   // copas que se mueven con el viento
  for (const [tipo, L] of Object.entries(instancias)) {
    if (!L.length || !PL[tipo]) continue;
    PL[tipo].forEach(([geo, col, sx, sy, sz, ox, oy, oz], pi) => {
      const fijo = COLV[col] ? null : new T.Color(col);
      const im = new T.InstancedMesh(GEO[geo], new T.MeshLambertMaterial({ color: '#ffffff', flatShading: geo === 'roca' }), L.length);
      const cc = new T.Color();
      L.forEach((p, k) => {
        dum.position.set(p.x, p.y, p.z); dum.rotation.set(0, p.ry, 0); dum.scale.setScalar(p.s); dum.updateMatrix();
        mm.makeTranslation(ox, oy, oz).multiply(new T.Matrix4().makeScale(sx, sy, geo === 'cono' ? sx : sz));
        if (geo === 'roca') mm.premultiply(new T.Matrix4().makeRotationY(p.c * 3));
        im.setMatrixAt(k, dum.matrix.clone().multiply(mm));
        if (fijo) cc.copy(fijo).multiplyScalar(0.92 + p.c * 0.16); else cc.set(COLV[col][Math.floor(p.c * COLV[col].length) % COLV[col].length]);
        im.setColorAt(k, cc);
      });
      scene.add(im);
    });
  }
  // el acueducto de Roma: arcos que cruzan el fondo
  if (RG.plantas.acueducto) {
    const g = new T.Group(), piedra = matC('#d8c8a0'), z0 = -D2 + 2.6;
    for (let x = -W2 + 0.6; x < W2 - 0.6; x += 1.2) { if (Math.abs(x - LY.cdh[0]) < 2.6) continue; const y = alturaEn(x, z0); caja(0.3, 1.6 - y + 0.2, 0.4, piedra, x, y + (1.6 - y + 0.2) / 2 - 0.1, z0, g); caja(1.2, 0.25, 0.44, piedra, x + 0.6, 1.7, z0, g); }
    scene.add(g);
  }

  /* ---------- el aire: nieve, ceniza, luciérnagas, polvo, mariposas ---------- */
  if (RG.aire) {
    const N = { nieve: 260, ceniza: 160, luciernagas: 70, polvo: 90, mariposas: 40 }[RG.aire];
    const col = { nieve: '#ffffff', ceniza: '#ff9a40', luciernagas: '#e8ff70', polvo: '#e8d0a0', mariposas: '#f8e060' }[RG.aire];
    const g = new T.BufferGeometry(), P = new Float32Array(N * 3), V = [];
    for (let i = 0; i < N; i++) { P[i * 3] = (rnd() - 0.5) * MAPA_W; P[i * 3 + 1] = rnd() * 6; P[i * 3 + 2] = (rnd() - 0.5) * MAPA_D; V.push(rnd() * 6); }
    g.setAttribute('position', new T.BufferAttribute(P, 3));
    const pm = new T.PointsMaterial({ color: col, size: RG.aire === 'nieve' ? 0.09 : RG.aire === 'mariposas' ? 0.14 : 0.08, transparent: true, opacity: 0.9, depthWrite: false });
    const pts = new T.Points(g, pm); scene.add(pts);
    anim.push((t, dt) => {
      for (let i = 0; i < N; i++) {
        const o = i * 3;
        if (RG.aire === 'nieve') { P[o + 1] -= dt * 0.6; P[o] += Math.sin(t + V[i]) * dt * 0.2; if (P[o + 1] < 0) P[o + 1] = 6; }
        else if (RG.aire === 'ceniza') { P[o + 1] += dt * 0.35; P[o] += Math.sin(t * 0.7 + V[i]) * dt * 0.3; if (P[o + 1] > 6) { P[o + 1] = 0; } }
        else if (RG.aire === 'polvo') { P[o] += dt * 0.8; P[o + 1] = 0.3 + Math.abs(Math.sin(t * 0.4 + V[i])) * 1.2; if (P[o] > W2) P[o] = -W2; }
        else { P[o] += Math.sin(t * 1.3 + V[i]) * dt * 0.5; P[o + 2] += Math.cos(t * 1.1 + V[i] * 2) * dt * 0.5; P[o + 1] = 0.3 + (Math.sin(t * 2 + V[i]) + 1) * 0.5; }
      }
      g.attributes.position.needsUpdate = true;
      if (RG.aire === 'luciernagas') pm.opacity = 0.6 + Math.sin(t * 3) * 0.35;
    });
  }
  // humo del volcán
  if (RG.volcan) {
    const humo = [], hm = new T.MeshLambertMaterial({ color: '#5a4e48', transparent: true, opacity: 0.55 });
    for (let i = 0; i < 9; i++) { const m = new T.Mesh(GEO.caja, hm); m.userData.k = i / 9; scene.add(m); humo.push(m); }
    const cima = alturaEn(10.5, -6.2);
    caja(1.4, 0.2, 1.4, new T.MeshBasicMaterial({ color: '#ff6a1a' }), 10.5, cima - 0.3, -6.2, scene);
    anim.push((t) => humo.forEach((m) => { const k = (m.userData.k + t * 0.06) % 1; m.position.set(10.5 + k * 3 + Math.sin(t + k * 9) * 0.3, cima + k * 5, -6.2 - k * 1.5); m.scale.setScalar(0.5 + k * 1.8); m.rotation.set(k * 3, k * 5, 0); }));
  }

  /* ---------- animales que cada tanto cruzan la maqueta ---------- */
  const AN = {
    ciervo: { modo: 'camina', vel: 1.6, grupo: [1, 3], cuerpo: '#8a5a32', cab: '#7a4e2a', alto: 0.3, largo: 0.5, cuernos: '#d8c8a0' },
    reno: { modo: 'camina', vel: 1.3, grupo: [2, 4], cuerpo: '#8a7a64', cab: '#e8e0d0', alto: 0.32, largo: 0.52, cuernos: '#d8c8a0' },
    conejo: { modo: 'salta', vel: 2.0, grupo: [1, 2], cuerpo: '#a8987a', cab: '#a8987a', alto: 0.1, largo: 0.18, orejas: true },
    lobo: { modo: 'camina', vel: 2.2, grupo: [2, 3], cuerpo: '#5a5650', cab: '#4a4640', alto: 0.22, largo: 0.46, cola: true },
    loboBlanco: { modo: 'camina', vel: 2.0, grupo: [2, 3], cuerpo: '#e8ecf0', cab: '#d8dce0', alto: 0.22, largo: 0.46, cola: true },
    coyote: { modo: 'camina', vel: 2.0, grupo: [1, 2], cuerpo: '#b08a5a', cab: '#9a7a4e', alto: 0.2, largo: 0.4, cola: true },
    jabali: { modo: 'camina', vel: 1.5, grupo: [1, 3], cuerpo: '#3e2e24', cab: '#34261e', alto: 0.17, largo: 0.42, colmillos: true },
    cabra: { modo: 'camina', vel: 1.1, grupo: [1, 3], cuerpo: '#d8d0c0', cab: '#c8c0b0', alto: 0.2, largo: 0.34, cuernos: '#6a5a48' },
    oveja: { modo: 'camina', vel: 0.7, grupo: [3, 6], cuerpo: '#f2eee4', cab: '#2a2420', alto: 0.18, largo: 0.36, lana: true },
    caballo: { modo: 'camina', vel: 2.4, grupo: [1, 2], cuerpo: '#6a4228', cab: '#5a3820', alto: 0.4, largo: 0.62, cola: true },
    rana: { modo: 'salta', vel: 1.2, grupo: [1, 3], cuerpo: '#4a8a3a', cab: '#5a9a44', alto: 0.05, largo: 0.12 },
    garza: { modo: 'camina', vel: 0.6, grupo: [1, 2], cuerpo: '#e8e8e0', cab: '#e8e8e0', alto: 0.35, largo: 0.22, zancuda: true },
    cangrejo: { modo: 'repta', vel: 0.8, grupo: [2, 4], cuerpo: '#d0402a', cab: '#d0402a', alto: 0.04, largo: 0.16 },
    lagartija: { modo: 'repta', vel: 1.6, grupo: [1, 2], cuerpo: '#8a9a4a', cab: '#7a8a40', alto: 0.03, largo: 0.24, cola: true },
    escorpion: { modo: 'repta', vel: 1.0, grupo: [1, 3], cuerpo: '#2a2018', cab: '#2a2018', alto: 0.04, largo: 0.2, cola: true },
    serpiente: { modo: 'repta', vel: 0.9, grupo: [1, 1], cuerpo: '#8a7a3a', cab: '#7a6a32', alto: 0.03, largo: 0.6, serpiente: true },
    pajaro: { modo: 'vuela', vel: 3.0, grupo: [3, 6], cuerpo: '#4a3a2a', ala: '#5a4a38' },
    gaviota: { modo: 'vuela', vel: 2.6, grupo: [2, 4], cuerpo: '#f4f4f0', ala: '#c8ccd0' },
    cuervo: { modo: 'vuela', vel: 3.2, grupo: [2, 5], cuerpo: '#1e1a1c', ala: '#2a2628' },
    paloma: { modo: 'vuela', vel: 2.8, grupo: [3, 6], cuerpo: '#9aa0a8', ala: '#b0b6be' },
    pato: { modo: 'vuela', vel: 2.6, grupo: [3, 5], cuerpo: '#5a4a3a', ala: '#3e6a3a' },
    buitre: { modo: 'planea', vel: 1.6, grupo: [2, 3], cuerpo: '#2e2622', ala: '#3a302a' },
  };
  const mA = {}; const matA = (hex) => mA[hex] || (mA[hex] = matC(hex));
  function armarAnimal(tipo) {
    const A = AN[tipo], g = new T.Group(), patas = [], alas = [];
    if (A.modo === 'vuela' || A.modo === 'planea') {
      const s = A.modo === 'planea' ? 1.6 : 1;
      b(0.22 * s, 0.08 * s, 0.08 * s, A.cuerpo, 0, 0, 0, g); b(0.07 * s, 0.07 * s, 0.07 * s, A.cuerpo, 0.13 * s, 0.02 * s, 0, g);
      for (const lado of [-1, 1]) { const piv = new T.Group(); piv.position.set(0, 0.02 * s, lado * 0.04 * s); g.add(piv); b(0.12 * s, 0.02 * s, 0.26 * s, A.ala, 0, 0, lado * 0.13 * s, piv); alas.push({ piv, lado }); }
      return { g, patas, alas };
    }
    const L = A.largo, H = A.alto;
    if (A.serpiente) { for (let i = 0; i < 6; i++) patas.push({ m: b(0.1, 0.05, 0.06, A.cuerpo, -i * 0.1, 0.03, 0, g), i, serp: true }); b(0.09, 0.06, 0.07, A.cab, 0.1, 0.035, 0, g); return { g, patas, alas }; }
    const lana = A.lana ? 1.35 : 1;
    b(L, H * 0.75 * lana, L * 0.42 * lana, A.cuerpo, 0, H + H * 0.35, 0, g);
    if (A.zancuda) { b(0.04, 0.32, 0.04, A.cab, L * 0.45, H + 0.45, 0, g); b(0.1, 0.06, 0.06, A.cab, L * 0.55, H + 0.62, 0, g); b(0.1, 0.02, 0.02, '#e0a020', L * 0.68, H + 0.61, 0, g); }
    else if (A.modo !== 'repta') { b(L * 0.34, H * 0.55, L * 0.3, A.cab, L * 0.6, H + H * 0.75, 0, g); }
    else b(L * 0.3, H * 1.2, L * 0.5, A.cab, L * 0.55, H * 0.8, 0, g);
    if (A.cuernos) for (const z of [-1, 1]) { b(0.03, 0.18, 0.03, A.cuernos, L * 0.62, H + H * 1.2, z * 0.06, g); b(0.12, 0.03, 0.03, A.cuernos, L * 0.62, H + H * 1.2 + 0.06, z * 0.07, g); }
    if (A.orejas) for (const z of [-1, 1]) b(0.03, 0.1, 0.03, A.cab, L * 0.6, H + H * 1.4, z * 0.03, g);
    if (A.colmillos) for (const z of [-1, 1]) b(0.06, 0.02, 0.02, '#f0ead8', L * 0.8, H + H * 0.5, z * 0.05, g);
    if (A.cola) { const c = b(L * 0.4, 0.04, 0.05, A.cuerpo, -L * 0.6, H + H * (A.modo === 'repta' ? 0.2 : 0.7), 0, g); if (tipo === 'escorpion') { c.rotation.z = 1.2; c.position.y += 0.08; } }
    if (A.modo === 'repta') { for (const x of [-1, 1]) for (const z of [-1, 1]) patas.push({ m: b(0.05, 0.02, 0.1, A.cuerpo, x * L * 0.25, 0.01, z * L * 0.25, g), x, z }); return { g, patas, alas }; }
    const lp = A.zancuda ? 0.42 : H + 0.02;
    for (const x of [-1, 1]) for (const z of [-1, 1]) { if (A.zancuda && x > 0) continue; const piv = new T.Group(); piv.position.set(x * L * 0.36, H + 0.02, z * L * 0.15); g.add(piv); b(0.045, lp, 0.045, A.cuerpo === '#f2eee4' ? '#2a2420' : A.zancuda ? '#c8a040' : A.cuerpo, 0, -lp / 2, 0, piv); patas.push({ piv, x, z }); }
    return { g, patas, alas };
  }
  const bichos = [];
  let proxBicho = 1.2 + rnd() * 1.5;
  function soltarBichos() {
    const tipo = RG.animales[Math.floor(rnd() * RG.animales.length)], A = AN[tipo];
    if (!A) return;
    const vuela = A.modo === 'vuela' || A.modo === 'planea';
    // entran por un costado y salen por el de enfrente
    const desdeIzq = rnd() < 0.5, z0 = (rnd() - 0.5) * (MAPA_D - 4), z1 = z0 + (rnd() - 0.5) * 6;
    const ini = [desdeIzq ? -W2 - 7 : W2 + 7, z0], fin = [desdeIzq ? W2 + 7 : -W2 - 7, Math.max(-D2 + 1, Math.min(D2 - 1, z1))];
    const n = A.grupo[0] + Math.floor(rnd() * (A.grupo[1] - A.grupo[0] + 1));
    for (let i = 0; i < n; i++) {
      const a = armarAnimal(tipo), off = [(rnd() - 0.5) * 1.6 - i * 0.5, (rnd() - 0.5) * 1.6];
      a.g.scale.setScalar(vuela ? 1.3 : 1.3);   // un poco exagerados, como en una maqueta
      scene.add(a.g);
      bichos.push({ ...a, A, ini: [ini[0] + (desdeIzq ? off[0] : -off[0]), ini[1] + off[1]], fin: [fin[0] + (desdeIzq ? off[0] : -off[0]), fin[1] + off[1]], t: -i * 0.06 - rnd() * 0.05, ph: rnd() * 6, alto: vuela ? 2.6 + rnd() * 1.4 : 0, pausa: 0 });
    }
  }
  function moverBichos(t, dt) {
    proxBicho -= dt;
    if (proxBicho <= 0 && bichos.length < 10) { soltarBichos(); proxBicho = 4 + rnd() * 7; }
    for (let i = bichos.length - 1; i >= 0; i--) {
      const k = bichos[i], A = k.A, L = Math.hypot(k.fin[0] - k.ini[0], k.fin[1] - k.ini[1]);
      // a veces los que caminan se paran a comer
      if (A.modo === 'camina' && k.pausa <= 0 && rnd() < dt * 0.08) k.pausa = 1 + rnd() * 2;
      const quieto = k.pausa > 0; if (quieto) k.pausa -= dt;
      const avance = quieto ? 0 : dt * A.vel / L * (A.modo === 'salta' ? (Math.sin(t * 9 + k.ph) > 0 ? 1.8 : 0.2) : 1);
      k.t += avance;
      if (k.t >= 1) { scene.remove(k.g); bichos.splice(i, 1); continue; }
      const u = Math.max(0, k.t), x = k.ini[0] + (k.fin[0] - k.ini[0]) * u;
      let z = k.ini[1] + (k.fin[1] - k.ini[1]) * u;
      if (A.modo === 'planea') z += Math.sin(t * 0.6 + k.ph) * 1.5;
      const dir = Math.atan2(-(k.fin[1] - k.ini[1]), k.fin[0] - k.ini[0]);
      const suelo = Math.max(alturaEn(x, z), NIVEL_AGUA);
      let y = suelo;
      if (A.modo === 'vuela' || A.modo === 'planea') y = Math.max(suelo + 1.2, k.alto + Math.sin(t * 1.4 + k.ph) * 0.3);
      if (A.modo === 'salta') y += Math.max(0, Math.sin(t * 9 + k.ph)) * 0.18;
      k.g.position.set(x, y, z); k.g.rotation.y = dir;
      if (A.modo === 'planea') k.g.rotation.z = Math.sin(t * 0.6 + k.ph) * 0.25;
      // patas y alas
      const ciclo = t * A.vel * 9 + k.ph;
      k.patas.forEach((p) => {
        if (p.piv) p.piv.rotation.z = quieto ? 0 : Math.sin(ciclo + (p.x * p.z > 0 ? 0 : Math.PI)) * 0.6;
        else if (p.serp) p.m.position.z = Math.sin(ciclo * 0.6 - p.i * 0.9) * 0.07;
        else p.m.position.x = p.x * A.largo * 0.25 + Math.sin(ciclo + p.z) * 0.03;
      });
      k.alas.forEach((w) => { w.piv.rotation.x = w.lado * (A.modo === 'planea' ? 0.12 + Math.sin(t * 2 + k.ph) * 0.08 : Math.sin(t * 14 + k.ph) * 0.7); });
      if (quieto && k.g.children[1]) k.g.children[1].position.y = A.alto + A.alto * 0.75 - Math.abs(Math.sin(t * 3)) * A.alto * 0.4;
    }
  }
  anim.push((t, dt) => moverBichos(t, dt));
  const m4 = new T.Matrix4(), cc = new T.Color(), hsh = (i, j) => { let n = (i * 374761393 + j * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  // piedritas de los caminos
  const piedras = [];
  const camino = (ax, az, bx, bz, hex, paso = 0.42, tam = 0.16) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / paso)); for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, y = alturaEn(x, z); piedras.push([x, y + 0.03, z, tam, hex]); } };
  // modelos
  const b = (w, hh, d, hex, x, y, z, par) => caja(w, hh, d, typeof hex === 'string' ? matC(hex) : hex, x, y, z, par);
  const brillo = (hex) => new T.MeshBasicMaterial({ color: hex });
  const bandera = (par, x, y, z, hex, alto = 0.7) => { b(0.04, alto, 0.04, '#3a2a1a', x, y + alto / 2, z, par); const f = b(0.26, 0.16, 0.03, hex, x + 0.15, y + alto - 0.1, z, par); anim.push((t) => { f.rotation.y = Math.sin(t * 3 + x * 5) * 0.35; }); };
  const techo = (r, hh, hex, x, y, z, par) => { const o = cil(0, r, hh, 4, typeof hex === 'string' ? matC(hex) : hex, x, y, z, par); o.rotation.y = Math.PI / 4; return o; };
  function coliseo(r, pisos, piedra, acento, par) {
    const g = new T.Group(), n = Math.round(r * 13);
    cil(r * 0.78, r * 0.78, 0.08, 14, matC('#e2c88a'), 0, 0.04, 0, g);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, w = (r * 2 * Math.PI / n) * 0.96; for (let p = 0; p < pisos; p++) { const s = b(w, 0.3, 0.26, shade(piedra, (k + p) % 2 ? 1 : 0.9), Math.cos(a) * (r + p * 0.07), 0.15 + p * 0.3, Math.sin(a) * (r + p * 0.07), g); s.rotation.y = -a + Math.PI / 2; const arco = b(w * 0.45, 0.2, 0.28, '#3a2a1c', Math.cos(a) * (r + p * 0.07 + 0.01), 0.12 + p * 0.3, Math.sin(a) * (r + p * 0.07 + 0.01), g); arco.rotation.y = s.rotation.y; } }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; bandera(g, Math.cos(a) * (r + 0.1), pisos * 0.3, Math.sin(a) * (r + 0.1), acento, 0.5); }
    par.add(g); return g;
  }
  function carpa(hex, x, z, par, s = 1) { b(0.5 * s, 0.3 * s, 0.5 * s, '#e8dcc0', x, 0.15 * s, z, par); techo(0.48 * s, 0.4 * s, mat({ map: TX.tela(hex, 2, 1) }), x, 0.5 * s, z, par); }
  const MODELO = {
    cdh: (g) => { coliseo(1.25, 3, '#e6d2a8', '#b3261a', g); b(0.5, 0.5, 0.2, '#d4a52a', 0, 1.15, 1.32, g); return 1.7; },
    cde: (g) => { coliseo(0.85, 2, '#c9a886', '#2e6fd8', g); return 1.2; },
    pdc: (g) => { for (let k = 0; k < 5; k++) b(0.7 - k * 0.07, 0.42, 0.7 - k * 0.07, k % 2 ? '#8a8072' : '#7a7064', 0, 0.21 + k * 0.42, 0, g); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b(0.14, 0.2, 0.14, '#6a6054', x * 0.2, 2.2, z * 0.2, g); for (let k = 1; k < 5; k++) b(0.12, 0.16, 0.02, brillo('#ffd070'), 0, 0.25 + k * 0.42, 0.36 - k * 0.035, g); const c = b(0.3, 0.12, 0.3, brillo('#f0c24a'), 0, 2.45, 0, g); anim.push((t) => { c.position.y = 2.45 + Math.sin(t * 2) * 0.06; c.rotation.y = t; }); return 2.6; },
    subasta: (g) => { carpa('#c0392b', -0.7, -0.2, g); carpa('#e0b31c', 0.7, -0.25, g); carpa('#c0392b', 0, -0.75, g, 1.2); b(0.9, 0.12, 0.5, '#7a5a36', 0, 0.06, 0.45, g); b(0.5, 0.3, 0.34, '#5a4026', 0.05, 0.3, 0.45, g); for (const x of [-0.18, 0.28]) { const r = cil(0.14, 0.14, 0.05, 8, matC('#3a2a1a'), x, 0.16, 0.65, g); r.rotation.x = Math.PI / 2; } for (let k = 0; k < 5; k++) b(0.03, 0.3, 0.03, '#2a1a10', -0.15 + k * 0.1, 0.6, 0.62, g); return 1.1; },
    especial: (g) => { b(1.1, 0.4, 1.1, '#efe4cc', 0, 0.2, 0, g); techo(1.0, 0.9, mat({ map: TX.tela('#8e44ad', 3, 1) }), 0, 0.85, 0, g); b(0.3, 0.3, 0.06, '#2a1a10', 0, 0.16, 0.56, g); bandera(g, 0, 1.3, 0, '#f0c24a', 0.5); const gema = new T.Mesh(new T.OctahedronGeometry(0.16), brillo('#e9b8ff')); gema.position.set(0, 2.05, 0); g.add(gema); anim.push((t) => { gema.rotation.y = t * 2; gema.position.y = 2.05 + Math.sin(t * 2.4) * 0.06; }); return 2.0; },
    evento: (g) => { b(0.5, 0.08, 0.5, '#5a5048', 0, 0.04, 0, g); const f1 = b(0.2, 0.3, 0.2, brillo('#ff9a2a'), 0, 0.24, 0, g), f2 = b(0.1, 0.2, 0.1, brillo('#ffe08a'), 0, 0.42, 0, g); anim.push((t) => { f1.scale.y = 1 + Math.sin(t * 13) * 0.25; f2.position.y = 0.42 + Math.sin(t * 17) * 0.05; f2.scale.setScalar(0.8 + Math.sin(t * 11) * 0.3); }); const cols = ['#c0392b', '#2e6fd8', '#e0b31c', '#2f9e44', '#8e44ad', '#e8e8e8']; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; bandera(g, Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85, cols[k], 0.75); } carpa('#2e6fd8', -0.2, -1.0, g, 0.9); return 1.1; },
    mazmorra: (g) => { for (const [w, hh, d, x, y, z] of [[1.6, 0.6, 1.3, 0, 0.3, -0.2], [1.2, 0.5, 1.0, -0.1, 0.85, -0.3], [0.7, 0.4, 0.7, 0.1, 1.3, -0.35], [0.5, 0.5, 0.5, 0.95, 0.25, 0.2], [0.4, 0.35, 0.5, -0.95, 0.18, 0.25]]) b(w, hh, d, hsh(Math.round(x * 9), Math.round(y * 9)) < 0.5 ? '#4a4038' : '#3c342e', x, y, z, g); b(0.6, 0.62, 0.1, brillo('#050403'), 0, 0.31, 0.46, g); b(0.26, 0.2, 0.06, '#e8e0c8', 0, 0.78, 0.48, g); b(0.05, 0.06, 0.02, brillo('#050403'), -0.06, 0.8, 0.52, g); b(0.05, 0.06, 0.02, brillo('#050403'), 0.06, 0.8, 0.52, g); for (const x of [-0.48, 0.48]) { b(0.05, 0.4, 0.05, '#2a1a10', x, 0.2, 0.55, g); const f = b(0.1, 0.14, 0.1, brillo('#ff8a20'), x, 0.47, 0.55, g); anim.push((t) => { f.scale.y = 1 + Math.sin(t * 15 + x * 9) * 0.3; }); } return 1.7; },
    diablo: (g) => { coliseo(1.3, 3, '#3a2622', '#b3261a', g); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, f = b(0.16, 0.36, 0.16, brillo(k % 2 ? '#ff5a10' : '#ffb030'), Math.cos(a) * 1.45, 1.05, Math.sin(a) * 1.45, g); anim.push((t) => { f.scale.y = 1 + Math.sin(t * 14 + k) * 0.35; }); } for (const x of [-0.18, 0.18]) { const c = cil(0, 0.09, 0.45, 6, matC('#7a1a10'), x, 1.35, 0, g); c.rotation.z = x < 0 ? 0.35 : -0.35; } return 1.9; },
  };
  const hitos = [];
  // dónde está parado Prota al llegar a este mapa
  const base = opts.base || LY.base;
  // los lugares abiertos
  const TINTE = { cdh: '#f0c24a', cde: '#e08a3a', pdc: '#ffd070', subasta: '#8fd070', especial: '#d08af8', evento: '#6ac8f0', mazmorra: '#f06a4a', diablo: '#ff2a1a' };
  const puntos = [], hits = [], marcas = [];
  opts.lugares.forEach((l, idx) => {
    const x = l.x, z = l.y, y = alturaEn(x, z), g = new T.Group(); g.position.set(x, y, z); scene.add(g);
    const alto = MODELO[l.tipo](g);
    if (l.tipo !== 'cdh') camino(base[0], base[1], x, z + 0.9, '#2e1c0e', 0.5, 0.12);
    const m = new T.Mesh(new T.OctahedronGeometry(0.2), brillo(TINTE[l.tipo])); m.position.set(0, alto + 0.55, 0); g.add(m);
    const aro = new T.Mesh(new T.RingGeometry(1.7, 1.95, 28), new T.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0, side: T.DoubleSide })); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.06; g.add(aro);
    marcas.push({ m, aro, y0: alto + 0.55, g, sale: 0.25 + idx * 0.13 });
    const hit = new T.Mesh(new T.SphereGeometry(1.5, 8, 6), new T.MeshBasicMaterial({ visible: false })); hit.position.set(x, y + alto * 0.5, z); hit.userData.idx = idx; scene.add(hit); hits.push(hit);
    puntos.push({ idx, pos: new T.Vector3(x, y + alto + 1.0, z), suelo: new T.Vector3(x, y, z) });
  });
  const pi = new T.InstancedMesh(new T.BoxGeometry(1, 0.05, 1), mat({}), piedras.length);
  piedras.forEach(([x, y, z, tam, hex], k) => { m4.makeScale(tam, 1, tam).setPosition(x, y, z); pi.setMatrixAt(k, m4); pi.setColorAt(k, cc.set(hex)); });
  scene.add(pi);
  // Prota
  let prota = null;
  if (opts.prota) { prota = gladSprite(opts.prota, 0.95); prota.position.set(base[0], alturaEn(base[0], base[1]), base[1]); scene.add(prota); }
  // cámara
  const cam = { x: base[0], z: base[1], zoom: 1, yaw: 0, mx: base[0], mz: base[1], mzoom: 1, todo: false };
  let sel = -1, viaje = null;
  const S = {
    scene, camera, puntos, hitos, cam,
    elegir(i) { sel = i; const p = puntos[i]; if (p && !cam.todo) { cam.mx = p.suelo.x; cam.mz = p.suelo.z; } },
    verTodo(v) { cam.todo = v; if (v) { cam.mx = 0; cam.mz = 0.5; cam.mzoom = 1.75; } else { cam.mzoom = 1; S.elegir(sel); } },
    zoom(f) { if (!cam.todo) cam.mzoom = Math.max(0.6, Math.min(1.9, cam.mzoom * f)); },
    girar(d) { cam.yaw = Math.max(-0.9, Math.min(0.9, cam.yaw + d)); },
    picar(nx, ny) { const r = new T.Raycaster(); r.setFromCamera(new T.Vector2(nx, ny), camera); const h = r.intersectObjects(hits)[0]; return h ? h.object.userData.idx : -1; },
    viajar(i, cb) {
      const p = puntos[i]; if (!p || !prota) return cb();
      const a = prota.position.clone(), fin = new T.Vector3(p.suelo.x + 0.3, 0, p.suelo.z + 1.5), d = a.distanceTo(fin);
      viaje = { a, fin, t: 0, dur: Math.max(0.7, Math.min(1.7, d / 9)), cb }; cam.todo = false; cam.mzoom = 0.85; cam.mx = p.suelo.x; cam.mz = p.suelo.z;
    },
    update(t, dt) {
      anim.forEach((f) => f(t, dt));
      marcas.forEach((k, i) => { const e = i === sel, q = Math.max(0, Math.min(1, (t - k.sale) / 0.45)); k.g.scale.setScalar(q <= 0 ? 0.001 : q + Math.sin(q * Math.PI) * 0.22); k.m.position.y = k.y0 + Math.sin(t * 2.2 + i) * 0.1; k.m.rotation.y = t * 1.5; k.m.scale.setScalar(e ? 1.5 : 1); k.aro.material.opacity = e ? 0.55 + Math.sin(t * 4) * 0.25 : 0; k.aro.scale.setScalar(e ? 1 + Math.sin(t * 4) * 0.04 : 1); });
      if (prota) {
        if (viaje) {
          viaje.t += dt / viaje.dur; const k = sm(Math.min(1, viaje.t));
          prota.position.lerpVectors(viaje.a, viaje.fin, k); prota.position.y = alturaEn(prota.position.x, prota.position.z) + Math.abs(Math.sin(viaje.t * 22)) * 0.05;
          if (prota.animar) prota.animar(dt, 'caminar');
          if (viaje.t >= 1) { const cb = viaje.cb; viaje = null; cb(); }
        } else if (prota.animar) prota.animar(dt, 'quieto');
      }
      const q = 1 - Math.exp(-dt * 3.2);
      if (!cam.todo) { cam.mx = Math.max(-W2 + 3, Math.min(W2 - 3, cam.mx)); cam.mz = Math.max(-D2 + 2, Math.min(D2 - 1, cam.mz)); }
      cam.x += (cam.mx - cam.x) * q; cam.z += (cam.mz - cam.z) * q; cam.zoom += (cam.mzoom - cam.zoom) * q;
      // el panel de información tapa un costado (margenDer negativo = el panel está a la izquierda): la cámara se corre para que el lugar quede centrado en lo que se ve
      const D = 15 * cam.zoom * (cam.todo ? 1 + Math.abs(S.margenDer || 0) * 0.5 : 1), asp = camera.aspect, baja = cam.todo ? 0 : 0.5 * cam.zoom;
      const lado = (S.margenDer || 0) * D * (cam.todo ? 0.62 : 0.5) * asp;
      const yw = cam.yaw + Math.sin(t * 0.25) * 0.03;
      camera.position.set(cam.x + lado + Math.sin(yw) * D * 0.72, D * (cam.todo ? 1.25 : 0.95), cam.z + baja + Math.cos(yw) * D * 0.72);
      camera.lookAt(cam.x + lado, 0.4, cam.z + baja);
      if (scene.fog) { scene.fog.near = D * 1.25 + 8; scene.fog.far = D * 2.4 + 22; }   // la bruma acompaña al zoom: lo lejano se pierde, lo cercano se ve claro
    },
  };
  S.update(0, 0); cam.x = cam.mx; cam.z = cam.mz;
  return S;
};

/* ---------- bokeh de cine para las cinemáticas: lo que está lejos del foco (el que habla) se desenfoca ---------- */
let dof = null;
function postDOF() {
  if (dof !== null) return dof;
  if (!renderer.capabilities.isWebGL2 && !renderer.extensions.has('WEBGL_depth_texture')) return (dof = false);
  const rt = new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  rt.depthTexture = new T.DepthTexture(4, 4); rt.depthTexture.type = T.UnsignedIntType;
  const mat = new T.ShaderMaterial({
    uniforms: { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, px: { value: new T.Vector2(0.001, 0.001) }, near: { value: 0.1 }, far: { value: 60 }, foco: { value: 5 }, rad: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tC, tD; uniform vec2 px; uniform float near, far, foco, rad; varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
      float coc(vec2 uv){ float z = lin(texture2D(tD, uv).x); return clamp(abs(z - foco) / (foco * 0.45) - 0.08, 0.0, 1.0); }
      void main(){
        float c0 = coc(vUv), r = c0 * rad;
        vec4 suma = texture2D(tC, vUv); float n = 1.0;
        if (r > 0.4) {
          for (int i = 0; i < 16; i++) {
            float fi = float(i) + 0.5, rr = sqrt(fi / 16.0) * r, a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * rr * px;
            float ci = coc(vUv + o), w = ci >= c0 * 0.6 ? 1.0 : 0.2;
            suma += texture2D(tC, vUv + o) * w; n += w;
          }
        }
        gl_FragColor = suma / n;
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const esc = new T.Scene(); esc.add(quad);
  return (dof = { rt, mat, esc, cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), tam: new T.Vector2() });
}
const _fv = new T.Vector3();
function dibujarDOF(S) {
  const c = S.camera, u = dof.mat.uniforms;
  renderer.getDrawingBufferSize(dof.tam);
  if (dof.rt.width !== dof.tam.x || dof.rt.height !== dof.tam.y) dof.rt.setSize(dof.tam.x, dof.tam.y);
  u.px.value.set(1 / dof.tam.x, 1 / dof.tam.y); u.near.value = c.near; u.far.value = c.far;
  // distancia al foco medida sobre el eje de la cámara (así coincide con la profundidad)
  c.getWorldDirection(_fv); u.foco.value = Math.max(0.5, _fv.dot(S.foco.clone().sub(c.position)));
  u.rad.value = S._bk * 7 * (dof.tam.y / 400);
  renderer.setRenderTarget(dof.rt); renderer.render(S.scene, c);
  renderer.setRenderTarget(null); renderer.render(dof.esc, dof.cam);
}
function montar(cont, nombre, opts = {}) {
  if (!renderer) { renderer = new T.WebGLRenderer({ antialias: true }); renderer.domElement.className = 'bg3d'; }   // bordes suaves (sin dientes de sierra)
  const S = ESC[nombre](opts);
  cont.prepend(renderer.domElement);
  const handle = { S, frames: [] };
  function resize() {
    const w = cont.clientWidth || 1, h = cont.clientHeight || 1;
    // nítido: a la resolución real de la pantalla (con tope según el nivel de gráficos)
    const AJ = root.Ajustes, d = root.devicePixelRatio || 1, nv = AJ ? AJ.nivel() : 'alto';
    renderer.setPixelRatio(Math.min(d, { alto: 2, medio: 1.5, bajo: 1.25 }[nv] || 1.5));
    renderer.setSize(w, h);
    S.camera.aspect = w / h; S.camera.updateProjectionMatrix();
    handle.onResize && handle.onResize();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(cont);
  const t0 = performance.now(); let last = t0;
  function frame(now) {
    if (!cont.isConnected || renderer.domElement.parentNode !== cont) { ro.disconnect(); return; }
    requestAnimationFrame(frame);
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000) * (root.__lento || 1); last = now;
    try { S.update && S.update(t, dt); handle.frames.forEach((f) => f(t, dt)); } catch (e) { console.error(e); }
    S._bk = (S._bk || 0) + ((S.bokeh || 0) - (S._bk || 0)) * Math.min(1, dt * 6);
    if (S.foco && S._bk > 0.03 && postDOF()) dibujarDOF(S); else renderer.render(S.scene, S.camera);
  }
  requestAnimationFrame(frame);
  // posición en pantalla (en % del contenedor) de un punto del mundo
  handle.proyectar = (v3) => { const v = v3.clone().project(S.camera); return { x: (v.x + 1) * 50, y: (1 - v.y) * 50, z: v.z }; };
  // punto de la pantalla (px del contenedor) → punto en el plano horizontal y = altura
  handle.aPlano = (px, py, altura) => {
    const r = cont.getBoundingClientRect();
    const ndc = new T.Vector2((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, S.camera);
    const p = new T.Vector3(); ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -altura), p); return p;
  };
  handle.resize = resize;
  return handle;
}
root.Mundo = { montar, ESC, REGIONES, regionLayout, MAPA_W, MAPA_D, V3: (x, y, z) => new T.Vector3(x, y, z), spriteEmp, gladSprite };
})(window);
