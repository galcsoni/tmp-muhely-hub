(function () {
  const MODULES = [
    { id: 'raktar', label: 'Raktár', icon: '📦', ready: true, szin: '#9C6B3F' },
    { id: 'javitas', label: 'Javítás', icon: '🛠️', ready: true, szin: '#B0672E' },
    { id: 'kolcsonzes', label: 'Kölcsönzés', icon: '📋', ready: true, szin: '#5B7F99' },
    { id: 'arajanlat', label: 'Árajánlat', icon: '🧾', ready: true, szin: '#7A5B8F' },
    { id: 'rendelesek', label: 'Rendelések', icon: '📊', ready: true, szin: '#6B7A63' },
    { id: 'todo', label: 'TO-DO', icon: '✅', ready: true, szin: '#6B8F5E' },
    { id: 'dokumentumok', label: 'Dokumentumok', icon: '📂', ready: true, szin: '#9C6B3F' },
    { id: 'mentesek', label: 'Mentések', icon: '💾', ready: true, szin: '#B0453A' }
  ];

  let currentView = 'kezdolap';

  // ── NYITÓKÉPERNYŐ ──────────────────────────────────────────────────────
  // Ez fogad indításkor: nagy logó, élő óra, és a legfontosabb figyelmeztetések.
  // Innen egy gombbal lehet belépni a modulválasztóra.
  const NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június',
                   'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  let oraTimer = null;

  function koszones() {
    const h = new Date().getHours();
    if (h < 5) return 'Még mindig fent?';
    if (h < 10) return 'Jó reggelt!';
    if (h < 18) return 'Szép napot!';
    if (h < 22) return 'Jó estét!';
    return 'Jó estét!';
  }

  // Összeszedjük, mi kíván figyelmet - ezek jelennek meg a nyitóképernyőn
  function figyelmeztetesek() {
    const out = [];
    const jav = window.JavitasModule?.getFigyelmeztetes?.();
    if (jav) out.push(jav);
    const todo = window.TodoModule?.getFigyelmeztetes?.();
    if (todo) out.push(todo);
    const raktar = window.RaktarModule?.getFigyelmeztetes?.();
    if (raktar) out.push(raktar);
    const mentes = window.MentesekModule?.getFigyelmeztetes?.();
    if (mentes) out.push(mentes);
    return out;
  }

  function oratFrissit() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const ora = document.getElementById('kezdolap-ora');
    const datum = document.getElementById('kezdolap-datum');
    if (ora) ora.textContent = `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (datum) datum.textContent = `${d.getFullYear()}. ${HONAPOK[d.getMonth()]} ${d.getDate()}. · ${NAPOK[d.getDay()]}`;
  }

  function renderKezdolap() {
    const root = document.getElementById('view-kezdolap');
    if (!root) return;
    const fig = figyelmeztetesek();

    root.innerHTML = `
      <div class="kezdolap">
        <div class="kezdolap-fent">
          <img class="kezdolap-logo" src="${window.TMP_LOGO || ''}" alt="TMP" />
          <h1 class="kezdolap-cim">Műhely Hub</h1>
          <p class="kezdolap-alcim">Raktár · Javítás · Rendelések · Kölcsönzés · Árajánlat</p>
        </div>

        <div class="kezdolap-ora-blokk">
          <div class="kezdolap-ora" id="kezdolap-ora">--:--</div>
          <div class="kezdolap-datum" id="kezdolap-datum"></div>
          <div class="kezdolap-koszones">${koszones()}</div>
        </div>

        ${fig.length ? `
          <div class="kezdolap-figyelem">
            ${fig.map((f) => `
              <button class="figyelem-chip ${f.suly}" data-goto="${f.modul}">
                <span class="figyelem-ikon">${f.ikon}</span>
                <span>${f.szoveg}</span>
              </button>
            `).join('')}
          </div>
        ` : '<p class="kezdolap-rendben">Minden rendben, nincs sürgős teendő.</p>'}

        <button class="kezdolap-belepes" id="kezdolap-belepes">
          <span>Belépés a műhelybe</span>
          <span class="kezdolap-nyil">→</span>
        </button>

        <p class="easter-egg" id="easter-egg" title="…">unatkozom</p>
      </div>
    `;

    oratFrissit();
    if (oraTimer) clearInterval(oraTimer);
    oraTimer = setInterval(oratFrissit, 10000);

    document.getElementById('kezdolap-belepes')?.addEventListener('click', () => navigateTo('dashboard'));
    root.querySelectorAll('[data-goto]').forEach((el) => {
      el.addEventListener('click', () => navigateTo(el.dataset.goto));
    });
    document.getElementById('easter-egg')?.addEventListener('click', () => window.JatekMenu?.open());
  }

  function renderDashboard() {
    const root = document.getElementById('view-dashboard');
    root.innerHTML = `
      <p class="dash-title">Válassz modult</p>
      <div class="dash-grid">
        ${MODULES.map((m) => `
          <div class="dash-card ${m.ready ? '' : 'disabled'}" data-goto="${m.id}">
            ${m.ready ? '' : '<span class="dash-card-soon">hamarosan</span>'}
            <span class="dash-card-icon">${m.icon}</span>
            <div class="dash-card-title">${m.label}</div>
            ${m.ready && window.ModuleNav[m.id]
              ? window.ModuleNav[m.id].getDashboardStat()
              : '<span class="dash-card-stat muted">hamarosan</span>'}
          </div>
        `).join('')}
      </div>
    `;
    root.querySelectorAll('.dash-card:not(.disabled)').forEach((el) => {
      el.addEventListener('click', () => navigateTo(el.dataset.goto));
    });
  }

  // A belépő animációt csak váltáskor játsszuk le, nem minden újrarajzoláskor -
  // különben a Firebase frissítéseknél folyton villogna.
  function belepoAnimacio(viewId) {
    const el = document.getElementById(`view-${viewId}`);
    if (!el) return;
    el.classList.remove('belep');
    void el.offsetWidth;            // újraindítja az animációt
    el.classList.add('belep');
    clearTimeout(el._belepTimer);
    el._belepTimer = setTimeout(() => el.classList.remove('belep'), 1100);
  }

  // A modulok is hívhatják, amikor almenübe lépnek vagy visszajönnek
  window.AppAnim = {
    ujra: (viewId) => belepoAnimacio(viewId || currentView)
  };

  function navigateTo(viewId) {
    const valtas = currentView !== viewId;
    currentView = viewId;
    document.querySelectorAll('.view').forEach((el) => {
      el.classList.toggle('active', el.id === `view-${viewId}`);
    });
    document.getElementById('back-btn').classList.toggle('visible', viewId !== 'kezdolap');
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'kezdolap') renderKezdolap();
    if (valtas) belepoAnimacio(viewId);
  }

  function renderViews() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div id="view-kezdolap" class="view active"></div>
      <div id="view-dashboard" class="view"></div>
      ${MODULES.map((m) => `
        <div id="view-${m.id}" class="view">
          ${m.ready ? `
            <div class="module-head" style="--mszin:${m.szin};">
              <span class="module-icon-kor">
                <svg class="module-gyuru" viewBox="0 0 48 48" aria-hidden="true">
                  <circle class="module-gyuru-alap" cx="24" cy="24" r="21" />
                  <circle class="module-gyuru-rajz" cx="24" cy="24" r="21" />
                </svg>
                <span class="module-icon">${m.icon}</span>
              </span>
              <h2>${m.label}</h2>
              <span class="module-vonal"></span>
            </div>
            <div id="module-body-${m.id}"></div>
          ` : `<p class="placeholder-text">Ez a modul hamarosan érkezik.</p>`}
        </div>
      `).join('')}
    `;
  }

  function initConnectionIndicator() {
    const dot = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    window.DataLayer.onConnectionState((online) => {
      dot.classList.toggle('online', online);
      dot.classList.toggle('offline', !online);
      label.textContent = online ? 'Kapcsolódva' : 'Nincs kapcsolat';
    });
  }

  function initAppInfo() {
    if (window.nativeApp) {
      window.nativeApp.getInfo().then((info) => {
        if (info.ok) {
          document.getElementById('app-version').textContent = `v${info.version} · ${info.platformLabel}`;
        }
      });
    }
  }

  window.DashboardStats = {
    refresh: () => {
      if (currentView === 'dashboard') renderDashboard();
      if (currentView === 'kezdolap') renderKezdolap();
    }
  };

  // ── Popup modal - bármelyik modul használhatja egy tétel megnyitására ──
  function ensureModalBackdrop() {
    let backdrop = document.getElementById('app-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'app-modal-backdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-panel">
          <button class="modal-close" id="app-modal-close-btn">×</button>
          <div id="app-modal-content"></div>
        </div>
      `;
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) window.AppModal.close(); });
      document.getElementById('app-modal-close-btn').addEventListener('click', () => window.AppModal.close());
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.AppModal.close(); });
    }
    return backdrop;
  }

  window.AppModal = {
    open(html) {
      const backdrop = ensureModalBackdrop();
      const content = document.getElementById('app-modal-content');
      content.innerHTML = html;
      backdrop.style.display = 'flex';
      backdrop.scrollTop = 0;
      return content;
    },
    close() {
      const backdrop = document.getElementById('app-modal-backdrop');
      if (backdrop) backdrop.style.display = 'none';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderViews();
    renderKezdolap();
    initConnectionIndicator();
    initAppInfo();
    window.RaktarModule.init();
    window.JavitasModule.init();
    window.RendelesekModule.init();
    window.KolcsonzesModule.init();
    window.ArajanlatModule.init();
    window.TodoModule.init();
    window.DokumentumokModule.init();
    window.MentesekModule.init();

    document.getElementById('back-btn').addEventListener('click', () => {
      const nav = window.ModuleNav[currentView];
      if (nav && nav.isDetail()) {
        nav.goToList();
        return;
      }
      navigateTo(currentView === 'dashboard' ? 'kezdolap' : 'dashboard');
    });
    document.getElementById('brand-btn').addEventListener('click', () => navigateTo('kezdolap'));
  });
})();



