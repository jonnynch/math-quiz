// Playzone: fun mini-games unlocked with Screen-time Bank minutes. This file is the shared shell only:
// the menu, the profile/balance line, the cost screen, redemption and the stage that hosts one game.
// Each game lives in its own file (pz-*.js) and registers itself with MQPlayzone.register(); a game never
// touches the bank. Nothing is deducted when a game starts: the shell tracks the actual time of each session
// (Store.startPlay / tickPlay / endPlay) and charges it when the session ends, rounded UP to whole minutes. A new
// session can only start while the balance is above 0; a running session always finishes and may leave the balance
// negative. Children never see a parent question here. Playing never earns minutes. Manual adjustment of the bank
// is parent-only and lives on the Screen-time page (bank-adjust.js), not here.
(() => {
  'use strict';

  const root = window;
  const Store = root.MQStore;
  const Menus = root.MQMenus;
  const $ = (id) => document.getElementById(id);

  const games = [];                 // registered games, in menu order
  let profileId = null;             // whose bank pays
  let pending = null;               // { game, profile } while the cost screen is open
  let running = null;               // { game, instance } while a game is on the stage
  let redeeming = false;            // blocks a second start from repeated taps
  let lastCharge = null;            // result of the most recent charge, shown in the menu after leaving a game
  let heartbeat = null;             // saves the played time every few seconds while a session runs
  let clockTimer = null;            // repaints the "time used" line
  const HEARTBEAT_MS = 5000;
  const perfNow = () => (root.performance && root.performance.now ? root.performance.now() : Date.now());

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // A game is { id, title, icon, desc, players (1|2), mount(host, { ctx }) -> { destroy() } }. There is no fixed cost.
  function register(game) {
    if (!game || !game.id || typeof game.mount !== 'function') return false;
    if (games.some(g => g.id === game.id)) return false;
    games.push(game);
    if (!$('playzonePanel').classList.contains('hidden')) renderMenu();
    return true;
  }

  const profiles = () => (Store.getProfiles() || []).filter(p => p && p.rewards);
  const balanceOf = (profile) => (profile && profile.rewards ? Store.rewardBalance(profile) : 0);   // may be negative
  const currentProfile = () => (profileId ? Store.getProfile(profileId) : null);
  const mins = (n) => `${n} min`;
  const NO_MINUTES = 'The Screen-time Bank must be above 0 minutes before another game can start. Answer Grade 1–6 maths questions to earn more, or ask a parent.';

  function notice(text, kind) {
    const node = $('pzNotice');
    node.textContent = text || '';
    node.classList.toggle('hidden', !text);
    node.classList.toggle('error', kind === 'error');
    node.classList.toggle('good', kind === 'good');
  }

  // ---------- menu ----------
  function refreshProfileSelect() {
    const select = $('pzProfile');
    const list = profiles();
    if (!list.some(p => p.id === profileId)) {
      const chosen = Menus.selectedProfile(1);
      profileId = chosen && list.some(p => p.id === chosen.id) ? chosen.id : (list[0] ? list[0].id : null);
    }
    select.innerHTML = '';
    list.forEach(p => {
      const option = el('option', '', `${p.avatar || ''} ${p.name}`.trim());   // textContent only: names are user-typed
      option.value = p.id;
      select.append(option);
    });
    if (profileId) select.value = profileId;
    $('pzProfileRow').classList.toggle('hidden', !list.length);
  }

  function renderMenu() {
    pending = null;
    refreshProfileSelect();
    const profile = currentProfile();
    const balance = balanceOf(profile);
    $('pzBalance').textContent = profile ? `⏱ ${mins(balance)} available` : '⏱ No profile';
    $('pzConfirm').classList.add('hidden');
    $('pzGames').classList.remove('hidden');
    const grid = $('pzGames');
    grid.innerHTML = '';
    games.forEach(game => {
      const card = el('button', `pz-card pz-g-${game.id}`);
      card.type = 'button';
      card.dataset.game = game.id;
      card.append(el('span', 'pz-icon', game.icon), el('strong', 'pz-title', game.title), el('span', 'pz-desc', game.desc));
      const meta = el('span', 'pz-meta');
      const enough = !!profile && balance > 0;
      meta.append(el('span', `pz-chip pz-cost${enough ? '' : ' short'}`, `⏱ Pay as you play${enough ? '' : ' 🔒'}`),
        el('span', 'pz-chip', game.players === 2 ? '👥 2 players' : '👤 1 player'));
      card.append(meta);
      card.addEventListener('click', () => openConfirm(game));
      grid.append(card);
    });
    if (!profile) notice('Make a profile in 👤 Profiles and earn minutes with Grade 1–6 maths to unlock games.', '');
    else if (balance <= 0) notice(NO_MINUTES, 'error');
    else notice('', '');
  }

  // ---------- cost screen + redemption ----------
  function openConfirm(game) {
    const profile = currentProfile();
    notice('', '');
    $('pzGames').classList.add('hidden');
    const box = $('pzConfirm');
    box.innerHTML = '';
    box.classList.remove('hidden');
    pending = { game, profile };
    const balance = balanceOf(profile);
    const enough = !!profile && balance > 0;

    box.append(el('div', 'pz-icon big', game.icon), el('h3', '', game.title),
      el('p', 'pz-cost-line', 'Minutes are used while you play: each minute (or part of a minute) counts as 1 min.'),
      el('p', 'pz-balance-line', profile ? `${profile.avatar || ''} ${profile.name} has ${mins(balance)}.` : 'Choose a profile first.'));
    if (!enough) {
      box.append(el('p', 'setting-help error', profile
        ? NO_MINUTES
        : 'Games need a saved profile with minutes.'));
    }
    const actions = el('div', 'pz-actions');
    const play = el('button', 'primary-button compact', 'Play');
    play.type = 'button';
    play.id = 'pzPlay';
    play.disabled = !enough;
    const cancel = el('button', 'secondary-button', 'Back');
    cancel.type = 'button';
    cancel.id = 'pzCancel';
    cancel.addEventListener('click', renderMenu);
    actions.append(play, cancel);
    box.append(actions);
    play.addEventListener('click', () => {
      if (!enough || redeeming) return;
      play.disabled = true;                // one tap is enough
      spendAndStart();
    });
  }

  // Tapping Play only checks that the bank is above 0 (nothing is deducted). The session itself starts when the game
  // really begins (ctx.begin), and is charged when it ends. `redeeming` blocks a second start from repeated taps.
  function spendAndStart() {
    if (redeeming || !pending) return;
    redeeming = true;
    const { game } = pending;
    try {
      const profile = currentProfile();
      if (!profile || balanceOf(profile) <= 0) { renderMenu(); notice(NO_MINUTES, 'error'); return; }
      startGame(game);
    } finally {
      redeeming = false;
    }
  }

  // ---------- stage ----------
  function startGame(game) {
    pending = null;
    stopClocks();
    $('pzMenuView').classList.add('hidden');
    $('pzStageView').classList.remove('hidden');
    document.body.classList.add('pz-stage');
    $('pzStageTitle').textContent = `${game.icon} ${game.title}`;
    $('pzSaveWarning').classList.add('hidden');
    usage('');
    const host = $('pzHost');
    host.innerHTML = '';
    let instance = null;
    running = { game, instance: null, profile: currentProfile() };   // set before mount so ctx can reach the profile
    try { instance = game.mount(host, { ctx: makeCtx() }); } catch (error) { host.textContent = 'Sorry, this game could not start.'; }
    running.instance = instance;
  }

  // ---------- usage sessions ----------
  const usage = (text, kind) => { const node = $('pzUsage'); node.textContent = text || ''; node.classList.toggle('hidden', !text); node.classList.toggle('error', kind === 'error'); node.classList.toggle('good', kind === 'good'); };
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  function stopClocks() {
    clearInterval(heartbeat); clearInterval(clockTimer);
    heartbeat = clockTimer = null;
  }

  function paintClock() {
    if (!running || !Store.activePlay(running.profile)) return;
    usage(`⏱ Time used: ${clock(Store.playSeconds(running.profile, perfNow()))} · Balance now: ${mins(balanceOf(running.profile))} (charged when you finish)`);
  }

  // Starts the usage session of the running game. Returns '' on success, otherwise a message for the child.
  function beginSession() {
    if (!running) return 'Choose a game first.';
    const result = Store.startPlay(running.profile, running.game.id, perfNow());
    if (result.running) return '';                      // already tracking: one session at a time, never two
    if (result.error) { usage(result.error, 'error'); return result.error; }
    if (result.saved === false) $('pzSaveWarning').classList.remove('hidden');
    stopClocks();
    heartbeat = setInterval(() => {
      if (!running) return;
      const t = Store.tickPlay(running.profile, perfNow());
      if (t.ended) { stopClocks(); usage('This game was ended in another window.', 'error'); }
    }, HEARTBEAT_MS);
    clockTimer = setInterval(paintClock, 1000);
    paintClock();
    return '';
  }

  // Ends the session and charges the actual usage, rounded up to whole minutes. Safe to call more than once.
  function finishSession(reason) {
    if (!running) return null;
    stopClocks();
    const result = Store.endPlay(running.profile, perfNow(), reason || 'ended');
    if (result) {
      usage(`⏱ Used ${mins(result.minutes)} this time. Balance now: ${mins(result.balance)}.${result.balance <= 0 ? ' Another game can start once the balance is above 0.' : ''}`, result.balance <= 0 ? 'error' : 'good');
      if (result.saved === false) $('pzSaveWarning').classList.remove('hidden');
      lastCharge = result;
    }
    return result;
  }


  // What a game may use: the saved profiles (to pick who plays), a way to keep a personal best, and its own usage
  // session. begin() starts the session when the game really starts (it fails when the bank is not above 0) and end()
  // ends it (e.g. at game over). A game never touches the bank itself.
  function makeCtx() {
    const bank = currentProfile();
    const p2 = Menus.selectedProfile(2);
    const saved = profiles();
    return {
      profiles: () => profiles(),
      defaults: [bank ? bank.id : null, p2 && p2.id !== (bank && bank.id) && saved.some(p => p.id === p2.id) ? p2.id : null],
      record: (profile, kind, value) => Store.recordPlayzone(profile, kind, value),
      trophies: (profile, stats) => { const won = root.MQTrophies ? root.MQTrophies.recordBalloon(profile, stats) : []; if (won.length) Store.save(); return won; },   // saved profiles only
      begin: () => beginSession(),                // '' when a session is running, otherwise the reason it could not start
      end: (reason) => finishSession(reason),     // charges the actual usage now
      active: () => (running ? Store.activePlay(running.profile) : false),
      seconds: () => (running ? Store.playSeconds(running.profile, perfNow()) : 0),
      saveDesign: (design) => (running ? Store.saveDesign(running.profile, design) : false),
      design: () => (running && running.profile.playzone.design) || null
    };
  }

  function endGame() {
    if (running && running.instance && running.instance.destroy) {
      try { running.instance.destroy(); } catch (error) { /* a game must never block leaving */ }   // a game saves its work here
    }
    if (running) finishSession('left');      // leaving, closing or navigating away ends the session and charges it
    stopClocks();
    running = null;
    $('pzHost').innerHTML = '';
    document.body.classList.remove('pz-stage');
    $('pzStageView').classList.add('hidden');
    $('pzMenuView').classList.remove('hidden');
  }

  function leaveStage() {
    endGame();
    renderMenu();
    if (lastCharge) {
      notice(`⏱ Used ${mins(lastCharge.minutes)}. Balance now: ${mins(lastCharge.balance)}.${lastCharge.balance <= 0 ? ' ' + NO_MINUTES : ''}`, lastCharge.balance <= 0 ? 'error' : 'good');
      lastCharge = null;
    }
  }

  // ---------- open / close ----------
  function open() {
    $('setupPanel').classList.add('hidden');
    $('playzonePanel').classList.remove('hidden');
    $('gameStatus').textContent = 'Playzone';
    endGame();
    renderMenu();
  }

  function close() {
    endGame();
    pending = null;
    $('playzonePanel').classList.add('hidden');
    $('setupPanel').classList.remove('hidden');
    $('gameStatus').textContent = 'Ready to play';
  }

  $('playzoneButton').addEventListener('click', open);
  $('pzBack').addEventListener('click', close);
  $('pzLeave').addEventListener('click', leaveStage);
  // The page going away (refresh, tab closed, app switched off) keeps the time played so far; the session is ended
  // on the next launch by Store.reconcilePlay.
  const flush = () => { if (running && Store.activePlay(running.profile)) Store.tickPlay(running.profile, perfNow()); };
  root.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  $('pzProfile').addEventListener('change', () => { profileId = $('pzProfile').value; renderMenu(); });

  root.MQPlayzone = { register, open, close, games: () => games.map(g => g.id), game: (id) => games.find(g => g.id === id) || null, current: () => (running ? running.instance : null), balanceOf, menu: () => renderMenu(), reconcile: () => Store.reconcilePlay() };
})();
