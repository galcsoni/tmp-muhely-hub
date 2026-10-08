// ─────────────────────────────────────────────────────────────────────────
// Rajzolás-őr (RenderGuard)
//
// MIÉRT KELL:
// Az adatok a Firebase-ből élőben érkeznek. Eddig minden egyes változásnál
// a modul azonnal újrarajzolta a teljes képernyőt. Ha közben épp gépeltél
// egy mezőbe, a mező kicserélődött alattad: kiugrott a kurzor, és ami még
// nem volt elmentve, elveszett. Ez volt a "néha nem enged írni" hiba.
//
// MIT CSINÁL:
// Ha a felhasználó épp szerkeszt valamit, az újrarajzolást felfüggesztjük,
// és csak akkor hajtjuk végre, amikor kilépett a mezőből. Így soha nem
// cserélődik ki a kezed alatt a beviteli mező, viszont minden frissítés
// megérkezik, amint befejezted.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  // Függőben lévő rajzolások. Kulcs szerint tároljuk, hogy ha ugyanaz a
  // modul többször is frissülne várakozás közben, csak egyszer rajzoljunk.
  const fuggoben = new Map();
  let figyelo = null;

  // Épp szerkeszt a felhasználó?
  function szerkesztes() {
    const el = document.activeElement;
    if (!el || el === document.body) return false;

    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
    if (el.disabled || el.readOnly) return false;

    // A gombszerű és fájlválasztó mezők nem számítanak szerkesztésnek
    const tipus = (el.type || '').toLowerCase();
    if (tipus === 'file' || tipus === 'button' || tipus === 'submit' ||
        tipus === 'checkbox' || tipus === 'radio') return false;

    return true;
  }

  function fuggobenLevoketFuttat() {
    if (szerkesztes()) return;          // még mindig gépel, várunk tovább
    if (figyelo) { clearInterval(figyelo); figyelo = null; }
    const munkak = Array.from(fuggoben.values());
    fuggoben.clear();
    munkak.forEach((fn) => {
      try { fn(); } catch (e) { /* egy hibás rajzolás ne vigye el a többit */ }
    });
  }

  function figyelesIndit() {
    if (figyelo) return;
    // Kétféleképpen is figyelünk: eseményre (azonnali) és időzítve
    // (biztonsági háló, ha az esemény valamiért elmarad).
    figyelo = setInterval(fuggobenLevoketFuttat, 400);
  }

  document.addEventListener('focusout', () => {
    // A focusout a régi mezőről szól; adunk egy pillanatot, hogy a fókusz
    // ráálljon a következőre, mielőtt döntünk.
    setTimeout(fuggobenLevoketFuttat, 60);
  }, true);

  // Ha a felhasználó máshová kattint vagy ESC-el, azonnal ellenőrizzük
  document.addEventListener('mousedown', () => setTimeout(fuggobenLevoketFuttat, 60), true);

  /**
   * Így hívd a Firebase-figyelőkből a rajzolást:
   *   window.RenderGuard.rajzol(render, 'raktar');
   *
   * Ha a felhasználó épp szerkeszt, a rajzolás elhalasztódik, amíg
   * ki nem lép a mezőből. Egyébként azonnal lefut.
   */
  function rajzol(fn, kulcs) {
    if (typeof fn !== 'function') return;
    if (!szerkesztes()) { fn(); return; }
    fuggoben.set(kulcs || fn, fn);
    figyelesIndit();
  }

  /**
   * Azonnali rajzolás, a védelem megkerülésével. Akkor kell, amikor maga a
   * felhasználó váltott képernyőt vagy nyomott egy gombot - olyankor a
   * frissítés az ő szándéka.
   */
  function azonnal(fn) {
    fuggoben.delete(fn);
    try { fn(); } catch (e) { /* csendben */ }
  }

  window.RenderGuard = { rajzol, azonnal, szerkesztes };
})();
