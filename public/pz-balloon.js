// Playzone game 3: Balloon Pop, an endless survival game. Pop balloons to score; you lose a life when you tap a grey ✖
// object or let a balloon escape off the top. The game ends when all lives are gone. It gets harder as the score grows.
// Playing does not earn Screen-time minutes. Play again inside the game is free; the cost was paid when it was opened.
(() => {
  'use strict';

  const root = window;

  // ===== Difficulty: everything that changes with progress is defined here, and only here =====
  // Level = floor(pops / levelEvery) with NO maximum (shown as level + 1). Only balloon pops count towards levels:
  // combo bonus points raise the score but never skip levels. Each setting is "start value, change per level, limit".
  // Individual settings stop at their own limit; after that the endless pressure (see `endless`) keeps rising.
  const CONFIG = {
    lives: 5,
    levelEvery: 4,                                        // balloon pops needed for the next level
    missLosesLife: true,                                  // a balloon that reaches the top costs a life
    hazardPenalty: 1,                                     // lives lost for tapping a ✖ object
    rise: { start: 7.5, factor: 0.95, min: 2.5 },         // seconds for an object to cross the screen (limit reached near level 22)
    size: { widthFraction: 0.12, minPx: 72, maxPx: 120, shrink: 0.03, minScale: 0.6, floorPx: 54 },   // balloon width; never below floorPx
    spawn: { start: 1100, factor: 0.95, min: 380 },       // ms between new objects
    maxObjects: 8,                                        // never more than this many objects on screen (fairness)
    speedJitter: [0.85, 1.2],                             // each object's own speed varies a little
    // Movement patterns appear one by one: object paths get less simple as the level rises.
    moves: [
      { id: 'straight', level: 0 },
      { id: 'diagonal', level: 2 },
      { id: 'curve', level: 4 },
      { id: 'zigzag', level: 6 },
      { id: 'bounce', level: 8 }
    ],
    // Grey ✖ objects (never tap these). Chance grows with the level up to max (night adds a little, still capped).
    hazards: {
      startLevel: 3,
      chance: { start: 0.1, perLevel: 0.02, max: 0.33 },
      types: [{ id: 'rock', level: 3 }, { id: 'spiky', level: 6 }]
    },
    // Once the settings above are at their limits, the endless pressure ramps up from `from` over `rampLevels` levels:
    // objects arrive in pairs now and then, speeds vary more and sideways sway grows. Each effect has its own cap.
    endless: { from: 20, rampLevels: 60, doubleChance: 0.3, jitterMax: 1.5, swayMax: 1.4 },
    // Environments by DISPLAYED level (the first at level 1). Each has a gameplay effect:
    //  wind = sideways drift as a fraction of the screen width per second (gusts change direction),
    //  sway = bigger sideways wobble, hazardBonus = extra ✖ chance, lightning = a short soft flash now and then.
    environments: [
      { id: 'sky', label: 'Clear sky', from: 1, wind: 0, sway: 1, hazardBonus: 0, lightning: false },
      { id: 'windy', label: 'Windy sky', from: 8, wind: 0.06, sway: 1, hazardBonus: 0, lightning: false },
      { id: 'cloudy', label: 'Cloudy sky', from: 15, wind: 0.03, sway: 1.35, hazardBonus: 0, lightning: false },
      { id: 'stormy', label: 'Stormy sky', from: 25, wind: 0.11, sway: 1.2, hazardBonus: 0, lightning: true },
      { id: 'night', label: 'Night sky', from: 40, wind: 0.05, sway: 1.1, hazardBonus: 0.03, lightning: false }
    ],
    lightning: { minGapMs: 8000, maxGapMs: 14000, flashMs: 140 },
    // Combo: consecutive pops. Bonus points at milestones (score only; levels use pops). A miss or ✖ tap resets it.
    combo: { milestones: [{ at: 5, bonus: 2 }, { at: 10, bonus: 5 }, { at: 15, bonus: 8 }, { at: 20, bonus: 12 }], repeatEvery: 10, repeatBonus: 15, showFrom: 2 }
  };

  const COLOURS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  const cleanLevel = (level) => { const n = Math.floor(Number(level)); return Number.isFinite(n) && n > 0 ? n : 0; };
  const levelFor = (pops) => Math.floor(cleanLevel(pops) / CONFIG.levelEvery);   // no maximum
  const environmentFor = (level) => CONFIG.environments.reduce((best, e) => (e.from <= cleanLevel(level) + 1 ? e : best), CONFIG.environments[0]);
  // Bonus points for reaching exactly this combo count (0 when it is not a milestone).
  function comboBonus(count) {
    const c = CONFIG.combo;
    const hit = c.milestones.find(m => m.at === count);
    if (hit) return hit.bonus;
    const last = c.milestones[c.milestones.length - 1].at;
    return count > last && (count - last) % c.repeatEvery === 0 ? c.repeatBonus : 0;
  }

  function difficulty(rawLevel) {
    const level = cleanLevel(rawLevel);
    const h = CONFIG.hazards;
    const env = environmentFor(level);
    const e = CONFIG.endless;
    const pressure = Math.min(1, Math.max(0, (level - e.from) / e.rampLevels));
    const steps = Math.min(level, 400);                               // keeps Math.pow well inside the number range
    const hazardChance = level < h.startLevel ? 0
      : Math.min(h.chance.max, Math.max(0, h.chance.start + h.chance.perLevel * (level - h.startLevel) + env.hazardBonus));
    return {
      level,
      rise: Math.max(CONFIG.rise.min, CONFIG.rise.start * Math.pow(CONFIG.rise.factor, steps)),
      scale: Math.max(CONFIG.size.minScale, 1 - CONFIG.size.shrink * level),
      spawn: Math.max(CONFIG.spawn.min, CONFIG.spawn.start * Math.pow(CONFIG.spawn.factor, steps)),
      moves: CONFIG.moves.filter(m => m.level <= level).map(m => m.id),
      hazardChance,
      hazardTypes: h.types.filter(t => t.level <= level).map(t => t.id),
      env: env.id,
      wind: env.wind,
      sway: env.sway * (1 + (e.swayMax - 1) * pressure),
      lightning: env.lightning,
      pressure,
      doubleChance: e.doubleChance * pressure,
      jitter: [CONFIG.speedJitter[0], CONFIG.speedJitter[1] + (e.jitterMax - CONFIG.speedJitter[1]) * pressure]
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
    const levelText = el('strong', 'pz-level');
    const comboText = el('strong', 'pz-combo hidden');
    comboText.setAttribute('aria-live', 'off');
    const bestText = el('strong', 'pz-best-score');
    bar.append(livesText, scoreText, levelText, comboText, bestText);
    const sky = el('div', 'pz-sky');
    const flashText = el('div', 'pz-flash hidden');
    const lightning = el('div', 'pz-lightning');          // soft flash, never blocks taps
    sky.append(lightning, flashText);

    const intro = el('div', 'pz-over pz-intro');
    const over = el('div', 'pz-over pz-end hidden');
    game.append(bar, sky, intro, over);
    host.append(game);

    let score = 0;                       // total score: pops + combo bonus points
    let pops = 0;                        // balloon pops: the only thing that raises the level
    let combo = 0;
    let bestCombo = 0;                   // best combo of this game
    let gameTime = 0;                    // seconds played in this game (drives wind gusts)
    let envId = 'sky';
    let nextLightning = 0;
    let wonIcons = [];
    const notices = [];
    let noticeBusy = false;
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
      scoreText.textContent = `⭐ ${score}`;
      levelText.textContent = `Level ${level + 1}`;
      const showCombo = combo >= CONFIG.combo.showFrom;
      comboText.classList.toggle('hidden', !showCombo);
      comboText.textContent = showCombo ? `🔥 Combo ×${combo}` : '';
      bestText.textContent = player ? `Best: ${bestNow()}` : 'Guest';
    }

    function flash(text, kind) {
      flashText.textContent = text;
      flashText.className = `pz-flash ${kind || ''}`;
      later(() => flashText.classList.add('hidden'), 1100);
    }

    // Good news (level up, combo milestone, new sky, trophy) is shown one at a time so messages never pile up.
    function announce(text, kind) {
      notices.push([text, kind]);
      if (!noticeBusy) nextNotice();
    }
    function nextNotice() {
      const n = notices.shift();
      if (!n) { noticeBusy = false; return; }
      noticeBusy = true;
      flash(n[0], n[1]);
      later(nextNotice, 1200);
    }

    // ----- environment (sky) -----
    function setEnvironment(id, announceIt) {
      envId = id;
      sky.dataset.env = id;
      const e = CONFIG.environments.find(x => x.id === id);
      if (announceIt && e) announce(`${{ windy: '🌬️', cloudy: '☁️', stormy: '⛈️', night: '🌙', sky: '☀️' }[id] || ''} ${e.label}!`, 'up');
      scheduleLightning();
    }
    function scheduleLightning() {
      const L = CONFIG.lightning;
      nextLightning = gameTime + (L.minGapMs + rng() * (L.maxGapMs - L.minGapMs)) / 1000;
    }
    const calm = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function strike() {
      if (calm()) return;
      lightning.classList.add('on');
      later(() => lightning.classList.remove('on'), CONFIG.lightning.flashMs);
    }

    // ----- trophies (saved profiles only; the trophy rules live in trophies.js) -----
    function checkTrophies() {
      if (!ctx || !ctx.trophies || !player) return;
      const won = ctx.trophies(player, { level: level + 1, combo: bestCombo, pops });
      won.forEach(t => { wonIcons.push(t.icon); announce(`🏆 ${t.name}!`, 'up'); });
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
        CONFIG.missLosesLife ? `⬆️ If a balloon floats off the top, you lose a life.` : '', `🔥 Pop balloons in a row for combo bonus points.`, `${'❤️'.repeat(Math.min(CONFIG.lives, 5))} You have ${CONFIG.lives} lives. There is no timer!`]
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
        select.addEventListener('change', () => { player = ctx.profiles().find(p => p.id === select.value) || null; score = 0; pops = 0; combo = 0; lives = CONFIG.lives; hud(); });
        intro.append(select);
      }
      const go = el('button', 'primary-button compact', 'Start');
      go.type = 'button';
      go.id = 'pzBalloonStart';
      go.addEventListener('click', start);
      intro.append(go);
      lives = CONFIG.lives; score = 0; pops = 0; combo = 0; bestCombo = 0; level = 0;
      setEnvironment('sky', false);
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
      score = 0; pops = 0; combo = 0; bestCombo = 0; level = 0; lives = CONFIG.lives; hazardTip = false;
      gameTime = 0; wonIcons = []; notices.length = 0; noticeBusy = false;
      setEnvironment('sky', false);
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
      const vy = ((H + h + 20) / d.rise) * rand(d.jitter[0], d.jitter[1]);   // px per second, upwards
      const x0 = rand(0, Math.max(0, W - size));
      const sign = rng() < 0.5 ? -1 : 1;
      const o = {
        el: node, hazard, move, size, h, x0, x: x0, y: H + 10, vy, t: 0, sign, phase: rand(0, 6.28),
        amp: rand(40, 90) * d.sway, omega: rand(1.3, 2.1),
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
      const d = difficulty(level);
      gameTime += dt;
      // Wind: a gust that slowly changes direction pushes every object sideways (kept on screen below).
      const drift = d.wind ? d.wind * W * Math.sin(gameTime * 0.5) * dt : 0;
      if (d.lightning && gameTime >= nextLightning) { strike(); scheduleLightning(); }
      spawnAcc += dt * 1000;
      if (autoSpawn && spawnAcc >= nextSpawn) {
        spawnAcc = 0;
        nextSpawn = d.spawn * rand(0.8, 1.2);
        // Never flood the screen: at most CONFIG.maxObjects at once, and pairs only in the endless phase.
        if (objects.length < CONFIG.maxObjects) spawn();
        if (d.doubleChance && rng() < d.doubleChance && objects.length < CONFIG.maxObjects - 1) spawn();
      }
      for (const o of objects.slice()) {
        o.t += dt;
        o.y -= o.vy * dt;
        const right = Math.max(0, W - o.size);
        if (drift) { o.x0 = Math.min(right, Math.max(0, o.x0 + drift)); o.x = Math.min(right, Math.max(0, o.x + drift)); }
        if (o.move === 'straight') o.x = o.x0;
        else if (o.move === 'diagonal') o.x = Math.min(right, Math.max(0, o.x + o.vx * dt));
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
          if (!o.hazard && CONFIG.missLosesLife) { breakCombo(); loseLife(1, 'Missed! −1 ❤️'); }
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
        breakCombo();
        loseLife(CONFIG.hazardPenalty, 'Oops, ✖! −1 ❤️');
        return;
      }
      sound('correct');
      pops += 1;
      score += 1;
      combo += 1;
      if (combo > bestCombo) bestCombo = combo;
      const bonus = comboBonus(combo);
      if (bonus) {                                        // milestone: bonus points (score only, never levels)
        score += bonus;
        announce(`🔥 Combo ×${combo}! +${bonus}`, 'up');
        comboText.classList.add('pulse');
        later(() => comboText.classList.remove('pulse'), 600);
      }
      const before = level;
      level = levelFor(pops);                             // levels follow pops only
      if (level > before) {
        const d = difficulty(level);
        announce(`Level ${level + 1}!`, 'up');
        if (d.env !== envId) setEnvironment(d.env, true);
        if (d.hazardTypes.length && !hazardTip) { hazardTip = true; announce('Watch out for grey ✖ objects!', 'warn'); }
      }
      hud();
      checkTrophies();
    }

    function breakCombo() {
      if (!combo) return;
      combo = 0;
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
      notices.length = 0;
      let record = null;
      combo = 0;
      if (ctx && player) record = ctx.record(player, 'balloon', score);
      if (ctx && ctx.end) ctx.end('over');                  // the session ends with the game: actual time is charged now
      hud();
      over.innerHTML = '';
      over.classList.remove('hidden');
      over.append(el('h3', '', 'Game over'));
      over.append(el('p', 'pz-over-text', pops === 1 ? 'You popped 1 balloon!' : `You popped ${pops} balloons!`));
      over.append(el('p', 'pz-over-text', `Level ${level + 1} · Score ${score} · Best combo ×${bestCombo}`));
      if (wonIcons.length) over.append(el('p', 'pz-over-text', `New trophies: ${wonIcons.join(' ')}`));
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
      _state: () => ({ score, pops, combo, bestCombo, env: envId, lives, level, running, objects: objects.map(o => ({ hazard: o.hazard, move: o.move, size: o.size, vy: o.vy, y: o.y, x: o.x, el: o.el })) }),
      _notices: () => [flashText.textContent, ...notices.map(n => n[0])].join(' | '),
      _setScore: (n) => { score = n; pops = n; level = levelFor(n); setEnvironment(difficulty(level).env, false); hud(); },
      _setPops: (n) => { pops = n; level = levelFor(n); setEnvironment(difficulty(level).env, false); hud(); }
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
    levelFor,
    environmentFor,
    comboBonus,
    config: CONFIG
  });
})();
