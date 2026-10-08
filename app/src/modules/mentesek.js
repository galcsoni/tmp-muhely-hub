// ─────────────────────────────────────────────────────────────────────────
// Mentések modul
// - Teljes mentés letöltése JSON fájlba (dátumozott fájlnév)
// - Visszaállítás korábbi mentésből, ágankénti választással
// - Emlékeztető: mikor volt az utolsó mentés
// A visszaállítás CSAK a kipipált ágakat írja felül, a többit nem bántja.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  let meta = {};
  let counts = null;        // { path: db }
  let loadedBackup = null;  // a beolvasott JSON fájl tartalma
  let loadedName = '';
  let busy = false;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function countOf(node) {
    if (!node || typeof node !== 'object') return 0;
    return Object.keys(node).length;
  }

  function fmtDateTime(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}. ${p(d.getMonth() + 1)}. ${p(d.getDate())}. ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function daysSince(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  // ── Állapotsáv: mikor mentettél utoljára ──────────────────────────────
  function renderStatusBanner() {
    const last = meta.lastBackupAt;
    const days = daysSince(last);
    let color = 'var(--ok)';
    let text = '';
    if (!last) {
      color = 'var(--danger)';
      text = 'Még soha nem készült mentés. Érdemes most letölteni egyet.';
    } else if (days >= 14) {
      color = 'var(--danger)';
      text = `Utolsó mentés: ${fmtDateTime(last)} — már ${days} napja. Ideje újat készíteni.`;
    } else if (days >= 7) {
      color = 'var(--warn)';
      text = `Utolsó mentés: ${fmtDateTime(last)} — ${days} napja.`;
    } else {
      text = `Utolsó mentés: ${fmtDateTime(last)}${days === 0 ? ' — ma' : ` — ${days} napja`}.`;
    }
    return `
      <div class="todo-group-head" style="--gc:${color};margin-bottom:22px;">
        <span class="todo-group-dot"></span>
        <span class="todo-group-name" style="color:${color};">Mentés állapota</span>
        <span class="todo-group-count">${escapeHtml(text)}</span>
      </div>
    `;
  }

  // ── Mentés letöltése ──────────────────────────────────────────────────
  function doBackup() {
    if (busy) return;
    busy = true;
    render();
    window.DataLayer.backupBuild().then((backup) => {
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TMP_Muhely_Hub_mentes_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      counts = {};
      Object.entries(backup.adatok).forEach(([k, v]) => { counts[k] = countOf(v); });
      return window.DataLayer.backupMetaSet({ lastBackupAt: backup._keszult });
    }).catch((err) => {
      alert('Nem sikerült a mentés: ' + err.message);
    }).then(() => {
      busy = false;
      render();
    });
  }

  // ── Fájl beolvasása visszaállításhoz ──────────────────────────────────
  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !parsed.adatok) {
          alert('Ez nem egy TMP Műhely Hub mentés fájl (hiányzik belőle az "adatok" rész).\n\nHa a RÉGI alkalmazás exportját akarod behozni, azt ne itt, hanem az egyes moduloknál lévő "Régi ... átemelése" gombbal tedd.');
          return;
        }
        loadedBackup = parsed;
        loadedName = file.name;
        render();
      } catch (err) {
        alert('Nem sikerült beolvasni a fájlt: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function renderRestorePanel() {
    if (!loadedBackup) {
      return `
        <div class="detail-fields-card">
          <span class="field-label">Visszaállítás mentésből</span>
          <p style="font-size:13px;color:var(--text-dim);line-height:1.7;margin:6px 0 14px;">
            Válaszd ki a korábban letöltött <strong>.json</strong> mentés-fájlt. Beolvasás után
            még semmi nem történik: megmutatom mi van benne, és te döntöd el, melyik részt
            állítsuk vissza.
          </p>
          <input type="file" id="mentes-file" accept=".json,application/json" class="cell-input" style="padding:8px;" />
        </div>
      `;
    }

    const adatok = loadedBackup.adatok || {};
    const rows = window.DataLayer.BACKUP_PATHS.map((p) => {
      const has = Object.prototype.hasOwnProperty.call(adatok, p.path);
      const db = countOf(adatok[p.path]);
      const nowCount = counts && counts[p.path] != null ? counts[p.path] : null;
      return `
        <label style="display:flex;align-items:center;gap:11px;padding:9px 12px;border:1px solid var(--border);border-radius:9px;margin-bottom:8px;background:var(--bg-card);${has ? '' : 'opacity:0.45;'}">
          <input type="checkbox" data-restore-path="${p.path}" ${has ? '' : 'disabled'} />
          <span style="flex:1;font-weight:500;">${escapeHtml(p.label)}</span>
          <span style="font-size:12px;color:var(--text-dim);">
            ${has ? `${db} tétel a mentésben` : 'nincs a fájlban'}
            ${nowCount != null && has ? ` · most ${nowCount}` : ''}
          </span>
        </label>
      `;
    }).join('');

    return `
      <div class="detail-fields-card">
        <span class="field-label">Beolvasott mentés</span>
        <p style="font-size:13px;line-height:1.7;margin:6px 0 16px;">
          <strong>${escapeHtml(loadedName)}</strong><br />
          <span style="color:var(--text-dim);">Készült: ${escapeHtml(fmtDateTime(loadedBackup._keszult) || 'ismeretlen időpont')}</span>
        </p>
        <span class="field-label">Mit állítsunk vissza?</span>
        <div style="margin:10px 0 6px;">${rows}</div>
        <p style="font-size:12.5px;color:var(--danger);line-height:1.7;margin:12px 0 14px;">
          ⚠️ A kipipált részek jelenlegi tartalmát a mentés <strong>teljesen felülírja</strong>.
          Ami azóta keletkezett, az elveszik. A ki nem pipált részekhez nem nyúlok.
        </p>
        <button class="btn-primary" id="mentes-restore" style="margin-top:0;">Kijelöltek visszaállítása</button>
        <button class="btn-secondary" id="mentes-cancel" style="margin-top:0;margin-left:8px;">Mégse, fájl elvetése</button>
      </div>
    `;
  }

  function render() {
    const root = document.getElementById('module-body-mentesek');
    if (!root) return;

    root.innerHTML = `
      ${renderStatusBanner()}

      <div class="detail-fields-card" style="margin-bottom:22px;">
        <span class="field-label">Teljes mentés letöltése</span>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.7;margin:6px 0 14px;">
          Egyetlen JSON fájlba menti az összes modul adatát (Raktár, Javítás, Rendelések,
          Kölcsönzés, Árajánlatok, TO-DO). Tedd el a gépedre vagy felhőbe — ebből
          bármikor teljesen visszaállítható minden.
        </p>
        <button class="btn-primary" id="mentes-download" style="margin-top:0;" ${busy ? 'disabled' : ''}>
          ${busy ? 'Mentés készül…' : '💾 Mentés letöltése'}
        </button>
      </div>

      ${renderRestorePanel()}
    `;

    document.getElementById('mentes-download')?.addEventListener('click', doBackup);

    document.getElementById('mentes-file')?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleFile(file);
    });

    document.getElementById('mentes-cancel')?.addEventListener('click', () => {
      loadedBackup = null;
      loadedName = '';
      render();
    });

    document.getElementById('mentes-restore')?.addEventListener('click', () => {
      const selected = Array.from(root.querySelectorAll('[data-restore-path]:checked'))
        .map((el) => el.dataset.restorePath);
      if (!selected.length) {
        alert('Előbb pipáld ki, melyik részt akarod visszaállítani.');
        return;
      }
      const labels = window.DataLayer.BACKUP_PATHS
        .filter((p) => selected.includes(p.path))
        .map((p) => '· ' + p.label)
        .join('\n');
      if (!confirm(`Ezek jelenlegi tartalmát felülírja a mentés:\n\n${labels}\n\nBiztosan folytatod?`)) return;
      window.AppKerdes.szoveg({
        cim: 'Utolsó ellenőrzés',
        leiras: 'Ez felülírja a kijelölt adatokat. Ha biztos vagy benne, írd be nagybetűkkel: VISSZAALLIT',
        hely: 'VISSZAALLIT',
        gomb: 'Visszaállítás'
      }).then((check) => {
        if (check !== 'VISSZAALLIT') {
          if (check !== null) alert('Megszakítva, semmi nem változott.');
          return;
        }
        window.DataLayer.backupRestore(loadedBackup, selected).then((n) => {
          alert(`Kész, ${n} rész visszaállítva.`);
          loadedBackup = null;
          loadedName = '';
          render();
        }).catch((err) => alert('Hiba a visszaállításnál: ' + err.message));
      });
    });
  }

  function getDashboardInfo() {
    const days = daysSince(meta.lastBackupAt);
    if (days === null) {
      return { szam: '—', egyseg: 'még nincs mentés', mellek: 'töltsd le az elsőt',
               figyelem: { szoveg: 'nincs biztonsági mentés', suly: 'piros' } };
    }
    return {
      szam: days === 0 ? 'ma' : days,
      egyseg: days === 0 ? 'volt az utolsó mentés' : (days === 1 ? 'napja mentettél' : 'napja mentettél'),
      mellek: days >= 7 ? 'ideje újat készíteni' : 'naprakész',
      figyelem: days >= 14 ? { szoveg: 'régen volt mentés', suly: 'piros' }
              : (days >= 7 ? { szoveg: 'ideje menteni', suly: 'sarga' } : null)
    };
  }

  function getDashboardStat() {
    const last = meta.lastBackupAt;
    const days = daysSince(last);
    if (!last) return '<span class="dash-card-stat" style="color:var(--danger)">még nincs mentés</span>';
    if (days >= 14) return `<span class="dash-card-stat" style="color:var(--danger)">utolsó mentés ${days} napja</span>`;
    if (days >= 7) return `<span class="dash-card-stat" style="color:var(--warn)">utolsó mentés ${days} napja</span>`;
    return `<span class="dash-card-stat">utolsó mentés ${days === 0 ? 'ma' : days + ' napja'}</span>`;
  }

  function init() {
    window.DataLayer.watchBackupMeta((d) => {
      meta = d || {};
      window.RenderGuard.rajzol(render, 'mentesek');
      window.DashboardStats?.refresh();
    });
  }

  // A nyitóképernyőre: régen volt mentés
  function getFigyelmeztetes() {
    const days = daysSince(meta.lastBackupAt);
    if (days === null) {
      return { modul: 'mentesek', ikon: '💾', suly: 'suly-piros',
               szoveg: 'Még soha nem készült biztonsági mentés' };
    }
    if (days >= 14) {
      return { modul: 'mentesek', ikon: '💾', suly: 'suly-piros',
               szoveg: `${days} napja nem készült mentés` };
    }
    if (days >= 7) {
      return { modul: 'mentesek', ikon: '💾', suly: 'suly-sarga',
               szoveg: `${days} napja nem készült mentés` };
    }
    return null;
  }

  window.MentesekModule = { init, getFigyelmeztetes, getDashboardInfo };
  window.ModuleNav = window.ModuleNav || {};
  window.ModuleNav.mentesek = {
    isDetail: () => false,
    goToList: () => {},
    getDashboardStat,
    getDashboardInfo
  };
})();
