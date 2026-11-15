// Playzone game 3: Balloon Pop, an endless survival game. Pop balloons to score; you lose a life when you tap a grey ✖
// object or let a balloon escape off the top. The game ends when all lives are gone. It gets harder as the score grows.
// Playing does not earn Screen-time minutes. Play again inside the game is free; the cost was paid when it was opened.
(() => {
  'use strict';

  const root = window;

  // ===== Difficulty: everything that changes with progress is defined here, and only here =====
  // level = floor(score / levelEvery), capped at maxLevel. Each setting is "start value, how it changes per level, limit".
  const CONFIG = {
    lives: 5,
    levelEvery: 4,                                        // pops needed for the next level
    maxLevel: 30,
    missLosesLife: true,                                  // a balloon that reaches the top costs a life
    hazardPenalty: 1,                                     // lives lost for tapping a ✖ object
    rise: { start: 7.5, factor: 0.94, min: 3 },           // seconds for an object to cross the screen (faster each level)
    size: { widthFraction: 0.12, minPx: 72, maxPx: 120, shrink: 0.035, minScale: 0.62, floorPx: 58 },   // balloon width; never below floorPx
    spawn: { start: 1100, factor: 0.94, min: 450 },       // ms between new objects
    speedJitter: [0.85, 1.2],                             // each object's own speed varies a little
    // Movement patterns appear one by one: object paths get less simple as the level rises.
    moves: [
      { id: 'straight', level: 0 },
      { id: 'diagonal', level: 2 },
      { id: 'curve', level: 4 },
      { id: 'zigzag', level: 6 },
      { id: 'bounce', level: 8 }
    ],
    // Grey ✖ objects (never tap these). Chance grows with the level up to max.
    hazards: {
      startLevel: 3,
      chance: { start: 0.1, perLevel: 0.025, max: 0.35 },
      types: [{ id: 'rock', level: 3 }, { id: 'spiky', level: 6 }]
    }
  };

  const COLOURS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  const levelFor = (score) => Math.min(CONFIG.maxLevel, Math.floor(score / CONFIG.levelEvery));
  function difficulty(level) {
    const h = CONFIG.hazards;
    return {
      level,
      rise: Math.max(CONFIG.rise.min, CONFIG.rise.start * Math.pow(CONFIG.rise.factor, level)),
      scale: Math.max(CONFIG.size.minScale, 1 - CONFIG.size.shrink * level),
      spawn: Math.max(CONFIG.spawn.min, CONFIG.spawn.start * Math.pow(CONFIG.spawn.factor, level)),
      moves: CONFIG.moves.filter(m => m.level <= level).map(m => m.id),
      hazardChance: level < h.startLevel ? 0 : Math.min(h.chance.max, h.chance.start + h.chance.perLevel * (level - h.startLevel)),
      hazardTypes: h.types.filter(t => t.level <= level).map(t => t.id)
    };
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(host, options) {
    const opts = options || {};
    const rng = opts.rng || Math.random;
    const rand = (a, b) => a + rng() * (b - a);
    const pick = (list) => list[Math.floor(rng() * list.length) % list.length];
    const ctx = opts.ctx || null;
    const autoSpawn = opts.autoSpawn !== false;                // tests switch this off to control exactly what appears
    let player = ctx ? (ctx.profiles().find(p => p.id === ctx.defaults[0]) || null) : null;   // saved profile or guest

    host.innerHTML = '';
    const game = el('div', 'pz-balloon-game');
    const bar = el('div', 'pz-bar');
    const livesText = el('strong', 'pz-lives');
    livesText.setAttribute('aria-live', 'polite');
    const scoreText = el('strong', 'pz-score');
    const bestText = el('strong', 'pz-best-score');
    bar.append(livesText, scoreText, bestText);
    const sky = el('div', 'pz-sky');
    const flashText = el('div', 'pz-flash hidden');
    sky.append(flashText);

    const intro = el('div', 'pz-over pz-intro');
    const over = el('div', 'pz-over pz-end hidden');
    game.append(bar, sky, intro, over);
    host.append(game);

    let score = 0;
    let lives = 0;
    let level = 0;
    let objects = [];
    let running = false;
    let spawnAcc = 0;
    let nextSpawn = 0;
    let raf = 0;
    let last = 0;
    let alive = true;
    let hazardTip = false;
    const timers = new Set();

    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    const sound = (kind) => { if (root.MQAudio) root.MQAudio.playSound(kind); };
    const bestNow = () => (player ? player.playzone.balloonBest : 0);

    function hud() {
      livesText.textContent = Array.from({ length: CONFIG.lives }, (_, i) => (i < lives ? '❤️' : '🖤')).join('');
      livesText.setAttribute('aria-label', `${lives} lives left`);
      scoreText.textContent = `🎈 ${score} · Level ${level + 1}`;
      bestText.textContent = player ? `Best: ${bestNow()}` : 'Guest';
    }

    function flash(text, kind) {
      flashText.textContent = text;
      flashText.className = `pz-flash ${kind || ''}`;
      later(() => flashText.classList.add('hidden'), 1100);
    }

    // ----- start / intro screen -----
    function showIntro() {
      running = false;
      cancelAnimationFrame(raf);
      clearObjects();
      over.classList.add('hidden');
      intro.innerHTML = '';
      intro.classList.remove('hidden');
      intro.append(el('h3', '', '🎈 Balloon Pop'));
      const rules = el('ul', 'pz-rules');
      [`🎈 Tap balloons to pop them.`, `❌ Never tap grey ✖ objects: you lose a life.`,
        CONFIG.missLosesLife ? `⬆️ If a balloon floats off the top, you lose a life.` : '', `${'❤️'.repeat(Math.min(CONFIG.lives, 5))} You have ${CONFIG.lives} lives. There is no timer!`]
        .filter(Boolean).forEach(t => rules.append(el('li', '', t)));
      intro.append(rules);
      if (ctx) {
        const select = document.createElement('select');
        select.id = 'pzBalloonPlayer';
        select.setAttribute('aria-label', 'Who is playing?');
        const guest = el('option', '', 'Guest (no record)');
        guest.value = '';
        select.append(guest);
        ctx.profiles().forEach(p => { const o = el('option', '', `${p.avatar || ''} ${p.name}`.trim()); o.value = p.id; select.append(o); });
        select.value = player ? player.id : '';
        select.addEventListener('change', () => { player = ctx.profiles().find(p => p.id === select.value) || null; score = 0; lives = CONFIG.lives; hud(); });
        intro.append(select);
      }
      const go = el('button', 'primary-button compact', 'Start');
      go.type = 'button';
      go.id = 'pzBalloonStart';
      go.addEventListener('click', start);
      intro.append(go);
      lives = CONFIG.lives; score = 0; level = 0;
      hud();
    }

    function clearObjects() {
      objects.forEach(o => o.el.remove());
      objects = [];
    }

    // A new game needs a positive Screen-time balance. The usage session starts here and is charged when the game ends.
    function blocked(problem) {
      const target = over.classList.contains('hidden') ? intro : over;
      let note = target.querySelector('.pz-block-note');
      if (!note) { note = el('p', 'setting-help error pz-block-note'); note.setAttribute('role', 'alert'); target.append(note); }
      note.textContent = problem;
    }

    function start() {
      const problem = ctx && ctx.begin ? ctx.begin() : '';
      if (problem) { blocked(problem); return; }
      timers.forEach(clearTimeout); timers.clear();
      intro.classList.add('hidden');
      over.classList.add('hidden');
      clearObjects();
      score = 0; level = 0; lives = CONFIG.lives; hazardTip = false;
      spawnAcc = 0;
      nextSpawn = 400;                                     // first object comes quickly
      running = true;
      hud();
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    // ----- objects -----
    function skySize() { return { W: sky.clientWidth || 600, H: sky.clientHeight || 400 }; }

    function spawn(force) {
      const d = difficulty(level);
      const { W, H } = skySize();
      const f = force || {};
      const hazard = f.kind ? f.kind === 'hazard' : (d.hazardTypes.length > 0 && rng() < d.hazardChance);
      const move = f.move || pick(d.moves);
      const base = Math.min(CONFIG.size.maxPx, Math.max(CONFIG.size.minPx, W * CONFIG.size.widthFraction));
      const size = Math.max(CONFIG.size.floorPx, base * d.scale);
      const h = hazard ? size : size * 1.25;
      const node = el('div', hazard ? `pz-hazard ${f.type || pick(d.hazardTypes.length ? d.hazardTypes : ['rock'])}` : 'pz-balloon');
      if (hazard) { node.textContent = '✖'; node.style.fontSize = `${Math.round(size * 0.5)}px`; node.setAttribute('aria-label', 'Do not tap'); }
      else node.style.setProperty('--c', COLOURS[Math.floor(rng() * COLOURS.length) % COLOURS.length]);
      node.style.width = `${Math.round(size)}px`;
      node.style.height = `${Math.round(h)}px`;
      const vy = ((H + h + 20) / d.rise) * rand(CONFIG.speedJitter[0], CONFIG.speedJitter[1]);   // px per second, upwards
      const x0 = rand(0, Math.max(0, W - size));
      const sign = rng() < 0.5 ? -1 : 1;
      const o = {
        el: node, hazard, move, size, h, x0, x: x0, y: H + 10, vy, t: 0, sign, phase: rand(0, 6.28),
        amp: rand(40, 90), omega: rand(1.3, 2.1),
        vx: move === 'diagonal' ? (x0 < W / 2 ? 1 : -1) * vy * rand(0.3, 0.5) : move === 'bounce' ? sign * vy * rand(0.5, 0.8) : 0
      };
      node.addEventListener('pointerdown', (event) => { event.preventDefault(); tap(o); });
      objects.push(o);
      sky.append(node);
      place(o);
      return o;
    }

    function place(o) {
      o.el.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px)`;
    }

    // Advances everything by dt seconds. Paths: straight up, diagonal, curve (sine), zigzag (triangle), bounce off the walls.
    function step(dt) {
      if (!running) return;
      const { W } = skySize();
      spawnAcc += dt * 1000;
      if (autoSpawn && spawnAcc >= nextSpawn) {
        spawnAcc = 0;
        nextSpawn = difficulty(level).spawn * rand(0.8, 1.2);
        spawn();
      }
      for (const o of objects.slice()) {
        o.t += dt;
        o.y -= o.vy * dt;
        const right = Math.max(0, W - o.size);
        if (o.move === 'diagonal') o.x = Math.min(right, Math.max(0, o.x + o.vx * dt));
        else if (o.move === 'curve') o.x = Math.min(right, Math.max(0, o.x0 + o.amp * Math.sin(o.phase + o.t * o.omega)));
        else if (o.move === 'zigzag') {
          const tri = Math.abs(((o.t * 1.4 + o.phase / 6.28) % 2) - 1) * 2 - 1;   // -1..1 triangle wave
          o.x = Math.min(right, Math.max(0, o.x0 + o.amp * 1.2 * tri));
        } else if (o.move === 'bounce') {
          o.x += o.vx * dt;
          if (o.x < 0) { o.x = 0; o.vx = Math.abs(o.vx); }
          if (o.x > right) { o.x = right; o.vx = -Math.abs(o.vx); }
        }
        place(o);
        if (o.y + o.h < 0) {                                      // reached the top
          removeObject(o);
          if (!o.hazard && CONFIG.missLosesLife) { loseLife(1, 'Missed! −1 ❤️'); }
          if (!running) return;
        }
      }
    }

    function frame(ts) {
      if (!alive || !running) return;
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      step(dt);
      if (running) raf = requestAnimationFrame(frame);
    }

    function removeObject(o) {
      objects = objects.filter(x => x !== o);
      o.el.remove();
    }

    function tap(o) {
      if (!running || !objects.includes(o)) return;               // one tap, one effect
      objects = objects.filter(x => x !== o);
      o.el.classList.add('popped');
      later(() => o.el.remove(), 200);
      if (o.hazard) {
        sound('wrong');
        loseLife(CONFIG.hazardPenalty, 'Oops, ✖! −1 ❤️');
        return;
      }
      sound('correct');
      score += 1;
      const before = level;
      level = levelFor(score);
      if (level > before) {
        const d = difficulty(level);
        flash(`Level ${level + 1}!`, 'up');
        if (d.hazardTypes.length && !hazardTip) { hazardTip = true; later(() => flash('Watch out for grey ✖ objects!', 'warn'), 1200); }
      }
      hud();
    }

    function loseLife(n, text) {
      lives = Math.max(0, lives - n);
      flash(text, 'hurt');
      sky.classList.add('hurt');
      later(() => sky.classList.remove('hurt'), 250);
      hud();
      if (lives <= 0) gameOver();
    }

    function gameOver() {
      running = false;
      cancelAnimationFrame(raf);
      clearObjects();
      let record = null;
      if (ctx && player) record = ctx.record(player, 'balloon', score);
      if (ctx && ctx.end) ctx.end('over');                  // the session ends with the game: actual time is charged now
      hud();
      over.innerHTML = '';
      over.classList.remove('hidden');
      over.append(el('h3', '', 'Game over'));
      over.append(el('p', 'pz-over-text', score === 1 ? 'You popped 1 balloon!' : `You popped ${score} balloons!`));
      if (player) over.append(el('p', 'pz-over-text', `Personal best: ${bestNow()}`));
      if (record && record.isNew) over.append(el('p', 'pz-pb', '🎉 New personal best!'));
      const row = el('div', 'pz-actions');
      const again = el('button', 'primary-button compact', 'Play again');
      again.type = 'button';
      again.id = 'pzBalloonAgain';
      again.addEventListener('click', start);
      const change = el('button', 'secondary-button', 'Change player');
      change.type = 'button';
      change.addEventListener('click', showIntro);
      row.append(again, change);
      over.append(row);
    }

    showIntro();

    return {
      destroy() {
        alive = false;
        running = false;
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
        timers.clear();
      },
      // Helpers for the automated tests (not used by the game itself).
      _step: step,
      _spawn: spawn,
      _state: () => ({ score, lives, level, running, objects: objects.map(o => ({ hazard: o.hazard, move: o.move, size: o.size, vy: o.vy, y: o.y, x: o.x, el: o.el })) }),
      _setScore: (n) => { score = n; level = levelFor(n); hud(); }
    };
  }

  root.MQPlayzone.register({
    id: 'balloon',
    title: 'Balloon Pop',
    icon: '🎈',
    desc: 'Pop balloons, dodge the grey ✖ objects, and survive as long as you can!',
    players: 1,
    mount,
    difficulty,
    config: CONFIG
  });
})();
