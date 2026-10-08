// ─────────────────────────────────────────────────────────────────────────
// Firebase kapcsolat + adatréteg
//
// Ez a fájl felel az összes Firebase kommunikációért. A modulok (raktar.js,
// javitas.js, stb.) SOHA nem hívnak Firebase API-t közvetlenül - mindig
// ezen a rétegen keresztül mennek. Így ha valaha váltani kellene backendet,
// csak ezt az egy fájlt kell átírni, a modulokat nem.
//
// ÚJ, TISZTA ADATSTRUKTÚRA (a régi v10_inv / v11_repairs / v12_orders
// zűrzavar helyett):
//
//   raktar/<kategoriaId>/
//       title, order, type ("mechanika" | "modul" | "egyeb")
//       parts/<alkatreszId>/
//           name, price, qty_van, qty_kell
//           links/<linkId>: "https://..."
//
//   javitas/<tetelId>/  ... (később)
//   kolcsonzes/<tetelId>/  ... (később)
//   rendelesek/<tetelId>/  ... (később)
//   todo/<szekcioId>/  ... (később)
// ─────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyAENLwbnDzQ9mYSAMWK_OYaSyfWTJlW8pY",
  authDomain: "keszlet-app.firebaseapp.com",
  projectId: "keszlet-app",
  databaseURL: "https://keszlet-app-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ── Kapcsolat állapota (online/offline jelzéshez a fejlécben) ──────────────
function onConnectionState(callback) {
  db.ref('.info/connected').on('value', (snap) => callback(!!snap.val()));
}

// ── Általános helper-ek ─────────────────────────────────────────────────
function pushId(path) {
  return db.ref(path).push().key;
}

function watchPath(path, callback) {
  const ref = db.ref(path);
  ref.on('value', (snap) => callback(snap.val() || {}));
  return () => ref.off('value');
}

function writeAt(path, value) {
  return db.ref(path).set(value);
}

function updateAt(path, patch) {
  return db.ref(path).update(patch);
}

function removeAt(path) {
  return db.ref(path).remove();
}

// ── RAKTÁR ──────────────────────────────────────────────────────────────
const RAKTAR_PATH = 'raktar';

function watchRaktar(callback) {
  return watchPath(RAKTAR_PATH, callback);
}

function raktarAddCategory({ title, type }) {
  const id = pushId(RAKTAR_PATH);
  return writeAt(`${RAKTAR_PATH}/${id}`, {
    title: title || 'Névtelen kategória',
    type: type || 'egyeb',
    order: Date.now(),
    parts: {}
  }).then(() => id);
}

function raktarUpdateCategory(categoryId, patch) {
  return updateAt(`${RAKTAR_PATH}/${categoryId}`, patch);
}

function raktarDeleteCategory(categoryId) {
  return removeAt(`${RAKTAR_PATH}/${categoryId}`);
}

function raktarAddPart(categoryId, part) {
  const id = pushId(`${RAKTAR_PATH}/${categoryId}/parts`);
  const record = {
    name: part.name || 'Névtelen alkatrész',
    price: Number(part.price) || 0,
    qty_van: Number(part.qty_van) || 0,
    qty_kell: Number(part.qty_kell) || 0,
    links: {}
  };
  if (Array.isArray(part.links)) {
    part.links.filter(Boolean).forEach((url) => {
      const linkId = pushId(`${RAKTAR_PATH}/${categoryId}/parts/${id}/links`);
      record.links[linkId] = url;
    });
  }
  return writeAt(`${RAKTAR_PATH}/${categoryId}/parts/${id}`, record).then(() => id);
}

function raktarUpdatePart(categoryId, partId, patch) {
  return updateAt(`${RAKTAR_PATH}/${categoryId}/parts/${partId}`, patch);
}

function raktarDeletePart(categoryId, partId) {
  return removeAt(`${RAKTAR_PATH}/${categoryId}/parts/${partId}`);
}

function raktarAddPartLink(categoryId, partId, url) {
  const linkId = pushId(`${RAKTAR_PATH}/${categoryId}/parts/${partId}/links`);
  return writeAt(`${RAKTAR_PATH}/${categoryId}/parts/${partId}/links/${linkId}`, url);
}

function raktarRemovePartLink(categoryId, partId, linkId) {
  return removeAt(`${RAKTAR_PATH}/${categoryId}/parts/${partId}/links/${linkId}`);
}

// ── EGYSZERI MIGRÁCIÓ a régi v10_inv struktúrából ──────────────────────
// Csak akkor fut le, ha a felhasználó a Raktár fülön rákattint a gombra.
// Nem törli a régi adatot - csak átmásolja tiszta formában az újba.
function migrateFromOldSchema() {
  return db.ref('v10_inv').once('value').then((snap) => {
    const old = snap.val() || {};
    const writes = {};
    Object.entries(old).forEach(([oldId, cat]) => {
      const newId = pushId(RAKTAR_PATH);
      const parts = {};
      if (cat.parts) {
        Object.entries(cat.parts).forEach(([partId, part]) => {
          const links = {};
          if (part.link) {
            const linkId = pushId(`${RAKTAR_PATH}/${newId}/parts/${partId}/links`);
            links[linkId] = part.link;
          }
          parts[partId] = {
            name: part.name || 'Névtelen alkatrész',
            price: Number(part.price) || 0,
            qty_van: Number(part.qty) || 0,
            qty_kell: 0,
            links
          };
        });
      }
      writes[newId] = {
        title: cat.title || 'Névtelen kategória',
        type: 'egyeb',
        order: cat.order != null ? cat.order : Date.now(),
        parts
      };
    });
    return db.ref(RAKTAR_PATH).update(writes).then(() => Object.keys(writes).length);
  });
}

// ── JAVÍTÁS ─────────────────────────────────────────────────────────────
const JAVITAS_PATH = 'javitas';

function watchJavitas(callback) {
  return watchPath(JAVITAS_PATH, callback);
}

function javitasAdd(record) {
  const id = pushId(JAVITAS_PATH);
  return writeAt(`${JAVITAS_PATH}/${id}`, {
    keszulek: record.keszulek || '',
    modell: record.modell || '',
    serial: record.serial || '',
    partner: record.partner || '',
    dateIn: record.dateIn || '',
    dateOut: record.dateOut || '',
    note: record.note || '',
    status: record.status || 'Ajánlat kért',
    alkatreszAr: Number(record.alkatreszAr) || 0,
    munkaora: Number(record.munkaora) || 0,
    vegosszeg: Number(record.vegosszeg) || 0
  }).then(() => id);
}

function javitasUpdate(id, patch) {
  return updateAt(`${JAVITAS_PATH}/${id}`, patch);
}

function javitasDelete(id) {
  return removeAt(`${JAVITAS_PATH}/${id}`);
}

// Egyszeri migráció a régi v11_repairs struktúrából. A "item" mező (pl.
// "Reach PAK800") átmásolódik a "keszulek" mezőbe - a "modell" üresen marad,
// mert a régi adatban nem volt szétválasztva, ezt utólag érdemes kitölteni.
// A régi "price" mező a "vegosszeg" (manuálisan felszámolt végösszeg) mezőbe
// kerül, mert korábban is ez volt a ténylegesen kiszámlázott összeg.
function migrateJavitasFromOld() {
  return db.ref('v11_repairs').once('value').then((snap) => {
    const old = snap.val() || {};
    const writes = {};
    Object.entries(old).forEach(([oldId, rec]) => {
      writes[oldId] = {
        keszulek: rec.item || '',
        modell: '',
        serial: rec.serial || '',
        partner: rec.partner || '',
        dateIn: rec.dateIn || '',
        dateOut: rec.dateOut || '',
        note: rec.note || '',
        status: rec.status || 'Ajánlat kért',
        alkatreszAr: 0,
        munkaora: 0,
        vegosszeg: Number(rec.price) || 0
      };
    });
    return db.ref(JAVITAS_PATH).update(writes).then(() => Object.keys(writes).length);
  });
}
// ── RENDELÉSEK ──────────────────────────────────────────────────────────
const RENDELES_PATH = 'rendelesek';

function watchRendelesek(callback) {
  return watchPath(RENDELES_PATH, callback);
}

function rendelesAdd(record) {
  const id = pushId(RENDELES_PATH);
  return writeAt(`${RENDELES_PATH}/${id}`, {
    nev: record.nev || '',
    email: record.email || '',
    telefon: record.telefon || '',
    termek: record.termek || '',
    igenyek: record.igenyek || '',
    ar: record.ar || '',
    szallitas: record.szallitas || '',
    szamlazasCim: record.szamlazasCim || '',
    rendelesDatuma: record.rendelesDatuma || '',
    cegforma: record.cegforma || 'EV',
    megjegyzes: record.megjegyzes || '',
    status: record.status || 'Rendelést adott le'
  }).then(() => id);
}

function rendelesUpdate(id, patch) {
  return updateAt(`${RENDELES_PATH}/${id}`, patch);
}

function rendelesDelete(id) {
  return removeAt(`${RENDELES_PATH}/${id}`);
}

// A Google Sheet "Date(Y,M,D)" formátumát alakítja YYYY-MM-DD-re
// (a hónap a Sheetben 0-indexelt, ezért +1 kell rá).
function parseSheetDate(str) {
  const m = /Date\((\d+),(\d+),(\d+)\)/.exec(str || '');
  if (!m) return '';
  const [, y, mo, d] = m;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(Number(mo) + 1)}-${pad(d)}`;
}

// Csak EGY régi rendelést emel át a v12_orders-ből, hogy legyen egy konkrét
// példa az új szerkezetben - nem az összeset, mert azok már nem kellenek.
function migrateOneRendelesFromOld() {
  return db.ref('v12_orders').limitToFirst(1).once('value').then((snap) => {
    const old = snap.val() || {};
    const [oldId, rec] = Object.entries(old)[0] || [];
    if (!rec) return 0;
    const f = rec.fields || {};
    return writeAt(`${RENDELES_PATH}/${oldId}`, {
      nev: f.nev || '',
      email: f.e_mail || '',
      telefon: f.telefonszam || '',
      termek: f.vasarolt_termek || '',
      igenyek: f.igenyek || '',
      ar: f.termek_ara || '',
      szallitas: f.szallitasi_adatok || '',
      szamlazasCim: f.szamlazasi_adatok || '',
      rendelesDatuma: parseSheetDate(f.rendeles_leadasanak_datuma),
      cegforma: 'EV',
      megjegyzes: '',
      status: f.allapot || 'Rendelést adott le'
    }).then(() => 1);
  });
}

// ── KÖLCSÖNZÉS ──────────────────────────────────────────────────────────
const KOLCSONZES_PATH = 'kolcsonzes';

function watchKolcsonzes(callback) {
  return watchPath(KOLCSONZES_PATH, callback);
}

function kolcsonzesAdd(record) {
  const id = pushId(KOLCSONZES_PATH);
  return writeAt(`${KOLCSONZES_PATH}/${id}`, {
    eszkoz: record.eszkoz || '',
    kolcsonvevo: record.kolcsonvevo || '',
    kolcsonzesDatuma: record.kolcsonzesDatuma || new Date().toISOString().slice(0, 10),
    visszahozasDatuma: record.visszahozasDatuma || '',
    megjegyzes: record.megjegyzes || '',
    status: record.status || 'Kölcsönben'
  }).then(() => id);
}

function kolcsonzesUpdate(id, patch) {
  return updateAt(`${KOLCSONZES_PATH}/${id}`, patch);
}

function kolcsonzesDelete(id) {
  return removeAt(`${KOLCSONZES_PATH}/${id}`);
}

// Migráció a régi v5_free_loans struktúrából.
function migrateKolcsonzesFromOld() {
  return db.ref('v5_free_loans').once('value').then((snap) => {
    const old = snap.val() || {};
    const writes = {};
    Object.entries(old).forEach(([oldId, rec]) => {
      writes[oldId] = {
        eszkoz: rec.deviceName || '',
        kolcsonvevo: rec.borrower || '',
        kolcsonzesDatuma: rec.loanDate || '',
        visszahozasDatuma: '',
        megjegyzes: '',
        status: rec.isReturned ? 'Visszahozva' : 'Kölcsönben'
      };
    });
    return db.ref(KOLCSONZES_PATH).update(writes).then(() => Object.keys(writes).length);
  });
}

// ── ÁRAJÁNLAT ───────────────────────────────────────────────────────────
const ARAJANLAT_PROFILES_PATH = 'arajanlat_profiles'; // EV / KFT kibocsátói profilok
const ARAJANLAT_UGYFELEK_PATH = 'arajanlat_ugyfelek'; // mentett, gyakori ügyfelek
const ARAJANLAT_PATH = 'arajanlatok';

function watchArajanlatProfiles(callback) {
  return watchPath(ARAJANLAT_PROFILES_PATH, callback);
}
function arajanlatProfileAdd(profile) {
  const id = pushId(ARAJANLAT_PROFILES_PATH);
  return writeAt(`${ARAJANLAT_PROFILES_PATH}/${id}`, profile).then(() => id);
}
function arajanlatProfileUpdate(id, patch) {
  return updateAt(`${ARAJANLAT_PROFILES_PATH}/${id}`, patch);
}
function arajanlatProfileDelete(id) {
  return removeAt(`${ARAJANLAT_PROFILES_PATH}/${id}`);
}

function watchArajanlatUgyfelek(callback) {
  return watchPath(ARAJANLAT_UGYFELEK_PATH, callback);
}
function arajanlatUgyfelAdd(ugyfel) {
  const id = pushId(ARAJANLAT_UGYFELEK_PATH);
  return writeAt(`${ARAJANLAT_UGYFELEK_PATH}/${id}`, ugyfel).then(() => id);
}
function arajanlatUgyfelUpdate(id, patch) {
  return updateAt(`${ARAJANLAT_UGYFELEK_PATH}/${id}`, patch);
}
function arajanlatUgyfelDelete(id) {
  return removeAt(`${ARAJANLAT_UGYFELEK_PATH}/${id}`);
}

function watchArajanlatok(callback) {
  return watchPath(ARAJANLAT_PATH, callback);
}

function arajanlatAdd(record) {
  const id = pushId(ARAJANLAT_PATH);
  return writeAt(`${ARAJANLAT_PATH}/${id}`, record).then(() => id);
}

// Az egész árajánlat-rekordot egyben írjuk (tételek/jegyzetek listát is
// tartalmaz), mert azokat egyszerűbb JS oldalon kezelni majd egyben menteni.
function arajanlatWrite(id, record) {
  return writeAt(`${ARAJANLAT_PATH}/${id}`, record);
}

function arajanlatDelete(id) {
  return removeAt(`${ARAJANLAT_PATH}/${id}`);
}

// ── TO-DO ───────────────────────────────────────────────────────────────
// Szerkezet: todo/<szekcioId>/ { name, order, tasks/<taskId>/ {...} }
const TODO_PATH = 'todo';

function watchTodo(callback) {
  return watchPath(TODO_PATH, callback);
}

function todoSectionAdd(name) {
  const id = pushId(TODO_PATH);
  return writeAt(`${TODO_PATH}/${id}`, {
    name: name || 'Új szekció',
    order: Date.now(),
    tasks: {}
  }).then(() => id);
}

function todoSectionUpdate(sectionId, patch) {
  return updateAt(`${TODO_PATH}/${sectionId}`, patch);
}

function todoSectionDelete(sectionId) {
  return removeAt(`${TODO_PATH}/${sectionId}`);
}

function todoTaskAdd(sectionId, task) {
  const id = pushId(`${TODO_PATH}/${sectionId}/tasks`);
  return writeAt(`${TODO_PATH}/${sectionId}/tasks/${id}`, {
    description: task.description || '',
    dueDate: task.dueDate || '',
    status: task.status || 'Fontos',
    createdAt: Date.now()
  }).then(() => id);
}

function todoTaskUpdate(sectionId, taskId, patch) {
  return updateAt(`${TODO_PATH}/${sectionId}/tasks/${taskId}`, patch);
}

function todoTaskDelete(sectionId, taskId) {
  return removeAt(`${TODO_PATH}/${sectionId}/tasks/${taskId}`);
}

// ── ALKATRÉSZ-KÉPEK ─────────────────────────────────────────────────────
// A bélyegképeket KÜLÖN ágon tároljuk (raktar_kepek/<kategoriaId>/<partId>),
// nem a raktar ágon belül. Így a raktár betöltése gyors marad: a képet csak
// akkor kérjük le, amikor tényleg meg kell jeleníteni.
// Formátum: base64 data URL, kliens oldalon max 200 px-re kicsinyítve.
const RAKTAR_KEP_PATH = 'raktar_kepek';

function raktarKepGet(categoryId, partId) {
  return db.ref(`${RAKTAR_KEP_PATH}/${categoryId}/${partId}`).once('value')
    .then((snap) => snap.val() || null);
}

function raktarKepSet(categoryId, partId, dataUrl) {
  return writeAt(`${RAKTAR_KEP_PATH}/${categoryId}/${partId}`, dataUrl);
}

function raktarKepDelete(categoryId, partId) {
  return removeAt(`${RAKTAR_KEP_PATH}/${categoryId}/${partId}`);
}

// ── DOKUMENTUMOK ────────────────────────────────────────────────────────
// Szerkezet: dokumentumok/<kategoriaId>/ { title, order, docs/<docId>/ {...} }
// Fájlt nem tárolunk (az tárhelydíjas lenne) - linkeket és jegyzeteket igen.
const DOKUMENTUM_PATH = 'dokumentumok';

function watchDokumentumok(callback) {
  return watchPath(DOKUMENTUM_PATH, callback);
}

function dokKategoriaAdd(title) {
  const id = pushId(DOKUMENTUM_PATH);
  return writeAt(`${DOKUMENTUM_PATH}/${id}`, {
    title: title || 'Névtelen kategória',
    order: Date.now(),
    docs: {}
  }).then(() => id);
}

function dokKategoriaUpdate(katId, patch) {
  return updateAt(`${DOKUMENTUM_PATH}/${katId}`, patch);
}

function dokKategoriaDelete(katId) {
  return removeAt(`${DOKUMENTUM_PATH}/${katId}`);
}

function dokAdd(katId, doc) {
  const id = pushId(`${DOKUMENTUM_PATH}/${katId}/docs`);
  return writeAt(`${DOKUMENTUM_PATH}/${katId}/docs/${id}`, {
    title: doc.title || '',
    type: doc.type || 'Egyéb',
    url: doc.url || '',
    note: doc.note || '',
    createdAt: Date.now()
  }).then(() => id);
}

function dokUpdate(katId, docId, patch) {
  return updateAt(`${DOKUMENTUM_PATH}/${katId}/docs/${docId}`, patch);
}

function dokDelete(katId, docId) {
  return removeAt(`${DOKUMENTUM_PATH}/${katId}/docs/${docId}`);
}

// ── KATALÓGUS (gyártási dokumentáció) ───────────────────────────────────
// Szerkezet:
//   katalogus/<termekId>/
//       nev, tipus, rovidLeiras, leiras, order, createdAt
//       adatok/<sorId>/ { cimke, ertek }          - műszaki adatok
//       fazisok/<fazisId>/
//           cim, leiras, figyelem, order
//           kepek/<kepId>/ { order, pontok/<pontId>/ {x, y, katId, partId, megjegyzes} }
//
// A KÉPEK NEM ITT vannak, hanem külön ágon (katalogus_kepek), hogy a
// katalógus betöltése gyors maradjon. A kép csak akkor töltődik le,
// amikor tényleg meg kell jeleníteni.
const KATALOGUS_PATH = 'katalogus';
const KATALOGUS_KEP_PATH = 'katalogus_kepek';

function watchKatalogus(callback) {
  return watchPath(KATALOGUS_PATH, callback);
}

// ── Termék ──
function katTermekAdd(nev, tipus) {
  const id = pushId(KATALOGUS_PATH);
  return writeAt(`${KATALOGUS_PATH}/${id}`, {
    nev: nev || 'Névtelen termék',
    tipus: tipus || '',
    rovidLeiras: '',
    leiras: '',
    order: Date.now(),
    createdAt: Date.now()
  }).then(() => id);
}

function katTermekUpdate(termekId, patch) {
  return updateAt(`${KATALOGUS_PATH}/${termekId}`, patch);
}

function katTermekDelete(termekId) {
  // a termék képeit is takarítjuk, különben árván maradnának
  return removeAt(`${KATALOGUS_KEP_PATH}/${termekId}`)
    .catch(() => {})
    .then(() => removeAt(`${KATALOGUS_PATH}/${termekId}`));
}

// ── Műszaki adatsorok ──
function katAdatAdd(termekId, cimke, ertek) {
  const id = pushId(`${KATALOGUS_PATH}/${termekId}/adatok`);
  return writeAt(`${KATALOGUS_PATH}/${termekId}/adatok/${id}`, {
    cimke: cimke || '', ertek: ertek || '', order: Date.now()
  }).then(() => id);
}

function katAdatUpdate(termekId, sorId, patch) {
  return updateAt(`${KATALOGUS_PATH}/${termekId}/adatok/${sorId}`, patch);
}

function katAdatDelete(termekId, sorId) {
  return removeAt(`${KATALOGUS_PATH}/${termekId}/adatok/${sorId}`);
}

// ── Fázisok (összeszerelési lépések) ──
function katFazisAdd(termekId, cim, order) {
  const id = pushId(`${KATALOGUS_PATH}/${termekId}/fazisok`);
  return writeAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${id}`, {
    cim: cim || 'Új fázis',
    leiras: '',
    figyelem: '',
    order: order != null ? order : Date.now()
  }).then(() => id);
}

function katFazisUpdate(termekId, fazisId, patch) {
  return updateAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}`, patch);
}

function katFazisDelete(termekId, fazisId) {
  return removeAt(`${KATALOGUS_KEP_PATH}/${termekId}/${fazisId}`)
    .catch(() => {})
    .then(() => removeAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}`));
}

// ── Képek ──
// A metaadat (sorrend, jelölt pontok) a katalogus ágon van, maga a
// képfájl a katalogus_kepek ágon. Így a pontokat lehet szerkeszteni
// anélkül, hogy a képet újra le kellene tölteni.
function katKepAdd(termekId, fazisId, dataUrl) {
  const id = pushId(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek`);
  return writeAt(`${KATALOGUS_KEP_PATH}/${termekId}/${fazisId}/${id}`, dataUrl)
    .then(() => writeAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek/${id}`, {
      order: Date.now()
    }))
    .then(() => id);
}

function katKepGet(termekId, fazisId, kepId) {
  return db.ref(`${KATALOGUS_KEP_PATH}/${termekId}/${fazisId}/${kepId}`).once('value')
    .then((snap) => snap.val() || null);
}

// A képhez tartozó magyarázó szöveg (a kép mellett jelenik meg az oldalon)
function katKepFeliratSet(termekId, fazisId, kepId, felirat) {
  return updateAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek/${kepId}`, { felirat: felirat || '' });
}

function katKepDelete(termekId, fazisId, kepId) {
  return removeAt(`${KATALOGUS_KEP_PATH}/${termekId}/${fazisId}/${kepId}`)
    .then(() => removeAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek/${kepId}`));
}

// Termék borítóképe (a kártyán jelenik meg) - külön ágon, hogy a
// katalógus listája gyorsan betöltsön.
function katBoritoSet(termekId, dataUrl) {
  return writeAt(`${KATALOGUS_KEP_PATH}/${termekId}/_borito`, dataUrl);
}

function katBoritoGet(termekId) {
  return db.ref(`${KATALOGUS_KEP_PATH}/${termekId}/_borito`).once('value')
    .then((snap) => snap.val() || null);
}

function katBoritoDelete(termekId) {
  return removeAt(`${KATALOGUS_KEP_PATH}/${termekId}/_borito`);
}

// ── Jelölt pontok a képen (hotspot) ──
// x, y: százalékban a kép bal felső sarkához képest - így a jelölés
// bármilyen méretben ugyanoda esik.
function katPontAdd(termekId, fazisId, kepId, pont) {
  const alap = `${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek/${kepId}/pontok`;
  const id = pushId(alap);
  return writeAt(`${alap}/${id}`, {
    x: pont.x, y: pont.y,
    katId: pont.katId || '',
    partId: pont.partId || '',
    megjegyzes: pont.megjegyzes || '',
    createdAt: Date.now()
  }).then(() => id);
}

function katPontUpdate(termekId, fazisId, kepId, pontId, patch) {
  return updateAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek/${kepId}/pontok/${pontId}`, patch);
}

function katPontDelete(termekId, fazisId, kepId, pontId) {
  return removeAt(`${KATALOGUS_PATH}/${termekId}/fazisok/${fazisId}/kepek/${kepId}/pontok/${pontId}`);
}

// ── MENTÉSEK ────────────────────────────────────────────────────────────
// Az alkalmazás összes éles adatága. A régi (v10_/v11_/v12_) ágakat NEM
// mentjük, azok csak a migrációhoz kellenek és úgyis megvannak a régi
// exportban.
const BACKUP_PATHS = [
  { path: 'raktar',             label: 'Raktár' },
  { path: 'javitas',            label: 'Javítás' },
  { path: 'rendelesek',         label: 'Rendelések' },
  { path: 'kolcsonzes',         label: 'Kölcsönzés' },
  { path: 'arajanlatok',        label: 'Árajánlatok' },
  { path: 'arajanlat_profiles', label: 'Árajánlat - kibocsátói profilok' },
  { path: 'arajanlat_ugyfelek', label: 'Árajánlat - mentett ügyfelek' },
  { path: 'todo',               label: 'TO-DO' },
  { path: 'dokumentumok',       label: 'Dokumentumok' },
  { path: 'raktar_kepek',       label: 'Alkatrész-képek' },
  { path: 'katalogus',          label: 'Katalógus (termékek, fázisok)' },
  { path: 'katalogus_kepek',    label: 'Katalógus - képek' }
];

const BACKUP_META_PATH = 'meta/backup';

// Egyszeri olvasás (nem figyelő) - a mentéshez kell.
function readOnce(path) {
  return db.ref(path).once('value').then((snap) => snap.val());
}

// Teljes mentés objektum összeállítása.
function backupBuild() {
  return Promise.all(BACKUP_PATHS.map((p) => readOnce(p.path)))
    .then((values) => {
      const data = {};
      BACKUP_PATHS.forEach((p, i) => { data[p.path] = values[i] || {}; });
      return {
        _tipus: 'TMP_Muhely_Hub_mentes',
        _verzio: 2,
        _keszult: new Date().toISOString(),
        adatok: data
      };
    });
}

// Visszaállítás: csak a kiválasztott ágakat írja felül, a többit békén hagyja.
function backupRestore(backup, selectedPaths) {
  const adatok = (backup && backup.adatok) || {};
  const writes = {};
  selectedPaths.forEach((path) => {
    if (Object.prototype.hasOwnProperty.call(adatok, path)) {
      writes[path] = adatok[path] || {};
    }
  });
  if (!Object.keys(writes).length) return Promise.resolve(0);
  return db.ref().update(writes).then(() => Object.keys(writes).length);
}

function watchBackupMeta(callback) {
  return watchPath(BACKUP_META_PATH, callback);
}

function backupMetaSet(patch) {
  return updateAt(BACKUP_META_PATH, patch);
}

// Migráció a régi v11_todos-ból. A régi appban a "Kész" egy külön
// gyűjtő-szekció volt - az új rendszerben a kész feladat a saját
// szekciójában marad "Kész" státusszal. Ezért a gyűjtőben lévő feladatokat
// visszatesszük az eredeti szekciójukba (originalSectionId alapján), a
// gyűjtő-szekciót pedig nem hozzuk át.
function migrateTodoFromOld() {
  return db.ref('v11_todos').once('value').then((snap) => {
    const old = snap.val() || {};

    // A "Kész" nevű gyűjtő-szekció azonosítása
    const doneSectionId = Object.keys(old).find((id) => (old[id].name || '') === 'Kész');

    const writes = {};
    Object.entries(old).forEach(([sectionId, section]) => {
      if (sectionId === doneSectionId) return;
      const tasks = {};
      Object.entries(section.tasks || {}).forEach(([taskId, t]) => {
        tasks[taskId] = {
          description: t.description || '',
          dueDate: t.dueDate || '',
          status: t.status || 'Fontos',
          createdAt: t.createdAt || Date.now()
        };
      });
      writes[sectionId] = {
        name: section.name || 'Névtelen szekció',
        order: section.order != null ? section.order : Date.now(),
        tasks
      };
    });

    // Gyűjtőben lévő kész feladatok vissza az eredeti szekcióba
    if (doneSectionId && old[doneSectionId].tasks) {
      Object.entries(old[doneSectionId].tasks).forEach(([taskId, t]) => {
        let target = t.originalSectionId && writes[t.originalSectionId] ? t.originalSectionId : null;
        if (!target) {
          // Ha az eredeti szekció már nem létezik, "Egyéb" szekcióba kerül
          target = Object.keys(writes).find((id) => writes[id].name === 'Egyéb');
          if (!target) {
            target = db.ref(TODO_PATH).push().key;
            writes[target] = { name: 'Egyéb', order: Date.now(), tasks: {} };
          }
        }
        writes[target].tasks[taskId] = {
          description: t.description || '',
          dueDate: t.dueDate || '',
          status: 'Kész',
          createdAt: t.createdAt || Date.now(),
          completedAt: t.completedAt || null
        };
      });
    }

    return db.ref(TODO_PATH).update(writes).then(() => Object.keys(writes).length);
  });
}

window.DataLayer = {
  onConnectionState,
  watchRaktar,
  raktarAddCategory,
  raktarUpdateCategory,
  raktarDeleteCategory,
  raktarAddPart,
  raktarUpdatePart,
  raktarDeletePart,
  raktarAddPartLink,
  raktarRemovePartLink,
  migrateFromOldSchema,
  watchJavitas,
  javitasAdd,
  javitasUpdate,
  javitasDelete,
  migrateJavitasFromOld,
  watchRendelesek,
  rendelesAdd,
  rendelesUpdate,
  rendelesDelete,
  migrateOneRendelesFromOld,
  watchKolcsonzes,
  kolcsonzesAdd,
  kolcsonzesUpdate,
  kolcsonzesDelete,
  migrateKolcsonzesFromOld,
  watchArajanlatProfiles,
  arajanlatProfileAdd,
  arajanlatProfileUpdate,
  arajanlatProfileDelete,
  watchArajanlatUgyfelek,
  arajanlatUgyfelAdd,
  arajanlatUgyfelUpdate,
  arajanlatUgyfelDelete,
  watchArajanlatok,
  arajanlatAdd,
  arajanlatWrite,
  arajanlatDelete,
  watchTodo,
  todoSectionAdd,
  todoSectionUpdate,
  todoSectionDelete,
  todoTaskAdd,
  todoTaskUpdate,
  todoTaskDelete,
  migrateTodoFromOld,
  raktarKepGet,
  raktarKepSet,
  raktarKepDelete,
  watchDokumentumok,
  dokKategoriaAdd,
  dokKategoriaUpdate,
  dokKategoriaDelete,
  dokAdd,
  dokUpdate,
  dokDelete,
  watchKatalogus,
  katTermekAdd,
  katTermekUpdate,
  katTermekDelete,
  katAdatAdd,
  katAdatUpdate,
  katAdatDelete,
  katFazisAdd,
  katFazisUpdate,
  katFazisDelete,
  katKepAdd,
  katKepGet,
  katKepFeliratSet,
  katKepDelete,
  katBoritoSet,
  katBoritoGet,
  katBoritoDelete,
  katPontAdd,
  katPontUpdate,
  katPontDelete,
  BACKUP_PATHS,
  backupBuild,
  backupRestore,
  watchBackupMeta,
  backupMetaSet
};



