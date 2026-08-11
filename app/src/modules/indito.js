// ─────────────────────────────────────────────────────────────────────────
// Indító animáció
// Induláskor egy teljes képernyős krém felület, közepén a logó:
// felúszik, megrajzolódik körülötte egy körív, majd az egész elhalványul.
// Kattintásra vagy bármely gombra azonnal átugorható.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const IDO = 2200;          // teljes hossz ezredmásodpercben
  let lezarva = false;

  function bezar(azonnal) {
    if (lezarva) return;
    lezarva = true;
    const el = document.getElementById('indito');
    if (!el) return;
    el.classList.add('tunik');
    setTimeout(() => el.remove(), azonnal ? 60 : 480);
    document.body.classList.remove('indul');
  }

  function indit() {
    // Ha nincs logó (pl. hiányzik a sprite fájl), nem erőltetjük
    if (!window.TMP_LOGO) return;

    const el = document.createElement('div');
    el.id = 'indito';
    el.innerHTML = `
      <div class="indito-belso">
        <svg class="indito-gyuru" viewBox="0 0 200 200" aria-hidden="true">
          <circle class="indito-gyuru-alap" cx="100" cy="100" r="92" />
          <circle class="indito-gyuru-rajz" cx="100" cy="100" r="92" />
        </svg>
        <img class="indito-logo" src="${window.TMP_LOGO}" alt="TMP" />
      </div>
      <div class="indito-nev">Műhely Hub</div>
      <div class="indito-sor"><span></span></div>
    `;
    document.body.appendChild(el);
    document.body.classList.add('indul');

    setTimeout(() => bezar(false), IDO);
    el.addEventListener('click', () => bezar(true));
    window.addEventListener('keydown', function egyszer() {
      window.removeEventListener('keydown', egyszer);
      bezar(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', indit);
  } else {
    indit();
  }

  window.InditoAnimacio = { bezar };
})();
