// ═══════════════════════════════════════════════════════════════════
// AGENDA DE CONTENIDO MODULE
// ═══════════════════════════════════════════════════════════════════
(function() {
'use strict';

// ── DATA ──────────────────────────────────────────────────────────────────────
const TYPES = [
  { id:'reel',      label:'REEL',      color:'#D42B48', emoji:'🎬' },
  { id:'historia',  label:'HISTORIA',  color:'#C87A00', emoji:'📸' },
  { id:'secuencia', label:'SECUENCIA', color:'#8B3FD4', emoji:'🎞️' },
  { id:'post',      label:'POST',      color:'#1A9438', emoji:'🖼️' },
  { id:'carrusel',  label:'CARRUSEL',  color:'#0A6ED4', emoji:'📲' },
  { id:'live',      label:'LIVE',      color:'#D43530', emoji:'🔴' },
];
const STATUSES = [
  { id:'idea',       label:'Idea',          color:'#9A8870' },
  { id:'produccion', label:'En producción', color:'#C87A00' },
  { id:'listo',      label:'Listo',         color:'#1A9438' },
  { id:'publicado',  label:'Publicado',     color:'#0A6ED4' },
];
const AGENDA_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_S = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function getType(id)   { return TYPES.find(t=>t.id===id) || TYPES[0]; }
function getStatus(id) { return STATUSES.find(s=>s.id===id) || STATUSES[0]; }
function hex(color,a){ return color+Math.round(a*255).toString(16).padStart(2,'0').toLowerCase(); }

// ── STATE ─────────────────────────────────────────────────────────────────────
let entries      = {};
let currentDate  = new Date();
let viewMode     = 'semana';
let listMode     = false;
let filterType   = 'all';
let filterStatus = 'all';
let editingId    = null;
let editingKey   = null;
let selectedType = 'reel';

// ── DESARROLLO POR PIEZA · paneles tipo Content Hub ───────────────────────────
const AGP_PANELS = [
  { id:'guion',     icon:'✍️', label:'Guión' },
  { id:'historias', icon:'📸', label:'Historias' },
  { id:'refs',      icon:'🖼️', label:'Referencias' },
  { id:'posteo',    icon:'📝', label:'Posteo' },
];
// Qué panel(es) corresponde(n) a cada formato. 'refs' se agrega siempre.
const AGP_TYPE_PANELS = {
  reel:      ['guion'],
  historia:  ['historias'],
  secuencia: ['historias'],
  post:      ['posteo'],
  carrusel:  ['posteo'],
  live:      ['guion'],
};
const AGP_FIXED = ['refs']; // Referencias visible en todos los formatos
const AGP_TAGS = {
  guion:    ['[HOOK]','[COMPARACIÓN]','[DATO]','[GIRO]','[OPINIÓN]','[CIERRE]','[DEBATE]'],
  historias:['[HOOK STORY]','[DATO]','[VIDEO UP]','[CTA]','[DEBATE]'],
  refs:     ['🔗 Pinterest:','🎨 Paleta:','👗 Outfit:','📐 Encuadre:','✨ Vibe:'],
  posteo:   ['[CAPTION]','[HASHTAGS]','[HOOK TEXTO]','[CTA]','[ALT TEXT]'],
};
const AGP_PH = {
  guion:'[HOOK] ¿Te imaginás que...\n[OPINIÓN] Yo creo que...\n[CIERRE] \n[DEBATE] ¿Ustedes qué piensan?',
  historias:'[HOOK STORY] La historia que abre la secuencia...\n[DATO] El dato que sorprende...\n[VIDEO UP] Está en el feed 🔴\n[CTA] ↑ miralo\n[DEBATE] ¿Qué piensan?',
  refs:'🔗 Pinterest: https://...\n🎨 Paleta: cremas, rojo vino\n👗 Outfit: blazer negro + labial rojo\n📐 Encuadre: plano medio, fondo neutro\n✨ Vibe: editorial, serio',
  posteo:'[HOOK TEXTO] Primera línea que para el scroll...\n[CAPTION] El texto completo...\n[CTA] ¿Ustedes qué piensan? 👇\n[HASHTAGS] #moda #fashion...',
};
let agpBuilt = false;
function buildAgendaPanels(){
  if(agpBuilt) return;
  const root = document.getElementById('agenda-panels');
  if(!root) return;
  const tabs  = root.querySelector('.agp-tabs');
  const panes = root.querySelector('.agp-panes');
  AGP_PANELS.forEach((p,i)=>{
    const tab=document.createElement('button');
    tab.type='button';
    tab.className='agp-tab'+(i===0?' active':'');
    tab.dataset.panel=p.id;
    tab.innerHTML=`${p.icon} ${p.label}`;
    tab.onclick=()=>setAgpTab(p.id);
    tabs.appendChild(tab);

    const pane=document.createElement('div');
    pane.className='agp-pane'+(i===0?' active':'');
    pane.dataset.panel=p.id;
    const chips=document.createElement('div'); chips.className='agp-chips';
    (AGP_TAGS[p.id]||[]).forEach(tag=>{
      const c=document.createElement('button'); c.type='button'; c.className='agp-chip';
      c.textContent=tag.replace(/[\[\]]/g,'');
      c.title='Insertar '+tag;
      c.onclick=()=>insertAgpTag(p.id,tag);
      chips.appendChild(c);
    });
    const ta=document.createElement('textarea');
    ta.className='agp-ta'; ta.id='agp-ta-'+p.id; ta.placeholder=AGP_PH[p.id]||'';
    ta.oninput=()=>updateAgpWC(p.id);
    const wc=document.createElement('div'); wc.className='agp-wc'; wc.id='agp-wc-'+p.id;
    pane.append(chips,ta,wc);
    panes.appendChild(pane);
  });
  agpBuilt=true;
}
function setAgpTab(id){
  document.querySelectorAll('#agenda-panels .agp-tab').forEach(t=>t.classList.toggle('active',t.dataset.panel===id));
  document.querySelectorAll('#agenda-panels .agp-pane').forEach(p=>p.classList.toggle('active',p.dataset.panel===id));
}
// Muestra solo los paneles del formato (+ Referencias) y abre el principal.
function applyTypePanels(type){
  buildAgendaPanels();
  const allowed=(AGP_TYPE_PANELS[type]||['guion']).concat(AGP_FIXED);
  document.querySelectorAll('#agenda-panels .agp-tab').forEach(t=>{
    t.style.display=allowed.includes(t.dataset.panel)?'':'none';
  });
  setAgpTab(allowed[0]);
}
function insertAgpTag(panel,tag){
  const ta=document.getElementById('agp-ta-'+panel); if(!ta) return;
  const s=ta.selectionStart!=null?ta.selectionStart:ta.value.length;
  const ins=(s>0&&ta.value[s-1]!=='\n'?'\n':'')+tag+' ';
  ta.value=ta.value.slice(0,s)+ins+ta.value.slice(s);
  ta.selectionStart=ta.selectionEnd=s+ins.length;
  ta.focus(); updateAgpWC(panel);
}
function updateAgpWC(panel){
  const ta=document.getElementById('agp-ta-'+panel), wc=document.getElementById('agp-wc-'+panel);
  if(!ta||!wc) return;
  const w=ta.value.trim().split(/\s+/).filter(Boolean).length;
  wc.textContent=w?`${w} palabras · ~${Math.max(1,Math.ceil(w/130))} min`:'';
}
function setAgpValues(e){
  buildAgendaPanels();
  const pan=(e&&e.panels)?e.panels:{};
  ['guion','historias','refs','posteo'].forEach(k=>{
    const ta=document.getElementById('agp-ta-'+k); if(ta){ ta.value=pan[k]||''; updateAgpWC(k); }
  });
  applyTypePanels(selectedType);
}
function getAgpValues(){
  const panels={};
  ['guion','historias','refs','posteo'].forEach(k=>{ const ta=document.getElementById('agp-ta-'+k); panels[k]=ta?ta.value.trim():''; });
  return { panels };
}

function toKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function todayKey(){ return toKey(new Date()); }

// ── PERSISTENCE ───────────────────────────────────────────────────────────────
function agendaSave(){ try{ localStorage.setItem('agenda_v1', JSON.stringify(entries)); }catch{} }
function agendaLoad(){ try{ const d=localStorage.getItem('agenda_v1'); if(d) entries=JSON.parse(d); }catch{} }
agendaLoad();

// ── UTILS ─────────────────────────────────────────────────────────────────────
function getWeekDates(date){
  const d=new Date(date), day=d.getDay();
  const diff=d.getDate()-day+(day===0?-6:1);
  const mon=new Date(d.setDate(diff));
  return Array.from({length:7},(_,i)=>{ const dd=new Date(mon); dd.setDate(mon.getDate()+i); return dd; });
}
function getMonthDates(date){
  const y=date.getFullYear(), m=date.getMonth();
  const first=new Date(y,m,1), last=new Date(y,m+1,0);
  const startDay=first.getDay()===0?6:first.getDay()-1;
  const days=[];
  for(let i=0;i<startDay;i++){ const dd=new Date(first); dd.setDate(first.getDate()-(startDay-i)); days.push({date:dd,cur:false}); }
  for(let i=1;i<=last.getDate();i++) days.push({date:new Date(y,m,i),cur:true});
  let extra=0; while((days.length)%7!==0){ const dd=new Date(last); dd.setDate(last.getDate()+1+extra++); days.push({date:dd,cur:false}); }
  return days;
}
function matchFilter(e){ return (filterType==='all'||e.type===filterType) && (filterStatus==='all'||e.status===filterStatus); }
function allFlat(){ return Object.entries(entries).flatMap(([k,arr])=>arr.map(e=>({...e,dateKey:k}))); }

// ── RENDER ────────────────────────────────────────────────────────────────────
function render(){
  renderStats();
  renderPeriodLabel();
  renderTypeFilters();
  if(listMode){ renderList(); } else { renderCalendar(); }
}

function renderStats(){
  const all=allFlat();
  document.getElementById('agenda-total-label').textContent=`${all.length} piezas planificadas`;
  const bar=document.getElementById('agenda-stats-bar');
  bar.innerHTML='';
  TYPES.forEach(t=>{
    const cnt=all.filter(e=>e.type===t.id).length;
    if(!cnt) return;
    const chip=document.createElement('div');
    chip.className='stat-chip';
    chip.style.cssText=`color:${t.color};background:${hex(t.color,.07)};border-color:${hex(t.color,.25)}`;
    chip.innerHTML=`${t.emoji} <b>${cnt}</b> ${t.label}`;
    chip.title=`Filtrar por ${t.label}`;
    chip.onclick=()=>{ filterType=filterType===t.id?'all':t.id; render(); };
    bar.appendChild(chip);
  });
}

function renderTypeFilters(){
  const el=document.getElementById('agenda-type-filters');
  el.innerHTML='';
  const allBtn=document.createElement('button');
  allBtn.className='filter-pill'+(filterType==='all'?' active':'');
  allBtn.style.cssText=filterType==='all'?'background:#9A8870;color:#FAF8F2;border-color:#9A8870':'color:#7C6E58;border-color:#DDD3C0';
  allBtn.textContent='Todo';
  allBtn.onclick=()=>{ filterType='all'; render(); };
  el.appendChild(allBtn);
  TYPES.forEach(t=>{
    const btn=document.createElement('button');
    const active=filterType===t.id;
    btn.className='filter-pill'+(active?' active':'');
    btn.style.cssText=active?`background:${t.color};color:#fff;border-color:${t.color}`:`color:${t.color};border-color:${hex(t.color,.35)}`;
    btn.innerHTML=`${t.emoji} ${t.label}`;
    btn.onclick=()=>{ filterType=active?'all':t.id; render(); };
    el.appendChild(btn);
  });
}

function renderPeriodLabel(){
  const el=document.getElementById('agenda-period-label');
  if(viewMode==='semana'){
    const w=getWeekDates(currentDate);
    el.textContent=`${w[0].getDate()} – ${w[6].getDate()} ${AGENDA_MONTHS[w[6].getMonth()]} ${w[6].getFullYear()}`;
  } else {
    el.textContent=`${AGENDA_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }
}

function renderCalendar(){
  document.getElementById('agenda-calendar').style.display='';
  document.getElementById('agenda-list-view').classList.remove('visible');
  if(viewMode==='semana') renderWeek();
  else renderMonth();
}

function renderWeek(){
  const dates=getWeekDates(currentDate);
  const today=todayKey();
  const hdr=document.getElementById('agenda-day-headers');
  hdr.innerHTML='';
  dates.forEach((d,i)=>{
    const key=toKey(d), isToday=key===today;
    const h=document.createElement('div');
    h.className='day-header';
    const numHtml=isToday
      ?`<div class="num today-circle">${d.getDate()}</div>`
      :`<div class="num">${d.getDate()}</div>`;
    h.innerHTML=`<div class="dow">${DAYS_S[i]}</div>${numHtml}`;
    hdr.appendChild(h);
  });
  const grid=document.getElementById('agenda-grid-area');
  grid.innerHTML='';
  const wg=document.createElement('div');
  wg.className='week-grid';
  dates.forEach(d=>{
    const key=toKey(d), isToday=key===today;
    const col=document.createElement('div');
    col.className='week-col'+(isToday?' is-today':'');
    (entries[key]||[]).filter(matchFilter).forEach(e=>{ col.appendChild(makeEntryCard(e,key)); });
    const addWrap=document.createElement('div');
    addWrap.className='add-btn-day';
    const dot=document.createElement('button');
    dot.className='add-dot'; dot.textContent='+';
    dot.onclick=()=>openNew(d);
    addWrap.appendChild(dot);
    col.appendChild(addWrap);
    wg.appendChild(col);
  });
  grid.appendChild(wg);
}

function renderMonth(){
  const dates=getMonthDates(currentDate);
  const today=todayKey();
  const hdr=document.getElementById('agenda-day-headers');
  hdr.innerHTML='';
  DAYS_S.forEach(d=>{
    const h=document.createElement('div');
    h.className='day-header';
    h.innerHTML=`<div class="dow">${d}</div>`;
    hdr.appendChild(h);
  });
  const grid=document.getElementById('agenda-grid-area');
  grid.innerHTML='';
  const mg=document.createElement('div');
  mg.className='month-grid';
  dates.forEach(({date,cur})=>{
    const key=toKey(date), isToday=key===today;
    const cell=document.createElement('div');
    cell.className='month-cell'+(cur?'':' other-month')+(isToday?' is-today':'');
    cell.onclick=()=>openNew(date);
    const dayEntries=(entries[key]||[]).filter(matchFilter);
    const mday=document.createElement('div');
    mday.className='mday'; mday.textContent=date.getDate();
    cell.appendChild(mday);
    dayEntries.slice(0,3).forEach(e=>{
      const t=getType(e.type);
      const chip=document.createElement('div');
      chip.className='month-entry';
      chip.style.background=t.color;
      chip.textContent=`${t.emoji} ${e.title}`;
      chip.onclick=(ev)=>{ ev.stopPropagation(); openEdit(e,key); };
      cell.appendChild(chip);
    });
    if(dayEntries.length>3){ const m=document.createElement('div'); m.className='month-more'; m.textContent=`+${dayEntries.length-3} más`; cell.appendChild(m); }
    mg.appendChild(cell);
  });
  grid.appendChild(mg);
}

function renderList(){
  document.getElementById('agenda-calendar').style.display='none';
  const lv=document.getElementById('agenda-list-view');
  lv.classList.add('visible');
  const sf=document.getElementById('agenda-status-filters');
  sf.innerHTML='';
  const allBtn=document.createElement('button');
  allBtn.className='filter-pill'+(filterStatus==='all'?' active':'');
  allBtn.style.cssText=filterStatus==='all'?'background:#9A8870;color:#FAF8F2;border-color:#9A8870':'color:#7C6E58;border-color:#DDD3C0';
  allBtn.textContent='Todos los estados';
  allBtn.onclick=()=>{ filterStatus='all'; renderList(); };
  sf.appendChild(allBtn);
  STATUSES.forEach(s=>{
    const btn=document.createElement('button');
    const active=filterStatus===s.id;
    btn.className='filter-pill'+(active?' active':'');
    btn.style.cssText=active?`background:${s.color};color:#fff;border-color:${s.color}`:`color:${s.color};border-color:${hex(s.color,.35)}`;
    btn.textContent=`● ${s.label}`;
    btn.onclick=()=>{ filterStatus=active?'all':s.id; renderList(); };
    sf.appendChild(btn);
  });
  const container=document.getElementById('agenda-list-items');
  container.innerHTML='';
  const sorted=allFlat().filter(matchFilter).sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
  if(!sorted.length){
    const em=document.createElement('div'); em.className='empty-state';
    em.innerHTML='No hay contenido planificado aún.<br><small>Hacé click en el calendario para agregar.</small>';
    container.appendChild(em); return;
  }
  sorted.forEach(e=>{
    const t=getType(e.type), s=getStatus(e.status);
    const [y,m,d]=e.dateKey.split('-');
    const item=document.createElement('div');
    item.className='list-item';
    item.style.borderLeftColor=t.color;
    item.innerHTML=`
      <div class="list-date">
        <div class="ld" style="color:${t.color}">${d}</div>
        <div class="lm">${AGENDA_MONTHS[parseInt(m)-1].slice(0,3).toUpperCase()}</div>
      </div>
      <div class="list-body">
        <div class="list-meta">
          <span class="filter-pill" style="background:${hex(t.color,.12)};color:${t.color};border-color:${hex(t.color,.25)};font-size:10px;padding:2px 8px">${t.emoji} ${t.label}</span>
          <span style="font-size:11px;color:var(--muted2)">${e.platform||''}</span>
          ${e.hora?`<span style="font-size:11px;color:var(--muted)">⏰ ${e.hora}</span>`:''}
          <span style="font-size:10px;color:${s.color};font-weight:700;margin-left:auto">● ${s.label}</span>
        </div>
        <div class="list-title">${escT(e.title)}</div>
        ${e.notes?`<div class="list-notes">${escT(e.notes)}</div>`:''}
      </div>`;
    item.onclick=()=>openEdit(e,e.dateKey);
    container.appendChild(item);
  });
}

function makeEntryCard(e, dateKey){
  const t=getType(e.type), s=getStatus(e.status);
  const card=document.createElement('div');
  card.className='entry-card';
  card.style.cssText=`background:${hex(t.color,.07)};border-left-color:${t.color}`;
  card.innerHTML=`
    <div class="entry-type-label" style="color:${t.color}">${t.emoji} ${t.label}</div>
    <div class="entry-title">${escT(e.title)}</div>
    ${e.hora?`<div class="entry-time">⏰ ${e.hora}</div>`:''}
    <span class="entry-status" style="color:${s.color};background:${hex(s.color,.12)}">● ${s.label}</span>`;
  card.onclick=()=>openEdit(e,dateKey);
  return card;
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function buildTypeGrid(){
  const grid=document.getElementById('agenda-type-grid');
  grid.innerHTML='';
  TYPES.forEach(t=>{
    const pill=document.createElement('button');
    pill.className='type-pill'; pill.dataset.type=t.id;
    pill.innerHTML=`${t.emoji} ${t.label}`;
    pill.onclick=()=>{ selectType(t.id); };
    grid.appendChild(pill);
  });
}
buildTypeGrid();

function selectType(id){
  selectedType=id;
  const t=getType(id);
  document.querySelectorAll('.type-pill').forEach(p=>{
    const pt=getType(p.dataset.type);
    if(p.dataset.type===id){
      p.style.cssText=`background:${pt.color};color:#fff;border-color:${pt.color};box-shadow:0 2px 10px ${hex(pt.color,.35)}`;
    } else {
      p.style.cssText=`background:${hex(pt.color,.08)};color:${pt.color};border-color:${hex(pt.color,.25)};box-shadow:none`;
    }
  });
  document.getElementById('agenda-btn-save').style.background=t.color;
  if(typeof applyTypePanels==='function') applyTypePanels(id);
}

function openNew(date){
  editingId=null; editingKey=toKey(date);
  document.getElementById('agenda-modal-title').textContent='✨ Nuevo Contenido';
  document.getElementById('agenda-f-title').value='';
  document.getElementById('agenda-f-date').value=editingKey;
  document.getElementById('agenda-f-time').value='12:00';
  document.getElementById('agenda-f-platform').value='Instagram';
  document.getElementById('agenda-f-status').value='idea';
  document.getElementById('agenda-f-notes').value='';
  document.getElementById('agenda-btn-delete').style.display='none';
  document.getElementById('agenda-btn-save').textContent='Agregar';
  selectType('reel');
  setAgpValues({});
  openOverlay();
}

function openEdit(e, dateKey){
  editingId=e.id; editingKey=dateKey;
  document.getElementById('agenda-modal-title').textContent='✏️ Editar Contenido';
  document.getElementById('agenda-f-title').value=e.title||'';
  document.getElementById('agenda-f-date').value=dateKey;
  document.getElementById('agenda-f-time').value=e.hora||'12:00';
  document.getElementById('agenda-f-platform').value=e.platform||'Instagram';
  document.getElementById('agenda-f-status').value=e.status||'idea';
  document.getElementById('agenda-f-notes').value=e.notes||'';
  document.getElementById('agenda-btn-delete').style.display='';
  document.getElementById('agenda-btn-save').textContent='Guardar';
  selectType(e.type||'reel');
  setAgpValues(e);
  openOverlay();
}

function openOverlay(){ document.getElementById('agenda-overlay').classList.add('open'); }
function closeOverlay(){ document.getElementById('agenda-overlay').classList.remove('open'); }

function saveEntry(){
  const title=document.getElementById('agenda-f-title').value.trim();
  if(!title) { document.getElementById('agenda-f-title').focus(); return; }
  const type=selectedType||'reel';
  const dateKey=document.getElementById('agenda-f-date').value || editingKey;
  const entry={
    id: editingId || String(Date.now()),
    title,
    type,
    hora:     document.getElementById('agenda-f-time').value,
    platform: document.getElementById('agenda-f-platform').value,
    status:   document.getElementById('agenda-f-status').value,
    notes:    document.getElementById('agenda-f-notes').value.trim(),
    ...getAgpValues(),
  };
  if(editingId && editingKey && editingKey!==dateKey){
    entries[editingKey]=(entries[editingKey]||[]).filter(e=>e.id!==editingId);
    if(!entries[editingKey].length) delete entries[editingKey];
  }
  const arr=entries[dateKey]?[...entries[dateKey]]:[];
  const idx=arr.findIndex(e=>e.id===entry.id);
  if(idx>=0) arr[idx]=entry; else arr.push(entry);
  entries[dateKey]=arr;
  agendaSave(); closeOverlay(); render();
}

function deleteEntry(){
  if(!editingId||!editingKey) return;
  const prev = JSON.parse(JSON.stringify(entries));
  entries[editingKey]=(entries[editingKey]||[]).filter(e=>e.id!==editingId);
  if(!entries[editingKey].length) delete entries[editingKey];
  agendaSave(); closeOverlay(); render();
  showUndo('Pieza eliminada', ()=>{ entries=prev; agendaSave(); render(); });
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
document.getElementById('agenda-overlay').onclick=(e)=>{ if(e.target===e.currentTarget) closeOverlay(); };
document.getElementById('agenda-btn-cancel').onclick=closeOverlay;
document.getElementById('agenda-btn-save').onclick=saveEntry;
document.getElementById('agenda-btn-delete').onclick=deleteEntry;
document.getElementById('agenda-fab').onclick=()=>openNew(new Date());

document.querySelectorAll('#agenda-app .tab').forEach(t=>{
  t.onclick=()=>{
    document.querySelectorAll('#agenda-app .tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    viewMode=t.dataset.view;
    listMode=false;
    document.getElementById('agenda-btn-list').textContent='📋';
    render();
  };
});

document.getElementById('agenda-btn-prev').onclick=()=>{
  if(viewMode==='semana') currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDate()-7);
  else currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth()-1,1);
  render();
};
document.getElementById('agenda-btn-next').onclick=()=>{
  if(viewMode==='semana') currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDate()+7);
  else currentDate=new Date(currentDate.getFullYear(),currentDate.getMonth()+1,1);
  render();
};
document.getElementById('agenda-btn-today').onclick=()=>{ currentDate=new Date(); render(); };

document.getElementById('agenda-btn-list').onclick=()=>{
  listMode=!listMode;
  document.getElementById('agenda-btn-list').textContent=listMode?'📅':'📋';
  render();
};

// Export / Import
document.getElementById('agenda-btn-export').onclick=()=>{
  const blob=new Blob([JSON.stringify(entries,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='agenda-contenido.json'; a.click();
};
document.getElementById('agenda-btn-import-trigger').onclick=()=>document.getElementById('agenda-btn-import').click();
document.getElementById('agenda-btn-import').onchange=(e)=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=(ev)=>{
    let data;
    try{ data=JSON.parse(ev.target.result); }catch{ showToast('⚠ Archivo inválido'); return; }
    // v2: validar formato { "YYYY-MM-DD": [ {id,...}, ... ] } y confirmar antes de reemplazar
    const ok = data && typeof data==='object' && !Array.isArray(data) &&
      Object.entries(data).every(([k,v])=>/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v));
    if(!ok){ showToast('⚠ El archivo no es una agenda de Larry OS'); return; }
    const n = Object.values(data).reduce((s,v)=>s+v.length,0);
    customConfirm('¿Reemplazar toda la agenda por la del archivo ('+n+' piezas)?', ()=>{
      const prev = entries;
      entries=data; agendaSave(); render(); showToast('✓ Agenda importada');
      showUndo('Agenda reemplazada', ()=>{ entries=prev; agendaSave(); render(); });
    }, 'Reemplazar');
  };
  r.readAsText(file); e.target.value='';
};

// keyboard
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeOverlay(); });

// ── INIT ──────────────────────────────────────────────────────────────────────
render();

})();
