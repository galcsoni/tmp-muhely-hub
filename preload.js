// ─────────────────────────────────────────────────────────────────────────
// Előtöltő híd (preload)
//
// Ez az egyetlen kapcsolat az alkalmazás weboldal-része és az operációs
// rendszer között. Biztonsági okból NEM adjuk oda a teljes Node-ot, csak
// azt a két funkciót, amire tényleg szükség van:
//   - getInfo()      : verzió és platform kiírása a fejlécben
//   - saveQuotePdf() : árajánlat mentése valódi PDF fájlba
// ─────────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nativeApp', {
  getInfo: () => ipcRenderer.invoke('app:info'),
  saveQuotePdf: (html, suggestedName) =>
    ipcRenderer.invoke('app:save-quote-pdf', { html, suggestedName })
});
