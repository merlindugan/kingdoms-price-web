/* =====================================================================
   MÚSICA (temas de Merlin)
   - Cada lugar del juego tiene su tema; los que vienen de a dos (subasta,
     coliseo de entretenimiento) se van alternando: uno en cada visita, y al
     terminar un tema sigue el otro.
   - Pasar de un tema a otro es un fundido cruzado (nunca un corte seco), y
     cuando un tema termina vuelve a empezar con un fundido corto.
   - En las peleas la música baja un poco para que se escuchen los golpes y
     el público.
   - Se apaga y se le cambia el volumen desde Ajustes, y con el botón 🎵 de
     la pelea. Es aparte del sonido de efectos.
   Usa elementos <audio> (no carga los temas enteros en memoria: importante
   en celulares con poca RAM).
   ===================================================================== */
(function (root) {
  const TEMAS = {
    menu: ['menu'], subasta: ['subasta1', 'subasta2'], cinematica: ['cinematica'],
    cdh: ['cdh'], cde: ['cde1', 'cde2'], campeones: ['campeones'], mazmorra: ['mazmorra'],
  };
  // volumen de cada lugar (todos los temas ya vienen igualados a -16 LUFS)
  const NIVEL = { menu: 0.7, subasta: 0.62, cinematica: 0.75, cdh: 0.5, cde: 0.5, campeones: 0.5, mazmorra: 0.55 };
  const FUNDIDO = 2.2, FUNDIDO_VUELTA = 3;   // segundos
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  let apagada = pref('kp_musica_off', '0') === '1';
  let volumen = +pref('kp_musica_vol', '0.8');
  if (!(volumen >= 0 && volumen <= 1)) volumen = 0.8;
  const turno = {};                 // por lugar: cuál de los dos toca (alternar)
  let lugar = null, actual = null;  // actual = { el, tema, lugar, g }
  const sonando = new Set();        // todos los elementos vivos (el que entra y el que se va)
  let pausada = false, tocado = false;

  function nuevo(tema) {
    const el = new Audio(); el.src = 'musica/' + tema + '.mp3'; el.preload = 'auto'; el.loop = false;
    el.volume = 0;
    return el;
  }
  const meta = (o) => (apagada || pausada ? 0 : volumen * (NIVEL[o.lugar] || 0.6) * o.g);
  // fundidos: cada elemento lleva su ganancia "g" (0..1) que sube o baja de a poco
  function fundir(o, hasta, seg) { o.desde = o.g; o.hasta = hasta; o.t0 = performance.now(); o.dur = Math.max(0.05, seg) * 1000; }
  function tick() {
    const ahora = performance.now();
    for (const o of [...sonando]) {
      if (o.dur) { const k = Math.min(1, (ahora - o.t0) / o.dur); o.g = o.desde + (o.hasta - o.desde) * (k * k * (3 - 2 * k)); if (k >= 1) o.dur = 0; }
      const v = Math.max(0, Math.min(1, meta(o)));
      if (Math.abs(o.el.volume - v) > 0.002) o.el.volume = v;
      if (o.g <= 0.001 && o.hasta === 0 && !o.dur) { o.el.pause(); o.el.removeAttribute('src'); o.el.load(); sonando.delete(o); continue; }
      // cerca del final: entra el tema siguiente (el otro del par, o el mismo de nuevo) con un fundido
      if (o === actual && o.el.duration && o.el.currentTime > o.el.duration - FUNDIDO_VUELTA - 0.1 && !o.siguiendo) {
        o.siguiendo = true;
        const lista = TEMAS[o.lugar];
        const sig = lista.length > 1 ? lista[(lista.indexOf(o.tema) + 1) % lista.length] : o.tema;
        if (lista.length > 1) turno[o.lugar] = (lista.indexOf(sig) + 1) % lista.length;
        arrancar(o.lugar, sig, FUNDIDO_VUELTA);
      }
    }
  }
  setInterval(tick, 50);

  function tocar(o) { if (apagada || pausada || !tocado) return; const p = o.el.play(); if (p && p.catch) p.catch(() => {}); }
  function arrancar(lug, tema, seg) {
    const viejo = actual;
    const o = { el: nuevo(tema), tema, lugar: lug, g: 0 };
    sonando.add(o); actual = o;
    fundir(o, 1, seg);
    if (viejo) fundir(viejo, 0, seg);
    tocar(o);
  }

  const M = {
    // pone la música de un lugar: 'menu', 'subasta', 'cinematica', 'cdh', 'cde', 'campeones', 'mazmorra'
    poner(lug) {
      if (!TEMAS[lug] || lug === lugar) return;
      lugar = lug;
      const lista = TEMAS[lug], i = turno[lug] || 0;
      turno[lug] = (i + 1) % lista.length;   // la próxima visita, el otro tema
      arrancar(lug, lista[i], FUNDIDO);
    },
    get lugar() { return lugar; },
    _saltarAlFinal: () => { if (actual && actual.el.duration) actual.el.currentTime = actual.el.duration - 4; },
    _estado: () => [...sonando].map((o) => ({ tema: o.tema, g: +o.g.toFixed(2), vol: +o.el.volume.toFixed(2), t: +o.el.currentTime.toFixed(1), pausado: o.el.paused, actual: o === actual })),
    get apagada() { return apagada; },
    get volumen() { return volumen; },
    apagar(si) {
      apagada = !!si; try { localStorage.setItem('kp_musica_off', apagada ? '1' : '0'); } catch (e) {}
      if (!apagada && actual) { tocar(actual); }
      for (const o of sonando) if (apagada) o.el.pause();
    },
    setVolumen(v) { volumen = Math.max(0, Math.min(1, +v || 0)); try { localStorage.setItem('kp_musica_vol', String(volumen)); } catch (e) {} },
    // la app pasa a segundo plano o vuelve
    pausa(si) { pausada = !!si; for (const o of sonando) { if (si) o.el.pause(); else if (o === actual || o.g > 0.01) tocar(o); } },
  };
  // el navegador solo deja sonar después de que el jugador toca algo
  const desbloquear = () => { if (tocado) return; tocado = true; for (const o of sonando) if (o === actual || o.g > 0.01) tocar(o); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => root.addEventListener(ev, desbloquear, { passive: true, capture: true }));
  // pestaña oculta (navegador): pausa; al volver, sigue
  document.addEventListener('visibilitychange', () => M.pausa(document.hidden));
  root.Musica = M;
})(window);
