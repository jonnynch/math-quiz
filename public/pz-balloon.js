// Playzone game 3: Balloon Pop (one player). Balloons rise from the bottom; tap one to pop it. Plain DOM + CSS animation.
// Playing does not earn Screen-time minutes. Restarting inside the game is free; the cost was paid when it was opened.
(() => {
  'use strict';

  const root = window;
  const DURATION = 30;                                   // seconds per game
  const COLOURS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const rand = (min, max) => min + Math.random() * (max - min);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(host, options) {
    const seconds = (options && options.duration) || DURATION;
    host.innerHTML = '';
    const game = el('div', 'pz-balloon-game');
    const bar = el('div', 'pz-bar');
    const scoreText = el('strong', 'pz-score');
    const timeText = el('strong', 'pz-time');
    bar.append(scoreText, timeText);
    const sky = el('div', 'pz-sky');
    const over = el('div', 'pz-over hidden');
    const overText = el('p', 'pz-over-text');
    const again = el('button', 'primary-button compact', 'Play again');
    again.type = 'button';
    over.append(el('h3', '', "Time's up! 🎉"), overText, again);
    game.append(bar, sky, over);
    host.append(game);

    let score = 0;
    let endAt = 0;
    let spawnTimer = null;
    let tickTimer = null;
    let alive = true;
    const timers = new Set();

    const later = (fn, ms) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };

    function showScore() {
      scoreText.textContent = `🎈 ${score}`;
    }

    function pop(balloon) {
      if (!alive || balloon.dataset.popped) return;       // a balloon can only score once
      balloon.dataset.popped = '1';
      balloon.classList.add('popped');
      score += 1;
      showScore();
      if (root.MQAudio) root.MQAudio.playSound('correct');
      later(() => balloon.remove(), 200);
    }

    function spawn() {
      const balloon = el('div', 'pz-balloon');
      const colour = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      const duration = rand(4, 7);
      balloon.style.setProperty('--c', colour);
      balloon.style.left = `${rand(3, 83)}%`;
      balloon.style.setProperty('--rise', `${-((sky.clientHeight || 400) + 180)}px`);
      balloon.style.setProperty('--drift', `${Math.round(rand(-30, 30))}px`);
      balloon.style.animationDuration = `${duration}s`;
      balloon.addEventListener('pointerdown', (event) => { event.preventDefault(); pop(balloon); });
      sky.append(balloon);
      later(() => balloon.remove(), duration * 1000 + 100);   // gone once it reaches the top (also if animations are off)
    }

    function scheduleSpawn() {
      const elapsed = seconds - Math.max(0, (endAt - Date.now()) / 1000);
      spawnTimer = setTimeout(() => {
        if (!alive) return;
        spawn();
        scheduleSpawn();
      }, Math.max(380, 800 - elapsed * 12));              // gets a little busier as time passes
    }

    function tick() {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      timeText.textContent = `⏱ ${left}s`;
      if (Date.now() >= endAt) finish();
    }

    function finish() {
      clearTimeout(spawnTimer);
      clearInterval(tickTimer);
      sky.innerHTML = '';
      timeText.textContent = '⏱ 0s';
      overText.textContent = score === 1 ? 'You popped 1 balloon!' : `You popped ${score} balloons!`;
      over.classList.remove('hidden');
    }

    function start() {
      clearTimeout(spawnTimer);
      clearInterval(tickTimer);
      timers.forEach(clearTimeout);
      timers.clear();
      sky.innerHTML = '';
      over.classList.add('hidden');
      score = 0;
      showScore();
      endAt = Date.now() + seconds * 1000;
      tick();
      tickTimer = setInterval(tick, 200);
      spawn();
      scheduleSpawn();
    }

    again.addEventListener('click', start);
    start();

    return {
      destroy() {
        alive = false;
        clearTimeout(spawnTimer);
        clearInterval(tickTimer);
        timers.forEach(clearTimeout);
        timers.clear();
      }
    };
  }

  root.MQPlayzone.register({
    id: 'balloon',
    title: 'Balloon Pop',
    icon: '🎈',
    desc: 'Pop as many balloons as you can before time runs out!',
    cost: 1,
    players: 1,
    mount
  });
})();
