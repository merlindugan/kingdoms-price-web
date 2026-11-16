/* Solo corre dentro de la app de Android (Capacitor). En el navegador no hace nada.
   - Botón "atrás" del celular: pregunta antes de salir (no te saca del juego de golpe).
   - Si la app pasa a segundo plano, se pausa el sonido. */
(function () {
  const Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  document.documentElement.classList.add('app');
  const App = Cap.Plugins && Cap.Plugins.App;
  if (!App) return;
  let caja = null;
  const cerrar = () => { if (caja) { caja.remove(); caja = null; } };
  const preguntar = () => {
    if (caja) return cerrar();
    caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font-family:var(--fB)';
    caja.innerHTML = '<div style="background:#1e1610;border:2px solid #c9a227;border-radius:12px;padding:18px 22px;color:#f1e6d3;text-align:center;min-width:240px">' +
      '<div style="font-size:18px;margin-bottom:14px">¿Salir del juego?</div>' +
      '<button id="apSi" style="margin:0 6px;padding:8px 18px;background:#8a2a1a;color:#fff;border:0;border-radius:8px;font:inherit">Salir</button>' +
      '<button id="apNo" style="margin:0 6px;padding:8px 18px;background:#3a2d20;color:#f1e6d3;border:1px solid #6a5640;border-radius:8px;font:inherit">Seguir jugando</button></div>';
    document.body.appendChild(caja);
    caja.querySelector('#apSi').onclick = () => App.exitApp();
    caja.querySelector('#apNo').onclick = cerrar;
    caja.onclick = (e) => { if (e.target === caja) cerrar(); };
  };
  App.addListener('backButton', preguntar);
  App.addListener('appStateChange', (st) => { if (window.Sonido && Sonido.pausa) Sonido.pausa(!st.isActive); if (window.Musica) Musica.pausa(!st.isActive); });
})();
