// Parent tool on the Screen-time page: manually add or deduct minutes of the chosen profile's bank. Needs the hard
// quadratic question (MQParent.hard) every time; the unlocked state lives in memory only and is cleared whenever the
// Screen-time window opens, closes or switches profile, so a refresh or a direct visit cannot skip it. Changes the
// existing bank through Store.adjustBalance (one balance, existing storage). A deduction may make the balance
// negative. Playzone has no parent controls.
(() => {
  'use strict';

  const root = window;
  const Store = root.MQStore;
  const Menus = root.MQMenus;
  const hard = root.MQParent.hard;
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  const box = () => $('bankAdjust');
  let stopChallenge = () => {};

  // Back to the closed, locked state (called by the Screen-time window on open, close and profile change).
  function reset() {
    stopChallenge();
    stopChallenge = () => {};
    hard.lock();
    box().innerHTML = '';
    box().classList.add('hidden');
    $('bankAdjustEntry').classList.toggle('hidden', !Menus.bankProfile());
  }

  function show() {
    hard.lock();                                   // always a fresh question
    $('bankAdjustEntry').classList.add('hidden');
    box().classList.remove('hidden');
    askQuestion();
  }

  function askQuestion() {
    const host = box();
    host.innerHTML = '';
    host.append(el('h3', '', '🔒 Parent: adjust minutes'));
    const challenge = el('div', 'bank-parent');
    host.append(challenge);
    const back = el('button', 'secondary-button small', '← Back');
    back.type = 'button';
    back.id = 'bankAdjBack';
    back.addEventListener('click', reset);
    host.append(back);
    stopChallenge();
    stopChallenge = Menus.renderParentChallenge(challenge, {
      prefix: 'bankAdj',
      parent: hard,
      help: 'Parents only. Solve this quadratic equation to adjust the minutes by hand.',
      invalidText: 'Type both answers separated by a comma, such as 2, -1/2.',
      onUnlocked: controls
    });
  }

  function controls() {
    stopChallenge();
    stopChallenge = () => {};
    const host = box();
    host.innerHTML = '';
    host.append(el('h3', '', '👪 Adjust Screen-time Bank'));
    const profile = () => Menus.bankProfile();
    if (!profile()) { host.append(el('p', 'setting-help', 'Make a profile first (👤 Profiles).')); }
    const balance = el('p', 'pz-balance-line');
    balance.id = 'bankAdjBalance';
    const refresh = () => {
      const p = profile();
      balance.textContent = p ? `${p.name}: current balance ${Store.rewardBalance(p)} min` : '';
    };

    const amount = document.createElement('input');
    amount.type = 'number';
    amount.id = 'bankAdjAmount';
    amount.min = '1';
    amount.max = '600';
    amount.step = '1';
    amount.value = '5';
    amount.setAttribute('inputmode', 'numeric');
    amount.setAttribute('aria-label', 'Minutes');
    amount.addEventListener('input', clearPending);
    const quick = el('div', 'pz-tools');
    [5, 10, 15, 30].forEach(n => {
      const b = el('button', 'secondary-button small', `${n}`);
      b.type = 'button';
      b.addEventListener('click', () => { amount.value = String(n); clearPending(); });
      quick.append(b);
    });
    const row = el('div', 'pz-actions');
    const add = el('button', 'primary-button compact', '➕ Add');
    add.type = 'button';
    add.id = 'bankAdjAdd';
    const deduct = el('button', 'secondary-button', '➖ Deduct');
    deduct.type = 'button';
    deduct.id = 'bankAdjDeduct';
    row.append(add, deduct);
    const confirmRow = el('div', 'pz-actions hidden');
    const message = el('p', 'setting-help');
    message.id = 'bankAdjMessage';
    message.setAttribute('role', 'status');

    // Two taps: choose Add/Deduct, then Confirm. The confirm button works once, so a double tap cannot apply twice.
    let pendingDelta = 0;
    function clearPending() { pendingDelta = 0; confirmRow.classList.add('hidden'); confirmRow.innerHTML = ''; message.textContent = ''; message.className = 'setting-help'; }
    function ask(sign) {
      const n = Number(amount.value);
      const p = profile();
      clearPending();
      if (!p) return;
      if (!Number.isInteger(n) || n < 1 || n > 600) { message.textContent = 'Type a whole number of minutes from 1 to 600.'; message.classList.add('error'); return; }
      pendingDelta = sign * n;
      const confirm = el('button', 'primary-button compact', `Confirm ${sign > 0 ? '+' : '−'}${n} min`);
      confirm.type = 'button';
      confirm.id = 'bankAdjConfirm';
      const cancel = el('button', 'secondary-button', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', clearPending);
      confirm.addEventListener('click', () => {
        const delta = pendingDelta;
        pendingDelta = 0;                          // single use
        confirm.disabled = true;
        if (!delta) return;
        const result = Store.adjustBalance(p, delta);
        clearPending();
        if (result.denied) { askQuestion(); return; }
        if (result.error) { message.textContent = result.error; message.classList.add('error'); return; }
        refresh();
        Menus.refreshBank();
        message.textContent = `Before: ${result.before} min → After: ${result.after} min.${result.saved === false ? ' (This browser could not save the change.)' : ''}`;
        message.classList.add('good');
      });
      confirmRow.append(el('span', 'pz-balance-line', `${sign > 0 ? 'Add' : 'Deduct'} ${n} min ${sign > 0 ? 'to' : 'from'} ${p.name}?`), confirm, cancel);
      confirmRow.classList.remove('hidden');
    }
    add.addEventListener('click', () => ask(1));
    deduct.addEventListener('click', () => ask(-1));

    const done = el('button', 'secondary-button small', '🔒 Lock and go back');
    done.type = 'button';
    done.id = 'bankAdjDone';
    done.addEventListener('click', reset);
    host.append(balance, el('p', 'pz-group-title', 'Minutes'), amount, quick, row, confirmRow, message, done);
    refresh();
  }

  $('bankAdjustButton').addEventListener('click', show);
  Menus.adjustReset = reset;
  reset();
})();
