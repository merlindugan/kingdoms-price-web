/* BOTÓN ACTUALIZAR (solo en la app de Android)
   La app se fija si en internet hay una versión más nueva del juego. Si hay, aparece un botón en el menú:
   baja solo los archivos que cambiaron, los guarda en el celular y reinicia. No se reinstala nada y la partida guardada queda. */
(function (root) {
  let WEB = 'https://merlindugan.github.io/kingdoms-price-web/';
  try { WEB = localStorage.getItem('kp_upd_web') || WEB; } catch (e) {}   // (para probar desde otra dirección)
  const esApp = () => !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform()) || (() => { try { return localStorage.getItem('kp_upd_forzar') === '1'; } catch (e) { return false; } })();
  const ahora = () => root.__kpActualizado || root.KP_BASE || 0;   // la versión que está corriendo
  let remota = null, buscando = null;
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const poner = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const sacar = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

  // llegó al menú: esta versión arranca bien
  function arranqueOk() { poner('kp_upd_ok', String(ahora())); }

  function buscar() {
    if (!esApp()) return Promise.resolve(null);
    if (buscando) return buscando;
    buscando = fetch(WEB + 'paquete.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((p) => {
      buscando = null;
      if (!p || !p.v || !p.archivos) return null;
      if (String(p.v) === leer('kp_upd_mala')) return null;   // esa versión ya falló una vez: no se ofrece
      remota = p.v > ahora() ? p : null;
      return remota;
    }).catch(() => { buscando = null; return null; });
    return buscando;
  }

  // el botoncito del menú: aparece solo si hay algo nuevo
  function boton() {
    const b = document.createElement('button');
    b.className = 'lay bactualizar'; b.hidden = true; b.innerHTML = '<span class="pto"></span>⬆ ACTUALIZAR';
    b.title = 'Hay una versión nueva del juego';
    b.onclick = aplicar;
    buscar().then((p) => { if (p && b.isConnected) b.hidden = false; });
    return b;
  }

  function aviso(txt, fin) {
    let m = document.getElementById('updModal');
    if (!m) { m = document.createElement('div'); m.id = 'updModal'; m.className = 'modal'; m.innerHTML = '<div class="box" style="text-align:center;max-width:340px"><b style="font:700 20px var(--fT);color:var(--gold)">Actualizando</b><p id="updTx" class="meta" style="margin:10px 0 4px"></p><div class="carga-bar" style="position:relative;left:0;bottom:0;transform:none;margin:10px auto 0;width:100%"><i id="updBar" style="animation:none;width:0%"></i></div></div>'; document.body.appendChild(m); }
    m.querySelector('#updTx').textContent = txt;
    if (fin != null) m.querySelector('#updBar').style.width = Math.round(fin * 100) + '%';
    return m;
  }

  async function aplicar() {
    const p = remota || (await buscar()); if (!p) return;
    aviso('Buscando qué cambió', 0.02);
    try {
      // lo que vino con la app (para bajar solo lo distinto)
      const base = await fetch('paquete.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { archivos: {} })).catch(() => ({ archivos: {} }));
      const texto = (n) => /\.(html|js|json|css)$/.test(n);
      const distintos = Object.keys(p.archivos).filter((n) => texto(n) && p.archivos[n] !== (base.archivos || {})[n]);
      if (!distintos.includes('index.html')) distintos.push('index.html');   // el índice siempre (trae el número de versión)
      const bajados = {};
      for (let i = 0; i < distintos.length; i++) {
        const n = distintos[i];
        aviso(`Bajando ${i + 1} de ${distintos.length}`, 0.05 + 0.85 * (i / distintos.length));
        const r = await fetch(WEB + n + '?v=' + p.v, { cache: 'no-store' }); if (!r.ok) throw new Error(n);
        bajados[n] = await r.text();
      }
      // se borra lo de la actualización anterior y se guarda lo nuevo
      const vieja = JSON.parse(leer('kp_upd_lista') || '[]'); for (const n of vieja) sacar('kp_upd_f_' + n);
      for (const n of distintos) if (!poner('kp_upd_f_' + n, bajados[n])) throw new Error('lugar');
      poner('kp_upd_lista', JSON.stringify(distintos)); poner('kp_upd_v', String(p.v)); sacar('kp_upd_probando');
      aviso('¡Listo! Reiniciando', 1);
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      aviso(e && e.message === 'lugar' ? 'No hay lugar en el celular para la actualización.' : 'No se pudo actualizar. Revisá la conexión y probá de nuevo.', 0);
      const m = document.getElementById('updModal'); setTimeout(() => m && m.remove(), 3200);
    }
  }
  root.Actualizar = { boton, buscar, aplicar, arranqueOk, esApp, get version() { return ahora(); } };
})(window);
