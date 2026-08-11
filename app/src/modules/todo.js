// ─────────────────────────────────────────────────────────────────────────
// TO-DO modul
// Szekciók (személyek/témák: Bon, Tompika, stb.) kártyaként, bennük
// feladatok folyamat-státusszal:
//   Ötlet → Fontos → Folyamatban → Várakozik → Kész
// A szekción belül a feladatok vagy FOLYAMAT szerint, vagy HOZZÁADÁS
// DÁTUMA szerint vannak elkülönítve (mint az árajánlatoknál).
// Lejárt határidejű, nem kész feladat pirossal kiemelve.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const STATUSES = ['Ötlet', 'Fontos', 'Folyamatban', 'Várakozik', 'Kész'];
  const STATUS_COLORS = {
    'Ötlet': '#5B7F99',
    'Fontos': '#B0453A',
    'Folyamatban': '#B0672E',
    'Várakozik': '#A8A098',
    'Kész': '#6B8F5E'
  };
  const STATUS_HINT = {
    'Ötlet': 'bedobott javaslat, még nincs eldöntve',
    'Fontos': 'sürgős, ezzel kell kezdeni',
    'Folyamatban': 'már dolgozik rajta valaki',
    'Várakozik': 'másra vár (alkatrész, válasz, stb.)',
    'Kész': 'lezárva'
  };

  let data = {};
  let searchTerm = '';
  let statusFilter = 'aktiv';   // 'aktiv' (nem kész), 'osszes', vagy konkrét státusz
  let groupBy = 'status';       // 'status' vagy 'date'
  let screen = 'list';
  let activeSectionId = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function dayOf(t) {
    if (t.createdAt) return new Date(t.createdAt).toISOString().slice(0, 10);
    return 'Dátum nélkül';
  }

  function dayLabel(day) {
    if (day === 'Dátum nélkül') return day;
    const d = today();
    if (day === d) return `${day} · ma`;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (day === y) return `${day} · tegnap`;
    return day;
  }

  function isOverdue(t) {
    return t.dueDate && t.dueDate < today() && t.status !== 'Kész';
  }

  function matchesSearch(t) {
    if (!searchTerm) return true;
    return (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
  }

  function matchesStatusFilter(t) {
    if (statusFilter === 'osszes') return true;
    if (statusFilter === 'aktiv') return t.status !== 'Kész';
    return t.status === statusFilter;
  }

  function sectionStats(section) {
    const tasks = Object.values(section.tasks || {});
    const open = tasks.filter((t) => t.status !== 'Kész');
    return {
      total: tasks.length,
      open: open.length,
      otlet: open.filter((t) => t.status === 'Ötlet').length,
      fontos: open.filter((t) => t.status === 'Fontos').length,
      folyamatban: open.filter((t) => t.status === 'Folyamatban').length,
      overdue: tasks.filter(isOverdue).length
    };
  }

  // ── LISTA NÉZET: szekció-kártyák ──────────────────────────────────────
  function renderListScreen(root) {
    const entries = Object.entries(data).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

    root.innerHTML = `
      <div class="toolbar">
        <input id="todo-search" class="search-input" placeholder="Keresés feladat szövege szerint…" value="${escapeHtml(searchTerm)}" />
        <button id="todo-add-section" class="btn-primary">+ Új szekció</button>
        ${entries.length === 0 ? '<button id="todo-migrate" class="btn-secondary">Régi TO-DO átemelése</button>' : ''}
      </div>
      <p class="grid-title">Szekciók</p>
      <div class="card-grid">
        ${entries.map(([id, section]) => {
          const s = sectionStats(section);
          const parts = [];
          if (s.overdue > 0) parts.push(`<span style="color:var(--danger);font-weight:600;">${s.overdue} lejárt</span>`);
          if (s.fontos > 0) parts.push(`<span style="color:${STATUS_COLORS['Fontos']};font-weight:600;">${s.fontos} fontos</span>`);
          if (s.folyamatban > 0) parts.push(`<span style="color:${STATUS_COLORS['Folyamatban']};">${s.folyamatban} folyamatban</span>`);
          if (s.otlet > 0) parts.push(`<span style="color:${STATUS_COLORS['Ötlet']};">${s.otlet} ötlet</span>`);
          return `
            <div class="category-card-tile" data-open="${id}">
              <span class="cat-type-tag">${s.open} nyitott / ${s.total} összes</span>
              <div class="cat-name">${escapeHtml(section.name)}</div>
              <div class="cat-stat">${parts.join(' · ') || (s.open === 0 ? 'minden kész ✓' : 'nincs sürgős teendő')}</div>
            </div>
          `;
        }).join('') || '<p class="empty-state">Nincs még szekció. Hozz létre egyet, vagy emeld át a régieket.</p>'}
      </div>
    `;

    document.getElementById('todo-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      searchTerm = e.target.value;
      render();
      const input = document.getElementById('todo-search');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });
    document.getElementById('todo-add-section')?.addEventListener('click', () => {
      const name = prompt('Szekció neve (pl. egy név vagy téma):');
      if (name === null || !name.trim()) return;
      window.DataLayer.todoSectionAdd(name.trim());
    });
    document.getElementById('todo-migrate')?.addEventListener('click', () => {
      if (!confirm('Átemeli a régi TO-DO szekciókat és feladatokat. A régi "Kész" gyűjtőben lévő feladatok visszakerülnek az eredeti szekciójukba, kész jelöléssel. Folytatod?')) return;
      window.DataLayer.migrateTodoFromOld().then((count) => {
        alert(`Kész! ${count} szekció átemelve.`);
      }).catch((err) => alert('Hiba: ' + err.message));
    });
    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        activeSectionId = el.dataset.open;
        screen = 'detail';
        render();
        window.AppAnim?.ujra();
      });
    });
  }

  // ── FELADAT-KÁRTYA ────────────────────────────────────────────────────
  function renderTaskTile(taskId, t) {
    const color = STATUS_COLORS[t.status] || 'var(--border-light)';
    const overdue = isOverdue(t);
    const added = dayOf(t);
    return `
      <div class="record-card-tile" data-open-task="${taskId}" style="border-top:3px solid ${overdue ? 'var(--danger)' : color};${t.status === 'Kész' ? 'opacity:0.6;' : ''}">
        <span class="cat-type-tag" style="border-color:${color};color:${color};">${escapeHtml(t.status || 'Ötlet')}</span>
        <div class="rct-title" style="${t.status === 'Kész' ? 'text-decoration:line-through;' : ''}">${escapeHtml(t.description || 'Üres feladat')}</div>
        <div class="todo-card-dates">
          <span class="added">Hozzáadva: ${escapeHtml(added)}</span><br />
          ${t.dueDate
            ? `Határidő: <span class="${overdue ? 'due-warn' : ''}">${escapeHtml(t.dueDate)}${overdue ? ' ⚠️ lejárt' : ''}</span>`
            : '<span class="added">nincs határidő</span>'}
        </div>
        <select class="rct-move" data-move="${taskId}">
          ${STATUSES.map((s) => `<option value="${s}" ${s === t.status ? 'selected' : ''}>→ ${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  // ── POPUP ─────────────────────────────────────────────────────────────
  function openTaskModal(taskId) {
    const section = data[activeSectionId];
    const t = section?.tasks?.[taskId];
    if (!t) return;
    const color = STATUS_COLORS[t.status] || 'var(--border-light)';

    const html = `
      <div class="repair-detail-header" style="margin-bottom:18px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;flex:1;">Feladat - ${escapeHtml(section.name)}</span>
        <select class="status-badge-select" data-field="status" style="border-color:${color};color:${color};">
          ${STATUSES.map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn-tiny btn-danger" data-action="delete">Törlés</button>
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin:-8px 0 16px;">${escapeHtml(STATUS_HINT[t.status] || '')}</p>
      <div class="detail-fields-card">
        <span class="field-label">Feladat leírása</span>
        <textarea class="note-input" data-field="description" rows="4" style="width:100%;margin-bottom:16px;">${escapeHtml(t.description)}</textarea>
        <div class="field-grid">
          <div><span class="field-label">Határidő</span><input class="cell-input" type="date" data-field="dueDate" value="${escapeHtml(t.dueDate)}" /></div>
          <div><span class="field-label">Hozzáadva</span><input class="cell-input" value="${escapeHtml(dayOf(t))}" disabled style="color:var(--text-dim);" /></div>
        </div>
      </div>
    `;

    const content = window.AppModal.open(html);
    content.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const patch = { [field]: e.target.value };
        if (field === 'status' && e.target.value === 'Kész') patch.completedAt = Date.now();
        window.DataLayer.todoTaskUpdate(activeSectionId, taskId, patch);
        if (field === 'status') window.AppModal.close();
      });
    });
    content.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a feladatot?')) return;
      window.DataLayer.todoTaskDelete(activeSectionId, taskId);
      window.AppModal.close();
    });
  }

  // ── RÉSZLETNÉZET ──────────────────────────────────────────────────────
  function taskSort(a, b) {
    const ao = isOverdue(a[1]) ? 0 : 1;
    const bo = isOverdue(b[1]) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (a[1].dueDate && b[1].dueDate) return a[1].dueDate.localeCompare(b[1].dueDate);
    if (a[1].dueDate) return -1;
    if (b[1].dueDate) return 1;
    return (b[1].createdAt || 0) - (a[1].createdAt || 0);
  }

  function renderGroupsByStatus(tasks) {
    return STATUSES.map((s) => {
      const items = tasks.filter(([, t]) => (t.status || 'Ötlet') === s);
      if (!items.length) return '';
      const c = STATUS_COLORS[s];
      return `
        <div class="todo-group" style="--gc:${c};">
          <div class="todo-group-head">
            <span class="todo-group-dot"></span>
            <span class="todo-group-name">${s}</span>
            <span class="todo-group-count">${items.length} db · ${STATUS_HINT[s]}</span>
          </div>
          <div class="card-grid">${items.map(([id, t]) => renderTaskTile(id, t)).join('')}</div>
        </div>
      `;
    }).join('');
  }

  function renderGroupsByDate(tasks) {
    const groups = [];
    tasks.slice().sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0)).forEach(([id, t]) => {
      const day = dayOf(t);
      let g = groups.find((x) => x.day === day);
      if (!g) { g = { day, items: [] }; groups.push(g); }
      g.items.push([id, t]);
    });
    return groups.map((g) => `
      <div class="todo-group" style="--gc:var(--border-light);">
        <div class="todo-group-head">
          <span class="todo-group-dot"></span>
          <span class="todo-group-name" style="color:var(--text-secondary);">${escapeHtml(dayLabel(g.day))}</span>
          <span class="todo-group-count">${g.items.length} db</span>
        </div>
        <div class="card-grid">${g.items.map(([id, t]) => renderTaskTile(id, t)).join('')}</div>
      </div>
    `).join('');
  }

  function renderDetailScreen(root) {
    const section = data[activeSectionId];
    if (!section) { screen = 'list'; return renderListScreen(root); }

    const tasks = Object.entries(section.tasks || {})
      .filter(([, t]) => matchesSearch(t) && matchesStatusFilter(t))
      .sort(taskSort);

    const body = tasks.length
      ? (groupBy === 'date' ? renderGroupsByDate(tasks) : renderGroupsByStatus(tasks))
      : '<p class="empty-state">Nincs ilyen feladat ebben a szekcióban.</p>';

    root.innerHTML = `
      <div class="category-detail-head">
        <input class="cat-title-input" data-action="rename" value="${escapeHtml(section.name)}" style="font-family:var(--font-display);font-weight:700;font-size:22px;flex:0 1 auto;width:auto;" />
        <select id="todo-group-by" class="cat-type-select">
          <option value="status" ${groupBy === 'status' ? 'selected' : ''}>Folyamat szerint</option>
          <option value="date" ${groupBy === 'date' ? 'selected' : ''}>Hozzáadás dátuma szerint</option>
        </select>
        <select id="todo-status-filter" class="cat-type-select">
          <option value="aktiv" ${statusFilter === 'aktiv' ? 'selected' : ''}>Aktív (nem kész)</option>
          <option value="osszes" ${statusFilter === 'osszes' ? 'selected' : ''}>Összes</option>
          ${STATUSES.map((s) => `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn-secondary" id="todo-add-idea" style="margin-top:0;border-color:${STATUS_COLORS['Ötlet']};color:${STATUS_COLORS['Ötlet']};">💡 Ötlet bedobása</button>
        <button class="btn-primary" id="todo-add-task" style="margin-top:0;">+ Új feladat</button>
        <button class="btn-tiny btn-danger" data-action="delete-section">Szekció törlése</button>
      </div>
      ${body}
    `;

    root.querySelector('[data-action="rename"]')?.addEventListener('change', (e) => {
      window.DataLayer.todoSectionUpdate(activeSectionId, { name: e.target.value });
    });
    document.getElementById('todo-group-by')?.addEventListener('change', (e) => {
      groupBy = e.target.value;
      render();
    });
    document.getElementById('todo-status-filter')?.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      render();
    });
    document.getElementById('todo-add-task')?.addEventListener('click', () => {
      window.DataLayer.todoTaskAdd(activeSectionId, { status: 'Fontos' }).then((taskId) => {
        render();
        openTaskModal(taskId);
      });
    });
    document.getElementById('todo-add-idea')?.addEventListener('click', () => {
      const text = prompt('Mi az ötlet? (később bármikor átminősíthető feladattá)');
      if (text === null || !text.trim()) return;
      window.DataLayer.todoTaskAdd(activeSectionId, { status: 'Ötlet', description: text.trim() });
    });
    root.querySelector('[data-action="delete-section"]')?.addEventListener('click', () => {
      if (!confirm('Biztosan törlöd ezt a szekciót az összes feladatával együtt?')) return;
      window.DataLayer.todoSectionDelete(activeSectionId);
      screen = 'list';
      render();
      window.AppAnim?.ujra();
    });
    root.querySelectorAll('[data-open-task]').forEach((el) => {
      el.addEventListener('click', () => openTaskModal(el.dataset.openTask));
    });
    root.querySelectorAll('[data-move]').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation());
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        const patch = { status: e.target.value };
        if (e.target.value === 'Kész') patch.completedAt = Date.now();
        window.DataLayer.todoTaskUpdate(activeSectionId, e.target.dataset.move, patch);
      });
    });
  }

  function render() {
    const root = document.getElementById('module-body-todo');
    if (!root) return;
    if (screen === 'detail') renderDetailScreen(root);
    else renderListScreen(root);
  }

  function getDashboardStat() {
    let open = 0, fontos = 0, overdue = 0, otlet = 0;
    Object.values(data).forEach((section) => {
      Object.values(section.tasks || {}).forEach((t) => {
        if (t.status !== 'Kész') open += 1;
        if (t.status === 'Fontos') fontos += 1;
        if (t.status === 'Ötlet') otlet += 1;
        if (isOverdue(t)) overdue += 1;
      });
    });
    if (open === 0 && Object.keys(data).length === 0) return '<span class="dash-card-stat muted">még nincs adat</span>';
    const parts = [`${open} nyitott`];
    if (overdue > 0) parts.push(`<span style="color:var(--danger)">${overdue} lejárt</span>`);
    if (fontos > 0) parts.push(`<span style="color:${STATUS_COLORS['Fontos']}">${fontos} fontos</span>`);
    if (otlet > 0) parts.push(`<span style="color:${STATUS_COLORS['Ötlet']}">${otlet} ötlet</span>`);
    return `<span class="dash-card-stat">${parts.join(' · ')}</span>`;
  }

  function init() {
    window.DataLayer.watchTodo((d) => {
      data = d || {};
      render();
      window.DashboardStats?.refresh();
    });
  }

  
  // A nyitóképernyőre: lejárt vagy fontos teendők
  function getFigyelmeztetes() {
    let lejart = 0, fontos = 0;
    Object.values(data).forEach((section) => {
      Object.values(section.tasks || {}).forEach((t) => {
        if (isOverdue(t)) lejart += 1;
        else if (t.status === 'Fontos') fontos += 1;
      });
    });
    if (lejart > 0) {
      return { modul: 'todo', ikon: '⏰', suly: 'suly-piros',
               szoveg: `${lejart} teendő határideje lejárt` };
    }
    if (fontos > 0) {
      return { modul: 'todo', ikon: '❗', suly: 'suly-sarga',
               szoveg: `${fontos} fontos teendő vár rád` };
    }
    return null;
  }

window.TodoModule = { init, getFigyelmeztetes };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.todo = {
    isDetail: () => screen === 'detail',
    goToList: () => { screen = 'list'; render(); window.AppAnim?.ujra(); },
    getDashboardStat
  };
})();
