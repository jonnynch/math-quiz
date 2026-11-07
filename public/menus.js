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
    refreshBackupButtons();
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
    message.textContent = result.saved ? '' : 'The profile was created, but this browser would not save it, so it will be lost when the page closes.';
    message.classList.toggle('error', !result.saved);
    if (result.saved) Store.requestPersistence();
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

  // ---------- backup and restore ----------
  let pendingImport = null;
  let replaceArmed = false;

  function backupMessage(text, kind) {
    const node = $('backupMessage');
    node.textContent = text;
    node.classList.toggle('error', kind === 'error');
    node.classList.toggle('good', kind === 'good');
  }

  function refreshBackupButtons() {
    const none = Store.getProfiles().length === 0;
    $('exportButton').disabled = none;
    $('copyBackupButton').disabled = none;
    $('undoImportButton').classList.toggle('hidden', !Store.hasBackup());
  }

  function exportFile() {
    const blob = new Blob([Store.exportText()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `math-quiz-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    backupMessage('Backup file created. Keep it somewhere safe.', 'good');
  }

  async function copyBackup() {
    const text = Store.exportText();
    try {
      await navigator.clipboard.writeText(text);
      $('exportText').classList.add('hidden');
      backupMessage('Backup text copied. Paste it somewhere safe, e.g. a note.', 'good');
    } catch (error) {
      // Clipboard is not available on plain http:// addresses; show the text to copy by hand.
      const box = $('exportText');
      box.value = text;
      box.classList.remove('hidden');
      box.focus();
      box.select();
      backupMessage('Copy the text above and keep it somewhere safe.', 'good');
    }
  }

  function resetImportPreview() {
    pendingImport = null;
    replaceArmed = false;
    $('importPreview').classList.add('hidden');
    $('importReplaceButton').textContent = 'Replace all profiles';
  }

  function checkImport() {
    resetImportPreview();
    const parsed = Store.parseBackup($('importText').value);
    if (parsed.error) { backupMessage(parsed.error, 'error'); return; }
    pendingImport = parsed;
    const names = parsed.profiles.map(p => `${p.avatar} ${p.name}`).join(', ');
    $('importSummary').textContent = `Found ${parsed.profiles.length} profile${parsed.profiles.length === 1 ? '' : 's'}: ${names}.` +
      (parsed.skipped ? ` ${parsed.skipped} unusable entr${parsed.skipped === 1 ? 'y was' : 'ies were'} ignored.` : '') +
      ' "Add" keeps your current profiles (same-name profiles are renamed). "Replace" swaps everything for the backup.';
    $('importPreview').classList.remove('hidden');
    backupMessage('', '');
  }

  function finishImport(result) {
    resetImportPreview();
    $('importText').value = '';
    $('importPanel').classList.add('hidden');
    $('importToggleButton').setAttribute('aria-expanded', 'false');
    api.refreshProfileSelects();
    expandedId = null;
    renderProfiles();
    const parts = [];
    if (result.added) parts.push(`${result.added} added`);
    if (result.replaced) parts.push(`${result.replaced} updated`);
    if (result.renamed) parts.push(`${result.renamed} renamed to avoid a duplicate name`);
    if (result.skipped) parts.push(`${result.skipped} skipped (limit is ${Store.MAX_PROFILES} profiles)`);
    let text = `Import finished: ${parts.join(', ') || 'nothing changed'}.`;
    if (!result.saved) text += ' This browser would not save the data, so it will be lost when the page closes.';
    backupMessage(text, result.saved ? 'good' : 'error');
    if (result.saved) Store.requestPersistence();
    refreshBackupButtons();
  }

  function runImport(mode) {
    if (!pendingImport) return;
    if (mode === 'replace' && !replaceArmed) {
      replaceArmed = true;
      $('importReplaceButton').textContent = 'Tap again to replace everything';
      return;
    }
    finishImport(Store.applyBackup(pendingImport, mode));
  }

  function initBackup() {
    $('exportButton').addEventListener('click', exportFile);
    $('copyBackupButton').addEventListener('click', copyBackup);
    $('importToggleButton').addEventListener('click', () => {
      const panel = $('importPanel');
      const open = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !open);
      $('importToggleButton').setAttribute('aria-expanded', String(open));
      resetImportPreview();
      if (open) $('importText').focus();
    });
    $('chooseFileButton').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', async () => {
      const file = $('importFile').files && $('importFile').files[0];
      if (!file) return;
      if (file.size > 1000000) { backupMessage('That file is too large to be a profile backup.', 'error'); return; }
      try { $('importText').value = await file.text(); } catch (error) { backupMessage('That file could not be read.', 'error'); return; }
      $('importFile').value = '';
      checkImport();
    });
    $('importText').addEventListener('input', resetImportPreview);
    $('checkImportButton').addEventListener('click', checkImport);
    $('importMergeButton').addEventListener('click', () => runImport('merge'));
    $('importReplaceButton').addEventListener('click', () => runImport('replace'));
    $('undoImportButton').addEventListener('click', () => {
      if (Store.restoreBackup()) {
        api.refreshProfileSelects();
        expandedId = null;
        renderProfiles();
        backupMessage('The last import was undone.', 'good');
      } else {
        backupMessage('Could not undo the import.', 'error');
      }
      refreshBackupButtons();
    });
  }

  function init() {
    applySettings();
    initBackup();
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
