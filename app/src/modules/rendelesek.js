// ─────────────────────────────────────────────────────────────────────────
// Rendelések modul
// UGYANAZ a felépítés mint a Raktárnál/Javításnál: állapot-kártyák a listán,
// rákattintva táblázat helyben szerkeszthető sorokkal.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const STATUSES = ['Rendelést adott le', 'Kész a termék', 'Mehet a számlázás', 'Csomag feladva', 'Minden kész', 'NEM KELLETT NEKI'];
  const STATUS_COLORS = {
    'Rendelést adott le': '#A8A098',
    'Kész a termék': '#6B8F5E',
    'Mehet a számlázás': '#C9A227',
    'Csomag feladva': '#5B7F99',
    'Minden kész': '#7C5C99',
    'NEM KELLETT NEKI': '#B0453A'
  };

  let data = {};
  let searchTerm = '';
  let screen = 'list';
  let activeStatus = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function matchesSearch(rec) {
    if (!searchTerm) return true;
    const hay = `${rec.nev || ''} ${rec.termek || ''} ${rec.email || ''} ${rec.telefon || ''}`.toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  }

  // ── LISTA NÉZET: állapot-kártyák ──────────────────────────────────────
  function renderListScreen(root) {
    const entries = Object.entries(data).filter(([, rec]) => matchesSearch(rec));

    root.innerHTML = `
      <div class="toolbar">
        <input id="rend-search" class="search-input" placeholder="Keresés név, termék, e-mail, telefon szerint…" value="${escapeHtml(searchTerm)}" />
        <button id="rend-add" class="btn-primary">+ Új rendelés</button>
        ${Object.keys(data).length === 0 ? '<button id="rend-migrate" class="btn-secondary">Egy régi rendelés átemelése példának</button>' : ''}
      </div>
      <p class="grid-title">Állapotok</p>
      <div class="card-grid">
        ${STATUSES.map((status) => {
          const items = entries.filter(([, rec]) => (rec.status || STATUSES[0]) === status);
          const color = STATUS_COLORS[status];
          return `
            <div class="category-card-tile" data-open="${status}" style="border-top:3px solid ${color};">
              <span class="cat-type-tag" style="border-color:${color};color:${color};">${items.length} tétel</span>
              <div class="cat-name">${status}</div>
              <div class="cat-stat">${items.length === 0 ? 'nincs itt semmi' : items.slice(0, 2).map(([, r]) => escapeHtml(r.nev || 'névtelen')).join(', ') + (items.length > 2 ? '…' : '')}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('rend-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('rend-search');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    document.getElementById('rend-add')?.addEventListener('click', () => {
      window.DataLayer.rendelesAdd({});
    });
    document.getElementById('rend-migrate')?.addEventListener('click', () => {
      if (!confirm('Átemel EGY régi rendelést a v12_orders-ből, hogy legyen egy konkrét példa. Folytatod?')) return;
      window.DataLayer.migrateOneRendelesFromOld().then((count) => {
        if (count === 0) alert('Nem található régi rendelés.');
      }).catch((err) => alert('Hiba: ' + err.message));
    });
    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        activeStatus = el.dataset.open;
        screen = 'detail';
        render();
        window.AppAnim?.ujra();
      });
    });
  }

  // ── RÉSZLETNÉZET: kompakt kártyák, kattintásra popup nyílik ──────────
  function renderCompactCard(id, rec) {
    const color = STATUS_COLORS[rec.status] || 'var(--border-light)';
    return `
      <div class="record-card-tile" data-open="${id}" style="border-top:3px solid ${color};">
        <div class="rct-title">${escapeHtml(rec.nev || 'Névtelen vevő')}</div>
        <div class="rct-meta">
          ${escapeHtml(rec.termek || 'nincs termék megadva')}<br>
          ${rec.rendelesDatuma ? 'Rendelve: ' + escapeHtml(rec.rendelesDatuma) : ''}${rec.cegforma ? ' · ' + escapeHtml(rec.cegforma) : ''}<br>
          <span class="cost-line">${escapeHtml(rec.ar || '—')}</span>
        </div>
        <select class="rct-move" data-move="${id}">
          ${STATUSES.map((s) => `<option value="${s}" ${s === (rec.status || STATUSES[0]) ? 'selected' : ''}>→ ${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  function openRecordModal(id) {
    const rec = data[id];
    if (!rec) return;
    const color = STATUS_COLORS[rec.status] || 'var(--border-light)';

    const html = `
      <div class="repair-detail-header" style="margin-bottom:18px;">
        <div class="name-block">
          <input class="cat-title-input" data-field="nev" placeholder="Vevő neve" value="${escapeHtml(rec.nev)}" />
          <input class="model-input" data-field="termek" placeholder="Vásárolt termék" value="${escapeHtml(rec.termek)}" style="width:280px;" />
        </div>
        <select class="status-badge-select" data-field="status" style="border-color:${color};color:${color};">
          ${STATUSES.map((s) => `<option value="${s}" ${rec.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn-tiny btn-danger" data-action="delete">Törlés</button>
      </div>
      <div class="repair-detail-body">
        <div class="detail-fields-card">
          <div class="field-grid">
            <div><span class="field-label">E-mail</span><input class="cell-input" data-field="email" value="${escapeHtml(rec.email)}" /></div>
            <div><span class="field-label">Telefonszám</span><input class="cell-input" data-field="telefon" value="${escapeHtml(rec.telefon)}" /></div>
            <div><span class="field-label">Rendelés dátuma</span><input class="cell-input" type="date" data-field="rendelesDatuma" value="${escapeHtml(rec.rendelesDatuma)}" /></div>
            <div>
              <span class="field-label">Cégforma (belső jelölés)</span>
              <select class="cell-input" data-field="cegforma" style="width:100%;">
                <option value="EV" ${rec.cegforma === 'EV' ? 'selected' : ''}>EV</option>
                <option value="KFT" ${rec.cegforma === 'KFT' ? 'selected' : ''}>KFT</option>
              </select>
            </div>
          </div>
          <span class="field-label">Igények / egyedi kérések</span>
          <textarea class="note-input" data-field="igenyek" rows="3" style="width:100%;margin-bottom:16px;">${escapeHtml(rec.igenyek)}</textarea>
          <span class="field-label">Szállítási adatok</span>
          <textarea class="note-input" data-field="szallitas" rows="2" style="width:100%;margin-bottom:16px;">${escapeHtml(rec.szallitas)}</textarea>
          <span class="field-label">Számlázási cím</span>
          <textarea class="note-input" data-field="szamlazasCim" rows="2" style="width:100%;">${escapeHtml(rec.szamlazasCim)}</textarea>
        </div>
        <div class="cost-card">
          <div class="info-card-title">Ár</div>
          <input class="cell-input" data-field="ar" value="${escapeHtml(rec.ar)}" style="width:100%;font-size:18px;padding:10px;font-family:var(--font-display);font-weight:700;color:var(--accent);margin-bottom:16px;" placeholder="pl. 45 000 Ft" />
          <span class="field-label">Belső megjegyzés</span>
          <textarea class="note-input" data-field="megjegyzes" rows="4" style="width:100%;">${escapeHtml(rec.megjegyzes)}</textarea>
        </div>
      </div>
    `;

    const content = window.AppModal.open(html);

    content.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', (e) => {
        window.DataLayer.rendelesUpdate(id, { [e.target.dataset.field]: e.target.value });
        if (e.target.dataset.field === 'status') window.AppModal.close();
      });
    });
    content.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a rendelést?')) return;
      window.DataLayer.rendelesDelete(id);
      window.AppModal.close();
    });
  }

  function renderDetailScreen(root) {
    const items = Object.entries(data).filter(([, rec]) => (rec.status || STATUSES[0]) === activeStatus);
    const color = STATUS_COLORS[activeStatus];

    root.innerHTML = `
      <div class="category-detail-head">
        <span style="font-family:var(--font-display);font-weight:700;font-size:22px;color:${color};">${activeStatus}</span>
        <button class="btn-secondary" id="rend-add-here" style="margin-top:0;">+ Új rendelés ide</button>
      </div>
      <div class="card-grid">
        ${items.map(([id, rec]) => renderCompactCard(id, rec)).join('') || '<p class="empty-state">Nincs rendelés ebben az állapotban.</p>'}
      </div>
    `;

    document.getElementById('rend-add-here')?.addEventListener('click', () => {
      window.DataLayer.rendelesAdd({ status: activeStatus }).then((id) => {
        render();
        openRecordModal(id);
      });
    });

    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => openRecordModal(el.dataset.open));
    });
    root.querySelectorAll('[data-move]').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation());
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        window.DataLayer.rendelesUpdate(e.target.dataset.move, { status: e.target.value });
      });
    });
  }

  function render() {
    const root = document.getElementById('module-body-rendelesek');
    if (!root) return;
    if (screen === 'detail') renderDetailScreen(root);
    else renderListScreen(root);
  }

  function getDashboardInfo() {
    const all = Object.values(data);
    if (!all.length) return null;
    const active = all.filter((r) => r.status !== 'Minden kész' && r.status !== 'NEM KELLETT NEKI').length;
    return {
      szam: all.length,
      egyseg: 'rendelés',
      mellek: active > 0 ? `${active} még nyitott` : 'mind lezárva',
      figyelem: null
    };
  }

  function getDashboardStat() {
    const all = Object.values(data);
    if (all.length === 0) return '<span class="dash-card-stat muted">még nincs adat</span>';
    const active = all.filter((r) => r.status !== 'Minden kész' && r.status !== 'NEM KELLETT NEKI').length;
    return `<span class="dash-card-stat">${all.length} rendelés${active > 0 ? ` · ${active} aktív` : ''}</span>`;
  }

  function init() {
    window.DataLayer.watchRendelesek((d) => {
      data = d || {};
      window.RenderGuard.rajzol(render, 'rendelesek');
      window.DashboardStats?.refresh();
    });
  }

  window.RendelesekModule = { init };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.rendelesek = {
    isDetail: () => screen === 'detail',
    goToList: () => { screen = 'list'; render(); window.AppAnim?.ujra(); },
    getDashboardStat,
    getDashboardInfo
  };
})();



