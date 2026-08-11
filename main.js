// ─────────────────────────────────────────────────────────────────────────
// TMP Műhely Hub - Electron főfolyamat
//
// Ez indítja el az asztali ablakot és tölti be az app/index.html-t.
// Az ablak mérete és pozíciója megjegyződik két indítás között.
// ─────────────────────────────────────────────────────────────────────────

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Az ablakállapotot egy apró JSON-ban tároljuk a felhasználói mappában
const allapotFajl = () => path.join(app.getPath('userData'), 'ablak-allapot.json');

function allapotBetolt() {
  try {
    return JSON.parse(fs.readFileSync(allapotFajl(), 'utf8'));
  } catch (e) {
    return { width: 1440, height: 920 };
  }
}

function allapotMent(win) {
  try {
    if (win.isDestroyed()) return;
    const b = win.getNormalBounds();
    fs.writeFileSync(allapotFajl(), JSON.stringify({
      x: b.x, y: b.y, width: b.width, height: b.height,
      maximized: win.isMaximized()
    }));
  } catch (e) { /* ha nem sikerül, nem tragédia */ }
}


// ─────────────────────────────────────────────────────────────────────────
// Natív szolgáltatások az alkalmazás számára
// ─────────────────────────────────────────────────────────────────────────

function platformNev() {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'darwin') return 'macOS';
  return 'Linux';
}

ipcMain.handle('app:info', () => ({
  ok: true,
  version: app.getVersion(),
  platform: process.platform,
  platformLabel: platformNev(),
  hostname: os.hostname()
}));

// Árajánlat mentése valódi PDF fájlba.
// A kapott HTML-t egy rejtett ablakban rendereljük, abból készül a PDF -
// így pontosan úgy néz ki, ahogy a nyomtatási képen látszik, és nem függ
// attól, hogy van-e PDF-nyomtató telepítve a gépen.
ipcMain.handle('app:save-quote-pdf', async (event, { html, suggestedName }) => {
  let rejtett = null;
  let tempFajl = null;
  try {
    const mentes = await dialog.showSaveDialog(mainWindow, {
      title: 'Árajánlat mentése PDF-be',
      defaultPath: path.join(app.getPath('documents'), suggestedName || 'arajanlat.pdf'),
      filters: [{ name: 'PDF dokumentum', extensions: ['pdf'] }]
    });
    if (mentes.canceled || !mentes.filePath) return { ok: false, canceled: true };

    rejtett = new BrowserWindow({
      show: false,
      webPreferences: { javascript: false }
    });

    // Ideiglenes fájlba írjuk a HTML-t - így a hosszú tartalom és az
    // ékezetek is biztosan rendben lesznek.
    tempFajl = path.join(app.getPath('temp'), `tmp-arajanlat-${Date.now()}.html`);
    fs.writeFileSync(tempFajl, html, 'utf8');
    await rejtett.loadFile(tempFajl);

    // Adunk egy pillanatot a betűtípusok és képek betöltésére
    await new Promise((r) => setTimeout(r, 350));

    const pdf = await rejtett.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    fs.writeFileSync(mentes.filePath, pdf);
    return { ok: true, filePath: mentes.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    if (rejtett && !rejtett.isDestroyed()) rejtett.destroy();
    if (tempFajl) { try { fs.unlinkSync(tempFajl); } catch (e) { /* mindegy */ } }
  }
});

let mainWindow = null;

function ablakLetrehoz() {
  const a = allapotBetolt();

  mainWindow = new BrowserWindow({
    x: a.x,
    y: a.y,
    width: a.width || 1440,
    height: a.height || 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#F5EFE6',
    title: 'TMP Műhely Hub',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  if (a.maximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Csak akkor mutatjuk, ha már kirajzolódott - így nincs fehér villanás
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // A külső linkek az alapértelmezett böngészőben nyíljanak, ne az appban
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  ['resize', 'move', 'close'].forEach((ev) => {
    mainWindow.on(ev, () => allapotMent(mainWindow));
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Egyszerű, magyar nyelvű menü. Fejlesztői eszközök F12-vel.
function menuLetrehoz() {
  const template = [
    {
      label: 'Fájl',
      submenu: [
        { role: 'quit', label: 'Kilépés' }
      ]
    },
    {
      label: 'Szerkesztés',
      submenu: [
        { role: 'undo', label: 'Visszavonás' },
        { role: 'redo', label: 'Újra' },
        { type: 'separator' },
        { role: 'cut', label: 'Kivágás' },
        { role: 'copy', label: 'Másolás' },
        { role: 'paste', label: 'Beillesztés' },
        { role: 'selectAll', label: 'Összes kijelölése' }
      ]
    },
    {
      label: 'Nézet',
      submenu: [
        { role: 'reload', label: 'Újratöltés' },
        { role: 'forceReload', label: 'Kényszerített újratöltés' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Eredeti méret' },
        { role: 'zoomIn', label: 'Nagyítás' },
        { role: 'zoomOut', label: 'Kicsinyítés' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Teljes képernyő' },
        { role: 'toggleDevTools', label: 'Fejlesztői eszközök', accelerator: 'F12' }
      ]
    },
    {
      label: 'Súgó',
      submenu: [
        {
          label: 'Névjegy',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'TMP Műhely Hub',
              message: 'TMP Műhely Hub',
              detail: `Verzió: ${app.getVersion()}\nElectron: ${process.versions.electron}\n\nAz adatok a Firebase felhőben tárolódnak,\nés minden gépen azonnal frissülnek.`,
              buttons: ['Rendben']
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Egyetlen példány fusson csak - ha újra indítják, a meglévő ablak jöjjön elő
const egyPeldany = app.requestSingleInstanceLock();
if (!egyPeldany) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    menuLetrehoz();
    ablakLetrehoz();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) ablakLetrehoz();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
