// ─────────────────────────────────────────────────────────────────────────
// Kölcsönzés modul
// Ugyanaz a minta: állapot-kártyák (Kölcsönben / Visszahozva) → kompakt
// kártyák → popup a szerkesztéshez.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const STATUSES = ['Kölcsönben', 'Visszahozva'];
  const STATUS_COLORS = {
    'Kölcsönben': '#B0672E',
    'Visszahozva': '#6B8F5E'
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
    const hay = `${rec.eszkoz || ''} ${rec.kolcsonvevo || ''} ${rec.megjegyzes || ''}`.toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  }

  // ── LISTA NÉZET: állapot-kártyák ──────────────────────────────────────
  function renderListScreen(root) {
    const entries = Object.entries(data).filter(([, rec]) => matchesSearch(rec));

    root.innerHTML = `
      <div class="toolbar">
        <input id="kolcs-search" class="search-input" placeholder="Keresés eszköz vagy kölcsönvevő szerint…" value="${escapeHtml(searchTerm)}" />
        <button id="kolcs-add" class="btn-primary">+ Új kölcsönzés</button>
        ${Object.keys(data).length === 0 ? '<button id="kolcs-migrate" class="btn-secondary">Régi kölcsönzések átemelése</button>' : ''}
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
              <div class="cat-stat">${items.length === 0 ? 'nincs itt semmi' : items.slice(0, 2).map(([, r]) => escapeHtml(r.eszkoz || 'névtelen')).join(', ') + (items.length > 2 ? '…' : '')}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('kolcs-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('kolcs-search');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    document.getElementById('kolcs-add')?.addEventListener('click', () => {
      window.DataLayer.kolcsonzesAdd({});
    });
    document.getElementById('kolcs-migrate')?.addEventListener('click', () => {
      if (!confirm('Átemeli a régi kölcsönzési tételeket. Folytatod?')) return;
      window.DataLayer.migrateKolcsonzesFromOld().then((count) => {
        alert(`Kész! ${count} tétel átemelve.`);
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

  // ── RÉSZLETNÉZET: kompakt kártyák, kattintásra popup ─────────────────
  function renderCompactCard(id, rec) {
    const color = STATUS_COLORS[rec.status] || 'var(--border-light)';
    return `
      <div class="record-card-tile" data-open="${id}" style="border-top:3px solid ${color};">
        <div class="rct-title">${escapeHtml(rec.eszkoz || 'Névtelen eszköz')}</div>
        <div class="rct-meta">
          ${escapeHtml(rec.kolcsonvevo || 'nincs kölcsönvevő megadva')}<br>
          ${rec.kolcsonzesDatuma ? 'Kölcsönzés: ' + escapeHtml(rec.kolcsonzesDatuma) : ''}${rec.visszahozasDatuma ? ' · Visszahozás: ' + escapeHtml(rec.visszahozasDatuma) : ''}
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
          <input class="cat-title-input" data-field="eszkoz" placeholder="Eszköz neve" value="${escapeHtml(rec.eszkoz)}" />
          <input class="model-input" data-field="kolcsonvevo" placeholder="Kölcsönvevő neve" value="${escapeHtml(rec.kolcsonvevo)}" />
        </div>
        <select class="status-badge-select" data-field="status" style="border-color:${color};color:${color};">
          ${STATUSES.map((s) => `<option value="${s}" ${rec.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn-tiny btn-danger" data-action="delete">Törlés</button>
      </div>
      <div class="detail-fields-card">
        <div class="field-grid">
          <div><span class="field-label">Kölcsönzés dátuma</span><input class="cell-input" type="date" data-field="kolcsonzesDatuma" value="${escapeHtml(rec.kolcsonzesDatuma)}" /></div>
          <div><span class="field-label">Visszahozás dátuma</span><input class="cell-input" type="date" data-field="visszahozasDatuma" value="${escapeHtml(rec.visszahozasDatuma)}" /></div>
        </div>
        <span class="field-label">Megjegyzés</span>
        <textarea class="note-input" data-field="megjegyzes" rows="3" style="width:100%;">${escapeHtml(rec.megjegyzes)}</textarea>
      </div>
    `;

    const content = window.AppModal.open(html);

    content.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const patch = { [field]: e.target.value };
        // Ha visszahozottra állítod és nincs visszahozás dátum, beírjuk a mait
        if (field === 'status' && e.target.value === 'Visszahozva' && !rec.visszahozasDatuma) {
          patch.visszahozasDatuma = new Date().toISOString().slice(0, 10);
        }
        window.DataLayer.kolcsonzesUpdate(id, patch);
        if (field === 'status') window.AppModal.close();
      });
    });
    content.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a kölcsönzési tételt?')) return;
      window.DataLayer.kolcsonzesDelete(id);
      window.AppModal.close();
    });
  }

  function renderDetailScreen(root) {
    const items = Object.entries(data).filter(([, rec]) => (rec.status || STATUSES[0]) === activeStatus);
    const color = STATUS_COLORS[activeStatus];

    root.innerHTML = `
      <div class="category-detail-head">
        <span style="font-family:var(--font-display);font-weight:700;font-size:22px;color:${color};">${activeStatus}</span>
        <button class="btn-secondary" id="kolcs-add-here" style="margin-top:0;">+ Új tétel ide</button>
      </div>
      <div class="card-grid">
        ${items.map(([id, rec]) => renderCompactCard(id, rec)).join('') || '<p class="empty-state">Nincs tétel ebben az állapotban.</p>'}
      </div>
    `;

    document.getElementById('kolcs-add-here')?.addEventListener('click', () => {
      window.DataLayer.kolcsonzesAdd({ status: activeStatus }).then((id) => {
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
        const patch = { status: e.target.value };
        const rec = data[e.target.dataset.move];
        if (e.target.value === 'Visszahozva' && rec && !rec.visszahozasDatuma) {
          patch.visszahozasDatuma = new Date().toISOString().slice(0, 10);
        }
        window.DataLayer.kolcsonzesUpdate(e.target.dataset.move, patch);
      });
    });
  }

  function render() {
    const root = document.getElementById('module-body-kolcsonzes');
    if (!root) return;
    if (screen === 'detail') renderDetailScreen(root);
    else renderListScreen(root);
  }

  function getDashboardStat() {
    const all = Object.values(data);
    if (all.length === 0) return '<span class="dash-card-stat muted">még nincs adat</span>';
    const active = all.filter((r) => r.status === 'Kölcsönben').length;
    return `<span class="dash-card-stat">${all.length} tétel${active > 0 ? ` · ${active} kint van` : ''}</span>`;
  }

  function init() {
    window.DataLayer.watchKolcsonzes((d) => {
      data = d || {};
      render();
      window.DashboardStats?.refresh();
    });
  }

  window.KolcsonzesModule = { init };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.kolcsonzes = {
    isDetail: () => screen === 'detail',
    goToList: () => { screen = 'list'; render(); window.AppAnim?.ujra(); },
    getDashboardStat
  };
})();



