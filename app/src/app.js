(function () {
  const MODULES = [
    { id: 'raktar', label: 'Raktár', icon: '📦', ready: true, szin: '#9C6B3F',
      alcim: 'Alkatrészek és készlet', csoport: 'muhely' },
    { id: 'javitas', label: 'Javítás', icon: '🛠️', ready: true, szin: '#B0672E',
      alcim: 'Szervizben lévő készülékek', csoport: 'muhely' },
    { id: 'katalogus', label: 'Katalógus', icon: '🔧', ready: true, szin: '#7E5430',
      alcim: 'Termékek és összeszerelés', csoport: 'muhely' },

    { id: 'arajanlat', label: 'Árajánlat', icon: '🧾', ready: true, szin: '#7A5B8F',
      alcim: 'Ajánlatok készítése', csoport: 'uzlet' },
    { id: 'rendelesek', label: 'Rendelések', icon: '📊', ready: true, szin: '#6B7A63',
      alcim: 'Beszerzés nyomon követése', csoport: 'uzlet' },
    { id: 'kolcsonzes', label: 'Kölcsönzés', icon: '📋', ready: true, szin: '#5B7F99',
      alcim: 'Kiadott eszközök', csoport: 'uzlet' },

    { id: 'todo', label: 'TO-DO', icon: '✅', ready: true, szin: '#6B8F5E',
      alcim: 'Teendők és ötletek', csoport: 'szervezes' },
    { id: 'dokumentumok', label: 'Dokumentumok', icon: '📂', ready: true, szin: '#9C6B3F',
      alcim: 'Linkek és jegyzetek', csoport: 'szervezes' },
    { id: 'mentesek', label: 'Mentések', icon: '💾', ready: true, szin: '#B0453A',
      alcim: 'Biztonsági mentés', csoport: 'szervezes' }
  ];

  const CSOPORTOK = [
    { id: 'muhely', cim: 'Műhely' },
    { id: 'uzlet', cim: 'Üzlet' },
    { id: 'szervezes', cim: 'Szervezés' }
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

  // A modulkártya alakja a TMP logó kontúrja. A formát SVG rajzolja, mert
  // a lecsapott alj miatt sima CSS-kerettel nem lenne megoldható. Minden
  // kártya azonos arányú (778:492), így a forma mindenhol egyforma.
  const PAJZS_PATH =
    'M 54,6 H 724 Q 772,6 772,54 V 348 L 404,482 Q 389,489 374,482 L 6,348 V 54 Q 6,6 54,6 Z';

  function dashKartya(m) {
    const nav = m.ready ? window.ModuleNav[m.id] : null;
    const betoltve = !m.ready || !!nav;
    const info = nav && nav.getDashboardInfo ? nav.getDashboardInfo() : null;
    const tiltott = !m.ready || !betoltve;

    let torzs;
    if (!m.ready) {
      torzs = '<span class="pk-ures">hamarosan</span>';
    } else if (!nav) {
      torzs = '<span class="pk-ures">nincs betöltve</span>';
    } else if (info) {
      torzs = `
        <span class="pk-ertek">
          <span class="pk-szam">${info.szam}</span>
          <span class="pk-egyseg">${info.egyseg}</span>
        </span>
        ${info.mellek ? `<span class="pk-mellek">${info.mellek}</span>` : ''}
        ${info.figyelem ? `
          <span class="pk-figyelem ${info.figyelem.suly}">
            <span class="pk-pont"></span>${info.figyelem.szoveg}
          </span>` : ''}
      `;
    } else if (nav.getDashboardStat) {
      torzs = `<span class="pk-mellek">${nav.getDashboardStat()}</span>`;
    } else {
      torzs = '<span class="pk-ures">még nincs adat</span>';
    }

    return `
      <button class="pajzs-kartya ${tiltott ? 'disabled' : ''}"
              data-goto="${m.id}" style="--mszin:${m.szin};" ${tiltott ? 'disabled' : ''}>
        <svg class="pk-alak" viewBox="0 0 778 492" preserveAspectRatio="none" aria-hidden="true">
          <path d="${PAJZS_PATH}" />
        </svg>
        <span class="pk-tartalom">
          <span class="pk-fejlec">
            <span class="pk-ikon">${m.icon}</span>
            <span class="pk-nevek">
              <span class="pk-nev">${m.label}</span>
              ${m.alcim ? `<span class="pk-alcim">${m.alcim}</span>` : ''}
            </span>
          </span>
          ${torzs}
        </span>
      </button>
    `;
  }

  function renderDashboard() {
    const root = document.getElementById('view-dashboard');
    // A csoport neve oldalt áll, a hozzá tartozó modulok mellette sorakoznak.
    root.innerHTML = `<div class="dash-oldal">` + CSOPORTOK.map((cs) => {
      const tagok = MODULES.filter((m) => m.csoport === cs.id);
      if (!tagok.length) return '';
      return `
        <section class="dash-csoport">
          <div class="dash-csoport-fej">
            <h2 class="dash-csoport-cim">${cs.cim}</h2>
            <span class="dash-csoport-vonal"></span>
          </div>
          <div class="dash-grid">${tagok.map(dashKartya).join('')}</div>
        </section>
      `;
    }).join('') + `</div>`;

    root.querySelectorAll('.pajzs-kartya:not(.disabled)').forEach((el) => {
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

  // ── Saját beviteli és megerősítő ablakok ──────────────────────────────
  // Az Electron nem támogatja a böngészős window.prompt()-ot: az asztali
  // appban egyszerűen nem jelenik meg semmi. Ezért saját ablakot
  // használunk, ami ráadásul a program kinézetéhez is illik.
  //
  // Használat:
  //   const nev = await window.AppKerdes.szoveg({ cim: 'Termék neve' });
  //   if (nev === null) return;        // mégse
  function kerdesAblak({ cim, leiras, ertek, hely, gomb, tobbSoros, szam, kotelezo }) {
    return new Promise((resolve) => {
      const content = window.AppModal.open(`
        <div class="kerdes-ablak">
          <div class="kerdes-cim">${cim || 'Megadás'}</div>
          ${leiras ? `<p class="kerdes-leiras">${leiras}</p>` : ''}
          ${tobbSoros
            ? `<textarea id="kerdes-mezo" class="note-input" rows="4"
                 placeholder="${hely || ''}">${ertek || ''}</textarea>`
            : `<input id="kerdes-mezo" class="cell-input" type="${szam ? 'number' : 'text'}"
                 value="${ertek != null ? String(ertek).replace(/"/g, '&quot;') : ''}"
                 placeholder="${hely || ''}" />`}
          <div class="kerdes-gombok">
            <button class="btn-primary" id="kerdes-ok" style="margin-top:0;">${gomb || 'Rendben'}</button>
            <button class="btn-secondary" id="kerdes-megse" style="margin-top:0;">Mégse</button>
          </div>
        </div>
      `);

      const mezo = content.querySelector('#kerdes-mezo');
      const kesz = (v) => { window.AppModal.close(); resolve(v); };

      content.querySelector('#kerdes-ok').addEventListener('click', () => {
        const v = mezo.value;
        if (kotelezo && !String(v).trim()) { mezo.focus(); return; }
        kesz(v);
      });
      content.querySelector('#kerdes-megse').addEventListener('click', () => kesz(null));

      mezo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !tobbSoros) { e.preventDefault(); content.querySelector('#kerdes-ok').click(); }
        if (e.key === 'Escape') kesz(null);
      });

      setTimeout(() => { mezo.focus(); mezo.select?.(); }, 50);
    });
  }

  window.AppKerdes = {
    // Egy soros szöveg bekérése. null = mégse
    szoveg: (opt) => kerdesAblak({ kotelezo: true, ...opt }),
    // Nem kötelező szöveg (pl. megjegyzés): üres is elfogadható
    szabadSzoveg: (opt) => kerdesAblak({ kotelezo: false, ...opt }),
    // Szám bekérése
    szam: (opt) => kerdesAblak({ szam: true, kotelezo: true, ...opt })
      .then((v) => (v === null ? null : Number(v)))
  };

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
    window.KatalogusModule.init();
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



