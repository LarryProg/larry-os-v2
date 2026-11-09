(function(){
  const CL_BONUS_LIST   = ['Manual de Marca','Arsenal Creativo','Contrato Beat','Vocals Top','Escucha Top','Guía Lanzamiento Exitoso','Regalo Agenda'];
  const CL_STAGE_LABELS = ['Sin Empezar','En Producción','En Revisión','Terminado'];
  const CL_PROC_LABELS  = { EP:'Ep/Lanzamiento', PROD:'Prod Completa', BEAT:'Beatmaking', MIX_SOLO:'Mix', MIX:'Mix & Master', MASTER:'Master' };
  const CL_STORAGE_KEY  = 'larryCRM_v2';
  const CL_MONTHS_ES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function clRead() {
    try { const v = JSON.parse(localStorage.getItem(CL_STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  let clClients   = clRead();
  let clEditingId = null;
  let clFilter    = 'all';
  let clWriting   = false;

  function clSave() {
    clWriting = true;
    try { localStorage.setItem(CL_STORAGE_KEY, JSON.stringify(clClients)); } finally { clWriting = false; }
  }
  // v2: si otro módulo (Finanzas, bonus…) escribe larryCRM_v2, refrescar la copia en memoria
  // para que el próximo guardado no borre esos cambios.
  window.addEventListener('larry:dirty', e => {
    if (e.detail && e.detail.key === CL_STORAGE_KEY && !clWriting) clClients = clRead();
  });

  // Recarga clClients desde localStorage y re-renderiza (llamado desde otros módulos)
  window.clReload = function() {
    clClients = clRead();
    if (typeof clRender === 'function') clRender();
    if (typeof clUpdateStats === 'function') clUpdateStats();
  };

  // Returns "YYYY-MM" para el mes global activo (con fallback seguro al init)
  function clCurrentMesKey() {
    const m = typeof getSelectedMonth === 'function'
      ? String(getSelectedMonth()).padStart(2,'0')
      : String(new Date().getMonth()+1).padStart(2,'0');
    const y = typeof YEAR !== 'undefined' ? YEAR : new Date().getFullYear();
    return `${y}-${m}`;
  }

  // Readable label for a mesKey e.g. "2026-04" → "Abril 2026"
  function clMesLabel(key) {
    if (!key) return '—';
    const [y, m] = key.split('-');
    return `${CL_MONTHS_ES[parseInt(m)-1]} ${y}`;
  }

  // Populate the mes selector in the form with ±6 months around current
  function clBuildMesSelect(selectedKey) {
    const sel = document.getElementById('cl-fMes');
    sel.innerHTML = '';
    const now = new Date();
    // Build 18 months: 6 past, current, 11 future — enough range
    for (let delta = -6; delta <= 11; delta++) {
      const d = new Date(now.getFullYear(), now.getMonth() + delta, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${CL_MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
      if (key === selectedKey) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  // Update the header label in the module
  function clUpdateHeader() {
    const el = document.getElementById('cl-mes-label');
    if (el) el.textContent = clMesLabel(clCurrentMesKey());
  }

  window.clRender = function() {
    const grid   = document.getElementById('cl-grid');
    const search = document.getElementById('cl-searchInput').value.toLowerCase();
    const mesKey = clCurrentMesKey();
    clUpdateHeader();
    const list = clClients.filter(c => {
      const ms  = c.nombre.toLowerCase().includes(search);
      const mf  = clFilter === 'all' || String(c.etapa) === clFilter;
      // Clientes activos (etapa < 3 = Terminado) aparecen en todos los meses
      // desde su mes de alta hasta que se completen.
      // Clientes terminados solo aparecen en su mes de alta.
      const isTerminado = parseInt(c.etapa) >= 3;
      const mes = !c.mesKey
        ? true // legacy sin mesKey: mostrar siempre
        : isTerminado
          ? c.mesKey === mesKey // completados: solo en su mes
          : c.mesKey <= mesKey; // activos: desde su mes de inicio hasta el mes actual
      return ms && mf && mes;
    });
    // Ordenar por fecha de pago pendiente: vencidos primero, luego próximos, sin fecha al final
    const today0 = todayLocal();
    const getNextDate = (c) => {
      const pagadoSort = parseFloat(c.pagado || 0);
      const debe = parseFloat(c.total || 0) - pagadoSort;
      if (debe <= 0 || !(c.fechas||[]).length) return null;
      const sorted = [...c.fechas].filter(f => f.date).sort((a,b) => a.date.localeCompare(b.date));
      // Próxima fecha futura o, si no, la más reciente vencida
      return sorted.find(f => f.date >= today0) || sorted[sorted.length - 1] || null;
    };
    list.sort((a, b) => {
      const da = getNextDate(a), db = getNextDate(b);
      if (!da && !db) return 0;
      if (da && !db) return -1;
      if (!da && db) return 1;
      // Ambos tienen fecha: vencidos primero, luego por fecha ascendente
      const aOver = da.date < today0, bOver = db.date < today0;
      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;
      return da.date.localeCompare(db.date);
    });

    if (!list.length) {
      const total = clClients.filter(c => {
        if (!c.mesKey) return true;
        const isTerminado = parseInt(c.etapa) >= 3;
        return isTerminado ? c.mesKey === mesKey : c.mesKey <= mesKey;
      }).length;
      grid.innerHTML = `<div class="cl-empty">
        <div class="cl-empty-icon">🎛</div>
        <p>${total ? 'Sin resultados para ese filtro.' : `Sin clientes en ${clMesLabel(mesKey)}.`}</p>
        <small>${!total ? 'Haz clic en "Nuevo Cliente" para añadir el primero.' : ''}</small>
      </div>`;
      clUpdateStats();
      return;
    }
    grid.innerHTML = '';
    list.forEach((c, i) => {
      const el = clMakeCard(c);
      el.style.animationDelay = `${i * 0.045}s`;
      grid.appendChild(el);
    });
    clUpdateStats();
  };

  function clMakeCard(c) {
    const div    = document.createElement('div');
    div.className = `cl-client-card p-${c.proceso}`;
    const init   = c.nombre.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    // Bridge desactivado: estas vars siempre son null/false
    const finPagado = null;
    const hasFin    = false;
    const total  = parseFloat(c.total  || 0);
    // usar cobrado local del módulo Clientes
    const pagado = parseFloat(c.pagado || 0);
    const debe   = total - pagado;
    const pct    = total > 0 ? Math.min(100, (pagado/total)*100) : 0;
    const datesHTML = (c.fechas||[]).length
      ? `<div class="cl-card-dates">${(c.fechas||[]).map(f=>
          `<div class="cl-d-tag">${f.label?`<span>${f.label}:</span> `:''} ${clFmtDate(f.date)}</div>`
        ).join('')}</div>` : '';
    const bonusHTML = CL_BONUS_LIST.map(b => {
      const done  = (c.bonus||[]).includes(b);
      const short = b.length > 14 ? b.slice(0,13)+'…' : b;
      return `<div class="cl-bon-item ${done?'done':'pend'}" title="${b}">
        <div class="cl-bon-check">${done?'✓':''}</div>${short}
      </div>`;
    }).join('');
    const epLabel = c.proceso==='EP' && c.canciones ? ` · ${c.canciones} temas` : '';
    const finBadge = hasFin ? `<span style="font-size:9px;background:rgba(74,140,98,0.15);color:#4a8c62;border-radius:4px;padding:1px 6px;font-family:'IBM Plex Mono',monospace;letter-spacing:.05em">🔗 FIN</span>` : '';

    // Próximo cobro banner
    let proxCobroHTML = '';
    if (debe > 0 && (c.fechas||[]).length) {
      const today = todayLocal();
      const sorted = [...c.fechas].filter(f=>f.date).sort((a,b)=>a.date.localeCompare(b.date));
      const next = sorted.find(f => f.date >= today) || null;
      const overdue = sorted.filter(f => f.date < today);
      if (next) {
        const dObj = new Date(next.date + 'T00:00:00');
        const diffDays = Math.ceil((dObj - new Date().setHours(0,0,0,0)) / 86400000);
        const urgColor = diffDays <= 3 ? '#c0503a' : diffDays <= 7 ? '#b8883a' : '#4a8c62';
        const urgBg   = diffDays <= 3 ? 'rgba(192,80,58,0.1)' : diffDays <= 7 ? 'rgba(184,136,58,0.1)' : 'rgba(74,140,98,0.1)';
        const urgBorder = diffDays <= 3 ? 'rgba(192,80,58,0.3)' : diffDays <= 7 ? 'rgba(184,136,58,0.3)' : 'rgba(74,140,98,0.3)';
        const icon = diffDays <= 3 ? '🔴' : diffDays <= 7 ? '🟡' : '🟢';
        const when = diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Mañana' : `en ${diffDays}d`;
        proxCobroHTML = `<div style="margin:0 14px 10px;padding:8px 12px;background:${urgBg};border:1px solid ${urgBorder};border-radius:7px;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.2px;color:${urgColor};font-weight:700;text-transform:uppercase;margin-bottom:2px">${icon} Próximo cobro · ${when}</div>
            <div style="font-size:13px;font-weight:700;color:var(--cl-ink)">${clFmtDate(next.date)}${next.label ? ` <span style="font-size:11px;color:var(--cl-ink-soft);font-weight:400">· ${next.label}</span>` : ''}</div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:${urgColor}">€${Math.max(0,debe).toFixed(0)}</div>
        </div>`;
      } else if (overdue.length) {
        // All dates passed and still pending
        const last = overdue[overdue.length - 1];
        proxCobroHTML = `<div style="margin:0 14px 10px;padding:8px 12px;background:rgba(192,80,58,0.1);border:1px solid rgba(192,80,58,0.35);border-radius:7px;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.2px;color:#c0503a;font-weight:700;text-transform:uppercase;margin-bottom:2px">🔴 Cobro vencido</div>
            <div style="font-size:13px;font-weight:700;color:var(--cl-ink)">${clFmtDate(last.date)}${last.label ? ` <span style="font-size:11px;color:var(--cl-ink-soft);font-weight:400">· ${last.label}</span>` : ''}</div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:#c0503a">€${Math.max(0,debe).toFixed(0)}</div>
        </div>`;
      }
    }
    div.innerHTML = `
      <div class="cl-card-head">
        <div style="display:flex;gap:11px;align-items:flex-start;flex:1;min-width:0">
          <div class="cl-avatar">${init}</div>
          <div style="min-width:0">
            <div class="cl-c-name">${c.nombre}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px">
              <span class="cl-proc-badge badge-${c.proceso}">${CL_PROC_LABELS[c.proceso]||c.proceso}${epLabel}</span>
              ${finBadge}
            </div>
          </div>
        </div>
        <div class="cl-stage-pill stage-${c.etapa}">
          <div class="cl-s-dot"></div>${CL_STAGE_LABELS[c.etapa]}
        </div>
      </div>
      <div class="cl-card-finance">
        <div class="cl-fin-cell"><div class="cl-fin-lbl">Total</div><div class="cl-fin-val fv-total">€${total.toFixed(0)}</div></div>
        <div class="cl-fin-cell"><div class="cl-fin-lbl">Cobrado${finPagado!==null?' 🔗':''}</div><div class="cl-fin-val fv-paid">€${pagado.toFixed(0)}</div></div>
        <div class="cl-fin-cell"><div class="cl-fin-lbl">Pendiente</div><div class="cl-fin-val ${debe>0?'fv-due':'fv-zero'}">€${Math.max(0,debe).toFixed(0)}</div></div>
      </div>
      <div style="padding:0 14px 10px;"><div style="background:#d8cdb8;border-radius:4px;height:4px;overflow:hidden;"><div style="width:${pct}%;height:100%;border-radius:4px;background:${pct>=100?'#4a8c62':pct>=50?'#b8883a':'#c0503a'};transition:width .4s"></div></div></div>
      ${proxCobroHTML}
      ${datesHTML}
      <div class="cl-card-bonus">${bonusHTML}</div>
      <div class="cl-card-actions">
        <button class="cl-btn-xs" onclick="clEditClient('${c.id}');event.stopPropagation()">✎ Editar</button>
        <button class="cl-btn-xs del" onclick="clDelClient('${c.id}');event.stopPropagation()">✕ Eliminar</button>
      </div>
    `;
    return div;
  }

  function clFmtDate(d) {
    if (!d) return '—';
    const [y,m,day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function clUpdateStats() {
    const mesKey  = clCurrentMesKey();
    const visibles = clClients.filter(c => {
      if (!c.mesKey) return true; // legacy sin mesKey: mostrar siempre
      const isTerminado = parseInt(c.etapa) >= 3;
      return isTerminado ? c.mesKey === mesKey : c.mesKey <= mesKey;
    });
    const total    = visibles.reduce((s,c)=>s+(parseFloat(c.total  )||0),0);
    const pagado   = visibles.reduce((s,c)=>s+(parseFloat(c.pagado||0)),0);
    document.getElementById('cl-sClientes').textContent  = visibles.filter(c=>parseInt(c.etapa)<3).length;
    document.getElementById('cl-sTotal').textContent     = `€${total.toFixed(0)}`;
    document.getElementById('cl-sCobrado').textContent   = `€${pagado.toFixed(0)}`;
    document.getElementById('cl-sPendiente').textContent = `€${Math.max(0,total-pagado).toFixed(0)}`;
  }

  window.clSetFilter = function(val, el) {
    clFilter = val;
    document.querySelectorAll('#module-clientes .cl-filter-chip').forEach(c=>c.classList.remove('active'));
    el.classList.add('active');
    clRender();
  };

  window.clOpenModal = function(data=null) {
    clEditingId = data ? data.id : null;
    document.getElementById('cl-mTitle').textContent     = data ? `Editar: ${data.nombre}` : 'Nuevo Cliente';
    document.getElementById('cl-fNombre').value          = data?.nombre    || '';
    document.getElementById('cl-fProceso').value         = data?.proceso   || 'EP';
    document.getElementById('cl-fCanciones').value       = data?.canciones || '';
    document.getElementById('cl-fEtapa').value           = data?.etapa     ?? '0';
    document.getElementById('cl-fTotal').value           = data?.total     || '';
    // v2: lo cobrado vive en Finanzas. Si el cliente ya tiene cobros allí, se muestra y no se edita acá.
    const pagEl = document.getElementById('cl-fPagado');
    const finTwin = data && typeof appData !== 'undefined' ? (appData.clientes || []).find(x => x.clId === data.id) : null;
    const finCobrado = finTwin ? (finTwin.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0) : 0;
    if (finTwin && (finTwin.pagos || []).length) {
      pagEl.value = finCobrado; pagEl.readOnly = true;
      pagEl.title = 'Los cobros se registran en Finanzas → botón "Cobrar"';
      pagEl.style.opacity = '.6';
    } else {
      pagEl.value = data?.pagado || ''; pagEl.readOnly = false; pagEl.title = ''; pagEl.style.opacity = '';
    }
    document.getElementById('cl-fDebe').value            = data ? Math.max(0,(parseFloat(data.total)||0)-(parseFloat(pagEl.value)||0)).toFixed(0) : '';
    // Mes de trabajo: usa el del cliente si existe, si no el mes global activo
    clBuildMesSelect(data?.mesKey || clCurrentMesKey());
    clToggleEP();
    clRenderBonusGrid(data?.bonus || []);
    clRenderDates(data?.fechas || []);
    document.getElementById('cl-overlay').classList.add('open');
    setTimeout(()=>document.getElementById('cl-fNombre').focus(), 80);
  };

  window.clCloseModal = function() {
    document.getElementById('cl-overlay').classList.remove('open');
    clEditingId = null;
  };

  window.clOnOverlay = function(e) { if (e.target===document.getElementById('cl-overlay')) clCloseModal(); };
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape') { if(document.getElementById('cl-overlay').classList.contains('open')) clCloseModal(); }
  });

  window.clToggleEP = function() {
    document.getElementById('cl-epGroup').style.display =
      document.getElementById('cl-fProceso').value === 'EP' ? 'flex' : 'none';
  };

  window.clCalcDebe = function() {
    const t = parseFloat(document.getElementById('cl-fTotal').value)  || 0;
    const p = parseFloat(document.getElementById('cl-fPagado').value) || 0;
    document.getElementById('cl-fDebe').value = Math.max(0, t-p).toFixed(0);
  };

  function clRenderBonusGrid(checked) {
    document.getElementById('cl-bonusGrid').innerHTML = CL_BONUS_LIST.map(b=>`
      <div class="cl-bon-toggle ${checked.includes(b)?'checked':''}" onclick="clToggleBonus(this)">
        <div class="cl-t-box">${checked.includes(b)?'✓':''}</div>
        <span>${b}</span>
      </div>
    `).join('');
  }

  window.clToggleBonus = function(el) {
    el.classList.toggle('checked');
    el.querySelector('.cl-t-box').textContent = el.classList.contains('checked') ? '✓' : '';
  };

  function clRenderDates(fechas) {
    document.getElementById('cl-datesContainer').innerHTML = '';
    (fechas||[]).forEach((f, i) => clAddDateRow(f.label, f.date, i));
  }

  window.clAddDateRow = function(label='', date='', idx) {
    const cont = document.getElementById('cl-datesContainer');
    const row  = document.createElement('div');
    if (idx !== undefined) row.dataset.idx = idx;
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;';
    row.innerHTML = `
      <input type="text"  class="cl-dl" placeholder="ej. Señal, 2do pago…" value="${escT(label||'')}">
      <input type="date"  class="cl-dd" value="${date||''}">
      <button onclick="this.closest('div').remove()"
        style="background:var(--cl-cream);border:1.5px solid var(--cl-divider);border-radius:6px;width:30px;height:30px;
               color:var(--cl-ink-ghost);cursor:pointer;font-size:13px;transition:all 0.18s;flex-shrink:0;"
        onmouseover="this.style.borderColor='var(--cl-red)';this.style.color='var(--cl-red)'"
        onmouseout="this.style.borderColor='var(--cl-divider)';this.style.color='var(--cl-ink-ghost)'">✕</button>
    `;
    cont.appendChild(row);
  };

  window.clSaveClient = function() {
    const nombre = document.getElementById('cl-fNombre').value.trim();
    if (!nombre) { showToast('⚠️ Ingresa el nombre del artista.'); return; }
    const bonus  = [...document.querySelectorAll('#cl-overlay .cl-bon-toggle.checked')].map(el=>el.querySelector('span').textContent);
    // v2: conservar campos extra de cada fecha (ej. _finProx de Finanzas) para no duplicarlas
    const prevC = clEditingId ? clClients.find(x => x.id === clEditingId) : null;
    const prevF = (prevC && prevC.fechas) || [];
    const fechas = [...document.querySelectorAll('#cl-datesContainer > div')].map((row, i)=>({
      ...(row.dataset.idx !== undefined ? (prevF[+row.dataset.idx] || {}) : {}),
      label: row.querySelector('.cl-dl').value,
      date:  row.querySelector('.cl-dd').value
    })).filter(f=>f.date);
    const c = {
      ...(prevC || {}),   // conservar campos que este formulario no muestra
      id:        clEditingId || crypto.randomUUID(),
      nombre,
      proceso:   document.getElementById('cl-fProceso').value,
      canciones: document.getElementById('cl-fCanciones').value,
      etapa:     parseInt(document.getElementById('cl-fEtapa').value),
      total:     document.getElementById('cl-fTotal').value,
      pagado:    document.getElementById('cl-fPagado').value,
      mesKey:    document.getElementById('cl-fMes').value || clCurrentMesKey(),
      bonus, fechas
    };
    if (clEditingId) {
      const i = clClients.findIndex(x=>x.id===clEditingId);
      if (i !== -1) clClients[i] = c;
    } else {
      clClients.push(c);
    }
    const _wasEditing = !!clEditingId; // capturar ANTES de clCloseModal (lo resetea a null)
    clSave();
    // ─── BRIDGE: CRM_v2 → Finanzas ───────────────────────────────
    // Mantiene appData.clientes sincronizado cuando se guarda desde el módulo Clientes
    try {
      const CL_PROC_TO_SERV = {EP:'Ep/Lanzamiento',PROD:'Prod Completa',BEAT:'Beatmaking',MIX_SOLO:'Mix',MIX:'Mix&Master',MASTER:'Master'};
      const _brServicio  = CL_PROC_TO_SERV[c.proceso] || 'Prod Completa';
      const _brPrecio    = parseFloat(c.total)  || 0;
      const _brPagadoCRM = parseFloat(c.pagado) || 0;
      const _brFinIdx    = (appData.clientes||[]).findIndex(x => x.clId === c.id);
      if (_brFinIdx >= 0) {
        // Actualizar campos base — sin tocar el historial de pagos de Finanzas
        appData.clientes[_brFinIdx].nombre   = c.nombre;
        appData.clientes[_brFinIdx].servicio = _brServicio;
        if (String(c.total).trim() !== '') appData.clientes[_brFinIdx].precio = _brPrecio; // v2: total vacío no pone el precio en 0
        // Si CRM_v2 tiene pagado pero Finanzas no tiene historial aún, crear entrada inicial
        const _brFinPagado = (appData.clientes[_brFinIdx].pagos||[]).reduce((s,p)=>s+Number(p.monto),0);
        if (_brPagadoCRM > 0 && _brFinPagado === 0) {
          if (!appData.clientes[_brFinIdx].pagos) appData.clientes[_brFinIdx].pagos = [];
          appData.clientes[_brFinIdx].pagos.push({
            id: crypto.randomUUID(), monto: _brPagadoCRM,
            fecha: todayLocal(), nota: 'Sync desde Clientes'
          });
        }
        // Sincronizar etapa → estado en Finanzas (salvo estado fijado manualmente)
        if (parseInt(c.etapa) >= 3 && appData.clientes[_brFinIdx].estado === 'activo' && !appData.clientes[_brFinIdx].estadoManual) {
          appData.clientes[_brFinIdx].estado = 'completado';
        }
      } else {
        // Crear nuevo cliente en Finanzas vinculado a esta entrada de CRM_v2
        const _brNewFin = {
          id: crypto.randomUUID(), nombre: c.nombre, servicio: _brServicio,
          precio: _brPrecio, estado: parseInt(c.etapa) >= 3 ? 'completado' : 'activo',
          notas: '', pagos: [], proximoCobro: null, clId: c.id
        };
        if (_brPagadoCRM > 0) {
          _brNewFin.pagos.push({
            id: crypto.randomUUID(), monto: _brPagadoCRM,
            fecha: todayLocal(), nota: 'Cobro inicial (desde Clientes)'
          });
        }
        appData.clientes.push(_brNewFin);
      }
      save(); // guarda appData actualizado en larryOS_finanzas
    } catch(_brE) { console.warn('Larry OS: error en bridge CRM→Fin', _brE); }
    // ─────────────────────────────────────────────────────────────
    clCloseModal(); clRender();
    showToast(_wasEditing ? 'Cliente actualizado ✓' : 'Nuevo cliente guardado ✓');
  };

  window.clEditClient = function(id) { const c = clClients.find(x=>x.id===id); if(c) clOpenModal(c); };

  window.clDelClient = function(id) {
    customConfirm('¿Eliminar este cliente del módulo Clientes?', function(){
    clClients = clClients.filter(x=>x.id!==id);
    clSave(); clRender();
    // 🔗 BRIDGE: Marcar como cancelado en Finanzas (preservar historial de cobros)
    // y quitarle el próximo cobro para que NO aparezca en "Cobros urgentes".
    try {
      const finRaw = localStorage.getItem('larryOS_finanzas');
      if (finRaw) {
        const finData = JSON.parse(finRaw);
        const idx = (finData.clientes||[]).findIndex(x => x.clId === id);
        if (idx >= 0) {
          finData.clientes[idx].estado = 'cancelado';
          finData.clientes[idx].proximoCobro = null;
          localStorage.setItem('larryOS_finanzas', JSON.stringify(finData));
        }
      }
      // Refrescar Finanzas en memoria (appData) para que el dashboard no muestre datos viejos
      if (typeof load === 'function') load();
      if (typeof renderDashboard === 'function') renderDashboard();
    } catch(e) {}
    }, 'Eliminar');
  };

  clToggleEP();
  clRender();
})();
