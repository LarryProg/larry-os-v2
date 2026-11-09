// ─── GLOBAL ESCAPE UTILITY (Anti-XSS) ───────────────────────
function escT(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── MODULE SWITCHER ───────────────────────────────────────────
let activeModule = 'finanzas';

function switchModule(name) {
  // Special case: fin-clientes shows the clientes page inside finanzas module
  if (name === 'fin-clientes') {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('module-finanzas').classList.add('active');
    document.getElementById('sb-fin-clientes').classList.add('active');
    document.getElementById('fin-subnav').style.display = 'none';
    // Show clientes page directly
    document.querySelectorAll('.fin-page').forEach(p => p.style.display = 'none');
    document.getElementById('fin-page-clientes').style.display = '';
    renderClientes();
    const agendaFab = document.getElementById('agenda-fab');
    if (agendaFab) agendaFab.style.display = 'none';
    activeModule = 'fin-clientes';
    return;
  }

  const modEl = document.getElementById('module-' + name);
  if (!modEl) { console.warn('Módulo inexistente:', name); return; }
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  modEl.classList.add('active');
  const sbEl = document.getElementById('sb-' + name);
  if (sbEl) sbEl.classList.add('active');
  try { localStorage.setItem('larryOS_lastModule', name); } catch (e) {}

  const finSubnav = document.getElementById('fin-subnav');
  if (name === 'finanzas') {
    finSubnav.style.display = 'flex';
    // Ensure dashboard fin-page is visible and others are hidden
    document.querySelectorAll('.fin-page').forEach(p => p.style.display = 'none');
    document.getElementById('fin-page-dashboard').style.display = 'block';
    // Reset subnav active state to dashboard button
    document.querySelectorAll('#fin-subnav button').forEach(b => b.classList.remove('active'));
    const dashBtn = document.querySelector('#fin-subnav button[data-fin-page="dashboard"]');
    if (dashBtn) dashBtn.classList.add('active');
    renderDashboard();
  } else {
    finSubnav.style.display = 'none';
  }

  if (name === 'hoy' && typeof window.renderHoy === 'function') window.renderHoy();
  if (name === 'fiscal' && typeof window.renderFiscal === 'function') window.renderFiscal();

  // Agenda FAB: only visible inside Agenda module
  const agendaFab = document.getElementById('agenda-fab');
  if (agendaFab) agendaFab.style.display = name === 'agenda' ? 'flex' : 'none';

  // Clientes: re-render al entrar para reflejar el mes activo
  if (name === 'clientes') { if (typeof window.clReload === 'function') window.clReload(); else clRender(); }

  activeModule = name;

  // Close mobile sidebar automatically on module switch
  if (typeof closeSidebar === 'function') closeSidebar();
}

// ─── TOAST ───────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hide');
  t.style.display = '';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => { t.classList.remove('show', 'hide'); }, 300);
  }, 2500);
}

// ─── DESHACER (v2) ───────────────────────────────────────────
// Muestra "Eliminado · Deshacer" unos segundos. onUndo restaura lo borrado.
function showUndo(msg, onUndo) {
  let bar = document.getElementById('undo-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'undo-bar';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;background:#111;color:#fff;border-radius:10px;padding:10px 12px 10px 16px;display:none;align-items:center;gap:14px;font:500 13px DM Sans,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:92vw';
    bar.innerHTML = '<span id="undo-msg"></span><button id="undo-btn" style="background:#fff;color:#111;border:none;border-radius:7px;padding:6px 12px;font-weight:700;cursor:pointer">Deshacer</button>';
    document.body.appendChild(bar);
  }
  bar.querySelector('#undo-msg').textContent = msg;
  bar.style.display = 'flex';
  clearTimeout(bar._t);
  bar.querySelector('#undo-btn').onclick = () => {
    bar.style.display = 'none'; clearTimeout(bar._t);
    try { onUndo(); showToast('↩ Restaurado'); } catch (e) { console.warn(e); }
  };
  bar._t = setTimeout(() => { bar.style.display = 'none'; }, 7000);
}

// ─── BACKUP / RESTORE ────────────────────────────────────────
// Una sola lista para backup y sync (definida en js/storage.js)
const BACKUP_KEYS = window.LARRY_DATA_KEYS;

function backupData() {
  const backup = { _version: 1, _date: new Date().toISOString(), _app: 'LarryOS' };
  BACKUP_KEYS.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw === null) { backup[k] = null; return; }
    try { backup[k] = JSON.parse(raw); } catch(e) { backup[k] = raw; } // texto plano
  });
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const date = todayLocal();
  a.download = 'LarryOS_backup_' + date + '.json';
  a.click();
  showToast('✓ Backup descargado · ' + date);
}

function restoreData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data._app || data._app !== 'LarryOS') {
        showToast('⚠️ Archivo no válido — usá un backup de Larry OS');
        return;
      }
      const dateStr = data._date ? new Date(data._date).toLocaleDateString('es-ES') : 'archivo';
      customConfirm('¿Restaurar backup del ' + dateStr + '? Se reemplazarán todos los datos actuales.\n\nSi tenés GitHub Sync activo, el backup restaurado también se subirá a GitHub.', function(){
        BACKUP_KEYS.forEach(k => {
          if (data[k] === undefined || data[k] === null) return;
          localStorage.setItem(k, typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]));
        });
        showToast('✓ Datos restaurados · Recargando...');
        setTimeout(() => location.reload(), 1200);
      }, 'Restaurar');
    } catch(err) {
      showToast('⚠️ Error al leer el archivo');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ─── MONTH / YEAR SELECTOR (shared) ──────────────────────────
let YEAR = new Date().getFullYear();
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function initMonthSelect() {
  const sel = document.getElementById('globalMonth');
  MONTHS.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i + 1; o.textContent = m;
    sel.appendChild(o);
  });
  sel.value = new Date().getMonth() + 1;
}

function initYearSelect() {
  const sel = document.getElementById('globalYear');
  const currentYear = new Date().getFullYear();
  // Desde el primer año con datos (o 2024) hasta 2 años adelante
  let firstYear = Math.min(2024, currentYear - 1);
  try {
    const fin = JSON.parse(localStorage.getItem('larryOS_finanzas') || '{}');
    (fin.clientes || []).forEach(c => (c.pagos || []).forEach(p => {
      const y = parseInt(String(p.fecha || '').slice(0, 4), 10);
      if (y > 2000 && y < firstYear) firstYear = y;
    }));
  } catch (e) {}
  for (let y = firstYear; y <= currentYear + 2; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === currentYear) o.selected = true;
    sel.appendChild(o);
  }
  updateYearLabel();
}

function onYearChange() {
  YEAR = parseInt(document.getElementById('globalYear').value);
  updateYearLabel();
  setCrmYear(YEAR);
  onMonthChange();
}

function updateYearLabel() {
  const label = document.getElementById('sb-year-label');
  if (label) label.textContent = String(YEAR).split('').join(' ');
}

function getSelectedMonth() { return parseInt(document.getElementById('globalMonth').value); }
function getMonthLabel() { return MONTHS[getSelectedMonth()-1]; }

function onMonthChange() {
  if (activeModule === 'finanzas') {
    renderDashboard(); renderGastos(); renderBalance();
    // Bug 4: solo renderizar gráficas si el usuario está viendo esa página
    if (document.getElementById('fin-page-graficas').style.display !== 'none') {
      renderGraficas();
    }
  }
  if (activeModule === 'fin-clientes') { renderClientes(); }
  if (activeModule === 'clientes') clRender();
}

// ─── SAFE STORAGE SAVE ───────────────────────────────────────
function safeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e) {
    if (e.name === 'QuotaExceededError') showToast('⚠️ Almacenamiento lleno. No se pudo guardar.');
    console.warn('Larry OS: error al guardar en localStorage.', e);
  }
}

initMonthSelect();
initYearSelect();

// ─── BRIDGE: CONEXIÓN CLIENTES ↔ FINANZAS ↔ CRM ─────────────
// ─── SYNC BRIDGE DESACTIVADO ─────────────────────────────────
// Pipeline, Clientes y Finanzas son módulos independientes.
function syncClToFin() {}
function syncFinToClientes() {}
function syncAllClToFin() {}
function crmAutoCreateClient() {}
function crmMakeClient() {}
function getFinPagado() { return null; }
function getFinClientId() { return null; }
function openFinCobrosForCl() {}
window.crmMakeClient = crmMakeClient;
window.crmAutoCreateClient = crmAutoCreateClient;
// ─────────────────────────────────────────────────────────────

// Permite al CRM actualizar su año de filtro
window.crmYearFilter = YEAR;
function setCrmYear(y) { window.crmYearFilter = y; if (window.crmForceRefresh) window.crmForceRefresh(); }
