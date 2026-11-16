/* =====================================================================
   LOGROS Y ESTADÍSTICAS (por celular, guardados en el aparato)
   - El anfitrión anota los números de cada emperador en la partida (Partida.est).
   - Cada celular mira SU emperador y suma lo nuevo a su historial: así anda
     igual en el modo historia, siendo anfitrión o invitado del multijugador.
   - Todo separado en dos: modo historia y multijugador.
   ===================================================================== */
(function (root) {
  const CLAVE = 'kp_logros_v1';
  const MODOS = { historia: 'Modo Historia', multi: 'Multijugador' };
  // los monstruos que se pueden capturar en la mazmorra (el Diablo no)
  const MONSTRUOS = ['minotauro', 'medusa', 'licaon', 'arbol', 'ciclope', 'talos'];

  const base = () => ({
    partidas: 0, esclavizados: 0, ejecutados: 0, perdonados: 0, muertes: 0, decap: 0, ganadas: 0, perdidas: 0,
    sinBajas: 0, sinPiedad: 0, vendidos: 0, items: 0, nArmados: 0, insp: 0, ojos: 0, fusiones: 0, fusFail: 0,
    internados: 0, cdh: 0, torre: 0, ganoHistoria: 0, heroe: 0, ganoPartida: 0, ganoGrande: 0,
    maxOro: 0, minCompra: null, maxCompra: 0, monstruosVendidos: [], capturados: 0, maxMonstruos: 0,
    mejor: null,   // { nombre, raza, v, d, saldo }
  });
  let D = null;
  function cargar() {
    if (D) return D;
    try { D = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { D = null; }
    if (!D || !D.v) D = { v: 1, historia: base(), multi: base(), logros: { historia: {}, multi: {} }, visto: {} };
    for (const m of Object.keys(MODOS)) D[m] = Object.assign(base(), D[m]);
    return D;
  }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(D)); } catch (e) {} }

  /* ---------- los 30 logros ----------
     modos: en qué pestaña aparece (si está en las dos, se gana por separado en cada una).
     ok(L): L = el historial de ese modo. meta/prog: para la barrita de progreso. */
  const AMBOS = ['historia', 'multi'], H = ['historia'], MU = ['multi'];
  const LOGROS = [
    // pedidos por Merlin
    { id: 'heroe', nombre: 'El Héroe', desc: 'Pasá la historia sin usar monstruos', modos: H, ok: (L) => L.heroe > 0, ic: '🦸' },
    { id: 'comercio', nombre: 'Comerciomaníaco', desc: 'Vendé los seis monstruos distintos', modos: H, prog: (L) => L.monstruosVendidos.length, meta: MONSTRUOS.length, ic: '🐂' },
    { id: 'altruista', nombre: 'Altruista', desc: 'Arma y armadura a 30 esclavos', modos: AMBOS, prog: (L) => L.nArmados, meta: 30, ic: '🛡️' },
    // peleas
    { id: 'sangre', nombre: 'Primera Sangre', desc: 'Ganá tu primer coliseo', modos: AMBOS, prog: (L) => L.ganadas, meta: 1, ic: '🩸' },
    { id: 'rey', nombre: 'Rey del Coliseo', desc: 'Ganá 25 coliseos', modos: AMBOS, prog: (L) => L.ganadas, meta: 25, ic: '🏛️' },
    { id: 'derrotas', nombre: 'Coleccionista de Derrotas', desc: 'Perdé 10 coliseos', modos: AMBOS, prog: (L) => L.perdidas, meta: 10, ic: '🥀' },
    { id: 'rasguno', nombre: 'Sin un Rasguño', desc: 'Ganá un coliseo sin bajas', modos: AMBOS, prog: (L) => L.sinBajas, meta: 1, ic: '✨' },
    { id: 'piedra', nombre: 'Corazón de Piedra', desc: 'Ganá rematando a todos (mínimo 3)', modos: AMBOS, prog: (L) => L.sinPiedad, meta: 1, ic: '🪨' },
    { id: 'abajo', nombre: 'Pulgar Abajo', desc: 'Tus gladiadores ejecutan a 25', modos: AMBOS, prog: (L) => L.ejecutados, meta: 25, ic: '👎' },
    { id: 'arriba', nombre: 'Pulgar Arriba', desc: 'Tus gladiadores perdonan a 25', modos: AMBOS, prog: (L) => L.perdonados, meta: 25, ic: '👍' },
    { id: 'carnicero', nombre: 'El Carnicero', desc: 'Tus gladiadores matan a 100', modos: AMBOS, prog: (L) => L.muertes, meta: 100, ic: '🔪' },
    { id: 'decap', nombre: 'Cortacabezas', desc: 'Decapitá a 10 enemigos', modos: AMBOS, prog: (L) => L.decap, meta: 10, ic: '🪓' },
    // esclavos y oro
    { id: 'esclavista', nombre: 'El Esclavista', desc: 'Esclavizá a 50 gladiadores', modos: AMBOS, prog: (L) => L.esclavizados, meta: 50, ic: '⛓️' },
    { id: 'amo', nombre: 'Gran Amo de Esclavos', desc: 'Esclavizá a 200 gladiadores', modos: AMBOS, prog: (L) => L.esclavizados, meta: 200, ic: '👑' },
    { id: 'mercader', nombre: 'Mercader de Carne', desc: 'Vendé a 20 esclavos', modos: AMBOS, prog: (L) => L.vendidos, meta: 20, ic: '⚖️' },
    { id: 'craso', nombre: 'Rico como Craso', desc: 'Juntá 400 de oro a la vez', modos: AMBOS, prog: (L) => L.maxOro, meta: 400, ic: '💰' },
    { id: 'ganga', nombre: 'La Ganga', desc: 'Comprá un lote por 5 de oro', modos: AMBOS, ok: (L) => L.minCompra != null && L.minCompra <= 5, ic: '🪙' },
    { id: 'derroche', nombre: 'El Derrochador', desc: 'Pagá 100 de oro en una subasta', modos: AMBOS, prog: (L) => L.maxCompra, meta: 100, ic: '💸' },
    { id: 'halcon', nombre: 'Ojo de Halcón', desc: 'Espiá 20 carros con el ojito', modos: AMBOS, prog: (L) => L.ojos, meta: 20, ic: '👁️' },
    // el chamán
    { id: 'alquimia', nombre: 'Alquimia de Carne', desc: 'Lográ una fusión chamánica', modos: AMBOS, prog: (L) => L.fusiones, meta: 1, ic: '🔮' },
    { id: 'maldicion', nombre: 'La Maldición del Chamán', desc: 'Perdé dos esclavos en una fusión', modos: AMBOS, prog: (L) => L.fusFail, meta: 1, ic: '💀' },
    // solo historia
    { id: 'naldo', nombre: 'Bajo la Corona de Naldo', desc: 'Ganá tu primer Coliseo de Historia', modos: H, prog: (L) => L.cdh, meta: 1, ic: '🏆' },
    { id: 'reino', nombre: 'El Precio del Reino', desc: 'Vencé al Diablo', modos: H, prog: (L) => L.ganoHistoria, meta: 1, ic: '😈' },
    { id: 'domador', nombre: 'Domador de Bestias', desc: 'Capturá un monstruo en la mazmorra', modos: H, prog: (L) => L.capturados, meta: 1, ic: '🐉' },
    { id: 'zoo', nombre: 'Zoológico Imperial', desc: 'Tené 3 monstruos a la vez', modos: H, prog: (L) => L.maxMonstruos, meta: 3, ic: '🦁' },
    { id: 'sanador', nombre: 'Amigo del Curandero', desc: 'Interná a 20 gladiadores', modos: H, prog: (L) => L.internados, meta: 20, ic: '🛏️' },
    // solo multijugador
    { id: 'emperador', nombre: 'Emperador', desc: 'Ganá una partida', modos: MU, prog: (L) => L.ganoPartida, meta: 1, ic: '🦅' },
    { id: 'dinastia', nombre: 'Dinastía', desc: 'Ganá 5 partidas', modos: MU, prog: (L) => L.ganoPartida, meta: 5, ic: '🏰' },
    { id: 'todos', nombre: 'Todos Contra Mí', desc: 'Ganá una partida de 4 o más', modos: MU, prog: (L) => L.ganoGrande, meta: 1, ic: '⚔️' },
    { id: 'torre', nombre: 'Señor de la Torre', desc: 'Ganá una pelea de campeones', modos: MU, prog: (L) => L.torre, meta: 1, ic: '🗼' },
  ];
  const cumplido = (l, L) => (l.ok ? l.ok(L) : l.prog(L) >= l.meta);

  /* ---------- el observador: mira tu emperador y suma lo nuevo ---------- */
  const NUM = ['ejecutados', 'perdonados', 'muertes', 'decap', 'ganadas', 'perdidas', 'sinBajas', 'sinPiedad', 'vendidos', 'items', 'nArmados', 'insp', 'ojos', 'fusiones', 'fusFail', 'internados', 'cdh', 'torre', 'ganoHistoria', 'ganoPartida'];
  function observar() {
    const C = root.COLISEO; if (!C) return;
    const G = C.G, YO = C.YO; if (!G || YO == null) return;
    const Red = root.Red;
    if (!G.historia && (!Red || Red.modo === 'solo')) return;   // atajos de prueba: no cuentan
    const e = G.emperadores.find((x) => x.id === YO); if (!e) return;
    const modo = G.historia ? 'historia' : 'multi';
    cargar();
    const L = D[modo];
    if (!G.uid) G.uid = (G.seed || 0) + '-' + Date.now().toString(36);   // partidas viejas sin identificador
    const clave = modo + ':' + G.uid;
    let V = D.visto[clave];
    if (!V) { V = D.visto[clave] = { t: Date.now(), est: {}, glads: {}, monVend: [] }; L.partidas++; podarVistos(); }
    let cambio = false;
    // contadores que anota el anfitrión
    const E = e.est || {};
    for (const k of NUM) { const d = (E[k] || 0) - (V.est[k] || 0); if (d > 0) { L[k] += d; V.est[k] = E[k]; cambio = true; } }
    if (E.ganoHistoria && !V.est.heroeVisto) { V.est.heroeVisto = 1; if (!E.usoMonstruo) L.heroe++; cambio = true; }
    if (E.ganoPartida && !V.est.grandeVisto) { V.est.grandeVisto = 1; if ((E.jugadores || 0) >= 4) L.ganoGrande++; cambio = true; }
    if (E.minCompra != null && (L.minCompra == null || E.minCompra < L.minCompra)) { L.minCompra = E.minCompra; cambio = true; }
    if ((E.maxCompra || 0) > L.maxCompra) { L.maxCompra = E.maxCompra; cambio = true; }
    for (const m of E.monstruosVendidos || []) if (!L.monstruosVendidos.includes(m)) { L.monstruosVendidos.push(m); cambio = true; }
    // oro máximo en una partida
    const oro = (e.bolsa && e.bolsa.oro) || 0;
    if (oro > L.maxOro) { L.maxOro = oro; cambio = true; }
    // esclavos nuevos (y monstruos capturados), y el mejor récord desde que son tuyos
    let monstruos = 0;
    for (const g of e.escuderia || []) {
      if (!g || !g.id) continue;
      const r = g.record || { v: 0, d: 0 };
      let gv = V.glads[g.id];
      if (!gv) {
        gv = V.glads[g.id] = [r.v || 0, r.d || 0];
        if (g.jefe) { if (g.inmortal) L.capturados++; } else L.esclavizados++;
        cambio = true;
      }
      if (g.vivo !== false && g.inmortal) monstruos++;
      const v = (r.v || 0) - gv[0], d = (r.d || 0) - gv[1], saldo = v - d;
      if (v > 0 && (!L.mejor || saldo > L.mejor.saldo || (saldo === L.mejor.saldo && v > L.mejor.v))) { L.mejor = { nombre: g.nombre, raza: g.raza, v, d, saldo }; cambio = true; }
    }
    if (monstruos > L.maxMonstruos) { L.maxMonstruos = monstruos; cambio = true; }
    if (!cambio) return;
    // logros nuevos
    for (const l of LOGROS) {
      if (!l.modos.includes(modo) || D.logros[modo][l.id]) continue;
      if (cumplido(l, L)) { D.logros[modo][l.id] = Date.now(); avisar(l, modo); }
    }
    guardar();
  }
  function podarVistos() {
    const ks = Object.keys(D.visto).sort((a, b) => D.visto[b].t - D.visto[a].t);
    for (const k of ks.slice(12)) delete D.visto[k];
  }

  /* ---------- cartelito de logro desbloqueado ---------- */
  const cola = []; let mostrando = false;
  function avisar(l, modo) { cola.push({ l, modo }); if (!mostrando) siguiente(); if (root.Sonido && root.Sonido.publico) try { root.Sonido.publico('aplausos', 0.35); } catch (e) {} }
  function siguiente() {
    const x = cola.shift(); if (!x) { mostrando = false; return; }
    mostrando = true;
    const el = document.createElement('div');
    el.className = 'logro-toast';
    el.innerHTML = `<div class="lt-ic">${x.l.ic}</div><div><small>🏆 Logro desbloqueado</small><b>${x.l.nombre}</b><span>${x.l.desc}</span></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('ver'));
    setTimeout(() => { el.classList.remove('ver'); setTimeout(() => { el.remove(); siguiente(); }, 450); }, 3800);
  }

  /* ---------- el panel (botón trofeo del menú) ---------- */
  function fmtProm(L) { return L.partidas ? (L.esclavizados / L.partidas).toFixed(1).replace('.0', '') : '0'; }
  function panel(modoIni) {
    cargar();
    let modo = modoIni || 'historia';
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const ov = document.createElement('div');
    ov.className = 'logros-ov';
    const pintar = () => {
      const L = D[modo], hechos = D.logros[modo];
      const lista = LOGROS.filter((l) => l.modos.includes(modo));
      const n = lista.filter((l) => hechos[l.id]).length;
      const raza = (r) => { try { return root.Motor.razaLabel({ raza: r }, true); } catch (e) { return r; } };
      const M = L.mejor;
      const stats = [
        ['⛓️', 'Gladiadores esclavizados', L.esclavizados],
        ['📊', 'Esclavizados por partida', fmtProm(L)],
        ['👎', 'Gladiadores ejecutados', L.ejecutados],
        ['👍', 'Gladiadores perdonados', L.perdonados],
        ['💰', 'Más oro en una partida', L.maxOro],
        ['🏅', 'Mejor récord', M ? `${M.nombre} <small>${cap(raza(M.raza))} · ${M.v}V ${M.d}D</small> ${M.saldo >= 0 ? '+' : ''}${M.saldo}` : '—'],
        ['🏛️', 'Coliseos ganados', L.ganadas],
        ['🥀', 'Coliseos perdidos', L.perdidas],
      ];
      ov.innerHTML = `<div class="lg-caja">
        <div class="lg-cab"><div class="lg-tit">🏆 Logros y estadísticas</div><button class="lg-x" aria-label="Cerrar">✕</button></div>
        <div class="lg-tabs">${Object.entries(MODOS).map(([k, v]) => `<button data-m="${k}" class="${k === modo ? 'on' : ''}">${v}</button>`).join('')}</div>
        <div class="lg-cuerpo">
          <div class="lg-stats"><div class="lg-sub">Estadísticas <small>${L.partidas} ${L.partidas === 1 ? 'partida' : 'partidas'}</small></div>
            ${stats.map(([ic, k, v]) => `<div class="lg-st"><span>${ic} ${k}</span><b>${v}</b></div>`).join('')}</div>
          <div class="lg-logros"><div class="lg-sub">Logros <small>${n} de ${lista.length}</small></div>
            <div class="lg-grid">${lista.map((l) => {
              const ok = !!hechos[l.id], p = l.prog ? Math.min(l.meta, l.prog(L)) : null;
              return `<div class="lg-l ${ok ? 'ok' : ''}"><div class="lg-ic">${l.ic}</div><div class="lg-tx"><b>${l.nombre}</b><span>${l.desc}</span>
                ${!ok && p != null && l.meta > 1 ? `<div class="lg-bar"><i style="width:${(100 * p) / l.meta}%"></i></div><small>${p} / ${l.meta}</small>` : ''}</div></div>`;
            }).join('')}</div></div>
        </div></div>`;
      ov.querySelector('.lg-x').onclick = () => ov.remove();
      ov.querySelectorAll('.lg-tabs button').forEach((b) => (b.onclick = () => { modo = b.dataset.m; pintar(); }));
    };
    ov.onclick = (ev) => { if (ev.target === ov) ov.remove(); };
    pintar();
    document.body.appendChild(ov);
  }

  setInterval(() => { try { observar(); } catch (e) {} }, 2500);
  root.Logros = { observar, panel, LOGROS, datos: () => cargar(), _reset: () => { D = null; localStorage.removeItem(CLAVE); } };
})(window);
