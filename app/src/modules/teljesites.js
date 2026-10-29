// ─────────────────────────────────────────────────────────────────────────
// Teljesítési igazolás modul
//
// MIÉRT KELL:
// A Pipelife minden számla mellé kér egy teljesítési igazolást is. A papírt
// ők adták meg, a formátumot nem változtathatjuk meg - csak a három aláhúzott
// sort töltjük ki minden alkalommal:
//   - Elvégzett munkák
//   - Beszerzési megrendelési szám
//   - Teljesítés ideje
// Minden más (megrendelő és vállalkozó adatai, a két záró mondat) fix.
//
// HOL VAN:
// Az Árajánlat modulon belül, az "EV árajánlatok" és "KFT árajánlatok"
// kártyák mellett egy harmadik kártyaként. Az arajanlat.js hívja meg.
//
// Az aláírás a src/lib/alairas.js-ből jön (beágyazott, átlátszó hátterű kép),
// és a Vállalkozó oldali vonal fölé kerül.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  let igazolasok = {};
  let kepernyo = null;      // null = nem itt vagyunk | 'lista' | 'szerkeszto'
  let aktivId = null;
  let urlap = null;

  // ── FIX ADATOK ────────────────────────────────────────────────────────
  // A megrendelő adatai a kapott dokumentumból valók. Ha a Pipelife egyszer
  // címet vált, a szerkesztőben a "Megrendelő adatai" résznél át lehet írni,
  // nem kell hozzányúlni a programhoz.
  const MEGRENDELO = {
    nev: 'Pipelife Hungária Kft.',
    szekhely: 'Kishegyesi út 263. 4031 Debrecen.',
    adoszam: '10411377-2-09'
  };

  // A vállalkozó mi vagyunk - a KFT nevében megy ki (nem az EV-ében).
  const VALLALKOZO = {
    nev: 'Tmp Audio Kft.',
    szekhely: '4032 Debrecen, Füredi út 98. Fsz. 5.',
    adoszam: '32540141-2-09'
  };

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function ma() { return new Date().toISOString().slice(0, 10); }

  // 2026-07-27 → "2026. 07. 27."  (a kapott dokumentum formátuma)
  function datumSzoveg(iso) {
    if (!iso) return '';
    const r = String(iso).split('-');
    if (r.length !== 3) return iso;
    return `${r[0]}. ${r[1]}. ${r[2]}.`;
  }

  function ujIgazolas() {
    return {
      elvegzettMunkak: '',
      megrendelesiSzam: '',
      teljesitesIdeje: ma(),
      keltHelye: 'Debrecen',
      keltDatuma: ma(),
      megrendeloNev: MEGRENDELO.nev,
      megrendeloSzekhely: MEGRENDELO.szekhely,
      megrendeloAdoszam: MEGRENDELO.adoszam,
      letrehozva: Date.now()
    };
  }

  function cimke(r) {
    const t = (r.elvegzettMunkak || '').trim().split('\n')[0];
    return t || 'Névtelen igazolás';
  }

  // ── MAGA A DOKUMENTUM ─────────────────────────────────────────────────
  // A kapott Word-fájl beállításai: A4, 2,5 cm margó, Times New Roman,
  // 11 pt törzs, 18 pt középre zárt cím. Ezeket tartjuk.
  const TELJ_CSS = `
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    .tlj-lap {
      background: #FFFFFF;
      color: #000000;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      padding: 25mm;
      min-height: 297mm;
    }
    .tlj-cim {
      text-align: center;
      font-size: 18pt;
      font-weight: bold;
      margin: 0 0 26px;
    }
    .tlj-fel { margin-bottom: 18px; }
    .tlj-fel-cim { font-weight: bold; margin-bottom: 2px; }
    .tlj-sor { margin: 0; }
    .tlj-mezo { margin: 0 0 6px; }
    .tlj-mezo u { text-decoration: underline; }
    .tlj-ertek { white-space: pre-wrap; }
    .tlj-vastag { font-weight: bold; }
    .tlj-szoveg { margin: 18px 0; }
    .tlj-kelt { margin: 26px 0 0; }
    .tlj-alairasok {
      display: flex;
      gap: 40px;
      margin-top: 30px;
    }
    .tlj-alairas-blokk { flex: 1; text-align: center; }
    .tlj-alairas-cimke { margin-bottom: 4px; }
    /* A tollvonás alja szándékosan a vonal alá lóg egy kicsit - ettől néz ki
       úgy, mintha a papírra írták volna. Ezért itt NEM lehet overflow:hidden,
       mert az levágná az aláírás alját. */
    .tlj-alairas-hely {
      height: 70px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .tlj-alairas-kep {
      height: 92px;
      width: auto;
      max-width: 90%;
      object-fit: contain;
      margin-bottom: -18px;
    }
    .tlj-alairas-vonal { border-bottom: 1px dotted #000000; }
  `;

  // A dokumentum stílusát egyszer töltjük be az alkalmazásba. Ugyanez a
  // szöveg megy a PDF-be is (lásd onalloHtml), így a képernyőn látott kép és
  // a kinyomtatott papír garantáltan megegyezik.
  (function stilustBetolt() {
    if (document.getElementById('tlj-stilus')) return;
    const st = document.createElement('style');
    st.id = 'tlj-stilus';
    st.textContent = TELJ_CSS + `
      /* Csak a programban, a PDF-ben nem: lapszerű keret a szerkesztő mellett */
      #tlj-elonezet-keret .tlj-lap {
        border: 1px solid #E3DACC;
        border-radius: 4px;
        box-shadow: 0 10px 30px rgba(42, 37, 32, 0.08);
        min-height: auto;
      }
      @media print {
        #tlj-elonezet-keret .tlj-lap {
          border: none; border-radius: 0; box-shadow: none; padding: 0;
        }
        @page { size: A4; margin: 25mm; }
      }
    `;
    document.head.appendChild(st);
  })();

  function dokumentumHtml(r) {
    const alairas = window.TMP_ALAIRAS
      ? `<img class="tlj-alairas-kep" src="${window.TMP_ALAIRAS}" alt="aláírás" />`
      : '';
    return `
      <div class="tlj-lap">
        <p class="tlj-cim">Teljesítési igazolás</p>

        <div class="tlj-fel">
          <div class="tlj-fel-cim">Megrendelő:</div>
          <p class="tlj-sor">Neve: ${escapeHtml(r.megrendeloNev || MEGRENDELO.nev)}</p>
          <p class="tlj-sor">Székhelye: ${escapeHtml(r.megrendeloSzekhely || MEGRENDELO.szekhely)}</p>
          <p class="tlj-sor">Adószáma: ${escapeHtml(r.megrendeloAdoszam || MEGRENDELO.adoszam)}</p>
        </div>

        <div class="tlj-fel">
          <div class="tlj-fel-cim">Vállalkozó:</div>
          <p class="tlj-sor">Neve: ${escapeHtml(VALLALKOZO.nev)}</p>
          <p class="tlj-sor">Székhelye: ${escapeHtml(VALLALKOZO.szekhely)}</p>
          <p class="tlj-sor">Adószáma: ${escapeHtml(VALLALKOZO.adoszam)}</p>
        </div>

        <p class="tlj-mezo"><u>Elvégzett munkák</u>: <span class="tlj-ertek">${escapeHtml(r.elvegzettMunkak)}</span></p>
        <p class="tlj-mezo"><u>Beszerzési megrendelési szám</u>: <span class="tlj-vastag">${escapeHtml(r.megrendelesiSzam)}</span></p>
        <p class="tlj-mezo"><u>Teljesítés ideje</u>: ${escapeHtml(datumSzoveg(r.teljesitesIdeje))}</p>

        <p class="tlj-szoveg">Szolgáltató a megrendelőlap (szerződés) szerint megrendelt szolgáltatásokat a megrendelésnek megfelelően teljesítette.</p>
        <p class="tlj-szoveg">A teljesítés kapcsán az elvégzett munka ellenőrzéséről számla kiállítására és benyújtására jogosult a megállapításban rögzített feltételekkel.</p>

        <p class="tlj-kelt">Kelt: ${escapeHtml(r.keltHelye || 'Debrecen')}. ${escapeHtml(datumSzoveg(r.keltDatuma))}</p>

        <div class="tlj-alairasok">
          <div class="tlj-alairas-blokk">
            <div class="tlj-alairas-cimke">Megrendelő</div>
            <div class="tlj-alairas-hely"></div>
            <div class="tlj-alairas-vonal"></div>
          </div>
          <div class="tlj-alairas-blokk">
            <div class="tlj-alairas-cimke">Vállalkozó</div>
            <div class="tlj-alairas-hely">${alairas}</div>
            <div class="tlj-alairas-vonal"></div>
          </div>
        </div>
      </div>
    `;
  }

  function onalloHtml(r) {
    return `<!DOCTYPE html><html lang="hu"><head><meta charset="UTF-8"><style>${TELJ_CSS}
      body { margin: 0; }
      .tlj-lap { min-height: auto; }
    </style></head><body>${dokumentumHtml(r)}</body></html>`;
  }

  // ── MENTÉS ────────────────────────────────────────────────────────────
  // Mint az árajánlatnál: gépelés közben nem írunk minden betűnél a felhőbe,
  // megvárjuk a fél másodperc szünetet. Nyomtatás/PDF/kilépés előtt viszont
  // azonnal mentünk, hogy semmi ne vesszen el.
  let mentesTimer = null;

  function ment() {
    if (mentesTimer) clearTimeout(mentesTimer);
    mentesTimer = setTimeout(() => {
      mentesTimer = null;
      if (aktivId && urlap) window.DataLayer.teljesitesWrite(aktivId, urlap);
    }, 500);
  }

  function mentAzonnal() {
    if (mentesTimer) { clearTimeout(mentesTimer); mentesTimer = null; }
    if (aktivId && urlap) window.DataLayer.teljesitesWrite(aktivId, urlap);
  }

  window.addEventListener('beforeunload', () => { if (mentesTimer) mentAzonnal(); });

  // ── LISTA KÉPERNYŐ ────────────────────────────────────────────────────
  function listaRajzol(root) {
    const sorok = Object.entries(igazolasok)
      .sort((a, b) => (b[1].letrehozva || 0) - (a[1].letrehozva || 0));

    root.innerHTML = `
      <div class="toolbar">
        <button id="tlj-uj" class="btn-primary" style="margin-top:0;">+ Új teljesítési igazolás</button>
      </div>
      <p class="grid-title">Teljesítési igazolások · ${escapeHtml(MEGRENDELO.nev)}</p>
      ${sorok.length === 0 ? `
        <p class="empty-state">Még nincs egy igazolás sem. A „+ Új teljesítési igazolás” gombbal tudsz létrehozni egyet.</p>
      ` : `
        <div class="card-grid">
          ${sorok.map(([id, r]) => `
            <div class="category-card-tile" data-open="${id}" style="border-top:3px solid #6B7A63;">
              <span class="cat-type-tag" style="border-color:#6B7A63;color:#6B7A63;">${escapeHtml(datumSzoveg(r.teljesitesIdeje))}</span>
              <div class="cat-name">${escapeHtml(cimke(r))}</div>
              <div class="cat-stat">${r.megrendelesiSzam ? 'Megrendelés: ' + escapeHtml(r.megrendelesiSzam) : 'nincs megrendelési szám'}</div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    document.getElementById('tlj-uj')?.addEventListener('click', () => {
      const rekord = ujIgazolas();
      window.DataLayer.teljesitesAdd(rekord).then((id) => {
        aktivId = id;
        urlap = rekord;
        kepernyo = 'szerkeszto';
        rajzol();
        window.AppAnim?.ujra();
      });
    });

    root.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        aktivId = el.dataset.open;
        urlap = Object.assign(ujIgazolas(), igazolasok[aktivId]);
        kepernyo = 'szerkeszto';
        rajzol();
        window.AppAnim?.ujra();
      });
    });
  }

  // ── SZERKESZTŐ KÉPERNYŐ ───────────────────────────────────────────────
  function szerkesztoRajzol(root) {
    const r = urlap;

    root.innerHTML = `
      <div class="category-detail-head aj-editor-toolbar">
        <div style="flex:1;min-width:200px;font-family:var(--font-display);font-weight:700;font-size:17px;">
          Teljesítési igazolás
        </div>
        <button class="btn-secondary" id="tlj-print" style="margin-top:0;">🖨️ Nyomtatás</button>
        <button class="btn-primary" id="tlj-pdf">⬇️ PDF letöltés</button>
        <button class="btn-tiny btn-danger" id="tlj-torles">Törlés</button>
      </div>

      <div class="arajanlat-editor">
        <div class="aj-form-panel">
          <h4 style="margin-top:0;">Kitöltendő mezők</h4>

          <div>
            <span class="field-label">Elvégzett munkák</span>
            <textarea class="cell-input" data-f="elvegzettMunkak" rows="3"
              placeholder="pl. FTM 330 panel javítás. Az összeg tartalmazza a tervezési díjat (10db)"
              style="resize:vertical;width:100%;">${escapeHtml(r.elvegzettMunkak)}</textarea>
          </div>

          <div>
            <span class="field-label">Beszerzési megrendelési szám</span>
            <input class="cell-input" data-f="megrendelesiSzam" value="${escapeHtml(r.megrendelesiSzam)}" placeholder="pl. 4508129156" />
          </div>

          <div>
            <span class="field-label">Teljesítés ideje</span>
            <input class="cell-input" type="date" data-f="teljesitesIdeje" value="${escapeHtml(r.teljesitesIdeje)}" style="width:100%;" />
          </div>

          <h4>Keltezés</h4>
          <div style="display:flex;gap:8px;">
            <div style="flex:1;">
              <span class="field-label">Hely</span>
              <input class="cell-input" data-f="keltHelye" value="${escapeHtml(r.keltHelye)}" />
            </div>
            <div style="flex:1;">
              <span class="field-label">Dátum</span>
              <input class="cell-input" type="date" data-f="keltDatuma" value="${escapeHtml(r.keltDatuma)}" />
            </div>
          </div>

          <details class="tlj-reszletek">
            <summary>Megrendelő adatai (ritkán kell hozzányúlni)</summary>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
              <div><span class="field-label">Neve</span><input class="cell-input" data-f="megrendeloNev" value="${escapeHtml(r.megrendeloNev)}" /></div>
              <div><span class="field-label">Székhelye</span><input class="cell-input" data-f="megrendeloSzekhely" value="${escapeHtml(r.megrendeloSzekhely)}" /></div>
              <div><span class="field-label">Adószáma</span><input class="cell-input" data-f="megrendeloAdoszam" value="${escapeHtml(r.megrendeloAdoszam)}" /></div>
            </div>
          </details>

          <p class="tlj-sugo">
            A vállalkozó adatai és az aláírás fixen a KFT-é, azokat nem kell kitölteni.
          </p>
        </div>

        <div id="tlj-elonezet-keret">${dokumentumHtml(r)}</div>
      </div>
    `;

    document.getElementById('tlj-print')?.addEventListener('click', () => {
      mentAzonnal();
      window.print();
    });

    document.getElementById('tlj-pdf')?.addEventListener('click', async () => {
      mentAzonnal();
      const html = onalloHtml(urlap);
      const nevResz = cimke(urlap).replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ]+/g, '_').slice(0, 50);
      const javasoltNev = `TMP_teljesitesi_igazolas_${nevResz}_${urlap.teljesitesIdeje}.pdf`;
      if (window.nativeApp?.saveQuotePdf) {
        const eredmeny = await window.nativeApp.saveQuotePdf(html, javasoltNev);
        if (eredmeny.ok) alert('PDF elmentve: ' + eredmeny.filePath);
        else if (!eredmeny.canceled) alert('Hiba történt a PDF mentésekor: ' + (eredmeny.error || 'ismeretlen hiba'));
      } else {
        alert('Ez böngészőben fut, itt nincs közvetlen PDF-mentés.\n\nHasználd a "Nyomtatás" gombot, és a nyomtatóablakban válaszd célnak a "Mentés PDF-ként" lehetőséget.');
      }
    });

    document.getElementById('tlj-torles')?.addEventListener('click', () => {
      if (!confirm('Törlöd ezt a teljesítési igazolást?')) return;
      window.DataLayer.teljesitesDelete(aktivId);
      aktivId = null;
      urlap = null;
      kepernyo = 'lista';
      rajzol();
      window.AppAnim?.ujra();
    });

    root.querySelectorAll('[data-f]').forEach((el) => {
      el.addEventListener('input', (e) => {
        urlap[e.target.dataset.f] = e.target.value;
        ment();
        elonezetFrissit();
      });
    });
  }

  function elonezetFrissit() {
    const keret = document.getElementById('tlj-elonezet-keret');
    if (keret) keret.innerHTML = dokumentumHtml(urlap);
  }

  // ── KÉPERNYŐKEZELÉS ───────────────────────────────────────────────────
  function rajzol() {
    const root = document.getElementById('module-body-arajanlat');
    if (!root || !kepernyo) return;
    if (kepernyo === 'szerkeszto' && urlap) szerkesztoRajzol(root);
    else listaRajzol(root);
  }

  function init() {
    window.DataLayer.watchTeljesitesek((d) => {
      igazolasok = d || {};
      // Szerkesztés közben nem rajzolunk újra, nehogy kiugorjon a kurzor.
      if (kepernyo === 'lista') window.RenderGuard.rajzol(rajzol, 'teljesites');
    });
  }

  window.TeljesitesModul = {
    init,
    darab: () => Object.keys(igazolasok).length,
    // Egy rekord dokumentum-HTML-je önmagában (előnézethez, teszteléshez)
    elonezet: (rekord) => dokumentumHtml(Object.assign(ujIgazolas(), rekord || {})),
    benne: () => kepernyo !== null,
    // Belépés az Árajánlat főoldalán lévő kártyáról
    nyit() {
      kepernyo = 'lista';
      aktivId = null;
      urlap = null;
      rajzol();
    },
    rajzol,
    // Lépcsőzetes vissza. false = már kiléptünk, az Árajánlat vegye át.
    vissza() {
      if (kepernyo === 'szerkeszto') {
        mentAzonnal();
        kepernyo = 'lista';
        aktivId = null;
        urlap = null;
        rajzol();
        return true;
      }
      kepernyo = null;
      return false;
    }
  };
})();
