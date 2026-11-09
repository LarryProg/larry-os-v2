// ─── CUSTOM CONFIRM ──────────────────────────────────────────
(function(){
  let _cb = null;
  const overlay = document.getElementById('custom-confirm-overlay');
  const msg     = document.getElementById('custom-confirm-msg');
  const yesBtn  = document.getElementById('custom-confirm-yes');
  const noBtn   = document.getElementById('custom-confirm-no');

  window.customConfirm = function(text, onYes, dangerLabel) {
    msg.textContent = text;
    if (dangerLabel) yesBtn.textContent = dangerLabel;
    else yesBtn.textContent = 'Confirmar';
    _cb = onYes;
    overlay.style.display = 'flex';
    setTimeout(()=>noBtn.focus(), 50);
  };

  yesBtn.onclick = () => { overlay.style.display = 'none'; if (_cb) _cb(); _cb = null; };
  noBtn.onclick  = () => { overlay.style.display = 'none'; _cb = null; };
  overlay.onclick = (e) => { if (e.target === overlay) { overlay.style.display = 'none'; _cb = null; } };
  document.addEventListener('keydown', (e) => {
    if (overlay.style.display === 'flex' && e.key === 'Escape') {
      overlay.style.display = 'none'; _cb = null;
    }
  });
})();

// ─── GLOBAL SEARCH Cmd+K ─────────────────────────────────────
(function(){
  const overlay = document.getElementById('global-search-overlay');
  const input   = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');

  function openSearch() {
    overlay.style.display = 'flex';
    input.value = '';
    results.innerHTML = `<div style="padding:20px;text-align:center;color:#9A8A6A;font-size:12px;font-family:'IBM Plex Mono',monospace">Escribe para buscar…</div>`;
    setTimeout(()=>input.focus(), 50);
  }
  function closeSearch() {
    overlay.style.display = 'none';
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape' && overlay.style.display === 'flex') closeSearch();
  });
  overlay.onclick = (e) => { if (e.target === overlay) closeSearch(); };

  let _searchTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.innerHTML = `<div style="padding:20px;text-align:center;color:#9A8A6A;font-size:12px;font-family:'IBM Plex Mono',monospace">Escribe para buscar…</div>`; return; }
    let hits = [];

    // Search Finanzas clientes
    try {
      const fd = JSON.parse(localStorage.getItem('larryOS_finanzas') || '{}');
      (fd.clientes||[]).filter(c=>(c.nombre||'').toLowerCase().includes(q)||(c.servicio||'').toLowerCase().includes(q))
        .slice(0,4).forEach(c=>hits.push({ icon:'💰', module:'fin-clientes', label: c.nombre, sub: c.servicio||'', action: ()=>{ closeSearch(); switchModule('fin-clientes'); } }));
    } catch(e){}

    // Search CRM leads
    try {
      const leads = JSON.parse(localStorage.getItem('larry:leads') || '[]');
      leads.filter(l=>(l.nombre||'').toLowerCase().includes(q)||(l.instagram||'').toLowerCase().includes(q)||(l.servicio||'').toLowerCase().includes(q))
        .slice(0,4).forEach(l=>hits.push({ icon:'⬡', module:'crm', label: l.instagram?`@${l.instagram}`:l.nombre, sub: l.servicio||'', action: ()=>{ closeSearch(); switchModule('crm'); if (window.crmOpenLead) window.crmOpenLead(l.id); } }));
    } catch(e){}

    // Leads de Meta y Networking (v2)
    try {
      const ml = JSON.parse(localStorage.getItem('larry:metaLeads') || '[]');
      ml.filter(l=>[l.nombre,l.instagram,l.telefono].some(v=>(v||'').toLowerCase().includes(q)))
        .slice(0,3).forEach(l=>hits.push({ icon:'◉', module:'meta', label: l.nombre||l.instagram||'Lead Meta', sub: l.estado||'', action: ()=>{ closeSearch(); switchModule('crm'); if (window.crmGoTab) window.crmGoTab('meta'); } }));
      const nw = JSON.parse(localStorage.getItem('larry:networking') || '[]');
      nw.filter(l=>[l.nombre,l.instagram].some(v=>(v||'').toLowerCase().includes(q)))
        .slice(0,3).forEach(l=>hits.push({ icon:'⬢', module:'networking', label: l.nombre||l.instagram, sub: l.rol||'', action: ()=>{ closeSearch(); switchModule('crm'); if (window.crmGoTab) window.crmGoTab('networking'); } }));
    } catch(e){}

    // Search Clientes module
    try {
      const cls = JSON.parse(localStorage.getItem('larryCRM_v2') || '[]');
      cls.filter(c=>(c.nombre||'').toLowerCase().includes(q))
        .slice(0,4).forEach(c=>hits.push({ icon:'🎤', module:'clientes', label: c.nombre, sub: ['Sin Empezar','En Producción','En Revisión','Terminado'][parseInt(c.etapa,10)]||'', action: ()=>{ closeSearch(); switchModule('clientes'); } }));
    } catch(e){}

    // Search Notas
    try {
      const notasParsed = JSON.parse(localStorage.getItem('notas_rapidas_v1') || '[]');
      const notasRaw = Array.isArray(notasParsed) ? notasParsed : (notasParsed.notes || []);
      notasRaw.filter(n=>(n.text||'').toLowerCase().includes(q))
        .slice(0,4).forEach(n=>hits.push({ icon:'📝', module:'tareas', label: (n.text||'').length>40 ? (n.text||'').slice(0,40)+'…' : (n.text||'')||'Nota sin texto', sub: '', action: ()=>{ closeSearch(); switchModule('tareas'); } }));
    } catch(e){}

    // Search Agenda
    try {
      const agData = JSON.parse(localStorage.getItem('agenda_v1') || '{}');
      Object.values(agData).flat().filter(e=>e&&(e.title||'').toLowerCase().includes(q))
        .slice(0,4).forEach(e=>hits.push({ icon:'📅', module:'agenda', label: e.title, sub: e.platform||'', action: ()=>{ closeSearch(); switchModule('agenda'); } }));
    } catch(e){}

    // Search MyBoard
    try {
      const mbData = JSON.parse(localStorage.getItem('myboard_v3') || '{}');
      const mbBoards = mbData.boards ? Object.values(mbData.boards) : [];
      mbBoards.filter(b => b && b.name && b.name.toLowerCase().includes(q))
        .slice(0,3).forEach(b => hits.push({ icon:'🗂️', module:'myboard', label: b.name, sub: `${(b.cards||[]).length} tarjetas`, action: ()=>{ closeSearch(); switchModule('myboard'); } }));
    } catch(e){}

    if (!hits.length) {
      results.innerHTML = `<div style="padding:20px;text-align:center;color:#9A8A6A;font-size:12px;font-family:'IBM Plex Mono',monospace">Sin resultados para "${escT(q)}"</div>`;
      return;
    }
    results.innerHTML = hits.map((h,i)=>`
      <div class="gs-result" data-idx="${i}" style="display:flex;align-items:center;gap:12px;padding:11px 18px;cursor:pointer;transition:background .1s;border-bottom:1px solid #DDD7C8">
        <span style="font-size:16px">${h.icon}</span>
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:#2C2010;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escT(h.label)}</div>
          ${h.sub?`<div style="font-size:10px;color:#9A8A6A;font-family:'IBM Plex Mono',monospace">${escT(h.sub)}</div>`:''}
        </div>
        <div style="margin-left:auto;font-size:10px;color:#BDB5A5;font-family:'IBM Plex Mono',monospace">${h.module.toUpperCase()}</div>
      </div>`).join('');
    window._gsHits = hits; window._gsSel = 0;
    results.querySelectorAll('.gs-result').forEach((el,i)=>{
      el.onmouseenter = ()=>{ window._gsSel = i; gsPaint(); };
      el.onclick = ()=>hits[i].action();
    });
    gsPaint();
    }, 160);
  });

  function gsPaint() {
    results.querySelectorAll('.gs-result').forEach((el, i) => {
      el.style.background = i === window._gsSel ? 'rgba(201,168,76,0.14)' : '';
      if (i === window._gsSel) el.scrollIntoView({ block: 'nearest' });
    });
  }
  input.addEventListener('keydown', (e) => {
    const hits = window._gsHits || [];
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); window._gsSel = Math.min(hits.length - 1, (window._gsSel || 0) + 1); gsPaint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); window._gsSel = Math.max(0, (window._gsSel || 0) - 1); gsPaint(); }
    else if (e.key === 'Enter') { e.preventDefault(); const h = hits[window._gsSel || 0]; if (h) h.action(); }
  });

  // Expose opener for sidebar button
  window.openGlobalSearch = openSearch;
})();
