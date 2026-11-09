// ═══════════════════════════════════════════════════════════════
// LARRY OS v2 · VENTAS (compartido por Hoy, CRM y Finanzas)
//  · Plantillas de WhatsApp editables + botón que abre wa.me
//  · Motivos de pérdida
//  · Convertir un lead en cliente (abre el alta de Finanzas ya completada)
//  · Seguimiento: posponer próximo contacto
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const WA_KEY = 'larry:waTemplates';

  // [Nombre] se reemplaza solo. Lo demás entre [corchetes] se completa a mano en WhatsApp.
  const WA_DEFAULTS = [
    { id: 'seg24', label: 'Seguimiento 24 h', text: '[Nombre], ¿pudiste ver lo que te mandé? Cualquier duda que tengas me decís y lo vemos 🙌' },
    { id: 'seg72', label: 'Seguimiento 72 h', text: '¡Hola [Nombre]! Te escribo porque esta semana estoy cerrando la agenda. ¿Seguís con ganas de sacar el tema? Si querés lo charlamos en una llamada de 15 min 🎧' },
    { id: 'seg7d', label: 'Seguimiento 7 días', text: '[Nombre], no quiero insistir de más 🙂 Si ahora no es el momento, ningún problema. ¿Te escribo más adelante o lo dejamos acá?' },
    { id: 'llamada', label: 'Proponer llamada', text: '[Nombre], para entender bien lo que buscás y darte un presupuesto exacto, ¿hacemos una llamada corta? Decime qué día y hora te queda cómodo 📞' },
    { id: 'sena', label: 'Link de seña', text: 'Perfecto [Nombre] 🙌 Te paso el link de la seña para bloquear las fechas:\n\n👉 [link de Stripe]\n\nCon la seña ya te reservo el lugar en agenda y arrancamos. Avisame cuando lo hagas 🤝' },
    { id: 'completo', label: 'Link de pago completo', text: 'Genial [Nombre] 🙌 Te paso el link para reservar tu lugar:\n\n👉 [link de Stripe]\n\nPodés pagar con tarjeta, Apple Pay o Google Pay, es seguro (Stripe). Apenas se acredite te escribo para arrancar 🤝' },
    { id: 'recordPago', label: 'Recordatorio de pago', text: '[Nombre], ¿pudiste ver el link? Te guardo el lugar hasta [día] porque la semana que viene ya tengo la agenda llena. Si te trabaste con algo del pago decime y lo resolvemos 🙌' },
    { id: 'confirmado', label: 'Pago confirmado', text: '¡Listo [Nombre]! 🔥 Me llegó el pago, ya quedó confirmado.\n\nGracias por confiar en mi trabajo. En un rato te mando el mensaje de arranque con los pasos y lo que necesito de vos. 🎧' },
    { id: 'cobro', label: 'Recordatorio de cobro', text: '¡Hola [Nombre]! Te escribo por el pago pendiente del proyecto ([monto] €). Te paso el link: [link de Stripe]. ¡Gracias! 🙌' },
    { id: 'testimonio', label: 'Pedir testimonio', text: '[Nombre], ¿cómo te sentiste con el resultado? 🙏 Si te gustó trabajar juntos, ¿me mandarías un audio o un par de líneas contando tu experiencia? Me ayuda un montón a que otros artistas me conozcan.' },
    { id: 'recompra', label: 'Siguiente tema', text: '¡Hola [Nombre]! ¿Cómo viene el lanzamiento? 🔥 Si ya estás pensando en el próximo tema, esta semana tengo lugar en agenda. ¿Lo charlamos?' }
  ];

  window.MOTIVOS_PERDIDA = ['Precio', 'Timing / no es el momento', 'No responde', 'No califica (presupuesto o nivel)', 'Eligió a otro productor', 'Otro'];

  function getTemplates() {
    try {
      const saved = JSON.parse(localStorage.getItem(WA_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) {
        // Sumar plantillas nuevas por defecto que no estén guardadas
        const ids = new Set(saved.map(t => t.id));
        return saved.concat(WA_DEFAULTS.filter(t => !ids.has(t.id)));
      }
    } catch (e) {}
    return WA_DEFAULTS.slice();
  }
  window.waTemplates = getTemplates;

  function phoneDigits(p) {
    let d = String(p || '').replace(/[^\d+]/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    d = d.replace(/\+/g, '');
    // 9 dígitos que empiezan por 6/7 → móvil español sin prefijo
    if (/^[67]\d{8}$/.test(d)) d = '34' + d;
    return d;
  }
  function fill(text, c) {
    const nombre = (c && (c.nombre || c.instagram || '')).toString().trim().split(' ')[0] || '';
    return text.replace(/\[Nombre\]/g, nombre || '[Nombre]').replace(/\[monto\]/g, c && c.monto ? String(Math.round(c.monto)) : '[monto]');
  }
  window.waLink = function (phone, text) {
    const d = phoneDigits(phone);
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text || '');
  };

  // Menú flotante de plantillas. contact = {nombre, telefono, monto?}; suggested = ids a mostrar primero
  window.openWaMenu = function (evt, contact, suggested) {
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    closeWaMenu();
    const tpls = getTemplates();
    const first = (suggested || []).map(id => tpls.find(t => t.id === id)).filter(Boolean);
    const rest = tpls.filter(t => first.indexOf(t) < 0);
    const m = document.createElement('div');
    m.id = 'wa-menu';
    m.setAttribute('role', 'menu');
    m.style.cssText = 'position:fixed;z-index:100002;background:#fff;color:#111;border:1px solid #ddd;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.25);padding:6px;width:260px;max-height:70vh;overflow:auto;font:500 13px DM Sans,sans-serif';
    const noPhone = !phoneDigits(contact && contact.telefono);
    m.innerHTML =
      '<div style="padding:6px 10px 8px;font-size:11px;color:#666">WhatsApp a <b>' + escT((contact && contact.nombre) || 'contacto') + '</b>' +
      (noPhone ? '<br><span style="color:#b45309">Sin teléfono: vas a elegir el chat en WhatsApp</span>' : '') + '</div>' +
      first.concat(first.length ? [{ sep: 1 }] : []).concat(rest).map(t => t.sep
        ? '<div style="height:1px;background:#eee;margin:4px 6px"></div>'
        : '<button role="menuitem" data-id="' + t.id + '" style="display:block;width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;font:inherit;color:inherit">' + escT(t.label) + '</button>'
      ).join('') +
      '<div style="height:1px;background:#eee;margin:4px 6px"></div>' +
      '<button data-edit="1" style="display:block;width:100%;text-align:left;background:none;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;font:inherit;color:#666">✎ Editar plantillas…</button>';
    document.body.appendChild(m);
    const anchor = evt && ((evt.target && evt.target.closest && evt.target.closest('button,a')) || evt.currentTarget);
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 130, bottom: innerHeight / 3 };
    const left = Math.max(8, Math.min(innerWidth - 268, r.left));
    const top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 4);
    m.style.left = left + 'px'; m.style.top = Math.max(8, top) + 'px';
    m.querySelectorAll('button[data-id]').forEach(b => {
      b.onmouseenter = () => b.style.background = '#f3f3f3';
      b.onmouseleave = () => b.style.background = 'none';
      b.onclick = () => {
        const t = tpls.find(x => x.id === b.dataset.id);
        window.open(waLink(contact && contact.telefono, fill(t.text, contact)), '_blank', 'noopener');
        closeWaMenu();
        if (contact && typeof contact.onSent === 'function') contact.onSent(t.id);
      };
    });
    m.querySelector('[data-edit]').onclick = () => { closeWaMenu(); openWaEditor(); };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
  };
  function closeOnOutside(e) { const m = document.getElementById('wa-menu'); if (m && !m.contains(e.target)) closeWaMenu(); }
  function closeWaMenu() { const m = document.getElementById('wa-menu'); if (m) m.remove(); document.removeEventListener('click', closeOnOutside); }
  window.closeWaMenu = closeWaMenu;

  // Editor de plantillas
  function openWaEditor() {
    const tpls = getTemplates();
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100003;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:#fff;color:#111;border-radius:14px;max-width:640px;width:100%;max-height:88vh;overflow:auto;padding:20px;font-family:DM Sans,sans-serif">' +
      '<div style="font-weight:700;font-size:16px;margin-bottom:4px">Plantillas de WhatsApp</div>' +
      '<div style="font-size:12px;color:#666;margin-bottom:14px">[Nombre] se completa solo con el primer nombre. Lo demás entre [corchetes] lo completás en WhatsApp antes de enviar.</div>' +
      tpls.map((t, i) => '<label style="display:block;margin-bottom:12px"><span style="font-size:12px;font-weight:700">' + escT(t.label) + '</span>' +
        '<textarea data-i="' + i + '" rows="3" style="display:block;width:100%;margin-top:4px;border:1px solid #ccc;border-radius:8px;padding:8px;font:14px DM Sans,sans-serif;resize:vertical">' + escT(t.text) + '</textarea></label>').join('') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:-20px;background:#fff;padding:10px 0">' +
      '<button data-reset style="background:none;border:1px solid #ccc;border-radius:8px;padding:8px 14px;cursor:pointer">Restaurar originales</button>' +
      '<button data-close style="background:none;border:1px solid #ccc;border-radius:8px;padding:8px 14px;cursor:pointer">Cancelar</button>' +
      '<button data-save style="background:#111;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer">Guardar</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick = () => ov.remove();
    ov.querySelector('[data-reset]').onclick = () => { localStorage.removeItem(WA_KEY); ov.remove(); showToast('✓ Plantillas originales'); };
    ov.querySelector('[data-save]').onclick = () => {
      ov.querySelectorAll('textarea').forEach(ta => { tpls[+ta.dataset.i].text = ta.value; });
      localStorage.setItem(WA_KEY, JSON.stringify(tpls));
      ov.remove(); showToast('✓ Plantillas guardadas');
    };
  }
  window.openWaEditor = openWaEditor;

  // ─── Leads: leer / escribir y refrescar el CRM ───
  function readJSON(k, def) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } }
  window.larryLeads = () => readJSON('larry:leads', []);
  window.larryUpdateLead = function (id, patch) {
    const leads = readJSON('larry:leads', []);
    const i = leads.findIndex(l => String(l.id) === String(id));
    if (i < 0) return null;
    leads[i] = Object.assign({}, leads[i], patch);
    localStorage.setItem('larry:leads', JSON.stringify(leads));
    if (window.crmForceRefresh) window.crmForceRefresh();
    return leads[i];
  };
  window.larryPostpone = function (id, days) {
    const d = new Date(); d.setDate(d.getDate() + days);
    return larryUpdateLead(id, { proximoContacto: toLocalISO(d), ultimoSeguimiento: todayLocal() });
  };

  // ─── Convertir lead → cliente de Finanzas ───
  const SERV_MAP = {
    'Beatmaking': 'Beatmaking', 'Producción Completa': 'Prod Completa', 'EP/Lanzamiento': 'Ep/Lanzamiento',
    'Master por Stems': 'Master', 'Edición + Mezcla': 'Mix', 'Edición + Mezcla + Master': 'Mix&Master'
  };
  window.convertLeadToCliente = function (lead) {
    if (!lead) return;
    if (lead.clienteFinId && typeof appData !== 'undefined' && appData.clientes.some(c => c.id === lead.clienteFinId)) {
      showToast('Este lead ya es cliente · abriendo Finanzas');
      switchModule('fin-clientes');
      return;
    }
    switchModule('fin-clientes');
    openModalCliente();
    window._pendingLeadId = lead.id; // después de abrir: openModalCliente lo limpia
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('c-nombre', lead.nombre || (lead.instagram ? '@' + String(lead.instagram).replace(/^@/, '') : ''));
    set('c-servicio', SERV_MAP[lead.servicio] || 'Prod Completa');
    if (lead.valor) set('c-precio', lead.valor);
    const extra = [lead.modalidad ? 'Modalidad: ' + lead.modalidad : '', lead.instagram ? 'IG: @' + String(lead.instagram).replace(/^@/, '') : '', lead.whatsapp ? 'WhatsApp: ' + lead.whatsapp : '']
      .filter(Boolean).join(' · ');
    set('c-notas', extra);
    const nac = String(lead.nac || lead.nacionalidad || '').toUpperCase();
    set('c-pais', nac.includes('ESPA') ? 'ES' : (nac.includes('EUROP') ? 'UE' : (nac ? 'FUERA' : 'ES')));
    showToast('Completá la seña (si la hay) y guardá el cliente');
    setTimeout(() => { const el = document.getElementById('c-cobro-inicial'); if (el) el.focus(); }, 150);
  };
  // Lo llama saveCliente al crear el cliente nuevo
  window.linkPendingLead = function (newCl) {
    const id = window._pendingLeadId;
    window._pendingLeadId = null;
    if (!id) return;
    const lead = larryLeads().find(l => String(l.id) === String(id));
    if (!lead) return;
    newCl.leadId = lead.id;
    if (lead.modalidad) newCl.modalidad = lead.modalidad;
    if (lead.whatsapp) newCl.telefono = lead.whatsapp;
    if (lead.fuente) newCl.fuente = lead.fuente;
    larryUpdateLead(id, {
      clienteFinId: newCl.id, etapa: 'cerrado', estadoActual: 'CERRADO',
      fechaCierre: lead.fechaCierre || todayLocal(), tipoCliente: lead.tipoCliente === 'NUEVO' || !lead.tipoCliente ? 'COMPRO' : lead.tipoCliente
    });
    showToast('✓ Lead convertido en cliente');
  };
})();
