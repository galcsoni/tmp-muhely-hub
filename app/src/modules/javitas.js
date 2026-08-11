// ─────────────────────────────────────────────────────────────────────────
// Javítás modul
// UGYANAZ a felépítés mint a Raktárnál: állapot-kártyák (mint kategóriák) a
// listanézeten, rákattintva egy táblázat az adott állapotban lévő tételekkel,
// helyben szerkeszthető mezőkkel + gyors állapotváltóval soronként.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const STATUSES = [
    'Átvett', 'Elkezdett', 'Árajánlatra vár', 'Árajánlat kiadva',
    'Kész', 'Elvitt', 'Fizetve'
  ];
  const STATUS_COLORS = {
    'Átvett': '#5B7F99',
    'Elkezdett': '#B0672E',
    'Árajánlatra vár': '#A8A098',
    'Árajánlat kiadva': '#8A6FA8',
    'Kész': '#6B8F5E',
    'Elvitt': '#B0453A',
    'Fizetve': '#C9A227'
  };

  // A régi állapotnevek megfeleltetése, hogy a meglévő adat ne vesszen el
  const LEGACY_STATUS = {
    'Ajánlat kért': 'Árajánlatra vár',
    'Ajánlat kiadva': 'Árajánlat kiadva'
  };

  function normStatus(st) {
    if (!st) return STATUSES[0];
    if (LEGACY_STATUS[st]) return LEGACY_STATUS[st];
    return STATUSES.includes(st) ? st : STATUSES[0];
  }

  // Elvitte a készüléket, de még nem fizetett -> ezt látni akarjuk
  function unpaid(rec) {
    return normStatus(rec.status) === 'Elvitt';
  }

  let javitasData = {};
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
    const hay = `${rec.keszulek || ''} ${rec.modell || ''} ${rec.serial || ''} ${rec.partner || ''} ${rec.note || ''}`.toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  }

  // ── LISTA NÉZET: állapot-kártyák (mint a Raktár kategóriái) ──────────
  function renderListScreen(root) {
    const entries = Object.entries(javitasData).filter(([, rec]) => matchesSearch(rec));

    root.innerHTML = `
      <div class="toolbar">
        <input id="jav-search" class="search-input" placeholder="Keresés készülék, modell, sorozatszám, ügyfél szerint…" value="${escapeHtml(searchTerm)}" />
        <button id="jav-add" class="btn-primary">+ Új javítás</button>
        ${Object.keys(javitasData).length === 0 ? '<button id="jav-migrate" class="btn-secondary">Régi javítások átemelése</button>' : ''}
      </div>
      <p class="grid-title">Állapotok</p>
      <div class="card-grid">
        ${STATUSES.map((status) => {
          const items = entries.filter(([, rec]) => normStatus(rec.status) === status);
          const color = STATUS_COLORS[status];
          const villog = status === 'Elvitt' && items.length > 0;
          return `
            <div class="category-card-tile${villog ? ' fizetetlen' : ''}" data-open="${status}" style="border-top:3px solid ${color};">
              <span class="cat-type-tag" style="border-color:${color};color:${color};">${items.length} tétel</span>
              <div class="cat-name">${status}</div>
              <div class="cat-stat">${
                villog
                  ? `<span style="color:var(--danger);font-weight:600;">💸 ${items.length} db elvitték, de nem fizette ki</span>`
                  : (items.length === 0 ? 'nincs itt semmi' : items.slice(0, 2).map(([, r]) => escapeHtml(r.keszulek || 'névtelen')).join(', ') + (items.length > 2 ? '…' : ''))
              }</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('jav-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('jav-search');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    document.getElementById('jav-add')?.addEventListener('click', () => {
      window.DataLayer.javitasAdd({}).then(() => {});
    });
    document.getElementById('jav-migrate')?.addEventListener('click', () => {
      if (!confirm('Átemeli a régi javítási tételeket (v11_repairs) ebbe az új listába. A régi adat megmarad. Folytatod?')) return;
      window.DataLayer.migrateJavitasFromOld().then((count) => {
        alert(`Kész! ${count} javítási tétel átemelve. A "készülék" mezőbe került a régi szöveg, a régi "ár" pedig a "végösszeg" mezőbe.`);
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
    const st = normStatus(rec.status);
    const color = STATUS_COLORS[st] || 'var(--border-light)';
    const nemFizetett = unpaid(rec);
    return `
      <div class="record-card-tile${nemFizetett ? ' fizetetlen' : ''}" data-open="${id}" style="border-top:3px solid ${color};">
        ${nemFizetett ? '<span class="fizetetlen-jel">💸 Nincs fizetve</span>' : ''}
        <div class="rct-title">${escapeHtml(rec.keszulek || 'Névtelen készülék')}${rec.modell ? ' · ' + escapeHtml(rec.modell) : ''}</div>
        <div class="rct-meta">
          ${escapeHtml(rec.partner || 'nincs ügyfél megadva')}<br>
          ${rec.dateIn ? 'Be: ' + escapeHtml(rec.dateIn) : ''}${rec.dateOut ? ' · Ki: ' + escapeHtml(rec.dateOut) : ''}<br>
          <span class="cost-line">${Number(rec.vegosszeg || 0).toLocaleString('hu-HU')} Ft</span>
        </div>
        <select class="rct-move" data-move="${id}">
          ${STATUSES.map((s) => `<option value="${s}" ${s === st ? 'selected' : ''}>→ ${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  function openRecordModal(id) {
    const rec = javitasData[id];
    if (!rec) return;
    const st = normStatus(rec.status);
    const color = STATUS_COLORS[st] || 'var(--border-light)';

    const html = `
      <div class="repair-detail-header" style="margin-bottom:18px;">
        <div class="name-block">
          <input class="cat-title-input" data-field="keszulek" placeholder="Készülék" value="${escapeHtml(rec.keszulek)}" />
          <input class="model-input" data-field="modell" placeholder="Modellszám" value="${escapeHtml(rec.modell)}" />
        </div>
        <select class="status-badge-select" data-field="status" style="border-color:${color};color:${color};">
          ${STATUSES.map((s) => `<option value="${s}" ${st === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn-tiny btn-danger" data-action="delete">Törlés</button>
      </div>
      <div class="repair-detail-body">
        <div class="detail-fields-card">
          <div class="field-grid">
            <div><span class="field-label">Ügyfél</span><input class="cell-input" data-field="partner" value="${escapeHtml(rec.partner)}" /></div>
            <div><span class="field-label">Sorozatszám</span><input class="cell-input" data-field="serial" value="${escapeHtml(rec.serial)}" /></div>
            <div><span class="field-label">Bevétel dátuma</span><input class="cell-input" type="date" data-field="dateIn" value="${escapeHtml(rec.dateIn)}" /></div>
            <div><span class="field-label">Kiadás dátuma</span><input class="cell-input" type="date" data-field="dateOut" value="${escapeHtml(rec.dateOut)}" /></div>
          </div>
          <span class="field-label">Megjegyzés</span>
          <textarea class="note-input" data-field="note" rows="4" style="width:100%;">${escapeHtml(rec.note)}</textarea>
        </div>
        <div class="cost-card">
          <div class="info-card-title">Végösszeg</div>
          <input class="cost-hero-input" type="number" data-field="vegosszeg" value="${rec.vegosszeg ?? 0}" />
          <span class="cost-hero-suffix">Ft - amit ténylegesen felszámolsz</span>
          <div class="cost-ref-row">
            <div><span class="field-label">Alkatrészár (Ft) - referencia</span><input class="cell-input num" type="number" data-field="alkatreszAr" value="${rec.alkatreszAr ?? 0}" style="width:100%;" /></div>
            <div><span class="field-label">Munkaóra - referencia</span><input class="cell-input num" type="number" step="0.5" data-field="munkaora" value="${rec.munkaora ?? 0}" style="width:100%;" /></div>
          </div>
        </div>
      </div>
    `;

    const content = window.AppModal.open(html);

    content.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const isNum = e.target.classList.contains('num') || e.target.classList.contains('cost-hero-input');
        const value = isNum ? Number(e.target.value) || 0 : e.target.value;
        window.DataLayer.javitasUpdate(id, { [field]: value });
        if (field === 'status') window.AppModal.close();
      });
    });
    content.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a javítási tételt?')) return;
      window.DataLayer.javitasDelete(id);
      window.AppModal.close();
    });
  }

  function renderDetailScreen(root) {
    const items = Object.entries(javitasData).filter(([, rec]) => normStatus(rec.status) === activeStatus);
    const color = STATUS_COLORS[activeStatus];

    root.innerHTML = `
      <div class="category-detail-head">
        <span style="font-family:var(--font-display);font-weight:700;font-size:22px;color:${color};">${activeStatus}</span>
        <button class="btn-secondary" id="jav-add-here" style="margin-top:0;">+ Új tétel ide</button>
      </div>
      <div class="card-grid">
        ${items.map(([id, rec]) => renderCompactCard(id, rec)).join('') || '<p class="empty-state">Nincs tétel ebben az állapotban.</p>'}
      </div>
    `;

    document.getElementById('jav-add-here')?.addEventListener('click', () => {
      window.DataLayer.javitasAdd({ status: activeStatus }).then((id) => {
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
        window.DataLayer.javitasUpdate(e.target.dataset.move, { status: e.target.value });
      });
    });
  }

  function render() {
    const root = document.getElementById('module-body-javitas');
    if (!root) return;
    if (screen === 'detail') renderDetailScreen(root);
    else renderListScreen(root);
  }

  function getDashboardStat() {
    const all = Object.values(javitasData);
    if (all.length === 0) return '<span class="dash-card-stat muted">még nincs adat</span>';
    const inProgress = all.filter((r) => ['Elkezdett', 'Árajánlatra vár', 'Árajánlat kiadva'].includes(normStatus(r.status))).length;
    const nemFizetett = all.filter(unpaid).length;
    const parts = [`${all.length} tétel`];
    if (inProgress > 0) parts.push(`${inProgress} folyamatban`);
    if (nemFizetett > 0) parts.push(`<span style="color:var(--danger);font-weight:600;">${nemFizetett} nincs fizetve</span>`);
    return `<span class="dash-card-stat">${parts.join(' · ')}</span>`;
  }

  function initJavitasModule() {
    window.DataLayer.watchJavitas((data) => {
      javitasData = data || {};
      render();
      window.DashboardStats?.refresh();
    });
  }

  
  // A nyitóképernyőre: mi kíván figyelmet ebben a modulban
  function getFigyelmeztetes() {
    const nemFizetett = Object.values(javitasData).filter(unpaid).length;
    if (nemFizetett > 0) {
      return { modul: 'javitas', ikon: '💸', suly: 'suly-piros',
               szoveg: `${nemFizetett} javítás elvitték, de nincs kifizetve` };
    }
    return null;
  }

window.JavitasModule = { init: initJavitasModule, getFigyelmeztetes };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.javitas = {
    isDetail: () => screen === 'detail',
    goToList: () => { screen = 'list'; render(); window.AppAnim?.ujra(); },
    getDashboardStat
  };
})();



