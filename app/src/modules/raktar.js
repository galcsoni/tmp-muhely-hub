// ─────────────────────────────────────────────────────────────────────────
// Raktár modul
// Két al-nézet: "list" (kategória-kártyák rácsa) és "detail" (egy kategória
// alkatrészei táblázatban). A fő app.js hívja a goToList()-et, ha a globális
// "Vissza" gombot nyomják, amíg "detail" nézetben vagyunk.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  // Kategóriatípusok: ezek szerint lehet szűrni a raktárban
  const TYPE_LABELS = { mechanika: 'Mechanika', alkatresz: 'Alkatrész', modul: 'Modul', egyeb: 'Egyéb' };
  let raktarData = {};
  let searchTerm = '';
  let typeFilter = 'osszes';
  let screen = 'list';
  let activeCategoryId = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function partMatchesSearch(part) {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return `${part.name || ''} ${part.cikkszam || ''} ${part.note || ''}`.toLowerCase().includes(q);
  }

  function categoryStats(cat) {
    const parts = Object.values(cat.parts || {});
    const missing = parts.filter((p) => Number(p.qty_kell || 0) > Number(p.qty_van || 0)).length;
    return { total: parts.length, missing };
  }

  function globalStats() {
    const categories = Object.values(raktarData);
    let parts = 0, missing = 0, value = 0;
    categories.forEach((cat) => {
      Object.values(cat.parts || {}).forEach((p) => {
        parts += 1;
        if (Number(p.qty_kell || 0) > Number(p.qty_van || 0)) missing += 1;
        value += (Number(p.price) || 0) * (Number(p.qty_van) || 0);
      });
    });
    return { categories: categories.length, parts, missing, value };
  }

  function collectMissingParts() {
    const result = [];
    Object.entries(raktarData).forEach(([categoryId, cat]) => {
      Object.entries(cat.parts || {}).forEach(([partId, part]) => {
        if (Number(part.qty_kell || 0) > Number(part.qty_van || 0)) {
          result.push({ categoryId, categoryTitle: cat.title, partId, part });
        }
      });
    });
    return result;
  }

  // ── LISTA NÉZET: kategória-kártyák ────────────────────────────────────
  function renderListScreen(root) {
    const entries = Object.entries(raktarData)
      .filter(([, cat]) => typeFilter === 'osszes' || cat.type === typeFilter)
      .filter(([, cat]) => {
        if (!searchTerm) return true;
        return Object.values(cat.parts || {}).some(partMatchesSearch);
      })
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

    const noneYet = Object.keys(raktarData).length === 0;
    const stats = globalStats();

    root.innerHTML = `
      <div class="toolbar">
        <input id="raktar-search" class="search-input" placeholder="Keresés alkatrész név szerint…" value="${escapeHtml(searchTerm)}" />
        <select id="raktar-type-filter" class="cat-type-select">
          <option value="osszes" ${typeFilter === 'osszes' ? 'selected' : ''}>Összes típus</option>
          ${Object.entries(TYPE_LABELS).map(([val, label]) =>
            `<option value="${val}" ${typeFilter === val ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button id="raktar-add-cat" class="btn-primary">+ Új kategória</button>
        ${noneYet ? '<button id="raktar-migrate" class="btn-secondary">Régi adatok átemelése</button>' : ''}
      </div>

      ${!noneYet ? `
        <div class="summary-bar">
          <div class="summary-stat"><div class="ss-label">Kategóriák</div><div class="ss-value">${stats.categories}</div></div>
          <div class="summary-stat"><div class="ss-label">Alkatrészek</div><div class="ss-value">${stats.parts}</div></div>
          <div class="summary-stat ${stats.missing > 0 ? 'warn' : ''}"><div class="ss-label">Hiányzó tétel</div><div class="ss-value">${stats.missing}</div></div>
          <div class="summary-stat accent"><div class="ss-label">Raktár értéke</div><div class="ss-value">${Math.round(stats.value).toLocaleString('hu-HU')} Ft</div></div>
        </div>
      ` : ''}

      <p class="grid-title">Kategóriák</p>
      <div class="card-grid">
        ${!noneYet && stats.missing > 0 ? `
          <div class="category-card-tile missing-card" data-open-missing="1">
            <span class="cat-type-tag" style="border-color:var(--warn);color:var(--warn);">⚠️ Figyelem</span>
            <div class="cat-name">Hiányzó alkatrészek</div>
            <div class="cat-stat">${stats.missing} tétel az összes kategóriából, amiből kevesebb van mint kellene</div>
          </div>
        ` : ''}
        ${entries.map(([id, cat]) => {
          const catStats = categoryStats(cat);
          return `
            <div class="category-card-tile" data-open-cat="${id}">
              <span class="cat-type-tag">${TYPE_LABELS[cat.type] || 'Egyéb'}</span>
              <div class="cat-name">${escapeHtml(cat.title)}</div>
              <div class="cat-stat">${catStats.total} alkatrész${catStats.missing > 0 ? ` · <span class="warn-part">${catStats.missing} hiányzik</span>` : ''}</div>
            </div>
          `;
        }).join('') || '<p class="empty-state">Nincs még kategória. Hozz létre egyet fent, vagy emeld át a régi adatokat.</p>'}
      </div>
    `;

    document.getElementById('raktar-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('raktar-search');
      if (input) {
        input.focus();
        input.setSelectionRange(caret, caret);
      }
    });

    document.getElementById('raktar-type-filter')?.addEventListener('change', (e) => {
      typeFilter = e.target.value;
      render();
    });

    document.getElementById('raktar-add-cat')?.addEventListener('click', () => {
      window.AppKerdes.szoveg({
        cim: 'Új kategória',
        leiras: 'Hogy hívjuk ezt a kategóriát? (pl. Ellenállások, Kondenzátorok)',
        hely: 'Kategória neve'
      }).then((title) => {
        if (title === null) return;
        window.DataLayer.raktarAddCategory({ title: title.trim(), type: 'egyeb' });
      });
    });

    document.getElementById('raktar-migrate')?.addEventListener('click', () => {
      if (!confirm('Átemeli a régi raktár-adatokat (v10_inv) ebbe az új listába. A régi adat megmarad, csak másolat készül. Folytatod?')) return;
      window.DataLayer.migrateFromOldSchema().then((count) => {
        alert(`Kész! ${count} kategória átemelve.`);
      }).catch((err) => alert('Hiba történt: ' + err.message));
    });

    root.querySelectorAll('[data-open-cat]').forEach((el) => {
      el.addEventListener('click', () => {
        activeCategoryId = el.dataset.openCat;
        screen = 'detail';
        render();
        window.AppAnim?.ujra();
      });
    });
    root.querySelector('[data-open-missing]')?.addEventListener('click', () => {
      activeCategoryId = '__missing__';
      screen = 'detail';
      render();
      window.AppAnim?.ujra();
    });
  }

  // ── ALKATRÉSZ-KÉPEK ────────────────────────────────────────────────────
  // A képeket külön ágon tároljuk, ezért itt egy memória-cache van rájuk:
  // egy kép egy munkamenetben csak egyszer töltődik le.
  const kepCache = {};        // "katId/partId" -> dataUrl vagy null
  const kepFolyamatban = {};  // ugyanaz a kulcs -> true, amíg tölt

  function kepKulcs(categoryId, partId) { return `${categoryId}/${partId}`; }

  // A kártyákon lévő üres képhelyeket feltölti, amint megjött az adat.
  function kepBetolt(categoryId, partId) {
    const key = kepKulcs(categoryId, partId);
    if (key in kepCache || kepFolyamatban[key]) return;
    kepFolyamatban[key] = true;
    window.DataLayer.raktarKepGet(categoryId, partId).then((dataUrl) => {
      kepCache[key] = dataUrl || null;
      delete kepFolyamatban[key];
      document.querySelectorAll(`[data-kep-slot="${key}"]`).forEach((el) => {
        el.outerHTML = kepMarkup(categoryId, partId);
      });
    }).catch(() => { delete kepFolyamatban[key]; });
  }

  function kepMarkup(categoryId, partId) {
    const key = kepKulcs(categoryId, partId);
    const dataUrl = kepCache[key];
    if (dataUrl) {
      return `<img class="part-thumb" data-kep-slot="${key}" src="${dataUrl}" alt="" />`;
    }
    if (key in kepCache) {
      return `<span class="part-thumb empty" data-kep-slot="${key}">📦</span>`;
    }
    return `<span class="part-thumb loading" data-kep-slot="${key}"></span>`;
  }

  function kepNagyMarkup(categoryId, partId) {
    const dataUrl = kepCache[kepKulcs(categoryId, partId)];
    if (dataUrl) return `<img class="part-photo" src="${dataUrl}" alt="" />`;
    return '<span class="part-photo empty">📦</span>';
  }

  // Feltöltött fájl kicsinyítése bélyegképpé (max 200 px, JPEG).
  // Így egy kép ~5-15 KB, nem terheli meg az adatbázist.
  function kepZsugorit(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Nem sikerült beolvasni a fájlt.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Ez a fájl nem kép, vagy sérült.'));
        img.onload = () => {
          const MAX = 200;
          let { width: w, height: h } = img;
          const scale = Math.min(1, MAX / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function kepFeltolt(categoryId, partId, file, utana) {
    if (file.size > 12 * 1024 * 1024) {
      alert('Ez a kép túl nagy (12 MB felett). Válassz kisebbet.');
      return;
    }
    kepZsugorit(file).then((dataUrl) => {
      return window.DataLayer.raktarKepSet(categoryId, partId, dataUrl).then(() => {
        kepCache[kepKulcs(categoryId, partId)] = dataUrl;
        if (utana) utana();
      });
    }).catch((err) => alert('Nem sikerült a kép feltöltése: ' + err.message));
  }

  function kepTorol(categoryId, partId, utana) {
    window.DataLayer.raktarKepDelete(categoryId, partId).then(() => {
      kepCache[kepKulcs(categoryId, partId)] = null;
      if (utana) utana();
    });
  }

  // ── RÉSZLETNÉZET: kompakt alkatrész-kártyák, kattintásra popup ───────
  function renderPartTile(categoryId, partId, part) {
    const needMore = Number(part.qty_kell || 0) > Number(part.qty_van || 0);
    const linkCount = Object.keys(part.links || {}).length;
    return `
      <div class="record-card-tile" data-open="${partId}" style="${needMore ? 'border-top:3px solid var(--warn);' : ''}">
        <div class="part-thumb-row">
          ${kepMarkup(categoryId, partId)}
          <div class="rct-title" style="margin:0;">${escapeHtml(part.name)}</div>
        </div>
        <div class="rct-meta">
          ${(part.price || 0).toLocaleString('hu-HU')} Ft ${linkCount > 0 ? `· ${linkCount} link` : ''}<br>
          <span class="cost-line ${needMore ? 'warn-part' : ''}">Van: ${part.qty_van ?? 0} db · Kell: ${part.qty_kell ?? 0} db</span>
        </div>
      </div>
    `;
  }

  function openPartModal(categoryId, partId) {
    const cat = raktarData[categoryId];
    const part = cat?.parts?.[partId];
    if (!part) return;
    const links = part.links || {};

    // Ha a képet még nem kértük le, előbb megvárjuk, hogy a popup rögtön jól nyíljon
    const kkey = kepKulcs(categoryId, partId);
    if (!(kkey in kepCache)) {
      window.DataLayer.raktarKepGet(categoryId, partId).then((dataUrl) => {
        kepCache[kkey] = dataUrl || null;
        openPartModal(categoryId, partId);
      });
      return;
    }

    const html = `
      <div class="repair-detail-header" style="margin-bottom:18px;">
        <div class="name-block">
          <input class="cat-title-input" data-field="name" placeholder="Alkatrész neve" value="${escapeHtml(part.name)}" />
        </div>
        <button class="btn-tiny btn-danger" data-action="delete-part">Törlés</button>
      </div>
      <div class="detail-fields-card" style="margin-bottom:16px;">
        <span class="field-label" style="margin-bottom:9px;display:block;">Kép</span>
        <div class="part-photo-block">
          <div id="part-photo-preview">${kepNagyMarkup(categoryId, partId)}</div>
          <div>
            <input type="file" id="part-photo-input" accept="image/*" style="display:none;" />
            <button class="btn-tiny" data-action="pick-photo">${kepCache[kepKulcs(categoryId, partId)] ? 'Kép cseréje' : '+ Kép hozzáadása'}</button>
            ${kepCache[kepKulcs(categoryId, partId)] ? '<button class="btn-tiny btn-danger" data-action="remove-photo" style="margin-left:6px;">Kép törlése</button>' : ''}
            <p style="font-size:11.5px;color:var(--text-dim);margin:8px 0 0;line-height:1.6;">
              Bármilyen méretű képet választhatsz — automatikusan lekicsinyítem bélyegképpé.
            </p>
          </div>
        </div>
      </div>
      <div class="detail-fields-card" style="margin-bottom:16px;">
        <div class="field-grid">
          <div><span class="field-label">Ár (Ft)</span><input class="cell-input num" type="number" step="0.01" data-field="price" value="${part.price ?? 0}" /></div>
          <div><span class="field-label">Van (db)</span><input class="cell-input num" type="number" data-field="qty_van" value="${part.qty_van ?? 0}" /></div>
          <div><span class="field-label">Kell (db)</span><input class="cell-input num" type="number" data-field="qty_kell" value="${part.qty_kell ?? 0}" /></div>
        </div>
      </div>
      <div class="detail-fields-card">
        <span class="field-label" style="margin-bottom:8px;display:block;">Linkek</span>
        <div class="chip-row" id="part-link-list" style="margin-bottom:10px;">
          ${Object.entries(links).map(([linkId, url]) => `
            <span class="chip">
              <a href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(url)}">🔗 ${escapeHtml(url.slice(0, 28))}${url.length > 28 ? '…' : ''}</a>
              <button class="chip-x" data-action="remove-link" data-link="${linkId}">×</button>
            </span>
          `).join('') || '<span style="font-size:12px;color:var(--text-dim);">Még nincs link.</span>'}
        </div>
        <button class="btn-tiny" data-action="add-link">+ Új link</button>
      </div>
    `;

    const content = window.AppModal.open(html);

    content.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const isNum = e.target.classList.contains('num');
        const value = isNum ? Number(e.target.value) || 0 : e.target.value;
        window.DataLayer.raktarUpdatePart(categoryId, partId, { [field]: value });
      });
    });
    content.querySelector('[data-action="pick-photo"]')?.addEventListener('click', () => {
      content.querySelector('#part-photo-input')?.click();
    });
    content.querySelector('#part-photo-input')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      kepFeltolt(categoryId, partId, file, () => { openPartModal(categoryId, partId); render(); });
    });
    content.querySelector('[data-action="remove-photo"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd a képet erről az alkatrészről?')) return;
      kepTorol(categoryId, partId, () => { openPartModal(categoryId, partId); render(); });
    });
    content.querySelector('[data-action="delete-part"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt az alkatrészt?')) return;
      window.DataLayer.raktarDeletePart(categoryId, partId);
      window.AppModal.close();
    });
    content.querySelector('[data-action="add-link"]')?.addEventListener('click', () => {
      window.AppKerdes.szoveg({
        cim: 'Beszerzési link',
        leiras: 'Hol lehet megvenni ezt az alkatrészt? Illeszd be a webcímet.',
        hely: 'https://...'
      }).then((url) => {
        if (url === null || !url.trim()) return;
        window.DataLayer.raktarAddPartLink(categoryId, partId, url.trim())
          .then(() => openPartModal(categoryId, partId));
      });
    });
    content.querySelectorAll('[data-action="remove-link"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        window.DataLayer.raktarRemovePartLink(categoryId, partId, e.target.dataset.link).then(() => openPartModal(categoryId, partId));
      });
    });
  }

  function renderDetailScreen(root) {
    if (activeCategoryId === '__missing__') {
      const missing = collectMissingParts();
      root.innerHTML = `
        <div class="category-detail-head">
          <span style="font-family:var(--font-display);font-weight:700;font-size:22px;color:var(--warn);">⚠️ Hiányzó alkatrészek</span>
        </div>
        <div class="card-grid">
          ${missing.map(({ categoryId, categoryTitle, partId, part }) => `
            <div class="record-card-tile" data-open-cat="${categoryId}" data-open-part="${partId}" style="border-top:3px solid var(--warn);">
              <div class="part-thumb-row">
                ${kepMarkup(categoryId, partId)}
                <div class="rct-title" style="margin:0;">${escapeHtml(part.name)}</div>
              </div>
              <div class="rct-meta">
                Kategória: ${escapeHtml(categoryTitle)}<br>
                <span class="cost-line warn-part">Van: ${part.qty_van ?? 0} db · Kell: ${part.qty_kell ?? 0} db</span>
              </div>
            </div>
          `).join('') || '<p class="empty-state">Nincs hiányzó tétel.</p>'}
        </div>
      `;
      root.querySelectorAll('[data-open-part]').forEach((el) => {
        el.addEventListener('click', () => openPartModal(el.dataset.openCat, el.dataset.openPart));
      });
      return;
    }

    const cat = raktarData[activeCategoryId];
    if (!cat) { screen = 'list'; return renderListScreen(root); }

    const parts = Object.entries(cat.parts || {}).filter(([, p]) => partMatchesSearch(p));

    root.innerHTML = `
      <div class="category-detail-head">
        <input class="cat-title-input" data-action="rename-cat" value="${escapeHtml(cat.title)}" />
        <select class="cat-type-select" data-action="retype-cat">
          ${Object.entries(TYPE_LABELS).map(([val, label]) =>
            `<option value="${val}" ${cat.type === val ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button class="btn-tiny btn-danger" data-action="delete-cat">Kategória törlése</button>
      </div>
      <div class="toolbar" style="margin-bottom:18px;">
        <input id="raktar-search-detail" class="search-input"
               placeholder="Keresés ezen a kategórián belül (név, cikkszám, megjegyzés)…"
               value="${escapeHtml(searchTerm)}" />
        ${searchTerm ? `<span style="font-size:12.5px;color:var(--text-dim);align-self:center;">${parts.length} találat / ${Object.keys(cat.parts || {}).length} alkatrész</span>` : ''}
      </div>
      <div class="card-grid">
        ${parts.map(([partId, part]) => renderPartTile(activeCategoryId, partId, part)).join('')
          || (searchTerm
              ? '<p class="empty-state">Nincs találat ebben a kategóriában erre a keresésre.</p>'
              : '<p class="empty-state">Nincs még alkatrész ebben a kategóriában.</p>')}
      </div>
      <button class="btn-secondary" data-action="add-part">+ Új alkatrész</button>
    `;

    document.getElementById('raktar-search-detail')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('raktar-search-detail');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    root.querySelector('[data-action="rename-cat"]')?.addEventListener('change', (e) => {
      window.DataLayer.raktarUpdateCategory(activeCategoryId, { title: e.target.value });
    });
    root.querySelector('[data-action="retype-cat"]')?.addEventListener('change', (e) => {
      window.DataLayer.raktarUpdateCategory(activeCategoryId, { type: e.target.value });
    });
    root.querySelector('[data-action="delete-cat"]')?.addEventListener('click', () => {
      if (!confirm('Biztosan törlöd ezt a kategóriát és az összes benne lévő alkatrészt?')) return;
      window.DataLayer.raktarDeleteCategory(activeCategoryId);
      screen = 'list';
      render();
      window.AppAnim?.ujra();
    });
    root.querySelector('[data-action="add-part"]')?.addEventListener('click', () => {
      window.DataLayer.raktarAddPart(activeCategoryId, { name: 'Új alkatrész', price: 0, qty_van: 0, qty_kell: 0 })
        .then((partId) => openPartModal(activeCategoryId, partId));
    });
    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => openPartModal(activeCategoryId, el.dataset.open));
    });
  }

  function render() {
    const root = document.getElementById('module-body-raktar');
    if (!root) return;
    if (screen === 'detail') renderDetailScreen(root);
    else renderListScreen(root);
    // A most kirajzolt kártyák képeit lekérjük (csak amit még nem ismerünk)
    root.querySelectorAll('[data-kep-slot]').forEach((el) => {
      const [katId, partId] = el.dataset.kepSlot.split('/');
      kepBetolt(katId, partId);
    });
  }

  function initRaktarModule() {
    window.DataLayer.watchRaktar((data) => {
      raktarData = data || {};
      window.RenderGuard.rajzol(render, 'raktar');
      window.DashboardStats?.refresh();
    });
  }

  // A főoldali kártyához: egy kiemelt szám, egy kiegészítő sor és
  // legfeljebb egy figyelmeztetés.
  function getDashboardInfo() {
    const categories = Object.values(raktarData);
    if (!categories.length) return null;
    let parts = 0, missing = 0;
    categories.forEach((cat) => {
      const list = Object.values(cat.parts || {});
      parts += list.length;
      missing += list.filter((p) => Number(p.qty_kell || 0) > Number(p.qty_van || 0)).length;
    });
    return {
      szam: parts,
      egyseg: 'alkatrész',
      mellek: `${categories.length} kategóriában`,
      figyelem: missing > 0 ? { szoveg: `${missing} alkatrész fogytán`, suly: 'sarga' } : null
    };
  }

  function getDashboardStat() {
    const categories = Object.values(raktarData);
    if (categories.length === 0) return '<span class="dash-card-stat muted">még nincs adat</span>';
    let parts = 0, missing = 0;
    categories.forEach((cat) => {
      const list = Object.values(cat.parts || {});
      parts += list.length;
      missing += list.filter((p) => Number(p.qty_kell || 0) > Number(p.qty_van || 0)).length;
    });
    return `<span class="dash-card-stat">${categories.length} kategória · ${parts} tétel${missing > 0 ? ` · <span style="color:var(--warn)">${missing} hiányzó</span>` : ''}</span>`;
  }

  // A nyitóképernyőre: hiányzó alkatrészek
  function getFigyelmeztetes() {
    let missing = 0;
    Object.values(raktarData).forEach((cat) => {
      missing += Object.values(cat.parts || {})
        .filter((p) => Number(p.qty_kell || 0) > Number(p.qty_van || 0)).length;
    });
    if (missing > 0) {
      return { modul: 'raktar', ikon: '📦', suly: 'suly-sarga',
               szoveg: `${missing} alkatrészből kevesebb van, mint kellene` };
    }
    return null;
  }

  window.RaktarModule = { init: initRaktarModule, getFigyelmeztetes, getDashboardInfo };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.raktar = {
    isDetail: () => screen === 'detail',
    goToList: () => { screen = 'list'; render(); window.AppAnim?.ujra(); },
    getDashboardStat,
    getDashboardInfo
  };
})();



