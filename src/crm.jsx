  const { useState, useEffect } = React;

  const ETAPAS = [
    { id: "lead",       label: "Lead",            color: "#8B949E", bg: "#DDD7C8" },
    { id: "interesado", label: "Interesado",       color: "#F0B429", bg: "#231C0E" },
    { id: "llamada",    label: "Llamada Agendada", color: "#58A6FF", bg: "#0D1B2A" },
    { id: "cerrado",    label: "Cerrado",          color: "#3FB950", bg: "#0D2014" },
    { id: "perdido",    label: "Perdido",          color: "#F85149", bg: "#2A0D0D" },
  ];
  const SERVICIOS     = ["Beatmaking","Producción Completa","EP/Lanzamiento","Master por Stems","Edición + Mezcla","Edición + Mezcla + Master","Análisis de Marca Artística"];
  const FUENTES       = ["Meta Ads","Orgánico","Referido","DM Outreach"];
  const GUIONES       = ["Guión 1 v2","Guión 2 v2","Guión 3 v2"];
  const PAISES        = ["España","Argentina","América","EEUU","Europa","Otro"];
  const META_DEMO_OPTS     = ["Tiene demo","Saca música","No"];
  const META_OBJETIVO_OPTS = ["Pegarse en la música","Sonar profesional","Tener productor fijo"];
  const META_ESTADO_OPTS   = ["Nuevo","Contactado","En conversación","Convertido","Descartado"];

  const fmtC = (n) => "€" + (Number(n)||0).toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:0});
  const fmtDateC = (d) => d ? new Date(d).toLocaleDateString("es-ES",{day:"2-digit",month:"short"}) : "";

  // v2: "1.200" → 1200, "300,50" → 300.5, "€400" → 400
  function parseEuro(v){
    if (typeof v === 'number') return v;
    let s = String(v||'').replace(/[^\d.,-]/g,'');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g,'').replace(',', '.');      // coma decimal
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g,'');   // punto de miles
    const n = parseFloat(s); return isNaN(n) ? 0 : n;
  }
  window.parseEuro = parseEuro;

  function sget(key){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):null; }catch{ return null; } }
  function sset(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch{} }

  const CRM_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
    .crm-wrap *, .crm-wrap *::before, .crm-wrap *::after { box-sizing: border-box; }
    .crm-wrap input, .crm-wrap select, .crm-wrap textarea { outline: none; border: none; font-family: 'IBM Plex Mono', monospace; }
    .crm-wrap button { cursor: pointer; border: none; background: none; font-family: 'Syne', sans-serif; }
    .crm-btn-gold { background: #C9A84C; color: #0B0A09; padding: 9px 18px; border-radius: 4px; font-weight: 700; font-size: 12px; letter-spacing: .05em; transition: all .2s; font-family: 'Syne', sans-serif; border: none; cursor: pointer; }
    .crm-btn-gold:hover { background: #E0BD6A; transform: translateY(-1px); }
    .crm-btn-ghost { background: transparent; color: #C9A84C; padding: 9px 16px; border-radius: 4px; border: 1px solid #C9A84C33; font-weight: 600; font-size: 12px; transition: all .2s; font-family: 'Syne', sans-serif; cursor: pointer; }
    .crm-btn-ghost:hover { border-color: #C9A84C88; background: #C9A84C11; }
    .crm-btn-danger { background: #F8514922; color: #F85149; padding: 9px 14px; border-radius: 4px; border: 1px solid #F8514933; font-weight: 600; font-size: 12px; transition: all .2s; font-family: 'Syne', sans-serif; cursor: pointer; }
    .crm-btn-danger:hover { background: #F8514944; }
    .crm-input { background: #DDD7C8; border: 1px solid #BDB5A5; border-radius: 4px; color: #2C2010; padding: 9px 12px; font-size: 13px; width: 100%; transition: border-color .2s; }
    .crm-input:focus { border-color: #C9A84C55; }
    .crm-input::placeholder { color: #8A7A60; }
    .crm-modal-overlay { position: fixed; inset: 0; background: #2C201088; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .crm-modal-box { background: #EAE4D6; border: 1px solid #BDB5A5; border-radius: 8px; padding: 28px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; animation: crmFadeUp .2s ease; }
    @keyframes crmFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    .crm-nav-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-size: 13px; font-weight: 500; letter-spacing: .03em; transition: all .15s; background: transparent; border-bottom: 2px solid transparent; color: #7A6A50; font-family: 'Syne', sans-serif; border-top: none; border-left: none; border-right: none; cursor: pointer; white-space: nowrap; }
    .crm-nav-btn:hover { color: #6A5A40; background: rgba(44,32,16,0.03); }
    .crm-nav-btn.active { color: #C9A84C; background: rgba(201,168,76,0.07); border-bottom-color: #C9A84C; font-weight: 700; }
    .crm-kpi { background: #E8E2D4; border: 1px solid #C8C0AE; border-radius: 6px; padding: 20px 24px; position: relative; overflow: hidden; transition: border-color .2s; }
    .crm-kpi:hover { border-color: #BDB5A5; }
    .crm-lead-card { background: #E8E2D4; border: 1px solid #C8C0AE; border-radius: 6px; padding: 13px 14px; cursor: pointer; transition: all .15s; }
    .crm-lead-card:hover { border-color: #BDB5A5; transform: translateY(-1px); }
    .crm-tag { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 10px; font-family: 'IBM Plex Mono', monospace; font-weight: 500; }
    .crm-section-label { font-size: 10px; color: #7A6A50; font-family: 'IBM Plex Mono', monospace; letter-spacing: .15em; margin-bottom: 14px; display: block; }
    .crm-row-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #CFC9B8; }
    .crm-row-item:last-child { border-bottom: none; }
    .crm-panel { background: #E8E2D4; border: 1px solid #C8C0AE; border-radius: 6px; padding: 24px; }
    .crm-move-btn { font-size: 9px; padding: 2px 6px; border-radius: 3px; font-family: 'IBM Plex Mono', monospace; transition: all .15s; cursor: pointer; border: none; }
  `;

  const LABEL_S = { fontSize: 10, color: "#7A6A50", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: ".12em", display: "block", marginBottom: 5 };

  function CRMField({ label, value, onChange, placeholder, type="text" }) {
    return <div><label style={LABEL_S}>{label.toUpperCase()}</label><input className="crm-input" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} /></div>;
  }
  function CRMSelect({ label, value, onChange, options, labels }) {
    return <div><label style={LABEL_S}>{label.toUpperCase()}</label>
      <select className="crm-input" value={value} onChange={e=>onChange(e.target.value)} style={{cursor:"pointer"}}>
        {options.map((o,i)=><option key={o} value={o}>{labels?labels[i]:o}</option>)}
      </select></div>;
  }
  function CRMTextarea({ label, value, onChange, placeholder }) {
    return <div><label style={LABEL_S}>{label.toUpperCase()}</label>
      <textarea className="crm-input" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{resize:"vertical"}} /></div>;
  }
  function CRMModalHeader({ title, onClose }) {
    return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
      <h2 style={{fontSize:16,fontWeight:800,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>{title}</h2>
      <button onClick={onClose} style={{color:"#7A6A50",fontSize:22,lineHeight:1,background:"none",border:"none",cursor:"pointer"}}>×</button>
    </div>;
  }

  function AddLeadModal({ onClose, onSave }) {
    const ETAPA_MAP_ADD = { NUEVO:'lead', CONVERSACION:'interesado', INTERESADO:'interesado', LLAMADA:'llamada', CERRADO:'cerrado', PERDIDO:'perdido' };
    const [f,setF] = React.useState({
      nombre:"",instagram:"",whatsapp:"",nac:"ARGENTINA",
      servicio:SERVICIOS[0],fuente:FUENTES[0],ads:"—",valor:"",
      etapa:"lead",fechaContacto:todayLocal(),proximoContacto:"",notas:"",
      contactado:"CONTACTADO",canal:"WHATSAPP",tipoCliente:"NUEVO",
      estadoActual:"NUEVO",tipoContacto:"CALIDO",ultimoMensaje:"",ultimaRespuesta:""
    });
    const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
    return <div className="crm-modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="crm-modal-box">
        <CRMModalHeader title="Nuevo Lead / Contacto" onClose={onClose}/>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="Nombre" value={f.nombre} onChange={v=>set("nombre",v)} placeholder="Nombre del artista"/>
            <CRMField label="Instagram / Usuario" value={f.instagram} onChange={v=>set("instagram",v)} placeholder="@handle"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="WhatsApp" value={f.whatsapp} onChange={v=>set("whatsapp",v)} placeholder="+34 600 000 000"/>
            <CRMSelect label="Nacionalidad" value={f.nac} onChange={v=>set("nac",v)} options={["ARGENTINA","ESPANA","EUROPA","AMERICA","EEUU","COLOMBIA","CHILE","MEXICO","OTRO"]}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <CRMSelect label="Canal" value={f.canal} onChange={v=>set("canal",v)} options={["WHATSAPP","INSTAGRAM","OTRO"]}/>
            <CRMSelect label="Tipo de Cliente" value={f.tipoCliente} onChange={v=>set("tipoCliente",v)} options={["NUEVO","COMPRO","RECURRENTE"]}/>
            <CRMSelect label="Tipo de Contacto" value={f.tipoContacto} onChange={v=>set("tipoContacto",v)} options={["FRIO","CALIDO","CALIENTE","COLABORACION"]}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMSelect label="Estado Actual" value={f.estadoActual} onChange={v=>{set("estadoActual",v);set("etapa",ETAPA_MAP_ADD[v]||"lead");}} options={["NUEVO","CONVERSACION","INTERESADO","LLAMADA","CERRADO","PERDIDO"]}/>
            <CRMSelect label="Contactado / No contactado" value={f.contactado} onChange={v=>set("contactado",v)} options={["CONTACTADO","NO CONTACTADO"]}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="Fecha de contacto" value={f.fechaContacto} onChange={v=>set("fechaContacto",v)} type="date"/>
            <CRMField label="📅 Próximo Contacto" value={f.proximoContacto||""} onChange={v=>set("proximoContacto",v)} type="date"/>
          </div>
          <CRMSelect label="Servicio" value={f.servicio} onChange={v=>set("servicio",v)} options={SERVICIOS}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMSelect label="Fuente" value={f.fuente} onChange={v=>set("fuente",v)} options={FUENTES}/>
            <CRMField label="Valor estimado (euros)" value={f.valor} onChange={v=>set("valor",v)} placeholder="0" type="number"/>
          </div>
          <CRMTextarea label="Notas / Contexto" value={f.notas} onChange={v=>set("notas",v)} placeholder="Info relevante sobre el artista..."/>
        </div>
        <div style={{display:"flex",gap:10,marginTop:24}}>
          <button className="crm-btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="crm-btn-gold" onClick={()=>onSave({...f,valor:parseEuro(f.valor)})} style={{flex:2}}>Guardar Lead</button>
        </div>
      </div></div>;
  }

    function EditLeadModal({ lead, onClose, onSave, onDelete }) {
    const [f,setF] = useState({...lead});
    const [err,setErr] = useState("");
    const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
    const ETAPA_TO_ESTADO = { lead:"NUEVO", interesado:"INTERESADO", llamada:"LLAMADA", cerrado:"CERRADO", perdido:"PERDIDO" };
    function doSave(extra){
      const out = {...f, ...(extra||{}), valor: parseEuro(f.valor)};
      if (out.etapa === "perdido" && !out.motivoPerdida) { setErr("Elegí el motivo de pérdida para guardar."); return null; }
      if (lead.etapa !== out.etapa) out.estadoActual = ETAPA_TO_ESTADO[out.etapa] || out.estadoActual;
      if (out.etapa === "cerrado" && !out.fechaCierre) out.fechaCierre = todayLocal();
      if (out.etapa === "llamada" && !out.fechaLlamada) out.fechaLlamada = todayLocal();
      onSave(out); return out;
    }
    const contact = { nombre: f.nombre || f.instagram, telefono: f.whatsapp };
    const sugeridas = f.etapa==="llamada" ? ["sena","completo"] : f.etapa==="cerrado" ? ["confirmado","sena"] : ["seg24","seg72","llamada"];
    return <div className="crm-modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="crm-modal-box">
        <CRMModalHeader title="Editar Lead" onClose={onClose}/>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="Nombre" value={f.nombre} onChange={v=>set("nombre",v)} placeholder="Nombre del artista"/>
            <CRMField label="Instagram" value={f.instagram} onChange={v=>set("instagram",v)} placeholder="@handle"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="WhatsApp" value={f.whatsapp||""} onChange={v=>set("whatsapp",v)} placeholder="+34 600 000 000"/>
            <CRMSelect label="País" value={f.nacionalidad||PAISES[0]} onChange={v=>set("nacionalidad",v)} options={PAISES}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="Fecha de contacto" value={f.fechaContacto||""} onChange={v=>set("fechaContacto",v)} type="date"/>
            <CRMField label="Próximo contacto" value={f.proximoContacto||""} onChange={v=>set("proximoContacto",v)} type="date"/>
          </div>
          <CRMSelect label="Servicio" value={f.servicio} onChange={v=>set("servicio",v)} options={SERVICIOS}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMSelect label="Fuente" value={f.fuente} onChange={v=>set("fuente",v)} options={FUENTES}/>
            {f.fuente==="Meta Ads"&&<CRMField label="Ad (Meta)" value={(f.ads||f.guion||"").replace("—","")} onChange={v=>set("ads",v)} placeholder="Nombre del ad..."/>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="Valor (€)" value={f.valor||""} onChange={v=>set("valor",v)} placeholder="0" type="number"/>
            <CRMSelect label="Etapa" value={f.etapa} onChange={v=>set("etapa",v)} options={ETAPAS.map(e=>e.id)} labels={ETAPAS.map(e=>e.label)}/>
          </div>
          <CRMSelect label="Modalidad" value={f.modalidad||""} onChange={v=>{set("modalidad",v); if(!parseEuro(f.valor)) set("valor", v==="Con estudio"?400:v==="Online"?300:f.valor);}} options={["","Online","Con estudio"]} labels={["— Sin definir —","Online (300 €)","Con estudio · Top Global (400 €)"]}/>
          {f.etapa==="perdido"&&<div style={{background:"#FDECEC",border:"1px solid #F5B5B5",borderRadius:8,padding:12}}>
            <CRMSelect label="Motivo de pérdida (obligatorio)" value={f.motivoPerdida||""} onChange={v=>{set("motivoPerdida",v);setErr("");}} options={[""].concat(window.MOTIVOS_PERDIDA||[])} labels={["— Elegí un motivo —"].concat(window.MOTIVOS_PERDIDA||[])}/>
          </div>}
          <CRMTextarea label="Notas" value={f.notas||""} onChange={v=>set("notas",v)} placeholder="Info relevante..."/>
          <details open={f.etapa==="llamada"||!!f.callPresupuesto} style={{border:"1px solid #CFC9B8",borderRadius:8,padding:"10px 12px",background:"#F5F0E4"}}>
            <summary style={{cursor:"pointer",fontSize:12,fontWeight:700,color:"#2C2010"}}>📞 Llamada de descubrimiento</summary>
            <p style={{fontSize:11,color:"#7A6A50",margin:"8px 0 10px"}}>Antes de cortar: presupuesto, cantidad de temas y fecha. Al final, propuesta + link de seña.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
              <CRMField label="Presupuesto que tiene (€)" value={f.callPresupuesto||""} onChange={v=>set("callPresupuesto",v)} placeholder="ej. 300"/>
              <CRMField label="Nº de temas" value={f.callTemas||""} onChange={v=>set("callTemas",v)} placeholder="ej. 1 / EP de 4"/>
              <CRMField label="Fecha de lanzamiento" value={f.callLanzamiento||""} onChange={v=>set("callLanzamiento",v)} type="date"/>
              <CRMSelect label="¿Decide solo?" value={f.callDecisor||""} onChange={v=>set("callDecisor",v)} options={["","Sí","No, con otra persona"]} labels={["—","Sí","No, con otra persona"]}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:10}}>
              <CRMField label="Objeción principal" value={f.callObjecion||""} onChange={v=>set("callObjecion",v)} placeholder="precio, tiempo, confianza…"/>
              <CRMField label="Link de Fathom" value={f.callFathom||""} onChange={v=>set("callFathom",v)} placeholder="https://fathom.video/…"/>
              <CRMSelect label="Resultado" value={f.callResultado||""} onChange={v=>set("callResultado",v)} options={["","Cerró en la llamada","Pidió pensarlo","No califica","No se presentó"]} labels={["—","Cerró en la llamada","Pidió pensarlo","No califica","No se presentó"]}/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,marginTop:12,fontSize:13,color:"#2C2010",cursor:"pointer"}}>
              <input type="checkbox" checked={!!f.callSenaEnviada} onChange={e=>set("callSenaEnviada",e.target.checked)} style={{width:18,height:18}}/>
              Le mandé propuesta + link de seña
            </label>
          </details>
          {err&&<div role="alert" style={{color:"#B42318",fontSize:12,fontWeight:700}}>{err}</div>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:20,alignItems:"center",flexWrap:"wrap"}}>
          <button className="crm-btn-danger" onClick={()=>onDelete(lead.id)}>Eliminar</button>
          <button className="crm-btn-ghost" onClick={e=>window.openWaMenu(e,contact,sugeridas)} title="Mandar WhatsApp con plantilla">💬 WhatsApp</button>
          {!f.clienteFinId&&f.etapa!=="perdido"&&<button className="crm-btn-ghost" onClick={()=>{const s=doSave({etapa:"cerrado"}); if(s) window.convertLeadToCliente(s);}} title="Crear el cliente en Finanzas con estos datos">✓ Convertir en cliente</button>}
          {f.clienteFinId&&<span style={{fontSize:11,color:"#1A5C2A",fontWeight:700}}>✓ Ya es cliente</span>}
          <div style={{flex:1}}/>
          <button className="crm-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="crm-btn-gold" onClick={()=>doSave()}>Guardar</button>
        </div>
      </div></div>;
  }

  function AddMetaModal({ onClose, onSave }) {
    const [f,setF] = useState({fechaInicio:"",fechaFin:"",guion:"",gastado:"",conversaciones:"",alcance:"",impresiones:"",cpm:""});
    const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
    const getPeriodo=()=>{
      if(f.fechaInicio&&f.fechaFin){
        const fmt=(s)=>{ const d=new Date(s); return d.toLocaleDateString("es-ES",{day:"2-digit",month:"short"}); };
        return fmt(f.fechaInicio)+" – "+fmt(f.fechaFin);
      }
      if(f.fechaInicio) return new Date(f.fechaInicio).toLocaleDateString("es-ES",{day:"2-digit",month:"short"});
      return "";
    };
    return <div className="crm-modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="crm-modal-box">
        <CRMModalHeader title="Registrar Datos Meta" onClose={onClose}/>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={LABEL_S}>PERÍODO</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={{...LABEL_S,fontSize:9,marginBottom:3}}>FECHA INICIO</label><input className="crm-input" type="date" value={f.fechaInicio} onChange={e=>set("fechaInicio",e.target.value)}/></div>
              <div><label style={{...LABEL_S,fontSize:9,marginBottom:3}}>FECHA FIN</label><input className="crm-input" type="date" value={f.fechaFin} onChange={e=>set("fechaFin",e.target.value)}/></div>
            </div>
            {getPeriodo()&&<div style={{fontSize:10,color:"#C9A84C",fontFamily:"'IBM Plex Mono',monospace",marginTop:5}}>📅 {getPeriodo()}</div>}
          </div>
          <CRMField label="Guión activo" value={f.guion} onChange={v=>set("guion",v)} placeholder="Ej: Guión 4 — Testimonios"/>
          <CRMField label="Gasto (€)" value={f.gastado} onChange={v=>set("gastado",v)} placeholder="0.00" type="number"/>
          <CRMField label="Conversaciones iniciadas" value={f.conversaciones} onChange={v=>set("conversaciones",v)} placeholder="0" type="number"/>
          <CRMField label="Alcance" value={f.alcance} onChange={v=>set("alcance",v)} placeholder="0" type="number"/>
          <CRMField label="Impresiones" value={f.impresiones} onChange={v=>set("impresiones",v)} placeholder="0" type="number"/>
          <CRMField label="CPM (€)" value={f.cpm} onChange={v=>set("cpm",v)} placeholder="0.00" type="number"/>
        </div>
        <div style={{display:"flex",gap:10,marginTop:24}}>
          <button className="crm-btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="crm-btn-gold" onClick={()=>onSave({...f,periodo:getPeriodo()})} style={{flex:2}}>Guardar</button>
        </div>
      </div></div>;
  }

  function AddMetaLeadModal({ onClose, onSave }) {
    const [f,setF] = useState({
      nombre:"", telefono:"", instagram:"",
      demoMusica:META_DEMO_OPTS[0], objetivo:META_OBJETIVO_OPTS[0],
      fecha:todayLocal(), estado:META_ESTADO_OPTS[0]
    });
    const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
    return <div className="crm-modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="crm-modal-box">
        <CRMModalHeader title="Nuevo Lead de Meta Ads" onClose={onClose}/>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMField label="Nombre" value={f.nombre} onChange={v=>set("nombre",v)} placeholder="Nombre del lead"/>
            <CRMField label="Teléfono" value={f.telefono} onChange={v=>set("telefono",v)} placeholder="+34 600 000 000"/>
          </div>
          <CRMField label="Instagram" value={f.instagram} onChange={v=>set("instagram",v)} placeholder="@handle"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CRMSelect label="Demo / Música" value={f.demoMusica} onChange={v=>set("demoMusica",v)} options={META_DEMO_OPTS}/>
            <CRMField label="Fecha" value={f.fecha} onChange={v=>set("fecha",v)} type="date"/>
          </div>
          <CRMSelect label="Objetivo" value={f.objetivo} onChange={v=>set("objetivo",v)} options={META_OBJETIVO_OPTS}/>
          <CRMSelect label="Estado" value={f.estado} onChange={v=>set("estado",v)} options={META_ESTADO_OPTS}/>
        </div>
        <div style={{display:"flex",gap:10,marginTop:24}}>
          <button className="crm-btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="crm-btn-gold" onClick={()=>{ if(!(f.nombre||"").trim()) return; onSave(f); }} style={{flex:2}}>Guardar</button>
        </div>
      </div></div>;
  }

  // ═══ v2 · MÉTRICAS DE VENTAS ═══════════════════════════════════
  function MetricasVentas({ leads, meta, totalGasto }) {
    const fin = (typeof appData !== "undefined" && appData.clientes) ? appData.clientes : [];
    const finById = {}; fin.forEach(c => finById[c.id] = c);
    const cobrado = c => (c.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    // Ingreso real: lo que dice Finanzas si el lead se convirtió; si no, el valor estimado
    const precioReal = l => { const c = finById[l.clienteFinId]; return c ? Number(c.precio||0) : Number(l.valor||0); };
    const cerr = leads.filter(l=>l.etapa==="cerrado");
    const perd = leads.filter(l=>l.etapa==="perdido");
    const llegoLlamada = l => ["llamada","cerrado"].includes(l.etapa) || !!l.fechaLlamada || !!l.callResultado;
    const pct = (a,b) => b>0 ? Math.round(a/b*100)+"%" : "—";
    const isMeta = l => (l.fuente||"").toLowerCase()==="meta ads";

    // Por fuente
    const fuentes = {};
    leads.forEach(l => { const k = l.fuente||"Sin fuente"; const o = fuentes[k] = fuentes[k]||{n:0,c:0,ing:0,ll:0}; o.n++; if(llegoLlamada(l)) o.ll++; if(l.etapa==="cerrado"){ o.c++; o.ing+=precioReal(l); } });
    const fuenteRows = Object.entries(fuentes).sort((a,b)=>b[1].n-a[1].n);

    // Por mes
    const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const meses = MES.map(()=>({n:0,c:0}));
    leads.forEach(l => { const d = l.fechaContacto||l.fecha; const m = d ? parseInt(String(d).slice(5,7),10)-1 : -1; if (m>=0&&m<12){ meses[m].n++; if(l.etapa==="cerrado") meses[m].c++; } });

    // Motivos de pérdida
    const motivos = {}; perd.forEach(l => { const k = l.motivoPerdida||"Sin motivo cargado"; motivos[k]=(motivos[k]||0)+1; });
    const motivoRows = Object.entries(motivos).sort((a,b)=>b[1]-a[1]);

    // Embudo
    const conv = leads.filter(l=>l.etapa!=="lead" || l.contactado==="CONTACTADO").length;
    const ll = leads.filter(llegoLlamada).length;
    const senaEnviada = leads.filter(l=>l.callSenaEnviada).length;

    // Ticket medio, días a cierre, modalidad
    const ticket = cerr.length ? cerr.reduce((s,l)=>s+precioReal(l),0)/cerr.length : 0;
    const dias = cerr.map(l => (l.fechaCierre && (l.fechaContacto||l.fecha)) ? (new Date(l.fechaCierre) - new Date(String(l.fechaContacto||l.fecha).slice(0,10)))/864e5 : null).filter(x=>x!==null && x>=0);
    const diasProm = dias.length ? Math.round(dias.reduce((a,b)=>a+b,0)/dias.length) : null;
    const modal = {}; cerr.forEach(l => { const k = l.modalidad || (finById[l.clienteFinId]||{}).modalidad || "Sin definir"; const o = modal[k]=modal[k]||{n:0,ing:0}; o.n++; o.ing+=precioReal(l); });

    // Meta Ads
    const leadsMeta = leads.filter(isMeta), cerrMeta = cerr.filter(isMeta);
    const ingMeta = cerrMeta.reduce((s,l)=>s+precioReal(l),0);
    const cpl = leadsMeta.length && totalGasto ? totalGasto/leadsMeta.length : null;
    const cac = cerrMeta.length && totalGasto ? totalGasto/cerrMeta.length : null;

    // Ingresos previstos
    const PROB = { lead:.05, interesado:.2, llamada:.4 };
    const ponderado = leads.filter(l=>PROB[l.etapa]).reduce((s,l)=>s+(Number(l.valor)||0)*PROB[l.etapa],0);
    const hoy = todayLocal(); const en30 = (()=>{ const d=new Date(); d.setDate(d.getDate()+30); return toLocalISO(d); })();
    const pendienteTotal = fin.filter(c=>c.estado!=="cancelado").reduce((s,c)=>s+Math.max(0,Number(c.precio||0)-cobrado(c)),0);
    const programado30 = fin.filter(c=>c.estado!=="cancelado" && c.proximoCobro && c.proximoCobro.fecha && c.proximoCobro.fecha<=en30).reduce((s,c)=>s+Math.max(0,Number(c.precio||0)-cobrado(c)),0);

    const box = {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:18};
    const Kpi = ({label,value,sub,color}) => <div className="crm-kpi"><div className="crm-section-label" style={{marginBottom:6}}>{label}</div><div style={{fontSize:24,fontWeight:800,color:color||"#2C2010",lineHeight:1.1,fontFamily:"'Syne',sans-serif"}}>{value}</div>{sub&&<div style={{fontSize:11,color:"#6A5A40",marginTop:4}}>{sub}</div>}</div>;
    const th = {textAlign:"left",fontSize:10,color:"#6A5A40",fontFamily:"'IBM Plex Mono',monospace",padding:"6px 8px",borderBottom:"1px solid #CFC9B8"};
    const td = {fontSize:12,color:"#2C2010",padding:"6px 8px",borderBottom:"1px solid #E4DDD0"};

    return <div style={{marginBottom:28}}>
      <div style={box}>
        <Kpi label="TICKET MEDIO" value={fmtC(ticket)} sub={cerr.length+" ventas"}/>
        <Kpi label="DÍAS HASTA CERRAR" value={diasProm===null?"—":diasProm+" días"} sub="del primer contacto al cierre"/>
        <Kpi label="COBROS PRÓX. 30 DÍAS" value={fmtC(programado30)} sub={"pendiente total "+fmtC(pendienteTotal)} color="#1A5C2A"/>
        <Kpi label="PIPELINE PONDERADO" value={fmtC(ponderado)} sub="valor × probabilidad por etapa" color="#1A4A8C"/>
      </div>
      <div style={box}>
        <Kpi label="META · COSTO POR LEAD" value={cpl?fmtC(cpl):"—"} sub={leadsMeta.length+" leads de Meta"} color="#5A2A8C"/>
        <Kpi label="META · COSTO POR CLIENTE" value={cac?fmtC(cac):"—"} sub={cerrMeta.length+" ventas de Meta"} color="#5A2A8C"/>
        <Kpi label="META · ROI REAL" value={totalGasto?Math.round(ingMeta/totalGasto*100)+"%":"—"} sub={fmtC(ingMeta)+" vendidos / "+fmtC(totalGasto)+" gastados"} color="#5A2A8C"/>
        <Kpi label="SEÑA ENVIADA EN LLAMADA" value={pct(senaEnviada,ll)} sub={senaEnviada+" de "+ll+" llamadas"}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16,marginBottom:18}}>
        <div className="crm-panel">
          <span className="crm-section-label">EMBUDO</span>
          {[["Leads",leads.length],["Conversación",conv],["Llamada",ll],["Cerrados",cerr.length]].map(([lbl,n],i,arr)=><div key={lbl} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>{lbl}</span><b>{n}{i>0&&<span style={{fontWeight:400,color:"#6A5A40"}}> · {pct(n,arr[i-1][1])} del paso anterior</span>}</b></div>
            <div style={{background:"#DDD7C8",borderRadius:2,height:6,marginTop:4}}><div style={{width:(leads.length?n/leads.length*100:0)+"%",height:"100%",background:"#2C2010",borderRadius:2}}/></div>
          </div>)}
        </div>
        <div className="crm-panel">
          <span className="crm-section-label">POR FUENTE</span>
          <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={th}>Fuente</th><th style={th}>Leads</th><th style={th}>Llamada</th><th style={th}>Ventas</th><th style={th}>Cierre</th><th style={th}>€</th></tr></thead>
          <tbody>{fuenteRows.map(([k,o])=><tr key={k}><td style={td}>{k}</td><td style={td}>{o.n}</td><td style={td}>{o.ll}</td><td style={td}>{o.c}</td><td style={{...td,fontWeight:700}}>{pct(o.c,o.n)}</td><td style={td}>{fmtC(o.ing)}</td></tr>)}
          {!fuenteRows.length&&<tr><td style={td} colSpan={6}>Sin datos este año.</td></tr>}</tbody></table>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
        <div className="crm-panel">
          <span className="crm-section-label">CIERRE POR MES (LEADS → VENTAS)</span>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
            {meses.map((m,i)=><div key={i} style={{textAlign:"center",padding:"6px 2px",borderRadius:6,background:m.n?"#EDE8DB":"transparent"}}>
              <div style={{fontSize:10,color:"#6A5A40"}}>{MES[i]}</div>
              <div style={{fontSize:14,fontWeight:800}}>{m.n?pct(m.c,m.n):"—"}</div>
              <div style={{fontSize:10,color:"#6A5A40"}}>{m.c}/{m.n}</div>
            </div>)}
          </div>
        </div>
        <div className="crm-panel">
          <span className="crm-section-label">POR QUÉ SE PIERDEN</span>
          {motivoRows.map(([k,n])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:"1px solid #E4DDD0"}}><span>{k}</span><b>{n} · {pct(n,perd.length)}</b></div>)}
          {!motivoRows.length&&<div style={{fontSize:12,color:"#6A5A40"}}>Todavía no hay leads perdidos con motivo.</div>}
          <div style={{height:14}}/>
          <span className="crm-section-label">VENTAS POR MODALIDAD</span>
          {Object.entries(modal).map(([k,o])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:"1px solid #E4DDD0"}}><span>{k}</span><b>{o.n} · {fmtC(o.ing)}</b></div>)}
          {!Object.keys(modal).length&&<div style={{fontSize:12,color:"#6A5A40"}}>Sin ventas este año.</div>}
        </div>
      </div>
    </div>;
  }

  // CRM Tabs
  function ResumenTab({ year, meta, leads, cerrados, activos, tasaCierre, ingresosCerrados, pipelinePotencial, totalGasto, totalConvs, costoConv }) {
    const recent = [...leads].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,6);
    const kpis = [
      { label:"Leads Totales", value:leads.length, sub:`${activos.length} activos`, color:"#C9A84C" },
      { label:"Tasa de Cierre", value:tasaCierre+"%", sub:`${cerrados.length} cerrados`, color:"#3FB950" },
      { label:"Ingresos Cerrados", value:fmtC(ingresosCerrados), sub:"confirmado", color:"#C9A84C" },
      { label:"Pipeline Potencial", value:fmtC(pipelinePotencial), sub:`${activos.length} en curso`, color:"#58A6FF" },
      { label:"Gasto Meta Total", value:"€"+totalGasto.toFixed(0), sub:"acumulado", color:"#F0B429" },
      { label:"Costo por Conv.", value:costoConv?"€"+costoConv:"—", sub:`${totalConvs} conversaciones`, color:"#F0B429" },
    ];
    // v2: el ROI de Meta usa SOLO las ventas que vinieron de Meta Ads
    const ingresosMeta = cerrados.filter(l=>(l.fuente||"").toLowerCase()==="meta ads").reduce((s,l)=>s+(Number(l.valor)||0),0);
    const roi=totalGasto>0?((ingresosMeta/totalGasto)*100).toFixed(0):null;
    const proyeccion=pipelinePotencial*(tasaCierre/100);
    const total=ingresosCerrados+proyeccion;
    const svcMap={};
    cerrados.forEach(l=>{const s=l.servicio||"Sin categoría";svcMap[s]=(svcMap[s]||0)+(Number(l.valor)||0);});
    const svcList=Object.entries(svcMap).sort((a,b)=>b[1]-a[1]);
    return <div style={{flex:1,overflow:"auto",padding:"28px 32px"}}>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:800,color:"#2C2010",letterSpacing:".02em",fontFamily:"'Syne',sans-serif"}}>Resumen & Finanzas</h1><p style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:3}}>Datos de {year} · cambiá el año en la barra lateral</p></div>
      <MetricasVentas leads={leads} meta={meta} totalGasto={totalGasto}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
        {kpis.map((k,i)=><div key={i} className="crm-kpi">
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:k.color,opacity:.6}}/>
          <div className="crm-section-label" style={{marginBottom:6}}>{k.label.toUpperCase()}</div>
          <div style={{fontSize:28,fontWeight:800,color:k.color,lineHeight:1,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>{k.value}</div>
          <div style={{fontSize:11,color:"#8A7A60",fontFamily:"'IBM Plex Mono',monospace"}}>{k.sub}</div>
        </div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:16,marginBottom:24}}>
        <div className="crm-panel">
          <span className="crm-section-label">FUNNEL DE VENTAS</span>
          {ETAPAS.map(e=>{
            const count=leads.filter(l=>l.etapa===e.id).length;
            const pct=leads.length>0?(count/leads.length)*100:0;
            return <div key={e.id} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:11,color:e.color,fontFamily:"'IBM Plex Mono',monospace"}}>{e.label}</span>
                <span style={{fontSize:11,color:e.color,fontFamily:"'IBM Plex Mono',monospace",fontWeight:700}}>{count}</span>
              </div>
              <div style={{background:"#DDD7C8",borderRadius:2,height:4}}>
                <div style={{width:pct+"%",height:"100%",background:e.color,borderRadius:2,transition:"width .5s"}}/>
              </div>
            </div>;
          })}
        </div>
        <div className="crm-panel">
          <span className="crm-section-label">ÚLTIMOS LEADS</span>
          {recent.map(l=><div key={l.id} className="crm-row-item">
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>{l.instagram?`@${l.instagram}`:l.nombre}</div>
              <div style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>{l.servicio} · {fmtDateC(l.fecha)}</div>
            </div>
            <div>
              {(() => { const e=ETAPAS.find(x=>x.id===l.etapa)||ETAPAS[0]; return <span className="crm-tag" style={{background:e.bg,color:e.color}}>{e.label}</span>; })()}
            </div>
          </div>)}
          {!recent.length&&<div style={{color:"#8A7A60",fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>Sin leads todavía.</div>}
        </div>
      </div>
      {/* ── FINANZAS SECTION ── */}
      <div style={{marginBottom:20}}><h2 style={{fontSize:17,fontWeight:800,color:"#2C2010",fontFamily:"'Syne',sans-serif",marginBottom:2}}>Balance & Proyección</h2><p style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace"}}>Ingresos confirmados y proyección de cierre</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div className="crm-kpi" style={{borderTop:"2px solid #C9A84C88",padding:28}}><div className="crm-section-label">INGRESOS CONFIRMADOS</div><div style={{fontSize:36,fontWeight:800,color:"#C9A84C",lineHeight:1,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>{fmtC(ingresosCerrados)}</div><div style={{fontSize:12,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace"}}>{cerrados.length} cliente{cerrados.length!==1?"s":""} cerrado{cerrados.length!==1?"s":""}</div></div>
        <div className="crm-kpi" style={{borderTop:"2px solid #58A6FF66",padding:28}}><div className="crm-section-label">PROYECCIÓN TOTAL</div><div style={{fontSize:36,fontWeight:800,color:"#58A6FF",lineHeight:1,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>{fmtC(total)}</div><div style={{fontSize:12,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace"}}>Cerrado + {fmtC(proyeccion)} proyectado ({tasaCierre}% cierre)</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[{label:"Gasto Meta",value:"€"+totalGasto.toFixed(0),color:"#F0B429"},{label:"ROI Meta",value:roi?roi+"%":"—",color:"#3FB950"},{label:"Tasa de Cierre",value:tasaCierre+"%",color:"#3FB950"}].map((k,i)=>
          <div key={i} className="crm-kpi"><div className="crm-section-label">{k.label.toUpperCase()}</div><div style={{fontSize:26,fontWeight:800,color:k.color,fontFamily:"'Syne',sans-serif"}}>{k.value}</div></div>
        )}
      </div>
      <div className="crm-panel">
        <span className="crm-section-label">INGRESOS POR SERVICIO</span>
        {!svcList.length&&<div style={{color:"#8A7A60",fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>Sin datos.</div>}
        {svcList.map(([s,v])=>{const pct=ingresosCerrados>0?(v/ingresosCerrados)*100:0; return <div key={s} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"#6A5A40",fontFamily:"'IBM Plex Mono',monospace"}}>{s}</span><span style={{fontSize:11,color:"#C9A84C",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtC(v)}</span></div>
          <div style={{background:"#DDD7C8",borderRadius:2,height:4}}><div style={{width:pct+"%",height:"100%",background:"#C9A84C",borderRadius:2,transition:"width .5s"}}/></div>
        </div>;})}
        {cerrados.length>0&&<><div style={{height:16}}/><span className="crm-section-label">CLIENTES CERRADOS</span>
          {cerrados.map(l=><div key={l.id} className="crm-row-item">
            <div><div style={{fontSize:13,fontWeight:700,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>{l.instagram?`@${l.instagram}`:l.nombre}</div>
            <div style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>{l.servicio} · {fmtDateC(l.fecha)}</div></div>
            <div style={{fontSize:18,fontWeight:800,color:"#C9A84C",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtC(l.valor)}</div>
          </div>)}
        </>}
      </div>
    </div>;
  }

  function PipelineTab({ leads, saveLeads, onOpenLead, onAdd }) {
    const [search, setSearch] = React.useState("");
    const [filterFuente, setFilterFuente] = React.useState("");
    const [filterServicio, setFilterServicio] = React.useState("");
    const [editingCell, setEditingCell] = React.useState(null);
    const [editValue, setEditValue] = React.useState("");
    const [filterSeg, setFilterSeg] = React.useState("");

    const ETAPA_MAP = { NUEVO:'lead', CONVERSACION:'interesado', INTERESADO:'interesado', LLAMADA:'llamada', CERRADO:'cerrado', PERDIDO:'perdido' };
    const CANAL_OPTS = ["WHATSAPP","INSTAGRAM","OTRO"];
    const TIPO_CLI_OPTS = ["NUEVO","COMPRO","RECURRENTE"];
    const ESTADO_OPTS = ["NUEVO","CONVERSACION","INTERESADO","LLAMADA","CERRADO","PERDIDO"];
    const CONTACTO_OPTS = ["CONTACTADO","NO CONTACTADO"];
    const NAC_OPTS = ["ARGENTINA","ESPAÑA","EUROPA","AMERICA","EEUU","COLOMBIA","CHILE","MEXICO","OTRO"];
    const TIPO_CONTACTO_OPTS = ["FRIO","CALIDO","CALIENTE","COLABORACION"];

    function updateLead(id, field, value) {
      // 'valor' debe guardarse como número, no como texto (si no, las sumas se concatenan)
      const val = field === 'valor' ? parseEuro(value) : value;
      const upd = leads.map(l => {
        if (l.id !== id) return l;
        const updated = {...l, [field]: val};
        if (field === 'estadoActual') updated.etapa = ETAPA_MAP[value] || 'lead';
        if (updated.etapa === 'cerrado' && !updated.fechaCierre) updated.fechaCierre = todayLocal();
        if (updated.etapa === 'llamada' && !updated.fechaLlamada) updated.fechaLlamada = todayLocal();
        return updated;
      });
      saveLeads(upd);
      // v2: al marcar PERDIDO pedir motivo; al marcar CERRADO ofrecer convertir en cliente
      if (field === 'estadoActual') {
        const u = upd.find(l => l.id === id);
        if (value === 'PERDIDO' && !u.motivoPerdida) { showToast('Elegí el motivo de pérdida'); onOpenLead(u); }
        if (value === 'CERRADO' && !u.clienteFinId) { showToast('Cerrado 🎉 Convertilo en cliente para registrar la seña'); onOpenLead(u); }
      }
    }

    function pillColors(type, value) {
      const v = (value||"").toUpperCase();
      const maps = {
        contactado: { CONTACTADO:{bg:'#C8EAD0',color:'#1A5C2A'}, 'NO CONTACTADO':{bg:'#FAC8C6',color:'#8C1A18'} },
        canal: { WHATSAPP:{bg:'#C8EAD0',color:'#1A5C2A'}, INSTAGRAM:{bg:'#FAD9C0',color:'#8C3A10'}, OTRO:{bg:'#E4DDD0',color:'#7A6A50'} },
        tipoCliente: { NUEVO:{bg:'#C8DCF5',color:'#1A4A8C'}, COMPRO:{bg:'#C8EAD0',color:'#1A5C2A'}, RECURRENTE:{bg:'#C8EDD8',color:'#1A6040'} },
        nacionalidad: {
          ARGENTINA:{bg:'#BEE3DC',color:'#0D4A40'}, ESPAÑA:{bg:'#FAC8C6',color:'#8C1A18'}, ESPANA:{bg:'#FAC8C6',color:'#8C1A18'},
          EUROPA:{bg:'#FAD9C0',color:'#8C4010'}, AMERICA:{bg:'#FAE0B0',color:'#8C5010'},
          EEUU:{bg:'#C8DCF5',color:'#1A4A8C'}, COLOMBIA:{bg:'#C8EAD0',color:'#1A5C2A'},
          CHILE:{bg:'#BEE3DC',color:'#0D4A40'}, MEXICO:{bg:'#FAD9C0',color:'#8C4010'}, OTRO:{bg:'#E4DDD0',color:'#7A6A50'}
        },
        estado: {
          NUEVO:{bg:'#DCEAFD',color:'#1A3A8C'}, CONVERSACION:{bg:'#FAD9C0',color:'#8C3A10'},
          INTERESADO:{bg:'#FFF0C0',color:'#7A5A00'}, CERRADO:{bg:'#C8EAD0',color:'#1A5C2A'}, PERDIDO:{bg:'#FAC8C6',color:'#8C1A18'}
        },
        tipoContacto: {
          FRIO:{bg:'#DDE4F0',color:'#3A5080'}, CALIDO:{bg:'#FFF0C0',color:'#7A5A00'},
          CALIENTE:{bg:'#FAD9C0',color:'#8C3A10'}, COLABORACION:{bg:'#EDD8FA',color:'#5A2A8C'}
        },
        fuente: {
          'META ADS':{bg:'#EDD8FA',color:'#5A2A8C'}, 'ORGÁNICO':{bg:'#C8EAD0',color:'#1A5C2A'},
          'ORGANICO':{bg:'#C8EAD0',color:'#1A5C2A'}, 'REFERIDO':{bg:'#FFF0C0',color:'#7A5A00'},
          'DM OUTREACH':{bg:'#C8DCF5',color:'#1A4A8C'}
        }
      };
      return maps[type]?.[v] || {bg:'#E4DDD0', color:'#7A6A50'};
    }

    function PillSelect({leadId, field, value, options, type}) {
      const {bg, color} = pillColors(type, value);
      return <select value={value||""} onChange={e=>updateLead(leadId,field,e.target.value)}
        style={{background:bg,color,border:'none',borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,
          fontFamily:"'IBM Plex Mono',monospace",cursor:'pointer',appearance:'none',WebkitAppearance:'none',
          outline:'none',width:'100%',textAlign:'center',letterSpacing:'.02em',boxShadow:'none',overflow:'hidden',textOverflow:'ellipsis'}}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>;
    }

    function TextCell({leadId, field, value, placeholder}) {
      const isEditing = editingCell && editingCell.id===leadId && editingCell.field===field;
      if (isEditing) return <input autoFocus value={editValue}
        onChange={e=>setEditValue(e.target.value)}
        onBlur={()=>{ updateLead(leadId,field,editValue); setEditingCell(null); }}
        onKeyDown={e=>{ if(e.key==='Enter'){updateLead(leadId,field,editValue);setEditingCell(null);} else if(e.key==='Escape'){setEditingCell(null);} }}
        style={{background:'transparent',border:'none',borderBottom:'1.5px solid #C9A84C',width:'100%',
          fontSize:11,color:'#2C2010',fontFamily:"'DM Sans',sans-serif",outline:'none',padding:'1px 0'}}/>;
      return <div onClick={()=>{setEditingCell({id:leadId,field});setEditValue(value||"");}}
        style={{fontSize:11,color:value?'#2C2010':'#B0A090',cursor:'text',fontFamily:"'DM Sans',sans-serif",
          fontStyle:value?'normal':'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {value||placeholder}
      </div>;
    }

    function DatePickerCell({leadId, field, value}) {
      const formatted = value ? new Date(value+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'}) : null;
      const isEditing = editingCell && editingCell.id===leadId && editingCell.field===field;
      if (isEditing) return <input autoFocus type="date" value={editValue}
        onChange={e=>setEditValue(e.target.value)}
        onBlur={()=>{ updateLead(leadId,field,editValue); setEditingCell(null); }}
        onKeyDown={e=>{ if(e.key==='Enter'){updateLead(leadId,field,editValue);setEditingCell(null);} else if(e.key==='Escape'){setEditingCell(null);} }}
        style={{background:'transparent',border:'none',borderBottom:'1.5px solid #C9A84C',width:'100%',
          fontSize:10,color:'#2C2010',fontFamily:"'IBM Plex Mono',monospace",outline:'none',padding:'1px 0'}}/>;
      return <div onClick={()=>{setEditingCell({id:leadId,field});setEditValue(value||'');}}
        style={{fontSize:10,color:value?'#2C2010':'#B0A090',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",
          fontStyle:value?'normal':'italic',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
        {value ? `📅 ${formatted}` : '— sin fecha'}
      </div>;
    }

    function FuenteCell({leadId, value}) {
      const {bg,color} = pillColors('fuente', (value||'').toUpperCase());
      return <select value={value||FUENTES[0]} onChange={e=>updateLead(leadId,'fuente',e.target.value)}
        style={{background:bg,color,border:'none',borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,
          fontFamily:"'IBM Plex Mono',monospace",cursor:'pointer',appearance:'none',WebkitAppearance:'none',
          outline:'none',width:'100%',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis'}}>
        {FUENTES.map(o=><option key={o} value={o}>{o}</option>)}
      </select>;
    }

    function ServicioCell({leadId, value}) {
      return <select value={value||SERVICIOS[0]} onChange={e=>updateLead(leadId,'servicio',e.target.value)}
        style={{background:'#E4DDD0',color:'#4A3A20',border:'none',borderRadius:4,padding:'2px 5px',fontSize:10,fontWeight:600,
          fontFamily:"'DM Sans',sans-serif",cursor:'pointer',appearance:'none',WebkitAppearance:'none',
          outline:'none',width:'100%',overflow:'hidden',textOverflow:'ellipsis'}}>
        {SERVICIOS.map(o=><option key={o} value={o}>{o}</option>)}
      </select>;
    }

    function derivedCanal(l) {
      if (l.canal) return l.canal.toUpperCase();
      const f = (l.fuente||"").toLowerCase();
      if (f.includes("dm") || f.includes("instagram")) return "INSTAGRAM";
      if (f.includes("whats") || f.includes("orgán") || f.includes("refer")) return "WHATSAPP";
      return "OTRO";
    }
    function derivedEstado(l) {
      if (l.estadoActual) return l.estadoActual.toUpperCase();
      const e = l.etapa||"lead";
      return e==='cerrado'?'CERRADO':e==='perdido'?'PERDIDO':e==='interesado'?'INTERESADO':e==='llamada'?'CONVERSACION':'NUEVO';
    }
    function derivedNac(l) {
      const n = (l.nac||l.nacionalidad||"").toUpperCase();
      if (!n) return "OTRO";
      if (n.includes("ARGENTIN")) return "ARGENTINA";
      if (n.includes("ESPA")) return "ESPAÑA";
      if (n.includes("EUROP")) return "EUROPA";
      if (n.includes("AMERIC")) return "AMERICA";
      if (n.includes("EEUU")||n.includes("USA")) return "EEUU";
      if (n.includes("COLOMB")) return "COLOMBIA";
      if (n.includes("CHILE")) return "CHILE";
      if (n.includes("MEXIC")) return "MEXICO";
      return n;
    }

    // ── EXPORT para Meta (CSV) ──────────────────────────────────
    // Columnas: Ubicacion, Ig, Nombre, Correo o Telefono, Ubicacion
    // Exporta los leads que están actualmente visibles (respeta filtros/búsqueda).
    function exportMetaCSV() {
      const rows = filteredLeads.map(l => {
        const loc = derivedNac(l);
        const ig  = l.instagram ? (l.instagram[0]==='@' ? l.instagram : '@'+l.instagram) : '';
        const contacto = (l.email || l.correo || l.whatsapp || '').toString().trim();
        return [loc, ig, l.nombre||'', contacto, loc];
      });
      const header = ['Ubicacion','Ig','Nombre','Correo o Telefono','Ubicacion'];
      const esc = v => {
        const s = (v==null ? '' : String(v));
        return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
      };
      const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
      const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pipeline_meta_' + todayLocal() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
    }

    // v2: primero lo que hay que seguir (vencidos y hoy), después por estado
    const HOY = todayLocal();
    const isActivo = l => !["cerrado","perdido"].includes(l.etapa);
    const segState = l => !isActivo(l) ? "" : !l.proximoContacto ? "sin" : l.proximoContacto < HOY ? "vencido" : l.proximoContacto === HOY ? "hoy" : "futuro";
    const vencidosN = leads.filter(l => ["vencido","hoy"].includes(segState(l))).length;
    const ESTADO_ORDER = {LLAMADA:0,INTERESADO:1,CONVERSACION:2,NUEVO:3,CERRADO:4,PERDIDO:5};
    const SEG_ORDER = {vencido:0,hoy:1,futuro:2,sin:3,"":4};
    const sortLeads = arr => [...arr].sort((a,b)=>{
      const sa = SEG_ORDER[segState(a)], sb = SEG_ORDER[segState(b)];
      if (sa !== sb) return sa - sb;
      if (sa <= 2 && a.proximoContacto !== b.proximoContacto) return (a.proximoContacto||"") < (b.proximoContacto||"") ? -1 : 1;
      const ea = (a.estadoActual||derivedEstado(a)).toUpperCase();
      const eb = (b.estadoActual||derivedEstado(b)).toUpperCase();
      const oa = ESTADO_ORDER[ea]??3, ob = ESTADO_ORDER[eb]??3;
      return oa - ob;
    });

    const filteredLeads = sortLeads(leads.filter(l => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        (l.nombre||"").toLowerCase().includes(q) ||
        (l.instagram||"").toLowerCase().includes(q) ||
        (l.estadoActual||l.etapa||"").toLowerCase().includes(q) ||
        (l.nacionalidad||"").toLowerCase().includes(q) ||
        (l.fuente||"").toLowerCase().includes(q) ||
        (l.servicio||"").toLowerCase().includes(q);
      const matchFuente = !filterFuente || (l.fuente||"").toLowerCase() === filterFuente.toLowerCase();
      const matchServicio = !filterServicio || (l.servicio||"").toLowerCase() === filterServicio.toLowerCase();
      const seg = segState(l);
      const matchSeg = !filterSeg || (filterSeg === "seguir" ? (seg === "vencido" || seg === "hoy") : filterSeg === "sin" ? seg === "sin" : filterSeg === "activos" ? isActivo(l) : true);
      return matchSearch && matchFuente && matchServicio && matchSeg;
    }));

    const COLS = [
      {label:"Estado",w:95,highlight:true},
      {label:"Contactado",w:70},{label:"Nombre / Usuario",w:110},{label:"Canal",w:65},
      {label:"Tipo Cliente",w:70},{label:"País",w:70},{label:"F. Contacto",w:78},
      {label:"Próximo Contacto",w:98,proximoHighlight:true},
      {label:"Fuente",w:82},{label:"Valor €",w:62},{label:"Servicio",w:105},
      {label:"Notas",w:70},{label:"Nivel",w:75},{label:"",w:52}
    ];

    const thBase = {padding:"7px 7px",textAlign:"left",fontSize:9,color:"#4A3A28",
      fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".06em",fontWeight:700,
      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
      borderBottom:"2px solid #BDB5A5",borderRight:"1px solid #CFC9B8",
      background:"#DDD7C8",verticalAlign:"middle",lineHeight:1.3};
    const thHighlight = {...thBase,background:"#C8BEA8",color:"#2C2010",borderBottom:"2px solid #A09070",borderRight:"2px solid #A09070"};
    const thProximo = {...thBase,background:"#C9A84C",color:"#2C2010",borderBottom:"2px solid #A08030",borderRight:"2px solid #A08030",textShadow:"0 1px 0 rgba(255,255,255,0.3)"};
    const tdBase = {padding:"6px 7px",borderRight:"1px solid #E4DDD0",verticalAlign:"middle",overflow:"hidden",maxWidth:0};
    const tdHighlight = {...tdBase,borderRight:"2px solid #C8BEA8",background:"rgba(180,160,120,0.08)"};
    const tdProximo = {...tdBase,borderRight:"2px solid #C9A84C",background:"rgba(201,168,76,0.10)"};

    return <div style={{flex:1,overflow:"hidden",display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{padding:"18px 24px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#EDE8DB",borderBottom:"1px solid #CFC9B8",flexShrink:0}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>Pipeline</h1>
          <p style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>{leads.length} contactos · {vencidosN>0?<b style={{color:"#B42318"}}>{vencidosN} para seguir hoy</b>:"al día con los seguimientos"}</p>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {[["","Todos"],["seguir","Seguir hoy ("+vencidosN+")"],["sin","Sin próximo contacto"],["activos","Solo activos"]].map(([k,lbl])=>
              <button key={k} onClick={()=>setFilterSeg(k)} style={{fontSize:11,padding:"5px 10px",borderRadius:20,border:"1px solid "+(filterSeg===k?"#2C2010":"#BDB5A5"),background:filterSeg===k?"#2C2010":"transparent",color:filterSeg===k?"#fff":"#4A3A28",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{lbl}</button>)}
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{background:"#DDD7C8",border:"1px solid #BDB5A5",borderRadius:4,color:"#2C2010",padding:"8px 12px",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",outline:"none",width:150}}/>
          <select value={filterFuente} onChange={e=>setFilterFuente(e.target.value)} style={{background:"#DDD7C8",border:"1px solid #BDB5A5",borderRadius:4,color:filterFuente?"#2C2010":"#7A6A50",padding:"8px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",cursor:"pointer"}}>
            <option value="">📡 Fuente</option>
            {FUENTES.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterServicio} onChange={e=>setFilterServicio(e.target.value)} style={{background:"#DDD7C8",border:"1px solid #BDB5A5",borderRadius:4,color:filterServicio?"#2C2010":"#7A6A50",padding:"8px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",cursor:"pointer"}}>
            <option value="">🎛 Servicio</option>
            {SERVICIOS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {(search||filterFuente||filterServicio)&&<button onClick={()=>{setSearch("");setFilterFuente("");setFilterServicio("");}} style={{background:"transparent",border:"1px solid #BDB5A5",borderRadius:4,color:"#9A8A6A",padding:"7px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",cursor:"pointer"}} title="Limpiar filtros">✕ Limpiar</button>}
          <button className="crm-btn-ghost" onClick={exportMetaCSV} title="Exportar contactos visibles en formato Meta (CSV): Ubicación, IG, Nombre, Correo o Teléfono, Ubicación">⬇ Export Meta</button>
          <button className="crm-btn-gold" onClick={onAdd}>+ Nuevo Lead</button>
        </div>
      </div>
      {/* Spreadsheet */}
      <div style={{overflowX:'auto',overflowY:'auto',flex:1}}>
        <table style={{borderCollapse:'collapse',width:'100%',tableLayout:'fixed'}}>
          <colgroup>{COLS.map((c,i)=><col key={i} style={{width:c.w}}/>)}</colgroup>
          <thead>
            <tr>
              {COLS.map((c,i)=><th key={i} style={{...(c.proximoHighlight?thProximo:c.highlight?thHighlight:thBase)}}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length===0&&<tr><td colSpan={14} style={{textAlign:'center',padding:56,color:'#9A8A6A',fontSize:13,fontFamily:"'IBM Plex Mono',monospace",fontStyle:'italic'}}>Sin contactos. Presioná "+ Nuevo Lead" para empezar.</td></tr>}
            {filteredLeads.map((l,idx)=>{
              const estadoVal = derivedEstado(l);
              const estadoClr = pillColors('estado', estadoVal);
              const rowBg = estadoClr.bg + '55';
              const rowHover = estadoClr.bg + '99';
              return <tr key={l.id} style={{background:rowBg,borderBottom:"1px solid #E4DDD0",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=rowHover}
                onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                {/* 1 Estado */}
                <td style={tdHighlight}><PillSelect leadId={l.id} field="estadoActual" value={derivedEstado(l)} options={ESTADO_OPTS} type="estado"/></td>
                {/* 2 Contactado */}
                <td style={tdBase}><PillSelect leadId={l.id} field="contactado" value={l.contactado||"CONTACTADO"} options={CONTACTO_OPTS} type="contactado"/></td>
                {/* 3 Nombre */}
                <td style={{...tdBase}}>
                  {segState(l)==="vencido"&&<div style={{fontSize:9,fontWeight:800,color:"#B42318",letterSpacing:".04em"}}>⚠ SEGUIMIENTO VENCIDO</div>}
                  {segState(l)==="hoy"&&<div style={{fontSize:9,fontWeight:800,color:"#8C5A00",letterSpacing:".04em"}}>● SEGUIR HOY</div>}
                  <div style={{fontSize:11,fontWeight:700,color:"#2C2010",fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.instagram?`@${l.instagram}`:l.nombre}</div>
                  {l.nombre&&l.instagram&&<div style={{fontSize:9,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.nombre}</div>}
                </td>
                {/* 3 Canal */}
                <td style={tdBase}><PillSelect leadId={l.id} field="canal" value={derivedCanal(l)} options={CANAL_OPTS} type="canal"/></td>
                {/* 4 Tipo cliente */}
                <td style={tdBase}><PillSelect leadId={l.id} field="tipoCliente" value={l.tipoCliente||"NUEVO"} options={TIPO_CLI_OPTS} type="tipoCliente"/></td>
                {/* 5 Nacionalidad */}
                <td style={tdBase}><PillSelect leadId={l.id} field="nac" value={derivedNac(l)} options={NAC_OPTS} type="nacionalidad"/></td>
                {/* 6 Fecha */}
                <td style={tdBase}><div style={{fontSize:10,color:"#4A3A20",fontFamily:"'IBM Plex Mono',monospace",whiteSpace:"nowrap"}}>{l.fechaContacto?new Date(l.fechaContacto).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"}):""}</div></td>
                {/* 7 Próximo Contacto — COLUMNA RESALTADA */}
                <td style={tdProximo}><DatePickerCell leadId={l.id} field="proximoContacto" value={l.proximoContacto}/></td>
                {/* 8 Fuente */}
                <td style={tdBase}><FuenteCell leadId={l.id} value={l.fuente}/></td>
                {/* 9 Valor Estimado */}
                <td style={tdBase}><TextCell leadId={l.id} field="valor" value={l.valor?(l.valor+''):""} placeholder="€ 0"/></td>
                {/* 10 Servicio */}
                <td style={tdBase}><ServicioCell leadId={l.id} value={l.servicio}/></td>
                {/* 10 Notas */}
                <td style={tdBase}><TextCell leadId={l.id} field="notas" value={l.notas} placeholder="Notas..."/></td>
                {/* 11 Tipo contacto */}
                <td style={tdBase}><PillSelect leadId={l.id} field="tipoContacto" value={l.tipoContacto||"CALIDO"} options={TIPO_CONTACTO_OPTS} type="tipoContacto"/></td>
                {/* 12 Acciones */}
                <td style={{...tdBase,textAlign:'center',borderRight:'none'}}>
                  <button onClick={e=>window.openWaMenu(e,{nombre:l.nombre||l.instagram,telefono:l.whatsapp,onSent:()=>{ if(segState(l)==="vencido"||segState(l)==="hoy"){ const d=new Date(); d.setDate(d.getDate()+3); updateLead(l.id,"proximoContacto",toLocalISO(d)); } }},["seg24","seg72","seg7d"])} title="WhatsApp" aria-label="Mandar WhatsApp" style={{fontSize:12,background:"none",border:"none",cursor:"pointer",padding:"2px 2px"}}>💬</button>
                  <button onClick={()=>onOpenLead(l)} title="Editar lead completo" style={{fontSize:11,color:"#8A7A60",background:"none",border:"none",cursor:"pointer",padding:"2px 4px",borderRadius:4,transition:'all .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.color='#C9A84C'} onMouseLeave={e=>e.currentTarget.style.color='#8A7A60'}>✏️</button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>;
  }

  // ═══ NETWORKING PIPELINE ═══════════════════════════════════════
  // Pipeline aparte para contactos de la industria (productores, mixers,
  // ingenieros, sellos, mánagers, A&R…). Datos en localStorage "larry:networking".
  function AddNetworkingModal({ onClose, onSave }) {
    const ROL_OPTS = ["PRODUCTOR","MIXER","MASTERING","BEATMAKER","INGENIERO","MÁNAGER","A&R","SELLO","ARTISTA","OTRO"];
    const RELACION_OPTS = ["NUEVO","CONVERSANDO","COLABORANDO","CERCANO","INACTIVO"];
    const [f,setF] = React.useState({
      nombre:"", instagram:"", rol:"PRODUCTOR", contacto:"", ubicacion:"",
      relacion:"NUEVO", contactado:"NO CONTACTADO",
      fechaContacto:todayLocal(), proximoContacto:"", notas:""
    });
    const set=(k,v)=>setF(prev=>({...prev,[k]:v}));
    return <div className="crm-modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="crm-modal-box">
        <CRMModalHeader title="Nuevo Contacto de Networking" onClose={onClose}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
          <CRMField label="Nombre" value={f.nombre} onChange={v=>set("nombre",v)} placeholder="Nombre / alias"/>
          <CRMField label="Instagram / Usuario" value={f.instagram} onChange={v=>set("instagram",v)} placeholder="@handle"/>
          <CRMSelect label="Rol" value={f.rol} onChange={v=>set("rol",v)} options={ROL_OPTS}/>
          <CRMField label="Ubicación" value={f.ubicacion} onChange={v=>set("ubicacion",v)} placeholder="Ciudad / País"/>
          <CRMField label="Correo o Teléfono" value={f.contacto} onChange={v=>set("contacto",v)} placeholder="email o +34..."/>
          <CRMSelect label="Relación" value={f.relacion} onChange={v=>set("relacion",v)} options={RELACION_OPTS}/>
          <CRMField label="Último contacto" value={f.fechaContacto} onChange={v=>set("fechaContacto",v)} type="date"/>
          <CRMField label="Próximo contacto" value={f.proximoContacto} onChange={v=>set("proximoContacto",v)} type="date"/>
        </div>
        <CRMTextarea label="Notas" value={f.notas} onChange={v=>set("notas",v)} placeholder="Cómo lo conociste, colaboraciones, contexto..."/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}>
          <button className="crm-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="crm-btn-gold" onClick={()=>{ if(!(f.nombre||"").trim() && !(f.instagram||"").trim()) return; onSave(f); }}>Guardar Contacto</button>
        </div>
      </div>
    </div>;
  }

  function NetworkingTab({ contacts, saveContacts, onAdd }) {
    const [search, setSearch] = React.useState("");
    const [filterRol, setFilterRol] = React.useState("");
    const [filterRel, setFilterRel] = React.useState("");
    const [editingCell, setEditingCell] = React.useState(null);
    const [editValue, setEditValue] = React.useState("");

    const ROL_OPTS = ["PRODUCTOR","MIXER","MASTERING","BEATMAKER","INGENIERO","MÁNAGER","A&R","SELLO","ARTISTA","OTRO"];
    const RELACION_OPTS = ["NUEVO","CONVERSANDO","COLABORANDO","CERCANO","INACTIVO"];
    const CONTACTADO_OPTS = ["CONTACTADO","NO CONTACTADO"];

    function updateContact(id, field, value) {
      saveContacts(contacts.map(c => c.id===id ? {...c,[field]:value} : c));
    }
    function delContact(id) {
      const prev = contacts;
      saveContacts(contacts.filter(c => c.id!==id));
      showUndo('Contacto eliminado', () => saveContacts(prev));
    }

    function pillColors(type, value) {
      const v = (value||"").toUpperCase();
      const maps = {
        relacion: {
          NUEVO:{bg:'#DCEAFD',color:'#1A3A8C'}, CONVERSANDO:{bg:'#FAD9C0',color:'#8C3A10'},
          COLABORANDO:{bg:'#C8EDD8',color:'#1A6040'}, CERCANO:{bg:'#C8EAD0',color:'#1A5C2A'},
          INACTIVO:{bg:'#E4DDD0',color:'#7A6A50'}
        },
        contactado: { CONTACTADO:{bg:'#C8EAD0',color:'#1A5C2A'}, 'NO CONTACTADO':{bg:'#FAC8C6',color:'#8C1A18'} },
        rol: {
          PRODUCTOR:{bg:'#EDD8FA',color:'#5A2A8C'}, MIXER:{bg:'#C8DCF5',color:'#1A4A8C'},
          MASTERING:{bg:'#BEE3DC',color:'#0D4A40'}, BEATMAKER:{bg:'#FAE0B0',color:'#8C5010'},
          INGENIERO:{bg:'#DDE4F0',color:'#3A5080'}, 'MÁNAGER':{bg:'#FAD9C0',color:'#8C3A10'},
          'A&R':{bg:'#FFF0C0',color:'#7A5A00'}, SELLO:{bg:'#FAC8C6',color:'#8C1A18'},
          ARTISTA:{bg:'#C8EAD0',color:'#1A5C2A'}, OTRO:{bg:'#E4DDD0',color:'#7A6A50'}
        }
      };
      return (maps[type] && maps[type][v]) || {bg:'#E4DDD0', color:'#7A6A50'};
    }

    function PillSelect({id, field, value, options, type}) {
      const {bg, color} = pillColors(type, value);
      return <select value={value||""} onChange={e=>updateContact(id,field,e.target.value)}
        style={{background:bg,color,border:'none',borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,
          fontFamily:"'IBM Plex Mono',monospace",cursor:'pointer',appearance:'none',WebkitAppearance:'none',
          outline:'none',width:'100%',textAlign:'center',letterSpacing:'.02em',boxShadow:'none',overflow:'hidden',textOverflow:'ellipsis'}}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>;
    }

    function TextCell({id, field, value, placeholder, mono}) {
      const isEditing = editingCell && editingCell.id===id && editingCell.field===field;
      if (isEditing) return <input autoFocus value={editValue}
        onChange={e=>setEditValue(e.target.value)}
        onBlur={()=>{ updateContact(id,field,editValue); setEditingCell(null); }}
        onKeyDown={e=>{ if(e.key==='Enter'){updateContact(id,field,editValue);setEditingCell(null);} else if(e.key==='Escape'){setEditingCell(null);} }}
        style={{background:'transparent',border:'none',borderBottom:'1.5px solid #C9A84C',width:'100%',
          fontSize:11,color:'#2C2010',fontFamily:mono?"'IBM Plex Mono',monospace":"'DM Sans',sans-serif",outline:'none',padding:'1px 0'}}/>;
      return <div onClick={()=>{setEditingCell({id,field});setEditValue(value||"");}}
        style={{fontSize:11,color:value?'#2C2010':'#B0A090',cursor:'text',fontFamily:mono?"'IBM Plex Mono',monospace":"'DM Sans',sans-serif",
          fontStyle:value?'normal':'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {value||placeholder}
      </div>;
    }

    function DatePickerCell({id, field, value}) {
      const formatted = value ? new Date(value+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'}) : null;
      const isEditing = editingCell && editingCell.id===id && editingCell.field===field;
      if (isEditing) return <input autoFocus type="date" value={editValue}
        onChange={e=>setEditValue(e.target.value)}
        onBlur={()=>{ updateContact(id,field,editValue); setEditingCell(null); }}
        onKeyDown={e=>{ if(e.key==='Enter'){updateContact(id,field,editValue);setEditingCell(null);} else if(e.key==='Escape'){setEditingCell(null);} }}
        style={{background:'transparent',border:'none',borderBottom:'1.5px solid #C9A84C',width:'100%',
          fontSize:10,color:'#2C2010',fontFamily:"'IBM Plex Mono',monospace",outline:'none',padding:'1px 0'}}/>;
      return <div onClick={()=>{setEditingCell({id,field});setEditValue(value||'');}}
        style={{fontSize:10,color:value?'#2C2010':'#B0A090',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",
          fontStyle:value?'normal':'italic',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
        {value ? `📅 ${formatted}` : '— sin fecha'}
      </div>;
    }

    const REL_ORDER = {CERCANO:0,COLABORANDO:1,CONVERSANDO:2,NUEVO:3,INACTIVO:4};
    const filtered = [...contacts].filter(c => {
      const q = search.trim().toLowerCase();
      const ms = !q ||
        (c.nombre||"").toLowerCase().includes(q) ||
        (c.instagram||"").toLowerCase().includes(q) ||
        (c.rol||"").toLowerCase().includes(q) ||
        (c.ubicacion||"").toLowerCase().includes(q) ||
        (c.notas||"").toLowerCase().includes(q);
      const mr = !filterRol || (c.rol||"").toUpperCase() === filterRol.toUpperCase();
      const mrel = !filterRel || (c.relacion||"").toUpperCase() === filterRel.toUpperCase();
      return ms && mr && mrel;
    }).sort((a,b)=>{
      const oa = REL_ORDER[(a.relacion||"NUEVO").toUpperCase()] ?? 3;
      const ob = REL_ORDER[(b.relacion||"NUEVO").toUpperCase()] ?? 3;
      return oa-ob;
    });

    const COLS = [
      {label:"Relación",w:100,highlight:true},
      {label:"Contactado",w:74},
      {label:"Nombre / Usuario",w:130},
      {label:"Rol",w:100},
      {label:"Ubicación",w:96},
      {label:"Correo o Teléfono",w:130},
      {label:"Última",w:72},
      {label:"Próximo Contacto",w:104,proximoHighlight:true},
      {label:"Notas",w:130},
      {label:"",w:34}
    ];

    const thBase = {padding:"7px 7px",textAlign:"left",fontSize:9,color:"#4A3A28",
      fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".06em",fontWeight:700,
      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
      borderBottom:"2px solid #BDB5A5",borderRight:"1px solid #CFC9B8",
      background:"#DDD7C8",verticalAlign:"middle",lineHeight:1.3};
    const thHighlight = {...thBase,background:"#C8BEA8",color:"#2C2010",borderBottom:"2px solid #A09070",borderRight:"2px solid #A09070"};
    const thProximo = {...thBase,background:"#C9A84C",color:"#2C2010",borderBottom:"2px solid #A08030",borderRight:"2px solid #A08030",textShadow:"0 1px 0 rgba(255,255,255,0.3)"};
    const tdBase = {padding:"6px 7px",borderRight:"1px solid #E4DDD0",verticalAlign:"middle",overflow:"hidden",maxWidth:0};
    const tdHighlight = {...tdBase,borderRight:"2px solid #C8BEA8",background:"rgba(180,160,120,0.08)"};
    const tdProximo = {...tdBase,borderRight:"2px solid #C9A84C",background:"rgba(201,168,76,0.10)"};

    return <div style={{flex:1,overflow:"hidden",display:'flex',flexDirection:'column'}}>
      <div style={{padding:"18px 24px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#EDE8DB",borderBottom:"1px solid #CFC9B8",flexShrink:0}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>Networking</h1>
          <p style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>{contacts.length} contactos · productores, mixers, sellos… · clic en una celda para editar</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{background:"#DDD7C8",border:"1px solid #BDB5A5",borderRadius:4,color:"#2C2010",padding:"8px 12px",fontSize:12,fontFamily:"'IBM Plex Mono',monospace",outline:"none",width:150}}/>
          <select value={filterRol} onChange={e=>setFilterRol(e.target.value)} style={{background:"#DDD7C8",border:"1px solid #BDB5A5",borderRadius:4,color:filterRol?"#2C2010":"#7A6A50",padding:"8px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",cursor:"pointer"}}>
            <option value="">🎚 Rol</option>
            {ROL_OPTS.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterRel} onChange={e=>setFilterRel(e.target.value)} style={{background:"#DDD7C8",border:"1px solid #BDB5A5",borderRadius:4,color:filterRel?"#2C2010":"#7A6A50",padding:"8px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",outline:"none",cursor:"pointer"}}>
            <option value="">🤝 Relación</option>
            {RELACION_OPTS.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          {(search||filterRol||filterRel)&&<button onClick={()=>{setSearch("");setFilterRol("");setFilterRel("");}} style={{background:"transparent",border:"1px solid #BDB5A5",borderRadius:4,color:"#9A8A6A",padding:"7px 10px",fontSize:11,fontFamily:"'IBM Plex Mono',monospace",cursor:"pointer"}} title="Limpiar filtros">✕ Limpiar</button>}
          <button className="crm-btn-gold" onClick={onAdd}>+ Nuevo Contacto</button>
        </div>
      </div>
      <div style={{overflowX:'auto',overflowY:'auto',flex:1}}>
        <table style={{borderCollapse:'collapse',width:'100%',tableLayout:'fixed'}}>
          <colgroup>{COLS.map((c,i)=><col key={i} style={{width:c.w}}/>)}</colgroup>
          <thead>
            <tr>
              {COLS.map((c,i)=><th key={i} style={{...(c.proximoHighlight?thProximo:c.highlight?thHighlight:thBase)}}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={10} style={{textAlign:'center',padding:56,color:'#9A8A6A',fontSize:13,fontFamily:"'IBM Plex Mono',monospace",fontStyle:'italic'}}>Sin contactos de networking. Presioná "+ Nuevo Contacto" para empezar.</td></tr>}
            {filtered.map(c=>{
              const relClr = pillColors('relacion', (c.relacion||'NUEVO'));
              const rowBg = relClr.bg + '55';
              const rowHover = relClr.bg + '99';
              return <tr key={c.id} style={{background:rowBg,borderBottom:"1px solid #E4DDD0",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=rowHover}
                onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                <td style={tdHighlight}><PillSelect id={c.id} field="relacion" value={(c.relacion||'NUEVO').toUpperCase()} options={RELACION_OPTS} type="relacion"/></td>
                <td style={tdBase}><PillSelect id={c.id} field="contactado" value={c.contactado||"NO CONTACTADO"} options={CONTACTADO_OPTS} type="contactado"/></td>
                <td style={tdBase}>
                  <div style={{fontSize:11,fontWeight:700,color:"#2C2010",fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.instagram?`@${c.instagram.replace(/^@/,'')}`:(c.nombre||'—')}</div>
                  {c.nombre&&c.instagram&&<div style={{fontSize:9,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nombre}</div>}
                </td>
                <td style={tdBase}><PillSelect id={c.id} field="rol" value={(c.rol||'OTRO').toUpperCase()} options={ROL_OPTS} type="rol"/></td>
                <td style={tdBase}><TextCell id={c.id} field="ubicacion" value={c.ubicacion} placeholder="Ciudad/País" mono/></td>
                <td style={tdBase}><TextCell id={c.id} field="contacto" value={c.contacto} placeholder="correo / tel." mono/></td>
                <td style={tdBase}><DatePickerCell id={c.id} field="fechaContacto" value={c.fechaContacto}/></td>
                <td style={tdProximo}><DatePickerCell id={c.id} field="proximoContacto" value={c.proximoContacto}/></td>
                <td style={tdBase}><TextCell id={c.id} field="notas" value={c.notas} placeholder="Notas..."/></td>
                <td style={{...tdBase,textAlign:'center',borderRight:'none'}}>
                  <button onClick={()=>delContact(c.id)} title="Eliminar contacto" style={{fontSize:13,color:"#C0392B",opacity:.5,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",transition:'all .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.5}>✕</button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>;
  }

  function MetaLeadsPipeline({ leads, saveLeads }) {
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState("");

    function updateLead(id, field, value) {
      saveLeads(leads.map(l => l.id===id ? {...l,[field]:value} : l));
    }
    function delLead(id) {
      const prev = leads;
      saveLeads(leads.filter(l => l.id!==id));
      showUndo('Lead de Meta eliminado', () => saveLeads(prev));
    }

    function pillColors(type, value) {
      const maps = {
        demoMusica: {
          "Tiene demo":{bg:'#C8EAD0',color:'#1A5C2A'}, "Saca música":{bg:'#C8DCF5',color:'#1A4A8C'},
          "No":{bg:'#E4DDD0',color:'#7A6A50'}
        },
        objetivo: {
          "Pegarse en la música":{bg:'#FFF0C0',color:'#7A5A00'}, "Sonar profesional":{bg:'#DCEAFD',color:'#1A3A8C'},
          "Tener productor fijo":{bg:'#EDD8FA',color:'#5A2A8C'}
        },
        estado: {
          "Nuevo":{bg:'#DCEAFD',color:'#1A3A8C'}, "Contactado":{bg:'#FAD9C0',color:'#8C3A10'},
          "En conversación":{bg:'#FFF0C0',color:'#7A5A00'}, "Convertido":{bg:'#C8EAD0',color:'#1A5C2A'},
          "Descartado":{bg:'#FAC8C6',color:'#8C1A18'}
        }
      };
      return (maps[type] && maps[type][value]) || {bg:'#E4DDD0', color:'#7A6A50'};
    }

    function PillSelect({id, field, value, options, type}) {
      const {bg, color} = pillColors(type, value);
      return <select value={value||options[0]} onChange={e=>updateLead(id,field,e.target.value)}
        style={{background:bg,color,border:'none',borderRadius:20,padding:'2px 6px',fontSize:10,fontWeight:700,
          fontFamily:"'IBM Plex Mono',monospace",cursor:'pointer',appearance:'none',WebkitAppearance:'none',
          outline:'none',width:'100%',textAlign:'center',letterSpacing:'.02em',boxShadow:'none',overflow:'hidden',textOverflow:'ellipsis'}}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>;
    }

    function TextCell({id, field, value, placeholder, mono}) {
      const isEditing = editingCell && editingCell.id===id && editingCell.field===field;
      if (isEditing) return <input autoFocus value={editValue}
        onChange={e=>setEditValue(e.target.value)}
        onBlur={()=>{ updateLead(id,field,editValue); setEditingCell(null); }}
        onKeyDown={e=>{ if(e.key==='Enter'){updateLead(id,field,editValue);setEditingCell(null);} else if(e.key==='Escape'){setEditingCell(null);} }}
        style={{background:'transparent',border:'none',borderBottom:'1.5px solid #C9A84C',width:'100%',
          fontSize:11,color:'#2C2010',fontFamily:mono?"'IBM Plex Mono',monospace":"'DM Sans',sans-serif",outline:'none',padding:'1px 0'}}/>;
      return <div onClick={()=>{setEditingCell({id,field});setEditValue(value||"");}}
        style={{fontSize:11,color:value?'#2C2010':'#B0A090',cursor:'text',fontFamily:mono?"'IBM Plex Mono',monospace":"'DM Sans',sans-serif",
          fontStyle:value?'normal':'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {value||placeholder}
      </div>;
    }

    function DatePickerCell({id, field, value}) {
      const formatted = value ? new Date(value+'T00:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'}) : null;
      const isEditing = editingCell && editingCell.id===id && editingCell.field===field;
      if (isEditing) return <input autoFocus type="date" value={editValue}
        onChange={e=>setEditValue(e.target.value)}
        onBlur={()=>{ updateLead(id,field,editValue); setEditingCell(null); }}
        onKeyDown={e=>{ if(e.key==='Enter'){updateLead(id,field,editValue);setEditingCell(null);} else if(e.key==='Escape'){setEditingCell(null);} }}
        style={{background:'transparent',border:'none',borderBottom:'1.5px solid #C9A84C',width:'100%',
          fontSize:10,color:'#2C2010',fontFamily:"'IBM Plex Mono',monospace",outline:'none',padding:'1px 0'}}/>;
      return <div onClick={()=>{setEditingCell({id,field});setEditValue(value||'');}}
        style={{fontSize:10,color:value?'#2C2010':'#B0A090',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",
          fontStyle:value?'normal':'italic',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
        {value ? `📅 ${formatted}` : '— sin fecha'}
      </div>;
    }

    const groups = {};
    leads.forEach(l=>{
      const d = l.fecha ? new Date(l.fecha+'T00:00:00') : null;
      const key = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : 'sin-fecha';
      (groups[key] = groups[key]||[]).push(l);
    });
    const monthKeys = Object.keys(groups).sort((a,b)=> b.localeCompare(a));
    const monthLabel = (key) => {
      if (key==='sin-fecha') return 'Sin fecha';
      const [y,m] = key.split('-');
      const label = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
      return label.charAt(0).toUpperCase()+label.slice(1);
    };

    const COLS = [
      {label:"Nombre",w:140},
      {label:"Teléfono",w:110},
      {label:"Instagram",w:110},
      {label:"Demo / Música",w:110},
      {label:"Objetivo",w:160},
      {label:"Fecha",w:80},
      {label:"Estado",w:130},
      {label:"",w:30}
    ];
    const thBase = {padding:"7px 7px",textAlign:"left",fontSize:9,color:"#4A3A28",
      fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".06em",fontWeight:700,
      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
      borderBottom:"2px solid #BDB5A5",borderRight:"1px solid #CFC9B8",
      background:"#DDD7C8",verticalAlign:"middle",lineHeight:1.3};
    const tdBase = {padding:"6px 7px",borderRight:"1px solid #E4DDD0",verticalAlign:"middle",overflow:"hidden",maxWidth:0};

    return <div className="crm-panel" style={{marginTop:24}}>
      <span className="crm-section-label">PIPELINE DE LEADS · META ADS</span>
      {!leads.length&&<div style={{color:"#8A7A60",fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>Sin leads registrados todavía. Presioná "+ Nuevo Lead" para empezar.</div>}
      {monthKeys.map(mk=>{
        const rows = groups[mk].slice().sort((a,b)=> new Date(b.fecha||0)-new Date(a.fecha||0));
        return <div key={mk} style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:800,color:"#C9A84C",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".1em",margin:"14px 0 8px",textTransform:"uppercase"}}>{monthLabel(mk)} · {rows.length} lead{rows.length!==1?"s":""}</div>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',width:'100%',tableLayout:'fixed'}}>
              <colgroup>{COLS.map((c,i)=><col key={i} style={{width:c.w}}/>)}</colgroup>
              <thead><tr>{COLS.map((c,i)=><th key={i} style={thBase}>{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.map(l=><tr key={l.id} style={{borderBottom:"1px solid #E4DDD0"}}>
                  <td style={tdBase}><TextCell id={l.id} field="nombre" value={l.nombre} placeholder="Nombre..."/></td>
                  <td style={tdBase}><TextCell id={l.id} field="telefono" value={l.telefono} placeholder="Teléfono..." mono/></td>
                  <td style={tdBase}><TextCell id={l.id} field="instagram" value={l.instagram} placeholder="@handle" mono/></td>
                  <td style={tdBase}><PillSelect id={l.id} field="demoMusica" value={l.demoMusica||META_DEMO_OPTS[0]} options={META_DEMO_OPTS} type="demoMusica"/></td>
                  <td style={tdBase}><PillSelect id={l.id} field="objetivo" value={l.objetivo||META_OBJETIVO_OPTS[0]} options={META_OBJETIVO_OPTS} type="objetivo"/></td>
                  <td style={tdBase}><DatePickerCell id={l.id} field="fecha" value={l.fecha}/></td>
                  <td style={tdBase}><PillSelect id={l.id} field="estado" value={l.estado||META_ESTADO_OPTS[0]} options={META_ESTADO_OPTS} type="estado"/></td>
                  <td style={{...tdBase,textAlign:'center',borderRight:'none'}}>
                    <button onClick={()=>delLead(l.id)} title="Eliminar lead" style={{fontSize:13,color:"#C0392B",opacity:.5,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",transition:'all .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.5}>✕</button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>;
      })}
    </div>;
  }

  function MetaTab({ meta, saveMeta, onAdd, metaLeads, saveMetaLeads, onAddLead }) {
    const totalGasto=meta.reduce((s,w)=>s+(parseFloat(w.gastado)||0),0);
    const totalConvs=meta.reduce((s,w)=>s+(parseInt(w.conversaciones)||0),0);
    const costoConv=totalConvs>0?(totalGasto/totalConvs).toFixed(2):null;
    return <div style={{flex:1,overflow:"auto",padding:"28px 32px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>Meta Ads</h1><p style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:3}}>Seguimiento de campañas y pipeline de leads</p></div>
        <div style={{display:"flex",gap:10}}>
          <button className="crm-btn-gold" onClick={onAddLead}>+ Nuevo Lead</button>
          <button className="crm-btn-ghost" onClick={onAdd}>+ Registrar Datos</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
        {[{label:"Gasto Total",value:"€"+totalGasto.toFixed(2),color:"#F0B429"},{label:"Conversaciones",value:totalConvs,color:"#58A6FF"},{label:"Costo / Conv.",value:costoConv?"€"+costoConv:"—",color:"#3FB950"}].map((k,i)=>
          <div key={i} className="crm-kpi"><div className="crm-section-label">{k.label.toUpperCase()}</div><div style={{fontSize:28,fontWeight:800,color:k.color,fontFamily:"'Syne',sans-serif"}}>{k.value}</div></div>
        )}
      </div>
      <div className="crm-panel">
        <span className="crm-section-label">HISTORIAL DE CAMPAÑAS</span>
        {!meta.length&&<div style={{color:"#8A7A60",fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>Sin datos registrados.</div>}
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          {meta.length>0&&<thead><tr style={{borderBottom:"1px solid #1A1814"}}>
            {["Período","Guión","Gastado","Convs","Alcance","C/Conv",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"0 10px 10px",fontSize:10,color:"#8A7A60",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".15em"}}>{h.toUpperCase()}</th>)}
          </tr></thead>}
          <tbody>
            {[...meta].reverse().map(w=><tr key={w.id} style={{borderTop:"1px solid #1A1814"}}>
              <td style={{padding:"9px 10px",fontSize:11,color:"#6A5A40",fontFamily:"'IBM Plex Mono',monospace"}}>{w.periodo||"—"}</td>
              <td style={{padding:"9px 10px",fontSize:11,color:"#F0B429",fontFamily:"'IBM Plex Mono',monospace"}}>{w.guion}</td>
              <td style={{padding:"9px 10px",fontSize:11,color:"#F0B429",fontFamily:"'IBM Plex Mono',monospace"}}>€{w.gastado}</td>
              <td style={{padding:"9px 10px",fontSize:11,color:"#58A6FF",fontFamily:"'IBM Plex Mono',monospace"}}>{w.conversaciones}</td>
              <td style={{padding:"9px 10px",fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace"}}>{w.alcance?parseInt(w.alcance).toLocaleString("es-ES"):"—"}</td>
              <td style={{padding:"9px 10px",fontSize:11,color:"#3FB950",fontFamily:"'IBM Plex Mono',monospace"}}>{w.conversaciones>0?"€"+(parseFloat(w.gastado)/parseInt(w.conversaciones)).toFixed(2):"—"}</td>
              <td style={{padding:"9px 10px",textAlign:"right"}}>
                <button onClick={()=>{const prev=meta;saveMeta(meta.filter(m=>m.id!==w.id));showUndo('Fila de Meta Ads eliminada',()=>saveMeta(prev));}} style={{fontSize:13,color:"#F85149",opacity:.4,transition:"opacity .15s",border:"none",background:"none",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.4}>×</button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <MetaLeadsPipeline leads={metaLeads} saveLeads={saveMetaLeads}/>
    </div>;
  }

  function FinanzasCRMTab({ leads, cerrados, ingresosCerrados, pipelinePotencial, tasaCierre, totalGasto }) {
    // v2: el ROI de Meta usa SOLO las ventas que vinieron de Meta Ads
    const ingresosMeta = cerrados.filter(l=>(l.fuente||"").toLowerCase()==="meta ads").reduce((s,l)=>s+(Number(l.valor)||0),0);
    const roi=totalGasto>0?((ingresosMeta/totalGasto)*100).toFixed(0):null;
    const proyeccion=pipelinePotencial*(tasaCierre/100);
    const total=ingresosCerrados+proyeccion;
    const svcMap={};
    cerrados.forEach(l=>{const s=l.servicio||"Sin categoría";svcMap[s]=(svcMap[s]||0)+(Number(l.valor)||0);});
    const svcList=Object.entries(svcMap).sort((a,b)=>b[1]-a[1]);
    return <div style={{flex:1,overflow:"auto",padding:"28px 32px"}}>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:800,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>Finanzas CRM</h1><p style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:3}}>Balance de ingresos y proyección</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div className="crm-kpi" style={{borderTop:"2px solid #C9A84C88",padding:28}}><div className="crm-section-label">INGRESOS CONFIRMADOS</div><div style={{fontSize:36,fontWeight:800,color:"#C9A84C",lineHeight:1,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>{fmtC(ingresosCerrados)}</div><div style={{fontSize:12,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace"}}>{cerrados.length} cliente{cerrados.length!==1?"s":""} cerrado{cerrados.length!==1?"s":""}</div></div>
        <div className="crm-kpi" style={{borderTop:"2px solid #58A6FF66",padding:28}}><div className="crm-section-label">PROYECCIÓN TOTAL</div><div style={{fontSize:36,fontWeight:800,color:"#58A6FF",lineHeight:1,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>{fmtC(total)}</div><div style={{fontSize:12,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace"}}>Cerrado + {fmtC(proyeccion)} proyectado ({tasaCierre}% cierre)</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[{label:"Gasto Meta",value:"€"+totalGasto.toFixed(0),color:"#F0B429"},{label:"ROI Meta",value:roi?roi+"%":"—",color:"#3FB950"},{label:"Tasa de Cierre",value:tasaCierre+"%",color:"#3FB950"}].map((k,i)=>
          <div key={i} className="crm-kpi"><div className="crm-section-label">{k.label.toUpperCase()}</div><div style={{fontSize:26,fontWeight:800,color:k.color,fontFamily:"'Syne',sans-serif"}}>{k.value}</div></div>
        )}
      </div>
      <div className="crm-panel">
        <span className="crm-section-label">INGRESOS POR SERVICIO</span>
        {!svcList.length&&<div style={{color:"#8A7A60",fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>Sin datos.</div>}
        {svcList.map(([s,v])=>{const pct=ingresosCerrados>0?(v/ingresosCerrados)*100:0; return <div key={s} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"#6A5A40",fontFamily:"'IBM Plex Mono',monospace"}}>{s}</span><span style={{fontSize:11,color:"#C9A84C",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtC(v)}</span></div>
          <div style={{background:"#DDD7C8",borderRadius:2,height:4}}><div style={{width:pct+"%",height:"100%",background:"#C9A84C",borderRadius:2,transition:"width .5s"}}/></div>
        </div>;})}
        {cerrados.length>0&&<><div style={{height:16}}/><span className="crm-section-label">CLIENTES CERRADOS</span>
          {cerrados.map(l=><div key={l.id} className="crm-row-item">
            <div><div style={{fontSize:13,fontWeight:700,color:"#2C2010",fontFamily:"'Syne',sans-serif"}}>{l.instagram?`@${l.instagram}`:l.nombre}</div>
            <div style={{fontSize:11,color:"#7A6A50",fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>{l.servicio} · {fmtDateC(l.fecha)}</div></div>
            <div style={{fontSize:18,fontWeight:800,color:"#C9A84C",fontFamily:"'IBM Plex Mono',monospace"}}>{fmtC(l.valor)}</div>
          </div>)}
        </>}
      </div>
    </div>;
  }

  function LarryOSCRM() {
    const [tab,setTabRaw]=useState(()=>{ try{ return localStorage.getItem("larryOS_crmTab")||"pipeline"; }catch(e){ return "pipeline"; } });
    const setTab=t=>{ setTabRaw(t); try{ localStorage.setItem("larryOS_crmTab",t); }catch(e){} };
    const [leads,setLeads]=useState([]);
    const [meta,setMeta]=useState([]);
    const [metaLeads,setMetaLeads]=useState([]);
    const [networking,setNetworking]=useState([]);
    const [ready,setReady]=useState(false);
    const [modal,setModal]=useState(null);
    const [editTarget,setEditTarget]=useState(null);
    const [crmYear,setCrmYearState]=useState(window.crmYearFilter||new Date().getFullYear());

    useEffect(()=>{
      const l=sget("larry:leads"), m=sget("larry:meta"), ml=sget("larry:metaLeads"), n=sget("larry:networking");
      if(l) setLeads(l); if(m) setMeta(m); if(ml) setMetaLeads(ml); if(n) setNetworking(n); setReady(true);
      // 🔗 BRIDGE: exponer función de refresh de año al sistema global
      window.crmForceRefresh = () => {
        setCrmYearState(window.crmYearFilter||new Date().getFullYear());
        const l2=sget("larry:leads"), m2=sget("larry:meta"), ml2=sget("larry:metaLeads"), n2=sget("larry:networking");
        if(l2) setLeads(l2); if(m2) setMeta(m2); if(ml2) setMetaLeads(ml2); if(n2) setNetworking(n2);
      };
      window.crmGoTab = t => setTab(t);
      window.crmNewLead = () => { setTab('pipeline'); setModal('addLead'); };
      window.crmOpenLead = id => { const all = sget("larry:leads")||[]; const l = all.find(x=>String(x.id)===String(id)); if (l) { setTab("pipeline"); setEditTarget(l); setModal("editLead"); } };
      return () => { window.crmForceRefresh = null; };
    },[]);

    const saveLeads=(v)=>{
      // Detect leads that just became "cerrado" and auto-create client
      const prev = leads;
      setLeads(v);sset("larry:leads",v);
    };
    const saveMeta=(v)=>{setMeta(v);sset("larry:meta",v);};
    const saveMetaLeads=(v)=>{setMetaLeads(v);sset("larry:metaLeads",v);};
    const saveNetworking=(v)=>{setNetworking(v);sset("larry:networking",v);};
    // v2: las métricas respetan el AÑO elegido en la barra lateral
    const yearOf = d => { const y = parseInt(String(d||"").slice(0,4),10); return isNaN(y) ? null : y; };
    const leadsY = leads.filter(l => { const y = yearOf(l.fechaContacto||l.fecha); return y === null || y === crmYear; });
    const metaY = meta.filter(w => { const y = yearOf(w.fechaInicio||w.fechaFin); return y === null || y === crmYear; });
    const cerrados=leadsY.filter(l=>l.etapa==="cerrado");
    const perdidos=leadsY.filter(l=>l.etapa==="perdido");
    const activos=leads.filter(l=>!["cerrado","perdido"].includes(l.etapa));
    const tasaCierre=leadsY.length>0?Math.round((cerrados.length/leadsY.length)*100):0;
    const ingresosCerrados=cerrados.reduce((s,l)=>s+(Number(l.valor)||0),0);
    const pipelinePotencial=activos.reduce((s,l)=>s+(Number(l.valor)||0),0);
    const totalGasto=metaY.reduce((s,w)=>s+(parseFloat(w.gastado)||0),0);
    const totalConvs=metaY.reduce((s,w)=>s+(parseInt(w.conversaciones)||0),0);
    const costoConv=totalConvs>0?(totalGasto/totalConvs).toFixed(2):null;
    const openLead=(l)=>{setEditTarget(l);setModal("editLead");};

    if(!ready) return <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#C9A84C",fontFamily:"monospace",fontSize:13}}>Cargando CRM...</div>;

    const tabs=[{id:"resumen",label:"Resumen & Finanzas",icon:"◈"},{id:"pipeline",label:"Pipeline",icon:"⬡"},{id:"networking",label:"Networking",icon:"⬢"},{id:"meta",label:"Meta Ads",icon:"◉"}];

    return <>
      <style>{CRM_CSS}</style>
      <div className="crm-wrap" style={{display:"flex",flexDirection:"column",height:"100%",fontFamily:"'Syne',sans-serif",overflow:"hidden",background:"#F5F0E4"}}>
        <div style={{background:"#EDE8DB",borderBottom:"1px solid #1A1814",display:"flex",alignItems:"center",flexShrink:0}}>
          <div style={{padding:"0 20px",borderRight:"1px solid #1A1814",marginRight:4,flexShrink:0}}>
            <div style={{fontSize:9,color:"#9A8A6A",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".2em",lineHeight:"42px"}}>CRM</div>
          </div>
          <nav style={{display:"flex",flex:1}}>
            {tabs.map(item=><button key={item.id} onClick={()=>setTab(item.id)} className={`crm-nav-btn${tab===item.id?" active":""}`}>
              <span style={{fontSize:14,opacity:tab===item.id?1:.4}}>{item.icon}</span>{item.label}
            </button>)}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:16,padding:"0 20px",borderLeft:"1px solid #1A1814"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:8,color:"#9A8A6A",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".15em"}}>AÑO</div>
              <div style={{fontSize:15,fontWeight:800,color:"#C9A84C",lineHeight:1,fontFamily:"'Syne',sans-serif"}}>{crmYear}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:8,color:"#9A8A6A",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:".15em"}}>LEADS</div>
              <div style={{fontSize:15,fontWeight:800,color:"#C9A84C",lineHeight:1,fontFamily:"'Syne',sans-serif"}}>{leadsY.length}</div>
              <div style={{fontSize:8,color:"#9A8A6A",fontFamily:"'IBM Plex Mono',monospace"}}>{cerrados.length} cerrados</div>
            </div>
          </div>
        </div>
        <main style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {tab==="resumen"&&<ResumenTab year={crmYear} meta={metaY} leads={leadsY} cerrados={cerrados} activos={activos} tasaCierre={tasaCierre} ingresosCerrados={ingresosCerrados} pipelinePotencial={pipelinePotencial} totalGasto={totalGasto} totalConvs={totalConvs} costoConv={costoConv}/>}
          {tab==="pipeline"&&<PipelineTab leads={leads} saveLeads={saveLeads} onOpenLead={openLead} onAdd={()=>setModal("addLead")}/>}
          {tab==="networking"&&<NetworkingTab contacts={networking} saveContacts={saveNetworking} onAdd={()=>setModal("addContact")}/>}
          {tab==="meta"&&<MetaTab meta={meta} saveMeta={saveMeta} onAdd={()=>setModal("addMeta")} metaLeads={metaLeads} saveMetaLeads={saveMetaLeads} onAddLead={()=>setModal("addMetaLead")}/>}
        </main>
      </div>
      {modal==="addLead"&&<AddLeadModal onClose={()=>setModal(null)} onSave={lead=>{saveLeads([...leads,{...lead,id:Date.now(),fecha:new Date().toISOString()}]);setModal(null);}}/>}
      {modal==="editLead"&&<EditLeadModal lead={editTarget} onClose={()=>{setModal(null);setEditTarget(null);}} onSave={u=>{saveLeads(leads.map(l=>l.id===u.id?u:l));setModal(null);setEditTarget(null);}} onDelete={id=>{const prev=leads;saveLeads(leads.filter(l=>l.id!==id));setModal(null);setEditTarget(null);showUndo('Lead eliminado',()=>saveLeads(prev));}}/>}
      {modal==="addMeta"&&<AddMetaModal onClose={()=>setModal(null)} onSave={w=>{saveMeta([...meta,{...w,id:Date.now()}]);setModal(null);}}/>}
      {modal==="addMetaLead"&&<AddMetaLeadModal onClose={()=>setModal(null)} onSave={lead=>{saveMetaLeads([...metaLeads,{...lead,id:Date.now()}]);setModal(null);}}/>}
      {modal==="addContact"&&<AddNetworkingModal onClose={()=>setModal(null)} onSave={ct=>{saveNetworking([...networking,{...ct,id:Date.now()}]);setModal(null);}}/>}
    </>;
  }

  const crmRoot = ReactDOM.createRoot(document.getElementById("crm-root"));
  crmRoot.render(<LarryOSCRM/>);
