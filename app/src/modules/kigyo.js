// ─────────────────────────────────────────────────────────────────────────
// Easter egg: "Kígyó" - modern kiadás, a TMP Warm Ivory palettában
// Alma helyett Fatert kell elkapni. Ez nem elírás.
// A sprite base64-ben van beágyazva, tehát nem kell hozzá külső fájl.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  const TILE = 26;
  const COLS = 20;
  const ROWS = 20;
  const W = TILE * COLS;
  const H = TILE * ROWS;

  const START_MS = 165;
  const MIN_MS = 72;
  const SPEEDUP_PER_FOOD = 3.5;

  // Paletta - ugyanaz, mint az alkalmazásban
  const C = {
    bg: '#FAF8F4',
    grid: '#EDE6DC',
    border: '#D3C6B2',
    snake: '#9C6B3F',
    snakeLight: '#C49A6C',
    head: '#7E5430',
    ink: '#2A2520',
    dim: '#6A6560',
    gold: '#D9A82E',
    ok: '#6B7A63',
    danger: '#B0453A'
  };

  const DIRS = {
    up:    { dx: 0,  dy: -1 },
    down:  { dx: 0,  dy: 1 },
    left:  { dx: -1, dy: 0 },
    right: { dx: 1,  dy: 0 }
  };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  let faterImg = null, bonImg = null;
  let faterReady = false, bonReady = false;

  function loadSprites() {
    if (!faterImg) {
      faterImg = new Image();
      faterImg.onload = () => { faterReady = true; };
      faterImg.src = window.FATER_SPRITE || '';
    }
    if (!bonImg) {
      bonImg = new Image();
      bonImg.onload = () => { bonReady = true; };
      bonImg.src = window.BON_SPRITE || '';
    }
  }

  let running = false;
  let raf = null;
  let ctx = null;
  let snake = [];
  let dir = 'right';
  let dirQueue = [];
  let food = null;
  let bonus = null;
  let bonusTimer = 0;
  let score = 0;
  let best = 0;
  let stepMs = START_MS;
  let lastStep = 0;
  let interp = 0;           // 0..1 a lépések közti simításhoz
  let pop = 0;              // falat-elkapás animációja
  let state = 'kesz';       // 'kesz' | 'jatek' | 'szunet' | 'vege'
  let scaleIdx = 0;
  const SCALES = [1, 1.25, 1.5, 1.75, 2];
  let keyHandler = null;

  function loadBest() {
    try { best = parseInt(localStorage.getItem('tmp_kigyo_rekord') || '0', 10) || 0; }
    catch (e) { best = 0; }
  }
  function saveBest() {
    try { localStorage.setItem('tmp_kigyo_rekord', String(best)); } catch (e) { /* nem baj */ }
  }

  function cellFree(x, y) { return !snake.some((s) => s.x === x && s.y === y); }

  function randomFreeCell() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (cellFree(x, y)) free.push({ x, y });
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function placeFood() { food = randomFreeCell(); }

  function maybePlaceBonus() {
    if (bonus || score === 0 || score % 5 !== 0) return;
    const c = randomFreeCell();
    if (!c) return;
    bonus = c;
    bonusTimer = 6000;
  }

  function reset() {
    const midY = Math.floor(ROWS / 2);
    snake = [{ x: 5, y: midY }, { x: 4, y: midY }, { x: 3, y: midY }];
    dir = 'right';
    dirQueue = [];
    score = 0;
    stepMs = START_MS;
    bonus = null;
    bonusTimer = 0;
    pop = 0;
    placeFood();
    state = 'kesz';
    lastStep = 0;
  }

  function step() {
    while (dirQueue.length) {
      const d = dirQueue.shift();
      if (d !== OPPOSITE[dir] && d !== dir) { dir = d; break; }
    }

    const d = DIRS[dir];
    const head = { x: snake[0].x + d.dx, y: snake[0].y + d.dy };

    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) { gameOver(); return; }
    if (snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y)) { gameOver(); return; }

    snake.unshift(head);

    let nott = false;
    if (food && head.x === food.x && head.y === food.y) {
      score += 1; nott = true; pop = 1;
      stepMs = Math.max(MIN_MS, stepMs - SPEEDUP_PER_FOOD);
      placeFood();
      maybePlaceBonus();
    } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
      score += 5; nott = true; pop = 1;
      bonus = null; bonusTimer = 0;
    }
    if (!nott) snake.pop();
  }

  function gameOver() {
    state = 'vege';
    if (score > best) { best = score; saveBest(); }
  }

  // ── Kirajzolás ────────────────────────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawHead(img, ready, cx, cy, size, glowColor, fallback) {
    if (glowColor) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
    // finom árnyék a fej alá
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + size / 2 - 1, size * 0.34, size * 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(42,37,32,0.13)';
    ctx.fill();
    ctx.restore();

    if (ready) {
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    } else {
      ctx.fillStyle = fallback;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFater(cx, cy, size, glow) {
    drawHead(faterImg, faterReady, cx, cy, size, glow, C.danger);
  }
  function drawBon(cx, cy, size) {
    drawHead(bonImg, bonReady, cx, cy, size, null, C.head);
  }

  function draw() {
    // világos háttér, finom pontrács
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.grid;
    for (let y = 0; y <= ROWS; y++) {
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.arc(x * TILE, y * TILE, 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // falatok
    if (food) {
      const s = TILE * (0.86 + (pop > 0 ? pop * 0.16 : 0));
      drawFater(food.x * TILE + TILE / 2, food.y * TILE + TILE / 2, s, null);
    }
    if (bonus) {
      const puls = 1 + 0.08 * Math.sin(Date.now() / 130);
      drawFater(bonus.x * TILE + TILE / 2, bonus.y * TILE + TILE / 2, TILE * 0.9 * puls, C.gold);
    }

    // kígyó - lekerekített, egymásba érő szegmensek, farok felé vékonyodva
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const t = i / Math.max(1, snake.length - 1);
      const inset = 2 + t * 3.2;
      const size = TILE - inset * 2;
      const r = Math.min(size / 2, 9 - t * 3);

      if (i === 0) {
        continue;   // a fejet külön, a test fölé rajzoljuk
      } else {
        const mix = 1 - t * 0.55;
        ctx.fillStyle = i % 2 === 0 ? C.snake : C.snakeLight;
        ctx.globalAlpha = 0.55 + mix * 0.45;
        roundRect(s.x * TILE + inset, s.y * TILE + inset, size, size, r);
        ctx.globalAlpha = 1;
      }
    }

    // a kígyó feje: Bon fotója, a haladás irányába döntve
    if (snake.length) {
      const h = snake[0];
      const cx = h.x * TILE + TILE / 2, cy = h.y * TILE + TILE / 2;
      const tilt = { up: 0, right: 0.16, down: 0, left: -0.16 }[dir] || 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      drawBon(0, 0, TILE * 1.14);
      ctx.restore();
    }

    const info = document.getElementById('kigyo-info');
    if (info) {
      info.innerHTML = `Pont <strong>${score}</strong> · Hossz <strong>${snake.length}</strong> · Rekord <strong>${best}</strong>`;
    }

    if (state !== 'jatek') {
      // finom fátyol az egész pályán, fölötte egy lekerekített kártya
      ctx.fillStyle = 'rgba(245,239,230,0.72)';
      ctx.fillRect(0, 0, W, H);

      const cardW = Math.min(W - 60, 400);
      const cardH = 152;
      const cx = (W - cardW) / 2, cy = (H - cardH) / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(42,37,32,0.20)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFFFF';
      roundRect(cx, cy, cardW, cardH, 16);
      ctx.restore();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx, cy, cardW, cardH, 16) : ctx.rect(cx, cy, cardW, cardH);
      ctx.stroke();

      const lines = state === 'kesz'
        ? [
            { text: 'Kígyó', color: C.ink, font: '600 30px "Playfair Display", Georgia, serif', dy: 46 },
            { text: 'Kapd el Fatert - a bekeretezett fej 5 pontot ér', color: C.dim, font: '12.5px Jost, sans-serif', dy: 78 },
            { text: 'ENTER = kezdés', color: C.snake, font: '600 13px Jost, sans-serif', dy: 112 }
          ]
        : state === 'szunet'
          ? [
              { text: 'Szünet', color: C.ink, font: '600 28px "Playfair Display", Georgia, serif', dy: 58 },
              { text: 'SZÓKÖZ = folytatás', color: C.dim, font: '13px Jost, sans-serif', dy: 96 }
            ]
          : [
              { text: 'Vége', color: C.danger, font: '600 30px "Playfair Display", Georgia, serif', dy: 46 },
              {
                text: score > 0 && score >= best ? `${score} pont - új rekord!` : `${score} pont · rekord: ${best}`,
                color: score > 0 && score >= best ? C.gold : C.ink,
                font: '600 15px Jost, sans-serif', dy: 80
              },
              { text: 'ENTER = új játék · ESC = kilépés', color: C.dim, font: '12px Jost, sans-serif', dy: 112 }
            ];

      ctx.textAlign = 'center';
      lines.forEach((l) => {
        ctx.fillStyle = l.color;
        ctx.font = l.font;
        ctx.fillText(l.text, W / 2, cy + l.dy);
      });
      ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    if (!running) return;
    if (state === 'jatek') {
      if (!lastStep) lastStep = ts;
      if (ts - lastStep >= stepMs) { step(); lastStep = ts; }
      if (pop > 0) pop = Math.max(0, pop - 0.06);
      if (bonus) {
        bonusTimer -= 16.7;
        if (bonusTimer <= 0) bonus = null;
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  // A canvas belső felbontását a nagyítással EGYÜTT emeljük, különben a
  // böngésző csak felnagyítja a kis képet, és pixeles lesz minden.
  function applyScale() {
    const canvas = document.getElementById('kigyo-canvas');
    if (!canvas) return;
    const s = SCALES[scaleIdx];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = s * dpr;
    canvas.width = Math.round(W * px);
    canvas.height = Math.round(H * px);
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
    ctx = canvas.getContext('2d');
    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const lbl = document.getElementById('kigyo-scale-label');
    if (lbl) lbl.textContent = `${Math.round(s * 100)}%`;
  }

  function fitToScreen() {
    const avail = Math.min(window.innerWidth - 60, window.innerHeight - 200);
    let bestIdx = 0;
    SCALES.forEach((s, i) => { if (W * s <= avail) bestIdx = i; });
    scaleIdx = bestIdx;
    applyScale();
  }

  function open() {
    if (running) return;
    loadBest();
    loadSprites();

    const overlay = document.createElement('div');
    overlay.id = 'jatek-overlay';
    overlay.className = 'vilagos';
    overlay.innerHTML = `
      <div class="jatek-panel" id="kigyo-panel">
        <div class="jatek-head">
          <span class="jatek-title">Kígyó</span>
          <span id="kigyo-info" class="jatek-info"></span>
          <span class="jatek-zoom">
            <button class="btn-tiny" id="kigyo-zoom-out">−</button>
            <span id="kigyo-scale-label">100%</span>
            <button class="btn-tiny" id="kigyo-zoom-in">+</button>
          </span>
          <button class="btn-tiny" id="kigyo-fit">Képernyőre</button>
          <button class="btn-tiny" id="kigyo-full">Teljes képernyő</button>
          <button class="btn-tiny" id="kigyo-restart">Újra (R)</button>
          <button class="btn-tiny btn-danger" id="kigyo-close">Kilépés (ESC)</button>
        </div>
        <canvas id="kigyo-canvas" width="${W}" height="${H}"></canvas>
        <p class="jatek-help">
          Nyilak vagy <strong>WASD</strong> = kanyarodás · <strong>SZÓKÖZ</strong> = szünet · <strong>ENTER</strong> = kezdés
          <br />Minden elkapott Fater után gyorsulsz egy kicsit. Falnak és magadnak ütközni tilos.
        </p>
      </div>
    `;
    document.body.appendChild(overlay);

    running = true;
    reset();
    fitToScreen();   // ez állítja be a canvas felbontását és a ctx-et is

    keyHandler = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') { close(); return; }
      if (k === 'r') { reset(); state = 'jatek'; e.preventDefault(); return; }
      if (k === 'enter') {
        if (state === 'kesz') state = 'jatek';
        else if (state === 'vege') { reset(); state = 'jatek'; }
        e.preventDefault();
        return;
      }
      if (k === ' ') {
        if (state === 'jatek') state = 'szunet';
        else if (state === 'szunet') { state = 'jatek'; lastStep = 0; }
        else if (state === 'kesz') state = 'jatek';
        e.preventDefault();
        return;
      }
      let d = null;
      if (k === 'arrowup' || k === 'w') d = 'up';
      else if (k === 'arrowdown' || k === 's') d = 'down';
      else if (k === 'arrowleft' || k === 'a') d = 'left';
      else if (k === 'arrowright' || k === 'd') d = 'right';
      if (!d) return;
      e.preventDefault();
      if (state === 'kesz') state = 'jatek';
      if (dirQueue.length < 2) dirQueue.push(d);
    };
    window.addEventListener('keydown', keyHandler);

    document.getElementById('kigyo-close').addEventListener('click', close);
    document.getElementById('kigyo-restart').addEventListener('click', () => { reset(); state = 'jatek'; });
    document.getElementById('kigyo-zoom-in').addEventListener('click', () => {
      scaleIdx = Math.min(scaleIdx + 1, SCALES.length - 1); applyScale();
    });
    document.getElementById('kigyo-zoom-out').addEventListener('click', () => {
      scaleIdx = Math.max(scaleIdx - 1, 0); applyScale();
    });
    document.getElementById('kigyo-fit').addEventListener('click', fitToScreen);
    document.getElementById('kigyo-full').addEventListener('click', () => {
      const panel = document.getElementById('kigyo-panel');
      if (!document.fullscreenElement) panel.requestFullscreen?.().then(() => setTimeout(fitToScreen, 150));
      else document.exitFullscreen?.().then(() => setTimeout(fitToScreen, 150));
    });
    window.addEventListener('resize', fitToScreen);

    raf = requestAnimationFrame(loop);
  }

  function close() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('keydown', keyHandler);
    window.removeEventListener('resize', fitToScreen);
    if (document.fullscreenElement) document.exitFullscreen?.();
    document.getElementById('jatek-overlay')?.remove();
  }

  window.KigyoModule = { open, close };
})();
