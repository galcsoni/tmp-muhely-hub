// ─────────────────────────────────────────────────────────────────────────
// Frissítés-értesítő az alkalmazás saját stílusában
//
// Ha van új verzió, jobb alul beúszik egy kártya a logóval:
//   "Frissítsd lécci!" + Letöltés gomb
// Letöltés közben folyamatjelző, a végén újraindítás gomb.
//
// Csak a telepített asztali appban működik - böngészőben nincs mit frissíteni.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  let doboz = null;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function letrehoz() {
    if (doboz) return doboz;
    doboz = document.createElement('div');
    doboz.id = 'frissites-doboz';
    document.body.appendChild(doboz);
    return doboz;
  }

  function bezar() {
    if (!doboz) return;
    doboz.classList.remove('lathato');
    setTimeout(() => { doboz?.remove(); doboz = null; }, 400);
  }

  function mutat(html, maradjon) {
    const d = letrehoz();
    d.innerHTML = `
      <div class="frissites-kartya">
        ${window.TMP_LOGO ? `<img class="frissites-logo" src="${window.TMP_LOGO}" alt="TMP" />` : ''}
        <div class="frissites-tartalom">${html}</div>
      </div>
    `;
    requestAnimationFrame(() => d.classList.add('lathato'));
    if (!maradjon) setTimeout(bezar, 4200);
    return d;
  }

  // ── Új verzió érhető el ───────────────────────────────────────────────
  function elerheto(adat) {
    const kezi = !!adat.kezi;   // macOS: nem tudja magát lecserélni
    const d = mutat(`
      <div class="frissites-cim">Frissítsd lécci!</div>
      <div class="frissites-alcim">
        Új verzió van: <strong>${escapeHtml(adat.verzio)}</strong>
        <span class="frissites-halvany">(most ${escapeHtml(adat.jelenlegi)})</span>
      </div>
      <p class="frissites-info">
        ${kezi
          ? 'Megnyitom a letöltési oldalt. Töltsd le a .dmg fájlt, és húzd át az appot a Programokba - a régit felülírja.'
          : 'Az adataidhoz nem nyúl, azok a felhőben vannak. Pár másodperc az egész.'}
      </p>
      <div class="frissites-gombok">
        <button class="frissites-fo" data-mit="letolt">${kezi ? 'Letöltési oldal' : 'Letöltés'}</button>
        <button class="frissites-mellek" data-mit="kesobb">Most nem</button>
      </div>
    `, true);

    d.querySelector('[data-mit="letolt"]')?.addEventListener('click', () => {
      window.nativeApp?.frissitesLetoltes();
      if (kezi) bezar(); else folyamat({ szazalek: 0 });
    });
    d.querySelector('[data-mit="kesobb"]')?.addEventListener('click', bezar);
  }

  // ── Letöltés folyamatban ──────────────────────────────────────────────
  function folyamat(adat) {
    const keres = adat.szazalek < 0;
    const d = letrehoz();
    d.innerHTML = `
      <div class="frissites-kartya">
        ${window.TMP_LOGO ? `<img class="frissites-logo" src="${window.TMP_LOGO}" alt="TMP" />` : ''}
        <div class="frissites-tartalom">
          <div class="frissites-cim">${keres ? 'Keresem…' : 'Töltöm…'}</div>
          <div class="frissites-alcim">
            ${keres ? 'Megnézem, van-e újabb verzió' : `${adat.szazalek}% kész`}
          </div>
          <div class="frissites-sav ${keres ? 'hataroz' : ''}">
            <span style="width:${keres ? 100 : adat.szazalek}%"></span>
          </div>
        </div>
      </div>
    `;
    requestAnimationFrame(() => d.classList.add('lathato'));
  }

  // ── Letöltve, jöhet az újraindítás ────────────────────────────────────
  function letoltve(adat) {
    const d = mutat(`
      <div class="frissites-cim">Kész, mehet!</div>
      <div class="frissites-alcim">A ${escapeHtml(adat.verzio)} verzió készen áll.</div>
      <p class="frissites-info">
        Újraindítom, és már az újban vagy. Ha most nem alkalmas,
        a következő bezáráskor magától felkerül.
      </p>
      <div class="frissites-gombok">
        <button class="frissites-fo" data-mit="ujraindit">Újraindítás</button>
        <button class="frissites-mellek" data-mit="kesobb">Később</button>
      </div>
    `, true);

    d.querySelector('[data-mit="ujraindit"]')?.addEventListener('click', () => {
      window.nativeApp?.frissitesTelepites();
    });
    d.querySelector('[data-mit="kesobb"]')?.addEventListener('click', bezar);
  }

  function naprakesz(adat) {
    if (adat && adat.fejlesztoi) {
      mutat(`
        <div class="frissites-cim">Fejlesztői mód</div>
        <div class="frissites-alcim">Itt nincs frissítéskeresés, csak a telepített appban.</div>
      `);
      return;
    }
    mutat(`
      <div class="frissites-cim">Naprakész vagy ✓</div>
      <div class="frissites-alcim">A legfrissebb verzió fut: ${escapeHtml(adat?.verzio || '')}</div>
    `);
  }

  function hiba(adat) {
    mutat(`
      <div class="frissites-cim">Nem sikerült</div>
      <div class="frissites-alcim">Nem értem el a frissítéseket — talán nincs net.</div>
      <p class="frissites-info">${escapeHtml((adat?.uzenet || '').slice(0, 120))}</p>
    `);
  }

  function init() {
    if (!window.nativeApp?.onFrissites) return;   // böngészőben nincs dolgunk
    window.nativeApp.onFrissites('frissites:elerheto', elerheto);
    window.nativeApp.onFrissites('frissites:folyamat', folyamat);
    window.nativeApp.onFrissites('frissites:letoltve', letoltve);
    window.nativeApp.onFrissites('frissites:naprakesz', naprakesz);
    window.nativeApp.onFrissites('frissites:hiba', hiba);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FrissitesUI = { bezar };
})();
