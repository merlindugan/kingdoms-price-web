/* PANTALLA DE CARGA: mientras se arma la pelea (o la subasta), un paisaje pintado con el coliseo a lo lejos.
   Mientras se ve, el juego prepara todo (cuerpos, sangre, efectos) para que después no haya tirones. */
(function (root) {
  const PALETAS = {
    coliseo: { cielo: ['#3f6fa8', '#9cc0dc', '#f2cf94'], sol: '#fff2c0', montes: ['#8aa0b4', '#6f8a7a', '#4e6a46'], pasto: ['#6a8a3a', '#4e6e2c'], camino: '#c8a46a', piedra: ['#e2cfa6', '#b89c74', '#7a6248'] },
    historia: { cielo: ['#2e4f86', '#c88a5a', '#f6b860'], sol: '#ffd27a', montes: ['#7a7090', '#5e6a5a', '#3e5236'], pasto: ['#5a7a32', '#3e5a26'], camino: '#c09460', piedra: ['#f0dcae', '#c8a878', '#8a6c4c'] },
    torre: { cielo: ['#1a1430', '#4a3a6a', '#c07a8a'], sol: '#ffd0e0', montes: ['#3e3456', '#2e2a40', '#1e1e2a'], pasto: ['#2e3a2a', '#1e2a1e'], camino: '#7a6a7a', piedra: ['#b8b0c8', '#7a7090', '#4a4460'] },
    mazmorra: { cielo: ['#070a14', '#1a2238', '#3a3a52'], sol: '#e8ecf6', montes: ['#2a3040', '#1e2430', '#12161e'], pasto: ['#1e2a1e', '#141c14'], camino: '#4a4440', piedra: ['#8a8478', '#5e5a52', '#3a3632'], noche: true },
    diablo: { cielo: ['#1a0402', '#6a1008', '#e0501a'], sol: '#ffb040', montes: ['#4a1a10', '#36120a', '#200a06'], pasto: ['#3a2010', '#26140a'], camino: '#6a3a20', piedra: ['#a87060', '#7a4838', '#4a2a20'] },
    subasta: { cielo: ['#4a86c8', '#a8d0ec', '#f4e0b0'], sol: '#fff6d0', montes: ['#9ab0c0', '#7a9a7a', '#5a7a46'], pasto: ['#7a9a42', '#5a7e32'], camino: '#d0ac74', piedra: ['#e8d8b0', '#c0a478', '#8a6c4c'] },
  };
  let capa = null, anim = 0;
  // ruido suave para las siluetas de las montañas
  const ruido = (x, s) => Math.sin(x * 0.011 + s) * 0.5 + Math.sin(x * 0.027 + s * 2.1) * 0.3 + Math.sin(x * 0.061 + s * 3.7) * 0.2;
  function pintar(cv, P, tipo, t) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, hz = H * 0.58;
    g.imageSmoothingEnabled = false;
    // cielo
    const gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, P.cielo[0]); gr.addColorStop(0.6, P.cielo[1]); gr.addColorStop(1, P.cielo[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // sol (o luna) con resplandor
    const sx = W * 0.72, sy = hz * (P.noche ? 0.3 : 0.62), sr = H * (P.noche ? 0.05 : 0.07);
    const gl = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5); gl.addColorStop(0, P.sol + 'aa'); gl.addColorStop(1, P.sol + '00'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
    g.fillStyle = P.sol; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    if (P.noche) for (let i = 0; i < 90; i++) { const x = (i * 9973) % W, y = (i * 7919) % (hz * 0.8); g.fillStyle = `rgba(255,255,255,${0.3 + ((i * 13) % 7) / 10 * (0.6 + 0.4 * Math.sin(t * 2 + i))})`; g.fillRect(x, y, 2, 2); }
    // nubes que pasan
    if (!P.noche) for (let i = 0; i < 6; i++) {
      const x = ((i * 0.23 + t * 0.012 * (1 + i * 0.15)) % 1.3 - 0.15) * W, y = hz * (0.12 + (i % 3) * 0.13), w = W * (0.12 + (i % 2) * 0.06);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(x, y, w * 0.5, w * 0.11, 0, 0, Math.PI * 2); g.ellipse(x + w * 0.18, y - w * 0.06, w * 0.28, w * 0.1, 0, 0, Math.PI * 2); g.fill();
    }
    // montañas lejanas (tres capas, cada una más oscura y más cerca)
    P.montes.forEach((c, k) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) g.lineTo(x, hz - H * (0.16 - k * 0.045) + ruido(x / W * 1400, k * 3.3) * H * (0.07 - k * 0.012) + k * H * 0.03);
      g.lineTo(W, H); g.fill();
    });
    // la loma donde está el edificio
    const cx = W * 0.5, cy = hz + H * 0.06;
    g.fillStyle = P.pasto[0]; g.beginPath(); g.moveTo(0, H); g.lineTo(0, hz + H * 0.08); g.quadraticCurveTo(cx, hz - H * 0.04, W, hz + H * 0.07); g.lineTo(W, H); g.fill();
    // el camino que llega
    g.fillStyle = P.camino; g.beginPath(); g.moveTo(cx - W * 0.012, cy + H * 0.02); g.quadraticCurveTo(cx + W * 0.1, H * 0.78, cx - W * 0.06, H); g.lineTo(cx + W * 0.14, H); g.quadraticCurveTo(cx + W * 0.2, H * 0.78, cx + W * 0.012, cy + H * 0.02); g.fill();
    // el edificio a lo lejos
    edificio(g, tipo, P, cx, cy, H, t);
    // primer plano: pasto oscuro, cipreses y matas
    g.fillStyle = P.pasto[1]; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.84); g.quadraticCurveTo(W * 0.25, H * 0.78, W * 0.42, H * 0.9); g.lineTo(W * 0.42, H); g.fill();
    g.beginPath(); g.moveTo(W, H); g.lineTo(W, H * 0.82); g.quadraticCurveTo(W * 0.8, H * 0.8, W * 0.66, H * 0.92); g.lineTo(W * 0.66, H); g.fill();
    const cipres = (x, y, h) => { g.fillStyle = P.noche ? '#0e140e' : '#22361e'; g.beginPath(); g.ellipse(x, y - h * 0.5, h * 0.13, h * 0.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a2614'; g.fillRect(x - 2, y - 4, 4, 8); };
    cipres(W * 0.08, H * 0.86, H * 0.32); cipres(W * 0.14, H * 0.88, H * 0.24); cipres(W * 0.9, H * 0.85, H * 0.3); cipres(W * 0.31, H * 0.66, H * 0.1); cipres(W * 0.68, H * 0.65, H * 0.09);
    // pájaros
    if (!P.noche) { g.strokeStyle = 'rgba(30,20,10,.6)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const x = ((t * 0.04 + i * 0.07) % 1.2) * W, y = hz * 0.4 + i * 9 + Math.sin(t * 3 + i) * 4, a = 6 + Math.sin(t * 8 + i) * 3; g.beginPath(); g.moveTo(x - 8, y - a * 0.5); g.lineTo(x, y); g.lineTo(x + 8, y - a * 0.5); g.stroke(); } }
    // viñeta
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,3,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function edificio(g, tipo, P, cx, cy, H, t) {
    const [cl, cm, cs] = P.piedra;
    if (tipo === 'subasta') {   // el mercado: carpas de colores y carros
      const carpa = (x, y, w, c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - w * 0.55); g.lineTo(x + w / 2, y); g.fill(); g.fillStyle = c2; for (let k = -2; k <= 2; k += 2) { g.beginPath(); g.moveTo(x + k * w / 10, y); g.lineTo(x, y - w * 0.55); g.lineTo(x + (k + 1) * w / 10, y); g.fill(); } g.fillStyle = '#3a2614'; g.fillRect(x - w * 0.12, y - w * 0.18, w * 0.24, w * 0.18); };
      const w = H * 0.11;
      carpa(cx - w * 1.1, cy, w, '#c0392b', '#f2e6c8'); carpa(cx + w * 0.1, cy - w * 0.1, w * 1.2, '#d8b040', '#8a3a2c'); carpa(cx + w * 1.3, cy, w, '#3a6aa8', '#f2e6c8');
      const carro = (x, y, s) => { g.fillStyle = '#6a4626'; g.fillRect(x - s, y - s * 0.6, s * 2, s * 0.5); g.fillStyle = '#3a2614'; for (let k = -1; k <= 1; k += 0.5) g.fillRect(x + k * s * 0.9, y - s * 1.2, 2, s * 0.6); g.fillRect(x - s, y - s * 1.25, s * 2, 2); g.beginPath(); g.arc(x - s * 0.6, y - s * 0.1, s * 0.25, 0, 7); g.arc(x + s * 0.6, y - s * 0.1, s * 0.25, 0, 7); g.fill(); };
      carro(cx - w * 2.3, cy + w * 0.3, w * 0.3); carro(cx + w * 2.4, cy + w * 0.25, w * 0.28);
      return;
    }
    if (tipo === 'torre') {   // la torre colgante de los campeones
      const w = H * 0.06, h = H * 0.42;
      g.fillStyle = cm; g.fillRect(cx - w / 2, cy - h, w, h); g.fillStyle = cl; g.fillRect(cx - w / 2, cy - h, w * 0.35, h);
      for (let k = 0; k < 6; k++) { g.fillStyle = '#ffd27a'; g.fillRect(cx - w * 0.12, cy - h + k * h / 6 + 6, w * 0.24, h / 14); }
      g.fillStyle = cs; g.fillRect(cx - w * 0.8, cy - h - 6, w * 1.6, 8);
      return;
    }
    // un coliseo visto desde lejos y un poco de arriba: el borde ovalado con las gradas adentro y el muro de dos pisos de arcos
    const R = H * 0.19, ry = R * 0.3, h = H * 0.12, ruina = tipo === 'mazmorra', top = cy - h;
    const alto = (t2) => (ruina ? h * (0.62 + 0.38 * Math.abs(Math.sin(t2 * 5.3 + 1.1))) : h);   // en ruinas, el muro está roto
    // adentro: gradas y arena
    g.fillStyle = cs; g.beginPath(); g.ellipse(cx, top, R, ry, 0, 0, Math.PI * 2); g.fill();
    for (let k = 1; k <= 3; k++) { g.strokeStyle = k % 2 ? cm : cl; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, top + k * ry * 0.06, R * (1 - k * 0.1), ry * (1 - k * 0.1), 0, Math.PI, Math.PI * 2); g.stroke(); }
    g.fillStyle = P.camino; g.beginPath(); g.ellipse(cx, top + ry * 0.22, R * 0.55, ry * 0.5, 0, 0, Math.PI * 2); g.fill();
    // el muro de adelante (sigue la curva del óvalo)
    const N = 40, borde = (t2) => [cx - Math.cos(t2) * R, top + Math.sin(t2) * ry];
    const gw = g.createLinearGradient(cx - R, 0, cx + R, 0); gw.addColorStop(0, cm); gw.addColorStop(0.35, cl); gw.addColorStop(1, cs);
    g.fillStyle = gw; g.beginPath();
    for (let k = 0; k <= N; k++) { const t2 = Math.PI * k / N, [x, y] = borde(t2); const yy = y + h - alto(t2); k ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    for (let k = N; k >= 0; k--) { const t2 = Math.PI * k / N, [x, y] = borde(t2); g.lineTo(x, y + h); }
    g.fill();
    // arcos en dos pisos (más angostos hacia los costados, por la curva)
    const NA = 16;
    for (let k = 0; k < NA; k++) {
      const t2 = Math.PI * (k + 0.5) / NA, [x, y] = borde(t2), w = (R * Math.PI / NA) * 0.42 * Math.sin(t2) + 1, a = alto(t2);
      for (const f of [0.22, 0.6]) {
        if (h - a > h * f - h * 0.05) continue;   // ese piso se cayó
        const ya = y + h * f + (h - a) * 0;
        g.fillStyle = 'rgba(28,16,8,.82)'; g.fillRect(x - w / 2, ya, w, h * 0.22); g.beginPath(); g.ellipse(x, ya, w / 2, w * 0.5, 0, Math.PI, 0); g.fill();
      }
      g.fillStyle = 'rgba(255,240,210,.25)'; g.fillRect(x + w / 2 + 1, y + h - a + 2, 1.5, a - 4);   // columnita iluminada
    }
    // cornisas
    g.strokeStyle = cl; g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= N; k++) { const t2 = Math.PI * k / N, [x, y] = borde(t2); const yy = y + h - alto(t2); k ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k <= N; k++) { const t2 = Math.PI * k / N, [x, y] = borde(t2); k ? g.lineTo(x, y + h * 0.5) : g.moveTo(x, y + h * 0.5); } g.stroke();
    if (!ruina) for (let k = 0; k < 7; k++) {   // banderas en el borde de atrás
      const t2 = Math.PI + Math.PI * (k + 0.5) / 7, x = cx - Math.cos(t2) * R * 0.98, y = top + Math.sin(t2) * ry;
      g.fillStyle = '#3a2614'; g.fillRect(x, y - 16, 2, 16); g.fillStyle = ['#c0392b', '#d8b040', '#3a6aa8'][k % 3]; g.fillRect(x + 2, y - 16 + Math.sin(t * 4 + k) * 1.5, 9, 5);
    }
    else for (let k = 0; k < 3; k++) {   // antorchas
      const t2 = Math.PI * (k + 1) / 4, [x, y] = borde(t2), fy = y + h * 0.3, fl = 5 + Math.sin(t * 12 + k) * 1.5;
      g.fillStyle = 'rgba(255,170,60,.16)'; g.beginPath(); g.arc(x, fy, 12, 0, 7); g.fill(); g.fillStyle = '#ffb030'; g.beginPath(); g.ellipse(x, fy - fl / 2, 2.5, fl, 0, 0, 7); g.fill();
    }
  }
  function mostrar(o = {}) {
    cerrarYa();
    const tipo = PALETAS[o.tipo] ? o.tipo : 'coliseo', P = PALETAS[tipo];
    capa = document.createElement('div'); capa.className = 'carga'; capa.setAttribute('aria-live', 'polite');
    capa.innerHTML = `<canvas></canvas><div class="carga-tx"><b>${o.titulo || ''}</b>${o.sub ? `<span>${o.sub}</span>` : ''}</div><div class="carga-bar"><i></i></div><div class="carga-pie">${o.pie || 'Preparando la arena'}<em>...</em></div>`;
    document.body.appendChild(capa);
    const cv = capa.querySelector('canvas'), dpr = Math.min(2, root.devicePixelRatio || 1);
    const tam = () => { cv.width = Math.round(innerWidth * dpr / 2); cv.height = Math.round(innerHeight * dpr / 2); };   // pintado a media resolución: queda con textura de pintura
    tam();
    const t0 = performance.now(), dibujo = edificioTipo(o.tipo);
    const cuadro = () => { if (!capa) return; pintar(cv, P, dibujo, (performance.now() - t0) / 1000); anim = requestAnimationFrame(cuadro); };
    cuadro();
    const yo = capa, inicio = performance.now();
    return {
      // cierra cuando pasó al menos "minimo" ms (así no parpadea), con un fundido
      cerrar(minimo = 0) {
        const falta = Math.max(0, minimo - (performance.now() - inicio));
        setTimeout(() => { if (capa !== yo) return; yo.classList.add('va'); const bar = yo.querySelector('.carga-bar i'); if (bar) bar.style.width = '100%'; setTimeout(() => { if (capa === yo) cerrarYa(); }, 450); }, falta);
      },
    };
  }
  const edificioTipo = (t) => (t === 'subasta' ? 'subasta' : t === 'torre' ? 'torre' : t === 'mazmorra' ? 'mazmorra' : 'coliseo');
  function cerrarYa() { cancelAnimationFrame(anim); if (capa) capa.remove(); capa = null; }
  root.Carga = { mostrar, cerrarYa, get activa() { return !!capa; } };
})(window);
