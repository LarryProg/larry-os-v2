(function () {
  const STORAGE_KEY = 'notas_rapidas_v1';
  const board  = document.getElementById('module-tareas');
  const canvas = document.getElementById('notas-canvas');
  let notes = [];
  let selectedColor = '#fff9a3';
  let selectedDark  = '#e8d800';
  let zCounter = 100;
  let idCounter = 0;

  /* ── PAN STATE ─────────────────────────────────── */
  let panX = 0, panY = 0;
  let isPanning = false, panSX = 0, panSY = 0;
  let panSaveTimer = null;

  function applyPan() {
    canvas.style.transform = `translate(${panX}px,${panY}px)`;
  }
  function savePan() {
    clearTimeout(panSaveTimer);
    panSaveTimer = setTimeout(() => save(), 300);
  }

  /* ── COLOR PICKER ──────────────────────────────── */
  board.querySelectorAll('.notas-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      board.querySelectorAll('.notas-color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      selectedColor = dot.dataset.color;
      selectedDark  = dot.dataset.dark;
    });
  });

  /* ── PERSISTENCE ───────────────────────────────── */
  function save() {
    const data = {
      pan: { x: panX, y: panY },
      notes: notes.map(n => ({
        id: n.id, color: n.color, dark: n.dark,
        html: n.el.querySelector('.notas-text').innerHTML,
        text: n.el.querySelector('.notas-text').innerText,
        date: n.el.querySelector('.notas-date-input')?.value || '',
        x: parseFloat(n.el.style.left),
        y: parseFloat(n.el.style.top),
        rot: n.rot,
        z: parseInt(n.el.style.zIndex) || 100
      }))
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Backward compat: old format was a plain array
      const noteData = Array.isArray(parsed) ? parsed : (parsed.notes || []);
      const pan      = Array.isArray(parsed) ? { x: 0, y: 0 } : (parsed.pan || { x: 0, y: 0 });
      panX = pan.x; panY = pan.y;
      applyPan();
      noteData.forEach(n => createNote({
        color: n.color, dark: n.dark,
        html: n.html, text: n.text, date: n.date,
        x: n.x, y: n.y, rot: n.rot, z: n.z, focus: false
      }));
    } catch(e) {}
  }

  /* ── CREATE NOTE ───────────────────────────────── */
  function createNote(opts = {}) {
    const id    = ++idCounter;
    const color = opts.color || selectedColor;
    const dark  = opts.dark  || selectedDark;
    const rot   = opts.rot  !== undefined ? opts.rot : (Math.random() - 0.5) * 4;
    const z     = opts.z    || ++zCounter;
    const vw = board.offsetWidth, vh = board.offsetHeight;
    const x = opts.x !== undefined ? opts.x : Math.round(-panX + vw/2 - 110 + (Math.random()-0.5)*120);
    const y = opts.y !== undefined ? opts.y : Math.round(-panY + vh/2 - 90  + (Math.random()-0.5)*80);

    const el = document.createElement('div');
    el.className = 'notas-note';
    el.style.cssText = `left:${x}px;top:${y}px;z-index:${z};background:${color};transform:rotate(${rot}deg);--r:${rot}deg;`;

    const isoDate = opts.date || todayLocal();

    el.innerHTML = `
      <div class="notas-tape"></div>
      <div class="notas-header" style="background:${dark}">
        <input class="notas-date-input" type="date" value="${isoDate}" title="Cambiar fecha">
        <button class="notas-del" title="Eliminar nota">&#x2715;</button>
      </div>
      <div class="notas-fmt-bar">
        <button class="notas-fmt-btn" data-cmd="bold" title="Negrita"><b>B</b></button>
        <button class="notas-fmt-btn" data-cmd="italic" title="Cursiva"><i>I</i></button>
        <button class="notas-fmt-btn" data-cmd="underline" title="Subrayado"><u>U</u></button>
        <button class="notas-fmt-btn" data-cmd="strikeThrough" title="Tachado"><s>S</s></button>
      </div>
      <div class="notas-body">
        <div class="notas-text" contenteditable="true" data-placeholder="Escribí algo\u2026"></div>
      </div>
    `;

    const ta = el.querySelector('.notas-text');
    if (opts.html) { ta.innerHTML = opts.html; }
    else if (opts.text) { ta.textContent = opts.text; }

    el.querySelectorAll('.notas-fmt-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault(); ta.focus();
        document.execCommand(btn.dataset.cmd, false, null); save();
      });
    });

    const dateInput = el.querySelector('.notas-date-input');
    dateInput.addEventListener('change', () => save());
    dateInput.addEventListener('mousedown', e => e.stopPropagation());

    el.querySelector('.notas-header').addEventListener('mousedown', e => {
      if (e.target.closest('.notas-del') || e.target.closest('.notas-date-input')) return;
      startDragNote(e, el);
    });
    el.querySelector('.notas-header').addEventListener('touchstart', e => {
      if (e.target.closest('.notas-del') || e.target.closest('.notas-date-input')) return;
      startDragNote(e, el);
    }, { passive: false });

    el.querySelector('.notas-del').addEventListener('click', e => {
      e.stopPropagation(); removeNote(id, el);
    });

    ta.addEventListener('mousedown', e => e.stopPropagation());
    ta.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    ta.addEventListener('input', () => save());
    ta.addEventListener('keydown', e => e.stopPropagation());

    el.addEventListener('mousedown', () => bringFront(el));
    el.addEventListener('touchstart', () => bringFront(el), { passive: true });

    canvas.appendChild(el);
    notes.push({ id, el, color, dark, rot });
    updateHint(); save();
    if (opts.focus !== false) setTimeout(() => ta.focus(), 80);
  }

  function removeNote(id, el) {
    // v2: si la nota tiene texto, confirmar antes de borrarla
    const ta = el.querySelector('textarea');
    if (ta && ta.value.trim() && !el._confirmed && typeof customConfirm === 'function') {
      customConfirm('¿Borrar esta nota?\n\n"' + ta.value.trim().slice(0, 80) + '"', () => { el._confirmed = true; removeNote(id, el); }, 'Borrar');
      return;
    }
    el.style.transition = 'opacity 0.18s, transform 0.18s';
    el.style.opacity = '0'; el.style.transform += ' scale(0.82)';
    setTimeout(() => {
      el.remove(); notes = notes.filter(n => n.id !== id);
      updateHint(); save();
    }, 200);
  }

  function bringFront(el) { el.style.zIndex = ++zCounter; }

  /* ── DRAG NOTE ─────────────────────────────────── */
  function startDragNote(e, el) {
    e.preventDefault();
    bringFront(el);
    el.classList.add('dragging');
    const getXY = ev => ({ x: ev.touches?.[0]?.clientX ?? ev.clientX, y: ev.touches?.[0]?.clientY ?? ev.clientY });
    const cr = canvas.getBoundingClientRect();
    const { x: sx, y: sy } = getXY(e);
    const ox = sx - cr.left - (parseFloat(el.style.left) || 0);
    const oy = sy - cr.top  - (parseFloat(el.style.top)  || 0);

    const onMove = ev => {
      if (ev.cancelable) ev.preventDefault();
      const { x, y } = getXY(ev);
      const r = canvas.getBoundingClientRect();
      el.style.left = (x - r.left - ox) + 'px';
      el.style.top  = (y - r.top  - oy) + 'px';
    };
    const onUp = () => {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onUp);
      save();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onUp);
  }

  /* ── PAN CANVAS (click+drag empty space) ───────── */
  board.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.notas-note') || e.target.closest('#notas-toolbar') || e.target.closest('#notas-modal-overlay')) return;
    isPanning = true;
    panSX = e.clientX - panX; panSY = e.clientY - panY;
    board.classList.add('panning');
  });
  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    panX = e.clientX - panSX; panY = e.clientY - panSY;
    applyPan();
  });
  document.addEventListener('mouseup', () => {
    if (!isPanning) return;
    isPanning = false; board.classList.remove('panning'); savePan();
  });

  // Touch pan
  let touchPanId = null, tpSX = 0, tpSY = 0;
  board.addEventListener('touchstart', e => {
    if (e.target.closest('.notas-note') || e.target.closest('#notas-toolbar')) return;
    const t = e.touches[0]; touchPanId = t.identifier;
    tpSX = t.clientX - panX; tpSY = t.clientY - panY;
  }, { passive: true });
  board.addEventListener('touchmove', e => {
    if (touchPanId === null) return;
    const t = [...e.touches].find(x => x.identifier === touchPanId); if (!t) return;
    if (e.cancelable) e.preventDefault();
    panX = t.clientX - tpSX; panY = t.clientY - tpSY; applyPan();
  }, { passive: false });
  board.addEventListener('touchend', () => { if (touchPanId !== null) { touchPanId = null; savePan(); } });

  // Scroll wheel pan
  board.addEventListener('wheel', e => {
    e.preventDefault();
    panX -= e.deltaX; panY -= e.deltaY;
    applyPan(); savePan();
  }, { passive: false });

  /* ── HINT & BUTTONS ────────────────────────────── */
  function updateHint() {
    document.getElementById('notas-hint').style.opacity = notes.length === 0 ? '1' : '0';
  }

  document.getElementById('notas-addBtn').addEventListener('click', () => createNote());

  document.getElementById('notas-resetBtn').addEventListener('click', () => {
    panX = 0; panY = 0; applyPan(); save();
  });

  document.getElementById('notas-cancelBtn').addEventListener('click', () => {
    document.getElementById('notas-modal-overlay').classList.remove('show');
  });
  document.getElementById('notas-confirmBtn').addEventListener('click', () => {
    document.getElementById('notas-modal-overlay').classList.remove('show');
    notes.forEach(n => n.el.remove()); notes = []; updateHint(); save();
  });
  document.getElementById('notas-modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
  });

  /* ── DOUBLE CLICK = NEW NOTE ───────────────────── */
  board.addEventListener('dblclick', e => {
    if (e.target.closest('.notas-note') || e.target.closest('#notas-toolbar') || e.target.closest('#notas-modal')) return;
    const br = board.getBoundingClientRect();
    createNote({ x: (e.clientX - br.left - panX) - 110, y: (e.clientY - br.top - panY) - 30 });
  });

  /* ── CTRL+N ────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      if (document.getElementById('module-tareas').classList.contains('active')) {
        e.preventDefault(); createNote();
      }
    }
  });

  /* ── INIT ──────────────────────────────────────── */
  const tip = document.getElementById('notas-shortcut');
  if (tip && (navigator.platform.toUpperCase().includes('MAC') || navigator.userAgent.includes('Mac OS'))) {
    tip.textContent = '⌘N · doble clic para nueva nota';
  }
  load();
  updateHint();
})();
