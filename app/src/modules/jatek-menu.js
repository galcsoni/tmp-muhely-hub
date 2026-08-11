// ─────────────────────────────────────────────────────────────────────────
// Easter egg: játékválasztó
// A rejtett "unatkozom" feliratra kattintva ez jön fel: két kártya, és
// eldöntheted, melyik játékot indítod.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const GAMES = [
    {
      id: 'tank',
      cim: 'Tankcsata',
      alcim: '10 pálya · bázisvédelem',
      leiras: 'Védd meg a bázisod a támadó tankoktól. Téglafalak szétlőhetők, acél nem, bokorban el lehet bújni. Minden pálya nehezebb az előzőnél.',
      indit: () => window.JatekModule?.open()
    },
    {
      id: 'kigyo',
      cim: 'Kígyó',
      alcim: 'végtelen · rekordvadászat',
      leiras: 'A klasszikus. Minden falattal hosszabb és gyorsabb leszel. A sárga csillag öt pontot ér, de csak pár másodpercig marad kint.',
      indit: () => window.KigyoModule?.open()
    }
  ];

  // Kis animált előnézet a kártyákra, hogy legyen egy kis élet bennük
  function tankIkon() {
    return `
      <svg viewBox="0 0 120 80" class="jatek-kartya-abra" aria-hidden="true">
        <rect x="0" y="0" width="120" height="80" fill="#2A2520" rx="8" />
        <g fill="#9C6B3F">
          <rect x="14" y="14" width="16" height="16" /><rect x="34" y="14" width="16" height="16" />
          <rect x="70" y="14" width="16" height="16" /><rect x="90" y="14" width="16" height="16" />
          <rect x="14" y="46" width="16" height="16" /><rect x="90" y="46" width="16" height="16" />
        </g>
        <rect x="52" y="46" width="16" height="16" fill="#B8B2A8" />
        <g transform="translate(50,26)">
          <rect x="0" y="0" width="20" height="20" fill="#3E5B70" />
          <rect x="4" y="4" width="12" height="12" fill="#5B7F99" />
          <rect x="8" y="-6" width="4" height="10" fill="#3E5B70" />
        </g>
        <rect x="58" y="8" width="4" height="4" fill="#F5EFE6" />
      </svg>
    `;
  }

  function kigyoIkon() {
    return `
      <svg viewBox="0 0 120 80" class="jatek-kartya-abra" aria-hidden="true">
        <rect x="0" y="0" width="120" height="80" fill="#2A2520" rx="8" />
        <g fill="#5B7F99">
          <rect x="18" y="46" width="14" height="14" rx="4" />
          <rect x="34" y="46" width="14" height="14" rx="4" />
          <rect x="50" y="46" width="14" height="14" rx="4" />
          <rect x="50" y="30" width="14" height="14" rx="4" />
          <rect x="50" y="14" width="14" height="14" rx="4" />
        </g>
        <rect x="66" y="14" width="14" height="14" rx="4" fill="#7FA8C4" />
        <circle cx="76" cy="18" r="1.8" fill="#1C1A18" />
        <circle cx="76" cy="24" r="1.8" fill="#1C1A18" />
        <circle cx="98" cy="21" r="6" fill="#B0453A" />
        <rect x="97" y="12" width="2" height="4" fill="#6B8F5E" />
      </svg>
    `;
  }

  const IKONOK = { tank: tankIkon, kigyo: kigyoIkon };

  let keyHandler = null;

  function close() {
    window.removeEventListener('keydown', keyHandler);
    document.getElementById('jatek-menu-overlay')?.remove();
  }

  function open() {
    if (document.getElementById('jatek-menu-overlay')) return;
    if (document.getElementById('jatek-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'jatek-menu-overlay';
    overlay.innerHTML = `
      <div class="jatek-menu-box">
        <p class="dash-title" style="text-align:center;">Na jó, egy kör belefér</p>
        <div class="dash-grid jatek-kartyak">
          ${GAMES.map((g) => `
            <div class="dash-card jatek-kartya" data-jatek="${g.id}">
              ${IKONOK[g.id]()}
              <div class="dash-card-title">${g.cim}</div>
              <span class="dash-card-stat">${g.alcim}</span>
              <p class="jatek-kartya-leiras">${g.leiras}</p>
            </div>
          `).join('')}
        </div>
        <button class="btn-tiny" id="jatek-menu-close">Mégse, dolgom van (ESC)</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-jatek]').forEach((el) => {
      el.addEventListener('click', () => {
        const g = GAMES.find((x) => x.id === el.dataset.jatek);
        close();
        g?.indit();
      });
    });
    document.getElementById('jatek-menu-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    keyHandler = (e) => {
      if (e.key === 'Escape') { close(); }
      else if (e.key === '1') { close(); GAMES[0].indit(); }
      else if (e.key === '2') { close(); GAMES[1].indit(); }
    };
    window.addEventListener('keydown', keyHandler);
  }

  window.JatekMenu = { open, close };
})();
