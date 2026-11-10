// Smart Difficulty: recent-performance rules that nudge a player one level up or down. Pure logic (no DOM)
// so it can be tested in Node. It never touches scores, stars, streaks, stickers, trophies or rewards.
//
// How it works: the player picks a level (and topic) as usual; that is the "base". With Smart Difficulty on,
// questions come from the base level or one step above/below it (CONFIG.maxOffset), always inside the same
// family (Age levels stay with Age levels, Grades with Grades) and only at levels that offer the chosen topic.
// The state kept per player and per base setup is { offset, recent, cd }:
//   offset  -1 | 0 | +1 steps from the base level
//   recent  last CONFIG.window first-attempt results [{ c: 1|0, s: seconds }]
//   cd      questions still to answer before another change is allowed (cooldown)
(function (root) {
  'use strict';

  const Q = root.MQQuestions || (typeof require === 'function' ? require('./questions.js') : null);

  // Internal tuning. Deliberately not exposed as parent settings.
  const CONFIG = {
    window: 20,          // how many recent first-attempt answers are remembered
    minUp: 10,           // answers needed before a level increase can be considered
    upAccuracy: 0.9,     // accuracy needed to move up
    minDown: 8,          // answers needed before a level decrease can be considered
    downAccuracy: 0.6,   // accuracy below this moves down
    cooldown: 10,        // questions that must pass after a change before the next one
    maxOffset: 1,        // never more than this many steps from the level the player chose
    slowSeconds: 15,     // average time above this stops a move up (speed never causes a change on its own)
    minTimed: 5,         // timed answers needed before speed is considered at all
    maxSeconds: 60,      // stored times are capped
    maxKeys: 30          // base setups remembered per profile
  };

  const AGE_LADDER = ['toddler', 'age4', 'age5', 'age6'];
  const GRADE_LADDER = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'];
  const ALL_LEVELS = [...AGE_LADDER, ...GRADE_LADDER];

  const ladderOf = (level) => (AGE_LADDER.includes(level) ? AGE_LADDER : GRADE_LADDER.includes(level) ? GRADE_LADDER : []);
  const topicOf = (level, topic) => (Q ? Q.normaliseTopic(level, topic) : 'mixed');
  // Age levels have one fixed activity (no topics); a grade level must list the topic.
  const supports = (level, topic) => AGE_LADDER.includes(level) || (!!Q && Q.topicsFor(level).some(t => t.value === topic));
  const keyOf = (base, topic) => `${base}|${topicOf(base, topic)}`;

  function emptyState() {
    return { offset: 0, recent: [], cd: 0, u: 0 };
  }

  const whole = (v, max) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);

  // Accepts anything (old profiles, damaged or imported data) and returns a valid state.
  function cleanState(raw) {
    const out = emptyState();
    if (!raw || typeof raw !== 'object') return out;
    out.offset = Number.isInteger(raw.offset) ? Math.max(-CONFIG.maxOffset, Math.min(CONFIG.maxOffset, raw.offset)) : 0;
    out.recent = (Array.isArray(raw.recent) ? raw.recent : []).slice(-CONFIG.window)
      .filter(r => r && (r.c === 0 || r.c === 1))
      .map(r => ({ c: r.c, s: Number.isFinite(r.s) ? Math.round(Math.min(CONFIG.maxSeconds, Math.max(0, r.s)) * 10) / 10 : 0 }));
    out.cd = whole(raw.cd, CONFIG.cooldown);
    out.u = whole(raw.u, 8640000000000000);
    return out;
  }

  // Saved map: { "<base>|<topic>": state }. Unknown levels/topics are dropped; only the newest maxKeys survive.
  function cleanMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const entries = [];
    Object.entries(raw).forEach(([key, value]) => {
      const [base, topic, extra] = String(key).split('|');
      if (extra !== undefined || !ALL_LEVELS.includes(base) || !topic) return;
      if (!(AGE_LADDER.includes(base) ? topic === 'mixed' : supports(base, topic))) return;
      entries.push([key, cleanState(value)]);
    });
    entries.sort((a, b) => b[1].u - a[1].u).slice(0, CONFIG.maxKeys).forEach(([key, state]) => { out[key] = state; });
    return out;
  }

  // The state for one base setup inside a profile's map (created on first use). Mutating it changes the profile.
  function stateFor(map, base, topic) {
    const key = keyOf(base, topic);
    if (!map[key]) map[key] = emptyState();
    return map[key];
  }

  // Levels a player on this base setup may be given: base +/- maxOffset, same family, topic available.
  function candidates(base, topic) {
    const ladder = ladderOf(base);
    const t = topicOf(base, topic);
    const i = ladder.indexOf(base);
    if (i < 0) return [base];
    return ladder.filter((level, j) => Math.abs(j - i) <= CONFIG.maxOffset && (level === base || supports(level, t)));
  }

  // Level reached by moving `offset` steps from base, or null when that step is not allowed.
  function levelAt(base, topic, offset) {
    if (!Number.isInteger(offset) || Math.abs(offset) > CONFIG.maxOffset) return null;
    const ladder = ladderOf(base);
    const level = ladder[ladder.indexOf(base) + offset];
    return level && (level === base || supports(level, topicOf(base, topic))) ? level : null;
  }

  // The level to ask questions from right now. Falls back to the base when the stored offset no longer fits.
  const levelFor = (base, topic, state) => levelAt(base, topic, state ? state.offset : 0) || base;

  function record(state, firstTryCorrect, seconds) {
    state.recent.push({ c: firstTryCorrect ? 1 : 0, s: Number.isFinite(seconds) ? Math.round(Math.min(CONFIG.maxSeconds, Math.max(0, seconds)) * 10) / 10 : 0 });
    if (state.recent.length > CONFIG.window) state.recent.splice(0, state.recent.length - CONFIG.window);
    if (state.cd > 0) state.cd -= 1;
    state.u = Date.now();
    return state;
  }

  const accuracy = (state) => (state.recent.length ? state.recent.reduce((n, r) => n + r.c, 0) / state.recent.length : 0);

  // Speed only ever holds back a move up (a child who is right but very slow is not ready for harder questions).
  // It never causes a change by itself, and it is ignored until enough answers have times.
  function isSlow(state, cfg = CONFIG) {
    const times = state.recent.filter(r => r.s > 0).map(r => r.s);
    return times.length >= cfg.minTimed && times.reduce((a, b) => a + b, 0) / times.length > cfg.slowSeconds;
  }

  // 'up' | 'down' | 'stay' from the recent answers alone (boundaries are checked in step()).
  function evaluate(state, cfg = CONFIG) {
    if (state.cd > 0) return 'stay';
    const n = state.recent.length;
    const acc = accuracy(state);
    if (n >= cfg.minUp && acc >= cfg.upAccuracy && !isSlow(state, cfg)) return 'up';
    if (n >= cfg.minDown && acc < cfg.downAccuracy) return 'down';
    return 'stay';
  }

  // Applies evaluate(): moves one step if allowed, then clears the history and starts the cooldown so the new
  // level has to be judged on its own answers (this is what stops up-down-up-down flipping).
  function step(state, base, topic, cfg = CONFIG) {
    const wanted = evaluate(state, cfg);
    if (wanted === 'stay') return { changed: false, direction: 'stay', level: levelFor(base, topic, state) };
    const next = state.offset + (wanted === 'up' ? 1 : -1);
    if (!levelAt(base, topic, next)) return { changed: false, direction: 'stay', limited: true, level: levelFor(base, topic, state) };
    state.offset = next;
    state.recent = [];
    state.cd = cfg.cooldown;
    return { changed: true, direction: wanted, level: levelFor(base, topic, state) };
  }

  // One call per decided question: records the first-attempt result, then applies any step.
  function update(state, base, topic, firstTryCorrect, seconds) {
    record(state, firstTryCorrect, seconds);
    return step(state, base, topic);
  }

  const api = { CONFIG, AGE_LADDER, GRADE_LADDER, keyOf, emptyState, cleanState, cleanMap, stateFor, candidates, levelAt, levelFor, record, accuracy, isSlow, evaluate, step, update };
  root.MQAdaptive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
