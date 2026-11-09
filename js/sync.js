// ═══════════════════════════════════════════════════════════════
// LARRY OS v2 · GITHUB SYNC
// localStorage es la fuente principal; GitHub es el espejo.
// Cambios respecto a v1:
//  · Antes de subir, mira GitHub. Si otro dispositivo cambió algo, lo baja.
//  · Combina por módulo: si un módulo cambió solo en un lado, gana ese lado.
//    Si cambió en los dos, pregunta cuál conservar. Nunca pisa a ciegas.
//  · Lee archivos de más de 1 MB (API de blobs) y sube sin sangría.
//  · Sube cuando algo se guarda (sin re-leer todo cada 4 s).
//  · Usa su propio archivo (larry-os-v2-data.json) para no chocar con la v1.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const CFG_KEY    = 'larryOS2_syncConfig';
  const BASE_KEY   = 'larryOS2_syncBase';   // { sha, hashes:{clave:hash}, time }
  const V1_CFG_KEY = 'larryOS_syncConfig';
  const DEFAULT_PATH = 'larry-os-v2-data.json';
  const V1_PATH      = 'larry-os-data.json';
  const PUSH_DELAY_MS   = 5000;    // espera tras el último cambio
  const FALLBACK_POLL   = 60000;   // revisión de seguridad
  const FOCUS_CHECK_MIN = 30000;   // al volver a la pestaña, como mucho cada 30 s
  const AGO_TICK_MS     = 30000;

  const KEYS  = window.LARRY_DATA_KEYS;
  const LABEL = {
    'larryOS_finanzas': 'Finanzas', 'larryCRM_v2': 'Clientes (producción)', 'notas_rapidas_v1': 'Notas',
    'agenda_v1': 'Agenda', 'larry:leads': 'CRM · Pipeline', 'larry:meta': 'CRM · Meta Ads',
    'larry:metaLeads': 'CRM · Leads de Meta', 'larry:networking': 'CRM · Networking', 'myboard_v3': 'MyBoard',
    'larry:recursosLinks': 'Recursos', 'larryOS_pll_manual': 'Llamadas manuales',
    'larryOS_pll_sourceType': 'Calendario (tipo)', 'larryOS_pll_sheetUrl': 'Calendario (Sheet)',
    'larryOS_pll_icsUrl': 'Calendario (ICS)', 'larryOS_firma': 'Firma de contratos', 'larry:hoyHechos': 'Hoy (tareas hechas)', 'larry:waTemplates': 'Plantillas WhatsApp', 'larryOS_fiscal': 'Datos fiscales'
  };
  const NONE = '∅';

  let status = 'unconfigured', lastError = null;
  let pushT = null, inFlight = false, applying = false, lastFocusCheck = 0, conflictOpen = false;
  let lastLocalHash = null;

  const $ = id => document.getElementById(id);
  const toast = m => { if (typeof showToast === 'function') showToast(m); };

  // ─── Config ───
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (c) return c;
      // Primera vez en v2: reutilizar usuario/repo/token de la v1, pero con archivo propio
      const v1 = JSON.parse(localStorage.getItem(V1_CFG_KEY) || 'null');
      if (v1 && v1.token) return Object.assign({}, v1, { path: DEFAULT_PATH, _fromV1: true });
    } catch (_) {}
    return null;
  }
  function saveCfg(c) { delete c._fromV1; localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
  function configured() { const c = loadCfg(); return !!(c && c.token && !c._fromV1); }
  function loadBase() { try { return JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch (_) { return null; } }
  function saveBase(b) { localStorage.setItem(BASE_KEY, JSON.stringify(b)); }

  // ─── Snapshot ───
  function readKey(k) {
    const raw = localStorage.getItem(k);
    if (raw === null) return undefined;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }
  function writeKey(k, v) {
    if (v === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  function localData() {
    const d = {};
    KEYS.forEach(k => { const v = readKey(k); if (v !== undefined) d[k] = v; });
    return d;
  }
  function quickHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16) + ':' + s.length;
  }
  function hashes(data) {
    const h = {};
    KEYS.forEach(k => { h[k] = data[k] === undefined ? NONE : quickHash(JSON.stringify(data[k])); });
    return h;
  }
  function sameHashes(a, b) { return KEYS.every(k => (a[k] || NONE) === (b[k] || NONE)); }
  function makeSnap(data) { return { _version: 3, _date: new Date().toISOString(), _app: 'LarryOS', data }; }

  // ─── GitHub API ───
  function ghHeaders(token) {
    return { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }
  function repoUrl(cfg) {
    return 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo);
  }
  function b64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  // Devuelve { sha, snap } o null si el archivo no existe
  async function fetchRemote(cfg, path) {
    const url = repoUrl(cfg) + '/contents/' + (path || cfg.path) + '?ref=' + encodeURIComponent(cfg.branch || 'main');
    const r = await fetch(url, { headers: ghHeaders(cfg.token), cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('GET ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const meta = await r.json();
    let b64 = meta.content || '';
    if (!b64 || meta.encoding === 'none') {
      // Archivo de más de 1 MB: la API de contenidos no trae el contenido → usar blobs
      const br = await fetch(repoUrl(cfg) + '/git/blobs/' + meta.sha, { headers: ghHeaders(cfg.token), cache: 'no-store' });
      if (!br.ok) throw new Error('BLOB ' + br.status);
      b64 = (await br.json()).content || '';
    }
    const txt = b64 ? b64ToUtf8(b64) : '';
    if (!txt.trim()) return { sha: meta.sha, snap: null };
    let snap;
    try { snap = JSON.parse(txt); } catch (_) { throw new Error('El archivo de GitHub no es JSON válido'); }
    if (!snap || snap._app !== 'LarryOS' || !snap.data) throw new Error('El archivo de GitHub no es de Larry OS');
    return { sha: meta.sha, snap };
  }

  async function putRemote(cfg, data, sha) {
    const body = {
      message: 'Larry OS v2 sync · ' + new Date().toISOString(),
      content: utf8ToB64(JSON.stringify(makeSnap(data))),
      branch: cfg.branch || 'main'
    };
    if (sha) body.sha = sha;
    const r = await fetch(repoUrl(cfg) + '/contents/' + cfg.path, {
      method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders(cfg.token)), body: JSON.stringify(body)
    });
    if (r.status === 409 || r.status === 422) { const e = new Error('CONFLICT'); e.conflict = true; throw e; }
    if (!r.ok) throw new Error('PUT ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return (await r.json()).content.sha;
  }

  // ─── Indicador ───
  function setStatus(s, err) { status = s; lastError = err || null; renderIndicator(); }
  function humanAgo(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'hace ' + s + 's';
    const m = Math.floor(s / 60); if (m < 60) return 'hace ' + m + 'm';
    const h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + 'h';
    return 'hace ' + Math.floor(h / 24) + 'd';
  }
  function renderIndicator() {
    const dot = document.querySelector('#lsync-status .lsync-dot');
    const txt = document.querySelector('#lsync-status .lsync-text');
    if (!dot || !txt) return;
    if (!configured()) { dot.className = 'lsync-dot lsync-unconfigured'; txt.textContent = 'No configurado'; return; }
    if (!navigator.onLine) { dot.className = 'lsync-dot lsync-offline'; txt.textContent = 'Sin conexión'; return; }
    const b = loadBase();
    const ago = b && b.time ? humanAgo(Date.now() - b.time) : 'nunca';
    const map = {
      ok: ['lsync-dot lsync-ok', 'Sincronizado · ' + ago],
      pending: ['lsync-dot lsync-syncing', 'Cambios sin subir…'],
      syncing: ['lsync-dot lsync-syncing', 'Sincronizando…'],
      conflict: ['lsync-dot lsync-error', 'Conflicto · elegí qué conservar'],
      error: ['lsync-dot lsync-error', 'Error · click para reintentar'],
      offline: ['lsync-dot lsync-offline', 'Sin conexión']
    };
    const [cls, label] = map[status] || map.ok;
    dot.className = cls; txt.textContent = label;
    $('lsync-status').title = (lastError ? 'Error: ' + lastError + '\n' : '') + 'Click para sincronizar ahora · ⚙ para configurar';
  }

  // ─── Juntar dos versiones (listas de registros con id) ───
  // Devuelve null si no se pueden juntar automáticamente.
  function isIdList(a) { return Array.isArray(a) && a.length > 0 && a.every(x => x && typeof x === 'object' && x.id !== undefined); }
  function unionById(local, remote) {
    const seen = new Set(local.map(x => String(x.id)));
    return local.concat(remote.filter(x => !seen.has(String(x.id))));
  }
  function mergeValues(local, remote) {
    if (isIdList(local) && isIdList(remote)) return unionById(local, remote);
    if (local && remote && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local) && !Array.isArray(remote)) {
      const out = Object.assign({}, remote, local);
      let merged = false;
      Object.keys(local).forEach(k => {
        if (isIdList(local[k]) && isIdList(remote[k])) { out[k] = unionById(local[k], remote[k]); merged = true; }
      });
      return merged ? out : null;
    }
    return null;
  }

  // ─── Conflictos: elegir por módulo ───
  function askConflicts(keys, remoteDate, canMerge) {
    return new Promise(resolve => {
      conflictOpen = true; setStatus('conflict');
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
      const when = remoteDate ? new Date(remoteDate).toLocaleString('es-ES') : 'desconocida';
      ov.innerHTML =
        '<div style="background:#fff;color:#111;border-radius:14px;max-width:460px;width:100%;padding:22px;font-family:DM Sans,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
        '<div style="font-weight:700;font-size:16px;margin-bottom:6px">Estos módulos cambiaron en los dos lados</div>' +
        '<div style="font-size:12px;color:#555;margin-bottom:14px">Otro dispositivo subió cambios (' + when + ') y acá también editaste. Elegí qué versión conservar en cada uno. Lo demás ya se combinó solo.</div>' +
        keys.map(k =>
          '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #eee">' +
          '<div style="flex:1;font-size:13px;font-weight:600">' + (LABEL[k] || k) + '</div>' +
          (canMerge[k] ? '<label style="font-size:12px;cursor:pointer"><input type="radio" name="lc_' + k + '" value="merge" checked> Juntar los dos</label>' : '') +
          '<label style="font-size:12px;cursor:pointer"><input type="radio" name="lc_' + k + '" value="local"' + (canMerge[k] ? '' : ' checked') + '> Este dispositivo</label>' +
          '<label style="font-size:12px;cursor:pointer"><input type="radio" name="lc_' + k + '" value="remote"> GitHub</label></div>'
        ).join('') +
        '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button id="lc-ok" style="background:#111;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer">Aplicar</button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector('#lc-ok').onclick = () => {
        const pick = {};
        keys.forEach(k => { pick[k] = ov.querySelector('input[name="lc_' + k + '"]:checked').value; });
        ov.remove(); conflictOpen = false; resolve(pick);
      };
    });
  }

  // ─── Reconciliar con GitHub ───
  // Baja lo que cambió en otro dispositivo, combina por módulo y sube si hace falta.
  async function reconcile(reason) {
    if (!configured() || inFlight || conflictOpen) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    const cfg = loadCfg();
    inFlight = true; setStatus('syncing');
    let needReload = false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const base = loadBase();
        const local = localData();
        const lh = hashes(local);
        let remote = await fetchRemote(cfg);

        // Primera vez sin archivo v2: ofrecer importar el de la v1 si acá no hay nada
        if (!remote && cfg.path !== V1_PATH && Object.keys(local).length === 0) {
          const legacy = await fetchRemote(cfg, V1_PATH).catch(() => null);
          if (legacy && legacy.snap) {
            Object.entries(legacy.snap.data).forEach(([k, v]) => { if (KEYS.indexOf(k) >= 0) writeKey(k, v); });
            toast('✓ Datos importados de la versión anterior');
            needReload = true;
            remote = null; // se sube como archivo nuevo de la v2 abajo
          }
        }

        if (!remote || !remote.snap) {
          // No hay archivo (o está vacío): subir lo local
          const data = localData();
          if (Object.keys(data).length === 0) { setStatus('ok'); return; }
          const sha = await putRemote(cfg, data, remote ? remote.sha : undefined);
          saveBase({ sha, hashes: hashes(data), time: Date.now() });
          lastLocalHash = JSON.stringify(hashes(data));
          setStatus('ok');
          return;
        }

        const rd = remote.snap.data;
        const rh = hashes(rd);
        const remoteChanged = !base || base.sha !== remote.sha;
        const corrupt = window.LARRY_CORRUPT || [];

        if (!remoteChanged && !corrupt.length) {
          // GitHub no cambió: subir solo si hay cambios locales
          if (sameHashes(lh, base.hashes)) { setStatus('ok'); return; }
          if (Object.keys(local).length === 0) {
            setStatus('error', 'Datos locales vacíos: no se sube por seguridad. Usá "Descargar de GitHub".');
            toast('⚠️ Datos locales vacíos · no se subió nada');
            return;
          }
          try {
            const sha = await putRemote(cfg, local, base.sha);
            saveBase({ sha, hashes: lh, time: Date.now() });
            lastLocalHash = JSON.stringify(lh);
            setStatus('ok');
            if (reason === 'manual') toast('✓ Sincronizado con GitHub');
            return;
          } catch (e) {
            if (e.conflict) continue; // alguien subió justo antes: volver a combinar
            throw e;
          }
        }

        // GitHub cambió (u otro caso): combinar por módulo
        const bh = base ? base.hashes : null;
        const localEmpty = Object.keys(local).length === 0;
        const takeRemote = [], conflicts = [];
        let localWins = false;
        KEYS.forEach(k => {
          if (lh[k] === rh[k]) return;
          if (corrupt.indexOf(k) >= 0 || localEmpty) { takeRemote.push(k); return; }
          if (rh[k] === NONE) { localWins = true; return; }            // solo existe acá
          if (lh[k] === NONE) { takeRemote.push(k); return; }          // solo existe en GitHub
          if (bh && lh[k] === bh[k]) { takeRemote.push(k); return; }   // cambió solo en GitHub
          if (bh && rh[k] === bh[k]) { localWins = true; return; }     // cambió solo acá
          conflicts.push(k);                                           // cambió en los dos
        });

        if (conflicts.length) {
          inFlight = false;
          const mergedVals = {}, canMerge = {};
          conflicts.forEach(k => { const m = mergeValues(local[k], rd[k]); if (m) { mergedVals[k] = m; canMerge[k] = true; } });
          const pick = await askConflicts(conflicts, remote.snap._date, canMerge);
          inFlight = true; setStatus('syncing');
          conflicts.forEach(k => {
            if (pick[k] === 'remote') takeRemote.push(k);
            else if (pick[k] === 'merge') { applying = true; writeKey(k, mergedVals[k]); applying = false; localWins = true; needReload = true; }
            else localWins = true;
          });
        }

        if (takeRemote.length) {
          applying = true;
          takeRemote.forEach(k => writeKey(k, rd[k]));
          applying = false;
          needReload = true;
        }
        window.LARRY_CORRUPT = [];

        const merged = localData();
        const mh = hashes(merged);
        if (localWins && !sameHashes(mh, rh)) {
          try {
            const sha = await putRemote(cfg, merged, remote.sha);
            saveBase({ sha, hashes: mh, time: Date.now() });
          } catch (e) { if (e.conflict) continue; throw e; }
        } else {
          saveBase({ sha: remote.sha, hashes: rh, time: Date.now() });
        }
        lastLocalHash = JSON.stringify(mh);
        setStatus('ok');
        if (takeRemote.length) toast('✓ Cambios de otro dispositivo: ' + takeRemote.map(k => LABEL[k] || k).join(', '));
        return;
      }
      throw new Error('GitHub cambió varias veces seguidas; reintentá en un momento');
    } catch (e) {
      console.warn('LarrySync:', e);
      setStatus('error', e.message);
      if (reason === 'manual' || reason === 'setup') toast('⚠️ Error al sincronizar · ' + e.message);
    } finally {
      inFlight = false;
      if (needReload) { toast('↻ Actualizando con los datos combinados…'); setTimeout(() => location.reload(), 1400); }
    }
  }

  function schedulePush() {
    if (!configured() || applying) return;
    setStatus('pending');
    clearTimeout(pushT);
    pushT = setTimeout(() => reconcile('change'), PUSH_DELAY_MS);
  }

  // ─── Descargar todo de GitHub (reemplaza lo local) ───
  async function pullNow() {
    const cfg = loadCfg();
    if (!cfg || !cfg.token) { setStatus('unconfigured'); return; }
    try {
      setStatus('syncing');
      const remote = await fetchRemote(cfg);
      if (!remote || !remote.snap) { setStatus('ok'); toast('ℹ Aún no hay datos en GitHub'); return; }
      const dateStr = remote.snap._date ? new Date(remote.snap._date).toLocaleString('es-ES') : 'desconocido';
      setStatus('ok');
      customConfirm('¿Reemplazar TODOS los datos de este dispositivo con los de GitHub?\n\nÚltima subida: ' + dateStr +
        '\n\nNormalmente no hace falta: la sincronización ya combina los cambios sola.', () => {
        applying = true;
        KEYS.forEach(k => writeKey(k, remote.snap.data[k]));
        applying = false;
        saveBase({ sha: remote.sha, hashes: hashes(remote.snap.data), time: Date.now() });
        toast('✓ Datos descargados · Recargando…');
        setTimeout(() => location.reload(), 1000);
      }, 'Reemplazar');
    } catch (e) { setStatus('error', e.message); toast('⚠️ Error al descargar de GitHub'); }
  }

  // ─── Modal de configuración ───
  function openModal() {
    const cfg = loadCfg() || {};
    $('lsync-token').value = cfg.token || '';
    $('lsync-owner').value = cfg.owner || '';
    $('lsync-repo').value = cfg.repo || '';
    $('lsync-path').value = cfg.path || DEFAULT_PATH;
    $('lsync-branch').value = cfg.branch || 'main';
    $('lsync-status-line').className = 'lsync-status-line';
    $('lsync-status-line').textContent = cfg._fromV1 ? 'Datos tomados de la v1. Revisalos y tocá "Guardar y sincronizar".' : '';
    if (cfg._fromV1) $('lsync-status-line').className = 'lsync-status-line show';
    $('lsync-modal').classList.add('show');
  }
  function closeModal() { $('lsync-modal').classList.remove('show'); }
  function readForm() {
    return {
      token: $('lsync-token').value.trim(), owner: $('lsync-owner').value.trim(), repo: $('lsync-repo').value.trim(),
      path: $('lsync-path').value.trim() || DEFAULT_PATH, branch: $('lsync-branch').value.trim() || 'main'
    };
  }
  function setModalStatus(msg, kind) {
    const el = $('lsync-status-line');
    el.textContent = msg; el.className = 'lsync-status-line show' + (kind ? ' ' + kind : '');
  }
  function tokenWarning(t) {
    return /^ghp_/.test(t) ? ' ⚠️ Es un token clásico (ghp_): da acceso a TODOS tus repos. Mejor uno fine-grained.' : '';
  }
  async function testConnection() {
    const cfg = readForm();
    if (!cfg.token || !cfg.owner || !cfg.repo) return setModalStatus('Completá token, usuario y repo primero.', 'err');
    setModalStatus('Probando conexión…');
    try {
      const r = await fetch(repoUrl(cfg), { headers: ghHeaders(cfg.token) });
      if (r.status === 401) return setModalStatus('Token inválido o expirado.', 'err');
      if (r.status === 404) return setModalStatus('Repo no encontrado o el token no tiene acceso.', 'err');
      if (!r.ok) return setModalStatus('Error ' + r.status + ' al conectar.', 'err');
      const d = await r.json();
      setModalStatus('✓ Conexión OK · ' + d.full_name + (d.private ? ' (privado)' : ' (PÚBLICO ⚠️ tus datos quedarían a la vista)') + tokenWarning(cfg.token), d.private ? 'ok' : 'err');
    } catch (e) { setModalStatus('Error de red: ' + e.message, 'err'); }
  }
  async function saveConfigFromForm() {
    const cfg = readForm();
    if (!cfg.token || !cfg.owner || !cfg.repo) return setModalStatus('Completá token, usuario y repo.', 'err');
    const prev = loadCfg();
    saveCfg(cfg);
    if (!prev || prev.path !== cfg.path || prev.repo !== cfg.repo || prev.owner !== cfg.owner) localStorage.removeItem(BASE_KEY);
    setModalStatus('Sincronizando…' + tokenWarning(cfg.token), 'ok');
    await reconcile('setup');
    if (status === 'ok') { setModalStatus('✓ Listo. Los cambios se suben solos y se combinan entre dispositivos.', 'ok'); setTimeout(closeModal, 1500); }
    else if (status === 'error') setModalStatus('Error: ' + lastError, 'err');
  }
  function clearConfigConfirm() {
    customConfirm('¿Eliminar la configuración de GitHub Sync? Tus datos locales no se borran.', () => {
      localStorage.removeItem(CFG_KEY); localStorage.removeItem(BASE_KEY);
      setStatus('unconfigured'); closeModal(); toast('✓ Configuración eliminada');
    }, 'Eliminar');
  }

  // ─── Arranque ───
  function init() {
    renderIndicator();
    window.addEventListener('larry:dirty', schedulePush);
    window.addEventListener('online', () => { renderIndicator(); reconcile('online'); });
    window.addEventListener('offline', () => setStatus('offline'));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFocusCheck > FOCUS_CHECK_MIN) {
        lastFocusCheck = Date.now(); reconcile('focus');
      }
    });
    // Revisión de seguridad por si algún cambio no disparó el evento
    setInterval(() => {
      if (!configured() || inFlight) return;
      const h = JSON.stringify(hashes(localData()));
      if (lastLocalHash !== null && h !== lastLocalHash) schedulePush();
      lastLocalHash = h;
    }, FALLBACK_POLL);
    setInterval(renderIndicator, AGO_TICK_MS);
    $('lsync-modal').addEventListener('click', e => { if (e.target.id === 'lsync-modal') closeModal(); });
    if (configured()) {
      setStatus('ok');
      lastFocusCheck = Date.now();
      setTimeout(() => reconcile('boot'), 1500);
    }
  }

  window.LarrySync = {
    openModal, closeModal, testConnection,
    saveConfig: saveConfigFromForm,
    clearConfig: clearConfigConfirm,
    manualPush: () => configured() ? reconcile('manual') : openModal(),
    pullFromGitHub: pullNow,
    _debug: { localData, hashes, loadBase, reconcile, fetchRemote }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
