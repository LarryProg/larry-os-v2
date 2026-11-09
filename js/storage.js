// ─── LARRY OS v2 · ALMACENAMIENTO COMPARTIDO ─────────────────
// Carga antes que cualquier módulo. Define:
//  · LARRY_DATA_KEYS: la ÚNICA lista de claves que entran en backup y sync.
//  · todayLocal(): fecha de hoy en hora local (YYYY-MM-DD), no UTC.
//  · Protección contra datos corruptos y aviso si el almacenamiento se llena.
(function () {
  'use strict';

  window.LARRY_DATA_KEYS = [
    'larryOS_finanzas', 'larryCRM_v2', 'notas_rapidas_v1', 'agenda_v1',
    'larry:leads', 'larry:meta', 'larry:metaLeads', 'larry:networking',
    'myboard_v3', 'larry:recursosLinks',
    // Llamadas cargadas a mano y configuración del calendario (antes se perdían)
    'larryOS_pll_manual', 'larryOS_pll_sourceType', 'larryOS_pll_sheetUrl', 'larryOS_pll_icsUrl',
    // Nuevos en v2
    'larryOS_firma', 'larry:hoyHechos', 'larry:waTemplates', 'larryOS_fiscal'
  ];

  // Claves que guardan texto plano (no JSON)
  const PLAIN_KEYS = ['larryOS_pll_sourceType', 'larryOS_pll_sheetUrl', 'larryOS_pll_icsUrl', 'larryOS_firma'];
  window.LARRY_PLAIN_KEYS = PLAIN_KEYS;

  // ─── Fechas en hora local ───
  function pad(n) { return String(n).padStart(2, '0'); }
  window.toLocalISO = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  window.todayLocal = function () { return window.toLocalISO(new Date()); };

  // ─── Avisos que llegan antes de que exista el toast ───
  const pending = [];
  window.larryNotify = function (msg) {
    if (typeof window.showToast === 'function' && document.getElementById('toast')) window.showToast(msg);
    else pending.push(msg);
  };
  document.addEventListener('DOMContentLoaded', function () {
    pending.forEach(function (m, i) { setTimeout(function () { window.larryNotify(m); }, 600 + i * 3000); });
    pending.length = 0;
  });

  // ─── Datos corruptos: apartar el original en vez de pisarlo ───
  // Si una clave no se puede leer, se copia tal cual a "<clave>__corrupto_<fecha>"
  // y se quita, para que el módulo arranque limpio sin romperse ni borrar el original.
  window.LARRY_CORRUPT = [];
  LARRY_DATA_KEYS.forEach(function (k) {
    if (PLAIN_KEYS.indexOf(k) >= 0) return;
    let raw;
    try { raw = localStorage.getItem(k); } catch (e) { return; }
    if (raw === null || raw === '') return;
    try { JSON.parse(raw); }
    catch (e) {
      const bk = k + '__corrupto_' + new Date().toISOString().replace(/[:.]/g, '-');
      try { localStorage.setItem(bk, raw); localStorage.removeItem(k); } catch (_) {}
      window.LARRY_CORRUPT.push(k);
      console.error('Larry OS: dato corrupto en', k, '→ copia guardada en', bk);
    }
  });
  if (window.LARRY_CORRUPT.length) {
    window.larryNotify('⚠️ Datos ilegibles en: ' + window.LARRY_CORRUPT.join(', ') + '. Se guardó una copia; no se sincroniza hasta revisarlo.');
  }

  // ─── Interceptar escrituras: aviso de lleno + marcar cambios para el sync ───
  const proto = Storage.prototype;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  let lastQuotaWarn = 0;
  function markDirty(k) {
    if (LARRY_DATA_KEYS.indexOf(k) >= 0) {
      window.dispatchEvent(new CustomEvent('larry:dirty', { detail: { key: k } }));
    }
  }
  proto.setItem = function (k, v) {
    try {
      origSet.call(this, k, v);
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        if (Date.now() - lastQuotaWarn > 5000) {
          lastQuotaWarn = Date.now();
          window.larryNotify('⚠️ Almacenamiento lleno: NO se guardó el último cambio. Borrá imágenes de MyBoard o hacé backup.');
        }
      }
      throw e;
    }
    if (this === window.localStorage) markDirty(k);
  };
  proto.removeItem = function (k) {
    origRemove.call(this, k);
    if (this === window.localStorage) markDirty(k);
  };
  // Cambios hechos desde los iframes (MyBoard, Contratos) llegan como evento "storage"
  window.addEventListener('storage', function (e) { if (e.key) markDirty(e.key); });

  // Uso aproximado del almacenamiento (en caracteres ≈ bytes x2)
  window.larryStorageUsage = function () {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += k.length + (localStorage.getItem(k) || '').length;
    }
    return total; // caracteres; el límite típico es ~5.000.000
  };
})();
