// ─────────────────────────────────────────────────────────────────────────
// Árajánlat modul
// - Több kibocsátói PROFIL (EV / KFT), mindegyiknek saját logó/cím/adószám -
//   minden új árajánlatnál kiválasztod melyik nevében megy ki.
// - Mentett ÜGYFELEK (pl. Pipelife, Vámosgép) - egyszer felviszed, utána
//   csak kiválasztod, nem kell újra beírni.
// - Két külön gomb: "Nyomtatás" (rendszer nyomtatóablak) és "PDF letöltés"
//   (valódi PDF fájl, Electronban a főfolyamat generálja, nem függ a gép
//   nyomtató-drivereitől).
// ─────────────────────────────────────────────────────────────────────────

(function () {
  let profiles = {};
  let ugyfelek = {};
  let quotes = {};
  let screen = 'list'; // 'list' (EV/KFT választó) → 'tipus' (egy típus ajánlatai) → 'editor'
  let activeTipus = null; // 'EV' vagy 'KFT'
  let activeId = null;
  let formState = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function fmt(n) { return (Number(n) || 0).toLocaleString('hu-HU'); }
  function uid() { return 'id' + Math.random().toString(36).slice(2, 10); }

  function profileIdForTipus(tipus) {
    const found = Object.entries(profiles).find(([, p]) => p.tipus === tipus);
    return found ? found[0] : null;
  }

  function quoteTipus(q) {
    const p = profiles[q.profilId];
    return p ? p.tipus : 'EV';
  }

  function blankQuote(tipus) {
    return {
      cim: '',
      profilId: profileIdForTipus(tipus) || Object.keys(profiles)[0] || null,
      megrendeloNev: '', megrendeloEmail: '', megrendeloTelefon: '',
      datum: new Date().toISOString().slice(0, 10),
      fizetesMod: 'Banki', penznem: 'Ft',
      ervenyessegiHatarido: '1 hónap', fizetesiHatarido: tipus === 'EV' ? '30 nap' : '15 nap',
      // EV alanyi adómentes -> 0% áfa; KFT -> 27%
      afaSzazalek: tipus === 'EV' ? 0 : 27,
      tetelek: [{ id: uid(), leiras: '', menny: 1, egysegAr: 0 }],
      jegyzetek: tipus === 'EV' ? [] : ['Az ár az áfát is tartalmazza!']
    };
  }

  // ── Alapadatok a korábbi PDF árajánlatokból ──────────────────────────
  const SEED_PROFILES = [
    { tipus: 'KFT', cegnev: 'Tmp Audio Kft.', cim: 'Hungary 4032 Debrecen, Füredi út 98 Fsz.5', adoszam: '32540141-2-09', email: 'tmpaudio.hu@gmail.com', mobil: '+36309154666', website: 'tmpaudio.hu', footerTagline: 'Termékeinkért látogasson el honlapunkra!', logoDataUrl: '' },
    { tipus: 'EV', cegnev: 'Gál Tamás E.V.', cim: 'Hungary 4032 Debrecen, Lehel utca 20. 5em.39a.', adoszam: '68078238-1-29', email: 'tmpaudio.hu@gmail.com', mobil: '+36309154666', website: 'tmpaudio.hu', footerTagline: 'Termékeinkért látogasson el honlapunkra!', logoDataUrl: '' }
  ];
  const SEED_UGYFELEK = [
    { nev: 'Pipelife', kapcsolattarto: 'Kovács Dávid', email: 'david.kovacs@pipelife.com', telefon: '+36 20 228 1638', tipusok: { EV: true, KFT: true }, fizetesiHatarido: '30 nap' },
    { nev: 'Vámosgép', kapcsolattarto: 'Oláh Béla', email: 'olah.bela@vamosgep.hu', telefon: '+36703666557', tipusok: { KFT: true }, fizetesiHatarido: '15 nap' },
    { nev: 'Paccor', kapcsolattarto: 'Hangrád Attila', email: 'attila.hangrad@effektalmand.hu', telefon: '+36204037764', tipusok: { KFT: true }, fizetesiHatarido: '15 nap' }
  ];

  // Automatikus, ismételhető betöltés: ha hiányzik valamelyik profil vagy
  // gyakori ügyfél, létrehozza; ha név alapján már létezik, kiegészíti a
  // hiányzó adatokkal (kapcsolattartó, határidő, EV/KFT besorolás).
  function seedDefaults() {
    const jobs = [];
    SEED_PROFILES.forEach((p) => {
      const found = Object.entries(profiles).find(([, x]) => x.tipus === p.tipus);
      if (!found) {
        jobs.push(window.DataLayer.arajanlatProfileAdd(p));
      } else {
        const [id, existing] = found;
        // Meglévő profil hiányzó mezőinek pótlása (pl. adószám, cím)
        const patch = {};
        ['cegnev', 'cim', 'adoszam', 'email', 'mobil', 'website', 'footerTagline'].forEach((k) => {
          if (!existing[k]) patch[k] = p[k];
        });
        if (Object.keys(patch).length) jobs.push(window.DataLayer.arajanlatProfileUpdate(id, patch));
      }
    });
    SEED_UGYFELEK.forEach((u) => {
      const found = Object.entries(ugyfelek).find(([, x]) => (x.nev || '').toLowerCase() === u.nev.toLowerCase());
      if (!found) {
        jobs.push(window.DataLayer.arajanlatUgyfelAdd(u));
      } else {
        const [id, existing] = found;
        // Kiegészítjük a hiányzó mezőket a PDF-ekből kinyert adatokkal
        const patch = {};
        if (!existing.kapcsolattarto) patch.kapcsolattarto = u.kapcsolattarto;
        if (!existing.fizetesiHatarido) patch.fizetesiHatarido = u.fizetesiHatarido;
        if (!existing.tipusok) patch.tipusok = u.tipusok;
        if (!existing.email) patch.email = u.email;
        if (!existing.telefon) patch.telefon = u.telefon;
        if (Object.keys(patch).length) jobs.push(window.DataLayer.arajanlatUgyfelUpdate(id, patch));
      }
    });
    return Promise.all(jobs).then(() => jobs.length);
  }

  let seededOnce = false;
  let profilesLoaded = false;
  let ugyfelekLoaded = false;
  function maybeAutoSeed() {
    if (seededOnce || !profilesLoaded || !ugyfelekLoaded) return;
    seededOnce = true;
    seedDefaults().catch((err) => console.warn('Alapadat-betöltés kihagyva:', err.message));
  }

  // Ügyfél elérhető-e az adott típusnál (régi rekord tipusok nélkül -> mindkettő)
  function ugyfelInTipus(u, tipus) {
    if (!u.tipusok) return true;
    return !!u.tipusok[tipus];
  }

  // Sorösszeg: mennyiség × egységár. Régi tételeknél (ahol csak "osszeg"
  // volt) azt használjuk, 1 db-os egységárként kezelve.
  function lineTotal(t) {
    if (t.egysegAr != null) return (Number(t.menny) || 0) * (Number(t.egysegAr) || 0);
    return Number(t.osszeg) || 0;
  }

  function computeTotals(q) {
    const netto = (q.tetelek || []).reduce((sum, t) => sum + lineTotal(t), 0);
    const afaErtek = Math.round(netto * (Number(q.afaSzazalek) || 0) / 100);
    return { netto, afaErtek, vegosszeg: netto + afaErtek };
  }

  // ── FŐOLDAL: EV / KFT nagy választó-kártyák ───────────────────────────
  function renderListScreen(root) {
    const noProfiles = Object.keys(profiles).length === 0;
    const tipusok = [
      { tipus: 'EV', label: 'EV árajánlatok', desc: 'Egyéni vállalkozóként kiállított ajánlatok', color: '#5B7F99' },
      { tipus: 'KFT', label: 'KFT árajánlatok', desc: 'A KFT nevében kiállított ajánlatok', color: '#9C6B3F' }
    ];

    root.innerHTML = `
      <div class="toolbar">
        <button id="aj-profiles" class="btn-secondary" style="margin-top:0;">🏢 Kibocsátói profilok</button>
        <button id="aj-customers" class="btn-secondary" style="margin-top:0;">👤 Mentett ügyfelek</button>
      </div>
      <p class="grid-title">Válassz típust</p>
      <div class="card-grid">
        ${tipusok.map(({ tipus, label, desc, color }) => {
          const count = Object.values(quotes).filter((q) => quoteTipus(q) === tipus).length;
          const hasProfile = !!profileIdForTipus(tipus);
          return `
            <div class="category-card-tile ${hasProfile ? '' : 'disabled'}" data-open-tipus="${tipus}" style="border-top:3px solid ${color};${hasProfile ? '' : 'opacity:0.5;cursor:default;'}">
              <span class="cat-type-tag" style="border-color:${color};color:${color};">${count} árajánlat</span>
              <div class="cat-name">${label}</div>
              <div class="cat-stat">${hasProfile ? desc : 'Nincs még ' + tipus + ' profil beállítva'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('aj-profiles')?.addEventListener('click', openProfilesModal);
    document.getElementById('aj-customers')?.addEventListener('click', openCustomersModal);
    root.querySelectorAll('[data-open-tipus]:not(.disabled)').forEach((el) => {
      el.addEventListener('click', () => {
        if (!profileIdForTipus(el.dataset.openTipus)) return;
        activeTipus = el.dataset.openTipus;
        screen = 'tipus';
        render();
        window.AppAnim?.ujra();
      });
    });
  }

  // ── TÍPUS NÉZET: egy típus ajánlatai + gyors ügyfél-gombok ───────────
  let quoteSearchTerm = '';

  function quoteMatchesSearch(q) {
    if (!quoteSearchTerm) return true;
    const hay = `${q.cim || ''} ${q.megrendeloNev || ''} ${(q.tetelek || []).map((t) => t.leiras).join(' ')}`.toLowerCase();
    return hay.includes(quoteSearchTerm.toLowerCase());
  }

  function renderTipusScreen(root) {
    const entries = Object.entries(quotes)
      .filter(([, q]) => quoteTipus(q) === activeTipus)
      .filter(([, q]) => quoteMatchesSearch(q))
      .sort((a, b) => (b[1].datum || '').localeCompare(a[1].datum || ''));
    const color = activeTipus === 'KFT' ? '#9C6B3F' : '#5B7F99';

    // Dátum szerinti csoportosítás - legfrissebb nap legfelül
    const groups = [];
    entries.forEach(([id, q]) => {
      const day = q.datum || 'Dátum nélkül';
      let group = groups.find((g) => g.day === day);
      if (!group) { group = { day, items: [] }; groups.push(group); }
      group.items.push([id, q]);
    });

    root.innerHTML = `
      <div class="category-detail-head">
        <span style="font-family:var(--font-display);font-weight:700;font-size:22px;color:${color};">${activeTipus} árajánlatok</span>
        <button class="btn-primary" id="aj-add" style="margin-top:0;">+ Új árajánlat</button>
      </div>
      ${Object.entries(ugyfelek).filter(([, u]) => ugyfelInTipus(u, activeTipus)).length ? `
        <div class="toolbar" style="margin-bottom:14px;align-items:center;">
          <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);">Sablonok:</span>
          ${Object.entries(ugyfelek).filter(([, u]) => ugyfelInTipus(u, activeTipus)).map(([id, u]) =>
            `<button class="btn-secondary" data-quick-ugyfel="${id}" style="margin-top:0;" title="${escapeHtml(u.kapcsolattarto || '')}${u.fizetesiHatarido ? ' · ' + escapeHtml(u.fizetesiHatarido) : ''}">⚡ ${escapeHtml(u.nev)}</button>`).join('')}
        </div>
      ` : ''}
      <div class="toolbar" style="margin-bottom:22px;">
        <input id="aj-quote-search" class="search-input" placeholder="Keresés cím, megrendelő vagy tétel szerint…" value="${escapeHtml(quoteSearchTerm)}" />
      </div>
      ${groups.map((g) => `
        <p class="grid-title" style="margin-bottom:12px;">${escapeHtml(g.day)}</p>
        <div class="card-grid" style="margin-bottom:26px;">
          ${g.items.map(([id, q]) => {
            const totals = computeTotals(q);
            return `
              <div class="category-card-tile" data-open="${id}" style="border-top:3px solid ${color};">
                <span class="cat-type-tag">${escapeHtml(q.megrendeloNev || 'nincs megrendelő')}</span>
                <div class="cat-name">${escapeHtml(q.cim || q.megrendeloNev || 'Névtelen árajánlat')}</div>
                <div class="cat-stat">${(q.tetelek || []).length} tétel · ${fmt(totals.vegosszeg)} ${escapeHtml(q.penznem || 'Ft')}</div>
              </div>
            `;
          }).join('')}
        </div>
      `).join('') || '<p class="empty-state">' + (quoteSearchTerm ? 'Nincs találat a keresésre.' : 'Még nincs itt árajánlat.') + '</p>'}
    `;

    document.getElementById('aj-quote-search')?.addEventListener('input', (e) => {
      const caret = e.target.selectionStart;
      quoteSearchTerm = e.target.value;
      render();
      const input = document.getElementById('aj-quote-search');
      if (input) { input.focus(); input.setSelectionRange(caret, caret); }
    });

    document.getElementById('aj-add')?.addEventListener('click', () => {
      const q = blankQuote(activeTipus);
      window.DataLayer.arajanlatAdd(q).then((id) => {
        activeId = id;
        formState = q;
        screen = 'editor';
        render();
        window.AppAnim?.ujra();
      });
    });
    root.querySelectorAll('[data-quick-ugyfel]').forEach((el) => {
      el.addEventListener('click', () => {
        const u = ugyfelek[el.dataset.quickUgyfel];
        if (!u) return;
        const q = blankQuote(activeTipus);
        // A PDF-en a "Megrendelő" a kapcsolattartó személy neve (pl. Oláh Béla)
        q.megrendeloNev = u.kapcsolattarto || u.nev || '';
        q.megrendeloEmail = u.email || '';
        q.megrendeloTelefon = u.telefon || '';
        if (u.fizetesiHatarido) q.fizetesiHatarido = u.fizetesiHatarido;
        window.DataLayer.arajanlatAdd(q).then((id) => {
          activeId = id;
          formState = q;
          screen = 'editor';
          render();
          window.AppAnim?.ujra();
        });
      });
    });
    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        activeId = el.dataset.open;
        formState = JSON.parse(JSON.stringify(quotes[activeId]));
        if (!Array.isArray(formState.tetelek)) formState.tetelek = [];
        if (!Array.isArray(formState.jegyzetek)) formState.jegyzetek = [];
        screen = 'editor';
        render();
        window.AppAnim?.ujra();
      });
    });
  }

  // ── KIBOCSÁTÓI PROFILOK (EV / KFT) kezelése ─────────────────────────
  function openProfilesModal() {
    const html = `
      <div class="repair-detail-header" style="margin-bottom:16px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;">Kibocsátói profilok</span>
      </div>
      <div class="record-list" id="aj-profile-list">
        ${Object.entries(profiles).map(([id, p]) => `
          <div class="record-card" data-profile="${id}">
            <div class="record-card-head">
              <span class="cat-type-tag">${escapeHtml(p.tipus)}</span>
              <span style="font-family:var(--font-display);font-weight:700;flex:1;">${escapeHtml(p.cegnev)}</span>
              <button class="btn-tiny" data-edit-profile="${id}">Szerkesztés</button>
              <button class="btn-tiny btn-danger" data-delete-profile="${id}">Törlés</button>
            </div>
          </div>
        `).join('') || '<p class="empty-state">Még nincs profil.</p>'}
      </div>
      <button class="btn-secondary" id="aj-new-profile">+ Új profil (EV vagy KFT)</button>
    `;
    const content = window.AppModal.open(html);
    content.querySelector('#aj-new-profile')?.addEventListener('click', () => openProfileEditForm(null));
    content.querySelectorAll('[data-edit-profile]').forEach((el) => {
      el.addEventListener('click', () => openProfileEditForm(el.dataset.editProfile));
    });
    content.querySelectorAll('[data-delete-profile]').forEach((el) => {
      el.addEventListener('click', () => {
        if (!confirm('Törlöd ezt a profilt?')) return;
        window.DataLayer.arajanlatProfileDelete(el.dataset.deleteProfile).then(() => openProfilesModal());
      });
    });
  }

  function openProfileEditForm(profileId) {
    const p = profileId ? profiles[profileId] : { tipus: 'EV', cegnev: '', cim: '', adoszam: '', email: '', mobil: '', website: '', footerTagline: '', logoDataUrl: '' };
    const html = `
      <div class="repair-detail-header" style="margin-bottom:16px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;">${profileId ? 'Profil szerkesztése' : 'Új profil'}</span>
      </div>
      <div class="detail-fields-card">
        <div class="field-grid">
          <div>
            <span class="field-label">Típus</span>
            <select class="cell-input" id="pf-tipus" style="width:100%;">
              <option value="EV" ${p.tipus === 'EV' ? 'selected' : ''}>EV (egyéni vállalkozó)</option>
              <option value="KFT" ${p.tipus === 'KFT' ? 'selected' : ''}>KFT</option>
            </select>
          </div>
          <div><span class="field-label">Cégnév</span><input class="cell-input" id="pf-cegnev" value="${escapeHtml(p.cegnev)}" /></div>
          <div><span class="field-label">Adószám</span><input class="cell-input" id="pf-adoszam" value="${escapeHtml(p.adoszam)}" /></div>
          <div><span class="field-label">E-mail</span><input class="cell-input" id="pf-email" value="${escapeHtml(p.email)}" /></div>
          <div><span class="field-label">Mobil</span><input class="cell-input" id="pf-mobil" value="${escapeHtml(p.mobil)}" /></div>
          <div><span class="field-label">Weboldal</span><input class="cell-input" id="pf-website" value="${escapeHtml(p.website)}" /></div>
        </div>
        <span class="field-label">Cím</span>
        <textarea class="note-input" id="pf-cim" rows="2" style="width:100%;margin-bottom:14px;">${escapeHtml(p.cim)}</textarea>
        <span class="field-label">Lábléc szövege</span>
        <input class="cell-input" id="pf-footer" value="${escapeHtml(p.footerTagline)}" style="width:100%;margin-bottom:14px;" />
        <span class="field-label">Logó</span><br>
        ${p.logoDataUrl ? `<img src="${p.logoDataUrl}" style="max-height:50px;margin:8px 0;display:block;" />` : ''}
        <input type="file" id="pf-logo" accept="image/*" />
        <div style="margin-top:18px;"><button class="btn-primary" id="pf-save">Mentés</button></div>
      </div>
    `;
    const content = window.AppModal.open(html);
    let logoDataUrl = p.logoDataUrl || '';
    content.querySelector('#pf-logo')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 800 * 1024) alert('A kép elég nagy (' + Math.round(file.size / 1024) + ' KB). Érdemes kisebb (max ~300 KB) logót használni.');
      const reader = new FileReader();
      reader.onload = () => { logoDataUrl = reader.result; };
      reader.readAsDataURL(file);
    });
    content.querySelector('#pf-save')?.addEventListener('click', () => {
      const profile = {
        tipus: content.querySelector('#pf-tipus').value,
        cegnev: content.querySelector('#pf-cegnev').value,
        adoszam: content.querySelector('#pf-adoszam').value,
        email: content.querySelector('#pf-email').value,
        mobil: content.querySelector('#pf-mobil').value,
        website: content.querySelector('#pf-website').value,
        cim: content.querySelector('#pf-cim').value,
        footerTagline: content.querySelector('#pf-footer').value,
        logoDataUrl
      };
      const save = profileId
        ? window.DataLayer.arajanlatProfileUpdate(profileId, profile)
        : window.DataLayer.arajanlatProfileAdd(profile);
      save.then(() => openProfilesModal());
    });
  }

  // ── MENTETT ÜGYFELEK kezelése ─────────────────────────────────────────
  function ugyfelTipusLabel(u) {
    if (!u.tipusok) return 'EV + KFT';
    const list = [];
    if (u.tipusok.EV) list.push('EV');
    if (u.tipusok.KFT) list.push('KFT');
    return list.join(' + ') || '—';
  }

  function openCustomersModal() {
    const html = `
      <div class="repair-detail-header" style="margin-bottom:16px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;">Mentett ügyfelek</span>
      </div>
      <div class="record-list">
        ${Object.entries(ugyfelek).map(([id, u]) => `
          <div class="record-card">
            <div class="record-card-head">
              <span class="cat-type-tag">${escapeHtml(ugyfelTipusLabel(u))}</span>
              <span style="font-family:var(--font-display);font-weight:700;flex:1;">${escapeHtml(u.nev)}</span>
              <button class="btn-tiny" data-edit-ugyfel="${id}">Szerkesztés</button>
              <button class="btn-tiny btn-danger" data-delete-ugyfel="${id}">Törlés</button>
            </div>
            <div class="rct-meta" style="padding:0 2px;">${escapeHtml(u.kapcsolattarto || '')} ${u.email ? '· ' + escapeHtml(u.email) : ''} ${u.telefon ? '· ' + escapeHtml(u.telefon) : ''}${u.fizetesiHatarido ? ' · fiz. határidő: ' + escapeHtml(u.fizetesiHatarido) : ''}</div>
          </div>
        `).join('') || '<p class="empty-state">Még nincs mentett ügyfél.</p>'}
      </div>
      <button class="btn-secondary" id="aj-new-ugyfel">+ Új ügyfél mentése</button>
    `;
    const content = window.AppModal.open(html);
    content.querySelector('#aj-new-ugyfel')?.addEventListener('click', () => openCustomerEditForm(null));
    content.querySelectorAll('[data-edit-ugyfel]').forEach((el) => {
      el.addEventListener('click', () => openCustomerEditForm(el.dataset.editUgyfel));
    });
    content.querySelectorAll('[data-delete-ugyfel]').forEach((el) => {
      el.addEventListener('click', () => {
        if (!confirm('Törlöd ezt a mentett ügyfelet?')) return;
        window.DataLayer.arajanlatUgyfelDelete(el.dataset.deleteUgyfel).then(() => openCustomersModal());
      });
    });
  }

  function openCustomerEditForm(ugyfelId) {
    const u = ugyfelId ? ugyfelek[ugyfelId] : { nev: '', kapcsolattarto: '', email: '', telefon: '', tipusok: { EV: false, KFT: true }, fizetesiHatarido: '15 nap' };
    const t = u.tipusok || { EV: true, KFT: true };
    const html = `
      <div class="repair-detail-header" style="margin-bottom:16px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;">${ugyfelId ? 'Ügyfél szerkesztése' : 'Új ügyfél'}</span>
      </div>
      <div class="detail-fields-card">
        <div class="field-grid">
          <div><span class="field-label">Cégnév (sablon neve)</span><input class="cell-input" id="uf-nev" value="${escapeHtml(u.nev)}" placeholder="pl. Pipelife" /></div>
          <div><span class="field-label">Kapcsolattartó (ez kerül a Megrendelő mezőbe)</span><input class="cell-input" id="uf-kapcsolattarto" value="${escapeHtml(u.kapcsolattarto)}" placeholder="pl. Kovács Dávid" /></div>
          <div><span class="field-label">E-mail</span><input class="cell-input" id="uf-email" value="${escapeHtml(u.email)}" /></div>
          <div><span class="field-label">Telefonszám</span><input class="cell-input" id="uf-telefon" value="${escapeHtml(u.telefon)}" /></div>
          <div><span class="field-label">Fizetési határidő</span><input class="cell-input" id="uf-hatarido" value="${escapeHtml(u.fizetesiHatarido)}" placeholder="pl. 15 nap" /></div>
        </div>
        <span class="field-label" style="margin-bottom:8px;display:block;">Hol jelenjen meg gyors-sablonként?</span>
        <label style="display:inline-flex;align-items:center;gap:6px;margin-right:18px;font-size:13px;">
          <input type="checkbox" id="uf-tipus-ev" ${t.EV ? 'checked' : ''} /> EV árajánlatoknál
        </label>
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;">
          <input type="checkbox" id="uf-tipus-kft" ${t.KFT ? 'checked' : ''} /> KFT árajánlatoknál
        </label>
        <div style="margin-top:18px;"><button class="btn-primary" id="uf-save">Mentés</button></div>
      </div>
    `;
    const content = window.AppModal.open(html);
    content.querySelector('#uf-save')?.addEventListener('click', () => {
      const rec = {
        nev: content.querySelector('#uf-nev').value,
        kapcsolattarto: content.querySelector('#uf-kapcsolattarto').value,
        email: content.querySelector('#uf-email').value,
        telefon: content.querySelector('#uf-telefon').value,
        fizetesiHatarido: content.querySelector('#uf-hatarido').value,
        tipusok: {
          EV: content.querySelector('#uf-tipus-ev').checked,
          KFT: content.querySelector('#uf-tipus-kft').checked
        }
      };
      const save = ugyfelId
        ? window.DataLayer.arajanlatUgyfelUpdate(ugyfelId, rec)
        : window.DataLayer.arajanlatUgyfelAdd(rec);
      save.then(() => openCustomersModal());
    });
  }

  // ── ÖNÁLLÓ, TELJES HTML A PDF/NYOMTATÁSHOZ (saját, beágyazott CSS-sel) ──
  const INVOICE_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Jost:wght@400;500;600&display=swap');
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body{margin:0;font-family:'Jost',Arial,sans-serif;color:#1C1A18;background:white;}
    .invoice-preview{background:#F5EFE6;}
    .inv-header{background:#1C1A18;color:#F2ECE0;display:flex;align-items:center;justify-content:space-between;padding:26px 36px;border-bottom:3px solid #9C6B3F;}
    .inv-company-name{font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:22px;letter-spacing:0.01em;}
    .inv-header-logo img{max-height:58px;max-width:150px;}
    .inv-header-right{text-align:right;}
    .inv-title{font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:28px;}
    .inv-date{font-size:11.5px;opacity:.8;margin-top:5px;letter-spacing:0.04em;}
    .inv-body{background:#F5EFE6;padding:30px 38px;}
    .inv-parties{display:flex;justify-content:space-between;gap:26px;margin-bottom:20px;font-size:13px;line-height:1.75;}
    .inv-parties>div{flex:1;background:#FFFFFF;border:1px solid #E3DACC;border-radius:12px;padding:16px 20px;}
    .inv-parties strong{font-family:'Playfair Display',Georgia,serif;font-size:14.5px;display:block;margin-bottom:4px;}
    .inv-customer{text-align:right;}
    .inv-terms{display:flex;justify-content:center;gap:26px;flex-wrap:wrap;font-size:12.5px;margin-bottom:24px;color:#3A3530;background:#EDE6DC;border-radius:10px;padding:12px 16px;}
    .inv-terms b{color:#1C1A18;}
    table.inv-items{width:100%;border-collapse:collapse;margin-bottom:22px;background:#FFFFFF;border:1px solid #E3DACC;border-radius:12px;overflow:hidden;}
    table.inv-items th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;color:#6A6560;background:#FAF8F4;border-bottom:2px solid #9C6B3F;padding:10px 14px;}
    table.inv-items th:last-child,table.inv-items td:last-child{text-align:right;}
    table.inv-items td{padding:10px 14px;border-bottom:1px solid #EDE6DC;font-size:13px;}
    table.inv-items tr:last-child td{border-bottom:none;}
    .inv-bottom{display:flex;justify-content:space-between;gap:32px;margin-bottom:28px;align-items:flex-start;}
    .inv-notes{font-size:12px;line-height:1.75;flex:1;color:#3A3530;}
    .inv-notes strong{font-family:'Playfair Display',Georgia,serif;color:#1C1A18;}
    .inv-notes ol{margin:8px 0 0;padding-left:18px;}
    .inv-totals{font-size:13px;line-height:2;min-width:240px;background:#FFFFFF;border:1px solid #E3DACC;border-radius:12px;padding:14px 20px;}
    .inv-totals .inv-total-final{font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:18px;color:#9C6B3F;border-top:2px solid #1C1A18;margin-top:8px;padding-top:8px;}
    .inv-signature{text-align:right;font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:14px;margin-top:6px;}
    .inv-footer{background:#1C1A18;color:#F2ECE0;text-align:center;padding:16px;border-top:3px solid #9C6B3F;}
    .inv-footer div:first-child{font-size:12px;opacity:0.85;letter-spacing:0.04em;}
    .inv-footer .inv-website{font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:19px;margin-top:5px;}
  `;

  function buildInvoiceInnerHtml(q, profil) {
    const totals = computeTotals(q);
    return `
      <div class="invoice-preview">
        <div class="inv-header">
          <div class="inv-company-name">${escapeHtml(profil?.cegnev || 'Cégnév')}</div>
          <div class="inv-header-logo">${profil?.logoDataUrl ? `<img src="${profil.logoDataUrl}" />` : ''}</div>
          <div class="inv-header-right">
            <div class="inv-title">Árajánlat</div>
            <div class="inv-date">Kiállítás dátuma: ${escapeHtml(q.datum)}</div>
          </div>
        </div>
        <div class="inv-body">
          <div class="inv-parties">
            <div>
              <strong>${escapeHtml(profil?.cegnev || '')}</strong>
              ${escapeHtml(profil?.cim || '').replace(/\n/g, '<br>')}<br>
              Adószám: ${escapeHtml(profil?.adoszam || '')}<br>
              e-mail: ${escapeHtml(profil?.email || '')}<br>
              mobil: ${escapeHtml(profil?.mobil || '')}
            </div>
            <div class="inv-customer">
              <strong>Megrendelő: ${escapeHtml(q.megrendeloNev)}</strong>
              e-mail: ${escapeHtml(q.megrendeloEmail)}<br>
              Telefonszám: ${escapeHtml(q.megrendeloTelefon)}
            </div>
          </div>
          <div class="inv-terms">
            <span>Fizetésmód: <b>${escapeHtml(q.fizetesMod)}</b></span>
            <span>Pénznem: <b>${escapeHtml(q.penznem)}</b></span>
            <span>Érvényesség: <b>${escapeHtml(q.ervenyessegiHatarido)}</b></span>
            <span>Fizetési határidő: <b>${escapeHtml(q.fizetesiHatarido)}</b></span>
          </div>
          <table class="inv-items">
            <thead><tr><th>Leírás</th><th style="text-align:center;">Menny.</th><th style="text-align:right;">Egységár</th><th>Összeg</th></tr></thead>
            <tbody>${q.tetelek.map((t) => `<tr><td>${escapeHtml(t.leiras)}</td><td style="text-align:center;">${Number(t.menny) || 1} db</td><td style="text-align:right;">${fmt(t.egysegAr ?? t.osszeg ?? 0)} ${escapeHtml(q.penznem)}</td><td>${fmt(lineTotal(t))} ${escapeHtml(q.penznem)}</td></tr>`).join('')}</tbody>
          </table>
          <div class="inv-bottom">
            <div class="inv-notes"><strong>Egyéb leírás:</strong><ol>${q.jegyzetek.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ol></div>
            <div class="inv-totals">
              <div>Nettó összeg: ${fmt(totals.netto)} ${escapeHtml(q.penznem)}</div>
              <div>Áfa: ${escapeHtml(q.afaSzazalek)}%</div>
              <div>Áfa érték: ${fmt(totals.afaErtek)} ${escapeHtml(q.penznem)}</div>
              <div class="inv-total-final">Végösszeg: ${fmt(totals.vegosszeg)} ${escapeHtml(q.penznem)}</div>
            </div>
          </div>
          <div class="inv-signature">${escapeHtml(profil?.cegnev || '')}</div>
        </div>
        <div class="inv-footer">
          <div>${escapeHtml(profil?.footerTagline || '')}</div>
          <div class="inv-website">${escapeHtml(profil?.website || '')}</div>
        </div>
      </div>
    `;
  }

  function buildStandaloneHtml(q, profil) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${INVOICE_CSS}</style></head><body>${buildInvoiceInnerHtml(q, profil)}</body></html>`;
  }

  // ── SZERKESZTŐ NÉZET ──────────────────────────────────────────────────
  function saveFormState() { window.DataLayer.arajanlatWrite(activeId, formState); }

  function renderEditorScreen(root) {
    const q = formState;
    const profil = profiles[q.profilId];
    const totals = computeTotals(q);

    root.innerHTML = `
      <div class="category-detail-head aj-editor-toolbar">
        <input class="cat-title-input" data-f="cim" placeholder="Árajánlat címe (pl. FTM330 panel javítás 10db)" value="${escapeHtml(q.cim || '')}" style="flex:1;min-width:220px;" />
        <button class="btn-secondary" id="aj-print" style="margin-top:0;">🖨️ Nyomtatás</button>
        <button class="btn-primary" id="aj-download">⬇️ PDF letöltés</button>
        <button class="btn-tiny btn-danger" id="aj-delete">Törlés</button>
      </div>

      <div class="arajanlat-editor">
        <div class="aj-form-panel">
          <h4 style="margin-top:0;">Kibocsátó</h4>
          <select class="cell-input" data-f="profilId">
            ${Object.entries(profiles).map(([id, p]) => `<option value="${id}" ${q.profilId === id ? 'selected' : ''}>${escapeHtml(p.tipus)} - ${escapeHtml(p.cegnev)}</option>`).join('') || '<option>Nincs profil</option>'}
          </select>

          <h4>Megrendelő</h4>
          ${Object.keys(ugyfelek).length ? `
            <select class="cell-input" id="aj-pick-ugyfel">
              <option value="">— Mentett ügyfél kiválasztása —</option>
              ${Object.entries(ugyfelek).map(([id, u]) => `<option value="${id}">${escapeHtml(u.nev)}</option>`).join('')}
            </select>
          ` : ''}
          <input class="cell-input" data-f="megrendeloNev" placeholder="Megrendelő neve" value="${escapeHtml(q.megrendeloNev)}" />
          <input class="cell-input" data-f="megrendeloEmail" placeholder="E-mail" value="${escapeHtml(q.megrendeloEmail)}" />
          <input class="cell-input" data-f="megrendeloTelefon" placeholder="Telefonszám" value="${escapeHtml(q.megrendeloTelefon)}" />
          <button class="btn-tiny" id="aj-save-ugyfel">+ Mentés gyakori ügyfélként</button>

          <h4>Feltételek</h4>
          <input class="cell-input" type="date" data-f="datum" value="${escapeHtml(q.datum)}" />
          <input class="cell-input" data-f="fizetesMod" placeholder="Fizetésmód (pl. Banki)" value="${escapeHtml(q.fizetesMod)}" />
          <input class="cell-input" data-f="penznem" placeholder="Pénznem (pl. Ft)" value="${escapeHtml(q.penznem)}" />
          <input class="cell-input" data-f="ervenyessegiHatarido" placeholder="Érvényességi határidő" value="${escapeHtml(q.ervenyessegiHatarido)}" />
          <input class="cell-input" data-f="fizetesiHatarido" placeholder="Fizetési határidő" value="${escapeHtml(q.fizetesiHatarido)}" />
          <div><span class="field-label">Áfa (%)</span><input class="cell-input num" type="number" data-f="afaSzazalek" value="${q.afaSzazalek}" style="width:80px;" /></div>

          <h4>Tételek</h4>
          <div style="display:flex;gap:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);font-weight:600;">
            <span style="flex:1;">Megnevezés</span><span style="width:60px;">Db</span><span style="width:90px;">Egységár</span><span style="width:24px;"></span>
          </div>
          <div id="aj-items">
            ${q.tetelek.map((t) => `
              <div class="aj-item-row" data-item="${t.id}">
                <input class="cell-input" data-tf="leiras" placeholder="pl. Panel javítás" value="${escapeHtml(t.leiras)}" style="flex:1;" />
                <input class="cell-input num" type="number" min="1" data-tf="menny" value="${t.menny ?? 1}" style="width:60px;" />
                <input class="cell-input num" type="number" data-tf="egysegAr" placeholder="Ft" value="${t.egysegAr ?? t.osszeg ?? 0}" style="width:90px;" />
                <button class="btn-tiny btn-danger" data-remove-item="${t.id}">×</button>
              </div>
              <div style="font-size:11px;color:var(--text-dim);text-align:right;margin:-6px 30px 6px 0;" data-line-total="${t.id}">${(Number(t.menny)||1)} × ${fmt(t.egysegAr ?? t.osszeg ?? 0)} = <b>${fmt(lineTotal(t))} Ft</b></div>
            `).join('')}
          </div>
          <button class="btn-secondary" id="aj-add-item">+ Új tétel</button>

          <h4>Egyéb leírás</h4>
          <div id="aj-notes">
            ${q.jegyzetek.map((n, i) => `
              <div class="aj-note-row" data-note-index="${i}">
                <input class="cell-input" data-note-text value="${escapeHtml(n)}" style="flex:1;" />
                <button class="btn-tiny btn-danger" data-remove-note="${i}">×</button>
              </div>
            `).join('')}
          </div>
          <button class="btn-secondary" id="aj-add-note">+ Új sor</button>
        </div>

        <div id="invoice-preview-wrap">${buildInvoiceInnerHtml(q, profil)}</div>
      </div>
    `;

    document.getElementById('aj-print')?.addEventListener('click', () => window.print());
    document.getElementById('aj-download')?.addEventListener('click', async () => {
      const html = buildStandaloneHtml(formState, profiles[formState.profilId]);
      const namePart = (formState.cim || formState.megrendeloNev || 'nevtelen').replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ]+/g, '_');
      const suggestedName = `TMP_arajanlat_${namePart}_${formState.datum}.pdf`;
      if (window.nativeApp?.saveQuotePdf) {
        const result = await window.nativeApp.saveQuotePdf(html, suggestedName);
        if (result.ok) alert('PDF elmentve: ' + result.filePath);
        else if (!result.canceled) alert('Hiba történt a PDF mentésekor: ' + (result.error || 'ismeretlen hiba'));
      } else {
        alert('Ez böngészőben fut, itt nincs közvetlen PDF-mentés.\n\nHasználd a "Nyomtatás" gombot, és a nyomtatóablakban válaszd célnak a "Mentés PDF-ként" lehetőséget.\n\nA telepített asztali appban a PDF letöltés gomb egyből fájlba ment.');
      }
    });
    document.getElementById('aj-delete')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt az árajánlatot?')) return;
      window.DataLayer.arajanlatDelete(activeId);
      screen = 'tipus';
      formState = null;
      render();
      window.AppAnim?.ujra();
    });

    document.getElementById('aj-pick-ugyfel')?.addEventListener('change', (e) => {
      const u = ugyfelek[e.target.value];
      if (!u) return;
      formState.megrendeloNev = u.nev || '';
      formState.megrendeloEmail = u.email || '';
      formState.megrendeloTelefon = u.telefon || '';
      saveFormState();
      render();
    });
    document.getElementById('aj-save-ugyfel')?.addEventListener('click', () => {
      if (!formState.megrendeloNev) { alert('Írd be előbb a megrendelő nevét.'); return; }
      window.DataLayer.arajanlatUgyfelAdd({
        nev: formState.megrendeloNev, email: formState.megrendeloEmail, telefon: formState.megrendeloTelefon
      }).then(() => alert('Ügyfél elmentve, legközelebb kiválasztható lesz a listából.'));
    });

    root.querySelectorAll('[data-f]').forEach((el) => {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, (e) => {
        const field = e.target.dataset.f;
        const isNum = e.target.classList.contains('num');
        formState[field] = isNum ? Number(e.target.value) || 0 : e.target.value;
        saveFormState();
        if (field === 'profilId') render(); else renderPreviewOnly();
      });
    });

    root.querySelectorAll('[data-item]').forEach((row) => {
      const itemId = row.dataset.item;
      row.querySelectorAll('[data-tf]').forEach((input) => {
        input.addEventListener('input', (e) => {
          const item = formState.tetelek.find((t) => t.id === itemId);
          if (!item) return;
          const field = e.target.dataset.tf;
          item[field] = (field === 'menny' || field === 'egysegAr') ? Number(e.target.value) || 0 : e.target.value;
          // Ha régi tételt szerkesztenek, az elavult "osszeg" mezőt elhagyjuk
          if (field === 'egysegAr' || field === 'menny') delete item.osszeg;
          saveFormState();
          const totalEl = root.querySelector(`[data-line-total="${itemId}"]`);
          if (totalEl) totalEl.innerHTML = `${Number(item.menny) || 1} × ${fmt(item.egysegAr || 0)} = <b>${fmt(lineTotal(item))} Ft</b>`;
          renderPreviewOnly();
        });
      });
    });
    root.querySelectorAll('[data-remove-item]').forEach((el) => {
      el.addEventListener('click', (e) => {
        formState.tetelek = formState.tetelek.filter((t) => t.id !== e.target.dataset.removeItem);
        saveFormState();
        render();
      });
    });
    document.getElementById('aj-add-item')?.addEventListener('click', () => {
      formState.tetelek.push({ id: uid(), leiras: '', menny: 1, egysegAr: 0 });
      saveFormState();
      render();
    });

    root.querySelectorAll('[data-note-text]').forEach((el) => {
      el.addEventListener('input', (e) => {
        const idx = Number(e.target.closest('[data-note-index]').dataset.noteIndex);
        formState.jegyzetek[idx] = e.target.value;
        saveFormState();
        renderPreviewOnly();
      });
    });
    root.querySelectorAll('[data-remove-note]').forEach((el) => {
      el.addEventListener('click', (e) => {
        formState.jegyzetek.splice(Number(e.target.dataset.removeNote), 1);
        saveFormState();
        render();
      });
    });
    document.getElementById('aj-add-note')?.addEventListener('click', () => {
      formState.jegyzetek.push('');
      saveFormState();
      render();
    });
  }

  function renderPreviewOnly() {
    const wrap = document.getElementById('invoice-preview-wrap');
    if (!wrap) return;
    wrap.innerHTML = buildInvoiceInnerHtml(formState, profiles[formState.profilId]);
  }

  function render() {
    const root = document.getElementById('module-body-arajanlat');
    if (!root) return;
    if (screen === 'editor' && formState) renderEditorScreen(root);
    else if (screen === 'tipus' && activeTipus) renderTipusScreen(root);
    else renderListScreen(root);
  }

  function getDashboardStat() {
    const count = Object.keys(quotes).length;
    if (count === 0) return '<span class="dash-card-stat muted">még nincs adat</span>';
    const kft = Object.values(quotes).filter((q) => quoteTipus(q) === 'KFT').length;
    return `<span class="dash-card-stat">${count} árajánlat · ${kft} KFT / ${count - kft} EV</span>`;
  }

  function init() {
    window.DataLayer.watchArajanlatProfiles((p) => {
      profiles = p || {};
      profilesLoaded = true;
      maybeAutoSeed();
      if (screen !== 'editor') render();
    });
    window.DataLayer.watchArajanlatUgyfelek((u) => {
      ugyfelek = u || {};
      ugyfelekLoaded = true;
      maybeAutoSeed();
      if (screen !== 'editor') render();
    });
    window.DataLayer.watchArajanlatok((d) => {
      quotes = d || {};
      if (screen !== 'editor') render();
      window.DashboardStats?.refresh();
    });
  }

  window.ArajanlatModule = { init };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.arajanlat = {
    isDetail: () => screen === 'editor' || screen === 'tipus',
    goToList: () => {
      // Lépcsőzetes vissza: szerkesztő → típus lista → főoldal
      if (screen === 'editor') { screen = 'tipus'; formState = null; }
      else { screen = 'list'; activeTipus = null; }
      render();
      window.AppAnim?.ujra();
    },
    getDashboardStat
  };
})();



