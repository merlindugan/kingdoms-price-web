// Traducción del juego. El juego está escrito en castellano; este archivo traduce lo que se ve en pantalla.
// Cómo: un diccionario "texto en castellano → texto en otro idioma" (I18N_EN, en i18n_en.js).
// Las frases con partes que cambian (nombres, números) tienen comodines {0}, {1}, {nombre}... y se reconocen como patrones.
// Un vigilante (MutationObserver) traduce cada texto que aparece en la página, y también los textos dibujados en canvas.
(function () {
  const IDIOMAS = ['es', 'en'];   // cuando esté el portugués: ['es', 'en', 'pt']
  const DIC = { en: () => window.I18N_EN };
  let LANG = 'es';
  try { LANG = localStorage.getItem('kp_lang') || ''; } catch (e) { LANG = ''; }
  if (!IDIOMAS.includes(LANG)) {
    const nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase();
    LANG = nav.startsWith('es') ? 'es' : nav.startsWith('pt') ? (IDIOMAS.includes('pt') ? 'pt' : 'es') : 'en';
  }

  let exacto = new Map(), patrones = [], cache = new Map();
  const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  function cargar() {
    exacto = new Map(); patrones = []; cache = new Map();
    const d = LANG !== 'es' && DIC[LANG] && DIC[LANG]();
    if (!d) return;
    for (const k in d) {
      exacto.set(k, d[k]);
      if (!/\{[\w{}#]*\}/.test(k)) continue;
      // los comodines: {0}, {nombre}, y {f{0}} (marcador de nombre de luchador del motor)
      const nombres = [];
      let re = '';
      const partes = k.split(/(\{[a-z]\{\d+\}\}|\{#\}|\{\w+\})/);
      for (const p of partes) {
        const mf = /^\{([a-z])\{(\d+)\}\}$/.exec(p), m = mf || /^\{(\w+)\}$/.exec(p);
        if (p === '{#}') { nombres.push('#'); re += '(\\d+)'; }
        else if (mf) { nombres.push(mf[1] + '{' + mf[2] + '}'); re += '\\{' + mf[1] + '(\\d+)\\}'; }
        else if (m) { nombres.push(m[1]); re += '([\\s\\S]*?)'; }
        else re += esc(p);
      }
      const literal = k.replace(/\{[a-z]\{\d+\}\}|\{#\}|\{\w+\}/g, '').length;
      if (literal < 2) continue;   // un patrón que es casi todo comodín traduciría cualquier cosa
      patrones.push({ re: new RegExp('^' + re + '$'), nombres, sal: d[k], literal });
    }
    patrones.sort((a, b) => b.literal - a.literal);   // los más específicos primero
  }

  // traduce un texto (sin espacios de borde); devuelve null si no lo conoce
  function trad(s, prof) {
    if (exacto.has(s)) return exacto.get(s);
    if (cache.has(s)) return cache.get(s);
    let r = null;
    if ((prof || 0) < 3 && /[A-Za-zÁÉÍÓÚáéíóúñÑ¡¿]/.test(s)) {
      for (const p of patrones) {
        const m = p.re.exec(s); if (!m) continue;
        const val = {};
        p.nombres.forEach((n, i) => {
          const v = m[i + 1];
          if (/^[a-z]\{/.test(n)) { val[n] = '{' + n[0] + v + '}'; return; }
          const vt = v.trim(), t = vt ? trad(vt, (prof || 0) + 1) : null;
          val[n] = t != null ? v.replace(vt, t) : v;
        });
        r = p.sal.replace(/\{[a-z]\{\d+\}\}|\{#\}|\{\w+\}/g, (x) => { const n = x.slice(1, -1); return n in val ? val[n] : x; });
        break;
      }
    }
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
    return r;
  }
  // prueba el texto entero y, si no lo conoce, lo parte en pedazos que el juego pegó (emoji + texto, "a · b", varias oraciones)
  function armar(n, prof) {
    if (exacto.has(n)) return exacto.get(n);
    let m0 = /^([^\p{L}\p{N}¡¿«"(\[{]+)([\s\S]+)$/u.exec(n);
    if (m0 && exacto.has(m0[2])) return m0[1] + exacto.get(m0[2]);
    let t = trad(n); if (t != null) return t;
    if (/^\d+ de \d+$/.test(n)) return n.replace(' de ', ' of ');
    if (/^de \d+$/.test(n)) return n.replace('de ', 'of ');
    if (prof > 2) return null;
    if (/^[¡¿]/.test(n)) { t = armar(n.slice(1), prof + 1); if (t != null) return t; }
    let m = /^([^\p{L}\p{N}¡¿«"(\[{]+)([\s\S]+)$/u.exec(n);          // 🛡 elegir a quién
    if (m) { t = armar(m[2], prof + 1); if (t != null) return m[1] + t; }
    m = /^([\s\S]*?)(\s*·)$/.exec(n);                                 // "texto ·" (sigue en otra etiqueta)
    if (m && m[1]) { t = armar(m[1], prof + 1); if (t != null) return t + m[2]; }
    m = /^(·\s*)([\s\S]+)$/.exec(n);
    if (m) { t = armar(m[2], prof + 1); if (t != null) return m[1] + t; }
    m = /^([\s\S]*?)([.:!?,;…]+)$/.exec(n);                           // texto + puntuación suelta
    if (m && m[1]) { t = armar(m[1], prof + 1); if (t != null) return t + m[2]; }
    seps: for (const sep of [' · ', '. ', ': ']) {
      if (!n.includes(sep)) continue;
      const ps = n.split(sep), out = [];
      let alguna = false;
      for (const p of ps) {
        const q = sep === '. ' && p !== ps[ps.length - 1] ? p + '.' : p;
        const r = trad(q) ?? (q.trim() ? armar(q, prof + 1) : null);
        if (r != null) { alguna = true; out.push(sep === '. ' && p !== ps[ps.length - 1] ? r.replace(/\.$/, '') : r); }
        else if (/^[\p{N}\s%+\-—]*$/u.test(p) || !/[a-záéíóúñ]{3}/i.test(p)) out.push(p);   // números y nombres cortos pasan
        else continue seps;
      }
      if (alguna) return out.join(sep);
    }
    return null;
  }
  // traducción conservando espacios de borde
  function T(s) {
    if (LANG === 'es' || s == null) return s;
    s = String(s);
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const n = norm(m[2]);
    if (!n) return s;
    if (n === '¡' || n === '¿') return '';   // en inglés no se abren signos
    let t = armar(n, 0);
    if (t == null && /\n/.test(m[2])) {   // texto escrito en varias líneas en el código: cada línea es una frase aparte
      const ls = m[2].split(/\s*\n\s*/).map((x) => norm(x)).filter(Boolean), out = ls.map((x) => armar(x, 1));
      if (out.some((x) => x != null)) t = out.map((x, i) => x ?? ls[i]).join(' ');
    }
    if (t == null) return s;
    return m[1] + t + m[3];
  }

  // ---------- vigilante del DOM ----------
  const ORIG = new WeakMap();          // nodo de texto → texto original en castellano
  const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
  const ORIG_A = new WeakMap();        // elemento → {atributo: original}
  const SALTEAR = (el) => el && el.closest && el.closest('script,style,textarea,[data-noi18n]');
  let ocupado = false;
  function nodoTexto(n) {
    const p = n.parentElement; if (!p || SALTEAR(p)) return;
    const ahora = n.nodeValue;
    let o = ORIG.get(n);
    // si el juego cambió el texto por su cuenta, el original nuevo es lo que puso el juego
    if (o === undefined || (o.t !== ahora && o.tr !== ahora)) o = { t: ahora, tr: null };
    const tr = LANG === 'es' ? o.t : T(o.t);
    o.tr = tr; ORIG.set(n, o);
    if (tr !== ahora) n.nodeValue = tr;
  }
  function elemento(el) {
    if (el.nodeType !== 1 || SALTEAR(el)) return;
    for (const a of ATTR) {
      if (!el.hasAttribute(a)) continue;
      const ahora = el.getAttribute(a);
      let mp = ORIG_A.get(el); if (!mp) { mp = {}; ORIG_A.set(el, mp); }
      let o = mp[a]; if (!o || (o.t !== ahora && o.tr !== ahora)) o = { t: ahora, tr: null };
      const tr = LANG === 'es' ? o.t : T(o.t);
      o.tr = tr; mp[a] = o;
      if (tr !== ahora) el.setAttribute(a, tr);
    }
  }
  function arbol(raiz) {
    if (raiz.nodeType === 3) return nodoTexto(raiz);
    if (raiz.nodeType !== 1 || SALTEAR(raiz)) return;
    elemento(raiz);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) nodoTexto(n); else elemento(n); }
  }
  const obs = new MutationObserver((lista) => {
    if (ocupado) return; ocupado = true;
    try {
      for (const m of lista) {
        if (m.type === 'childList') m.addedNodes.forEach(arbol);
        else if (m.type === 'characterData') nodoTexto(m.target);
        else if (m.type === 'attributes') elemento(m.target);
      }
    } finally { obs.takeRecords(); ocupado = false; }
  });
  function arrancar() {
    cargar();
    document.documentElement.lang = LANG;
    arbol(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }

  // ---------- textos dibujados en canvas (carteles flotantes, mapa) ----------
  const C = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText', 'measureText']) {
    const orig = C[fn];
    C[fn] = function (txt, ...r) { return orig.call(this, LANG === 'es' || typeof txt !== 'string' ? txt : T(txt), ...r); };
  }

  // ---------- banderita para cambiar de idioma ----------
  const BANDERA = {
    es: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#74acdf"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><circle cx="15" cy="10" r="2.4" fill="#f6b40e" stroke="#85340a" stroke-width=".4"/></svg>',
    en: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#b22234"/>' + [1, 3, 5, 7, 9, 11].map((i) => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13}" fill="#fff"/>`).join('') + '<rect width="13" height="10.77" fill="#3c3b6e"/>' + [[2, 2], [5, 2], [8, 2], [11, 2], [3.5, 4.2], [6.5, 4.2], [9.5, 4.2], [2, 6.4], [5, 6.4], [8, 6.4], [11, 6.4], [3.5, 8.6], [6.5, 8.6], [9.5, 8.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".55" fill="#fff"/>`).join('') + '</svg>',
    pt: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5 27 10 15 17.5 3 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/><path d="M11 9.2q4-1.3 8 .9" stroke="#fff" stroke-width=".6" fill="none"/></svg>',
  };
  function bandera() {
    const b = document.createElement('button');
    b.className = 'lay bidioma'; b.setAttribute('data-noi18n', '');
    b.title = b.ariaLabel = { es: 'Idioma: Español', en: 'Language: English', pt: 'Idioma: Português' }[LANG];
    b.innerHTML = BANDERA[LANG];
    const pintar = () => { b.innerHTML = BANDERA[LANG]; b.title = b.ariaLabel = { es: 'Idioma: Español', en: 'Language: English', pt: 'Idioma: Português' }[LANG]; };
    b.onclick = () => { cambiar(IDIOMAS[(IDIOMAS.indexOf(LANG) + 1) % IDIOMAS.length]); pintar(); };   // la bandera cambia en el momento
    return b;
  }
  function cambiar(l) {
    LANG = l; try { localStorage.setItem('kp_lang', l); } catch (e) {}
    cargar(); document.documentElement.lang = l;
    obs.disconnect(); arbol(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }

  window.I18N = { get lang() { return LANG; }, T, cambiar, bandera, idiomas: IDIOMAS, _trad: trad };
  window.T = T;
  if (document.body) arrancar(); else document.addEventListener('DOMContentLoaded', arrancar);
})();
