// Playzone game 2: Reaction Battle (two players, side by side). Both tap Ready, wait for a random delay, then the
// first tap after GO wins the round. A tap before GO is a false start and loses the round. Best of 3 or 5.
// Input uses pointerdown (like the maths quiz) so two fingers on a touch screen both register.
(() => {
  'use strict';

  const root = window;
  const now = () => (root.performance && root.performance.now ? root.performance.now() : Date.now());

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(host, options) {
    const delayRange = (options && options.delay) || [1500, 4500];   // ms, random wait before GO
    const pause = (options && options.pause) || 2200;                // ms between rounds
    host.innerHTML = '';
    const game = el('div', 'pz-reaction');
    const banner = el('p', 'pz-banner');
    banner.setAttribute('role', 'status');
    const formatRow = el('div', 'pz-format');
    const sides = el('div', 'pz-sides');
    const after = el('div', 'pz-after hidden');
    game.append(banner, formatRow, sides, after);
    host.append(game);

    const view = [1, 2].map(n => {
      const side = el('button', `pz-side ${n === 1 ? 'blue' : 'orange'}`);
      side.type = 'button';
      side.dataset.player = String(n);
      const name = el('span', 'pz-side-name', `Player ${n}`);
      const dots = el('span', 'pz-dots');
      const label = el('span', 'pz-side-label');
      const time = el('span', 'pz-side-time');
      side.append(name, dots, label, time);
      sides.append(side);
      return { side, dots, label, time };
    });

    // phase: format -> ready -> waiting -> go -> decided -> (roundover) -> ready ... -> matchover
    let phase = 'format';
    let target = 2;                      // wins needed: 2 for best of 3, 3 for best of 5
    let bestOf = 3;
    let wins = [0, 0];
    let ready = [false, false];
    let times = [null, null];            // reaction times in ms; null = no valid tap
    let falseStart = [false, false];
    let winner = -1;
    let goAt = 0;
    let waitTimer = null;
    let stepTimer = null;
    let alive = true;

    const clearTimers = () => { clearTimeout(waitTimer); clearTimeout(stepTimer); };
    const sound = (kind) => { if (root.MQAudio) root.MQAudio.playSound(kind); };

    function paint(bannerText, labels) {
      banner.textContent = bannerText;
      game.dataset.phase = phase;
      view.forEach((v, i) => {
        v.label.textContent = labels[i];
        v.dots.textContent = Array.from({ length: target }, (_, k) => (k < wins[i] ? '●' : '○')).join(' ');
        v.time.textContent = falseStart[i] ? '✗ False start' : (times[i] != null ? `${Math.round(times[i])} ms` : '');
        v.side.classList.toggle('winner', winner === i && (phase === 'decided' || phase === 'roundover' || phase === 'matchover'));
        v.side.classList.toggle('ready', ready[i] && phase === 'ready');
      });
    }

    function showFormat() {
      phase = 'format';
      clearTimers();
      wins = [0, 0]; ready = [false, false]; times = [null, null]; falseStart = [false, false]; winner = -1;
      formatRow.innerHTML = '';
      formatRow.classList.remove('hidden');
      after.classList.add('hidden');
      [3, 5].forEach(n => {
        const b = el('button', 'primary-button compact', `Best of ${n}`);
        b.type = 'button';
        b.dataset.bestof = String(n);
        b.addEventListener('click', () => { bestOf = n; target = Math.ceil(n / 2); startMatch(); });
        formatRow.append(b);
      });
      paint('Choose how many rounds', ['', '']);
    }

    function startMatch() {
      wins = [0, 0];
      formatRow.classList.add('hidden');
      after.classList.add('hidden');
      newRound();
    }

    function newRound() {
      clearTimers();
      phase = 'ready';
      ready = [false, false]; times = [null, null]; falseStart = [false, false]; winner = -1;
      paint('Both players: tap READY', ['Tap when ready', 'Tap when ready']);
    }

    function startWait() {
      phase = 'waiting';
      paint('Wait for GO…', ['WAIT…', 'WAIT…']);
      const delay = delayRange[0] + Math.random() * (delayRange[1] - delayRange[0]);
      waitTimer = setTimeout(() => {
        if (!alive || phase !== 'waiting') return;
        phase = 'go';
        goAt = now();
        paint('GO!', ['TAP!', 'TAP!']);
      }, delay);
    }

    function endRound() {
      clearTimers();
      if (phase === 'roundover' || phase === 'matchover') return;
      wins[winner] += 1;
      const name = `Player ${winner + 1}`;
      const reason = falseStart[1 - winner] ? `Player ${2 - winner} false start! ` : '';
      if (wins[winner] >= target) {
        phase = 'matchover';
        paint(`${reason}🏆 ${name} wins the match!`, ['', '']);
        showAfter();
      } else {
        phase = 'roundover';
        paint(`${reason}${name} wins the round!`, ['', '']);
        stepTimer = setTimeout(() => { if (alive) newRound(); }, pause);
      }
    }

    function showAfter() {
      after.innerHTML = '';
      after.classList.remove('hidden');
      const rematch = el('button', 'primary-button compact', `Rematch (best of ${bestOf})`);
      rematch.type = 'button';
      rematch.id = 'pzRematch';
      rematch.addEventListener('click', startMatch);
      const change = el('button', 'secondary-button', 'Change format');
      change.type = 'button';
      change.addEventListener('click', showFormat);
      after.append(rematch, change);
    }

    // One handler decides everything, so two near-simultaneous taps are processed one after the other and only
    // the first can win: later taps hit a phase that no longer accepts them.
    function tap(i) {
      if (phase === 'ready') {
        ready[i] = true;
        if (ready[0] && ready[1]) startWait();
        else paint('Waiting for the other player…', ready.map(r => (r ? '✓ Ready' : 'Tap when ready')));
      } else if (phase === 'waiting') {
        clearTimeout(waitTimer);
        falseStart[i] = true;
        winner = 1 - i;
        sound('wrong');
        endRound();
      } else if (phase === 'go') {
        times[i] = now() - goAt;
        winner = i;
        phase = 'decided';
        sound('correct');
        paint(`Player ${i + 1} was first!`, ['', '']);
        stepTimer = setTimeout(endRound, 700);   // short window so the other player's time is recorded too
      } else if (phase === 'decided' && i !== winner && times[i] == null) {
        times[i] = now() - goAt;
        paint(banner.textContent, ['', '']);
        endRound();
      }
    }

    view.forEach((v, i) => {
      v.side.addEventListener('pointerdown', (event) => { event.preventDefault(); tap(i); });
      v.side.addEventListener('click', (event) => { if (event.detail === 0) tap(i); });   // keyboard only
    });

    showFormat();

    return {
      destroy() {
        alive = false;
        clearTimers();
      }
    };
  }

  root.MQPlayzone.register({
    id: 'reaction',
    title: 'Reaction Battle',
    icon: '⚡',
    desc: 'Who taps first when GO appears? Do not tap too early!',
    cost: 1,
    players: 2,
    mount
  });
})();
