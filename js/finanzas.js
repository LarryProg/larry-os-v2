// ─── DATA ────────────────────────────────────────────────────
const FIN_PROC_MAP = {'Beatmaking':'BEAT','Mix':'MIX_SOLO','Master':'MASTER','Mix&Master':'MIX','Prod Completa':'PROD','Ep/Lanzamiento':'EP'};
let appData = { clientes: [], gastos: [] };
let editingClienteId = null, editingPagoClienteId = null;
let activeCat = 'todas';
let finCharts = {};

let _finWriting = false;
function save() { _finWriting = true; try { safeSave('larryOS_finanzas', appData); } finally { _finWriting = false; } }
function load() {
  try {
    const d = localStorage.getItem('larryOS_finanzas');
    if (d) appData = JSON.parse(d);
    if (!appData.clientes) appData.clientes = [];
    if (!appData.gastos) appData.gastos = [];
  } catch(e) {
  }
}
// v2: si otro módulo escribe Finanzas directamente, recargar appData para no pisar sus cambios
window.addEventListener('larry:dirty', e => {
  if (e.detail && e.detail.key === 'larryOS_finanzas' && !_finWriting) load();
});

// ─── HELPERS ────────────────────────────────────────────────
const fmt = n => '€' + (n||0).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '—';

function totalCobrado(c) { return (c.pagos||[]).reduce((s,p)=>s+Number(p.monto),0); }
function totalPendiente(c) { return Math.max(0, Number(c.precio||0) - totalCobrado(c)); }
function cobradoEnMes(c, mes) {
  return (c.pagos||[]).filter(p=>{const d=new Date(p.fecha+'T12:00:00');return d.getFullYear()===YEAR&&d.getMonth()+1===mes;}).reduce((s,p)=>s+Number(p.monto),0);
}
function gastosEnMes(mes) {
  return appData.gastos.filter(g=>{const d=new Date(g.fecha+'T12:00:00');return d.getFullYear()===YEAR&&d.getMonth()+1===mes;});
}
function totalGastosEnMes(mes) { return gastosEnMes(mes).reduce((s,g)=>s+Number(g.monto),0); }
function ingresosEnMes(mes) { return appData.clientes.reduce((s,c)=>s+cobradoEnMes(c,mes),0); }

function estadoBadge(estado) {
  const map = { activo:'badge-green', completado:'badge-amber', pausado:'badge-gray', cancelado:'badge-red' };
  return `<span class="badge ${map[estado]||'badge-gray'}">${estado||'—'}</span>`;
}

// ─── NAVIGATION ──────────────────────────────────────────────
function navigateFin(page, btn) {
  document.querySelectorAll('.fin-page').forEach(p=>p.style.display='none');
  document.getElementById('fin-page-'+page).style.display='block';
  document.querySelectorAll('#fin-subnav button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(page==='dashboard') renderDashboard();
  else if(page==='graficas') renderGraficas();
  else if(page==='gastos') { renderGastos(); renderBalance(); }
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard() {
  const mes = getSelectedMonth();
  document.getElementById('dash-period').textContent = getMonthLabel() + ' ' + YEAR;
  const ing = ingresosEnMes(mes), gas = totalGastosEnMes(mes), neto = ing - gas;
  // Los clientes cancelados (p.ej. eliminados desde el módulo Clientes) no cuentan como pendientes
  const pend = appData.clientes.reduce((s,c)=>s+(c.estado==='cancelado'?0:totalPendiente(c)),0);
  document.getElementById('kpi-ingresos').textContent = fmt(ing);
  document.getElementById('kpi-gastos').textContent = fmt(gas);
  const nb = document.getElementById('kpi-balance');
  nb.textContent = fmt(neto); nb.className = 'kpi-value '+(neto>=0?'green':'red');
  document.getElementById('kpi-pendiente').textContent = fmt(pend);

  // ── PROGRESS BAR: cobrado vs pendiente DEL MES seleccionado ──
  // El pendiente que cuenta aquí es solo el de los clientes cuyo próximo
  // cobro cae en el mes/año seleccionado, no el de TODOS los clientes.
  (function(){
    const pendMes = appData.clientes.reduce((s,c)=>{
      if (c.estado === 'cancelado') return s;
      if (totalPendiente(c) <= 0) return s;
      const pc = getProximoCobro(c);
      if (!pc || !pc.date) return s;
      const d = new Date(pc.date + 'T12:00:00');
      if (d.getFullYear() === YEAR && (d.getMonth()+1) === mes) return s + totalPendiente(c);
      return s;
    }, 0);
    const totalEsperado = ing + pendMes;
    const pct = totalEsperado > 0 ? Math.round((ing / totalEsperado) * 100) : 0;
    const fillEl = document.getElementById('dash-prog-fill');
    const pctEl  = document.getElementById('dash-prog-pct');
    const cobEl  = document.getElementById('dash-prog-cobrado');
    const penEl  = document.getElementById('dash-prog-pendiente');
    if(fillEl){ fillEl.style.width = pct + '%'; }
    if(pctEl) { pctEl.textContent = pct + '%'; pctEl.style.color = pct >= 80 ? '#3FB950' : pct >= 50 ? '#C9A84C' : '#F85149'; }
    if(cobEl) { cobEl.textContent = fmt(ing); }
    if(penEl) { penEl.textContent = fmt(pendMes); }
  })();

  // Próximas llamadas (Google Calendar / Zcal)
  if (window.ProxLlamadas) ProxLlamadas.render();

  // ── COBROS ESTA SEMANA ──────────────────────────────────────
  (function(){
    const today = new Date(); today.setHours(0,0,0,0);
    const in7 = new Date(today); in7.setDate(in7.getDate()+7);
    let alertItems = [];
    // From larryCRM_v2 client dates
    try {
      const clRaw = localStorage.getItem('larryCRM_v2');
      const clClients = clRaw ? JSON.parse(clRaw) : [];
      clClients.forEach(c => {
        // Saldado según Finanzas (fuente de verdad): si el cliente vinculado
        // ya no debe nada, no es un cobro urgente aunque el CRM tenga datos viejos.
        const finMatch = appData.clientes.find(fc => fc.clId === c.id); // v2: solo por id
        if (finMatch && (totalPendiente(finMatch) <= 0 || finMatch.estado === 'cancelado')) return;
        const debe = parseFloat(c.total||0) - parseFloat(c.pagado||0);
        if (debe <= 0) return;
        (c.fechas||[]).forEach(f => {
          if (!f.date) return;
          const d = new Date(f.date + 'T00:00:00');
          if (d <= in7) {
            const diff = Math.ceil((d - today) / 86400000);
            alertItems.push({ nombre:c.nombre, date:f.date, diff, label:f.label, overdue: diff < 0, clId:c.id, finId:(finMatch?finMatch.id:'') });
          }
        });
      });
    } catch(e){}
    // From finanzas proximoCobro
    appData.clientes.forEach(c => {
      if (c.estado === 'cancelado') return; // cancelado/eliminado → no es cobro urgente
      if (totalPendiente(c) <= 0) return; // saldado → ya no es cobro urgente
      if (c.proximoCobro && c.proximoCobro.fecha) {
        const d = new Date(c.proximoCobro.fecha + 'T00:00:00');
        const diff = Math.ceil((d - today) / 86400000);
        if (diff <= 7) {
          const alreadyThere = alertItems.find(a=>a.nombre===c.nombre&&a.date===c.proximoCobro.fecha);
          if (!alreadyThere) alertItems.push({ nombre:c.nombre, date:c.proximoCobro.fecha, diff, label:c.proximoCobro.label, overdue: diff<0, finId:c.id, clId:(c.clId||'') });
        }
      }
    });
    alertItems.sort((a,b)=>a.diff-b.diff);

    let alertHtml = '';
    if (alertItems.length) {
      alertHtml = alertItems.map(a=>{
        const color = a.overdue ? '#F85149' : a.diff<=3 ? '#C9A84C' : '#3FB950';
        const bg    = a.overdue ? 'rgba(248,81,73,0.08)' : a.diff<=3 ? 'rgba(201,168,76,0.08)' : 'rgba(63,185,80,0.08)';
        const icon  = a.overdue ? '🔴' : a.diff<=3 ? '🟡' : '🟢';
        const when  = a.overdue ? Math.abs(a.diff)+'d vencido' : a.diff===0?'Hoy':a.diff===1?'Mañana':'en '+a.diff+'d';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:${bg};border-radius:7px;border:1px solid ${color}22;font-size:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span>${icon}</span>
            <strong style="color:#2C2010">${escT(a.nombre)}</strong>
            ${a.label?`<span style="color:#9A8A6A;font-size:11px">· ${a.label}</span>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${color}">${when}</span>
            <button onclick="deleteCobroUrgente('${a.finId||''}','${a.clId||''}','${a.date}')" title="Eliminar este cobro" style="background:none;border:none;cursor:pointer;color:#C0392B;opacity:.55;font-size:13px;line-height:1;padding:2px 5px;border-radius:4px;transition:opacity .15s" onmouseover="this.style.opacity=1;this.style.background='rgba(192,57,43,0.1)'" onmouseout="this.style.opacity=.55;this.style.background='none'">✕</button>
          </div>
        </div>`;
      }).join('');
    }

    const alertBlock = document.getElementById('dash-alert-cobros');
    if (alertBlock) {
      if (alertItems.length) {
        alertBlock.style.display = 'block';
        alertBlock.querySelector('.dash-alert-inner').innerHTML = alertHtml;
        alertBlock.querySelector('.dash-alert-count').textContent = alertItems.length;
      } else {
        alertBlock.style.display = 'none';
        const _inner = alertBlock.querySelector('.dash-alert-inner'); if (_inner) _inner.innerHTML = '';
        const _cnt = alertBlock.querySelector('.dash-alert-count'); if (_cnt) _cnt.textContent = '0';
      }
    }
  })();

  // Pendientes — ordenados por fecha de próximo cobro (vencidos primero, luego más próximos, sin fecha al final)
  const conPend = appData.clientes.filter(c=>totalPendiente(c)>0 && c.estado!=='cancelado');
  const today0dash = todayLocal();

  const pendSorted = [...conPend].sort((a, b) => {
    const pa = getProximoCobro(a), pb = getProximoCobro(b);
    if (!pa && !pb) return a.nombre.localeCompare(b.nombre);
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    const aOver = pa.date < today0dash, bOver = pb.date < today0dash;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    return pa.date.localeCompare(pb.date);
  });

  let pendHtml = '';
  pendSorted.forEach(c => {
    const proxCobro = getProximoCobro(c);
    let proxPendHtml = '<span style="color:#9A8A6A;font-size:11px">—</span>';
    if (proxCobro) {
      const today = todayLocal();
      const isVencido = proxCobro.date < today;
      const color = isVencido ? '#F85149' : '#C9A84C';
      proxPendHtml = `<div style="font-size:12px;font-weight:700;color:${color}">${isVencido?'⚠️ ':'📅 '}${fmtDate(proxCobro.date)}</div>${proxCobro.label?`<div style="font-size:10px;color:#9A8A6A">${proxCobro.label}</div>`:''}`;
    }
    pendHtml += `<tr>
      <td><strong>${escT(c.nombre)}</strong></td>
      <td style="color:#7A6A50">${c.servicio||'—'}</td>
      <td>${fmt(c.precio)}</td>
      <td class="amount-pos">${fmt(totalCobrado(c))}</td>
      <td class="amount-neg">${fmt(totalPendiente(c))}</td>
      <td>${proxPendHtml}</td>
      <td>${estadoBadge(c.estado)}</td>
      <td><button class="btn btn-green btn-sm" onclick="openModalCliente('${c.id}')">📅 Fecha</button> <button class="btn btn-green btn-sm" onclick="openModalPago('${c.id}')">💰 Cobrar</button></td>
    </tr>`;
  });

  document.getElementById('dash-pendientes-body').innerHTML = pendHtml || '<tr class="empty-row"><td colspan="8">Sin cobros pendientes 🎉</td></tr>';
}

// ─── ELIMINAR UN COBRO URGENTE ────────────────────────────────
// Quita el cobro programado (próximo cobro) de ese cliente. NO borra el cliente
// ni su historial de pagos: solo elimina esa fecha de cobro para que deje de
// aparecer en "Cobros urgentes". Pide confirmación antes.
window.deleteCobroUrgente = function(finId, clId, date) {
  finId = finId || ''; clId = clId || '';
  // Nombre del cliente para el mensaje
  let nombre = '';
  if (finId) { const fc = appData.clientes.find(c => c.id === finId); if (fc) nombre = fc.nombre; }
  if (!nombre && clId) {
    try { const raw = localStorage.getItem('larryCRM_v2'); if (raw) { const cl = JSON.parse(raw).find(x => x.id === clId); if (cl) nombre = cl.nombre; } } catch(e){}
  }
  const fechaTxt = (typeof fmtDate === 'function') ? fmtDate(date) : date;
  customConfirm('¿Eliminar este cobro' + (nombre ? (' de ' + nombre) : '') + ' del ' + fechaTxt + '?\nNo se borra el cliente ni sus pagos, solo este cobro programado.', function(){
    let changed = false;
    // 1) Finanzas: limpiar proximoCobro si coincide la fecha
    if (finId) {
      const fc = appData.clientes.find(c => c.id === finId);
      if (fc && fc.proximoCobro && fc.proximoCobro.fecha === date) { fc.proximoCobro = null; changed = true; }
    }
    if (changed) save();
    // 2) larryCRM_v2 (módulo Clientes): quitar la fecha que coincide
    let clChanged = false;
    try {
      const raw = localStorage.getItem('larryCRM_v2');
      if (raw && clId) {
        const list = JSON.parse(raw);
        const cl = list.find(x => x.id === clId);
        if (cl && Array.isArray(cl.fechas)) {
          const before = cl.fechas.length;
          cl.fechas = cl.fechas.filter(f => f.date !== date);
          if (cl.fechas.length !== before) {
            clChanged = true;
            localStorage.setItem('larryCRM_v2', JSON.stringify(list));
            if (typeof window.clReload === 'function') window.clReload();
          }
        }
      }
    } catch(e){}
    renderDashboard();
    showToast((changed || clChanged) ? '🗑️ Cobro eliminado' : 'No se encontró el cobro');
  }, 'Eliminar');
};

// ─── GRAFICAS ─────────────────────────────────────────────────
const CHART_DEFAULTS = {
  color: '#C9A84C',
  grid: 'rgba(201,168,76,0.07)',
  tick: '#9A8A6A',
};

function renderGraficas() {
  const allIng = MONTHS.map((_,i)=>ingresosEnMes(i+1));
  const allGas = MONTHS.map((_,i)=>totalGastosEnMes(i+1));
  const allNet = MONTHS.map((_,i)=>allIng[i]-allGas[i]);
  let acum=0; const allAcum = allNet.map(n=>{acum+=n;return acum;});
  const totalIng=allIng.reduce((s,v)=>s+v,0);
  const totalGas=allGas.reduce((s,v)=>s+v,0);
  const mejorI=allIng.indexOf(Math.max(...allIng));
  document.getElementById('g-anual-ingresos').textContent=fmt(totalIng);
  document.getElementById('g-anual-gastos').textContent=fmt(totalGas);
  const gn=document.getElementById('g-anual-neto'); gn.textContent=fmt(totalIng-totalGas); gn.className='kpi-value '+(totalIng>=totalGas?'green':'red');
  document.getElementById('g-mejor-mes').textContent=MONTHS[mejorI].slice(0,3);
  document.getElementById('g-mejor-mes-val').textContent=fmt(allIng[mejorI]);
  document.getElementById('g-pendiente-total').textContent=fmt(appData.clientes.filter(c=>c.estado!=='cancelado').reduce((s,c)=>s+totalPendiente(c),0));

  // Fix 1: actualizar subtítulos con el año seleccionado
  document.getElementById('chart-sub-barras').textContent='Comparativa mensual '+YEAR;
  document.getElementById('chart-sub-categorias').textContent='Año completo '+YEAR;
  document.getElementById('chart-sub-tabla').textContent='Resumen mes a mes '+YEAR;

  const chartOpts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{color:CHART_DEFAULTS.grid},ticks:{color:CHART_DEFAULTS.tick,font:{size:10}}},y:{grid:{color:CHART_DEFAULTS.grid},ticks:{color:CHART_DEFAULTS.tick,font:{size:10},callback:v=>'€'+v.toLocaleString('es-ES')}}} };

  const shortMonths = MONTHS.map(m=>m.slice(0,3));
  
  if(finCharts.barras) finCharts.barras.destroy();
  finCharts.barras = new Chart(document.getElementById('chart-barras'),{type:'bar',data:{labels:shortMonths,datasets:[{label:'Ingresos',data:allIng,backgroundColor:'rgba(63,185,80,0.7)',borderRadius:4},{label:'Gastos',data:allGas,backgroundColor:'rgba(248,81,73,0.6)',borderRadius:4}]},options:{...chartOpts,plugins:{legend:{display:true,labels:{color:'#7A6A50',font:{size:11}}}}}});

  if(finCharts.acumulado) finCharts.acumulado.destroy();
  finCharts.acumulado = new Chart(document.getElementById('chart-acumulado'),{type:'line',data:{labels:shortMonths,datasets:[{data:allAcum,borderColor:'#C9A84C',backgroundColor:'rgba(201,168,76,0.08)',tension:0.4,fill:true,pointBackgroundColor:'#C9A84C',pointRadius:4}]},options:{...chartOpts}});

  // Gastos por cat
  const porCat={};
  appData.gastos.forEach(g=>{if(!porCat[g.cat])porCat[g.cat]=0;porCat[g.cat]+=Number(g.monto);});
  const cats=Object.keys(porCat), vals=Object.values(porCat);
  const colors=['#C9A84C','#3FB950','#58A6FF','#F0B429','#F85149','#A371F7','#79C0FF'];
  if(finCharts.categorias) finCharts.categorias.destroy();
  if(cats.length === 0) {
    finCharts.categorias = new Chart(document.getElementById('chart-categorias'),{type:'doughnut',data:{labels:['Sin gastos'],datasets:[{data:[1],backgroundColor:['rgba(201,168,76,0.15)'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  } else {
    finCharts.categorias = new Chart(document.getElementById('chart-categorias'),{type:'doughnut',data:{labels:cats,datasets:[{data:vals,backgroundColor:colors,borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#7A6A50',font:{size:10},padding:12}}}}});
  }

  // Tabla mensual
  let runAcum=0;
  document.getElementById('tabla-mensual').innerHTML=MONTHS.map((m,i)=>{
    const ing=allIng[i],gas=allGas[i],net=ing-gas; runAcum+=net;
    return `<tr><td style="color:#6A5A40">${m}</td><td class="amount-pos">${fmt(ing)}</td><td class="amount-neg">${fmt(gas)}</td><td class="${net>=0?'amount-pos':'amount-neg'}">${fmt(net)}</td><td style="color:${runAcum>=0?'#3FB950':'#F85149'};font-weight:600">${fmt(runAcum)}</td></tr>`;
  }).join('');
}

// ─── CLIENTES ─────────────────────────────────────────────────
// Cached variant: accepts the already-parsed larryCRM_v2 array so callers
// that iterate over many clients pay the JSON.parse cost only once.
function getProximoCobroCached(finCliente, clClientsArr) {
  const ct = totalCobrado(finCliente);
  const precio = Number(finCliente.precio || 0);
  if (ct >= precio && precio > 0) return null;
  try {
    if (clClientsArr && finCliente.clId) {
      const cl = clClientsArr.find(x => x.id === finCliente.clId);
      if (cl && cl.fechas && cl.fechas.length) {
        const today = todayLocal();
        const sorted = [...cl.fechas].filter(f => f.date).sort((a,b)=>a.date.localeCompare(b.date));
        const next = sorted.find(f => f.date >= today) || sorted[sorted.length - 1];
        if (next) return { date: next.date, label: next.label };
      }
    }
  } catch(e) {}
  if (finCliente.proximoCobro && finCliente.proximoCobro.fecha) {
    return { date: finCliente.proximoCobro.fecha, label: finCliente.proximoCobro.label };
  }
  return null;
}

function getProximoCobro(finCliente) {
  const ct = totalCobrado(finCliente);
  const precio = Number(finCliente.precio || 0);
  if (ct >= precio && precio > 0) return null; // ya pagado
  // 1. Read from larryCRM_v2 fechas
  try {
    const clRaw = localStorage.getItem('larryCRM_v2');
    if (clRaw && finCliente.clId) {
      const clClients = JSON.parse(clRaw);
      const cl = clClients.find(x => x.id === finCliente.clId);
      if (cl && cl.fechas && cl.fechas.length) {
        const today = todayLocal();
        const sorted = [...cl.fechas].filter(f => f.date).sort((a,b)=>a.date.localeCompare(b.date));
        const next = sorted.find(f => f.date >= today) || sorted[sorted.length - 1];
        if (next) return { date: next.date, label: next.label };
      }
    }
  } catch(e) {}
  // 2. Fallback: proximoCobro stored directly on finanzas client
  if (finCliente.proximoCobro && finCliente.proximoCobro.fecha) {
    return { date: finCliente.proximoCobro.fecha, label: finCliente.proximoCobro.label };
  }
  return null;
}

function getMesLabel(client) {
  // El mes debe ser CONSISTENTE con la agrupación de la tabla (que ordena los
  // saldados por el mes del último cobro). Antes leía cl.mesKey de larryCRM_v2,
  // que se setea al mes en que se sincronizó el cliente → mostraba el mes
  // equivocado o "—". Ahora se deriva del dato real del propio cliente.
  let mk = null;
  // 1) Mes del último cobro (idéntico a getCMesKey → coincide con el grupo)
  if (client.pagos && client.pagos.length) {
    const last = [...client.pagos].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))[0];
    if (last && last.fecha) mk = last.fecha.substring(0, 7);
  }
  // 2) Si aún no cobró nada, usar el mes del próximo cobro
  if (!mk && client.proximoCobro && client.proximoCobro.fecha) {
    mk = client.proximoCobro.fecha.substring(0, 7);
  }
  // 3) Último recurso: el mesKey del módulo Clientes (mes del proyecto)
  if (!mk) {
    try {
      const clRaw = localStorage.getItem('larryCRM_v2');
      if (clRaw && client.clId) {
        const cl = JSON.parse(clRaw).find(x => x.id === client.clId);
        if (cl && cl.mesKey) mk = cl.mesKey;
      }
    } catch(e) {}
  }
  if (!mk) return '—';
  const parts = mk.split('-');
  const mi = parseInt(parts[1], 10) - 1;
  if (isNaN(mi) || mi < 0 || mi > 11) return '—';
  return MONTHS[mi] + ' ' + parts[0];
}

let filtroClientesEstado = 'all';

window.setClientesFiltro = function(val) {
  filtroClientesEstado = val;
  const chipAll    = document.getElementById('fcl-chip-all');
  const chipActivo = document.getElementById('fcl-chip-activos');
  if (chipAll && chipActivo) {
    chipAll.style.background    = val === 'all'    ? '#2C2010' : 'transparent';
    chipAll.style.color         = val === 'all'    ? '#EAE4D6' : '#7A6A50';
    chipAll.style.borderColor   = val === 'all'    ? '#C9A84C' : '#CFC9B8';
    chipActivo.style.background = val === 'activo' ? '#2C2010' : 'transparent';
    chipActivo.style.color      = val === 'activo' ? '#EAE4D6' : '#7A6A50';
    chipActivo.style.borderColor= val === 'activo' ? '#C9A84C' : '#CFC9B8';
  }
  renderClientes();
};

function renderClientes() {
  // ── Bug 5 fix: parse larryCRM_v2 once for the whole render ──
  let _clCache = null;
  try {
    const _raw = localStorage.getItem('larryCRM_v2');
    if (_raw) _clCache = JSON.parse(_raw);
  } catch(e) {}

  const q = (document.getElementById('search-clientes').value||'').toLowerCase();
  let list = appData.clientes.filter(c=>!q||c.nombre.toLowerCase().includes(q)||(c.servicio||'').toLowerCase().includes(q));

  // Filtro por estado activo
  if (filtroClientesEstado === 'activo') {
    list = list.filter(c => !c.estado || c.estado === 'activo');
  }

  const today0cl = todayLocal();

  // Split: pendientes vs saldados
  const conPendCl  = list.filter(c => totalPendiente(c) > 0);
  const saldadosCl = list.filter(c => totalPendiente(c) <= 0);

  // Sort pendientes by próximo cobro date (vencidos primero, luego más próximos, sin fecha al final)
  conPendCl.sort((a, b) => {
    const pa = getProximoCobroCached(a, _clCache), pb = getProximoCobroCached(b, _clCache);
    if (!pa && !pb) return a.nombre.localeCompare(b.nombre);
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    const aOver = pa.date < today0cl, bOver = pb.date < today0cl;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return 1;
    return pa.date.localeCompare(pb.date);
  });

  // Group saldados by month of last cobro
  const getCMesKey = (c) => {
    if (c.pagos && c.pagos.length > 0) {
      const last = [...c.pagos].sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
      return last.fecha.substring(0, 7);
    }
    return '__nokey';
  };
  const saldSorted = [...saldadosCl].sort((a,b) => {
    const ka = getCMesKey(a), kb = getCMesKey(b);
    if (ka === '__nokey' && kb === '__nokey') return a.nombre.localeCompare(b.nombre);
    if (ka === '__nokey') return 1;
    if (kb === '__nokey') return -1;
    if (ka !== kb) return kb.localeCompare(ka);
    return a.nombre.localeCompare(b.nombre);
  });
  const groups = {}, groupOrder = [];
  saldSorted.forEach(c => {
    const mk = getCMesKey(c);
    if (!groups[mk]) { groups[mk] = []; groupOrder.push(mk); }
    groups[mk].push(c);
  });

  const makeRow = (c) => {
    const ct=totalCobrado(c),pend=totalPendiente(c),pct=c.precio>0?Math.min(100,(ct/c.precio)*100):0;
    const barClass=pct>=100?'progress-bar':pct>=50?'progress-bar amber':'progress-bar red';
    const crmBadge = c.clId ? `<span title="Sincronizado desde Clientes" style="font-size:9px;background:rgba(74,140,98,0.15);color:#4a8c62;border-radius:3px;padding:1px 5px;margin-left:6px;font-family:'IBM Plex Mono',monospace">🎤</span>` : '';
    let pagoIcon='';
    if(c.precio>0){
      if(pct>=100) pagoIcon=`<span title="Pago completo" style="font-size:11px;margin-left:5px">✅</span>`;
      else if(ct>0) pagoIcon=`<span title="Pago parcial — falta ${fmt(pend)}" style="font-size:11px;margin-left:5px">⚠️</span>`;
      else pagoIcon=`<span title="Sin cobrar" style="font-size:11px;margin-left:5px">🔴</span>`;
    }
    const proxCobro = getProximoCobroCached(c, _clCache);
    let proxHtml = '<span style="color:#9A8A6A;font-size:11px">—</span>';
    if (pct >= 100) {
      proxHtml = '<span style="color:#3FB950;font-size:11px;font-weight:600">✓ Saldado</span>';
    } else if (proxCobro) {
      const isVencido = proxCobro.date < today0cl;
      const color = isVencido ? '#F85149' : '#C9A84C';
      proxHtml = `<div style="font-size:11px;font-weight:600;color:${color}">${fmtDate(proxCobro.date)}</div>${proxCobro.label?`<div style="font-size:10px;color:#9A8A6A">${escT(proxCobro.label)}</div>`:''}`;
    }
    const mesLabel = getMesLabel(c);
    // Bonus entregados desde larryCRM_v2 — usa el caché de renderClientes, no re-lee localStorage
    let bonusHtml = '<span style="color:#9A8A6A;font-size:11px">—</span>';
    try {
      if (_clCache && c.clId) {
        const clC = _clCache.find(x => x.id === c.clId);
        if (clC) {
          const CL_BONUS_LIST_FIN = ['Manual de Marca','Arsenal Creativo','Contrato Beat','Vocals Top','Escucha Top','Guía Lanzamiento Exitoso','Regalo Agenda'];
          const done = (clC.bonus||[]);
          const total = CL_BONUS_LIST_FIN.length;
          const count = done.length;
          const pct = Math.round((count/total)*100);
          const color = count === 0 ? '#9A8A6A' : count === total ? '#3FB950' : '#C9A84C';
          bonusHtml = `<div style="display:flex;align-items:center;gap:6px;cursor:pointer" onclick="openFinBonusPanel('${c.id}','',event)" title="Editar bonus entregados">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${color}">${count}/${total}</span>
            <div style="background:#DDD7C8;border-radius:3px;height:4px;width:48px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div></div>
            <span style="font-size:9px;color:#9A8A6A;margin-left:2px">✎</span>
          </div>`;
        }
      }
    } catch(e) {}
    // Si no tiene clId, mostrar botón para abrir igual (bonus vacíos)
    if (!c.clId && bonusHtml === '<span style="color:#9A8A6A;font-size:11px">—</span>') {
      bonusHtml = `<span style="color:#C8C0AE;font-size:10px;font-style:italic">Sin sync</span>`;
    }
    return `<tr>
      <td><strong>${escT(c.nombre)}</strong>${crmBadge}${pagoIcon}</td>
      <td style="color:#7A6A50">${c.servicio||'—'}</td>
      <td style="font-size:11px;color:#9A8A6A;font-family:'IBM Plex Mono',monospace">${mesLabel}</td>
      <td>${fmt(c.precio)}</td>
      <td class="amount-pos">${fmt(ct)}</td>
      <td class="${pend>0?'amount-neg':''}">${pend>0?fmt(pend):'<span style="color:#3FB950;font-weight:600">—</span>'}</td>
      <td>${proxHtml}</td>
      <td>${bonusHtml}</td>
      <td style="width:100px"><div class="progress-wrap"><div class="${barClass}" style="width:${pct}%"></div></div><span style="font-size:10px;color:#7A6A50">${Math.round(pct)}%</span></td>
      <td>${estadoBadge(c.estado)}</td>
      <td style="display:flex;gap:5px;padding:8px">
        <button class="btn btn-green btn-sm" onclick="openModalPago('${c.id}')">💰 Cobrar</button>
        <button class="btn btn-ghost btn-sm" onclick="openModalCliente('${c.id}')">✎</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCliente('${c.id}')">✕</button>
      </td>
    </tr>`;
  };

  let html = '';

  // Pendientes primero con separador
  if (conPendCl.length) {
    html += `<tr style="background:rgba(248,81,73,0.06)"><td colspan="11" style="padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1.8px;color:#F85149;text-transform:uppercase;border-bottom:1px solid rgba(248,81,73,0.2)">⚡ PENDIENTE DE COBRO</td></tr>`;
    conPendCl.forEach(c => { html += makeRow(c); });
  }

  // Saldados agrupados por mes
  groupOrder.forEach(mk => {
    if (mk !== '__nokey') {
      const [y, m] = mk.split('-');
      const mesTitle = MONTHS[parseInt(m)-1] + ' ' + y;
      html += `<tr style="background:rgba(201,168,76,0.08)"><td colspan="11" style="padding:7px 10px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1.8px;color:#9A8A6A;text-transform:uppercase;border-bottom:1px solid #C8C0AE">◈ ${mesTitle}</td></tr>`;
    }
    groups[mk].forEach(c => { html += makeRow(c); });
  });

  document.getElementById('clientes-body').innerHTML = html || '<tr class="empty-row"><td colspan="11">Sin clientes. Añade el primero o guarda uno desde el módulo Clientes.</td></tr>';
}

function openModalCliente(id=null) {
  window._pendingLeadId = null;
  editingClienteId=id;
  document.getElementById('modal-cliente-title').textContent=id?'Editar cliente':'Nuevo cliente';
  // Set default cobro date to today
  document.getElementById('c-cobro-fecha').value=todayLocal();
  if(id){
    const c=appData.clientes.find(x=>x.id===id);
    document.getElementById('c-nombre').value=c.nombre;
    // Handle servicio select
    const servSel=document.getElementById('c-servicio');
    const validOpts=['Beatmaking','Mix','Master','Mix&Master','Prod Completa','Ep/Lanzamiento'];
    servSel.value=validOpts.includes(c.servicio)?c.servicio:'Beatmaking';
    document.getElementById('c-precio').value=c.precio||'';
    document.getElementById('c-estado').value=c.estado||'activo';
    document.getElementById('c-notas').value=c.notas||'';
    document.getElementById('c-cobro-inicial').value='';
    document.getElementById('c-cobro-nota').value='';
    // Show próximo cobro whenever there's a pending amount; pre-fill stored date
    const pc = c.proximoCobro;
    document.getElementById('c-prox-fecha').value = pc&&pc.fecha ? pc.fecha : '';
    document.getElementById('c-prox-label').value = pc&&pc.label ? pc.label : '';
    const pw=document.getElementById('c-prox-cobro-wrap');
    if(pw) pw.style.display = totalPendiente(c)>0 ? 'block' : 'none';
  } else {
    document.getElementById('c-nombre').value='';
    document.getElementById('c-servicio').value='Beatmaking';
    document.getElementById('c-precio').value='';
    document.getElementById('c-estado').value='activo';
    document.getElementById('c-notas').value='';
    document.getElementById('c-cobro-inicial').value='';
    document.getElementById('c-cobro-nota').value='';
    document.getElementById('c-prox-fecha').value='';
    document.getElementById('c-prox-label').value='';
    const pw=document.getElementById('c-prox-cobro-wrap');if(pw)pw.style.display='none';
  }
  { // v2: datos fiscales
    const c = id ? appData.clientes.find(x=>x.id===id) : null;
    const setv = (k,v) => { const el = document.getElementById(k); if (el) el.value = v; };
    setv('c-nif', c&&c.nif||''); setv('c-tipofiscal', c&&c.tipoFiscal||'particular');
    setv('c-pais', c&&c.pais||'ES'); setv('c-direccion', c&&c.direccion||'');
    const det = document.getElementById('c-fiscal'); if (det) det.open = !!(c && (c.nif || c.direccion));
  }
  cModalCalc();
  const cobroLabel = document.getElementById('c-cobro-section-label');
  if(cobroLabel) cobroLabel.textContent = id ? '➕ Agregar cobro' : '💰 Cobro al registrar';
  document.getElementById('modal-cliente').classList.add('open');
  setTimeout(()=>document.getElementById('c-nombre').focus(), 80);
}
function cModalCalc() {
  const precioRaw=parseFloat(document.getElementById('c-precio').value);
  if(isNaN(precioRaw)||precioRaw<0){
    document.getElementById('c-precio').style.borderColor='#F85149';
    const proxWrapErr=document.getElementById('c-prox-cobro-wrap');
    if(proxWrapErr) proxWrapErr.style.display='none';
    return;
  }
  document.getElementById('c-precio').style.borderColor='';
  const precio=precioRaw||0;
  const cobro=parseFloat(document.getElementById('c-cobro-inicial').value)||0;
  const pend=Math.max(0,precio-cobro);
  const el=document.getElementById('c-pendiente-calc');
  el.textContent=fmt(pend);
  el.style.color=pend<=0?'#3FB950':'#F85149';
  // Mostrar campo de próximo cobro solo si hay pendiente
  const proxWrap=document.getElementById('c-prox-cobro-wrap');
  if(proxWrap) proxWrap.style.display=pend>0?'block':'none';
}
function saveCliente() {
  const nombre=document.getElementById('c-nombre').value.trim();
  if(!nombre){showToast('⚠️ Nombre obligatorio');return;}
  const servicio=document.getElementById('c-servicio').value;
  const precioRaw=parseFloat(document.getElementById('c-precio').value);
  if(isNaN(precioRaw)||precioRaw<0){document.getElementById('c-precio').style.borderColor='#F85149';showToast('⚠️ El precio no puede ser negativo');return;}
  document.getElementById('c-precio').style.borderColor='';
  const precio=precioRaw||0;
  const estado=document.getElementById('c-estado').value;
  const notas=document.getElementById('c-notas').value.trim();
  const cobroMontoRaw=parseFloat(document.getElementById('c-cobro-inicial').value)||0;
  if(cobroMontoRaw<0){document.getElementById('c-cobro-inicial').style.borderColor='#F85149';showToast('⚠️ El cobro no puede ser negativo');return;}
  if(precio>0&&cobroMontoRaw>precio){document.getElementById('c-cobro-inicial').style.borderColor='#F85149';showToast('⚠️ El cobro supera el precio total');return;}
  document.getElementById('c-cobro-inicial').style.borderColor='';
  const cobroMonto=cobroMontoRaw;
  const cobroFecha=document.getElementById('c-cobro-fecha').value||todayLocal();
  const cobroNota=document.getElementById('c-cobro-nota').value.trim();
  const proxFecha=document.getElementById('c-prox-fecha').value||'';
  const proxLabel=document.getElementById('c-prox-label').value.trim()||'Próximo cobro';
  // For edits, real pending = existing pending - new cobro
  const pendienteReal = editingClienteId
    ? Math.max(0, totalPendiente(appData.clientes.find(x=>x.id===editingClienteId)||{precio:precio,pagos:[]}) - cobroMonto)
    : Math.max(0, precio - cobroMonto);
  const obj={nombre,servicio,precio,estado,notas,
    nif:(document.getElementById('c-nif')||{}).value||'',
    tipoFiscal:(document.getElementById('c-tipofiscal')||{}).value||'particular',
    pais:(document.getElementById('c-pais')||{}).value||'ES',
    direccion:(document.getElementById('c-direccion')||{}).value||''};
  // estadoManual: el usuario fijó a propósito un estado NO-completado en un
  // cliente ya saldado → respetarlo y NO auto-completar en ningún flujo.
  obj.estadoManual = (precio>0 && pendienteReal<=0 && estado!=='completado');
  if(proxFecha && pendienteReal>0) obj.proximoCobro={fecha:proxFecha,label:proxLabel};
  else obj.proximoCobro=null;

  if(editingClienteId){
    const i=appData.clientes.findIndex(x=>x.id===editingClienteId);
    appData.clientes[i]={...appData.clientes[i],...obj};
    if(cobroMonto>0){
      if(!appData.clientes[i].pagos)appData.clientes[i].pagos=[];
      appData.clientes[i].pagos.push({id:crypto.randomUUID(),monto:cobroMonto,fecha:cobroFecha,nota:cobroNota||'Cobro adicional'});
    }
  } else {
    const newCl={id:crypto.randomUUID(),...obj,pagos:[]};
    if (window.linkPendingLead) window.linkPendingLead(newCl); // v2: lead convertido
    if(cobroMonto>0){
      newCl.pagos.push({id:crypto.randomUUID(),monto:cobroMonto,fecha:cobroFecha,nota:cobroNota||'Cobro inicial'});
    }
    appData.clientes.push(newCl);
    // ── Auto-sync inmediato: vincula el cliente nuevo a larryCRM_v2 ──
    try {
      const _now2 = new Date();
      const _mesKey2 = _now2.getFullYear() + '-' + String(_now2.getMonth()+1).padStart(2,'0');
      const _clRaw2 = localStorage.getItem('larryCRM_v2');
      const _clList2 = _clRaw2 ? JSON.parse(_clRaw2) : [];
      const _linked2 = new Set(appData.clientes.map(x => x.clId).filter(Boolean));
      const _same2 = _clList2.filter(x => (x.nombre||'').toLowerCase() === (newCl.nombre||'').toLowerCase() && !_linked2.has(x.id));
      const _byName2 = _same2.length === 1 ? _clList2.indexOf(_same2[0]) : -1; // v2: solo si es único y libre
      if (_byName2 >= 0) {
        newCl.clId = _clList2[_byName2].id;
      } else {
        const _newClId2 = 'fin_' + newCl.id;
        _clList2.push({
          id: _newClId2, nombre: newCl.nombre,
          proceso: FIN_PROC_MAP[newCl.servicio] || 'PROD', etapa: 1,
          total: String(newCl.precio || 0), pagado: String(cobroMonto),
          mesKey: _mesKey2, bonus: [], fechas: [], canciones: '', _fromFin: true
        });
        newCl.clId = _newClId2;
      }
      localStorage.setItem('larryCRM_v2', JSON.stringify(_clList2));
    } catch(_e2) {}
  }
  // Sync proximoCobro to larryCRM_v2 fechas so the card in Clientes also lo muestra
  if(proxFecha&&pendienteReal>0){
    try{
      const finC=appData.clientes.find(x=>x.id===(editingClienteId||appData.clientes[appData.clientes.length-1].id));
      if(finC&&finC.clId){
        const clRaw=localStorage.getItem('larryCRM_v2');
        if(clRaw){
          const clClients=JSON.parse(clRaw);
          const ci=clClients.findIndex(x=>x.id===finC.clId);
          if(ci>=0){
            const fechas=clClients[ci].fechas||[];
            // Remove old proxCobro entry and add new one
            clClients[ci].fechas=fechas.filter(f=>f._finProx!==true);
            clClients[ci].fechas.push({label:proxLabel,date:proxFecha,_finProx:true});
            localStorage.setItem('larryCRM_v2',JSON.stringify(clClients));
          }
        }
      }
    }catch(e){}
  }
  save();
  // ─── BRIDGE: Finanzas → CRM_v2 (sync edición) ────────────────
  // Cuando se edita en Finanzas, propaga nombre/precio/pagado al módulo Clientes
  try {
    const _fbrId = editingClienteId || (appData.clientes.length > 0 ? appData.clientes[appData.clientes.length-1].id : null);
    const _fbrC  = _fbrId ? appData.clientes.find(x => x.id === _fbrId) : null;
    if (_fbrC && _fbrC.clId) {
      const _fbrRaw  = localStorage.getItem('larryCRM_v2');
      if (_fbrRaw) {
        const _fbrList = JSON.parse(_fbrRaw);
        const _fbrIdx  = _fbrList.findIndex(x => x.id === _fbrC.clId);
        if (_fbrIdx >= 0) {
          const SRV_TO_PROC = {'Ep/Lanzamiento':'EP','Prod Completa':'PROD','Beatmaking':'BEAT','Mix':'MIX_SOLO','Mix&Master':'MIX','Master':'MASTER'};
          _fbrList[_fbrIdx].nombre = _fbrC.nombre;
          _fbrList[_fbrIdx].total  = String(_fbrC.precio || 0);
          _fbrList[_fbrIdx].pagado = String((_fbrC.pagos||[]).reduce((s,p)=>s+Number(p.monto),0));
          if (SRV_TO_PROC[_fbrC.servicio]) _fbrList[_fbrIdx].proceso = SRV_TO_PROC[_fbrC.servicio];
          if (_fbrC.estado === 'completado') _fbrList[_fbrIdx].etapa = 3;
          localStorage.setItem('larryCRM_v2', JSON.stringify(_fbrList));
          if (typeof window.clReload === 'function') window.clReload();
        }
      }
    }
  } catch(_fbrE) { console.warn('Larry OS: error en bridge Fin→CRM', _fbrE); }
  // ─────────────────────────────────────────────────────────────
  closeModal('modal-cliente');renderClientes();renderDashboard();
  // Auto-completar estado si el cobro llega a 100% — salvo que el usuario
  // haya fijado el estado manualmente (estadoManual) para mantenerlo activo.
  let _shownCompletado = false;
  if(editingClienteId){
    const c=appData.clientes.find(x=>x.id===editingClienteId);
    if(c && !c.estadoManual && c.precio>0 && totalCobrado(c)>=Number(c.precio) && c.estado!=='completado'){
      c.estado='completado'; save();
      showToast(`✅ ${c.nombre} — 100% cobrado. Estado → Completado`);
      _shownCompletado = true;
    }
  }
  if(!_shownCompletado){
    if(cobroMonto>0&&pendienteReal>0) showToast(`✓ Cliente guardado · Cobrado ${fmt(cobroMonto)} · Próx. cobro ${proxFecha?fmtDate(proxFecha):'sin fecha'}`);
    else if(cobroMonto>0) showToast(`✓ Cliente guardado · Pago completo ${fmt(cobroMonto)}`);
    else showToast(editingClienteId?'Cliente actualizado':'Cliente creado ✓');
  }
}
function deleteCliente(id){customConfirm('¿Eliminar este cliente? Esta acción no se puede deshacer.',function(){
  const _del = appData.clientes.find(c=>c.id===id);
  appData.clientes=appData.clientes.filter(c=>c.id!==id);
  save();
  // Quitar también el gemelo en el módulo Clientes (larryCRM_v2) para que no quede
  // colgado como dato fantasma en "Cobros urgentes" u otras vistas.
  try {
    if (_del) {
      const clRaw = localStorage.getItem('larryCRM_v2');
      if (clRaw) {
        const clList = JSON.parse(clRaw);
        // v2: solo por id. Antes, sin id, borraba a TODOS los que se llamaran igual.
        const filtered = _del.clId ? clList.filter(x => x.id !== _del.clId) : clList;
        if (filtered.length !== clList.length) {
          localStorage.setItem('larryCRM_v2', JSON.stringify(filtered));
          if (typeof window.clReload === 'function') window.clReload();
        }
      }
    }
  } catch(e){}
  renderClientes();renderDashboard();renderBalance();showToast('Cliente eliminado');
},'Eliminar');}

// ─── FIN BONUS PANEL ─────────────────────────────────────────
const FIN_BONUS_LIST = ['Manual de Marca','Arsenal Creativo','Contrato Beat','Vocals Top','Escucha Top','Guía Lanzamiento Exitoso','Regalo Agenda'];
let _finBonusClienteId = null;

function openFinBonusPanel(finClienteId, nombre, evt) {
  evt && evt.stopPropagation();
  const c = appData.clientes.find(x => x.id === finClienteId);
  if (!c) { showToast('⚠️ Cliente no encontrado.'); return; }
  // Auto-sync si no tiene clId (clientes creados antes del fix)
  if (!c.clId) {
    try {
      const _now3 = new Date();
      const _mesKey3 = _now3.getFullYear() + '-' + String(_now3.getMonth()+1).padStart(2,'0');
      const _clRaw3 = localStorage.getItem('larryCRM_v2');
      const _clList3 = _clRaw3 ? JSON.parse(_clRaw3) : [];
      const _linked3 = new Set(appData.clientes.map(x => x.clId).filter(Boolean));
      const _same3 = _clList3.filter(x => (x.nombre||'').toLowerCase() === (c.nombre||'').toLowerCase() && !_linked3.has(x.id));
      const _byName3 = _same3.length === 1 ? _clList3.indexOf(_same3[0]) : -1; // v2: solo si es único y libre
      if (_byName3 >= 0) {
        c.clId = _clList3[_byName3].id;
      } else {
        const _newClId3 = 'fin_' + c.id;
        _clList3.push({
          id: _newClId3, nombre: c.nombre,
          proceso: FIN_PROC_MAP[c.servicio] || 'PROD', etapa: 1,
          total: String(c.precio || 0),
          pagado: String((c.pagos||[]).reduce((s,p)=>s+Number(p.monto),0)),
          mesKey: _mesKey3, bonus: [], fechas: [], canciones: '', _fromFin: true
        });
        c.clId = _newClId3;
      }
      localStorage.setItem('larryCRM_v2', JSON.stringify(_clList3));
      save();
    } catch(_e3) { showToast('⚠️ Error al sincronizar cliente.'); return; }
  }

  _finBonusClienteId = finClienteId;

  // Load current bonus from larryCRM_v2
  let currentBonus = [];
  try {
    const raw = localStorage.getItem('larryCRM_v2');
    if (raw) {
      const clC = JSON.parse(raw).find(x => x.id === c.clId);
      if (clC) currentBonus = clC.bonus || [];
    }
  } catch(e) {}

  // Populate panel
  document.getElementById('fin-bonus-panel-name').textContent = nombre || c.nombre;
  document.getElementById('fin-bonus-grid').innerHTML = FIN_BONUS_LIST.map(b => {
    const checked = currentBonus.includes(b);
    return `<div onclick="this.classList.toggle('fin-bon-on'); this.querySelector('.fbb').textContent = this.classList.contains('fin-bon-on') ? '✓' : ''; " 
      class="fin-bon-row ${checked ? 'fin-bon-on' : ''}"
      style="display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:600;
             background:${checked ? 'rgba(63,185,80,0.12)' : 'rgba(44,32,16,0.04)'};
             border:1.5px solid ${checked ? 'rgba(63,185,80,0.35)' : '#CFC9B8'};
             color:${checked ? '#3FB950' : '#7A6A50'};
             transition:all .15s;user-select:none">
      <div class="fbb" style="width:15px;height:15px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;
           background:${checked ? '#3FB950' : 'transparent'};border:1.5px solid ${checked ? '#3FB950' : '#CFC9B8'};color:#fff">${checked ? '✓' : ''}</div>
      ${b}
    </div>`;
  }).join('');

  // Position panel near click
  const panel = document.getElementById('fin-bonus-panel');
  panel.style.display = 'block';
  if (evt) {
    const r = evt.target.closest('td') ? evt.target.closest('td').getBoundingClientRect() : evt.target.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.left;
    if (left + 280 > window.innerWidth - 16) left = window.innerWidth - 296;
    if (top + 320 > window.innerHeight - 16) top = r.top - 330;
    panel.style.top = top + window.scrollY + 'px';
    panel.style.left = left + 'px';
  }

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _finBonusPanelOutside);
  }, 10);
}

function _finBonusPanelOutside(e) {
  const panel = document.getElementById('fin-bonus-panel');
  if (panel && !panel.contains(e.target)) {
    closeFinBonusPanel();
  }
}

function closeFinBonusPanel() {
  document.getElementById('fin-bonus-panel').style.display = 'none';
  _finBonusClienteId = null;
  document.removeEventListener('click', _finBonusPanelOutside);
}

function saveFinBonus() {
  if (!_finBonusClienteId) return;
  const c = appData.clientes.find(x => x.id === _finBonusClienteId);
  if (!c || !c.clId) return;

  // Collect checked bonuses
  const checked = [...document.querySelectorAll('#fin-bonus-grid .fin-bon-row.fin-bon-on')]
    .map(el => el.textContent.trim().replace(/^✓\s*/, '').trim());

  // Save to larryCRM_v2
  try {
    const raw = localStorage.getItem('larryCRM_v2');
    if (raw) {
      const list = JSON.parse(raw);
      const idx = list.findIndex(x => x.id === c.clId);
      if (idx !== -1) {
        list[idx].bonus = checked;
        localStorage.setItem('larryCRM_v2', JSON.stringify(list));
      }
    }
  } catch(e) { showToast('⚠️ Error al guardar bonus'); return; }

  closeFinBonusPanel();
  renderClientes();
  showToast(`✓ Bonus de ${c.nombre} actualizados`);
}

// ─── PAGOS ────────────────────────────────────────────────────
function openModalPago(clienteId) {
  editingPagoClienteId=clienteId;
  const c=appData.clientes.find(x=>x.id===clienteId);
  if(!c){showToast('⚠️ Cliente no encontrado');return;}
  document.getElementById('pago-cliente-nombre').textContent=c.nombre;
  document.getElementById('pago-pendiente-display').textContent=fmt(totalPendiente(c));
  document.getElementById('p-monto').value=totalPendiente(c)>0?totalPendiente(c):''; // v2: propone lo pendiente
  document.getElementById('p-fecha').value=todayLocal();
  document.getElementById('p-nota').value='';
  const hist=document.getElementById('pago-historial');
  hist.innerHTML=(!c.pagos||!c.pagos.length)
    ?'<div style="color:#9A8A6A;font-size:11px;font-style:italic;font-family:\'IBM Plex Mono\',monospace">Sin pagos registrados</div>'
    :[...c.pagos].reverse().map(p=>`<div class="pago-item"><button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;margin-right:6px" title="${p.factura?'Ver factura '+escT(p.factura.num):'Emitir factura de este cobro'}" onclick="fiscalFactura('${c.id}','${p.id}')">🧾${p.factura?' '+escT(p.factura.num):''}</button><div><span style="font-weight:600">${fmt(p.monto)}</span>${p.nota?`<span style="color:#9A8A6A;margin-left:8px">${escT(p.nota)}</span>`:''}</div><div style="display:flex;align-items:center;gap:6px"><span style="color:#9A8A6A">${fmtDate(p.fecha)}</span><button class="btn btn-danger btn-sm" onclick="deletePago('${clienteId}','${p.id}')">✕</button></div></div>`).join('');
  document.getElementById('modal-pago').classList.add('open');
  setTimeout(()=>document.getElementById('p-monto').focus(), 80);
}
function savePago() {
  const monto=parseFloat(document.getElementById('p-monto').value),fecha=document.getElementById('p-fecha').value;
  if(!monto||monto<=0){showToast('⚠️ Monto inválido');return;}if(!fecha){showToast('⚠️ Selecciona una fecha');return;}
  const c=appData.clientes.find(x=>x.id===editingPagoClienteId);
  if(!c.pagos)c.pagos=[];
  c.pagos.push({id:crypto.randomUUID(),monto,fecha,nota:document.getElementById('p-nota').value.trim()});
  // Fix 4: auto-completar estado si llegó al 100% — salvo estado fijado manualmente
  const totalCobradoActual = c.pagos.reduce((s,p)=>s+Number(p.monto),0);
  let toastMsg = `Cobro de ${fmt(monto)} registrado ✓`;
  if(!c.estadoManual && c.precio>0 && totalCobradoActual>=Number(c.precio) && c.estado!=='completado'){
    c.estado='completado';
    toastMsg = `✅ ${c.nombre} — pago completo. Estado → Completado`;
  }
  save();
  // ─── BRIDGE: sync pagado → larryCRM_v2 ───────────────────────
  try {
    const _spTotalCobrado = c.pagos.reduce((s,p)=>s+Number(p.monto),0);
    const _spRaw = localStorage.getItem('larryCRM_v2');
    if (_spRaw && c.clId) {
      const _spList = JSON.parse(_spRaw);
      const _spIdx  = _spList.findIndex(x => x.id === c.clId);
      if (_spIdx >= 0) {
        _spList[_spIdx].pagado = String(_spTotalCobrado);
        if (c.estado === 'completado') _spList[_spIdx].etapa = 3;
        localStorage.setItem('larryCRM_v2', JSON.stringify(_spList));
        if (typeof window.clReload === 'function') window.clReload();
      }
    }
  } catch(_spE) {}
  // ─────────────────────────────────────────────────────────────
  openModalPago(editingPagoClienteId);renderClientes();renderDashboard();showToast(toastMsg);
}
function deletePago(clienteId,pagoId){
  const c0=appData.clientes.find(x=>x.id===clienteId);
  const p0=c0&&(c0.pagos||[]).find(p=>p.id===pagoId);
  // v2: pedir confirmación antes de borrar un cobro
  customConfirm('¿Eliminar el cobro de '+fmt(Number(p0?p0.monto:0))+(p0&&p0.fecha?' del '+fmtDate(p0.fecha):'')+'?', function(){ _deletePagoOk(clienteId,pagoId); }, 'Eliminar');
}
function _deletePagoOk(clienteId,pagoId){
  const c=appData.clientes.find(x=>x.id===clienteId);
  if(!c){showToast('⚠️ Cliente no encontrado');return;}
  c.pagos=c.pagos.filter(p=>p.id!==pagoId);
  save();
  // ─── BRIDGE: sync pagado reducido → larryCRM_v2 ──────────────
  try {
    const _dpTotal = (c.pagos||[]).reduce((s,p)=>s+Number(p.monto),0);
    const _dpRaw   = localStorage.getItem('larryCRM_v2');
    if (_dpRaw && c.clId) {
      const _dpList = JSON.parse(_dpRaw);
      const _dpIdx  = _dpList.findIndex(x => x.id === c.clId);
      if (_dpIdx >= 0) {
        _dpList[_dpIdx].pagado = String(_dpTotal);
        // Si bajó de 100%, restaurar etapa a En Revisión si estaba Terminado
        if (c.estado !== 'completado' && parseInt(_dpList[_dpIdx].etapa) >= 3) {
          _dpList[_dpIdx].etapa = 2;
        }
        localStorage.setItem('larryCRM_v2', JSON.stringify(_dpList));
        if (typeof window.clReload === 'function') window.clReload();
      }
    }
  } catch(_dpE) {}
  // ─────────────────────────────────────────────────────────────
  openModalPago(clienteId);renderClientes();renderDashboard();showToast('Pago eliminado');
}

// ─── GASTOS ───────────────────────────────────────────────────
function renderGastos() {
  const mes=getSelectedMonth();
  document.getElementById('gastos-period').textContent=getMonthLabel()+' '+YEAR;
  let gm=gastosEnMes(mes);
  if(activeCat!=='todas')gm=gm.filter(g=>g.cat===activeCat);
  gm.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const allCats=[...new Set(gastosEnMes(mes).map(g=>g.cat))];
  document.getElementById('cat-filters').innerHTML=`<button class="cat-pill ${activeCat==='todas'?'active':''}" onclick="filterCat('todas')">Todas</button>`+allCats.map(c=>`<button class="cat-pill ${activeCat===c?'active':''}" onclick="filterCat('${c}')">${c}</button>`).join('');
  document.getElementById('gastos-body').innerHTML=gm.map(g=>`<tr><td><strong>${g.desc}</strong></td><td><span class="badge badge-gray">${g.cat}</span></td><td style="color:#7A6A50">${fmtDate(g.fecha)}</td><td class="amount-neg">${fmt(g.monto)}</td><td style="display:flex;gap:5px;padding:8px"><button class="btn btn-ghost btn-sm" onclick="openModalGasto('${g.id}')">✎</button><button class="btn btn-danger btn-sm" onclick="deleteGasto('${g.id}')">✕</button></td></tr>`).join('')||'<tr class="empty-row"><td colspan="5">Sin gastos en este mes</td></tr>';
  // Render balance inline
  renderBalance();
}
function filterCat(cat){activeCat=cat;renderGastos();}
function openModalGasto(id=null){
  const g=id?appData.gastos.find(x=>x.id===id):null;
  document.getElementById('g-id').value=id||'';
  document.getElementById('modal-gasto-title').textContent=g?'Editar gasto':'Nuevo gasto';
  document.getElementById('g-btn-save').textContent=g?'Guardar cambios':'Guardar gasto';
  document.getElementById('g-btn-delete').style.display=g?'':'none';
  document.getElementById('g-desc').value=g?g.desc:'';
  document.getElementById('g-cat').value=g?g.cat:'Meta Ads';
  document.getElementById('g-monto').value=g?g.monto:'';
  document.getElementById('g-fecha').value=g?g.fecha:todayLocal();
  if(document.getElementById('g-iva')){ document.getElementById('g-iva').value=g&&g.ivaSoportado?g.ivaSoportado:''; document.getElementById('g-deducible').checked=g?g.deducible!==false:true; document.getElementById('g-proveedor').value=g&&g.proveedor||''; }
  document.getElementById('modal-gasto').classList.add('open');
  setTimeout(()=>document.getElementById('g-desc').focus(), 80);
}
function deleteGastoFromModal(){
  const id=document.getElementById('g-id').value;
  if(!id)return;
  customConfirm('¿Eliminar este gasto?',function(){
    // Usar 'id' capturado antes del confirm (no releer del DOM, el modal puede haberse cerrado)
    appData.gastos=appData.gastos.filter(g=>g.id!==id);
    save();closeModal('modal-gasto');renderGastos();renderDashboard();showToast('Gasto eliminado');
  },'Eliminar');
}
function saveGasto(){
  const desc=document.getElementById('g-desc').value.trim();
  if(!desc){document.getElementById('g-desc').style.borderColor='#F85149';showToast('⚠️ Descripción obligatoria');return;}
  document.getElementById('g-desc').style.borderColor='';
  const montoRaw=parseFloat(document.getElementById('g-monto').value)||0;
  if(montoRaw<=0){document.getElementById('g-monto').style.borderColor='#F85149';showToast('⚠️ Ingresa un monto válido (> 0)');return;}
  document.getElementById('g-monto').style.borderColor='';
  const monto=montoRaw;
  const id=document.getElementById('g-id').value;
  const cat=document.getElementById('g-cat').value;
  const fecha=document.getElementById('g-fecha').value;
  const ivaSoportado=parseFloat((document.getElementById('g-iva')||{}).value)||0;
  const deducible=!!(document.getElementById('g-deducible')||{}).checked;
  const proveedor=((document.getElementById('g-proveedor')||{}).value||'').trim();
  if(!fecha){document.getElementById('g-fecha').style.borderColor='#F85149';showToast('⚠️ Selecciona una fecha');return;}
  document.getElementById('g-fecha').style.borderColor='';
  if(id){
    const i=appData.gastos.findIndex(g=>g.id===id);
    if(i>=0)appData.gastos[i]={...appData.gastos[i],desc,cat,monto,fecha,ivaSoportado,deducible,proveedor};
    save();closeModal('modal-gasto');renderGastos();renderDashboard();
    showToast('Gasto actualizado ✓');
  } else {
    appData.gastos.push({id:crypto.randomUUID(),desc,cat,monto,fecha,ivaSoportado,deducible,proveedor});
    save();closeModal('modal-gasto');renderGastos();renderDashboard();
    showToast('Gasto guardado ✓');
  }
}
function deleteGasto(id){customConfirm('¿Eliminar este gasto?',function(){appData.gastos=appData.gastos.filter(g=>g.id!==id);save();renderGastos();renderDashboard();showToast('Gasto eliminado');},'Eliminar');}

// ─── BALANCE ──────────────────────────────────────────────────
function renderBalance() {
  const mes=getSelectedMonth(),label=getMonthLabel();
  document.getElementById('balance-month-label').textContent=label+' '+YEAR;
  const ing=ingresosEnMes(mes),gas=totalGastosEnMes(mes),neto=ing-gas;
  document.getElementById('bal-ingresos').textContent=fmt(ing);
  document.getElementById('bal-gastos').textContent=fmt(gas);
  const ne=document.getElementById('bal-neto');ne.textContent=fmt(neto);ne.className='kpi-value '+(neto>=0?'green':'red');
  const list=document.getElementById('balance-clientes-list');
  list.innerHTML=!appData.clientes.length?'<div style="color:#9A8A6A;font-style:italic;font-size:12px;font-family:\'IBM Plex Mono\',monospace">Sin clientes registrados</div>':appData.clientes.map(c=>{
    const cm=cobradoEnMes(c,mes),ct=totalCobrado(c),pend=totalPendiente(c),pct=c.precio>0?Math.min(100,(ct/c.precio)*100):0;
    return `<div class="bal-cliente"><div class="bal-cliente-header"><div><div style="font-weight:600;font-size:14px;color:#2C2010">${escT(c.nombre)}</div><div style="font-size:11px;color:#7A6A50">${c.servicio||'—'}</div></div><div>${estadoBadge(c.estado)}</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:4px">
      <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9A8A6A;margin-bottom:3px;font-family:'IBM Plex Mono',monospace">Precio total</div><div style="font-weight:600;color:#2C2010">${fmt(c.precio)}</div></div>
      <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9A8A6A;margin-bottom:3px;font-family:'IBM Plex Mono',monospace">Cobrado total</div><div style="font-weight:600;color:#3FB950">${fmt(ct)}</div></div>
      <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9A8A6A;margin-bottom:3px;font-family:'IBM Plex Mono',monospace">Cobrado ${label}</div><div style="font-weight:600;color:${cm>0?'#3FB950':'#9A8A6A'}">${fmt(cm)}</div></div>
      <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9A8A6A;margin-bottom:3px;font-family:'IBM Plex Mono',monospace">Pendiente</div><div style="font-weight:600;color:${pend>0?'#F85149':'#3FB950'}">${fmt(pend)}</div></div>
    </div>
    <div style="margin-top:8px"><div class="progress-wrap"><div class="${pct>=100?'progress-bar':pct>=50?'progress-bar amber':'progress-bar red'}" style="width:${pct}%"></div></div><span style="font-size:10px;color:#9A8A6A">${Math.round(pct)}% cobrado</span></div></div>`;
  }).join('');
  const porCat={};gastosEnMes(mes).forEach(g=>{if(!porCat[g.cat])porCat[g.cat]={count:0,total:0};porCat[g.cat].count++;porCat[g.cat].total+=Number(g.monto);});
  document.getElementById('balance-cat-body').innerHTML=Object.entries(porCat).sort((a,b)=>b[1].total-a[1].total).map(([cat,v])=>`<tr><td><span class="badge badge-gray">${cat}</span></td><td style="color:#7A6A50">${v.count}</td><td class="amount-neg">${fmt(v.total)}</td></tr>`).join('')||'<tr class="empty-row"><td colspan="3">Sin gastos en este mes</td></tr>';
}

// ─── MODALS ───────────────────────────────────────────────────
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  if(id==='modal-gasto') document.getElementById('g-id').value='';
}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));

// ─── PRÓXIMAS LLAMADAS (Google Sheet via Zapier / iCal) ───────
window.ProxLlamadas = (function(){
  const KEY_TYPE   = 'larryOS_pll_sourceType';  // 'sheet' | 'ics' | ''
  const KEY_SHEET  = 'larryOS_pll_sheetUrl';
  const KEY_ICS    = 'larryOS_pll_icsUrl';
  const KEY_MANUAL = 'larryOS_pll_manual';
  const KEY_CACHE  = 'larryOS_pll_cache';
  const CACHE_TTL  = 5 * 60 * 1000; // 5 minutes
  const ICS_PROXY  = 'https://corsproxy.io/?url=';

  let _state = { calEvents: [], lastFetch: 0, fetching: false };

  function loadManual(){ try { return JSON.parse(localStorage.getItem(KEY_MANUAL) || '[]'); } catch(e){ return []; } }
  function saveManualList(arr){ localStorage.setItem(KEY_MANUAL, JSON.stringify(arr)); }
  function getSourceType(){ return localStorage.getItem(KEY_TYPE) || ''; }
  function getSheetUrl(){ return localStorage.getItem(KEY_SHEET) || ''; }
  function setSheetUrl(u){ if(u) localStorage.setItem(KEY_SHEET, u); else localStorage.removeItem(KEY_SHEET); }
  function getIcsUrl(){ return localStorage.getItem(KEY_ICS) || ''; }
  function setIcsUrl(u){ if(u) localStorage.setItem(KEY_ICS, u); else localStorage.removeItem(KEY_ICS); }
  function getActiveUrl(){
    const t = getSourceType();
    if (t === 'sheet') return getSheetUrl();
    if (t === 'ics')   return getIcsUrl();
    return '';
  }

  function loadCache(){
    try {
      const raw = localStorage.getItem(KEY_CACHE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }
  function saveCache(events){
    localStorage.setItem(KEY_CACHE, JSON.stringify({ ts: Date.now(), events }));
  }

  // ══════════════════════════════════════════════════
  // CSV PARSER (RFC 4180-ish: handles quotes, escaped quotes, embedded newlines/commas)
  // ══════════════════════════════════════════════════
  function parseCSV(text){
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i+1] === '"') { cur += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cur += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(cur); cur = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += c; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.length && r.some(v => v.trim() !== ''));
  }

  function normalizeKey(k){
    return (k||'').toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
      .replace(/[^a-z0-9]/g, '');
  }

  // Map of normalized column names → canonical field
  const COL_MAP = {
    // datetime combined
    start: 'start', starttime: 'start', starttdatetime: 'start', starttdate: 'start',
    startdate: 'start', startdatetime: 'start', datetime: 'start', when: 'start',
    timestamp: 'start', fechahora: 'start',
    // date alone
    fecha: 'date', date: 'date', day: 'date', dia: 'date',
    // time alone
    hora: 'time', time: 'time', hour: 'time',
    // title / client
    cliente: 'title', client: 'title', name: 'title', nombre: 'title',
    invitee: 'title', inviteename: 'title', inviteefullname: 'title',
    title: 'title', titulo: 'title', subject: 'title', asunto: 'title',
    event: 'title', eventname: 'title', eventtype: 'title',
    // link
    link: 'link', url: 'link', joinurl: 'link', meetinglink: 'link',
    location: 'link', meet: 'link', zoom: 'link', enlace: 'link',
    // notes
    notes: 'notes', notas: 'notes', description: 'notes', descripcion: 'notes',
    answers: 'notes', message: 'notes', mensaje: 'notes',
    // email (we attach to notes)
    email: 'email', mail: 'email', correo: 'email',
    // status (to filter cancellations)
    status: 'status', estado: 'status'
  };

  function parseFlexibleDate(s){
    if (!s) return null;
    s = s.toString().trim();
    if (!s) return null;
    // Try ISO 8601 first
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    // Try DD/MM/YYYY HH:MM
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) {
      const [_, dd, mo, yRaw, hh, mm] = m;
      let y = +yRaw; if (y < 100) y += 2000;
      return new Date(y, +mo - 1, +dd, +hh || 0, +mm || 0);
    }
    // Try YYYY-MM-DD HH:MM
    m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0);
    }
    return null;
  }

  function combineDateTime(dateStr, timeStr){
    const d = parseFlexibleDate(dateStr);
    if (!d) return null;
    if (timeStr) {
      const tm = timeStr.toString().match(/(\d{1,2}):(\d{2})/);
      if (tm) {
        d.setHours(+tm[1], +tm[2], 0, 0);
      }
    }
    return d;
  }

  function parseSheet(csvText){
    const rows = parseCSV(csvText);
    if (rows.length < 2) return [];

    // Map header columns
    const headers = rows[0].map(h => COL_MAP[normalizeKey(h)] || normalizeKey(h));

    const events = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const obj = {};
      headers.forEach((field, i) => { obj[field] = (row[i] || '').trim(); });

      // Skip cancelled
      if (obj.status && /cancel/i.test(obj.status)) continue;

      // Determine start datetime
      let start = null;
      if (obj.start) start = parseFlexibleDate(obj.start);
      else if (obj.date) start = combineDateTime(obj.date, obj.time);

      if (!start || isNaN(start.getTime())) continue;
      if (!obj.title) continue;

      // Build a friendly notes string combining email + notes
      let notes = obj.notes || '';
      if (obj.email && !notes.includes(obj.email)) {
        notes = notes ? (notes + ' · ' + obj.email) : obj.email;
      }

      events.push({
        uid: 'sheet-' + r,
        title: obj.title,
        start,
        link: obj.link || '',
        notes
      });
    }
    return events;
  }

  // ══════════════════════════════════════════════════
  // ICS PARSER (kept from v1.8)
  // ══════════════════════════════════════════════════
  function unfoldICS(text){
    return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  }

  function parseICSDate(val){
    if (!val) return null;
    const m = val.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?/);
    if (!m) return null;
    const [_, y, mo, d, hh, mm, ss, z] = m;
    if (!hh) return new Date(+y, +mo - 1, +d, 0, 0, 0);
    if (z === 'Z') return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss || 0));
    return new Date(+y, +mo - 1, +d, +hh, +mm, +ss || 0);
  }

  function unescapeICS(s){
    if (!s) return '';
    return s.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
  }

  function parseICS(text){
    const events = [];
    const unfolded = unfoldICS(text);
    const blocks = unfolded.split('BEGIN:VEVENT').slice(1);
    for (const block of blocks) {
      const end = block.indexOf('END:VEVENT');
      const body = end >= 0 ? block.slice(0, end) : block;
      const lines = body.split(/\r?\n/);
      const ev = {};
      for (const line of lines) {
        if (!line) continue;
        const idx = line.indexOf(':');
        if (idx < 0) continue;
        const keyPart = line.slice(0, idx);
        const value = line.slice(idx + 1);
        const key = keyPart.split(';')[0].toUpperCase();
        if (key === 'SUMMARY')         ev.title = unescapeICS(value);
        else if (key === 'DTSTART')    ev.start = parseICSDate(value);
        else if (key === 'DTEND')      ev.end   = parseICSDate(value);
        else if (key === 'DESCRIPTION')ev.notes = unescapeICS(value);
        else if (key === 'LOCATION')   ev.location = unescapeICS(value);
        else if (key === 'URL')        ev.link  = unescapeICS(value);
        else if (key === 'UID')        ev.uid   = value;
        else if (key === 'STATUS')     ev.status= value.toUpperCase();
      }
      if (ev.start && ev.title && ev.status !== 'CANCELLED') {
        if (!ev.link && ev.notes) {
          const lm = ev.notes.match(/https?:\/\/[^\s]+/);
          if (lm) ev.link = lm[0];
        }
        events.push(ev);
      }
    }
    return events;
  }

  // ══════════════════════════════════════════════════
  // UNIFIED FETCH (sheet directly / ics via proxy)
  // ══════════════════════════════════════════════════
  async function fetchRemote(force){
    const type = getSourceType();
    const url = getActiveUrl();
    if (!type || !url) return [];

    const cache = loadCache();
    const now = Date.now();
    if (!force && cache && (now - cache.ts) < CACHE_TTL) {
      _state.calEvents = (cache.events || []).map(e => ({ ...e, start: new Date(e.start), end: e.end ? new Date(e.end) : null }));
      return _state.calEvents;
    }
    if (_state.fetching) return _state.calEvents;
    _state.fetching = true;

    try {
      let events = [];
      if (type === 'sheet') {
        // Google Sheets published as CSV — CORS is open, no proxy needed
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        events = parseSheet(text);
      } else if (type === 'ics') {
        let fetchUrl = url.replace(/^webcal:\/\//i, 'https://');
        const resp = await fetch(ICS_PROXY + encodeURIComponent(fetchUrl), { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        events = parseICS(text);
      }
      _state.calEvents = events;
      _state.lastFetch = now;
      saveCache(events.map(e => ({ ...e, start: e.start.toISOString(), end: e.end ? e.end.toISOString() : null })));
      return events;
    } catch(err) {
      console.warn('ProxLlamadas: error al sincronizar:', err);
      if (cache) {
        _state.calEvents = (cache.events || []).map(e => ({ ...e, start: new Date(e.start), end: e.end ? new Date(e.end) : null }));
      }
      return _state.calEvents;
    } finally {
      _state.fetching = false;
    }
  }

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════
  function fmtRelDate(d){
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((target - today) / 86400000);
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return {
      day: target.getDate(),
      month: meses[target.getMonth()],
      time: d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'),
      isToday: diff === 0,
      isTomorrow: diff === 1,
      relLabel: diff === 0 ? 'Hoy' : (diff === 1 ? 'Mañana' : (diff < 0 ? `Hace ${-diff}d` : null)),
      overdue: diff < 0
    };
  }

  function getCombined(){
    const manual = loadManual().map(m => ({
      ...m,
      start: new Date(m.start),
      source: 'manual'
    }));
    const cal = (_state.calEvents || []).map(e => ({ ...e, source: 'cal' }));
    const all = [...manual, ...cal];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Show all future events from today onwards (no upper cutoff)
    // Cap at 6 items in the visual
    return all
      .filter(e => e.start >= startOfToday)
      .sort((a,b) => a.start - b.start)
      .slice(0, 6);
  }

  function escHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function sourceLabel(){
    const type = getSourceType();
    if (type === 'sheet') return '◉ Google Sheet';
    if (type === 'ics') {
      const u = getIcsUrl();
      if (u.includes('zcal')) return '◉ Zcal';
      if (u.includes('google')) return '◉ Google Cal';
      return '◉ iCal';
    }
    return '';
  }

  function render(){
    const body = document.getElementById('dash-pll-body');
    const srcLabel = document.getElementById('dash-pll-source');
    if (!body) return;
    if (srcLabel) srcLabel.textContent = sourceLabel();

    const items = getCombined();
    if (!items.length) {
      const hasRemote = !!getActiveUrl();
      body.innerHTML = `<div class="pll-empty">
        Sin llamadas próximas.<br>
        ${hasRemote ? '' : '<span style="font-size:11px">Conecta tu calendario con <strong>⚙</strong> o añade una llamada con <strong>+ Llamada</strong></span>'}
      </div>`;
      return;
    }

    body.innerHTML = items.map(ev => {
      const f = fmtRelDate(ev.start);
      const cls = 'pll-item' + (f.isToday ? ' today' : '') + (f.overdue ? ' overdue' : '');
      const linkHtml = (ev.link && /^https?:\/\//i.test(ev.link)) ? `<a href="${escHtml(ev.link)}" target="_blank" rel="noopener" title="${escHtml(ev.link)}">🔗 Abrir link</a>` : '';
      const locHtml = ev.location && !ev.link ? `📍 ${escHtml(ev.location)}` : '';
      const notesHtml = ev.notes ? escHtml(ev.notes).slice(0, 80) + (ev.notes.length > 80 ? '…' : '') : '';
      const metaParts = [linkHtml, locHtml, notesHtml].filter(Boolean);
      const badge = ev.source === 'manual'
        ? '<span class="pll-badge src-manual">Manual</span>'
        : '<span class="pll-badge src-cal">Calendario</span>';
      const editBtn = ev.source === 'manual'
        ? `<button onclick="ProxLlamadas.openAdd('${ev.id}')" title="Editar">✎</button>`
        : '';
      const relTag = f.relLabel ? `<span style="color:#C9A84C;font-weight:600;font-size:10px;letter-spacing:.05em;text-transform:uppercase;margin-right:6px">${f.relLabel}</span>` : '';
      return `
        <div class="${cls}">
          <div class="pll-date">
            <div class="pll-date-day">${f.day}</div>
            <div class="pll-date-month">${f.month}</div>
            <div class="pll-date-time">${f.time}</div>
          </div>
          <div class="pll-info">
            <div class="pll-title">${relTag}${escHtml(ev.title)}</div>
            <div class="pll-meta">${metaParts.join(' &middot; ')} ${badge}</div>
          </div>
          <div class="pll-actions">${editBtn}</div>
        </div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════
  async function refresh(){
    if (getActiveUrl()) {
      showToast('↻ Sincronizando...');
      await fetchRemote(true);
    }
    render();
    if (getActiveUrl()) showToast('✓ Calendario actualizado');
  }

  function setSourceTab(type){
    document.getElementById('pll-tab-sheet').classList.toggle('active', type === 'sheet');
    document.getElementById('pll-tab-ics').classList.toggle('active', type === 'ics');
    document.getElementById('pll-pane-sheet').style.display = type === 'sheet' ? '' : 'none';
    document.getElementById('pll-pane-ics').style.display = type === 'ics' ? '' : 'none';
  }

  function openConfig(){
    const currentType = getSourceType() || 'sheet';
    document.getElementById('pll-sheet-url').value = getSheetUrl();
    document.getElementById('pll-ics-url').value = getIcsUrl();
    document.getElementById('pll-btn-disconnect').style.display = getActiveUrl() ? 'inline-flex' : 'none';
    setSourceTab(currentType);
    document.getElementById('modal-pll-config').classList.add('open');
  }

  async function saveConfig(){
    // Detect active tab
    const isSheet = document.getElementById('pll-tab-sheet').classList.contains('active');
    const type = isSheet ? 'sheet' : 'ics';
    const url = (isSheet ? document.getElementById('pll-sheet-url').value : document.getElementById('pll-ics-url').value).trim();

    if (!url) { showToast('⚠ Pega una URL válida'); return; }
    if (!/^https?:\/\/|^webcal:\/\//i.test(url)) { showToast('⚠ La URL debe empezar por https:// o webcal://'); return; }

    if (isSheet) {
      // Sanity check: should be a Google Sheets CSV URL
      if (!/docs\.google\.com.*spreadsheets/i.test(url)) {
        if (!confirm('La URL no parece de Google Sheets. ¿Guardar igual?')) return;
      }
      if (!/output=csv|format=csv/i.test(url)) {
        showToast('⚠ La URL debe ser CSV (terminar en output=csv)');
        return;
      }
      setSheetUrl(url);
    } else {
      setIcsUrl(url);
    }
    localStorage.setItem(KEY_TYPE, type);
    localStorage.removeItem(KEY_CACHE);
    closeModal('modal-pll-config');
    showToast('↻ Sincronizando...');
    await fetchRemote(true);
    render();
    const count = _state.calEvents.length;
    showToast(`✓ Conectado · ${count} evento${count === 1 ? '' : 's'}`);
  }

  function disconnect(){
    if (!confirm('¿Desconectar el calendario? Tus llamadas manuales no se borrarán.')) return;
    localStorage.removeItem(KEY_TYPE);
    setSheetUrl('');
    setIcsUrl('');
    localStorage.removeItem(KEY_CACHE);
    _state.calEvents = [];
    closeModal('modal-pll-config');
    render();
    showToast('✓ Calendario desconectado');
  }

  function openAdd(id){
    const modal = document.getElementById('modal-pll-add');
    document.getElementById('pll-id').value = id || '';
    document.getElementById('modal-pll-add-title').textContent = id ? 'Editar llamada' : 'Nueva llamada';
    document.getElementById('pll-btn-delete').style.display = id ? 'inline-flex' : 'none';
    if (id) {
      const item = loadManual().find(x => x.id === id);
      if (item) {
        const d = new Date(item.start);
        document.getElementById('pll-title').value = item.title || '';
        document.getElementById('pll-date').value = toLocalISO(d);
        document.getElementById('pll-time').value = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        document.getElementById('pll-link').value = item.link || '';
        document.getElementById('pll-notes').value = item.notes || '';
      }
    } else {
      document.getElementById('pll-title').value = '';
      const now = new Date();
      document.getElementById('pll-date').value = toLocalISO(now);
      document.getElementById('pll-time').value = '10:00';
      document.getElementById('pll-link').value = '';
      document.getElementById('pll-notes').value = '';
    }
    modal.classList.add('open');
  }

  function saveManual(){
    const id = document.getElementById('pll-id').value || ('m' + Date.now());
    const title = document.getElementById('pll-title').value.trim();
    const date = document.getElementById('pll-date').value;
    const time = document.getElementById('pll-time').value || '10:00';
    const link = document.getElementById('pll-link').value.trim();
    const notes = document.getElementById('pll-notes').value.trim();
    if (!title) { showToast('⚠ Falta el título'); return; }
    if (!date)  { showToast('⚠ Falta la fecha'); return; }
    const start = new Date(date + 'T' + time + ':00').toISOString();
    const list = loadManual().filter(x => x.id !== id);
    list.push({ id, title, start, link, notes });
    saveManualList(list);
    closeModal('modal-pll-add');
    render();
    showToast('✓ Llamada guardada');
  }

  function deleteManual(){
    const id = document.getElementById('pll-id').value;
    if (!id) return;
    if (!confirm('¿Eliminar esta llamada?')) return;
    const list = loadManual().filter(x => x.id !== id);
    saveManualList(list);
    closeModal('modal-pll-add');
    render();
    showToast('✓ Llamada eliminada');
  }

  function init(){
    // Migrate from v1.8: if old KEY_ICS exists alone, set type to 'ics'
    if (!getSourceType() && getIcsUrl()) {
      localStorage.setItem(KEY_TYPE, 'ics');
    }
    const cache = loadCache();
    if (cache && cache.events) {
      _state.calEvents = cache.events.map(e => ({ ...e, start: new Date(e.start), end: e.end ? new Date(e.end) : null }));
    }
    if (getActiveUrl()) {
      fetchRemote(false).then(() => render());
    }
  }

  setTimeout(init, 100);

  return { render, refresh, openConfig, saveConfig, disconnect, openAdd, saveManual, deleteManual, setSourceTab };
})();

// ─── PDF ANUAL ────────────────────────────────────────────────
function printAnualPDF() {
  const year = YEAR;
  const fmtP = n => '€' + (n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});

  // ── Calcular datos anuales ──
  const allIng  = MONTHS.map((_,i) => appData.clientes.reduce((s,c) => s + cobradoEnMes(c,i+1), 0));
  const allGas  = MONTHS.map((_,i) => gastosEnMes(i+1).reduce((s,g) => s+Number(g.monto),0));
  const allNet  = allIng.map((v,i) => v - allGas[i]);
  const totIng  = allIng.reduce((s,v)=>s+v,0);
  const totGas  = allGas.reduce((s,v)=>s+v,0);
  const totNet  = totIng - totGas;
  const totPend = appData.clientes.reduce((s,c)=>s+totalPendiente(c),0);

  // ── Tabla mensual ──
  let acum = 0;
  const filasMeses = MONTHS.map((m,i) => {
    const ing = allIng[i], gas = allGas[i], net = allNet[i];
    acum += net;
    const netColor = net >= 0 ? '#2e7d32' : '#c62828';
    const acumColor = acum >= 0 ? '#2e7d32' : '#c62828';
    return `<tr>
      <td>${m}</td>
      <td class="num green">${fmtP(ing)}</td>
      <td class="num red">${fmtP(gas)}</td>
      <td class="num" style="color:${netColor};font-weight:600">${fmtP(net)}</td>
      <td class="num" style="color:${acumColor};font-weight:600">${fmtP(acum)}</td>
    </tr>`;
  }).join('');

  // ── Tabla clientes ──
  const filasClientes = appData.clientes.length
    ? appData.clientes.map(c => {
        const ct = totalCobrado(c), pend = totalPendiente(c);
        const pct = c.precio > 0 ? Math.min(100,(ct/c.precio)*100) : 0;
        const estadoColor = {activo:'#1b5e20',completado:'#e65100',pausado:'#555',cancelado:'#b71c1c'}[c.estado]||'#555';
        // Historial de pagos de este cliente
        const pagosHtml = (c.pagos||[]).length
          ? (c.pagos||[]).sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(p =>
              `<div style="font-size:10px;color:#555;margin-top:2px">↳ ${fmtP(Number(p.monto))} · ${p.fecha} ${p.nota?'· '+p.nota:''}</div>`
            ).join('')
          : '';
        return `<tr>
          <td><strong>${c.nombre}</strong>${pagosHtml}</td>
          <td>${c.servicio||'—'}</td>
          <td class="num">${fmtP(c.precio)}</td>
          <td class="num green">${fmtP(ct)}</td>
          <td class="num ${pend>0?'red':''}">${pend>0?fmtP(pend):'—'}</td>
          <td class="num">${Math.round(pct)}%</td>
          <td><span style="color:${estadoColor};font-weight:600;font-size:11px;text-transform:uppercase">${c.estado||'—'}</span></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;color:#999;font-style:italic">Sin clientes registrados</td></tr>';

  // ── Gastos por categoría ──
  const gastosDelAno = appData.gastos.filter(g=>{const d=new Date(g.fecha+'T12:00:00');return d.getFullYear()===year;});
  const porCat = {};
  gastosDelAno.forEach(g => {
    if (!porCat[g.cat]) porCat[g.cat] = { count:0, total:0, items:[] };
    porCat[g.cat].count++;
    porCat[g.cat].total += Number(g.monto);
    porCat[g.cat].items.push(g);
  });
  const filasGasCat = Object.entries(porCat).sort((a,b)=>b[1].total-a[1].total).map(([cat,v])=>
    `<tr><td>${cat}</td><td class="num">${v.count}</td><td class="num red">${fmtP(v.total)}</td></tr>`
  ).join('') || '<tr><td colspan="3" style="text-align:center;color:#999;font-style:italic">Sin gastos</td></tr>';

  // ── Detalle de todos los gastos ordenados por fecha ──
  const gastosOrdenados = appData.gastos.filter(g=>{const d=new Date(g.fecha+'T12:00:00');return d.getFullYear()===year;}).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const filasGastos = gastosOrdenados.length
    ? gastosOrdenados.map(g => `<tr>
        <td>${g.fecha}</td>
        <td>${g.desc}</td>
        <td><span style="background:#f0f0f0;padding:2px 7px;border-radius:10px;font-size:10px">${g.cat}</span></td>
        <td class="num red">${fmtP(Number(g.monto))}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#999;font-style:italic">Sin gastos registrados</td></tr>';

  // ── HTML del PDF ──
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Larry OS — Informe Anual ${year}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;600&family=IBM+Plex+Mono:wght@400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;font-size:12px;color:#1a1208;background:#fff;padding:0}
  @page{size:A4;margin:18mm 16mm}
  
  /* ── PORTADA ── */
  .cover{text-align:center;padding:60px 0 50px;border-bottom:3px solid #b8882a;margin-bottom:36px}
  .cover-brand{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.4em;color:#9a8a6a;text-transform:uppercase;margin-bottom:14px}
  .cover-title{font-family:'Playfair Display',serif;font-size:42px;font-weight:700;color:#2c2010;line-height:1.1;margin-bottom:8px}
  .cover-year{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;color:#b8882a;letter-spacing:.15em}
  .cover-date{font-size:11px;color:#9a8a6a;margin-top:16px}

  /* ── KPIs ── */
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
  .kpi{background:#faf7f0;border:1px solid #ddd7c8;border-radius:10px;padding:16px 18px;border-top:3px solid #b8882a}
  .kpi.green{border-top-color:#2e7d32}
  .kpi.red{border-top-color:#c62828}
  .kpi.amber{border-top-color:#e65100}
  .kpi-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#9a8a6a;margin-bottom:8px}
  .kpi-val{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;line-height:1;color:#1a1208}
  .kpi-val.green{color:#2e7d32}
  .kpi-val.red{color:#c62828}
  .kpi-val.amber{color:#e65100}

  /* ── SECCIONES ── */
  .section{margin-bottom:32px;page-break-inside:avoid}
  .section-title{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#2c2010;padding-bottom:8px;border-bottom:2px solid #b8882a;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .section-title span{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9a8a6a;font-weight:400;letter-spacing:.1em}

  /* ── TABLAS ── */
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  th{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#9a8a6a;padding:6px 10px;border-bottom:1.5px solid #ddd7c8;text-align:left;background:#faf7f0}
  td{padding:8px 10px;border-bottom:1px solid #ede8db;vertical-align:top;font-size:11.5px}
  tr:last-child td{border-bottom:none}
  tr:nth-child(even) td{background:#fdfbf7}
  .num{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:11px}
  .green{color:#2e7d32;font-weight:600}
  .red{color:#c62828;font-weight:600}
  tfoot td{font-weight:700;background:#f5f0e4;font-family:'IBM Plex Mono',monospace;font-size:11px;border-top:2px solid #c9a84c}

  /* ── FOOTER ── */
  .footer{text-align:center;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#bbb;letter-spacing:.2em;padding-top:20px;border-top:1px solid #ede8db;margin-top:32px}
  .page-break{page-break-before:always}
</style>
</head>
<body>

<!-- PORTADA -->
<div class="cover">
  <div class="cover-brand">Larry OS · Finanzas</div>
  <div class="cover-title">Informe Anual</div>
  <div class="cover-year">${year}</div>
  <div class="cover-date">Generado el ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</div>
</div>

<!-- KPIs ANUALES -->
<div class="kpi-row">
  <div class="kpi green"><div class="kpi-label">Ingresos totales</div><div class="kpi-val green">${fmtP(totIng)}</div></div>
  <div class="kpi red"><div class="kpi-label">Gastos totales</div><div class="kpi-val red">${fmtP(totGas)}</div></div>
  <div class="kpi ${totNet>=0?'green':'red'}"><div class="kpi-label">Resultado neto</div><div class="kpi-val ${totNet>=0?'green':'red'}">${fmtP(totNet)}</div></div>
  <div class="kpi amber"><div class="kpi-label">Pendiente de cobro</div><div class="kpi-val amber">${fmtP(totPend)}</div></div>
</div>

<!-- RESUMEN MENSUAL -->
<div class="section">
  <div class="section-title">Resumen Mensual <span>· ${year}</span></div>
  <table>
    <thead><tr><th>Mes</th><th style="text-align:right">Ingresos</th><th style="text-align:right">Gastos</th><th style="text-align:right">Neto</th><th style="text-align:right">Acumulado</th></tr></thead>
    <tbody>${filasMeses}</tbody>
    <tfoot><tr>
      <td>TOTAL ${year}</td>
      <td class="num green">${fmtP(totIng)}</td>
      <td class="num red">${fmtP(totGas)}</td>
      <td class="num" style="color:${totNet>=0?'#2e7d32':'#c62828'}">${fmtP(totNet)}</td>
      <td></td>
    </tr></tfoot>
  </table>
</div>

<!-- CLIENTES -->
<div class="section page-break">
  <div class="section-title">Clientes <span>· ${appData.clientes.length} registrados</span></div>
  <table>
    <thead><tr><th>Nombre / Cobros</th><th>Servicio</th><th style="text-align:right">Precio</th><th style="text-align:right">Cobrado</th><th style="text-align:right">Pendiente</th><th style="text-align:right">%</th><th>Estado</th></tr></thead>
    <tbody>${filasClientes}</tbody>
    <tfoot><tr>
      <td colspan="2">TOTALES</td>
      <td class="num">${fmtP(appData.clientes.reduce((s,c)=>s+Number(c.precio||0),0))}</td>
      <td class="num green">${fmtP(appData.clientes.reduce((s,c)=>s+totalCobrado(c),0))}</td>
      <td class="num red">${fmtP(totPend)}</td>
      <td></td><td></td>
    </tr></tfoot>
  </table>
</div>

<!-- GASTOS POR CATEGORÍA -->
<div class="section">
  <div class="section-title">Gastos por Categoría <span>· ${year}</span></div>
  <table>
    <thead><tr><th>Categoría</th><th style="text-align:right">Nº</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${filasGasCat}</tbody>
    <tfoot><tr>
      <td>TOTAL GASTOS</td>
      <td class="num">${gastosDelAno.length}</td>
      <td class="num red">${fmtP(totGas)}</td>
    </tr></tfoot>
  </table>
</div>

<!-- DETALLE GASTOS -->
<div class="section page-break">
  <div class="section-title">Detalle de Gastos <span>· todos los registros</span></div>
  <table>
    <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead>
    <tbody>${filasGastos}</tbody>
  </table>
</div>

<div class="footer">LARRY OS · INFORME ANUAL ${year} · DOCUMENTO CONFIDENCIAL</div>

<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('⚠️ Permite popups para generar el PDF'); return; }
  w.document.write(html);
  w.document.close();
}

// ─── INIT FINANZAS ────────────────────────────────────────────
load();
renderDashboard();

// ─── SYNC INICIAL: Finanzas → larryCRM_v2 ─────────────────────
// Si hay clientes en Finanzas que no están en larryCRM_v2, los empuja automáticamente
(function initSyncFinToClientes() {
  try {
    if (!appData.clientes || !appData.clientes.length) return;
    const clRaw = localStorage.getItem('larryCRM_v2');
    const clClients = clRaw ? JSON.parse(clRaw) : [];
    let changed = false;
    const now = new Date();
    const mesKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    appData.clientes.forEach(finC => {
      // Skip if already linked
      if (finC.clId && clClients.find(x => x.id === finC.clId)) return;
      // v2: los cancelados (borrados en Clientes) NO se vuelven a crear
      if (finC.estado === 'cancelado') return;
      // v2: vincular por nombre solo si hay UNO con ese nombre y no está vinculado a otro cliente
      const linkedIds = new Set(appData.clientes.map(x => x.clId).filter(Boolean));
      const sameName = clClients.filter(c => (c.nombre||'').trim().toLowerCase() === (finC.nombre||'').trim().toLowerCase() && !linkedIds.has(c.id));
      const byName = sameName.length === 1 ? clClients.indexOf(sameName[0]) : -1;
      const proceso = FIN_PROC_MAP[finC.servicio] || 'PROD';
      const etapa = finC.estado === 'completado' || finC.estado === 'cancelado' ? 3 : 1;
      const cobrado = (finC.pagos||[]).reduce((s,p)=>s+Number(p.monto),0);
      if (byName >= 0) {
        // Vincular existente
        clClients[byName].proceso = proceso;
        clClients[byName].total   = String(finC.precio || 0);
        clClients[byName].pagado  = String(cobrado);
        finC.clId = clClients[byName].id;
        changed = true;
      } else {
        // Crear nuevo en larryCRM_v2
        const newId = 'fin_' + finC.id;
        const firstPago = (finC.pagos||[]).map(p => p.fecha).filter(Boolean).sort()[0];
        clClients.push({
          id: newId, nombre: finC.nombre,
          proceso, etapa,
          total: String(finC.precio || 0),
          pagado: String(cobrado),
          mesKey: firstPago ? firstPago.slice(0, 7) : mesKey, bonus: [], fechas: [], canciones: '', _fromFin: true
        });
        finC.clId = newId;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('larryCRM_v2', JSON.stringify(clClients));
      save();
      if (typeof window.clReload === 'function') window.clReload();
    }
  } catch(e) { /* initSyncFinToClientes silent fail */ }
})();
