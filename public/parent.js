// Parent verification for the Screen-time Bank. No DOM code here. window.MQParent (also module.exports for Node tests).
// A child-resistant barrier, NOT strong security: everything runs in the browser, so anyone who can edit the
// code or the browser's storage can get round it. The unlocked state and the answer live in memory only.
// Only the failure counter and cooldown end time go to sessionStorage, so a page refresh cannot skip the wait.
(function (root) {
  'use strict';

  const MAX_FAILS = 3;
  const COOLDOWN_SECONDS = 30;
  const LOCK_KEY = 'mathQuizBattle.parentLock';

  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

  // A fresh adult-level arithmetic question with several operations. Answers are always whole and positive.
  function generateChallenge(rng) {
    rng = rng || Math.random;
    const kind = randInt(rng, 0, 4);
    let text, answer;
    if (kind === 0) {
      const a = randInt(rng, 120, 999), b = randInt(rng, 12, 89), c = randInt(rng, 100, 999);
      text = `${a} × ${b} + ${c}`; answer = a * b + c;
    } else if (kind === 1) {
      const a = randInt(rng, 120, 999), b = randInt(rng, 12, 89);
      const c = randInt(rng, 100, Math.min(1999, a * b - 1));
      text = `${a} × ${b} − ${c}`; answer = a * b - c;
    } else if (kind === 2) {
      const a = randInt(rng, 21, 99), b = randInt(rng, 21, 99), c = randInt(rng, 12, 39);
      text = `(${a} + ${b}) × ${c}`; answer = (a + b) * c;
    } else if (kind === 3) {
      const a = randInt(rng, 12, 99), b = randInt(rng, 12, 49), c = randInt(rng, 11, 99), d = randInt(rng, 3, 9);
      text = `${a} × ${b} + ${c} × ${d}`; answer = a * b + c * d;
    } else {
      const a = randInt(rng, 41, 99), b = randInt(rng, 12, 49), c = randInt(rng, 11, 40), d = randInt(rng, 3, 9);
      text = `${a} × ${b} − ${c} × ${d}`; answer = a * b - c * d;
    }
    return { text, answer };
  }

  function defaultStorage() {
    try { return root.sessionStorage || null; } catch (error) { return null; }
  }

  // One verification session. Tests make their own with a fake clock, random source and storage.
  function create(options) {
    const opts = options || {};
    const rng = opts.rng || Math.random;
    const now = opts.now || Date.now;
    const storage = opts.storage !== undefined ? opts.storage : defaultStorage();
    let unlocked = false;
    let challenge = null;
    let fails = 0;
    let until = 0; // time (ms) when the cooldown ends

    try {
      const saved = storage && JSON.parse(storage.getItem(LOCK_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        fails = Number.isInteger(saved.fails) ? Math.min(Math.max(saved.fails, 0), MAX_FAILS) : 0;
        until = Number.isFinite(saved.until) ? Math.min(saved.until, now() + COOLDOWN_SECONDS * 1000) : 0;
      }
    } catch (error) { /* no usable storage: the counter then lasts for this page load only */ }

    function persist() {
      try { if (storage) storage.setItem(LOCK_KEY, JSON.stringify({ fails, until })); } catch (error) { /* ignore */ }
    }

    // When a cooldown has run out the player gets a fresh set of tries.
    function settleCooldown() {
      if (until && now() >= until) { until = 0; fails = 0; persist(); }
    }

    function cooldownRemaining() {
      settleCooldown();
      return until > now() ? Math.ceil((until - now()) / 1000) : 0;
    }

    function nextChallenge() {
      const previous = challenge && challenge.text;
      let next = generateChallenge(rng);
      for (let i = 0; i < 10 && next.text === previous; i++) next = generateChallenge(rng);
      challenge = next;
    }

    return {
      MAX_FAILS, COOLDOWN_SECONDS,
      isUnlocked: () => unlocked,
      cooldownRemaining,
      attemptsLeft() { settleCooldown(); return Math.max(0, MAX_FAILS - fails); },
      // The question to show. The answer is never exposed here.
      current() {
        if (!challenge) nextChallenge();
        return { text: challenge.text };
      },
      // Returns { ok: true } or { ok: false, reason: 'invalid' | 'wrong' | 'cooldown', remaining, attemptsLeft }.
      submit(input) {
        if (unlocked) return { ok: true };
        const remaining = cooldownRemaining();
        if (remaining > 0) return { ok: false, reason: 'cooldown', remaining, attemptsLeft: 0 };
        const text = String(input === undefined || input === null ? '' : input).replace(/[\s,]/g, '');
        if (!/^\d{1,12}$/.test(text)) return { ok: false, reason: 'invalid', remaining: 0, attemptsLeft: Math.max(0, MAX_FAILS - fails) };
        if (!challenge) nextChallenge();
        if (Number(text) === challenge.answer) {
          unlocked = true; fails = 0; until = 0; challenge = null;
          persist();
          return { ok: true };
        }
        fails += 1;
        if (fails >= MAX_FAILS) until = now() + COOLDOWN_SECONDS * 1000;
        nextChallenge();
        persist();
        const wait = cooldownRemaining();
        return { ok: false, reason: wait > 0 ? 'cooldown' : 'wrong', remaining: wait, attemptsLeft: Math.max(0, MAX_FAILS - fails) };
      },
      // Closing or reopening the bank locks again. The failure counter and cooldown are kept on purpose.
      lock() { unlocked = false; challenge = null; }
    };
  }

  const api = create();
  api.create = create;
  api.generateChallenge = generateChallenge;
  root.MQParent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
