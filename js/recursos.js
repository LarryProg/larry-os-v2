    function switchRecursosTab(tab) {
      document.querySelectorAll('#module-recursos .rec-tab').forEach(t => t.classList.toggle('active', t.dataset.recTab === tab));
      document.querySelectorAll('#module-recursos [id^="rec-tab-"]').forEach(p => { p.style.display = (p.id === 'rec-tab-' + tab) ? '' : 'none'; });
    }

    // ── Mis Enlaces (custom links, localStorage: larry:recursosLinks) ──
    const REC_LINKS_KEY = 'larry:recursosLinks';
    function recEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function recLoadLinks(){ try { return JSON.parse(localStorage.getItem(REC_LINKS_KEY) || '[]'); } catch(e){ return []; } }
    function recSaveLinks(arr){ localStorage.setItem(REC_LINKS_KEY, JSON.stringify(arr)); }
    function recDomain(url){ try { return new URL(url).hostname; } catch(e){ return ''; } }

    function recRenderCustom(){
      const grid = document.getElementById('rec-custom-grid');
      if (!grid) return;
      // los links que ya tienen tarjeta fija en alguna categoría no se repiten en «Mis Enlaces»
      const fijos = new Set([...document.querySelectorAll('#module-recursos a.rec-card')].map(a => a.href.replace(/\/+$/, '')));
      const links = recLoadLinks().filter(l => !fijos.has(String(l.url || '').replace(/\/+$/, '')));
      const empty = document.getElementById('rec-custom-empty');
      if (empty) empty.style.display = links.length ? 'none' : '';
      grid.innerHTML = links.map(l => {
        const dom = recDomain(l.url);
        const fav = dom ? `https://www.google.com/s2/favicons?domain=${dom}&sz=128` : '';
        const badge = fav ? `<img src="${fav}" alt="">` : '🔗';
        const desc = recEsc(l.desc || dom || '');
        return `<div class="rec-card rec-card-custom">
          <div class="rec-accent" style="background:#C9A84C;"></div>
          <button class="rec-card-del" title="Eliminar" onclick="recDeleteLink('${l.id}')">×</button>
          <a href="${/^https?:\/\//i.test(l.url||"")?recEsc(l.url):"#"}" target="_blank" rel="noopener noreferrer" class="rec-card-link">
            <div class="rec-head">
              <div class="rec-badge">${badge}</div>
              <div>
                <div class="rec-name">${recEsc(l.name)}</div>
                <div class="rec-tag">Personalizado</div>
              </div>
            </div>
            <div class="rec-desc">${desc}</div>
            <div class="rec-cta">Abrir <span class="rec-arrow">→</span></div>
          </a>
        </div>`;
      }).join('');
    }

    function recAddLinkOpen(){
      document.getElementById('rec-link-name').value = '';
      document.getElementById('rec-link-url').value = '';
      document.getElementById('rec-link-desc').value = '';
      document.getElementById('rec-link-modal').style.display = 'flex';
      setTimeout(() => document.getElementById('rec-link-name').focus(), 50);
    }
    function recAddLinkClose(){ document.getElementById('rec-link-modal').style.display = 'none'; }
    function recAddLinkSave(){
      const name = document.getElementById('rec-link-name').value.trim();
      let url = document.getElementById('rec-link-url').value.trim();
      const desc = document.getElementById('rec-link-desc').value.trim();
      if (!name || !url){ alert('Completá nombre y URL.'); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const links = recLoadLinks();
      links.push({ id: 'rl' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), name, url, desc });
      recSaveLinks(links);
      recRenderCustom();
      recAddLinkClose();
    }
    function recDeleteLink(id){
      if (!confirm('¿Eliminar este enlace?')) return;
      recSaveLinks(recLoadLinks().filter(l => l.id !== id));
      recRenderCustom();
    }

    // Cerrar modal al clickear el fondo
    document.getElementById('rec-link-modal').addEventListener('click', function(e){
      if (e.target === this) recAddLinkClose();
    });
    document.addEventListener('DOMContentLoaded', recRenderCustom);
    recRenderCustom();
