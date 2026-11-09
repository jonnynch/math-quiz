// Settings window, Profiles window and the "Who's playing?" selectors.
(function (root) {
  'use strict';

  const Store = root.MQStore;
  const Q = root.MQQuestions;
  const Trophies = root.MQTrophies;
  const Parent = root.MQParent;
  const Report = root.MQReport;
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
    // The 🔊 Listen buttons are drawn on every board but only shown while read-aloud is on (see style.css).
    document.documentElement.dataset.readAloud = settings.readAloud;
    const speech = !!(root.MQAudio && root.MQAudio.speechSupported());
    document.querySelectorAll('[data-setting=readAloud]').forEach(button => { button.disabled = !speech; });
    $('readAloudHelp').classList.toggle('hidden', !speech);
    $('readAloudUnavailable').classList.toggle('hidden', speech);
    document.querySelectorAll('.seg-button').forEach(button => {
      const on = settings[button.dataset.setting] === button.dataset.value;
      button.classList.toggle('selected', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  // Shown when the browser refuses to write to its storage (full, blocked, private mode).
  function settingsMessage(saved) {
    const node = $('settingsMessage');
    node.textContent = saved ? '' : 'This browser would not save your settings, so they will be lost when the page is closed.';
    node.classList.toggle('hidden', saved);
  }

  function profileListMessage(text) {
    const node = $('profileListMessage');
    node.textContent = text;
    node.classList.toggle('hidden', !text);
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
    if (id === 'bankModal') closeBank();
    if (id === 'reportModal') closeReport();
    $(id).classList.add('hidden');
    if (!document.querySelector('.modal-backdrop:not(.hidden)')) document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function wireModal(id, openButtonId, closeButtonId) {
    $(openButtonId).addEventListener('click', () => {
      if (id === 'profilesModal') { hideBackupParent(); pendingDeleteId = null; profileListMessage(''); renderProfiles(); }
      if (id === 'settingsModal') settingsMessage(true);
      if (id === 'achievementsModal') openAchievements();
      if (id === 'bankModal') openBank();
      if (id === 'reportModal') openReport();
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
      const result = Store.deleteProfile(profile.id);
      pendingDeleteId = null;
      if (expandedId === profile.id) expandedId = null;
      api.refreshProfileSelects();
      renderProfiles();
      profileListMessage(result.saved ? '' : 'The profile was deleted, but this browser would not save the change, so it may come back when the page is reloaded.');
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

  // ---------- achievements window ----------
  function renderAchievements() {
    const list = $('achievementsList');
    list.innerHTML = '';
    const profiles = Store.getProfiles();
    $('achievementsProfileRow').classList.toggle('hidden', !profiles.length);
    if (!profiles.length) {
      $('achievementsSummary').textContent = '';
      list.append(element('p', 'empty-note', 'Create a profile to start earning trophies. Guests do not collect them.'));
      return;
    }
    const profile = Store.getProfile($('achievementsProfile').value) || profiles[0];
    const total = Trophies.LEVELS.length * Trophies.TIERS.length;
    $('achievementsSummary').textContent = `🏆 ${Trophies.unlockedCount(profile)} / ${total} trophies collected`;
    Trophies.LEVELS.forEach(level => {
      const trophies = Trophies.progressFor(profile, level);
      const section = element('section', 'trophy-level');
      const head = element('div', 'trophy-level-head');
      head.append(element('h3', '', Q.difficultyLabel(level)),
        element('span', 'trophy-level-count', `${trophies.filter(t => t.unlocked).length} / ${trophies.length}`));
      const grid = element('div', 'trophy-grid');
      trophies.forEach(t => {
        const card = element('div', `trophy-card ${t.unlocked ? 'unlocked' : 'locked'}`);
        const icon = element('span', 'trophy-icon', t.tier.icon);
        icon.setAttribute('aria-hidden', 'true');
        const bar = element('div', 'trophy-bar');
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', String(t.target));
        bar.setAttribute('aria-valuenow', String(t.value));
        bar.setAttribute('aria-label', t.tier.name);
        const fill = element('span');
        fill.style.width = `${Math.round((t.value / t.target) * 100)}%`;
        bar.append(fill);
        card.append(icon, element('strong', 'trophy-name', t.tier.name), element('span', 'trophy-desc', t.description), bar,
          element('span', 'trophy-progress', `${t.value} / ${t.target}`),
          element('span', 'trophy-state', t.unlocked ? '✓ Unlocked' : '🔒 Locked'));
        grid.append(card);
      });
      section.append(head, grid);
      list.append(section);
    });
  }

  // Opens on Player 1's profile when one is chosen, otherwise the first profile.
  function openAchievements() {
    const select = $('achievementsProfile');
    const preferred = api.selectedProfile(1);
    select.innerHTML = '';
    Store.getProfiles().forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = `${p.avatar} ${p.name}`;
      select.append(option);
    });
    if (preferred) select.value = preferred.id;
    renderAchievements();
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
    hideBackupParent();
  }

  // Importing and Undo are parent-only (the Store refuses without verification). The question appears right here.
  let stopBackupParentTimer = () => {};
  function hideBackupParent() {
    stopBackupParentTimer();
    stopBackupParentTimer = () => {};
    const host = $('backupParent');
    host.innerHTML = '';
    host.classList.add('hidden');
  }

  // Asks the parent question, then runs `action` once and locks again (one verification per import or undo).
  function askParentForBackup(action) {
    hideBackupParent();
    const host = $('backupParent');
    host.classList.remove('hidden');
    stopBackupParentTimer = renderParentChallenge(host, {
      prefix: 'importParent',
      help: 'Parent verification is needed to import or undo a backup. Answer this quick question to continue.',
      onUnlocked: () => {
        hideBackupParent();
        try { action(); } finally { Parent.lock(); }
      }
    });
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
    backupMessage(text, 'good');
    Store.requestPersistence();
    refreshBackupButtons();
  }

  function runImport(mode) {
    if (!pendingImport) return;
    if (mode === 'replace' && !replaceArmed) {
      replaceArmed = true;
      $('importReplaceButton').textContent = 'Tap again to replace everything';
      return;
    }
    const result = Store.applyBackup(pendingImport, mode);
    if (result.denied) { askParentForBackup(() => runImport(mode)); return; }
    if (!result.imported) {
      // Nothing was changed. Keep the pasted backup and preview so the parent can try again.
      replaceArmed = false;
      $('importReplaceButton').textContent = 'Replace all profiles';
      backupMessage(result.error || 'The import failed and nothing was changed.', 'error');
      refreshBackupButtons();
      return;
    }
    finishImport(result);
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
    const undoImport = () => {
      const result = Store.restoreBackup();
      if (result.denied) { askParentForBackup(undoImport); return; }
      if (result.restored) {
        api.refreshProfileSelects();
        expandedId = null;
        renderProfiles();
        backupMessage('The last import was undone.', 'good');
      } else {
        backupMessage(result.kept ? result.error : 'Could not undo the import.', 'error');
      }
      refreshBackupButtons();
    };
    $('undoImportButton').addEventListener('click', undoImport);
  }

  // ---------- screen-time bank ----------
  let bankId = null;

  function bankNotice(text, kind) {
    const node = $('bankNotice');
    node.textContent = text || '';
    node.classList.toggle('hidden', !text);
    node.classList.toggle('error', kind === 'error');
    node.classList.toggle('good', kind === 'good');
  }

  const shortDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

  function refreshBankSelect() {
    const select = $('bankProfile');
    select.innerHTML = '';
    Store.getProfiles().forEach(p => {
      const option = element('option', '', `${p.avatar} ${p.name}`);
      option.value = p.id;
      select.append(option);
    });
    if (!Store.getProfile(bankId)) {
      const first = api.selectedProfile(1) || Store.getProfiles()[0];
      bankId = first ? first.id : null;
    }
    if (bankId) select.value = bankId;
    $('bankPickerRow').classList.toggle('hidden', !Store.getProfiles().length);
  }

  function rewardExplanation(cfg) {
    return `How it works: play Grade 1–6 questions as a saved profile. Once at least ${cfg.minBatch} questions in one grade are finished, ` +
      `the game looks at the answers that were right on the first try. With at least ${cfg.minAccuracy}% right, each one earns ${cfg.base} minutes, ` +
      'times a bonus for accuracy (90%, 95% and 100% earn more) and a bonus for higher grades, rounded down to whole minutes. ' +
      'Trying again after a wrong answer does not count. Below the minimum, no minutes are earned and the batch starts again. Age 2–6 levels do not earn minutes.';
  }

  function historyList(title, rows, emptyText) {
    const wrap = element('div', 'bank-history');
    wrap.append(element('p', 'detail-title', title));
    if (!rows.length) { wrap.append(element('p', 'empty-note', emptyText)); return wrap; }
    const ul = element('ul', 'detail-list');
    rows.forEach(text => ul.append(element('li', '', text)));
    wrap.append(ul);
    return wrap;
  }

  // ---------- parent verification (child-resistant, see parent.js) ----------
  let stopParentTimer = () => {};

  function stopCooldownTimer() {
    stopParentTimer();
    stopParentTimer = () => {};
  }

  // Parent controls (Parent settings) are only visible while unlocked.
  function syncParentControls() {
    $('bankSettings').classList.toggle('hidden', !Parent.isUnlocked());
  }

  function closeBank() {
    stopCooldownTimer();
    Parent.lock();
  }

  // Called when a parent-only action is refused because the bank is locked.
  function parentDenied() {
    Parent.lock();
    renderBank();
    syncParentControls();
    bankNotice('Parent verification is needed first.', 'error');
  }

  // Fills `host` with one typed parent question. `prefix` keeps the element ids of two boxes apart. It redraws itself
  // (new question) after a wrong answer and when a cooldown ends, and calls opts.onUnlocked() on success.
  // Returns a function that stops its cooldown timer.
  function renderParentChallenge(host, opts) {
    let timer = null;
    let notice = '';
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const draw = (focusAnswer) => {
      stop();
      host.innerHTML = '';
      host.append(element('p', 'setting-title', '🔒 Parent area'));
      host.append(element('p', 'setting-help', opts.help));
      const question = element('p', 'parent-challenge', Parent.current().text);
      question.id = `${opts.prefix}Challenge`;
      host.append(question);
      const row = element('div', 'backup-actions');
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `${opts.prefix}Answer`;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('enterkeyhint', 'done');
      input.setAttribute('aria-label', 'Your answer');
      const button = element('button', 'primary-button compact', 'Unlock');
      button.type = 'button';
      row.append(input, button);
      host.append(row);
      const message = element('p', 'setting-help error hidden');
      message.id = `${opts.prefix}Message`;
      message.setAttribute('role', 'alert');
      host.append(message);
      const show = (text) => { message.textContent = text; message.classList.toggle('hidden', !text); };

      const showCooldown = () => {
        const left = Parent.cooldownRemaining();
        input.disabled = button.disabled = left > 0;
        if (left > 0) show(`Too many wrong answers. Please wait ${left} second${left === 1 ? '' : 's'}.`);
        return left;
      };
      const submit = () => {
        const result = Parent.submit(input.value);
        if (result.ok) { stop(); opts.onUnlocked(); return; }
        if (result.reason === 'invalid') { show('Please type a number or a fraction such as 1/2.'); return; }
        if (opts.onWrong) opts.onWrong();
        notice = result.reason === 'cooldown'
          ? ''
          : `Not correct. Here is a new question. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`;
        draw(true);
      };
      button.addEventListener('click', submit);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });

      if (showCooldown() > 0) {
        timer = setInterval(() => {
          if (showCooldown() > 0) return;
          stop();
          notice = '';
          draw(false);
        }, 250);
      } else if (notice) {
        show(notice);
      }
      notice = '';
      if (focusAnswer && !input.disabled) input.focus();
    };
    draw(false);
    return stop;
  }

  function parentLockBox() {
    stopCooldownTimer();
    const box = element('div', 'bank-parent bank-lock');
    stopParentTimer = renderParentChallenge(box, {
      prefix: 'parent',
      help: 'Redeeming minutes and changing reward settings are for parents. Answer this quick question to unlock. Everything above and below can still be viewed.',
      onWrong: () => bankNotice('', ''),
      onUnlocked: () => {
        renderBank();
        renderBankSettings();
        syncParentControls();
        bankNotice('Parent controls unlocked.', 'good');
      }
    });
    return box;
  }

  // Parent-only area: minutes are redeemed by hand (two taps, like deleting a profile).
  function parentRedeemBox(profile, balance) {
    const box = element('div', 'bank-parent');
    box.append(element('p', 'setting-title', '👪 Parent: redeem minutes'));
    box.append(element('p', 'setting-help', 'Minutes are only tracked here. This game cannot limit screen time on a device, so redeem minutes when your child uses them.'));
    const row = element('div', 'backup-actions');
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'redeemMinutes';
    input.min = '1';
    input.max = String(balance);
    input.step = '1';
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('aria-label', 'Minutes to redeem');
    const button = element('button', 'secondary-button small danger', 'Redeem');
    button.type = 'button';
    let armed = 0;
    input.addEventListener('input', () => { armed = 0; button.textContent = 'Redeem'; });
    button.addEventListener('click', () => {
      const minutes = input.value.trim() === '' ? NaN : Number(input.value);
      const problem = Store.checkRedeem(profile, minutes);
      if (problem) { armed = 0; button.textContent = 'Redeem'; bankNotice(problem, 'error'); return; }
      if (armed !== minutes) { armed = minutes; button.textContent = `Tap again to redeem ${minutes} min`; bankNotice('', ''); return; }
      const result = Store.redeem(profile, minutes);
      if (result.denied) { parentDenied(); return; }
      renderBank();
      if (result.saved === false) bankNotice('Redeemed, but this browser would not save the change, so it may come back when the page is reloaded.', 'error');
      else bankNotice(`${minutes} minute${minutes === 1 ? '' : 's'} redeemed.`, 'good');
    });
    row.append(input, button);
    box.append(row);
    return box;
  }

  function renderBank() {
    const body = $('bankBody');
    body.innerHTML = '';
    const profile = Store.getProfile(bankId);
    if (!profile) {
      body.append(element('p', 'empty-note', 'Add a profile first (👤 Profiles). Only saved profiles earn screen time, and only in Grade 1–6.'));
      return;
    }
    const r = profile.rewards;
    const cfg = Store.getRewardConfig();
    const balance = Store.rewardBalance(profile);

    const stats = element('div', 'bank-stats report-stats');
    [['Available now', `${balance} min`, 'available'], ['Earned in total', `+${r.earned} min`, 'earned'], ['Redeemed', `−${r.redeemed} min`, 'redeemed']].forEach(([label, value, kind]) => {
      const cell = element('div', `bank-stat ${kind}`);
      cell.append(element('span', 'bank-stat-label', label), element('strong', 'bank-stat-value', value));
      stats.append(cell);
    });
    body.append(stats);

    body.append(element('p', 'setting-title', 'Progress to the next reward'));
    const progress = Store.rewardProgress(profile);
    if (!progress.length) body.append(element('p', 'setting-help', `Finish ${cfg.minBatch} questions in Grade 1–6 to complete a reward batch.`));
    progress.forEach(p => {
      const row = element('div', 'bank-progress');
      const done = Math.min(p.completed, cfg.minBatch);
      row.append(element('span', '', `Grade ${p.grade}: ${done} of ${cfg.minBatch} questions · ${p.correct} right first time`));
      const bar = document.createElement('progress');
      bar.max = cfg.minBatch;
      bar.value = done;
      bar.setAttribute('aria-label', `Grade ${p.grade} progress`);
      row.append(bar);
      body.append(row);
    });

    body.append(Parent.isUnlocked() ? parentRedeemBox(profile, balance) : parentLockBox());
    body.append(historyList('Recent rewards', r.earnTx.slice(0, 5).map(t =>
      `${shortDate(t.t)} · Grade ${t.grade} · ${t.correct}/${t.completed} right (${Store.rewardPercent(t.correct, t.completed)}%) — +${t.minutes} min`), 'No rewards yet.'));
    body.append(historyList('Recent redemptions', r.redeemTx.slice(0, 5).map(t =>
      `${shortDate(t.t)} — ${t.minutes} min used`), 'Nothing redeemed yet.'));
    body.append(element('p', 'setting-help', rewardExplanation(cfg)));
  }

  function bankSettingsMessage(text, kind) {
    const node = $('bankSettingsMessage');
    node.textContent = text || '';
    node.classList.toggle('hidden', !text);
    node.classList.toggle('error', kind === 'error');
    node.classList.toggle('good', kind === 'good');
  }

  // Parent settings: every reward number can be changed here (defaults live in store.js).
  function renderBankSettings() {
    const cfg = Store.getRewardConfig();
    const box = $('bankSettingsBody');
    box.innerHTML = '';
    const grid = element('div', 'bank-grid');
    const inputs = [];
    const add = (label, value, min, max, step) => {
      const wrap = element('label', 'bank-field', label);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.setAttribute('inputmode', 'decimal');
      wrap.append(input);
      grid.append(wrap);
      inputs.push(input);
    };
    add('Minutes per correct answer', cfg.base, 0, 60, 0.01);
    add('Minimum correct (%)', cfg.minAccuracy, 0, 100, 1);
    add('Questions per batch', cfg.minBatch, 1, 500, 1);
    Store.REWARD_TIER_MINS.forEach((min, i) => add(`Bonus at ${min}%+ right`, cfg.accuracy[i], 0, 10, 0.1));
    cfg.grades.forEach((g, i) => add(`Grade ${i + 1} bonus`, g, 0, 10, 0.1));
    box.append(grid);
    const actions = element('div', 'backup-actions');
    const save = element('button', 'primary-button compact', 'Save settings');
    save.type = 'button';
    const reset = element('button', 'secondary-button small', 'Reset to defaults');
    reset.type = 'button';
    save.addEventListener('click', () => {
      const v = inputs.map(input => (input.value.trim() === '' ? NaN : Number(input.value)));
      if (v.some(n => !Number.isFinite(n))) { bankSettingsMessage('Please fill in every box with a number.', 'error'); return; }
      const result = Store.setRewardConfig({ base: v[0], minAccuracy: v[1], minBatch: v[2], accuracy: v.slice(3, 7), grades: v.slice(7, 13) });
      if (result.denied) { parentDenied(); return; }
      renderBankSettings();
      renderBank();
      if (result.saved === false) bankSettingsMessage('Applied, but this browser would not save the settings, so they will be lost when the page closes.', 'error');
      else bankSettingsMessage('Settings saved. Values outside the allowed range were put back to their defaults.', 'good');
    });
    reset.addEventListener('click', () => {
      const result = Store.resetRewardConfig();
      if (result.denied) { parentDenied(); return; }
      renderBankSettings();
      renderBank();
      if (result.saved === false) bankSettingsMessage('Could not reset: this browser would not save the change, so your settings were kept as they were.', 'error');
      else bankSettingsMessage('Reward settings are back to the defaults.', 'good');
    });
    actions.append(save, reset);
    box.append(actions);
  }

  function openBank() {
    closeBank(); // always start locked, with a fresh question
    bankNotice('', '');
    bankSettingsMessage('', '');
    refreshBankSelect();
    renderBank();
    renderBankSettings();
    syncParentControls();
  }

  function initBank() {
    $('bankProfile').addEventListener('change', () => {
      bankId = $('bankProfile').value || null;
      bankNotice('', '');
      renderBank();
    });
  }

  // ---------- parent progress report (see report.js) ----------
  // Opens locked every time. The report and the CSV export need a parent verification; closing locks again.
  let reportId = null;
  let stopReportTimer = () => {};

  function closeReport() {
    stopReportTimer();
    stopReportTimer = () => {};
    Parent.lock();
  }

  function reportMessage(text, kind) {
    const node = $('reportMessage');
    node.textContent = text || '';
    node.classList.toggle('hidden', !text);
    node.classList.toggle('error', kind === 'error');
    node.classList.toggle('good', kind === 'good');
  }

  const accuracyText = (a) => (a === null ? 'no answers yet' : `${a}%`);
  const durationText = (seconds) => {
    if (seconds === null) return 'Not recorded';
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  };
  const statBox = (label, value) => {
    const box = element('div', 'bank-stat');
    box.append(element('span', 'bank-stat-label', label), element('span', 'bank-stat-value', value));
    return box;
  };

  // A titled list; rows are { text, accuracy } and show a bar when there is an accuracy.
  function reportList(title, rows, emptyText) {
    const wrap = element('div', 'report-section');
    wrap.append(element('p', 'detail-title', title));
    if (!rows.length) { wrap.append(element('p', 'empty-note', emptyText)); return wrap; }
    const ul = element('ul', 'report-list');
    rows.forEach(row => {
      const li = element('li', '', row.text);
      if (row.accuracy !== null && row.accuracy !== undefined) {
        const bar = document.createElement('progress');
        bar.max = 100;
        bar.value = row.accuracy;
        bar.setAttribute('aria-label', `${row.accuracy}% correct`);
        li.append(bar);
      }
      ul.append(li);
    });
    wrap.append(ul);
    return wrap;
  }

  const countText = (r) => `${r.games} ${r.games === 1 ? 'game' : 'games'} · ${r.correct} of ${r.answers} correct (${accuracyText(r.accuracy)})`;
  const reportDate = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not saved');

  function renderReportBody(report) {
    const body = $('reportBody');
    body.innerHTML = '';
    report.notes.forEach(note => body.append(element('p', 'setting-help', note)));
    const stats = element('div', 'bank-stats report-stats');
    stats.append(
      statBox('Games played', String(report.totals.games)),
      statBox('Correct answers', report.totals.answers ? `${report.totals.correct} of ${report.totals.answers}` : report.state === 'none' ? '0' : 'Not available'),
      statBox('Accuracy', report.totals.accuracy === null ? '–' : `${report.totals.accuracy}%`),
      statBox('Play time', report.state === 'none' ? '0 min' : durationText(report.time.seconds))
    );
    body.append(stats);
    body.append(element('p', 'setting-help', 'Answers count every tap, including second tries in Solo games. Accuracy = correct ÷ answers given.'));
    if (report.state !== 'detailed') return;
    if (report.trend) {
      const t = report.trend;
      const word = t.direction === 'up' ? 'Improving' : t.direction === 'down' ? 'Lower recently' : 'Steady';
      body.append(element('p', 'setting-title', `${word}: ${t.recent}% in the latest ${t.recentGames} games, ${t.earlier}% before that`));
    }
    body.append(reportList('By level', report.byLevel.map(r => ({ text: `${r.label}: ${countText(r)}`, accuracy: r.accuracy })), 'No games yet.'));
    body.append(reportList('By topic (Grade 1–6)', report.byTopic.map(r => ({ text: `${r.label}: ${countText(r)}`, accuracy: r.accuracy })), 'No Grade 1–6 games saved yet.'));
    body.append(reportList('Progress over time (by day, oldest first)', report.byDay.map(r => ({ text: `${reportDate(new Date(`${r.day}T12:00:00`).getTime())}: ${countText(r)}`, accuracy: r.accuracy })), 'No saved dates for these games.'));
    body.append(reportList('Recent games', report.recent.map(g => ({
      text: `${reportDate(g.t)} · ${g.levelLabel}${g.topic ? ` · ${g.topic}` : ''} · ${g.mode} — ${g.correct} of ${g.answers} correct (${accuracyText(g.accuracy)})${g.played === null ? '' : ` · ${durationText(g.played)}`}`,
      accuracy: g.accuracy
    })), 'No games yet.'));
  }

  function renderReport() {
    const lock = $('reportLock');
    const content = $('reportContent');
    stopReportTimer();
    stopReportTimer = () => {};
    if (!Parent.isUnlocked()) {
      content.classList.add('hidden');
      $('reportBody').innerHTML = '';
      lock.classList.remove('hidden');
      lock.className = 'bank-parent bank-lock';
      stopReportTimer = renderParentChallenge(lock, {
        prefix: 'report',
        help: 'Progress reports are for parents. Answer this quick question to view them.',
        onUnlocked: renderReport
      });
      return;
    }
    lock.innerHTML = '';
    lock.className = 'hidden';
    content.classList.remove('hidden');
    const profiles = Store.getProfiles();
    const select = $('reportProfile');
    select.innerHTML = '';
    profiles.forEach(p => { const o = element('option', '', `${p.avatar} ${p.name}`); o.value = p.id; select.append(o); });
    if (!Store.getProfile(reportId)) reportId = profiles.length ? profiles[0].id : null;
    select.value = reportId || '';
    $('reportProfile').parentNode.classList.toggle('hidden', !profiles.length);
    $('reportExportButton').disabled = !reportId;
    const profile = Store.getProfile(reportId);
    if (!profile) {
      $('reportBody').innerHTML = '';
      $('reportBody').append(element('p', 'empty-note', 'No saved profiles yet. Add one in Profiles. Guest games are not saved, so they have no report.'));
      return;
    }
    const report = Report.build(profile);
    if (report.denied) { renderReport(); return; }
    renderReportBody(report);
  }

  function openReport() {
    closeReport(); // always start locked, with a fresh question
    reportMessage('', '');
    renderReport();
  }

  function exportReportCsv() {
    const profile = Store.getProfile(reportId);
    if (!profile) return;
    const csv = Report.toCsv(profile);
    if (csv.denied) { Parent.lock(); renderReport(); return; }
    // The byte-order mark makes Excel read accents and emoji correctly.
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = Report.filename(profile);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    reportMessage('CSV file created. It stays on this device; nothing was sent anywhere.', 'good');
  }

  function initReport() {
    $('reportProfile').addEventListener('change', () => {
      reportId = $('reportProfile').value || null;
      reportMessage('', '');
      renderReport();
    });
    $('reportExportButton').addEventListener('click', exportReportCsv);
  }

  function init() {
    applySettings();
    initBackup();
    initBank();
    wireModal('settingsModal', 'settingsButton', 'settingsClose');
    wireModal('profilesModal', 'profilesButton', 'profilesClose');
    wireModal('achievementsModal', 'achievementsButton', 'achievementsClose');
    wireModal('bankModal', 'bankButton', 'bankClose');
    wireModal('reportModal', 'reportButton', 'reportClose');
    initReport();
    $('achievementsProfile').addEventListener('change', renderAchievements);

    document.querySelectorAll('.seg-button').forEach(button => {
      button.addEventListener('click', () => {
        const result = Store.setSetting(button.dataset.setting, button.dataset.value);
        applySettings();
        settingsMessage(result.saved !== false);
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
