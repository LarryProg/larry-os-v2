// ═══════════════════════════════════════════════════════════════
// LARRY OS v2 · FISCAL (LARRY PROD SL)
//  · Datos del emisor y numeración correlativa por año
//  · Factura de cada cobro con base / IVA / total según el cliente
//  · Resumen trimestral (IVA repercutido − soportado) y CSV para el gestor
// Orientativo: los tipos de IVA hay que confirmarlos con el gestor.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const CFG_KEY = 'larryOS_fiscal';
  const eur = n => (Math.round((n || 0) * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const esc = s => escT(s == null ? '' : s);

  function cfg() {
    try { return Object.assign({ razon: 'LARRY PROD SL', cif: '', direccion: '', email: '', iban: '', serie: 'F', ivaPct: 21, numeros: {}, pie: '' }, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); }
    catch (e) { return { razon: 'LARRY PROD SL', serie: 'F', ivaPct: 21, numeros: {} }; }
  }
  function saveCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); }

  // IVA según el cliente. Los importes cobrados se toman con IVA incluido.
  function calc(c, monto) {
    const pct = Number(cfg().ivaPct) || 21;
    const total = Number(monto) || 0;
    const pais = (c && c.pais) || 'ES';
    const empresa = c && c.tipoFiscal === 'empresa';
    if (pais === 'UE' && empresa) return { pct: 0, base: total, iva: 0, total, mencion: 'Operación con inversión del sujeto pasivo (art. 84.Uno.2º LIVA / art. 196 Directiva 2006/112/CE).' };
    if (pais === 'FUERA') return { pct: 0, base: total, iva: 0, total, mencion: 'Operación no sujeta a IVA por reglas de localización (art. 69 LIVA).' };
    const base = total / (1 + pct / 100);
    return { pct, base, iva: total - base, total, mencion: '' };
  }
  window.fiscalCalc = calc;

  function trimestre(fecha) { const m = parseInt(String(fecha).slice(5, 7), 10); return Math.ceil(m / 3); }

  // ─── Factura ───
  window.fiscalFactura = function (clienteId, pagoId) {
    const c = appData.clientes.find(x => x.id === clienteId);
    const p = c && (c.pagos || []).find(x => x.id === pagoId);
    if (!p) return showToast('⚠️ Cobro no encontrado');
    if (p.factura) return printFactura(c, p);
    const conf = cfg();
    if (!conf.cif || !conf.direccion) {
      showToast('Completá primero los datos de la SL (CIF y dirección)');
      if (typeof closeModal === 'function') closeModal('modal-pago');
      switchModule('fiscal');
      return;
    }
    const year = String(p.fecha || todayLocal()).slice(0, 4);
    const n = (conf.numeros[year] || 0) + 1;
    const num = conf.serie + year + '-' + String(n).padStart(3, '0');
    const r = calc(c, p.monto);
    customConfirm('¿Emitir la factura ' + num + ' a ' + c.nombre + '?\n\nBase ' + eur(r.base) + ' + IVA ' + r.pct + '% ' + eur(r.iva) + ' = ' + eur(r.total) +
      (c.nif ? '' : '\n\n⚠️ El cliente no tiene NIF cargado (para empresas es obligatorio).') + '\n\nEl número no se puede reutilizar.', function () {
      conf.numeros[year] = n; saveCfg(conf);
      p.factura = { num, fecha: p.fecha || todayLocal(), base: +r.base.toFixed(2), iva: +r.iva.toFixed(2), pct: r.pct, total: +r.total.toFixed(2), mencion: r.mencion,
        cliente: { nombre: c.nombre, nif: c.nif || '', direccion: c.direccion || '', pais: c.pais || 'ES' } };
      save();
      if (typeof openModalPago === 'function') openModalPago(clienteId);
      printFactura(c, p);
      if (activeModule === 'fiscal') render();
    }, 'Emitir');
  };

  function printFactura(c, p) {
    const f = p.factura, conf = cfg();
    const w = window.open('', '_blank');
    if (!w) return showToast('⚠️ El navegador bloqueó la ventana. Permití ventanas emergentes.');
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Factura ' + esc(f.num) + '</title>' +
      '<style>@page{size:A4;margin:18mm}body{font:13px/1.5 Helvetica,Arial,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px}' +
      'h1{font-size:26px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px 8px;border-bottom:1px solid #ddd;text-align:left}' +
      'th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#555}.r{text-align:right}.tot td{border:none;padding:4px 8px}.tot .big td{font-size:17px;font-weight:700;border-top:2px solid #111;padding-top:10px}' +
      '.cols{display:flex;justify-content:space-between;gap:24px;margin-top:22px}.box{flex:1}.lbl{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.06em}' +
      '.note{margin-top:22px;font-size:12px;color:#333}.no-print{margin-top:30px}@media print{.no-print{display:none}}</style></head><body>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1>FACTURA</h1><div>Nº <b>' + esc(f.num) + '</b></div><div>Fecha: ' + esc(new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES')) + '</div></div>' +
      '<div style="text-align:right"><b>' + esc(conf.razon) + '</b><br>CIF ' + esc(conf.cif) + '<br>' + esc(conf.direccion).replace(/\n/g, '<br>') + (conf.email ? '<br>' + esc(conf.email) : '') + '</div></div>' +
      '<div class="cols"><div class="box"><div class="lbl">Cliente</div><b>' + esc(f.cliente.nombre) + '</b>' + (f.cliente.nif ? '<br>NIF ' + esc(f.cliente.nif) : '') + (f.cliente.direccion ? '<br>' + esc(f.cliente.direccion) : '') + '</div></div>' +
      '<table><thead><tr><th>Concepto</th><th class="r">Base</th><th class="r">IVA</th><th class="r">Total</th></tr></thead><tbody>' +
      '<tr><td>' + esc(c.servicio || 'Servicios de producción musical') + (p.nota ? ' — ' + esc(p.nota) : '') + '</td><td class="r">' + eur(f.base) + '</td><td class="r">' + f.pct + '%</td><td class="r">' + eur(f.total) + '</td></tr></tbody></table>' +
      '<table class="tot" style="width:auto;margin-left:auto"><tr><td>Base imponible</td><td class="r">' + eur(f.base) + '</td></tr><tr><td>IVA ' + f.pct + '%</td><td class="r">' + eur(f.iva) + '</td></tr><tr class="big"><td>Total</td><td class="r">' + eur(f.total) + '</td></tr></table>' +
      (f.mencion ? '<div class="note">' + esc(f.mencion) + '</div>' : '') +
      '<div class="note">Factura pagada' + (conf.iban ? ' · IBAN ' + esc(conf.iban) : '') + '.' + (conf.pie ? '<br>' + esc(conf.pie) : '') + '</div>' +
      '<div class="no-print"><button onclick="print()" style="padding:10px 18px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button></div>' +
      '</body></html>');
    w.document.close();
  }

  // ─── Pantalla Fiscal ───
  let year = new Date().getFullYear();
  function data() {
    const ingresos = [], gastos = [];
    (appData.clientes || []).forEach(c => (c.pagos || []).forEach(p => {
      if (!p.fecha || +String(p.fecha).slice(0, 4) !== year) return;
      const r = p.factura || calc(c, p.monto);
      ingresos.push({ fecha: p.fecha, t: trimestre(p.fecha), cliente: c.nombre, nif: c.nif || '', num: p.factura ? p.factura.num : '', base: r.base, iva: r.iva, total: r.total || Number(p.monto), pct: r.pct, clienteId: c.id, pagoId: p.id });
    }));
    (appData.gastos || []).forEach(g => {
      if (!g.fecha || +String(g.fecha).slice(0, 4) !== year) return;
      const iva = Number(g.ivaSoportado) || 0;
      gastos.push({ fecha: g.fecha, t: trimestre(g.fecha), desc: g.desc, cat: g.cat, proveedor: g.proveedor || '', base: Number(g.monto) - iva, iva, total: Number(g.monto), deducible: g.deducible !== false });
    });
    ingresos.sort((a, b) => a.fecha < b.fecha ? -1 : 1); gastos.sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    return { ingresos, gastos };
  }

  function render() {
    const root = document.getElementById('fiscal-root'); if (!root) return;
    const conf = cfg(); const d = data();
    const T = [1, 2, 3, 4].map(t => {
      const i = d.ingresos.filter(x => x.t === t), g = d.gastos.filter(x => x.t === t && x.deducible);
      const s = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
      return { t, base: s(i, 'base'), rep: s(i, 'iva'), gBase: s(g, 'base'), sop: s(g, 'iva'), sinFactura: i.filter(x => !x.num).length };
    });
    const field = (id, label, val, ph) => '<label class="fis-f"><span>' + label + '</span><input id="' + id + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '"></label>';
    root.innerHTML =
      '<div class="fis-head"><div><h1>Fiscal · ' + esc(conf.razon) + '</h1><p>Facturas, IVA y resumen trimestral para el gestor. <b>Orientativo:</b> confirmá los tipos de IVA con tu gestoría.</p></div>' +
      '<label class="fis-year">Año <select id="fis-year">' + [year - 2, year - 1, year, year + 1].map(y => '<option' + (y === year ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label></div>' +
      '<section class="hoy-card"><header><h2>Resumen por trimestre ' + year + '</h2><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="hoy-btn" data-csv="ingresos">⬇ CSV ingresos</button><button class="hoy-btn" data-csv="gastos">⬇ CSV gastos</button></div></header>' +
      '<div class="fis-table-wrap"><table class="fis-table"><thead><tr><th></th>' + T.map(x => '<th>T' + x.t + '</th>').join('') + '</tr></thead><tbody>' +
      '<tr><td>Ingresos (base)</td>' + T.map(x => '<td>' + eur(x.base) + '</td>').join('') + '</tr>' +
      '<tr><td>IVA repercutido</td>' + T.map(x => '<td>' + eur(x.rep) + '</td>').join('') + '</tr>' +
      '<tr><td>Gastos deducibles (base)</td>' + T.map(x => '<td>' + eur(x.gBase) + '</td>').join('') + '</tr>' +
      '<tr><td>IVA soportado</td>' + T.map(x => '<td>' + eur(x.sop) + '</td>').join('') + '</tr>' +
      '<tr class="fis-strong"><td>IVA a ingresar (303)</td>' + T.map(x => '<td>' + eur(x.rep - x.sop) + '</td>').join('') + '</tr>' +
      '<tr class="fis-strong"><td>Resultado aprox.</td>' + T.map(x => '<td>' + eur(x.base - x.gBase) + '</td>').join('') + '</tr>' +
      '<tr><td>Cobros sin factura</td>' + T.map(x => '<td' + (x.sinFactura ? ' style="color:#9b1c1c;font-weight:700"' : '') + '>' + x.sinFactura + '</td>').join('') + '</tr>' +
      '</tbody></table></div></section>' +
      '<section class="hoy-card" style="margin-top:14px"><header><h2>Cobros ' + year + '</h2></header>' +
      (d.ingresos.length ? '<div class="fis-table-wrap"><table class="fis-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Factura</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead><tbody>' +
        d.ingresos.slice().reverse().map(x => '<tr><td>' + esc(x.fecha) + '</td><td>' + esc(x.cliente) + '</td><td>' +
          '<button class="hoy-btn" data-fac="' + esc(x.clienteId) + '|' + esc(x.pagoId) + '">' + (x.num ? '🧾 ' + esc(x.num) : 'Emitir') + '</button></td><td>' + eur(x.base) + '</td><td>' + eur(x.iva) + '</td><td>' + eur(x.total) + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p class="hoy-empty">Sin cobros este año.</p>') + '</section>' +
      '<section class="hoy-card" style="margin-top:14px"><header><h2>Datos de la SL (emisor)</h2></header><div class="fis-form">' +
      field('fis-razon', 'Razón social', conf.razon) + field('fis-cif', 'CIF', conf.cif, 'B12345678') +
      field('fis-direccion', 'Dirección fiscal', conf.direccion, 'Calle, CP, Palma de Mallorca') + field('fis-email', 'Email', conf.email) +
      field('fis-iban', 'IBAN (opcional)', conf.iban) + field('fis-serie', 'Serie de factura', conf.serie, 'F') +
      field('fis-iva', 'IVA general (%)', conf.ivaPct) + field('fis-pie', 'Texto al pie (opcional)', conf.pie) +
      '</div><button class="hoy-btn hoy-primary" id="fis-save" style="margin-top:10px">Guardar datos</button>' +
      '<p class="hoy-empty" style="margin-top:8px">Reglas que aplica: cliente en España → IVA ' + esc(conf.ivaPct) + '% incluido en lo cobrado. Empresa de otro país de la UE → inversión del sujeto pasivo (0%). Fuera de la UE → no sujeto (0%). Particular de la UE → IVA español. Cargá país, tipo y NIF en "Datos para la factura" de cada cliente.</p></section>';
  }

  function csv(kind) {
    const d = data();
    const rows = kind === 'ingresos'
      ? [['Fecha', 'Trimestre', 'Factura', 'Cliente', 'NIF', 'Base', 'IVA %', 'IVA', 'Total']].concat(d.ingresos.map(x => [x.fecha, 'T' + x.t, x.num, x.cliente, x.nif, x.base.toFixed(2), x.pct, x.iva.toFixed(2), Number(x.total).toFixed(2)]))
      : [['Fecha', 'Trimestre', 'Descripción', 'Categoría', 'Proveedor / Nº', 'Base', 'IVA soportado', 'Total', 'Deducible']].concat(d.gastos.map(x => [x.fecha, 'T' + x.t, x.desc, x.cat, x.proveedor, x.base.toFixed(2), x.iva.toFixed(2), x.total.toFixed(2), x.deducible ? 'Sí' : 'No']));
    const txt = rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = kind + '_' + year + '.csv'; a.click();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('fiscal-root'); if (!root) return;
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'fis-save') {
        const c = cfg(); const v = id => document.getElementById(id).value.trim();
        Object.assign(c, { razon: v('fis-razon'), cif: v('fis-cif').toUpperCase(), direccion: v('fis-direccion'), email: v('fis-email'), iban: v('fis-iban'), serie: v('fis-serie') || 'F', ivaPct: parseFloat(v('fis-iva')) || 21, pie: v('fis-pie') });
        saveCfg(c); showToast('✓ Datos fiscales guardados'); render();
      } else if (b.dataset.csv) csv(b.dataset.csv);
      else if (b.dataset.fac) { const [cid, pid] = b.dataset.fac.split('|'); fiscalFactura(cid, pid); }
    });
    root.addEventListener('change', e => { if (e.target.id === 'fis-year') { year = +e.target.value; render(); } });
  });
  window.renderFiscal = render;
})();
