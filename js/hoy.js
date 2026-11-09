// ═══════════════════════════════════════════════════════════════
// LARRY OS v2 · HOY — la pantalla de inicio: qué hago hoy
//  · Seguimientos vencidos / de hoy (Pipeline, Networking)
//  · Leads de Meta sin contactar
//  · Cobros vencidos y de los próximos 7 días
//  · Llamadas y contenido de hoy
//  · Post-venta: pedir testimonio y ofrecer el siguiente tema
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const DONE_KEY = 'larry:hoyHechos';

  function rj(k, def) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } }
  function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toLocalISO(d); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  const eur = n => '€' + Math.round(n || 0).toLocaleString('es-ES');
  const esc = s => escT(s == null ? '' : s);
  const fdate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  function cuando(iso, hoy) {
    const d = daysBetween(hoy, iso);
    if (d === 0) return '<span class="hoy-tag hoy-tag-hoy">hoy</span>';
    if (d < 0) return '<span class="hoy-tag hoy-tag-late">hace ' + (-d) + ' día' + (d === -1 ? '' : 's') + '</span>';
    if (d === 1) return '<span class="hoy-tag">mañana</span>';
    return '<span class="hoy-tag">' + fdate(iso) + '</span>';
  }
  function getDone() { return rj(DONE_KEY, {}); }
  function markDone(key) {
    const d = getDone(); d[key] = todayLocal();
    // limpiar marcas de más de 200 días
    const lim = addDays(todayLocal(), -200);
    Object.keys(d).forEach(k => { if (d[k] < lim) delete d[k]; });
    localStorage.setItem(DONE_KEY, JSON.stringify(d));
  }
  const cobrado = c => (c.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0);
  const pendiente = c => Math.max(0, Number(c.precio || 0) - cobrado(c));

  function collect() {
    const hoy = todayLocal();
    const en7 = addDays(hoy, 7);
    const done = getDone();
    const fin = (typeof appData !== 'undefined' && appData.clientes) ? appData : rj('larryOS_finanzas', { clientes: [] });
    const clientes = (fin.clientes || []).filter(c => c.estado !== 'cancelado');

    // Seguimientos
    const leads = rj('larry:leads', []);
    const activo = l => !['cerrado', 'perdido'].includes(l.etapa);
    const seg = leads.filter(l => activo(l) && l.proximoContacto && l.proximoContacto <= hoy)
      .sort((a, b) => a.proximoContacto < b.proximoContacto ? -1 : 1);
    const sinProximo = leads.filter(l => activo(l) && !l.proximoContacto).length;
    const net = rj('larry:networking', []).filter(c => c.proximoContacto && c.proximoContacto <= hoy);
    const metaNuevos = rj('larry:metaLeads', []).filter(l => (l.estado || 'Nuevo') === 'Nuevo');

    // Cobros
    const cobros = clientes.filter(c => pendiente(c) > 0 && c.proximoCobro && c.proximoCobro.fecha && c.proximoCobro.fecha <= en7)
      .sort((a, b) => a.proximoCobro.fecha < b.proximoCobro.fecha ? -1 : 1);
    const sinFecha = clientes.filter(c => pendiente(c) > 0 && !(c.proximoCobro && c.proximoCobro.fecha));

    // Llamadas de hoy
    const llamadas = [];
    rj('larryOS_pll_manual', []).forEach(x => { if (x.start && toLocalISO(new Date(x.start)) === hoy) llamadas.push(x); });
    rj('larryOS_pll_cache', []).forEach(x => { if (x.start && toLocalISO(new Date(x.start)) === hoy) llamadas.push(x); });
    llamadas.sort((a, b) => new Date(a.start) - new Date(b.start));

    // Contenido de hoy
    const agenda = rj('agenda_v1', {});
    const contenido = agenda[hoy] || [];

    // Post-venta: clientes saldados
    const post = [];
    clientes.forEach(c => {
      if (!(Number(c.precio) > 0) || pendiente(c) > 0 || !(c.pagos || []).length) return;
      const ult = (c.pagos || []).map(p => p.fecha).filter(Boolean).sort().pop();
      if (!ult) return;
      const dias = daysBetween(ult, hoy);
      if (dias >= 5 && dias < 60 && !done['testimonio:' + c.id]) post.push({ c, tipo: 'testimonio', label: 'Pedir testimonio', dias });
      if (dias >= 50 && dias < 150 && !done['recompra:' + c.id]) post.push({ c, tipo: 'recompra', label: 'Ofrecer el siguiente tema', dias });
    });

    // KPIs del mes
    const ym = hoy.slice(0, 7);
    let cobradoMes = 0;
    clientes.forEach(c => (c.pagos || []).forEach(p => { if ((p.fecha || '').slice(0, 7) === ym) cobradoMes += Number(p.monto || 0); }));
    const pendTotal = clientes.reduce((s, c) => s + pendiente(c), 0);
    const ventasMes = leads.filter(l => l.etapa === 'cerrado' && (l.fechaCierre || '').slice(0, 7) === ym).length;
    const activos = leads.filter(activo).length;

    return { hoy, seg, sinProximo, net, metaNuevos, cobros, sinFecha, llamadas, contenido, post, cobradoMes, pendTotal, ventasMes, activos };
  }

  function card(title, count, body, emptyMsg, extraHead) {
    return '<section class="hoy-card"><header><h2>' + title + (count ? ' <span class="hoy-count">' + count + '</span>' : '') + '</h2>' + (extraHead || '') + '</header>' +
      (body || '<p class="hoy-empty">' + emptyMsg + '</p>') + '</section>';
  }

  function render() {
    const root = document.getElementById('hoy-root');
    if (!root) return;
    const d = collect();
    const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const h = new Date().getHours();
    const saludo = h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const tareas = d.seg.length + d.net.length + d.cobros.filter(c => c.proximoCobro.fecha <= d.hoy).length + d.post.length + d.metaNuevos.length;

    // Seguimientos
    const segHtml = d.seg.map(l =>
      '<div class="hoy-row">' +
        '<div class="hoy-main"><b>' + esc(l.nombre || ('@' + (l.instagram || ''))) + '</b>' + cuando(l.proximoContacto, d.hoy) +
        '<div class="hoy-sub">' + esc([l.estadoActual || l.etapa, l.servicio, l.valor ? eur(l.valor) : ''].filter(Boolean).join(' · ')) + (l.notas ? ' — ' + esc(String(l.notas).slice(0, 70)) : '') + '</div></div>' +
        '<div class="hoy-actions">' +
          '<button class="hoy-btn hoy-wa" data-act="wa-lead" data-id="' + esc(l.id) + '" aria-label="WhatsApp">💬 WhatsApp</button>' +
          '<button class="hoy-btn" data-act="open-lead" data-id="' + esc(l.id) + '">Abrir</button>' +
          '<button class="hoy-btn" data-act="post" data-days="2" data-id="' + esc(l.id) + '" title="Posponer 2 días">+2 d</button>' +
          '<button class="hoy-btn" data-act="post" data-days="7" data-id="' + esc(l.id) + '" title="Posponer 1 semana">+7 d</button>' +
        '</div></div>').join('') +
      d.net.map(c =>
        '<div class="hoy-row"><div class="hoy-main"><b>' + esc(c.nombre || c.instagram) + '</b>' + cuando(c.proximoContacto, d.hoy) +
        '<div class="hoy-sub">Networking · ' + esc(c.rol || '') + '</div></div>' +
        '<div class="hoy-actions"><button class="hoy-btn" data-act="go-net">Abrir</button></div></div>').join('');
    const segExtra = d.sinProximo ? '<button class="hoy-link" data-act="sin-prox">' + d.sinProximo + ' lead' + (d.sinProximo === 1 ? '' : 's') + ' activo' + (d.sinProximo === 1 ? '' : 's') + ' sin próximo contacto →</button>' : '';

    // Meta sin contactar
    const metaHtml = d.metaNuevos.slice(0, 8).map(l =>
      '<div class="hoy-row"><div class="hoy-main"><b>' + esc(l.nombre || l.instagram || 'Lead de Meta') + '</b>' + (l.fecha ? cuando(String(l.fecha).slice(0, 10), d.hoy) : '') +
      '<div class="hoy-sub">' + esc([l.objetivo, l.demoMusica].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="hoy-actions"><button class="hoy-btn hoy-wa" data-act="wa-meta" data-id="' + esc(l.id) + '">💬 WhatsApp</button>' +
      '<button class="hoy-btn" data-act="meta-contactado" data-id="' + esc(l.id) + '">Ya lo contacté</button></div></div>').join('') +
      (d.metaNuevos.length > 8 ? '<button class="hoy-link" data-act="go-meta">Ver los ' + d.metaNuevos.length + ' →</button>' : '');

    // Cobros
    const cobHtml = d.cobros.map(c =>
      '<div class="hoy-row"><div class="hoy-main"><b>' + esc(c.nombre) + '</b>' + cuando(c.proximoCobro.fecha, d.hoy) +
      '<div class="hoy-sub">' + esc(c.proximoCobro.label || 'Cobro') + ' · debe ' + eur(pendiente(c)) + ' de ' + eur(c.precio) + '</div></div>' +
      '<div class="hoy-actions">' +
        '<button class="hoy-btn hoy-wa" data-act="wa-cobro" data-id="' + esc(c.id) + '">💬 Recordar</button>' +
        '<button class="hoy-btn hoy-primary" data-act="cobrar" data-id="' + esc(c.id) + '">Registrar cobro</button>' +
      '</div></div>').join('');
    const cobExtra = d.sinFecha.length ? '<button class="hoy-link" data-act="go-fin">' + d.sinFecha.length + ' con saldo pendiente sin fecha de cobro →</button>' : '';

    // Llamadas
    const llHtml = d.llamadas.map(x => {
      const hora = new Date(x.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const link = /^https?:\/\//i.test(x.link || '') ? '<a class="hoy-btn" href="' + esc(x.link) + '" target="_blank" rel="noopener">Entrar</a>' : '';
      return '<div class="hoy-row"><div class="hoy-main"><b>' + hora + ' · ' + esc(x.title || 'Llamada') + '</b><div class="hoy-sub">' + esc(x.notes || '') + '</div></div><div class="hoy-actions">' + link + '</div></div>';
    }).join('');

    // Contenido
    const conHtml = d.contenido.map(e =>
      '<div class="hoy-row"><div class="hoy-main"><b>' + esc(e.title || 'Pieza') + '</b><div class="hoy-sub">' + esc([e.platform, e.format, e.status].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="hoy-actions"><button class="hoy-btn" data-act="go-agenda">Abrir</button></div></div>').join('');

    // Post-venta
    const postHtml = d.post.map(p =>
      '<div class="hoy-row"><div class="hoy-main"><b>' + esc(p.c.nombre) + '</b><span class="hoy-tag">' + p.label + '</span>' +
      '<div class="hoy-sub">Terminó de pagar hace ' + p.dias + ' días · ' + esc(p.c.servicio || '') + '</div></div>' +
      '<div class="hoy-actions"><button class="hoy-btn hoy-wa" data-act="wa-post" data-tipo="' + p.tipo + '" data-id="' + esc(p.c.id) + '">💬 WhatsApp</button>' +
      '<button class="hoy-btn" data-act="done" data-key="' + p.tipo + ':' + esc(p.c.id) + '">Hecho</button></div></div>').join('');

    root.innerHTML =
      '<div class="hoy-head"><div><div class="hoy-date">' + esc(fecha) + '</div><h1>' + saludo + ', Larry</h1>' +
      '<p class="hoy-lead">' + (tareas ? 'Tenés <b>' + tareas + ' cosa' + (tareas === 1 ? '' : 's') + '</b> para mover hoy.' : 'Todo al día. Buen momento para prospectar o crear contenido.') + '</p></div>' +
      '<div class="hoy-quick">' +
        '<button class="hoy-btn hoy-primary" data-act="new-lead">+ Lead</button>' +
        '<button class="hoy-btn" data-act="new-cobro">+ Cobro</button>' +
        '<button class="hoy-btn" data-act="new-gasto">+ Gasto</button>' +
        '<button class="hoy-btn" data-act="new-nota">+ Nota</button>' +
      '</div></div>' +
      '<div class="hoy-kpis">' +
        '<div><span>Cobrado este mes</span><b>' + eur(d.cobradoMes) + '</b></div>' +
        '<div><span>Pendiente de cobro</span><b>' + eur(d.pendTotal) + '</b></div>' +
        '<div><span>Ventas este mes</span><b>' + d.ventasMes + '</b></div>' +
        '<div><span>Leads activos</span><b>' + d.activos + '</b></div>' +
      '</div>' +
      '<div class="hoy-grid">' +
        card('Seguimientos', d.seg.length + d.net.length, segHtml, 'No hay seguimientos para hoy.', segExtra) +
        card('Cobros', d.cobros.length, cobHtml, 'Nada para cobrar en los próximos 7 días.', cobExtra) +
        (d.metaNuevos.length ? card('Leads de Meta sin contactar', d.metaNuevos.length, metaHtml, '') : '') +
        card('Llamadas de hoy', d.llamadas.length, llHtml, 'Sin llamadas agendadas hoy.') +
        card('Post-venta', d.post.length, postHtml, 'Sin testimonios ni recompras pendientes.') +
        card('Contenido de hoy', d.contenido.length, conHtml, 'Nada planificado en la Agenda para hoy.') +
      '</div>';

    // Contador en la barra lateral
    const badge = document.getElementById('sb-hoy-badge');
    if (badge) { badge.textContent = tareas || ''; badge.style.display = tareas ? '' : 'none'; }
  }

  function findLead(id) { return rj('larry:leads', []).find(l => String(l.id) === String(id)); }
  function finClient(id) { return (typeof appData !== 'undefined' ? appData.clientes : []).find(c => c.id === id); }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'wa-lead') {
      const l = findLead(id); if (!l) return;
      openWaMenu(e, { nombre: l.nombre || l.instagram, telefono: l.whatsapp, onSent: () => { larryPostpone(l.id, 3); render(); showToast('Próximo seguimiento en 3 días'); } }, ['seg24', 'seg72', 'seg7d', 'llamada']);
    } else if (act === 'open-lead') { switchModule('crm'); setTimeout(() => window.crmOpenLead && window.crmOpenLead(id), 50); }
    else if (act === 'post') { larryPostpone(id, +b.dataset.days); render(); showToast('Pospuesto ' + b.dataset.days + ' días'); }
    else if (act === 'sin-prox') { switchModule('crm'); window.crmGoTab && window.crmGoTab('pipeline'); }
    else if (act === 'go-net') { switchModule('crm'); window.crmGoTab && window.crmGoTab('networking'); }
    else if (act === 'go-meta') { switchModule('crm'); window.crmGoTab && window.crmGoTab('meta'); }
    else if (act === 'wa-meta') {
      const l = rj('larry:metaLeads', []).find(x => String(x.id) === String(id)); if (!l) return;
      openWaMenu(e, { nombre: l.nombre || l.instagram, telefono: l.telefono, onSent: () => setMetaEstado(id, 'Contactado') }, ['seg24', 'llamada']);
    } else if (act === 'meta-contactado') { setMetaEstado(id, 'Contactado'); }
    else if (act === 'cobrar') { switchModule('fin-clientes'); openModalPago(id); }
    else if (act === 'wa-cobro') {
      const c = finClient(id); if (!c) return;
      openWaMenu(e, { nombre: c.nombre, telefono: c.telefono || (findLead(c.leadId) || {}).whatsapp, monto: pendiente(c) }, ['cobro', 'recordPago']);
    } else if (act === 'go-fin') { switchModule('fin-clientes'); }
    else if (act === 'go-agenda') { switchModule('agenda'); }
    else if (act === 'wa-post') {
      const c = finClient(id); if (!c) return;
      const tipo = b.dataset.tipo;
      openWaMenu(e, { nombre: c.nombre, telefono: c.telefono || (findLead(c.leadId) || {}).whatsapp, onSent: () => { markDone(tipo + ':' + id); render(); } }, [tipo]);
    } else if (act === 'done') { markDone(b.dataset.key); render(); }
    else if (act === 'new-lead') { switchModule('crm'); window.crmGoTab && window.crmGoTab('pipeline'); setTimeout(() => window.crmNewLead && window.crmNewLead(), 50); }
    else if (act === 'new-cobro') { quickCobro(); }
    else if (act === 'new-gasto') { switchModule('finanzas'); if (typeof openModalGasto === 'function') openModalGasto(); }
    else if (act === 'new-nota') { switchModule('tareas'); }
  }

  function setMetaEstado(id, estado) {
    const ml = rj('larry:metaLeads', []);
    const i = ml.findIndex(x => String(x.id) === String(id));
    if (i < 0) return;
    ml[i] = Object.assign({}, ml[i], { estado });
    localStorage.setItem('larry:metaLeads', JSON.stringify(ml));
    if (window.crmForceRefresh) window.crmForceRefresh();
    render(); showToast('Marcado como ' + estado);
  }

  // Registrar un cobro sin ir a Finanzas: elegir cliente con saldo
  function quickCobro() {
    const list = (typeof appData !== 'undefined' ? appData.clientes : []).filter(c => c.estado !== 'cancelado' && pendiente(c) > 0);
    if (!list.length) { showToast('No hay clientes con saldo pendiente'); return; }
    const ov = document.createElement('div');
    ov.className = 'hoy-pick';
    ov.innerHTML = '<div class="hoy-pick-box" role="dialog" aria-label="Elegí el cliente"><h3>¿De quién es el cobro?</h3>' +
      list.map(c => '<button data-id="' + esc(c.id) + '"><b>' + esc(c.nombre) + '</b><span>debe ' + eur(pendiente(c)) + '</span></button>').join('') +
      '<button data-close class="hoy-pick-cancel">Cancelar</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', ev => {
      const t = ev.target.closest('button');
      if (ev.target === ov || (t && t.hasAttribute('data-close'))) { ov.remove(); return; }
      if (t && t.dataset.id) { ov.remove(); switchModule('fin-clientes'); openModalPago(t.dataset.id); }
    });
  }

  window.renderHoy = render;
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('hoy-root');
    if (root) root.addEventListener('click', onClick);
    // v2: la app arranca en Hoy
    if (typeof switchModule === 'function') switchModule('hoy'); else render();
  });
  // Refrescar cuando cambian datos relevantes y Hoy está a la vista
  let t = null;
  window.addEventListener('larry:dirty', () => {
    clearTimeout(t);
    t = setTimeout(() => { if (typeof activeModule === 'undefined' || activeModule === 'hoy') render(); else { const b = document.getElementById('sb-hoy-badge'); if (b) render(); } }, 400);
  });
})();
