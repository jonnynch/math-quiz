// Settings window, Profiles window and the "Who's playing?" selectors.
(function (root) {
  'use strict';

  const Store = root.MQStore;
  const Q = root.MQQuestions;
  const $ = (id) => document.getElementById(id);
  let lastFocus = null;
  let expandedId = null;
  let pendingDeleteId = null;
  let chosenAvatar = Store.AVATARS[0];

  const api = {
    // game.js sets this: called with (playerNumber, profileOrNull) after a profile is picked.
    onProfileChosen: null,

    selectedProfile(playerNumber) {
      const select = $('profile' + playerNumber);
      return select && select.value ? Store.getProfile(select.value) : null;
    },

    refreshProfileSelects() {
      [1, 2].forEach(n => {
        const select = $('profile' + n);
        const keep = select.value;
        select.innerHTML = '';
        const guest = document.createElement('option');
        guest.value = '';
        guest.textContent = 'Guest (progress not saved)';
        select.append(guest);
        Store.getProfiles().forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = `${p.avatar} ${p.name}`;
          select.append(option);
        });
        select.value = Store.getProfile(keep) ? keep : '';
      });
      syncDuplicates();
    }
  };

  // The same profile cannot be chosen for both players.
  function syncDuplicates() {
    [[1, 2], [2, 1]].forEach(([mine, other]) => {
      const taken = $('profile' + other).value;
      $('profile' + mine).querySelectorAll('option').forEach(option => {
        option.disabled = !!taken && option.value === taken;
      });
    });
  }

  // ---------- settings ----------
  function applySettings() {
    const settings = Store.getSettings();
    document.documentElement.dataset.palette = settings.palette;
    document.documentElement.dataset.text = settings.text;
    document.querySelectorAll('.seg-button').forEach(button => {
      const on = settings[button.dataset.setting] === button.dataset.value;
      button.classList.toggle('selected', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  // ---------- modal helpers ----------
  function openModal(id) {
    lastFocus = document.activeElement;
    $(id).classList.remove('hidden');
    document.body.classList.add('modal-open');
    const focus = $(id).querySelector('[data-autofocus]');
    if (focus) focus.focus();
  }

  function closeModal(id) {
    $(id).classList.add('hidden');
    if (!document.querySelector('.modal-backdrop:not(.hidden)')) document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function wireModal(id, openButtonId, closeButtonId) {
    $(openButtonId).addEventListener('click', () => {
      if (id === 'profilesModal') { pendingDeleteId = null; renderProfiles(); }
      openModal(id);
    });
    $(closeButtonId).addEventListener('click', () => closeModal(id));
    $(id).addEventListener('click', (event) => { if (event.target === $(id)) closeModal(id); });
  }

  // ---------- profiles window ----------
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function levelText(level, topic) {
    const base = Q.difficultyLabel(level);
    return Q.isGrade(level) && topic && topic !== 'mixed' ? `${base} · ${Q.topicLabel(topic)}` : base;
  }

  function renderProfiles() {
    const list = $('profileList');
    list.innerHTML = '';
    $('storageNote').classList.toggle('hidden', Store.isAvailable());
    const profiles = Store.getProfiles();
    if (!profiles.length) {
      list.append(element('p', 'empty-note', 'No profiles yet. Add one below to save scores and collect stickers.'));
    }
    profiles.forEach(profile => list.append(profileCard(profile)));
    $('addProfileButton').disabled = profiles.length >= Store.MAX_PROFILES;
  }

  function profileCard(profile) {
    const card = element('article', 'profile-card');
    const head = element('div', 'profile-head');
    head.append(element('span', 'profile-avatar', profile.avatar));
    const title = element('div', 'profile-title');
    title.append(element('strong', '', profile.name));
    const t = profile.totals;
    const accuracy = t.taps ? `${Math.round((t.correctTaps / t.taps) * 100)}%` : '–';
    title.append(element('span', 'profile-meta',
      `Games ${t.games} · Correct ${t.correct} (${accuracy}) · Best streak ${t.bestStreak} · Stickers ${profile.stickers.length}/${Store.STICKERS.length}`));
    head.append(title);

    const actions = element('div', 'profile-actions');
    const details = element('button', 'secondary-button small', expandedId === profile.id ? 'Hide' : 'Details');
    details.type = 'button';
    details.setAttribute('aria-expanded', String(expandedId === profile.id));
    details.addEventListener('click', () => { expandedId = expandedId === profile.id ? null : profile.id; renderProfiles(); });
    const del = element('button', 'secondary-button small danger', pendingDeleteId === profile.id ? 'Tap again to delete' : 'Delete');
    del.type = 'button';
    del.addEventListener('click', () => {
      if (pendingDeleteId !== profile.id) { pendingDeleteId = profile.id; renderProfiles(); return; }
      Store.deleteProfile(profile.id);
      pendingDeleteId = null;
      if (expandedId === profile.id) expandedId = null;
      api.refreshProfileSelects();
      renderProfiles();
    });
    actions.append(details, del);
    head.append(actions);
    card.append(head);

    if (expandedId === profile.id) card.append(profileDetails(profile));
    return card;
  }

  function profileDetails(profile) {
    const box = element('div', 'profile-details');

    box.append(element('p', 'detail-title', `Sticker book (${profile.stickers.length}/${Store.STICKERS.length})`));
    const book = element('div', 'sticker-book');
    Store.STICKERS.forEach(sticker => {
      const owned = profile.stickers.includes(sticker);
      const item = element('span', `sticker${owned ? '' : ' locked'}`, sticker);
      item.setAttribute('aria-label', owned ? 'Collected sticker' : 'Sticker not collected yet');
      book.append(item);
    });
    box.append(book);

    const bests = Object.entries(profile.bests).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (bests.length) {
      box.append(element('p', 'detail-title', 'Best timed scores'));
      const ul = element('ul', 'detail-list');
      bests.forEach(([key, score]) => {
        const [level, topic, seconds] = key.split('|');
        ul.append(element('li', '', `${levelText(level, topic)} · ${seconds}s — ${score}`));
      });
      box.append(ul);
    }

    box.append(element('p', 'detail-title', 'Recent games'));
    if (!profile.history.length) {
      box.append(element('p', 'empty-note', 'No games saved yet.'));
    } else {
      const ul = element('ul', 'detail-list');
      profile.history.slice(0, 5).forEach(h => {
        const when = h.t ? new Date(h.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
        const acc = h.taps ? `${Math.round((h.correctTaps / h.taps) * 100)}%` : '–';
        const mode = `${h.mode === 'versus' ? '1 vs 1' : 'Solo'}${h.seconds ? ` · ${h.seconds}s` : ''}`;
        ul.append(element('li', '', `${when} · ${levelText(h.level, h.topic)} · ${mode} — ${h.score} correct (${acc})`));
      });
      box.append(ul);
    }
    return box;
  }

  function buildAvatarPicker() {
    const picker = $('avatarPicker');
    picker.innerHTML = '';
    Store.AVATARS.forEach(avatar => {
      const button = element('button', `avatar-button${avatar === chosenAvatar ? ' selected' : ''}`, avatar);
      button.type = 'button';
      button.setAttribute('aria-label', `Choose ${avatar}`);
      button.setAttribute('aria-pressed', String(avatar === chosenAvatar));
      button.addEventListener('click', () => { chosenAvatar = avatar; buildAvatarPicker(); });
      picker.append(button);
    });
  }

  function addProfileFromForm() {
    const input = $('profileName');
    const result = Store.addProfile(input.value, chosenAvatar);
    const message = $('profileMessage');
    if (result.error) {
      message.textContent = result.error;
      message.classList.add('error');
      return;
    }
    message.textContent = '';
    message.classList.remove('error');
    input.value = '';
    expandedId = null;
    api.refreshProfileSelects();
    // Pick the new profile for Player 1 if that player is still a guest.
    const select = $('profile1');
    if (!select.value) {
      select.value = result.profile.id;
      syncDuplicates();
      if (api.onProfileChosen) api.onProfileChosen(1, result.profile);
    }
    renderProfiles();
  }

  function init() {
    applySettings();
    wireModal('settingsModal', 'settingsButton', 'settingsClose');
    wireModal('profilesModal', 'profilesButton', 'profilesClose');

    document.querySelectorAll('.seg-button').forEach(button => {
      button.addEventListener('click', () => {
        Store.setSetting(button.dataset.setting, button.dataset.value);
        applySettings();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const open = document.querySelector('.modal-backdrop:not(.hidden)');
      if (open) closeModal(open.id);
    });

    [1, 2].forEach(n => {
      $('profile' + n).addEventListener('change', () => {
        syncDuplicates();
        if (api.onProfileChosen) api.onProfileChosen(n, api.selectedProfile(n));
      });
    });

    buildAvatarPicker();
    $('addProfileButton').addEventListener('click', addProfileFromForm);
    $('profileName').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addProfileFromForm(); } });
    api.refreshProfileSelects();
  }

  root.MQMenus = api;
  api.init = init;
})(window);
