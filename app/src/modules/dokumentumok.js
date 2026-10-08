// ─────────────────────────────────────────────────────────────────────────
// Dokumentumok modul
// Kategória-kártyák (Gépek, Beszállítók, Garanciák, stb.), bennük tételek:
// egy cím, egy típus, egy link és egy jegyzet. Fájlt nem tárolunk - a link
// mutathat Drive-ra, gyártói oldalra, bárhová.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const TYPES = ['Kezelési útmutató', 'Adatlap', 'Garancia', 'Számla', 'Szerződés', 'Jegyzet', 'Egyéb'];
  const TYPE_COLORS = {
    'Kezelési útmutató': '#5B7F99',
    'Adatlap': '#6B7A63',
    'Garancia': '#9C6B3F',
    'Számla': '#B0672E',
    'Szerződés': '#7A5B8F',
    'Jegyzet': '#A8A098',
    'Egyéb': '#8A837B'
  };

  let data = {};
  let searchTerm = '';
  let screen = 'list';
  let activeKatId = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function dayOf(d) {
    if (d.createdAt) return new Date(d.createdAt).toISOString().slice(0, 10);
    return 'Dátum nélkül';
  }

  function shortUrl(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').slice(0, 42);
  }

  function matchesSearch(d) {
    if (!searchTerm) return true;
    const hay = `${d.title || ''} ${d.note || ''} ${d.url || ''} ${d.type || ''}`.toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  }

  // ── LISTA NÉZET: kategória-kártyák ────────────────────────────────────
  function renderListScreen(root) {
    const entries = Object.entries(data).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

    root.innerHTML = `
      <div class="toolbar">
        <input id="dok-search" class="search-input" placeholder="Keresés cím, jegyzet vagy link szerint…" value="${escapeHtml(searchTerm)}" />
        <button id="dok-add-kat" class="btn-primary">+ Új kategória</button>
      </div>
      ${searchTerm ? renderSearchResults() : `
        <p class="grid-title">Kategóriák</p>
        <div class="card-grid">
          ${entries.map(([id, kat]) => {
            const docs = Object.values(kat.docs || {});
            const linkes = docs.filter((d) => d.url).length;
            return `
              <div class="category-card-tile" data-open="${id}">
                <span class="cat-type-tag">${docs.length} tétel</span>
                <div class="cat-name">${escapeHtml(kat.title)}</div>
                <div class="cat-stat">${docs.length ? `${linkes} linkkel · ${docs.length - linkes} csak jegyzet` : 'még üres'}</div>
              </div>
            `;
          }).join('') || '<p class="empty-state">Nincs még kategória. Hozz létre egyet — pl. „Gépek", „Beszállítók", „Garanciák".</p>'}
        </div>
      `}
    `;

    document.getElementById('dok-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('dok-search');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    document.getElementById('dok-add-kat')?.addEventListener('click', () => {
      window.AppKerdes.szoveg({
        cim: 'Új kategória',
        leiras: 'Mit gyűjtünk ebbe a kategóriába?',
        hely: 'pl. Gépek, Beszállítók, Garanciák'
      }).then((title) => {
        if (title === null || !title.trim()) return;
        window.DataLayer.dokKategoriaAdd(title.trim());
      });
    });
    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        activeKatId = el.dataset.open;
        screen = 'detail';
        render();
        window.AppAnim?.ujra();
      });
    });
    bindDocTiles(root);
  }

  // Kereséskor az összes kategórián átmegyünk, és jelezzük melyikben van
  function renderSearchResults() {
    const hits = [];
    Object.entries(data).forEach(([katId, kat]) => {
      Object.entries(kat.docs || {}).forEach(([docId, d]) => {
        if (matchesSearch(d)) hits.push({ katId, katName: kat.title, docId, d });
      });
    });
    if (!hits.length) return '<p class="empty-state">Nincs találat erre a keresésre.</p>';
    return `
      <p class="grid-title">${hits.length} találat</p>
      <div class="card-grid">
        ${hits.map((h) => renderDocTile(h.docId, h.d, h.katId, h.katName)).join('')}
      </div>
    `;
  }

  // ── DOKUMENTUM-KÁRTYA ─────────────────────────────────────────────────
  function renderDocTile(docId, d, katId, katName) {
    const color = TYPE_COLORS[d.type] || 'var(--border-light)';
    return `
      <div class="record-card-tile" data-open-doc="${docId}" data-kat="${katId}" style="border-top:3px solid ${color};">
        <span class="cat-type-tag" style="border-color:${color};color:${color};">${escapeHtml(d.type || 'Egyéb')}</span>
        <div class="rct-title">${escapeHtml(d.title || 'Névtelen tétel')}</div>
        <div class="todo-card-dates">
          ${katName ? `<span class="added">Kategória: ${escapeHtml(katName)}</span><br />` : ''}
          <span class="added">Hozzáadva: ${escapeHtml(dayOf(d))}</span>
          ${d.note ? `<br /><span style="color:var(--text-secondary);">${escapeHtml(d.note.slice(0, 70))}${d.note.length > 70 ? '…' : ''}</span>` : ''}
        </div>
        ${d.url
          ? `<a href="${escapeHtml(d.url)}" target="_blank" rel="noopener" class="btn-tiny" data-link="1" style="display:inline-block;text-decoration:none;">🔗 ${escapeHtml(shortUrl(d.url))}</a>`
          : '<span style="font-size:11.5px;color:var(--text-dim);font-style:italic;">nincs link, csak jegyzet</span>'}
      </div>
    `;
  }

  // ── POPUP ─────────────────────────────────────────────────────────────
  function openDocModal(katId, docId) {
    const kat = data[katId];
    const d = kat?.docs?.[docId];
    if (!d) return;
    const color = TYPE_COLORS[d.type] || 'var(--border-light)';

    const html = `
      <div class="repair-detail-header" style="margin-bottom:18px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;flex:1;">Dokumentum - ${escapeHtml(kat.title)}</span>
        <select class="status-badge-select" data-field="type" style="border-color:${color};color:${color};">
          ${TYPES.map((t) => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <button class="btn-tiny btn-danger" data-action="delete">Törlés</button>
      </div>
      <div class="detail-fields-card">
        <span class="field-label">Megnevezés</span>
        <input class="cell-input" data-field="title" value="${escapeHtml(d.title)}" style="width:100%;margin-bottom:16px;" />

        <span class="field-label">Link (Drive, gyártói oldal, bármi)</span>
        <input class="cell-input" data-field="url" value="${escapeHtml(d.url)}" placeholder="https://…" style="width:100%;margin-bottom:6px;" />
        ${d.url ? `<a href="${escapeHtml(d.url)}" target="_blank" rel="noopener" style="font-size:12.5px;color:var(--accent);">🔗 Megnyitás új lapon</a>` : ''}

        <div style="height:16px;"></div>
        <span class="field-label">Jegyzet</span>
        <textarea class="note-input" data-field="note" rows="5" style="width:100%;margin-bottom:16px;">${escapeHtml(d.note)}</textarea>

        <div class="field-grid">
          <div><span class="field-label">Hozzáadva</span><input class="cell-input" value="${escapeHtml(dayOf(d))}" disabled style="color:var(--text-dim);" /></div>
        </div>
      </div>
    `;

    const content = window.AppModal.open(html);
    content.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', (e) => {
        window.DataLayer.dokUpdate(katId, docId, { [e.target.dataset.field]: e.target.value });
      });
    });
    content.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a tételt?')) return;
      window.DataLayer.dokDelete(katId, docId);
      window.AppModal.close();
    });
  }

  function bindDocTiles(root) {
    root.querySelectorAll('[data-link]').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation());
    });
    root.querySelectorAll('[data-open-doc]').forEach((el) => {
      el.addEventListener('click', () => openDocModal(el.dataset.kat, el.dataset.openDoc));
    });
  }

  // ── RÉSZLETNÉZET ──────────────────────────────────────────────────────
  function renderDetailScreen(root) {
    const kat = data[activeKatId];
    if (!kat) { screen = 'list'; return renderListScreen(root); }

    const docs = Object.entries(kat.docs || {})
      .filter(([, d]) => matchesSearch(d))
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    // Típus szerinti elkülönítés, mint a TO-DO-nál
    const groups = TYPES.map((t) => {
      const items = docs.filter(([, d]) => (d.type || 'Egyéb') === t);
      if (!items.length) return '';
      const c = TYPE_COLORS[t];
      return `
        <div class="todo-group" style="--gc:${c};">
          <div class="todo-group-head">
            <span class="todo-group-dot"></span>
            <span class="todo-group-name">${t}</span>
            <span class="todo-group-count">${items.length} db</span>
          </div>
          <div class="card-grid">${items.map(([id, d]) => renderDocTile(id, d, activeKatId, null)).join('')}</div>
        </div>
      `;
    }).join('');

    root.innerHTML = `
      <div class="category-detail-head">
        <input class="cat-title-input" data-action="rename" value="${escapeHtml(kat.title)}" style="font-family:var(--font-display);font-weight:700;font-size:22px;flex:0 1 auto;width:auto;" />
        <button class="btn-primary" id="dok-add" style="margin-top:0;">+ Új tétel</button>
        <button class="btn-tiny btn-danger" data-action="delete-kat">Kategória törlése</button>
      </div>
      <div class="toolbar" style="margin-bottom:20px;">
        <input id="dok-search-detail" class="search-input" placeholder="Keresés ezen a kategórián belül…" value="${escapeHtml(searchTerm)}" />
      </div>
      ${docs.length ? groups : '<p class="empty-state">Ebben a kategóriában még nincs tétel.</p>'}
    `;

    root.querySelector('[data-action="rename"]')?.addEventListener('change', (e) => {
      window.DataLayer.dokKategoriaUpdate(activeKatId, { title: e.target.value });
    });
    document.getElementById('dok-search-detail')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('dok-search-detail');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    document.getElementById('dok-add')?.addEventListener('click', () => {
      window.DataLayer.dokAdd(activeKatId, {}).then((docId) => {
        render();
        openDocModal(activeKatId, docId);
      });
    });
    root.querySelector('[data-action="delete-kat"]')?.addEventListener('click', () => {
      if (!confirm('Biztosan törlöd ezt a kategóriát az összes tételével együtt?')) return;
      window.DataLayer.dokKategoriaDelete(activeKatId);
      screen = 'list';
      render();
      window.AppAnim?.ujra();
    });
    bindDocTiles(root);
  }

  function render() {
    const root = document.getElementById('module-body-dokumentumok');
    if (!root) return;
    if (screen === 'detail') renderDetailScreen(root);
    else renderListScreen(root);
  }

  function getDashboardInfo() {
    let kat = 0, db = 0;
    Object.values(data).forEach((k) => { kat += 1; db += Object.keys(k.docs || {}).length; });
    if (!kat) return null;
    return { szam: db, egyseg: 'dokumentum', mellek: `${kat} kategóriában`, figyelem: null };
  }

  function getDashboardStat() {
    let kat = 0, db = 0;
    Object.values(data).forEach((k) => {
      kat += 1;
      db += Object.keys(k.docs || {}).length;
    });
    if (!kat) return '<span class="dash-card-stat muted">még nincs adat</span>';
    return `<span class="dash-card-stat">${db} tétel · ${kat} kategória</span>`;
  }

  function init() {
    window.DataLayer.watchDokumentumok((d) => {
      data = d || {};
      window.RenderGuard.rajzol(render, 'dokumentumok');
      window.DashboardStats?.refresh();
    });
  }

  window.DokumentumokModule = { init };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.dokumentumok = {
    isDetail: () => screen === 'detail',
    goToList: () => { screen = 'list'; render(); window.AppAnim?.ujra(); },
    getDashboardStat,
    getDashboardInfo
  };
})();
