// Parent verification for the Screen-time Bank and backup import. No DOM code here. window.MQParent (also module.exports for Node tests).
// A child-resistant barrier, NOT strong security: everything runs in the browser, so anyone who can edit the
// code or the browser's storage can get round it. The unlocked state and the answer live in memory only.
// Only the failure counter and cooldown end time go to sessionStorage, so a page refresh cannot skip the wait.
(function (root) {
  'use strict';

  const MAX_FAILS = 3;
  const COOLDOWN_SECONDS = 30;
  const LOCK_KEY = 'mathQuizBattle.parentLock';

  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

  const COLOUR_PAIRS = [['red', 'blue'], ['green', 'yellow'], ['black', 'white'], ['pink', 'orange']];
  const BAG_TOTALS = [2, 4, 5, 8, 10]; // totals with tidy fractions and decimals, so the answer comes quickly

  // One short question a young child has not met yet: a square root (quadratic) or a simple probability.
  // answer is { num, den } (a fraction), compared exactly with the typed answer.
  function generateChallenge(rng) {
    rng = rng || Math.random;
    if (randInt(rng, 0, 1) === 0) {
      const x = randInt(rng, 3, 12);
      return { kind: 'quadratic', text: `What is the positive value of x if x² = ${x * x}?`, answer: { num: x, den: 1 } };
    }
    const pair = COLOUR_PAIRS[randInt(rng, 0, COLOUR_PAIRS.length - 1)];
    const total = BAG_TOTALS[randInt(rng, 0, BAG_TOTALS.length - 1)];
    const first = randInt(rng, 1, total - 1);
    const counts = [first, total - first];
    const asked = randInt(rng, 0, 1);
    const ball = (n, colour) => `${n} ${colour} ball${n === 1 ? '' : 's'}`;
    return {
      kind: 'probability',
      text: `A bag contains ${ball(counts[0], pair[0])} and ${ball(counts[1], pair[1])}. What is the probability of picking ${pair[asked]}?`,
      answer: { num: counts[asked], den: total }
    };
  }

  // Reads a typed answer as a fraction: "3/4", "0.75", ".75", "75%" or a whole number. null when it is none of these.
  function parseAnswer(input) {
    const t = String(input === undefined || input === null ? '' : input).replace(/\s/g, '');
    let m = t.match(/^(\d{1,6})\/(\d{1,6})$/);
    if (m) return Number(m[2]) > 0 ? { num: Number(m[1]), den: Number(m[2]) } : null;
    m = t.match(/^(\d{0,6})(?:\.(\d{1,4}))?(%)?$/);
    if (!m || !/\d/.test(t)) return null;
    const frac = m[2] || '';
    return { num: Number(m[1] + frac), den: Math.pow(10, frac.length) * (m[3] ? 100 : 1) };
  }

  const sameValue = (a, b) => a.num * b.den === b.num * a.den;

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
        const typed = parseAnswer(input);
        if (!typed) return { ok: false, reason: 'invalid', remaining: 0, attemptsLeft: Math.max(0, MAX_FAILS - fails) };
        if (!challenge) nextChallenge();
        if (sameValue(typed, challenge.answer)) {
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
  api.parseAnswer = parseAnswer;
  api.sameValue = sameValue;
  root.MQParent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
