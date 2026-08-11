// ─────────────────────────────────────────────────────────────────────────
// Előtöltő híd (preload)
//
// Ez az egyetlen kapcsolat az alkalmazás weboldal-része és az operációs
// rendszer között. Biztonsági okból NEM adjuk oda a teljes Node-ot, csak
// azokat a funkciókat, amikre tényleg szükség van.
// ─────────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

// Csak ezeket az üzeneteket engedjük át a főfolyamattól az app felé
const ENGEDETT = [
  'frissites:elerheto',
  'frissites:folyamat',
  'frissites:letoltve',
  'frissites:naprakesz',
  'frissites:hiba'
];

contextBridge.exposeInMainWorld('nativeApp', {
  getInfo: () => ipcRenderer.invoke('app:info'),

  saveQuotePdf: (html, suggestedName) =>
    ipcRenderer.invoke('app:save-quote-pdf', { html, suggestedName }),

  // ── Frissítés ────────────────────────────────────────────────────────
  frissitesKereses: () => ipcRenderer.invoke('frissites:kereses'),
  frissitesLetoltes: () => ipcRenderer.invoke('frissites:letoltes'),
  frissitesTelepites: () => ipcRenderer.invoke('frissites:telepites'),

  // Feliratkozás a főfolyamat üzeneteire
  onFrissites: (esemeny, callback) => {
    if (!ENGEDETT.includes(esemeny)) return;
    ipcRenderer.on(esemeny, (_e, adat) => callback(adat));
  }
});
