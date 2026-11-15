// Playzone: fun mini-games unlocked with Screen-time Bank minutes. This file is the shared shell only:
// the menu, the profile/balance line, the cost screen, redemption and the stage that hosts one game.
// Each game lives in its own file (pz-*.js) and registers itself with MQPlayzone.register(); a game never
// touches the bank. Starting a game spends minutes from the existing bank with Store.redeemForPlay (child taps Play,
// no parent question; one deduction per start). Playing never earns minutes. Manual adjustment is parent-only (pz-adjust.js).
(() => {
  'use strict';

  const root = window;
  const Store = root.MQStore;
  const Parent = root.MQParent;
  const Menus = root.MQMenus;
  const $ = (id) => document.getElementById(id);

  const games = [];                 // registered games, in menu order
  let profileId = null;             // whose bank pays
  let pending = null;               // { game, profile } while the cost screen is open
  let running = null;               // { game, instance } while a game is on the stage
  let redeeming = false;            // blocks a second deduction from repeated taps

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // A game is { id, title, icon, desc, cost (whole minutes >= 1), players (1|2), mount(host) -> { destroy() } }.
  function register(game) {
    if (!game || !game.id || typeof game.mount !== 'function') return false;
    if (!Number.isInteger(game.cost) || game.cost < 1) return false;
    if (games.some(g => g.id === game.id)) return false;
    games.push(game);
    if (!$('playzonePanel').classList.contains('hidden')) renderMenu();
    return true;
  }

  const profiles = () => (Store.getProfiles() || []).filter(p => p && p.rewards);
  const balanceOf = (profile) => (profile && profile.rewards ? Math.max(0, profile.rewards.earned - profile.rewards.redeemed) : 0);
  const currentProfile = () => (profileId ? Store.getProfile(profileId) : null);
  const mins = (n) => `${n} min`;

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
    $('pzAdjust').classList.add('hidden');
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
      const enough = !!profile && balance >= game.cost;
      meta.append(el('span', `pz-chip pz-cost${enough ? '' : ' short'}`, `⏱ ${mins(game.cost)}${enough ? '' : ' 🔒'}`),
        el('span', 'pz-chip', game.players === 2 ? '👥 2 players' : '👤 1 player'));
      card.append(meta);
      card.addEventListener('click', () => openConfirm(game));
      grid.append(card);
    });
    if (!profile) notice('Make a profile in 👤 Profiles and earn minutes with Grade 1–6 maths to unlock games.', '');
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
    const enough = !!profile && balance >= game.cost;

    box.append(el('div', 'pz-icon big', game.icon), el('h3', '', game.title),
      el('p', 'pz-cost-line', `This game costs ${mins(game.cost)}.`),
      el('p', 'pz-balance-line', profile ? `${profile.avatar || ''} ${profile.name} has ${mins(balance)}.` : 'Choose a profile first.'));
    if (!enough) {
      box.append(el('p', 'setting-help error', profile
        ? `Not enough minutes yet. Answer Grade 1–6 maths questions to earn more.`
        : 'Games need a saved profile with minutes.'));
    }
    const actions = el('div', 'pz-actions');
    const play = el('button', 'primary-button compact', `Play (${mins(game.cost)})`);
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

  // The only place Playzone spends minutes. `redeeming` blocks re-entry and the button disables on the first tap, so
  // repeated taps cannot deduct twice. The balance is re-checked here against the live profile.
  function spendAndStart() {
    if (redeeming || !pending) return;
    redeeming = true;
    const { game } = pending;
    try {
      const profile = currentProfile();
      const result = Store.redeemForPlay(profile, game.cost);
      if (result.error) { renderMenu(); notice(result.error, 'error'); return; }
      startGame(game, result.saved === false);
    } finally {
      redeeming = false;
    }
  }

  // ---------- stage ----------
  function startGame(game, saveFailed) {
    pending = null;
    $('pzMenuView').classList.add('hidden');
    $('pzStageView').classList.remove('hidden');
    document.body.classList.add('pz-stage');
    $('pzStageTitle').textContent = `${game.icon} ${game.title}`;
    $('pzSaveWarning').classList.toggle('hidden', !saveFailed);
    const host = $('pzHost');
    host.innerHTML = '';
    let instance = null;
    try { instance = game.mount(host, { ctx: makeCtx() }); } catch (error) { host.textContent = 'Sorry, this game could not start.'; }
    running = { game, instance };
  }

  // What a game may use: the saved profiles (to pick who plays) and a way to keep a personal best. Never the bank.
  function makeCtx() {
    const bank = currentProfile();
    const p2 = Menus.selectedProfile(2);
    const saved = profiles();
    return {
      profiles: () => profiles(),
      defaults: [bank ? bank.id : null, p2 && p2.id !== (bank && bank.id) && saved.some(p => p.id === p2.id) ? p2.id : null],
      record: (profile, kind, value) => Store.recordPlayzone(profile, kind, value)
    };
  }

  function endGame() {
    if (running && running.instance && running.instance.destroy) {
      try { running.instance.destroy(); } catch (error) { /* a game must never block leaving */ }
    }
    running = null;
    $('pzHost').innerHTML = '';
    document.body.classList.remove('pz-stage');
    $('pzStageView').classList.add('hidden');
    $('pzMenuView').classList.remove('hidden');
  }

  function leaveStage() {
    endGame();
    renderMenu();
  }

  // ---------- open / close ----------
  function open() {
    $('setupPanel').classList.add('hidden');
    $('playzonePanel').classList.remove('hidden');
    $('gameStatus').textContent = 'Playzone';
    if (Parent.hard) Parent.hard.lock();
    endGame();
    renderMenu();
  }

  function close() {
    endGame();
    pending = null;
    if (Parent.hard) Parent.hard.lock();
    $('playzonePanel').classList.add('hidden');
    $('setupPanel').classList.remove('hidden');
    $('gameStatus').textContent = 'Ready to play';
  }

  $('playzoneButton').addEventListener('click', open);
  $('pzBack').addEventListener('click', close);
  $('pzLeave').addEventListener('click', leaveStage);
  $('pzProfile').addEventListener('change', () => { profileId = $('pzProfile').value; renderMenu(); });

  root.MQPlayzone = { register, open, close, games: () => games.map(g => g.id), game: (id) => games.find(g => g.id === id) || null, current: () => (running ? running.instance : null), balanceOf, menu: () => renderMenu() };
})();
