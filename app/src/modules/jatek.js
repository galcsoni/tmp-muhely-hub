// ─────────────────────────────────────────────────────────────────────────
// Easter egg: "Tankcsata" - saját írású tank-játék, retró tempóban
// A főoldal alján lévő láthatatlan "unatkozom" feliratra kattintva indul.
// Semmilyen adatot nem ír a Firebase-be.
//
// 10 pálya, fokozódó nehézséggel. Az irányítás RÁCSRA IGAZODIK (mint a
// régi konzolos játékokban): forduláskor a tank automatikusan a folyosó
// közepére ugrik, így nem lehet beszorulni egy sarokba.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const TILE = 32;            // egy téglablokk mérete
  const SNAP = TILE / 2;      // ekkora rácsra igazodik a tank
  const COLS = 15;
  const ROWS = 15;
  const W = TILE * COLS;
  const H = TILE * ROWS;
  const TS = 30;              // tank mérete
  const BS = 6;               // lövedék mérete

  // Retró tempó - lassabb, kiszámíthatóbb mozgás
  const PLAYER_SPEED = 1.05;
  const BULLET_SPEED = 3.1;
  const PLAYER_COOLDOWN = 26;

  const EMPTY = 0, BRICK = 1, STEEL = 2, BASE = 3, BUSH = 4;

  const DIRS = {
    up:    { dx: 0,  dy: -1 },
    down:  { dx: 0,  dy: 1 },
    left:  { dx: -1, dy: 0 },
    right: { dx: 1,  dy: 0 }
  };
  const DIR_NAMES = ['up', 'down', 'left', 'right'];

  // ── A 10 pálya ────────────────────────────────────────────────────────
  // total: ennyit kell kilőni · live: egyszerre ennyi lehet a pályán
  // espeed: ellenfél sebessége a játékoshoz képest · fire: lövési esély
  // spawn: ennyi képkockánként jön új tank · brick/steel/bush: pálya sűrűsége
  const LEVELS = [
    { total: 4,  live: 1, espeed: 0.55, fire: 0.0035, spawn: 300, brick: 0.50, steel: 2,  bush: 4 },
    { total: 6,  live: 2, espeed: 0.60, fire: 0.0045, spawn: 280, brick: 0.55, steel: 4,  bush: 4 },
    { total: 8,  live: 2, espeed: 0.65, fire: 0.0055, spawn: 260, brick: 0.60, steel: 5,  bush: 5 },
    { total: 10, live: 2, espeed: 0.70, fire: 0.0065, spawn: 240, brick: 0.62, steel: 6,  bush: 5 },
    { total: 12, live: 3, espeed: 0.75, fire: 0.0075, spawn: 220, brick: 0.65, steel: 7,  bush: 6 },
    { total: 14, live: 3, espeed: 0.80, fire: 0.0085, spawn: 200, brick: 0.68, steel: 8,  bush: 6 },
    { total: 16, live: 3, espeed: 0.85, fire: 0.0095, spawn: 185, brick: 0.70, steel: 10, bush: 6 },
    { total: 18, live: 4, espeed: 0.90, fire: 0.0110, spawn: 170, brick: 0.72, steel: 11, bush: 7 },
    { total: 20, live: 4, espeed: 0.95, fire: 0.0125, spawn: 155, brick: 0.75, steel: 13, bush: 7 },
    { total: 24, live: 5, espeed: 1.00, fire: 0.0145, spawn: 140, brick: 0.78, steel: 15, bush: 8 }
  ];

  let running = false;
  let raf = null;
  let ctx = null;
  let grid = [];
  let player = null;
  let enemies = [];
  let bullets = [];
  let keys = {};
  let level = 0;
  let cfg = LEVELS[0];
  let spawnedCount = 0;
  let killedCount = 0;
  let lives = 3;
  let state = 'intro';        // 'intro' | 'jatek' | 'palya-kesz' | 'vege' | 'vege-nyertes'
  let vegOka = 'bazis';       // 'bazis' vagy 'eletek' - mitől lett vége
  let introTimer = 0;
  let spawnTimer = 0;
  let scaleIdx = 0;
  const SCALES = [1, 1.25, 1.5, 1.75, 2];
  let keyHandlerDown = null;
  let keyHandlerUp = null;

  // ── Pálya építése ─────────────────────────────────────────────────────
  function buildMap() {
    grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(EMPTY));

    for (let r = 2; r < ROWS - 2; r += 2) {
      for (let c = 1; c < COLS - 1; c += 2) {
        if (Math.random() < cfg.brick) grid[r][c] = BRICK;
        if (Math.random() < cfg.brick * 0.6 && r + 1 < ROWS - 2) grid[r + 1][c] = BRICK;
      }
    }
    for (let i = 0; i < cfg.steel; i++) {
      const r = 3 + Math.floor(Math.random() * (ROWS - 6));
      const c = 1 + Math.floor(Math.random() * (COLS - 2));
      grid[r][c] = STEEL;
    }
    for (let i = 0; i < cfg.bush; i++) {
      const r = 3 + Math.floor(Math.random() * (ROWS - 6));
      const c = 1 + Math.floor(Math.random() * (COLS - 2));
      if (grid[r][c] === EMPTY) grid[r][c] = BUSH;
    }

    const br = ROWS - 1, bc = Math.floor(COLS / 2);
    grid[br][bc] = BASE;
    [[br - 1, bc - 1], [br - 1, bc], [br - 1, bc + 1], [br, bc - 1], [br, bc + 1]]
      .forEach(([r, c]) => { if (grid[r] && grid[r][c] !== undefined) grid[r][c] = BRICK; });

    clearArea(ROWS - 2, bc - 4, 2, 3);
    clearArea(0, 0, 2, 3);
    clearArea(0, COLS - 3, 2, 3);
    clearArea(0, bc - 1, 2, 3);
  }

  function clearArea(r0, c0, rows, cols) {
    for (let r = r0; r < r0 + rows; r++) {
      for (let c = c0; c < c0 + cols; c++) {
        if (grid[r] && grid[r][c] !== undefined && grid[r][c] !== BASE) grid[r][c] = EMPTY;
      }
    }
  }

  // ── Ütközés ───────────────────────────────────────────────────────────
  function isSolid(t) { return t === BRICK || t === STEEL || t === BASE; }

  function rectHitsMap(x, y, size) {
    if (x < 0 || y < 0 || x + size > W || y + size > H) return true;
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + size - 1) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + size - 1) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!grid[r] || grid[r][c] === undefined) return true;
        if (isSolid(grid[r][c])) return true;
      }
    }
    return false;
  }

  function overlap(a, b, sa, sb) {
    return a.x < b.x + sb && a.x + sa > b.x && a.y < b.y + sb && a.y + sa > b.y;
  }

  // ── Tankok ────────────────────────────────────────────────────────────
  function makeTank(x, y, dir, isPlayer) {
    return { x, y, dir, isPlayer, cooldown: 0, aiTimer: 0, spawnFlash: 0, invuln: 0 };
  }

  function spawnPlayer() {
    const bc = Math.floor(COLS / 2);
    player = makeTank((bc - 3) * TILE + 1, (ROWS - 2) * TILE + 1, 'up', true);
    player.invuln = 150;
  }

  function trySpawnEnemy() {
    if (spawnedCount >= cfg.total) return;
    if (enemies.length >= cfg.live) return;
    const spots = [
      { x: 1, y: 1 },
      { x: (COLS - 2) * TILE + 1, y: 1 },
      { x: Math.floor(COLS / 2) * TILE + 1, y: 1 }
    ];
    const spot = spots[Math.floor(Math.random() * spots.length)];
    if (rectHitsMap(spot.x, spot.y, TS)) return;
    if (enemies.some((e) => overlap(spot, e, TS, TS))) return;
    if (player && overlap(spot, player, TS, TS)) return;
    const e = makeTank(spot.x, spot.y, 'down', false);
    e.spawnFlash = 60;
    enemies.push(e);
    spawnedCount += 1;
  }

  // Rácsra igazodó mozgás: forduláskor a merőleges tengelyen a legközelebbi
  // rácspontra ugrik, így könnyű befordulni egy szűk folyosóba.
  function moveTank(tank, dir, speed) {
    if (tank.dir !== dir) {
      const oldX = tank.x, oldY = tank.y;
      tank.dir = dir;
      if (dir === 'left' || dir === 'right') tank.y = Math.round(tank.y / SNAP) * SNAP + 1;
      else tank.x = Math.round(tank.x / SNAP) * SNAP + 1;
      if (rectHitsMap(tank.x, tank.y, TS)) { tank.x = oldX; tank.y = oldY; }
    }
    const d = DIRS[dir];
    const nx = tank.x + d.dx * speed;
    const ny = tank.y + d.dy * speed;
    if (rectHitsMap(nx, ny, TS)) return false;
    const others = [player, ...enemies].filter((t) => t && t !== tank);
    if (others.some((t) => overlap({ x: nx, y: ny }, t, TS, TS))) return false;
    tank.x = nx;
    tank.y = ny;
    return true;
  }

  function fire(tank) {
    if (tank.cooldown > 0) return;
    if (bullets.some((b) => b.owner === tank)) return;
    const d = DIRS[tank.dir];
    bullets.push({
      x: tank.x + TS / 2 - BS / 2 + d.dx * (TS / 2),
      y: tank.y + TS / 2 - BS / 2 + d.dy * (TS / 2),
      dir: tank.dir,
      owner: tank,
      fromPlayer: !!tank.isPlayer
    });
    tank.cooldown = tank.isPlayer ? PLAYER_COOLDOWN : 70;
  }

  function updateEnemy(e) {
    if (e.spawnFlash > 0) { e.spawnFlash -= 1; return; }
    const speed = PLAYER_SPEED * cfg.espeed;
    e.aiTimer -= 1;
    if (e.aiTimer <= 0 || !moveTank(e, e.dir, speed)) {
      e.aiTimer = 45 + Math.floor(Math.random() * 75);
      if (Math.random() < 0.4) {
        const bx = Math.floor(COLS / 2) * TILE;
        const by = (ROWS - 1) * TILE;
        e.dir = Math.abs(bx - e.x) > Math.abs(by - e.y)
          ? (bx > e.x ? 'right' : 'left')
          : (by > e.y ? 'down' : 'up');
      } else {
        e.dir = DIR_NAMES[Math.floor(Math.random() * 4)];
      }
    }
    if (Math.random() < cfg.fire) fire(e);
  }

  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const d = DIRS[b.dir];
      b.x += d.dx * BULLET_SPEED;
      b.y += d.dy * BULLET_SPEED;

      if (b.x < 0 || b.y < 0 || b.x + BS > W || b.y + BS > H) { bullets.splice(i, 1); continue; }

      const c = Math.floor((b.x + BS / 2) / TILE);
      const r = Math.floor((b.y + BS / 2) / TILE);
      const t = grid[r] && grid[r][c];
      if (t === BRICK) { grid[r][c] = EMPTY; bullets.splice(i, 1); continue; }
      if (t === STEEL) { bullets.splice(i, 1); continue; }
      if (t === BASE) { grid[r][c] = EMPTY; bullets.splice(i, 1); vegOka = 'bazis'; state = 'vege'; continue; }

      if (b.fromPlayer) {
        const hit = enemies.findIndex((e) => overlap(b, e, BS, TS));
        if (hit >= 0) {
          enemies.splice(hit, 1);
          bullets.splice(i, 1);
          killedCount += 1;
          if (killedCount >= cfg.total) {
            state = level >= LEVELS.length - 1 ? 'vege-nyertes' : 'palya-kesz';
          }
          continue;
        }
      } else if (player && player.invuln <= 0 && overlap(b, player, BS, TS)) {
        bullets.splice(i, 1);
        lives -= 1;
        if (lives <= 0) { vegOka = 'eletek'; state = 'vege'; }
        else spawnPlayer();
        continue;
      }
    }
  }

  // ── Kirajzolás ────────────────────────────────────────────────────────
  function drawTile(r, c) {
    const t = grid[r][c];
    const x = c * TILE, y = r * TILE;
    if (t === BRICK) {
      ctx.fillStyle = '#9C6B3F';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,0.24)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + i * TILE / 4);
        ctx.lineTo(x + TILE, y + i * TILE / 4);
        ctx.stroke();
        const off = i % 2 === 0 ? TILE / 2 : TILE / 4;
        ctx.beginPath();
        ctx.moveTo(x + off, y + i * TILE / 4);
        ctx.lineTo(x + off, y + (i + 1) * TILE / 4);
        ctx.stroke();
      }
    } else if (t === STEEL) {
      ctx.fillStyle = '#B8B2A8';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#EDE6DC';
      ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
    } else if (t === BASE) {
      ctx.fillStyle = '#D9A82E';
      const cx = x + TILE / 2, cy = y + TILE / 2, R = TILE * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 === 0 ? R : R * 0.46;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
      }
      ctx.closePath();
      ctx.fill();
    } else if (t === BUSH) {
      ctx.fillStyle = '#6B8F5E';
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.arc(x + TILE * 0.34, y + TILE * 0.56, TILE * 0.3, 0, Math.PI * 2);
      ctx.arc(x + TILE * 0.68, y + TILE * 0.44, TILE * 0.28, 0, Math.PI * 2);
      ctx.arc(x + TILE * 0.5, y + TILE * 0.76, TILE * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawTank(t) {
    if (t.spawnFlash > 0) {
      ctx.fillStyle = t.spawnFlash % 12 < 6 ? '#FFFFFF' : '#D9A82E';
      ctx.fillRect(t.x + 5, t.y + 5, TS - 10, TS - 10);
      return;
    }
    if (t.invuln > 0 && Math.floor(t.invuln / 7) % 2 === 0) ctx.globalAlpha = 0.4;

    const body = t.isPlayer ? '#5B7F99' : '#B0453A';
    const trim = t.isPlayer ? '#3E5B70' : '#7E2F27';
    const d = DIRS[t.dir];

    ctx.fillStyle = trim;
    if (d.dx !== 0) {
      ctx.fillRect(t.x, t.y, TS, 6);
      ctx.fillRect(t.x, t.y + TS - 6, TS, 6);
    } else {
      ctx.fillRect(t.x, t.y, 6, TS);
      ctx.fillRect(t.x + TS - 6, t.y, 6, TS);
    }
    ctx.fillStyle = body;
    ctx.fillRect(t.x + 5, t.y + 5, TS - 10, TS - 10);

    ctx.fillStyle = trim;
    const cx = t.x + TS / 2, cy = t.y + TS / 2;
    const len = TS / 2 + 2;
    if (d.dx !== 0) ctx.fillRect(d.dx > 0 ? cx : cx - len, cy - 3, len, 6);
    else ctx.fillRect(cx - 3, d.dy > 0 ? cy : cy - len, 6, len);

    ctx.globalAlpha = 1;
  }

  function centerText(lines) {
    ctx.fillStyle = 'rgba(42,37,32,0.9)';
    ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.textAlign = 'center';
    lines.forEach((l, i) => {
      ctx.fillStyle = l.color || '#EDE6DC';
      ctx.font = l.font || '14px sans-serif';
      ctx.fillText(l.text, W / 2, H / 2 - 26 + i * 30);
    });
    ctx.textAlign = 'left';
  }

  function draw() {
    ctx.fillStyle = '#2A2520';
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) if (grid[r][c] !== BUSH) drawTile(r, c);
    }
    if (player) drawTank(player);
    enemies.forEach(drawTank);

    ctx.fillStyle = '#F5EFE6';
    bullets.forEach((b) => ctx.fillRect(b.x, b.y, BS, BS));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) if (grid[r][c] === BUSH) drawTile(r, c);
    }

    const info = document.getElementById('jatek-info');
    if (info) {
      info.innerHTML = `Pálya <strong>${level + 1}/${LEVELS.length}</strong> · Élet <strong>${Math.max(0, lives)}</strong> · Kilőve <strong>${killedCount}/${cfg.total}</strong>`;
    }

    if (state === 'intro') {
      centerText([
        { text: `PÁLYA ${level + 1}`, color: '#D9A82E', font: 'bold 30px Georgia, serif' },
        { text: `${cfg.total} ellenséges tank · egyszerre max ${cfg.live}`, color: '#EDE6DC' }
      ]);
    } else if (state === 'palya-kesz') {
      centerText([
        { text: `PÁLYA ${level + 1} TELJESÍTVE`, color: '#6B8F5E', font: 'bold 26px Georgia, serif' },
        { text: 'ENTER = irány a következő pálya', color: '#EDE6DC' }
      ]);
    } else if (state === 'vege') {
      centerText([
        { text: vegOka === 'bazis' ? 'A BÁZIS ELESETT' : 'ELFOGYOTT AZ ÉLETED', color: '#B0453A', font: 'bold 27px Georgia, serif' },
        { text: `Eljutottál a ${level + 1}. pályáig`, color: '#EDE6DC' },
        { text: 'R = újrakezdés · ESC = kilépés', color: '#A8A098', font: '12px sans-serif' }
      ]);
    } else if (state === 'vege-nyertes') {
      centerText([
        { text: 'MIND A 10 PÁLYA MEGVAN!', color: '#D9A82E', font: 'bold 25px Georgia, serif' },
        { text: 'A műhely biztonságban van. Szép munka.', color: '#EDE6DC' },
        { text: 'R = újrakezdés · ESC = kilépés', color: '#A8A098', font: '12px sans-serif' }
      ]);
    }
  }

  // ── Fő ciklus ─────────────────────────────────────────────────────────
  function loop() {
    if (!running) return;

    if (state === 'intro') {
      introTimer -= 1;
      if (introTimer <= 0) { state = 'jatek'; spawnTimer = 40; }
    } else if (state === 'jatek') {
      if (player.cooldown > 0) player.cooldown -= 1;
      if (player.invuln > 0) player.invuln -= 1;

      if (keys.up) moveTank(player, 'up', PLAYER_SPEED);
      else if (keys.down) moveTank(player, 'down', PLAYER_SPEED);
      else if (keys.left) moveTank(player, 'left', PLAYER_SPEED);
      else if (keys.right) moveTank(player, 'right', PLAYER_SPEED);
      if (keys.fire) fire(player);

      enemies.forEach((e) => { if (e.cooldown > 0) e.cooldown -= 1; updateEnemy(e); });

      spawnTimer -= 1;
      if (spawnTimer <= 0) { trySpawnEnemy(); spawnTimer = cfg.spawn; }

      updateBullets();
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function startLevel(idx) {
    level = Math.max(0, Math.min(idx, LEVELS.length - 1));
    cfg = LEVELS[level];
    buildMap();
    bullets = [];
    enemies = [];
    spawnedCount = 0;
    killedCount = 0;
    spawnPlayer();
    state = 'intro';
    introTimer = 110;
  }

  function newGame() {
    lives = 3;
    startLevel(0);
  }

  // ── Méretezés ─────────────────────────────────────────────────────────
  function applyScale() {
    const canvas = document.getElementById('jatek-canvas');
    if (!canvas) return;
    const s = SCALES[scaleIdx];
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
    const lbl = document.getElementById('jatek-scale-label');
    if (lbl) lbl.textContent = `${Math.round(s * 100)}%`;
  }

  function fitToScreen() {
    const avail = Math.min(window.innerWidth - 60, window.innerHeight - 200);
    let best = 0;
    SCALES.forEach((s, i) => { if (W * s <= avail) best = i; });
    scaleIdx = best;
    applyScale();
  }

  // ── Nyitás / zárás ────────────────────────────────────────────────────
  function open() {
    if (running) return;

    const overlay = document.createElement('div');
    overlay.id = 'jatek-overlay';
    overlay.innerHTML = `
      <div class="jatek-panel" id="jatek-panel">
        <div class="jatek-head">
          <span class="jatek-title">Tankcsata</span>
          <span id="jatek-info" class="jatek-info"></span>
          <span class="jatek-zoom">
            <button class="btn-tiny" id="jatek-zoom-out">−</button>
            <span id="jatek-scale-label">100%</span>
            <button class="btn-tiny" id="jatek-zoom-in">+</button>
          </span>
          <button class="btn-tiny" id="jatek-fit">Képernyőre</button>
          <button class="btn-tiny" id="jatek-full">Teljes képernyő</button>
          <button class="btn-tiny" id="jatek-restart">Újra (R)</button>
          <button class="btn-tiny btn-danger" id="jatek-close">Kilépés (ESC)</button>
        </div>
        <canvas id="jatek-canvas" width="${W}" height="${H}"></canvas>
        <p class="jatek-help">
          Nyilak vagy <strong>WASD</strong> = mozgás · <strong>SZÓKÖZ</strong> = lövés · <strong>ENTER</strong> = tovább<br />
          Védd a sárga csillagot. A tank forduláskor magától a folyosó közepére igazodik.
          Tégla szétlőhető, acél nem, bokorban el lehet bújni.
        </p>
      </div>
    `;
    document.body.appendChild(overlay);

    ctx = document.getElementById('jatek-canvas').getContext('2d');
    keys = {};
    running = true;
    newGame();
    fitToScreen();

    keyHandlerDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { close(); return; }
      if (k === 'r') { newGame(); e.preventDefault(); return; }
      if (k === 'enter') {
        if (state === 'palya-kesz') startLevel(level + 1);
        else if (state === 'vege' || state === 'vege-nyertes') newGame();
        e.preventDefault();
        return;
      }
      if (k === 'arrowup' || k === 'w') keys.up = true;
      else if (k === 'arrowdown' || k === 's') keys.down = true;
      else if (k === 'arrowleft' || k === 'a') keys.left = true;
      else if (k === 'arrowright' || k === 'd') keys.right = true;
      else if (k === ' ') keys.fire = true;
      else return;
      e.preventDefault();
    };
    keyHandlerUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') keys.up = false;
      else if (k === 'arrowdown' || k === 's') keys.down = false;
      else if (k === 'arrowleft' || k === 'a') keys.left = false;
      else if (k === 'arrowright' || k === 'd') keys.right = false;
      else if (k === ' ') keys.fire = false;
    };
    window.addEventListener('keydown', keyHandlerDown);
    window.addEventListener('keyup', keyHandlerUp);

    document.getElementById('jatek-close').addEventListener('click', close);
    document.getElementById('jatek-restart').addEventListener('click', newGame);
    document.getElementById('jatek-zoom-in').addEventListener('click', () => {
      scaleIdx = Math.min(scaleIdx + 1, SCALES.length - 1); applyScale();
    });
    document.getElementById('jatek-zoom-out').addEventListener('click', () => {
      scaleIdx = Math.max(scaleIdx - 1, 0); applyScale();
    });
    document.getElementById('jatek-fit').addEventListener('click', fitToScreen);
    document.getElementById('jatek-full').addEventListener('click', () => {
      const panel = document.getElementById('jatek-panel');
      if (!document.fullscreenElement) {
        panel.requestFullscreen?.().then(() => setTimeout(fitToScreen, 150));
      } else {
        document.exitFullscreen?.().then(() => setTimeout(fitToScreen, 150));
      }
    });
    window.addEventListener('resize', fitToScreen);

    loop();
  }

  function close() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('keydown', keyHandlerDown);
    window.removeEventListener('keyup', keyHandlerUp);
    window.removeEventListener('resize', fitToScreen);
    if (document.fullscreenElement) document.exitFullscreen?.();
    document.getElementById('jatek-overlay')?.remove();
  }

  window.JatekModule = { open, close };
})();
