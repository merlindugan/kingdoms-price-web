/* =====================================================================
   COLISEO · SONIDO (todo sintetizado con WebAudio, sin archivos)
   Público (murmullo de fondo y reacciones), choques de armas, carne,
   huesos, quejidos y gruñidos, pisadas en la arena, derribos,
   botones del HUD y fichas del tablero.
   Uso:
     Sonido.golpe({ arma, armadura, escudo, res, fuerza, x, y, z })
     Sonido.voz(raza, 'dolor' | 'esfuerzo' | 'muerte' | 'grito', pos)
     Sonido.publico('ooh' | 'ovacion' | 'abucheo' | 'grito', fuerza)
     Sonido.ambiente(true/false)       // murmullo del coliseo
     Sonido.oyente = (pos) => [volumen, paneo]   // lo pone la arena según la cámara
   ===================================================================== */
(function (root) {
let ctx = null, master = null, sec = null, rev = null, ruido = null, ambienteNodo = null;
let mudo = false;
try { mudo = localStorage.getItem('coliseo_mudo') === '1'; } catch (e) { /* sin storage */ }
const rnd = (a, b) => a + Math.random() * (b - a);

function iniciar() {
  if (ctx) return ctx;
  const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  armarSalida();
  // ruido blanco reutilizable
  ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
// la cadena de salida (volumen general → compresor → parlantes, con el eco del coliseo). Se puede rearmar:
// si una sola muestra "rota" (NaN) entra al compresor o al eco, lo deja mudo para siempre; ahí se tira y se arma de nuevo
let comp = null, IR = null, oido = null, oidoBuf = null;
function armarSalida() {
  const viejos = [master, comp, rev, sec, oido];
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 9; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = mudo ? 0 : 0.8;
  master.connect(comp); comp.connect(ctx.destination);
  // eco del coliseo: respuesta al impulso inventada (ruido que se apaga)
  rev = ctx.createConvolver();
  if (!IR) { const n = ctx.sampleRate * 2.2; IR = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = IR.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2) * (i < ctx.sampleRate * 0.012 ? 0 : 1); } }
  rev.buffer = IR;
  sec = ctx.createGain(); sec.gain.value = 0.32; sec.connect(rev); rev.connect(master);
  oido = ctx.createAnalyser(); oido.fftSize = 256; comp.connect(oido); oidoBuf = new Float32Array(oido.fftSize);
  for (const v of viejos) if (v) try { v.disconnect(); } catch (e) { /* ya estaba */ }
  if (ambienteNodo) { try { ambienteNodo.out.disconnect(); } catch (e) { /* nada */ } ambienteNodo.out.connect(master); }
}
// el navegador solo deja sonar después de que el jugador toca algo
let tocado = false;
function desbloquear() { tocado = true; if (!iniciar()) return; if (ctx.state !== 'running') ctx.resume().catch(() => {}); }
// vigía: el celular a veces suspende el audio solo (otra app, pantalla, llamada) y no vuelve hasta tocar algo; además revisa que no haya entrado un NaN
setInterval(() => {
  if (!ctx || !tocado || document.hidden) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  if (oido) { oido.getFloatTimeDomainData(oidoBuf); for (let i = 0; i < oidoBuf.length; i++) if (!Number.isFinite(oidoBuf[i])) { armarSalida(); break; } }
}, 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && tocado && ctx.state !== 'running') ctx.resume().catch(() => {}); });
['pointerdown', 'keydown', 'touchstart'].forEach((ev) => root.addEventListener(ev, desbloquear, { passive: true, capture: true }));

// presupuesto de sonidos: si suenan demasiados juntos el audio se corta, así que los que sobran no suenan
const recientes = []; let ultMultitud = -9;
const listo = () => { if (!(ctx && ctx.state === 'running' && !mudo)) return false; const t = ctx.currentTime; while (recientes.length && recientes[0] < t - 0.3) recientes.shift(); return recientes.length < 8; };
// salida de un sonido: volumen + paneo + cuánto eco
function salida(vol = 1, pan = 0, eco = 0.35) {
  recientes.push(ctx.currentTime);
  if (!Number.isFinite(vol) || vol < 0) vol = 0; if (!Number.isFinite(pan)) pan = 0; if (!Number.isFinite(eco)) eco = 0;   // un número roto acá muteaba todo
  const g = ctx.createGain(); g.gain.value = vol;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); } else g.connect(master);
  if (eco > 0) { const e = ctx.createGain(); e.gain.value = eco; g.connect(e); e.connect(sec); }
  return g;
}
const donde = (pos) => (pos && S.oyente ? S.oyente(pos) : [1, 0]);
function env(param, t, a, pico, dec, fin = 0.0001) { if (!(pico > 0.0001) || !Number.isFinite(pico)) pico = 0.0001; if (!(a > 0)) a = 0.001; if (!(dec > 0)) dec = 0.01; param.cancelScheduledValues(t); param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(pico, t + a); param.exponentialRampToValueAtTime(fin, t + a + dec); }
function rafaga(dest, t, dur, tipo, f, q, vol, a = 0.002, f2 = null) {
  const s = ctx.createBufferSource(); s.buffer = ruido; s.playbackRate.value = rnd(0.8, 1.2);
  const fl = ctx.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  const g = ctx.createGain(); env(g.gain, t, a, vol, dur);
  s.connect(fl); fl.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
}
function tono(dest, t, tipo, f, f2, dur, vol, a = 0.002) {
  const o = ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g.gain, t, a, vol, dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
}

/* ---------- metal, madera, carne, hueso ---------- */
function metal(dest, t, fuerza, base = rnd(380, 620)) {
  // campana de metal: parciales inarmónicos que se apagan a distinto ritmo
  const parc = [1, 2.32, 4.11, 5.43, 6.79, 8.2];
  parc.forEach((k, i) => tono(dest, t, 'sine', base * k * rnd(0.98, 1.02), null, (0.9 - i * 0.12) * (0.5 + fuerza * 0.5), 0.16 / (1 + i * 0.6) * fuerza, 0.001));
  rafaga(dest, t, 0.05, 'highpass', 3200, 0.7, 0.35 * fuerza);   // raspón del filo
}
function madera(dest, t, fuerza) {
  tono(dest, t, 'triangle', rnd(150, 190), 90, 0.12, 0.45 * fuerza);
  rafaga(dest, t, 0.07, 'bandpass', rnd(700, 1000), 3, 0.5 * fuerza);
}
function carne(dest, t, fuerza, filo) {
  tono(dest, t, 'sine', rnd(95, 120), 45, 0.16, 0.7 * fuerza);                     // golpe sordo
  rafaga(dest, t, 0.09 + fuerza * 0.05, 'lowpass', 900, 1, 0.55 * fuerza);
  if (filo) { rafaga(dest, t, 0.11, 'bandpass', 2600, 1.5, 0.35 * fuerza, 0.002, 900); rafaga(dest, t + 0.03, 0.12, 'bandpass', 600, 4, 0.25 * fuerza); }   // tajo húmedo
}
function hueso(dest, t, fuerza) {
  for (let i = 0; i < 3; i++) rafaga(dest, t + i * rnd(0.008, 0.02), 0.025, 'highpass', 2200, 1.2, 0.6 * fuerza);
  tono(dest, t, 'square', 320, 120, 0.05, 0.12 * fuerza);
}
function zumbido(dest, t, pesado) {   // el arma cortando el aire
  rafaga(dest, t, pesado ? 0.32 : 0.2, 'bandpass', pesado ? 500 : 900, 2.5, pesado ? 0.7 : 0.5, 0.06, pesado ? 220 : 380);
}

/* ---------- voces: fuente glotal + formantes (vocales) ---------- */
const VOCAL = { a: [800, 1200, 2500], o: [500, 900, 2400], u: [350, 800, 2300], e: [550, 1750, 2500], ng: [300, 2200, 2800] };
const TONO_RAZA = { humano: 125, orco: 92, gigante: 66, goblin: 250, ghoul: 140, lobo: 120, loboT: 75 };
function voz(dest, t, f0, dur, vocal, vol, caida = 0.8, aspereza = 0.3) {
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * rnd(1.05, 1.2), t);
  o.frequency.linearRampToValueAtTime(f0, t + dur * 0.25);
  o.frequency.exponentialRampToValueAtTime(f0 * caida, t + dur);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = rnd(5, 7); vg.gain.value = f0 * 0.03; vib.connect(vg); vg.connect(o.frequency);
  const pre = ctx.createGain(); pre.gain.value = 0.5; o.connect(pre);
  // aire / ronquera
  const n = ctx.createBufferSource(); n.buffer = ruido; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1500; nf.Q.value = 0.6;
  const ng = ctx.createGain(); ng.gain.value = aspereza; n.connect(nf); nf.connect(ng); ng.connect(pre);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const F = VOCAL[vocal] || VOCAL.a, F2 = vocal === 'a' ? VOCAL.o : F;
  F.forEach((fr, i) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6 + i * 3;
    bp.frequency.setValueAtTime(fr * (f0 > 200 ? 1.15 : f0 < 80 ? 0.85 : 1), t); bp.frequency.linearRampToValueAtTime(F2[i] * (f0 > 200 ? 1.15 : 1), t + dur);
    const fg = ctx.createGain(); fg.gain.value = [1, 0.6, 0.25][i] * 2.2;
    pre.connect(bp); bp.connect(fg); fg.connect(g);
  });
  g.connect(dest);
  [o, vib, n].forEach((x) => { x.start(t); x.stop(t + dur + 0.05); });
}
function gruñidoLobo(dest, t, dur, vol) {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = rnd(60, 75);
  const am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = rnd(25, 32); ag.gain.value = 0.5; am.connect(ag);
  const g = ctx.createGain(); g.gain.value = 0; ag.connect(g.gain);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3;
  const out = ctx.createGain(); env(out.gain, t, 0.08, vol, dur);
  o.connect(g); g.connect(lp); lp.connect(out); out.connect(dest);
  rafaga(out, t, dur, 'bandpass', 400, 2, 0.6, 0.05);
  [o, am].forEach((x) => { x.start(t); x.stop(t + dur + 0.1); });
}
function aullido(dest, t, vol) {
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(330, t); o.frequency.linearRampToValueAtTime(620, t + 0.5); o.frequency.setValueAtTime(620, t + 1.3); o.frequency.exponentialRampToValueAtTime(420, t + 2.2);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5; vg.gain.value = 9; vib.connect(vg); vg.connect(o.frequency);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 4;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.35); g.gain.setValueAtTime(vol, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
  o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
  [o, vib].forEach((x) => { x.start(t); x.stop(t + 2.4); });
}
function sonajero(dest, t, n, vol) {   // huesos que tiemblan o se caen
  for (let i = 0; i < n; i++) { const tt = t + i * rnd(0.025, 0.07); rafaga(dest, tt, 0.02, 'bandpass', rnd(1800, 3200), 6, vol * rnd(0.5, 1)); tono(dest, tt, 'triangle', rnd(700, 1100), null, 0.03, vol * 0.25); }
}

/* ---------- público ---------- */
function multitud(t, vocal, voces, dur, vol, sube = 1, silbidos = 0) {
  if (t - ultMultitud < 0.7) return; ultMultitud = t; voces = Math.min(voces, 7);
  const dest = salida(vol, 0, 0.6);
  for (let i = 0; i < voces; i++) {
    const f0 = rnd(105, 260), tt = t + rnd(0, 0.25), d = dur * rnd(0.7, 1.15);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, tt); o.frequency.linearRampToValueAtTime(f0 * sube * rnd(0.95, 1.08), tt + d * 0.4); o.frequency.linearRampToValueAtTime(f0 * (sube > 1 ? 1 : 0.85), tt + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.12 + Math.random() * 0.15); g.gain.setValueAtTime(0.05, tt + d * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, tt + d);
    const F = VOCAL[vocal];
    for (let k = 0; k < 2; k++) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = F[k] * rnd(0.9, 1.1); bp.Q.value = 5; o.connect(bp); bp.connect(g); }
    g.connect(dest); o.start(tt); o.stop(tt + d + 0.05);
  }
  rafaga(dest, t, dur, 'bandpass', vocal === 'a' ? 1100 : 700, 0.8, 0.5, 0.15);   // el "rugido" de muchas gargantas
  for (let i = 0; i < silbidos; i++) { const tt = t + rnd(0.1, dur * 0.6), f = rnd(1800, 2600); tono(dest, tt, 'sine', f, f * rnd(1.1, 1.3), rnd(0.25, 0.5), 0.05, 0.03); }
}
function aplausos(t, dur, vol) {
  const dest = salida(vol, 0, 0.5);
  const n = Math.min(90, Math.round(dur * 45));
  for (let i = 0; i < n; i++) rafaga(dest, t + Math.random() * dur, 0.018, 'bandpass', rnd(900, 2400), 1.5, rnd(0.08, 0.2), 0.001);
}
function ambiente(on) {
  if (!iniciar()) return;
  if (on && !ambienteNodo) {
    // murmullo: ruido filtrado en varias bandas con volumen que ondula (miles de personas hablando)
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    const e = ctx.createGain(); e.gain.value = 0.5; out.connect(e); e.connect(sec);
    const nodos = [];
    [[300, 0.9], [550, 1.2], [900, 1.4], [1500, 1.6]].forEach(([f, q]) => {
      const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true; s.playbackRate.value = rnd(0.9, 1.1);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0.25;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rnd(0.15, 0.6); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(g.gain);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(); lfo.start(); nodos.push(s, lfo);
    });
    out.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 1.5);
    ambienteNodo = { out, nodos };
  } else if (!on && ambienteNodo) {
    const a = ambienteNodo; ambienteNodo = null;
    a.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    setTimeout(() => a.nodos.forEach((n) => { try { n.stop(); } catch (er) { /* ya parado */ } }), 1000);
  }
}

/* ---------- API ---------- */
let ultPaso = 0, ultVoz = 0, ultPublico = 0;
const S = {
  oyente: null,
  get mudo() { return mudo; },
  silenciar(v) { mudo = v; try { localStorage.setItem('coliseo_mudo', v ? '1' : '0'); } catch (e) { /* nada */ } if (master) master.gain.value = v ? 0 : 0.8; if (v) ambiente(false); },
  ambiente(on) { if (on && (mudo || S.sinPublico)) return; ambiente(on); },
  // un golpe entre dos gladiadores
  golpe(o) {
    if (!listo()) return;
    const [v, p] = donde(o), t = ctx.currentTime, d = salida(v, p, 0.3), f = Math.max(0.3, Math.min(1.4, o.fuerza || 0.7));
    const filo = ['gladius', 'lanza', 'daga', 'garras'].includes(o.arma), pesada = ['martillo', 'garrote'].includes(o.arma);
    if (o.res === 'aire') { zumbido(d, t, pesada); return; }
    if (o.res === 'esquive') { zumbido(d, t, pesada); rafaga(d, t + 0.05, 0.12, 'bandpass', 2400, 1, 0.2); return; }   // arena que se levanta al esquivar
    if (o.res === 'bloqueo') {
      if (o.escudo && o.escudo !== 'ninguno') { madera(d, t, f); metal(d, t, f * 0.6, rnd(250, 350)); }
      else metal(d, t, f);   // arma contra arma
      return;
    }
    if (o.armadura === 'pesada') metal(d, t, f * 0.7, rnd(300, 420));
    if (o.esqueleto) { hueso(d, t, f); sonajero(d, t + 0.03, 4, 0.3); return; }
    carne(d, t, f, filo && !pesada);
    if (pesada && f > 0.8) hueso(d, t + 0.01, f * 0.6);
  },
  hueso(pos) { if (!listo()) return; const [v, p] = donde(pos); const d = salida(v, p); hueso(d, ctx.currentTime, 1.3); },
  corte(pos) { if (!listo()) return; const [v, p] = donde(pos), t = ctx.currentTime, d = salida(v, p, 0.4); carne(d, t, 1.4, true); hueso(d, t + 0.02, 1); rafaga(d, t + 0.05, 0.4, 'lowpass', 500, 1, 0.4, 0.01); },
  zumbido(pos, pesado) { if (!listo()) return; const [v, p] = donde(pos); zumbido(salida(v * 0.7, p), ctx.currentTime, pesado); },
  // voces de los gladiadores
  voz(raza, tipo, pos) {
    if (!listo()) return;
    const ahora = ctx.currentTime; if (tipo !== 'muerte' && ahora - ultVoz < 0.12) return; ultVoz = ahora;
    const [v, p] = donde(pos), d = salida(v, p, 0.35), t = ahora + 0.02;
    if (raza === 'esqueleto') { sonajero(d, t, tipo === 'muerte' ? 14 : 5, 0.5); return; }
    if (raza === 'loboT') { gruñidoLobo(d, t, tipo === 'muerte' ? 1.2 : tipo === 'esfuerzo' ? 0.3 : 0.5, 0.9); return; }
    const f0 = (TONO_RAZA[raza] || 125) * rnd(0.9, 1.1), ronco = raza === 'ghoul' ? 0.9 : raza === 'orco' || raza === 'gigante' ? 0.5 : 0.3;
    if (tipo === 'esfuerzo') voz(d, t, f0 * 0.9, rnd(0.14, 0.22), 'ng', 0.6, 0.85, ronco + 0.3);
    else if (tipo === 'dolor') voz(d, t, f0 * 1.15, rnd(0.25, 0.42), Math.random() < 0.5 ? 'a' : 'e', 0.8, 0.7, ronco);
    else if (tipo === 'grito') voz(d, t, f0 * 1.5, rnd(0.6, 0.9), 'a', 0.95, 0.65, ronco);
    else if (tipo === 'muerte') voz(d, t, f0 * 1.05, rnd(0.9, 1.3), 'o', 0.9, 0.5, ronco + 0.2);
  },
  aullido(pos) { if (!listo()) return; const [v, p] = donde(pos); aullido(salida(v, p, 0.6), ctx.currentTime, 0.75); },
  huesos(pos, n = 10) { if (!listo()) return; const [v, p] = donde(pos); sonajero(salida(v, p), ctx.currentTime, n, 0.75); },
  masticar(pos) { if (!listo()) return; const [v, p] = donde(pos), d = salida(v, p), t = ctx.currentTime; for (let i = 0; i < 6; i++) { rafaga(d, t + i * 0.32, 0.12, 'lowpass', 700, 2, 0.4); rafaga(d, t + i * 0.32 + 0.05, 0.06, 'bandpass', 1800, 4, 0.2); } },
  // pisadas y caídas
  paso(pos, pesado) {
    if (!listo()) return;
    const ahora = ctx.currentTime; if (ahora - ultPaso < 0.045) return; ultPaso = ahora;
    const [v, p] = donde(pos); if (v < 0.12) return;
    const d = salida(v * (pesado ? 0.55 : 0.35), p, 0.1), t = ahora;
    rafaga(d, t, 0.05, 'bandpass', rnd(1400, 2400), 0.9, 0.35);   // crujido de arena
    tono(d, t, 'sine', pesado ? 70 : 110, 50, 0.06, pesado ? 0.5 : 0.25);
  },
  derribo(pos, pesado) {
    if (!listo()) return;
    const [v, p] = donde(pos), d = salida(v, p, 0.4), t = ctx.currentTime;
    tono(d, t, 'sine', pesado ? 55 : 75, 35, 0.35, 0.9);
    rafaga(d, t, 0.3, 'lowpass', 500, 1, 0.7);
    rafaga(d, t + 0.05, 0.5, 'highpass', 2500, 0.5, 0.12, 0.05);   // arena que salpica
  },
  // el público
  sinPublico: false,   // en la mazmorra no hay gradas llenas: ni murmullo ni aplausos
  publico(tipo, fuerza = 1) {
    if (!listo() || S.sinPublico) return;
    const ahora = ctx.currentTime; if (ahora - ultPublico < 0.7 && tipo !== 'ovacion') return; ultPublico = ahora;
    const t = ahora + 0.08, k = Math.min(1.6, fuerza) * 1.5;
    if (tipo === 'ooh') multitud(t, 'o', 14, 1.1, 0.35 * k, 1.04);
    else if (tipo === 'grito') multitud(t, 'a', 12, 0.8, 0.3 * k, 1.12, 1);
    else if (tipo === 'ovacion') { multitud(t, 'a', 20, 2.2, 0.42 * k, 1.18, 4); aplausos(t + 0.3, 2.4, 0.5 * k); }
    else if (tipo === 'abucheo') multitud(t, 'u', 16, 1.8, 0.35 * k, 0.92);
    else if (tipo === 'aplausos') aplausos(t, 1.6, 0.45 * k);
  },
  // voz de las charlas: un bip de 8 bits por letra (cada personaje con su tono)
  bip(tono, letra) {
    if (!listo() || !tono) return;
    const t = ctx.currentTime, d = salida(0.22, 0, 0), v = 'aeiouáéíóú'.includes((letra || '').toLowerCase()) ? 1.12 : 1;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(tono * v * rnd(0.94, 1.06), t);
    const g = ctx.createGain(); env(g.gain, t, 0.003, 0.18, 0.045); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.06);
  },
  // HUD y tablero
  boton() { if (!listo()) return; const t = ctx.currentTime, d = salida(0.35, 0, 0); tono(d, t, 'triangle', 1500, 900, 0.03, 0.3); rafaga(d, t, 0.012, 'highpass', 3000, 1, 0.25); },
  ficha() { if (!listo()) return; const t = ctx.currentTime, d = salida(0.5, 0, 0.15); madera(d, t, 0.7); tono(d, t + 0.01, 'sine', 620, 540, 0.08, 0.15); },
  telon() { if (!listo()) return; const t = ctx.currentTime, d = salida(0.4, 0, 0.25); rafaga(d, t, 0.75, 'lowpass', 900, 0.8, 0.35, 0.18, 350); rafaga(d, t + 0.05, 0.6, 'bandpass', 2200, 1.2, 0.12, 0.2, 1200); },   // el telón que corre
  salto() { if (!listo()) return; const t = ctx.currentTime, d = salida(0.25, 0, 0.1); rafaga(d, t, 0.18, 'bandpass', 600, 2, 0.2, 0.05, 1600); },
  moneda() { if (!listo()) return; const t = ctx.currentTime, d = salida(0.35, 0, 0.2); [2100, 3150, 4720].forEach((f, i) => tono(d, t + i * 0.002, 'sine', f, null, 0.25 - i * 0.05, 0.09)); tono(d, t + 0.07, 'sine', 2350, null, 0.2, 0.06); },
};
// todos los botones del juego hacen "clic"
root.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button, .btn, [data-sonido]'); if (b && !b.disabled) S.boton(); }, true);
// pausa todo el audio (cuando la app pasa a segundo plano en el celular)
S.pausa = (si) => { if (!ctx) return; try { si ? ctx.suspend() : ctx.resume(); } catch (e) {} };
root.Sonido = S;
})(window);
