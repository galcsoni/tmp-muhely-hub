// ─────────────────────────────────────────────────────────────────────────
// Katalógus modul - gyártási dokumentáció
//
// Két képernyő:
//   'lista'  - termékkártyák borítóképpel (mint a Raktárban)
//   'termek' - EGY HOSSZÚ KATALÓGUSOLDAL: nagy borítókép, leírás, majd a
//              fázisok egymás alatt. A képek váltakozva bal/jobb oldalon,
//              mellettük a szöveg.
//
// Az oldal alapból OLVASHATÓ, nem szerkeszthető - a mezők csak akkor
// jelennek meg, ha bekapcsolod a szerkesztés módot.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const TIPUSOK = ['Erősítő', 'Előfok', 'Hangfal', 'Tápegység', 'Kiegészítő', 'Egyéb'];
  const TIPUS_SZINEK = {
    'Erősítő': '#9C6B3F',
    'Előfok': '#7A5B8F',
    'Hangfal': '#5B7F99',
    'Tápegység': '#B0672E',
    'Kiegészítő': '#6B7A63',
    'Egyéb': '#8A837B'
  };

  const KEP_MAX = 1400;
  const KEP_MINOSEG = 0.82;
  const BORITO_MAX = 600;

  let data = {};
  let raktarData = {};
  let kereses = '';
  let screen = 'lista';
  let aktivTermekId = null;
  let szerkesztes = false;

  // Képgyorsítótár: egy kép munkamenetenként egyszer töltődik le
  const kepCache = {};
  const kepTolt = {};

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Sortöréseket megtartó szövegmegjelenítés
  function tobbSoros(str) {
    return esc(str).replace(/\n/g, '<br />');
  }

  function rovidUrl(url) {
    return String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').slice(0, 46);
  }

  function rendez(obj) {
    return Object.entries(obj || {}).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  }

  function alkatresz(katId, partId) {
    const kat = raktarData[katId];
    const part = kat && kat.parts ? kat.parts[partId] : null;
    if (!part) return null;
    return {
      nev: part.name || 'ismeretlen',
      ar: Number(part.price || 0),
      van: Number(part.qty_van || 0),
      kell: Number(part.qty_kell || 0),
      kategoria: kat.title || '',
      linkek: Object.values(part.links || {})
    };
  }

  // ── Képkezelés ────────────────────────────────────────────────────────
  function kepKulcs(t, f, k) { return `${t}/${f}/${k}`; }

  function kepZsugorit(file, maxMeret) {
    const MAX = maxMeret || KEP_MAX;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Nem sikerült beolvasni a fájlt.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Ez a fájl nem kép, vagy sérült.'));
        img.onload = () => {
          let { width: w, height: h } = img;
          const arany = Math.min(1, MAX / Math.max(w, h));
          w = Math.round(w * arany);
          h = Math.round(h * arany);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', KEP_MINOSEG));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function kepBetolt(termekId, fazisId, kepId) {
    const key = kepKulcs(termekId, fazisId, kepId);
    if (key in kepCache || kepTolt[key]) return;
    kepTolt[key] = true;
    window.DataLayer.katKepGet(termekId, fazisId, kepId).then((url) => {
      kepCache[key] = url || null;
      delete kepTolt[key];
      render();
    }).catch(() => { delete kepTolt[key]; });
  }

  function boritoBetolt(termekId) {
    const key = `borito/${termekId}`;
    if (key in kepCache || kepTolt[key]) return;
    kepTolt[key] = true;
    window.DataLayer.katBoritoGet(termekId).then((url) => {
      kepCache[key] = url || null;
      delete kepTolt[key];
      render();
    }).catch(() => { delete kepTolt[key]; });
  }

  function kepFeltolt(termekId, fazisId, fajlok, utana) {
    const lista = Array.from(fajlok).filter((f) => f.type.startsWith('image/'));
    if (!lista.length) return;
    let kesz = 0;
    lista.forEach((file) => {
      kepZsugorit(file)
        .then((url) => window.DataLayer.katKepAdd(termekId, fazisId, url)
          .then((kepId) => { kepCache[kepKulcs(termekId, fazisId, kepId)] = url; }))
        .catch((err) => alert('Hiba a kép feltöltésekor: ' + err.message))
        .then(() => { kesz += 1; if (kesz === lista.length && utana) utana(); });
    });
  }

  // ── Összesített alkatrészlista ────────────────────────────────────────
  function termekAlkatreszek(termek) {
    const map = {};
    Object.values(termek.fazisok || {}).forEach((fazis) => {
      Object.values(fazis.kepek || {}).forEach((kep) => {
        Object.values(kep.pontok || {}).forEach((pont) => {
          if (!pont.partId) return;
          const kulcs = `${pont.katId}/${pont.partId}`;
          if (!map[kulcs]) {
            map[kulcs] = { katId: pont.katId, partId: pont.partId, db: 0, jelolesek: 0, megjegyzesek: [] };
          }
          // A régi jelöléseknél még nincs darabszám - azok 1 darabnak számítanak
          map[kulcs].db += Math.max(1, Number(pont.db) || 1);
          map[kulcs].jelolesek += 1;
          if (pont.megjegyzes) map[kulcs].megjegyzesek.push(pont.megjegyzes);
        });
      });
    });
    return Object.values(map).map((x) => ({ ...x, adat: alkatresz(x.katId, x.partId) }));
  }

  // ── LISTA: termékkártyák borítóképpel ─────────────────────────────────
  function renderLista(root) {
    const termekek = rendez(data).filter(([, t]) => {
      if (!kereses) return true;
      const q = kereses.toLowerCase();
      return `${t.nev || ''} ${t.tipus || ''} ${t.rovidLeiras || ''}`.toLowerCase().includes(q);
    });

    root.innerHTML = `
      <div class="toolbar">
        <input id="kat-kereso" class="search-input" placeholder="Keresés termék neve vagy típusa szerint…" value="${esc(kereses)}" />
        <button id="kat-uj" class="btn-primary">+ Új termék</button>
      </div>
      <div class="kat-termek-racs">
        ${termekek.map(([id, t]) => {
          const szin = TIPUS_SZINEK[t.tipus] || 'var(--border-light)';
          const key = `borito/${id}`;
          const borito = kepCache[key];
          const fazisDb = Object.keys(t.fazisok || {}).length;
          let kepDb = 0;
          Object.values(t.fazisok || {}).forEach((f) => { kepDb += Object.keys(f.kepek || {}).length; });
          return `
            <div class="kat-termek-kartya" data-nyit="${id}">
              <div class="kat-kartya-kep" data-borito="${id}">
                ${borito
                  ? `<img src="${borito}" alt="" />`
                  : `<span class="kat-kartya-ures">${key in kepCache ? '🔧' : ''}</span>`}
                <span class="kat-kartya-tipus" style="background:${szin};">${esc(t.tipus || 'egyéb')}</span>
              </div>
              <div class="kat-kartya-also">
                <div class="kat-kartya-nev">${esc(t.nev)}</div>
                ${t.rovidLeiras ? `<div class="kat-kartya-leiras">${esc(t.rovidLeiras)}</div>` : ''}
                <div class="kat-kartya-meta">${fazisDb ? `${fazisDb} fázis · ${kepDb} kép` : 'még nincs dokumentálva'}</div>
              </div>
            </div>
          `;
        }).join('') || `<p class="empty-state">${kereses ? 'Nincs találat.' : 'Még nincs termék. Vegyél fel egyet, és kezdd el dokumentálni.'}</p>`}
      </div>
    `;

    document.getElementById('kat-kereso')?.addEventListener('input', (e) => {
      const c = e.target.selectionStart;
      kereses = e.target.value;
      render();
      const i = document.getElementById('kat-kereso');
      if (i) { i.focus(); i.setSelectionRange(c, c); }
    });
    document.getElementById('kat-uj')?.addEventListener('click', () => {
      window.AppKerdes.szoveg({
        cim: 'Új termék',
        leiras: 'Melyik termék dokumentációját kezdjük el?',
        hely: 'pl. Cosmos'
      }).then((nev) => {
        if (nev === null || !nev.trim()) return;
        return window.DataLayer.katTermekAdd(nev.trim());
      }).then((id) => {
        if (!id) return;
        aktivTermekId = id;
        screen = 'termek';
        szerkesztes = true;
        render();
        window.AppAnim?.ujra();
      });
    });
    root.querySelectorAll('[data-nyit]').forEach((el) => {
      el.addEventListener('click', () => {
        aktivTermekId = el.dataset.nyit;
        screen = 'termek';
        szerkesztes = false;
        render();
        window.AppAnim?.ujra();
      });
    });

    // borítóképek lekérése
    root.querySelectorAll('[data-borito]').forEach((el) => boritoBetolt(el.dataset.borito));
  }

  // ── Alkatrész-buborék ─────────────────────────────────────────────────
  function alkatreszAblak(katId, partId, pont) {
    const a = alkatresz(katId, partId);
    // Ha nem egy konkrét jelölésről van szó (pl. az alkatrészlistából
    // nyitották meg), összeszedjük az összes hozzá tartozó megjegyzést.
    let osszMegjegyzes = [];
    if (!pont && aktivTermekId && data[aktivTermekId]) {
      const t = termekAlkatreszek(data[aktivTermekId])
        .find((x) => x.katId === katId && x.partId === partId);
      if (t) osszMegjegyzes = t.megjegyzesek || [];
    }
    if (!a) {
      window.AppModal.open('<p class="empty-state">Ez az alkatrész már nem található a raktárban.</p>');
      return;
    }
    const keves = a.van < a.kell;
    window.AppModal.open(`
      <div class="repair-detail-header" style="margin-bottom:16px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:20px;flex:1;">${esc(a.nev)}</span>
        <span class="cat-type-tag">${esc(a.kategoria)}</span>
      </div>
      <div class="detail-fields-card">
        <div class="field-grid">
          <div><span class="field-label">Készleten</span>
            <div style="font-size:19px;font-weight:600;color:${keves ? 'var(--warn)' : 'var(--ok)'};">${a.van} db</div></div>
          <div><span class="field-label">Kellene</span>
            <div style="font-size:19px;font-weight:600;">${a.kell} db</div></div>
          <div><span class="field-label">Ár</span>
            <div style="font-size:19px;font-weight:600;">${a.ar ? a.ar.toLocaleString('hu-HU') + ' Ft' : '—'}</div></div>
        </div>
        ${pont && pont.db ? `
          <div style="margin-top:16px;">
            <span class="field-label">Ehhez a ponthoz</span>
            <p style="font-size:15px;font-weight:600;margin:5px 0 0;">${Number(pont.db)} db kell</p>
          </div>` : ''}
        ${pont && pont.megjegyzes ? `
          <div style="margin-top:16px;">
            <span class="field-label">Megjegyzés</span>
            <p class="kat-megjegyzes">${tobbSoros(pont.megjegyzes)}</p>
          </div>` : ''}
        ${!pont && osszMegjegyzes.length ? `
          <div style="margin-top:16px;">
            <span class="field-label">Megjegyzések a jelölésekből</span>
            ${osszMegjegyzes.map((m) => `<p class="kat-megjegyzes">${tobbSoros(m)}</p>`).join('')}
          </div>` : ''}
        ${a.linkek.length ? `
          <div style="margin-top:18px;">
            <span class="field-label" style="display:block;margin-bottom:8px;">Hol lehet megvenni</span>
            ${a.linkek.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener" class="kat-link-gomb">🔗 ${esc(rovidUrl(l))}</a>`).join('')}
          </div>
        ` : '<p style="font-size:12px;color:var(--text-dim);margin:16px 0 0;">Ehhez az alkatrészhez nincs beszerzési link a raktárban.</p>'}
      </div>
    `);
  }

  // ── Fő rajzoló ────────────────────────────────────────────────────────
  function render() {
    const root = document.getElementById('module-body-katalogus');
    if (!root) return;
    if (screen === 'termek') window.KatalogusOldal.render(root);
    else renderLista(root);
  }

  function getDashboardStat() {
    const db = Object.keys(data).length;
    if (!db) return '<span class="dash-card-stat muted">még nincs adat</span>';
    let fazis = 0, kep = 0;
    Object.values(data).forEach((t) => {
      const f = Object.values(t.fazisok || {});
      fazis += f.length;
      f.forEach((x) => { kep += Object.keys(x.kepek || {}).length; });
    });
    return `<span class="dash-card-stat">${db} termék · ${fazis} fázis · ${kep} kép</span>`;
  }

  function init() {
    window.DataLayer.watchKatalogus((d) => {
      data = d || {};
      render();
      window.DashboardStats?.refresh();
    });
    window.DataLayer.watchRaktar((d) => {
      raktarData = d || {};
      if (screen === 'termek') render();
    });
  }

  // Amit az oldal-modul használ
  window.KatalogusBelso = {
    esc, tobbSoros, rovidUrl, rendez, alkatresz, alkatreszAblak,
    kepKulcs, kepCache, kepBetolt, kepFeltolt, kepZsugorit, termekAlkatreszek,
    TIPUSOK, TIPUS_SZINEK, BORITO_MAX,
    get data() { return data; },
    get raktarData() { return raktarData; },
    get szerkesztes() { return szerkesztes; },
    set szerkesztes(v) { szerkesztes = v; },
    get aktivTermekId() { return aktivTermekId; },
    vissza: () => { screen = 'lista'; aktivTermekId = null; }
  };

  window.KatalogusModule = { init, render };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.katalogus = {
    isDetail: () => screen !== 'lista',
    goToList: () => {
      screen = 'lista';
      aktivTermekId = null;
      szerkesztes = false;
      render();
      window.AppAnim?.ujra();
    },
    getDashboardStat
  };
})();
