// ─────────────────────────────────────────────────────────────────────────
// Katalógus - a termék oldala
//
// Egy hosszú, végiggörgethető katalógusoldal:
//   nagy borítókép → cím, leírás → műszaki adatok → fázisok egymás alatt
//
// A fázisok képei VÁLTAKOZVA jelennek meg: első kép balra, mellette a
// szöveg; következő kép jobbra, mellette a szöveg; és így tovább.
//
// A képekre jelöléseket lehet tenni (mi hol van a panelen), amik a Raktár
// alkatrészeire mutatnak.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const B = () => window.KatalogusBelso;
  let jeloles = false;

  function esc(s) { return B().esc(s); }
  function tobbSoros(s) { return B().tobbSoros(s); }

  // ── Jelölések kirajzolása egy kép fölé ────────────────────────────────
  function pontokHtml(kep, kepId, termekId) {
    return Object.entries(kep.pontok || {}).map(([pid, p], i) => {
      const a = B().alkatresz(p.katId, p.partId);
      return `
        <button class="kat-pont ${a ? '' : 'hianyzo'}" data-pont="${pid}" data-kep="${kepId}"
                style="left:${p.x}%;top:${p.y}%;" title="${esc(a ? a.nev : 'törölt alkatrész')}">
          <span class="kat-pont-szam">${i + 1}</span>
          <span class="kat-pont-cimke">${esc(a ? a.nev : 'törölt alkatrész')}${(Number(p.db) || 1) > 1 ? ` · ${Number(p.db)} db` : ''}${p.megjegyzes ? ' 💬' : ''}</span>
        </button>
      `;
    }).join('');
  }

  // ── Egy kép-blokk: kép az egyik oldalon, szöveg a másikon ─────────────
  function kepSor(termekId, fazisId, kepId, kep, index, fazisSzoveg) {
    const key = B().kepKulcs(termekId, fazisId, kepId);
    const url = B().kepCache[key];
    const balra = index % 2 === 0;
    const pontok = Object.entries(kep.pontok || {});
    const szerk = B().szerkesztes;

    const kepOldal = `
      <div class="kat-sor-kep">
        <div class="kat-kep-keret ${jeloles ? 'jelolo' : ''}" data-kepkeret="${kepId}" data-fazis="${fazisId}">
          ${url
            ? `<img src="${url}" alt="" />`
            : `<div class="kat-kep-tolt" data-kephely="${key}"><span>kép betöltése…</span></div>`}
          ${pontokHtml(kep, kepId, termekId)}
        </div>
        <div class="kat-kep-labjegyzet">
          <span class="kat-kep-sorszam">${index + 1}. kép</span>
          ${pontok.length ? `<span class="kat-kep-pontdb">${pontok.length} jelölés</span>` : ''}
          <span style="flex:1;"></span>
          <button class="kat-mini-gomb" data-nagyit="${kepId}" data-fazis="${fazisId}">Nagyban</button>
          ${szerk ? `<button class="kat-mini-gomb piros" data-kep-torol="${kepId}" data-fazis="${fazisId}">Törlés</button>` : ''}
        </div>
      </div>
    `;

    const szovegOldal = `
      <div class="kat-sor-szoveg">
        ${kep.felirat || szerk ? `
          ${szerk
            ? `<textarea class="kat-kep-felirat-input" data-kepfelirat="${kepId}" data-fazis="${fazisId}"
                        rows="6" placeholder="Mit látunk ezen a képen? Mit kell csinálni ennél a lépésnél?">${esc(kep.felirat || '')}</textarea>`
            : `<p class="kat-kep-felirat">${tobbSoros(kep.felirat)}</p>`}
        ` : (index === 0 && fazisSzoveg ? `<p class="kat-kep-felirat">${tobbSoros(fazisSzoveg)}</p>` : '')}

        ${pontok.length ? `
          <div class="kat-pont-jegyzek">
            ${pontok.map(([pid, p], i) => {
              const a = B().alkatresz(p.katId, p.partId);
              return `
                <span class="kat-jegyzek-elem" data-pont-ugras="${pid}">
                  <span class="kat-jegyzek-szam">${i + 1}</span>
                  ${esc(a ? a.nev : 'törölt')}
                </span>`;
            }).join('')}
          </div>` : ''}
      </div>
    `;

    return `
      <div class="kat-kep-sor ${balra ? 'balra' : 'jobbra'}">
        ${balra ? kepOldal + szovegOldal : szovegOldal + kepOldal}
      </div>
    `;
  }

  // ── Alkatrész-választó jelöléshez ─────────────────────────────────────
  function alkatreszValaszto(termekId, fazisId, kepId, x, y) {
    let szuro = '';
    function rajzol() {
      const talalatok = [];
      Object.entries(B().raktarData).forEach(([katId, kat]) => {
        Object.entries(kat.parts || {}).forEach(([partId, part]) => {
          const nev = part.name || '';
          if (szuro && !`${nev} ${kat.title || ''}`.toLowerCase().includes(szuro.toLowerCase())) return;
          talalatok.push({ katId, partId, nev, kat: kat.title || '', van: Number(part.qty_van || 0) });
        });
      });
      const lista = talalatok.slice(0, 60);

      const content = window.AppModal.open(`
        <div class="repair-detail-header" style="margin-bottom:14px;">
          <span style="font-family:var(--font-display);font-weight:700;font-size:19px;flex:1;">Mi van itt a képen?</span>
        </div>
        <div class="detail-fields-card">
          <input id="kat-valaszto-kereso" class="search-input" style="width:100%;margin-bottom:12px;"
                 placeholder="Keresés a raktárban…" value="${esc(szuro)}" />
          <div class="kat-valaszto-lista">
            ${lista.length ? lista.map((t) => `
              <button class="kat-valaszto-sor" data-vk="${t.katId}" data-vp="${t.partId}">
                <span class="kat-valaszto-nev">${esc(t.nev)}</span>
                <span class="kat-valaszto-hol">${esc(t.kat)}</span>
                <span class="kat-valaszto-db">${t.van} db</span>
              </button>`).join('') : '<p class="empty-state">Nincs találat a raktárban.</p>'}
          </div>
          <p style="font-size:11.5px;color:var(--text-dim);margin:12px 0 0;line-height:1.6;">
            Nem találod? Előbb vedd fel a Raktár modulban.
          </p>
        </div>
      `);

      content.querySelector('#kat-valaszto-kereso')?.addEventListener('input', (e) => {
        const c = e.target.selectionStart;
        szuro = e.target.value;
        rajzol();
        const uj = document.querySelector('#kat-valaszto-kereso');
        if (uj) { uj.focus(); uj.setSelectionRange(c, c); }
      });

      content.querySelectorAll('[data-vk]').forEach((el) => {
        el.addEventListener('click', () => {
          // Alkatrész kiválasztva - most jön a darabszám és a megjegyzés
          reszletekAblak(termekId, fazisId, kepId, null, {
            x, y, katId: el.dataset.vk, partId: el.dataset.vp, db: 1, megjegyzes: ''
          });
        });
      });
    }
    rajzol();
  }

  // ── Jelölés részletei: hány darab és miért ────────────────────────────
  // Új jelölésnél és meglévő szerkesztésénél is ez az ablak jön fel.
  // pontId === null  ->  új jelölés
  function reszletekAblak(termekId, fazisId, kepId, pontId, pont) {
    const a = B().alkatresz(pont.katId, pont.partId);
    const ujE = pontId === null;

    const content = window.AppModal.open(`
      <div class="repair-detail-header" style="margin-bottom:16px;">
        <span style="font-family:var(--font-display);font-weight:700;font-size:19px;flex:1;">
          ${esc(a ? a.nev : 'Ismeretlen alkatrész')}
        </span>
        ${a ? `<span class="cat-type-tag">${esc(a.kategoria)}</span>` : ''}
      </div>
      <div class="detail-fields-card">
        <div class="field-grid" style="margin-bottom:16px;">
          <div>
            <span class="field-label">Hány darab kell ide?</span>
            <input id="kat-pont-db" class="cell-input num" type="number" min="1" step="1"
                   value="${Number(pont.db) || 1}" style="width:100%;font-size:17px;" />
          </div>
          ${a ? `<div>
            <span class="field-label">Raktáron</span>
            <div style="font-size:17px;font-weight:600;padding-top:6px;color:${a.van > 0 ? 'var(--ok)' : 'var(--warn)'};">${a.van} db</div>
          </div>` : ''}
        </div>
        <span class="field-label">Megjegyzés (nem kötelező)</span>
        <textarea id="kat-pont-megj" class="note-input" rows="3" style="width:100%;margin-bottom:18px;"
                  placeholder="pl. polaritásra figyelj, a csíkos oldal nézzen befelé">${esc(pont.megjegyzes || '')}</textarea>
        <div style="display:flex;gap:9px;">
          <button class="btn-primary" id="kat-pont-ok" style="margin-top:0;">${ujE ? 'Jelölés felvétele' : 'Mentés'}</button>
          <button class="btn-secondary" id="kat-pont-megse" style="margin-top:0;">Mégse</button>
          ${ujE ? '' : '<span style="flex:1;"></span><button class="btn-tiny btn-danger" id="kat-pont-torol">Jelölés törlése</button>'}
        </div>
      </div>
    `);

    const beolvas = () => ({
      db: Math.max(1, Number(content.querySelector('#kat-pont-db').value) || 1),
      megjegyzes: content.querySelector('#kat-pont-megj').value.trim()
    });

    content.querySelector('#kat-pont-ok').addEventListener('click', () => {
      const ertek = beolvas();
      if (ujE) {
        window.DataLayer.katPontAdd(termekId, fazisId, kepId, { ...pont, ...ertek });
      } else {
        window.DataLayer.katPontUpdate(termekId, fazisId, kepId, pontId, ertek);
      }
      window.AppModal.close();
    });
    content.querySelector('#kat-pont-megse').addEventListener('click', () => window.AppModal.close());
    content.querySelector('#kat-pont-torol')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a jelölést?')) return;
      window.DataLayer.katPontDelete(termekId, fazisId, kepId, pontId);
      window.AppModal.close();
    });

    setTimeout(() => content.querySelector('#kat-pont-db')?.focus(), 50);
  }

  // ── Teljes képernyős nézet ────────────────────────────────────────────
  function nagyitas(termekId, fazisId, kepId, kep) {
    const url = B().kepCache[B().kepKulcs(termekId, fazisId, kepId)];
    if (!url) return;
    const pontok = Object.entries(kep.pontok || {});
    const el = document.createElement('div');
    el.id = 'kat-nagyito';
    el.innerHTML = `
      <div class="kat-nagyito-fejlec">
        <span class="kat-nagyito-cim">${pontok.length ? `${pontok.length} jelölés` : 'nincs jelölés'}</span>
        <button class="btn-tiny" id="kat-nagyito-zar">Bezárás (ESC)</button>
      </div>
      <div class="kat-nagyito-kozep">
        <div class="kat-nagyito-keret">
          <img src="${url}" alt="" />
          ${pontokHtml(kep, kepId, termekId)}
        </div>
      </div>
    `;
    document.body.appendChild(el);
    const zar = () => { el.remove(); window.removeEventListener('keydown', kez); };
    const kez = (e) => { if (e.key === 'Escape') zar(); };
    window.addEventListener('keydown', kez);
    el.querySelector('#kat-nagyito-zar').addEventListener('click', zar);
    el.addEventListener('click', (e) => { if (e.target === el) zar(); });
    el.querySelectorAll('[data-pont]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = kep.pontok[b.dataset.pont];
        if (p) B().alkatreszAblak(p.katId, p.partId, p);
      });
    });
  }

  // ── A teljes oldal ────────────────────────────────────────────────────
  function render(root) {
    const tid = B().aktivTermekId;
    const t = B().data[tid];
    if (!t) { B().vissza(); return window.KatalogusModule.render(); }

    const szerk = B().szerkesztes;
    const szin = B().TIPUS_SZINEK[t.tipus] || 'var(--accent)';
    const fazisok = B().rendez(t.fazisok);
    const adatok = B().rendez(t.adatok);
    const alk = B().termekAlkatreszek(t);
    const borito = B().kepCache[`borito/${tid}`];

    let osszAr = 0;
    alk.forEach((a) => { if (a.adat) osszAr += a.adat.ar * a.db; });

    // képsorszám az egész oldalon végigfut, hogy a váltakozás folytonos legyen
    let kepIndex = -1;

    root.innerHTML = `
      <div class="kat-oldal-sav">
        <button class="btn-tiny" id="kat-vissza">← Összes termék</button>
        <span style="flex:1;"></span>
        ${szerk ? `
          <button class="btn-secondary ${jeloles ? 'aktiv-jeloles' : ''}" id="kat-jeloles" style="margin-top:0;">
            ${jeloles ? '✓ Jelölés mód BE' : '📍 Jelölés mód'}
          </button>
          <button class="btn-tiny" id="kat-uj-fazis">+ Új fázis</button>
          <button class="btn-tiny btn-danger" id="kat-termek-torol">Termék törlése</button>
        ` : ''}
        <button class="btn-primary" id="kat-szerk-kapcs" style="margin-top:0;">
          ${szerk ? '✓ Kész, mehet az olvasás' : '✎ Szerkesztés'}
        </button>
      </div>

      ${jeloles && szerk ? `
        <div class="kat-jeloles-sav">
          <strong>Jelölés mód aktív.</strong> Kattints a fotón oda, ahol egy alkatrész van,
          és válaszd ki a raktárból - utána megadhatod, hány darab kell és miért.
          Meglévő pontra kattintva módosíthatod vagy törölheted.
        </div>` : ''}

      <article class="kat-oldal">

        <!-- ── Fejléc: borítókép és cím ── -->
        <header class="kat-fejlec">
          <div class="kat-fejlec-kep" data-boritohely="${tid}">
            ${borito
              ? `<img src="${borito}" alt="" />`
              : `<div class="kat-fejlec-ures">🔧</div>`}
            ${szerk ? `
              <input type="file" id="kat-borito-input" accept="image/*" style="display:none;" />
              <button class="kat-borito-gomb" id="kat-borito-fel">${borito ? 'Borítókép cseréje' : '+ Borítókép'}</button>
            ` : ''}
          </div>
          <div class="kat-fejlec-szoveg">
            <span class="kat-fejlec-tipus" style="color:${szin};border-color:${szin};">${esc(t.tipus || 'termék')}</span>
            ${szerk
              ? `<input class="kat-cim-input" data-mezo="nev" value="${esc(t.nev)}" />
                 <select class="cat-type-select" data-mezo="tipus" style="margin-bottom:14px;">
                   <option value="">— típus —</option>
                   ${B().TIPUSOK.map((x) => `<option value="${x}" ${t.tipus === x ? 'selected' : ''}>${x}</option>`).join('')}
                 </select>
                 <input class="cell-input" data-mezo="rovidLeiras" value="${esc(t.rovidLeiras)}"
                        placeholder="Egy mondat a termékről" style="width:100%;margin-bottom:14px;" />
                 <textarea class="note-input" data-mezo="leiras" rows="6" style="width:100%;"
                           placeholder="Részletes leírás: mit tud, kinek való, mire figyelj a gyártásnál…">${esc(t.leiras)}</textarea>`
              : `<h1 class="kat-cim">${esc(t.nev)}</h1>
                 ${t.rovidLeiras ? `<p class="kat-alcim">${esc(t.rovidLeiras)}</p>` : ''}
                 ${t.leiras ? `<p class="kat-bevezeto">${tobbSoros(t.leiras)}</p>` : ''}`}
          </div>
        </header>

        <!-- ── Műszaki adatok ── -->
        ${adatok.length || szerk ? `
          <section class="kat-adatok-blokk">
            <h2 class="kat-szakasz-cim">Műszaki adatok
              ${szerk ? '<button class="kat-mini-gomb" id="kat-uj-adat">+ Sor</button>' : ''}
            </h2>
            ${adatok.length ? `
              <div class="kat-adat-racs">
                ${adatok.map(([aid, a]) => szerk
                  ? `<div class="kat-adat-par szerk">
                       <input class="kat-adat-input" data-adat="${aid}" data-resz="cimke" value="${esc(a.cimke)}" placeholder="Megnevezés" />
                       <input class="kat-adat-input" data-adat="${aid}" data-resz="ertek" value="${esc(a.ertek)}" placeholder="Érték" />
                       <button class="kat-adat-x" data-adat-torol="${aid}">×</button>
                     </div>`
                  : `<div class="kat-adat-par">
                       <span class="kat-adat-cimke">${esc(a.cimke)}</span>
                       <span class="kat-adat-ertek">${esc(a.ertek)}</span>
                     </div>`).join('')}
              </div>` : '<p class="kat-halvany">Még nincs megadva műszaki adat.</p>'}
          </section>` : ''}

        <!-- ── Fázisok ── -->
        ${fazisok.length ? fazisok.map(([fid, f], fi) => {
          const kepek = B().rendez(f.kepek);
          return `
            <section class="kat-fazis" data-fazisblokk="${fid}">
              <div class="kat-fazis-fejlec">
                <span class="kat-fazis-jel" style="background:${szin};">${fi + 1}</span>
                ${szerk
                  ? `<input class="kat-fazis-cim-input" data-fmezo="cim" data-fazis="${fid}" value="${esc(f.cim)}" />`
                  : `<h2 class="kat-fazis-cim">${esc(f.cim)}</h2>`}
                ${szerk ? `
                  <input type="file" class="kat-fazis-kep-input" data-kepinput="${fid}" accept="image/*" multiple style="display:none;" />
                  <button class="kat-mini-gomb" data-kep-fel="${fid}">+ Fotó</button>
                  <button class="kat-mini-gomb piros" data-fazis-torol="${fid}">Fázis törlése</button>
                ` : ''}
              </div>

              ${szerk ? `
                <div class="kat-fazis-mezok">
                  <textarea class="note-input" data-fmezo="leiras" data-fazis="${fid}" rows="3" style="width:100%;margin-bottom:10px;"
                            placeholder="Bevezető ehhez a fázishoz (az első kép mellett jelenik meg, ha annak nincs saját felirata)">${esc(f.leiras)}</textarea>
                  <textarea class="note-input" data-fmezo="figyelem" data-fazis="${fid}" rows="2" style="width:100%;"
                            placeholder="Mire figyelj! (pirossal kiemelve jelenik meg)">${esc(f.figyelem)}</textarea>
                </div>` : ''}

              ${f.figyelem ? `
                <div class="kat-figyelem">
                  <span class="kat-figyelem-ikon">⚠️</span>
                  <span>${tobbSoros(f.figyelem)}</span>
                </div>` : ''}

              ${kepek.length
                ? kepek.map(([kid, k]) => { kepIndex += 1; return kepSor(tid, fid, kid, k, kepIndex, f.leiras); }).join('')
                : `<p class="kat-halvany kat-nincs-kep-sor">
                     ${szerk ? 'Ehhez a fázishoz még nincs fotó. Nyomd meg a „+ Fotó" gombot.' : 'Ehhez a fázishoz még nincs fotó.'}
                   </p>`}
            </section>
          `;
        }).join('') : `
          <p class="kat-halvany" style="text-align:center;padding:40px 0;">
            Ehhez a termékhez még nincs összeszerelési fázis.
            ${szerk ? '' : 'Kapcsold be a szerkesztést, és vegyél fel egyet.'}
          </p>`}

        <!-- ── Alkatrészlista ── -->
        ${alk.length ? `
          <section class="kat-alk-blokk">
            <h2 class="kat-szakasz-cim">Beépített alkatrészek <span class="kat-halvany-kicsi">${alk.length} féle</span></h2>
            <div class="kat-alk-racs">
              ${alk.map((a) => {
                if (!a.adat) return `<div class="kat-alk-kartya hianyzo"><span>Törölt alkatrész</span><span class="kat-alk-db">${a.db}×</span></div>`;
                const keves = a.adat.van < a.db;
                return `
                  <div class="kat-alk-kartya" data-alk-kat="${a.katId}" data-alk-part="${a.partId}">
                    <div class="kat-alk-fo">
                      <span class="kat-alk-nev">${esc(a.adat.nev)}</span>
                        <span class="kat-alk-hol">${esc(a.adat.kategoria)}${
                        a.jelolesek > 1 ? ` · ${a.jelolesek} helyen` : ''
                      }${(a.megjegyzesek && a.megjegyzesek.length) ? ' · 💬' : ''}</span>
                    </div>
                    <span class="kat-alk-keszlet ${keves ? 'keves' : ''}">${a.adat.van} db raktáron</span>
                    <span class="kat-alk-db">${a.db}×</span>
                  </div>`;
              }).join('')}
            </div>
            ${osszAr > 0 ? `<p class="kat-alk-ossz">Anyagköltség a jelölt alkatrészekből: <strong>${osszAr.toLocaleString('hu-HU')} Ft</strong></p>` : ''}
          </section>` : ''}

      </article>
    `;

    kotesek(root, tid, t);
  }

  // ── Eseménykezelők ────────────────────────────────────────────────────
  function kotesek(root, tid, t) {
    const szerk = B().szerkesztes;

    document.getElementById('kat-vissza')?.addEventListener('click', () => {
      window.ModuleNav.katalogus.goToList();
    });
    document.getElementById('kat-szerk-kapcs')?.addEventListener('click', () => {
      B().szerkesztes = !B().szerkesztes;
      if (!B().szerkesztes) jeloles = false;
      window.KatalogusModule.render();
    });
    document.getElementById('kat-jeloles')?.addEventListener('click', () => {
      jeloles = !jeloles;
      window.KatalogusModule.render();
    });
    document.getElementById('kat-uj-fazis')?.addEventListener('click', () => {
      window.AppKerdes.szoveg({
        cim: 'Új fázis',
        leiras: 'Mi az összeszerelés következő lépése?',
        hely: 'pl. Táppanel beültetése'
      }).then((cim) => {
        if (cim === null || !cim.trim()) return;
        window.DataLayer.katFazisAdd(tid, cim.trim());
      });
    });
    document.getElementById('kat-termek-torol')?.addEventListener('click', () => {
      if (!confirm(`Törlöd a(z) "${t.nev}" terméket az összes fázisával és képével együtt?`)) return;
      window.DataLayer.katTermekDelete(tid);
      window.ModuleNav.katalogus.goToList();
    });

    // Termék mezői
    root.querySelectorAll('[data-mezo]').forEach((el) => {
      el.addEventListener('change', (e) => {
        window.DataLayer.katTermekUpdate(tid, { [e.target.dataset.mezo]: e.target.value });
      });
    });

    // Borítókép
    document.getElementById('kat-borito-fel')?.addEventListener('click', () => {
      document.getElementById('kat-borito-input')?.click();
    });
    document.getElementById('kat-borito-input')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      B().kepZsugorit(f, B().BORITO_MAX).then((url) => {
        B().kepCache[`borito/${tid}`] = url;
        return window.DataLayer.katBoritoSet(tid, url);
      }).then(() => window.KatalogusModule.render())
        .catch((err) => alert('Hiba: ' + err.message));
    });

    // Fázis mezői
    root.querySelectorAll('[data-fmezo]').forEach((el) => {
      el.addEventListener('change', (e) => {
        window.DataLayer.katFazisUpdate(tid, e.target.dataset.fazis, { [e.target.dataset.fmezo]: e.target.value });
      });
    });
    root.querySelectorAll('[data-fazis-torol]').forEach((el) => {
      el.addEventListener('click', () => {
        if (!confirm('Törlöd ezt a fázist a képeivel együtt?')) return;
        window.DataLayer.katFazisDelete(tid, el.dataset.fazisTorol);
      });
    });

    // Fotó feltöltés fázisonként
    root.querySelectorAll('[data-kep-fel]').forEach((el) => {
      el.addEventListener('click', () => {
        root.querySelector(`[data-kepinput="${el.dataset.kepFel}"]`)?.click();
      });
    });
    root.querySelectorAll('[data-kepinput]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const f = e.target.files;
        if (!f || !f.length) return;
        B().kepFeltolt(tid, el.dataset.kepinput, f, () => window.KatalogusModule.render());
      });
    });

    // Képfelirat
    root.querySelectorAll('[data-kepfelirat]').forEach((el) => {
      el.addEventListener('change', (e) => {
        window.DataLayer.katKepFeliratSet(tid, e.target.dataset.fazis, e.target.dataset.kepfelirat, e.target.value);
      });
    });

    root.querySelectorAll('[data-kep-torol]').forEach((el) => {
      el.addEventListener('click', () => {
        if (!confirm('Törlöd ezt a képet a jelöléseivel együtt?')) return;
        window.DataLayer.katKepDelete(tid, el.dataset.fazis, el.dataset.kepTorol);
      });
    });

    root.querySelectorAll('[data-nagyit]').forEach((el) => {
      el.addEventListener('click', () => {
        const kep = t.fazisok?.[el.dataset.fazis]?.kepek?.[el.dataset.nagyit];
        if (kep) nagyitas(tid, el.dataset.fazis, el.dataset.nagyit, kep);
      });
    });

    // Műszaki adatok
    document.getElementById('kat-uj-adat')?.addEventListener('click', () => {
      window.DataLayer.katAdatAdd(tid, '', '');
    });
    root.querySelectorAll('[data-adat]').forEach((el) => {
      el.addEventListener('change', (e) => {
        window.DataLayer.katAdatUpdate(tid, e.target.dataset.adat, { [e.target.dataset.resz]: e.target.value });
      });
    });
    root.querySelectorAll('[data-adat-torol]').forEach((el) => {
      el.addEventListener('click', () => window.DataLayer.katAdatDelete(tid, el.dataset.adatTorol));
    });

    // Jelölés a képen
    root.querySelectorAll('[data-kepkeret]').forEach((keret) => {
      keret.addEventListener('click', (e) => {
        if (!jeloles || !szerk) return;
        if (e.target.closest('.kat-pont')) return;
        const r = keret.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        if (x < 0 || x > 100 || y < 0 || y > 100) return;
        alkatreszValaszto(tid, keret.dataset.fazis, keret.dataset.kepkeret,
                          Math.round(x * 10) / 10, Math.round(y * 10) / 10);
      });
    });

    root.querySelectorAll('[data-pont]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const keret = el.closest('[data-kepkeret]');
        if (!keret) return;
        const p = t.fazisok?.[keret.dataset.fazis]?.kepek?.[keret.dataset.kepkeret]?.pontok?.[el.dataset.pont];
        if (!p) return;
        if (szerk) {
          // Szerkesztés közben a pontra kattintva módosítható a darabszám,
          // a megjegyzés, és innen törölhető is a jelölés.
          reszletekAblak(tid, keret.dataset.fazis, keret.dataset.kepkeret, el.dataset.pont, p);
          return;
        }
        B().alkatreszAblak(p.katId, p.partId, p);
      });
    });

    root.querySelectorAll('[data-pont-ugras]').forEach((el) => {
      el.addEventListener('click', () => {
        const cel = root.querySelector(`[data-pont="${el.dataset.pontUgras}"]`);
        if (!cel) return;
        cel.classList.add('kiemelt');
        cel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => cel.classList.remove('kiemelt'), 1800);
      });
    });

    root.querySelectorAll('[data-alk-kat]').forEach((el) => {
      el.addEventListener('click', () => B().alkatreszAblak(el.dataset.alkKat, el.dataset.alkPart));
    });

    // Hiányzó képek lekérése
    root.querySelectorAll('[data-kephely]').forEach((el) => {
      const [a, b, c] = el.dataset.kephely.split('/');
      B().kepBetolt(a, b, c);
    });
  }

  window.KatalogusOldal = { render };
})();
