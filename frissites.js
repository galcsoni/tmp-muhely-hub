// ─────────────────────────────────────────────────────────────────────────
// Automatikus frissítés
//
// Indulás után csendben megnézi a GitHubon, van-e újabb kiadás. Ha van,
// NEM natív Windows-ablakot dob fel, hanem szól az alkalmazásnak, ami a
// saját stílusában jeleníti meg. Engedély nélkül semmit nem tölt le.
//
// FONTOS: az adatokhoz nem nyúl. Az összes adat a Firebase felhőben van,
// a frissítés a programot cseréli, nem az adatot.
// ─────────────────────────────────────────────────────────────────────────

const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

let fovablak = null;
let ujVerzio = null;

function kuld(esemeny, adat) {
  if (fovablak && !fovablak.isDestroyed()) {
    fovablak.webContents.send(esemeny, adat);
  }
}

function beallit(win) {
  fovablak = win;

  // Mi döntjük el, mikor töltsön és mikor telepítsen
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    kuld('frissites:hiba', { uzenet: err && err.message ? err.message : 'ismeretlen hiba' });
  });

  autoUpdater.on('update-not-available', () => {
    kuld('frissites:naprakesz', { verzio: app.getVersion() });
  });

  autoUpdater.on('update-available', (info) => {
    ujVerzio = info.version;
    kuld('frissites:elerheto', { verzio: info.version, jelenlegi: app.getVersion() });
  });

  autoUpdater.on('download-progress', (p) => {
    if (fovablak && !fovablak.isDestroyed()) fovablak.setProgressBar(p.percent / 100);
    kuld('frissites:folyamat', {
      szazalek: Math.round(p.percent),
      sebesseg: Math.round((p.bytesPerSecond || 0) / 1024)
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (fovablak && !fovablak.isDestroyed()) fovablak.setProgressBar(-1);
    kuld('frissites:letoltve', { verzio: info.version });
  });

  // ── Az alkalmazás felől érkező kérések ─────────────────────────────
  ipcMain.handle('frissites:kereses', async () => {
    if (!app.isPackaged) return { ok: false, fejlesztoi: true };
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('frissites:letoltes', async () => {
    try {
      autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('frissites:telepites', () => {
    setImmediate(() => autoUpdater.quitAndInstall());
    return { ok: true };
  });
}

// Indulás utáni csendes ellenőrzés
function ellenorizIndulaskor() {
  if (!app.isPackaged) return;   // fejlesztés közben ne zaklasson
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}

// A Súgó menüből kézzel indított ellenőrzés
function ellenorizKezzel() {
  if (!app.isPackaged) {
    kuld('frissites:naprakesz', { verzio: app.getVersion(), fejlesztoi: true });
    return;
  }
  kuld('frissites:folyamat', { szazalek: -1 });   // "keresek..." jelzés
  autoUpdater.checkForUpdates().catch((err) => {
    kuld('frissites:hiba', { uzenet: err.message });
  });
}

module.exports = { beallit, ellenorizIndulaskor, ellenorizKezzel };
