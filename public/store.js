// Saved profiles and settings (kept in this browser's localStorage). No DOM code here.
(function (root) {
  'use strict';

  const KEY = 'mathQuizBattle.v1';
  const BACKUP_KEY = 'mathQuizBattle.backup';   // copy of the data taken just before an import (for Undo)
  const SCHEMA = 2;                              // version of the saved data format (see migrate())
  const MAX_IMPORT_CHARS = 1000000;
  const STICKERS = ['🦄', '🐶', '🐱', '🐼', '🦊', '🐸', '🐙', '🦋', '🐢', '🦁', '🐯', '🐵',
    '🚀', '🚁', '🚂', '🏆', '🎈', '🌈', '🍦', '🍕', '🎨', '⚽', '🎸', '🌟',
    // Added later. Only ever append: profiles store the emoji itself, so reordering or removing breaks saved stickers.
    '🐰', '🦖', '🦕', '🐨', '🐧', '🐬',        // animals
    '🍩', '🍓', '🍉', '🧁', '🍪',              // food
    '👽', '🛸', '🌙', '🌍',                    // space
    '🐉', '🧚', '🔮', '🏰',                    // fantasy
    '🚗', '🚒', '🧸', '🎁', '⛵',              // objects
    '🥇', '🥳', '👑', '💎', '🎯',              // achievement
    // New cute additions. Keep appending so previously collected stickers stay valid.
    '🐹', '🐭', '🐮', '🐷', '🐣', '🐦', '🐴', '🦓', '🦒', '🦘',
    '🦥', '🦦', '🦩', '🦚', '🐿', '🦔', '🦫', '🦡', '🐺', '🐻',
    '🌸', '🌺', '🌹', '🌱', '🍀', '🍄', '🪻', '🪷', '🌷',
    '🍒', '🍑', '🍍', '🍌', '🍊', '🍋', '🍐', '🥝', '🥑',
    '🥨', '🍬', '🍰', '🍮', '🍯', '🍡', '🧋', '🌰', '🧇',
    // Expansion from 100 to 200 stickers (appended to preserve existing IDs).
    '🐳', '🦉', '🐝', '🐞', '🦀',              // new animals (5)
    '🌻', '🌼', '🌲', '🌴', '🍁', '🍃', '🌾', '🌵', '🌊', '🌋', '🪴', '🎋', '☀️', '❄️', '🐚', // new nature (15)
    '🍎', '🍇', '🥕', '🌽', '🍔', '🍟', '🌮', '🍣', '🍜', '🍿', // new food (10)
    '🚲', '🛵', '🚜', '🚑', '🚓', '🚕', '🚌', '🚤', '🚢', '🚠', '🛹', '🛴', '🛶', '🛺', '✈️', // new vehicles (15)
    '🪐', '☄️', '🔭', '🔬', '🧬', '🧪', '🧫', '📡', '🛰️', '🧲', '💡', '🔋', '🤖', '🌌', // new space & science (14)
    '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🎳', '🥊', '🥋', '🪁', '🪀', '🥁', '🏹', // new sports & activities (14)
    '🧙', '🧝', '🧞', '🧜', '👻', '🎃', '🪄', '⚔️', '🛡️', '🗿', '🎪', '🦸', // new fantasy & characters (12)
    '🎒', '📚', '✏️', '✂️', '🔔', '🔑', '🕶️', '🧢', '👟', '🧦', '☂️', '⏰', '📷', '🧩', '🪙']; // new everyday objects (15)

  // 8 intuitive categories grouping all 200 stickers for compact browsing.
  const STICKER_CATEGORIES = [
    {
      id: 'animals',
      name: 'Animals',
      icon: '🐾',
      stickers: [
        '🐶', '🐱', '🐼', '🦊', '🐸', '🐙', '🦋', '🐢', '🦁', '🐯', '🐵', '🐰', '🐨', '🐧', '🐬',
        '🐹', '🐭', '🐮', '🐷', '🐣', '🐦', '🐴', '🦓', '🦒', '🦘', '🦥', '🦦', '🦩', '🦚', '🐿',
        '🦔', '🦫', '🦡', '🐺', '🐻', '🐳', '🦉', '🐝', '🐞', '🦀'
      ]
    },
    {
      id: 'nature',
      name: 'Nature',
      icon: '🌿',
      stickers: [
        '🌈', '🌸', '🌺', '🌹', '🌱', '🍀', '🍄', '🪻', '🪷', '🌷',
        '🌻', '🌼', '🌲', '🌴', '🍁', '🍃', '🌾', '🌵', '🌊', '🌋', '🪴', '🎋', '☀️', '❄️', '🐚'
      ]
    },
    {
      id: 'food',
      name: 'Food',
      icon: '🍎',
      stickers: [
        '🍦', '🍕', '🍩', '🍓', '🍉', '🧁', '🍪', '🍒', '🍑', '🍍', '🍌', '🍊', '🍋', '🍐', '🥝',
        '🥑', '🥨', '🍬', '🍰', '🍮', '🍯', '🍡', '🧋', '🌰', '🧇',
        '🍎', '🍇', '🥕', '🌽', '🍔', '🍟', '🌮', '🍣', '🍜', '🍿'
      ]
    },
    {
      id: 'vehicles',
      name: 'Vehicles',
      icon: '🚗',
      stickers: [
        '🚁', '🚂', '🚗', '🚒', '⛵',
        '🚲', '🛵', '🚜', '🚑', '🚓', '🚕', '🚌', '🚤', '🚢', '🚠', '🛹', '🛴', '🛶', '🛺', '✈️'
      ]
    },
    {
      id: 'space-science',
      name: 'Space and Science',
      icon: '🚀',
      stickers: [
        '🚀', '🌟', '👽', '🛸', '🌙', '🌍',
        '🪐', '☄️', '🔭', '🔬', '🧬', '🧪', '🧫', '📡', '🛰️', '🧲', '💡', '🔋', '🤖', '🌌'
      ]
    },
    {
      id: 'sports-activities',
      name: 'Sports and Activities',
      icon: '⚽',
      stickers: [
        '🏆', '🎨', '⚽', '🎸', '🥇', '🎯',
        '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🎳', '🥊', '🥋', '🪁', '🪀', '🥁', '🏹'
      ]
    },
    {
      id: 'fantasy-characters',
      name: 'Fantasy and Characters',
      icon: '✨',
      stickers: [
        '🦄', '🦖', '🦕', '🐉', '🧚', '🔮', '🏰', '🥳',
        '🧙', '🧝', '🧞', '🧜', '👻', '🎃', '🪄', '⚔️', '🛡️', '🗿', '🎪', '🦸'
      ]
    },
    {
      id: 'everyday-objects',
      name: 'Everyday Objects',
      icon: '🎁',
      stickers: [
        '🎈', '🧸', '🎁', '👑', '💎',
        '🎒', '📚', '✏️', '✂️', '🔔', '🔑', '🕶️', '🧢', '👟', '🧦', '☂️', '⏰', '📷', '🧩', '🪙'
      ]
    }
  ];

  const stickerCategoryMap = new Map();
  STICKER_CATEGORIES.forEach(cat => {
    cat.stickers.forEach(s => stickerCategoryMap.set(s, cat));
  });

  function getStickerCategory(sticker) {
    return stickerCategoryMap.get(sticker) || null;
  }

  function getStickersByCategory(categoryId) {
    const cat = STICKER_CATEGORIES.find(c => c.id === categoryId);
    return cat ? [...cat.stickers] : [];
  }

  function getCategoryProgress(profile, categoryId) {
    const cat = STICKER_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return { owned: 0, total: 0 };
    const ownedSet = new Set(Array.isArray(profile && profile.stickers) ? profile.stickers : []);
    let owned = 0;
    cat.stickers.forEach(s => {
      if (ownedSet.has(s)) owned++;
    });
    return { owned, total: cat.stickers.length };
  }
  const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🐢', '🦁', '🐶', '🐱', '🚀', '🌟'];
  const MAX_PROFILES = 8;
  const MAX_HISTORY = 30;
  const NAME_LENGTH = 14;
  const MAX_PLAY_MS = 6 * 60 * 60 * 1000;   // one Playzone session is never charged for more than 6 hours
  const MAX_PLAY_LOG = 20;                  // finished Playzone sessions kept per profile (also guards against double charging)
  const PALETTES = ['standard', 'cb'];
  const ON_OFF = ['off', 'on'];                   // read-aloud and sound effects: both off unless chosen
  const TEXT_SIZES = ['normal', 'large', 'xlarge'];

  // Screen-time reward bank (Grade 1-6 only). Every reward number lives here so it is easy to adjust;
  // parents can change them in the Screen-time Bank window, and these are the defaults.
  const REWARD_DEFAULTS = {
    base: 0.1,                              // minutes per correct first-attempt answer
    minAccuracy: 80,                        // % of first attempts that must be right for a batch to earn anything
    minBatch: 20,                           // completed questions needed before a batch is paid out
    accuracy: [1.0, 1.2, 1.4, 1.5],         // accuracy multiplier from each threshold below
    grades: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5]  // difficulty multiplier for Grade 1 to Grade 6
  };
  const REWARD_TIER_MINS = [80, 90, 95, 100]; // accuracy % where each accuracy multiplier starts
  const MAX_REWARD_TX = 30;
  const MAX_SETTLED = 20;

  // Trophy rules live in trophies.js (loaded first in the browser; required directly in Node tests).
  const Trophies = root.MQTrophies || (typeof require === 'function' ? require('./trophies.js') : null);

  let available = true;
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

  function defaults() {
    return { settings: { palette: 'standard', text: 'normal', readAloud: 'off', sound: 'off', rewards: cleanRewardConfig(null) }, profiles: [] };
  }

  // Saved data and backup files carry a schema number. When the format changes, bump SCHEMA and add a
  // step here that upgrades older data, e.g.  if (raw.schema === 1) { /* transform */ raw.schema = 2; }
  // Data saved before the number existed counts as schema 1.
  // Schema 2 added per-profile trophy progress (`trophies`); older profiles simply start with none.
  function migrate(raw) {
    const out = { ...raw };
    let schema = Number(out.schema) || 1;
    if (schema < 2) {
      out.profiles = (Array.isArray(out.profiles) ? out.profiles : []).map(p => (p && typeof p === 'object' && !p.trophies ? { ...p, trophies: {} } : p));
      schema = 2;
    }
    out.schema = schema;
    return out;
  }

  function cleanSettings(raw) {
    const out = defaults().settings;
    const s = raw && typeof raw === 'object' ? raw : {};
    if (PALETTES.includes(s.palette)) out.palette = s.palette;
    if (TEXT_SIZES.includes(s.text)) out.text = s.text;
    if (ON_OFF.includes(s.readAloud)) out.readAloud = s.readAloud;
    if (ON_OFF.includes(s.sound)) out.sound = s.sound;
    out.rewards = cleanRewardConfig(s.rewards);
    return out;
  }

  const isRewardGrade = (g) => Number.isInteger(g) && g >= 1 && g <= 6;
  const whole = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

  // Reward settings: anything missing or out of range falls back to the default for that value.
  function cleanRewardConfig(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const d = REWARD_DEFAULTS;
    const pick = (v, min, max, fallback, places) =>
      (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Number(v.toFixed(places)) : fallback);
    const list = (arr, fallback) => fallback.map((f, i) => pick(Array.isArray(arr) ? arr[i] : undefined, 0, 10, f, 2));
    return {
      base: pick(r.base, 0, 60, d.base, 2),
      minAccuracy: pick(r.minAccuracy, 0, 100, d.minAccuracy, 0),
      minBatch: pick(r.minBatch, 1, 500, d.minBatch, 0),
      accuracy: list(r.accuracy, d.accuracy),
      grades: list(r.grades, d.grades)
    };
  }

  // One profile's reward bank: totals, unfinished progress per grade, the running session, and history.
  // Missing or damaged data becomes an empty bank. redeemed may exceed earned: the balance can be negative
  // (Playzone charges whole minutes after play, and a parent may deduct more than is left).
  function cleanRewards(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const earned = whole(r.earned);
    const pending = {};
    const rawPending = r.pending && typeof r.pending === 'object' ? r.pending : {};
    for (let g = 1; g <= 6; g++) {
      const p = rawPending[g];
      const completed = p && typeof p === 'object' ? whole(p.completed) : 0;
      if (completed) pending[g] = { completed, correct: Math.min(whole(p.correct), completed) };
    }
    const s = r.session;
    let session = null;
    if (s && typeof s === 'object' && isRewardGrade(s.grade) && whole(s.completed)) {
      session = {
        id: String(s.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30),
        grade: s.grade,
        completed: whole(s.completed),
        correct: Math.min(whole(s.correct), whole(s.completed))
      };
    }
    const list = (v) => (Array.isArray(v) ? v.slice(0, MAX_REWARD_TX) : []);
    return {
      earned,
      redeemed: whole(r.redeemed),
      pending,
      session,
      earnTx: list(r.earnTx).filter(t => t && isRewardGrade(t.grade)).map(t => ({
        t: whole(t.t), grade: t.grade, completed: whole(t.completed),
        correct: Math.min(whole(t.correct), whole(t.completed)), minutes: whole(t.minutes)
      })),
      redeemTx: list(r.redeemTx).filter(t => t && typeof t === 'object').map(t => ({ t: whole(t.t), minutes: whole(t.minutes) })),
      settled: (Array.isArray(r.settled) ? r.settled : []).filter(x => typeof x === 'string').map(x => x.slice(0, 30)).slice(0, MAX_SETTLED)
    };
  }

  // Playzone data on a profile: personal bests (fastest valid Reaction Battle time in ms, lower is better; highest
  // Balloon Pop score), the one running usage session (if any), a short log of finished sessions, and the last
  // Pizza & Cake design (saved automatically when a session ends).
  const slug = (v, n) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, n);
  const DESIGN_SHAPES = ['round', 'square', 'heart', 'oval'];
  function cleanDesign(raw) {
    if (!raw || typeof raw !== 'object' || !['pizza', 'cake'].includes(raw.kind)) return null;
    const colour = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
    const outer = colour(raw.outer);
    const inner = colour(raw.inner);
    if (!outer || !inner) return null;
    const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 60)
      .filter(i => i && typeof i.type === 'string' && /^[a-z]{2,12}$/.test(i.type) && Number.isFinite(i.x) && Number.isFinite(i.y))
      .map(i => ({ type: i.type, x: Math.round(i.x * 10) / 10, y: Math.round(i.y * 10) / 10, rot: Number.isFinite(i.rot) ? Math.round(i.rot) : 0 }));
    return { kind: raw.kind, shape: DESIGN_SHAPES.includes(raw.shape) ? raw.shape : 'round', outer, inner, items };
  }
  function cleanPlayzone(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const ms = Math.round(Number(p.reactionBest));
    const s = p.session;
    const session = s && typeof s === 'object' && slug(s.id, 30)
      ? { id: slug(s.id, 30), game: slug(s.game, 20), startedAt: whole(s.startedAt), lastSeen: whole(s.lastSeen), usedMs: Math.min(whole(s.usedMs), MAX_PLAY_MS), status: 'active' }
      : null;
    const log = (Array.isArray(p.log) ? p.log : []).filter(x => x && typeof x === 'object' && slug(x.id, 30)).slice(0, MAX_PLAY_LOG)
      .map(x => ({ id: slug(x.id, 30), game: slug(x.game, 20), startedAt: whole(x.startedAt), endedAt: whole(x.endedAt), seconds: whole(x.seconds), minutes: whole(x.minutes), reason: slug(x.reason, 20) }));
    return {
      reactionBest: Number.isFinite(ms) && ms >= 1 && ms <= 60000 ? ms : null,
      balloonBest: Math.min(whole(p.balloonBest), 1000000),
      session,
      log,
      design: cleanDesign(p.design)
    };
  }

  function cleanProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name || '').trim().slice(0, NAME_LENGTH);
    if (!name) return null;
    const totals = raw.totals || {};
    const bests = {};
    Object.entries(raw.bests || {}).forEach(([k, v]) => { if (typeof k === 'string' && Number.isFinite(v)) bests[k.slice(0, 60)] = num(v); });
    const history = (Array.isArray(raw.history) ? raw.history : []).slice(0, MAX_HISTORY).map(h => ({
      t: num(h && h.t),
      level: String((h && h.level) || '').slice(0, 20),
      topic: String((h && h.topic) || 'mixed').slice(0, 20),
      mode: h && h.mode === 'versus' ? 'versus' : 'solo',
      seconds: num(h && h.seconds),
      score: num(h && h.score),
      taps: num(h && h.taps),
      correctTaps: num(h && h.correctTaps),
      avgTime: num(h && h.avgTime),
      streak: num(h && h.streak),
      // Seconds actually played. Added later: absent (not 0) on older games, which never recorded it.
      ...(h && Number.isFinite(h.played) && h.played >= 0 ? { played: Math.min(Math.floor(h.played), 86400) } : {})
    }));
    const last = raw.lastSetup && typeof raw.lastSetup === 'object'
      ? { difficulty: String(raw.lastSetup.difficulty || '').slice(0, 20), topic: String(raw.lastSetup.topic || 'all').slice(0, 20) }
      : null;
    return {
      id: String(raw.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30) || newId(),
      name,
      avatar: AVATARS.includes(raw.avatar) ? raw.avatar : AVATARS[0],
      created: num(raw.created),
      stickers: [...new Set((Array.isArray(raw.stickers) ? raw.stickers : []).filter(s => STICKERS.includes(s)))],
      totals: { games: num(totals.games), correct: num(totals.correct), taps: num(totals.taps), correctTaps: num(totals.correctTaps), bestStreak: num(totals.bestStreak) },
      bests,
      history,
      trophies: Trophies ? Trophies.cleanAll(raw.trophies) : {},
      lastSetup: last,
      rewards: cleanRewards(raw.rewards),
      playzone: cleanPlayzone(raw.playzone)
    };
  }

  function clean(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    raw = migrate(raw);
    base.settings = cleanSettings(raw.settings);
    const seen = new Set();
    (Array.isArray(raw.profiles) ? raw.profiles : []).slice(0, MAX_PROFILES).forEach(p => {
      const profile = cleanProfile(p);
      if (profile && !seen.has(profile.id)) { seen.add(profile.id); base.profiles.push(profile); }
    });
    return base;
  }

  function newId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function readStorage() {
    try {
      const raw = root.localStorage.getItem(KEY);
      return raw ? clean(JSON.parse(raw)) : defaults();
    } catch (error) {
      available = false;
      return defaults();
    }
  }

  let data = readStorage();
  closeStaleSessions();

  function save() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, settings: data.settings, profiles: data.profiles }));
      available = true;
      return true;
    } catch (error) {
      available = false;
      return false;
    }
  }

  // ---------- screen-time rewards (logic) ----------
  // Parent-only actions call this first. Fails closed: with no parent module loaded nothing is allowed.
  const parentDenied = (error) => (root.MQParent && root.MQParent.isUnlocked()
    ? null
    : { denied: true, error: error || 'Parent verification is needed first.', saved: false });
  // Backup import and Undo can overwrite profiles, balances and reward settings, so they are parent-only too.
  const IMPORT_DENIED = 'Parent verification is needed before importing or undoing a backup.';
  const rewardBalance = (profile) => (profile && profile.rewards ? profile.rewards.earned - profile.rewards.redeemed : 0);
  const MAX_ADJUST = 600;   // largest single manual adjustment, in minutes
  // Parent redeem: spends minutes the bank really has. (Playzone is charged after play by endPlay, and may go negative.)
  function applyRedeem(profile, minutes) {
    const error = api.checkRedeem(profile, minutes);
    if (error) return { error };
    profile.rewards.redeemed += minutes;
    profile.rewards.redeemTx.unshift({ t: Date.now(), minutes });
    profile.rewards.redeemTx.length = Math.min(profile.rewards.redeemTx.length, MAX_REWARD_TX);
    return { redeemed: minutes, saved: save() };
  }
  const rewardPercent = (correct, completed) => (completed ? Math.floor((correct * 100) / completed) : 0);

  // ---------- Playzone usage (charged by actual time, rounded up) ----------
  // A game session is charged when it ENDS: Math.ceil(seconds / 60) whole minutes (never fewer than 1, so a session
  // that has started cannot be refreshed away for free). Nothing is deducted when it starts. Each session is charged
  // on its own and the balance may become negative. The running session is stored on the profile (profile.playzone.
  // session) and its played time is counted from a monotonic clock in small steps (heartbeats), so refreshing, closing
  // the browser or changing the device clock cannot give free time. A session left behind (refresh, crash, restart)
  // is ended on the next launch (reconcilePlay) at the last heartbeat. The session is cleared and logged in the same
  // save that charges it, so it can only be charged once.
  const PLAY_GAP_MS = 15000;          // a longer silence (sleeping device, frozen page) is not counted as playing
  const live = new Map();             // profile id -> { id, perf }: sessions running in THIS page, with their last clock reading
  const playMinutes = (seconds) => Math.max(1, Math.ceil(Math.max(0, Number(seconds) || 0) / 60));

  // Another tab (or an earlier load) may already have charged this session: its id is then in the saved log.
  function settledElsewhere(profile, sessionId) {
    try {
      const raw = root.localStorage.getItem(KEY);
      if (!raw) return false;
      const saved = (JSON.parse(raw).profiles || []).find(p => p && p.id === profile.id);
      const pz = saved && saved.playzone;
      if (!pz) return false;
      return (Array.isArray(pz.log) ? pz.log : []).some(x => x && x.id === sessionId) || (!!pz.session && pz.session.id !== sessionId);
    } catch (error) { return false; }
  }

  function advancePlay(profile, perfNow) {
    const s = profile.playzone.session;
    const l = live.get(profile.id);
    if (!s || !l || l.id !== s.id) return;
    const gap = Number.isFinite(perfNow) ? perfNow - l.perf : 0;
    l.perf = Number.isFinite(perfNow) ? perfNow : l.perf;
    s.usedMs = Math.min(s.usedMs + Math.min(Math.max(gap, 0), PLAY_GAP_MS), MAX_PLAY_MS);
    s.lastSeen = Math.max(s.lastSeen, Date.now());   // for information only: charging never uses the device clock
  }

  // Ends the running session exactly once. Returns null when there is nothing to charge.
  function settlePlay(profile, reason) {
    const pz = profile && profile.playzone;
    const s = pz && pz.session;
    if (!s || !profile.rewards) return null;
    pz.session = null;
    live.delete(profile.id);
    if (pz.log.some(x => x.id === s.id) || settledElsewhere(profile, s.id)) return null;   // never charge twice
    const seconds = s.usedMs / 1000;
    const minutes = playMinutes(seconds);
    profile.rewards.redeemed += minutes;
    profile.rewards.redeemTx.unshift({ t: Date.now(), minutes });
    profile.rewards.redeemTx.length = Math.min(profile.rewards.redeemTx.length, MAX_REWARD_TX);
    pz.log.unshift({ id: s.id, game: s.game, startedAt: s.startedAt, endedAt: Date.now(), seconds: Math.round(seconds), minutes, reason: slug(reason || 'ended', 20) });
    pz.log.length = Math.min(pz.log.length, MAX_PLAY_LOG);
    return { minutes, seconds, game: s.game, balance: rewardBalance(profile), saved: save() };
  }

  // Ends every session left over from an earlier page load (refresh, crash, closed browser) at its last heartbeat.
  function reconcilePlay() {
    const results = [];
    data.profiles.forEach(profile => {
      const s = profile.playzone && profile.playzone.session;
      const l = live.get(profile.id);
      if (s && !(l && l.id === s.id)) { const r = settlePlay(profile, 'interrupted'); if (r) results.push({ profile: profile.id, ...r }); }
    });
    return results;
  }

  // Minutes for one batch of completed questions. Rounds down once, at the end, never per question.
  function calcReward(grade, completed, correct, config) {
    const cfg = config || data.settings.rewards;
    const result = { accuracy: completed ? (correct / completed) * 100 : 0, accuracyMult: 0, difficulty: 0, minutes: 0 };
    // Integer comparisons, so exactly 90 of 100 counts as 90%.
    if (!isRewardGrade(grade) || !completed || correct * 100 < cfg.minAccuracy * completed) return result;
    result.accuracyMult = cfg.accuracy[0];
    REWARD_TIER_MINS.forEach((min, i) => { if (correct * 100 >= min * completed) result.accuracyMult = cfg.accuracy[i]; });
    result.difficulty = cfg.grades[grade - 1];
    result.minutes = Math.floor(correct * cfg.base * result.accuracyMult * result.difficulty + 1e-9);
    return result;
  }

  // Moves a stored session (answers not yet settled) into the pending progress for its grade.
  function foldSession(profile) {
    const r = profile.rewards;
    const s = r.session;
    r.session = null;
    if (!s) return null;
    const p = r.pending[s.grade] || (r.pending[s.grade] = { completed: 0, correct: 0 });
    p.completed += s.completed;
    p.correct += s.correct;
    return s;
  }

  // Pays out the pending questions of one grade once there are enough of them. The whole batch is used up
  // either way (zero minutes under the accuracy limit), so a poor batch cannot be rescued by restarting.
  function payOutBatch(profile, grade) {
    const r = profile.rewards;
    const p = r.pending[grade];
    if (!p || p.completed < data.settings.rewards.minBatch) return null;
    const calc = calcReward(grade, p.completed, p.correct);
    delete r.pending[grade];
    r.earned += calc.minutes;
    r.earnTx.unshift({ t: Date.now(), grade, completed: p.completed, correct: p.correct, minutes: calc.minutes });
    r.earnTx.length = Math.min(r.earnTx.length, MAX_REWARD_TX);
    return { ...calc, grade, completed: p.completed, correct: p.correct };
  }

  // A session left behind by a closed or refreshed page: keep its progress, and pay out if a batch is complete.
  function closeStaleSession(profile) {
    const stale = foldSession(profile);
    if (stale) payOutBatch(profile, stale.grade);
    return !!stale;
  }

  function closeStaleSessions() {
    if (data.profiles.map(profile => closeStaleSession(profile)).some(Boolean)) save();
  }

  const api = {
    STICKERS, STICKER_CATEGORIES, getStickerCategory, getStickersByCategory, getCategoryProgress,
    AVATARS, MAX_PROFILES, MAX_HISTORY, NAME_LENGTH, SCHEMA,
    isAvailable: () => available,
    getSettings: () => data.settings,
    setSetting(name, value) {
      if (name === 'palette' && PALETTES.includes(value)) data.settings.palette = value;
      else if (name === 'text' && TEXT_SIZES.includes(value)) data.settings.text = value;
      else if ((name === 'readAloud' || name === 'sound') && ON_OFF.includes(value)) data.settings[name] = value;
      else return { error: 'Unknown setting.' };
      return { saved: save() };
    },
    getProfiles: () => data.profiles,
    getProfile: (id) => data.profiles.find(p => p.id === id) || null,
    addProfile(name, avatar) {
      const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, NAME_LENGTH);
      if (!cleanName) return { error: 'Please type a name.' };
      if (data.profiles.length >= MAX_PROFILES) return { error: `You can save up to ${MAX_PROFILES} profiles.` };
      if (data.profiles.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) return { error: 'That name is already used.' };
      const profile = cleanProfile({ id: newId(), name: cleanName, avatar, created: Date.now() });
      data.profiles.push(profile);
      return { profile, saved: save() };
    },
    deleteProfile(id) {
      const before = data.profiles.length;
      data.profiles = data.profiles.filter(p => p.id !== id);
      const deleted = data.profiles.length !== before;
      return { deleted, saved: deleted ? save() : true };
    },

    // ---------- screen-time bank ----------
    REWARD_DEFAULTS, REWARD_TIER_MINS, isRewardGrade, calcReward, rewardBalance, rewardPercent,
    getRewardConfig: () => data.settings.rewards,
    // Parent-only: needs a successful parent verification (see parent.js). Checked here, not just in the UI.
    setRewardConfig(changes) {
      const denied = parentDenied();
      if (denied) return { ...denied, config: data.settings.rewards };
      data.settings.rewards = cleanRewardConfig({ ...data.settings.rewards, ...changes });
      return { config: data.settings.rewards, saved: save() };
    },
    // Parent-only. If the browser cannot save the defaults, the previous settings are kept and saved: false is returned.
    resetRewardConfig() {
      const denied = parentDenied();
      if (denied) return { ...denied, config: data.settings.rewards };
      const previous = data.settings.rewards;
      const result = api.setRewardConfig(REWARD_DEFAULTS);
      if (result.saved === false) {
        data.settings.rewards = previous;
        return { config: previous, saved: false, kept: true };
      }
      return result;
    },

    // Called once per question with the player's FIRST answer (retries are never reported). Progress is saved
    // straight away, so it survives a refresh or a closed page. Returns false when the answer is not counted, else
    // { counted: true, saved }. If the browser cannot save, the change is rolled back (so memory matches storage and a
    // repeated call cannot count the same answer twice) and saved: false is returned for the caller to report.
    rewardAnswer(profile, sessionId, grade, correct) {
      if (!profile || !profile.rewards || !sessionId || !isRewardGrade(grade)) return false;
      const r = profile.rewards;
      if (r.settled.includes(sessionId)) return false;
      const before = JSON.stringify(r);
      if (r.session && (r.session.id !== sessionId || r.session.grade !== grade)) closeStaleSession(profile);
      if (!r.session) r.session = { id: sessionId, grade, completed: 0, correct: 0 };
      r.session.completed += 1;
      if (correct) r.session.correct += 1;
      const saved = save();
      if (!saved) {
        Object.keys(r).forEach(key => { delete r[key]; });
        Object.assign(r, JSON.parse(before));
      }
      return { counted: saved, saved };
    },

    // Ends a session: its answers join the pending questions for that grade and, if there are enough, a batch is
    // paid out. Settling the same session twice does nothing. Transactional: the reward state is snapshotted first
    // and, if the browser cannot save, put back exactly as it was ({ settled: false, saved: false, error }), so the
    // session is neither settled nor paid and a retry (or the next page load) settles it once.
    settleRewards(profile, sessionId) {
      const r = profile && profile.rewards;
      if (!r || r.settled.includes(sessionId) || !r.session || r.session.id !== sessionId) return { settled: false, saved: true };
      const before = JSON.stringify(r);
      const grade = r.session.grade;
      r.settled.unshift(sessionId);
      r.settled.length = Math.min(r.settled.length, MAX_SETTLED);
      foldSession(profile);
      const batch = payOutBatch(profile, grade);
      const saved = save();
      if (!saved) {
        Object.keys(r).forEach(key => { delete r[key]; });
        Object.assign(r, JSON.parse(before));
        return { settled: false, saved: false, error: 'This browser would not save the screen time, so nothing was added.' };
      }
      return { settled: true, grade, batch, pending: r.pending[grade] || null, minBatch: data.settings.rewards.minBatch, saved: true };
    },

    // Unfinished progress per grade (including the running session), for the "progress to next reward" display.
    rewardProgress(profile) {
      const totals = {};
      const add = (grade, p) => {
        const t = totals[grade] || (totals[grade] = { grade: Number(grade), completed: 0, correct: 0 });
        t.completed += p.completed;
        t.correct += p.correct;
      };
      Object.entries(profile.rewards.pending).forEach(([grade, p]) => add(grade, p));
      if (profile.rewards.session) add(profile.rewards.session.grade, profile.rewards.session);
      return Object.values(totals).sort((a, b) => a.grade - b.grade);
    },

    // Returns an error message, or '' when the amount can be redeemed.
    checkRedeem(profile, minutes) {
      if (!profile || !profile.rewards) return 'Choose a profile first.';
      const balance = rewardBalance(profile);
      if (!Number.isInteger(minutes) || minutes < 1) return 'Type a whole number of minutes (1 or more).';
      if (balance <= 0) return 'No minutes are available to redeem.';
      if (minutes > balance) return `Only ${balance} minute${balance === 1 ? ' is' : 's are'} available.`;
      return '';
    },
    // Parent-only (needs a successful parent verification).
    redeem(profile, minutes) {
      const denied = parentDenied();
      if (denied) return denied;
      return applyRedeem(profile, minutes);
    },
    // ----- Playzone usage (see the block above). perfNow is a monotonic clock reading in ms (performance.now()). -----
    playMinutes,
    // A new game may only start while the balance is above zero. Nothing is deducted here; time is charged by endPlay.
    startPlay(profile, game, perfNow) {
      if (!profile || !profile.rewards || !profile.playzone) return { error: 'Choose a profile first.' };
      const pz = profile.playzone;
      if (pz.session) {
        const l = live.get(profile.id);
        if (l && l.id === pz.session.id) return { error: 'A game is already running.', running: true };   // overlapping sessions are refused
        settlePlay(profile, 'interrupted');                                                             // left over from an earlier page: charge it first
      }
      if (rewardBalance(profile) <= 0) return { error: 'The Screen-time Bank must be above 0 minutes before another game can start.', empty: true };
      const id = newId();
      const now = Date.now();
      pz.session = { id, game: slug(game, 20), startedAt: now, lastSeen: now, usedMs: 0, status: 'active' };
      live.set(profile.id, { id, perf: Number.isFinite(perfNow) ? perfNow : 0 });
      return { id, saved: save() };
    },
    // Heartbeat: counts the time since the last reading and saves it. { ended: true } if another tab already charged it.
    tickPlay(profile, perfNow) {
      const s = profile && profile.playzone && profile.playzone.session;
      if (!s) return { active: false };
      if (settledElsewhere(profile, s.id)) { profile.playzone.session = null; live.delete(profile.id); return { active: false, ended: true }; }
      advancePlay(profile, perfNow);
      return { active: true, seconds: s.usedMs / 1000, saved: save() };
    },
    // Seconds played so far in the running session (no saving).
    playSeconds(profile, perfNow) {
      const s = profile && profile.playzone && profile.playzone.session;
      const l = s && live.get(profile.id);
      if (!s) return 0;
      const gap = l && l.id === s.id && Number.isFinite(perfNow) ? Math.min(Math.max(perfNow - l.perf, 0), PLAY_GAP_MS) : 0;
      return (s.usedMs + gap) / 1000;
    },
    activePlay: (profile) => !!(profile && profile.playzone && profile.playzone.session),
    // Ends the session and charges its actual usage, rounded up to whole minutes. Safe to call twice: the second call charges nothing.
    endPlay(profile, perfNow, reason) {
      if (!profile || !profile.playzone || !profile.playzone.session) return null;
      advancePlay(profile, perfNow);
      return settlePlay(profile, reason || 'ended');
    },
    reconcilePlay,
    // Keeps the latest Pizza & Cake design on the profile (see cleanDesign).
    saveDesign(profile, design) {
      if (!profile || !profile.playzone) return false;
      profile.playzone.design = cleanDesign(design);
      return save();
    },
    // Parent-only manual correction of the same bank: +minutes raise `earned`, -minutes raise `redeemed`. The balance may go negative.
    // Needs the separate hard verification (MQParent.hard), not the normal parent check.
    adjustBalance(profile, delta) {
      const hard = root.MQParent && root.MQParent.hard;
      if (!hard || !hard.isUnlocked()) return { denied: true, error: 'Parent verification is needed first.', saved: false };
      if (!profile || !profile.rewards) return { error: 'Choose a profile first.' };
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_ADJUST) return { error: `Type a whole number of minutes from 1 to ${MAX_ADJUST}.` };
      const before = rewardBalance(profile);   // a deduction may take the balance below zero
      if (delta > 0) profile.rewards.earned += delta;
      else profile.rewards.redeemed += -delta;
      return { before, after: rewardBalance(profile), saved: save() };
    },
    // Keeps the better of the stored and new value. kind: 'reaction' (ms, lower wins) or 'balloon' (score, higher wins).
    recordPlayzone(profile, kind, value) {
      if (!profile || !profile.playzone || !Number.isFinite(value)) return { isNew: false, best: null, saved: false };
      const pz = profile.playzone;
      let previous;
      let better;
      if (kind === 'reaction') {
        value = Math.round(value);
        if (value < 1 || value > 60000) return { isNew: false, best: pz.reactionBest, saved: false };
        previous = pz.reactionBest;
        better = previous === null || value < previous;
        if (better) pz.reactionBest = value;
      } else if (kind === 'balloon') {
        value = Math.floor(value);
        if (value < 1) return { isNew: false, best: pz.balloonBest, saved: false };
        previous = pz.balloonBest;
        better = value > previous;
        if (better) pz.balloonBest = Math.min(value, 1000000);
      } else return { isNew: false, best: null, saved: false };
      const best = kind === 'reaction' ? pz.reactionBest : pz.balloonBest;
      return { isNew: better, first: better && !previous, best, saved: better ? save() : true };
    },
    save,

    // ---------- backup and restore ----------
    // A backup file is plain JSON: { app, schema, exportedAt, settings, profiles }.
    exportText() {
      return JSON.stringify({
        app: 'mathQuizBattle', schema: SCHEMA, exportedAt: new Date().toISOString(),
        settings: data.settings, profiles: data.profiles
      }, null, 2);
    },

    // Validates a backup without changing anything. Returns { profiles, skipped, settings } or { error }.
    parseBackup(text) {
      if (typeof text !== 'string' || !text.trim()) return { error: 'The backup is empty.' };
      if (text.length > MAX_IMPORT_CHARS) return { error: 'That file is too large to be a profile backup.' };
      let raw;
      try { raw = JSON.parse(text); } catch (error) { return { error: 'That is not a valid backup. Please use a file made by Export.' }; }
      if (!raw || typeof raw !== 'object' || raw.app !== 'mathQuizBattle' || !Array.isArray(raw.profiles)) {
        return { error: 'That is not a Math Quiz Battle backup.' };
      }
      if (Number(raw.schema) > SCHEMA) return { error: 'This backup was made by a newer version of the game. Please update the game first.' };
      raw = migrate(raw);
      const profiles = [];
      const seen = new Set();
      let skipped = 0;
      raw.profiles.slice(0, 50).forEach(p => {
        const profile = cleanProfile(p);
        if (profile && !seen.has(profile.id)) { seen.add(profile.id); profiles.push(profile); } else skipped += 1;
      });
      if (!profiles.length) return { error: 'The backup has no usable profiles.' };
      return { profiles, skipped, settings: cleanSettings(raw.settings) };
    },

    // mode 'merge': add to the current profiles (same id = replaced by the backup, same name = renamed).
    // mode 'replace': the backup becomes everything (settings too). The current data is copied first so Undo works.
    // Parent-only (checked before anything is written, including the Undo copy). Safe when saving fails: if the Undo
    // copy cannot be written nothing is imported; if the imported data cannot be saved the data in use and the previous
    // Undo copy are put back. Failures return { imported: false, saved: false, error }.
    applyBackup(parsed, mode) {
      const denied = parentDenied(IMPORT_DENIED);
      if (denied) return denied;
      // The Undo copy comes first. If it cannot be written, nothing is imported. Any earlier Undo copy is remembered
      // so a failed import can put it back (the new copy is kept only once the import has been saved).
      let previousUndo = null;
      try {
        previousUndo = root.localStorage.getItem(BACKUP_KEY);
        root.localStorage.setItem(BACKUP_KEY, JSON.stringify({ t: Date.now(), data: { settings: data.settings, profiles: data.profiles } }));
      } catch (error) {
        return { added: 0, replaced: 0, renamed: 0, skipped: 0, imported: false, backedUp: false, saved: false, error: 'This browser would not save an Undo copy, so nothing was imported.' };
      }
      // Merge changes the profiles array in place and Replace swaps it, but neither edits an existing profile object,
      // so a shallow copy is enough to put everything back (and keeps references held by the UI valid).
      const originalProfiles = data.profiles;
      const originalList = originalProfiles.slice();
      const originalSettings = data.settings;
      const result = { added: 0, replaced: 0, renamed: 0, skipped: parsed.skipped || 0, backedUp: true };
      const uniqueName = (name, ignoreIndex) => {
        let candidate = name;
        let n = 2;
        while (data.profiles.some((p, i) => i !== ignoreIndex && p.name.toLowerCase() === candidate.toLowerCase())) {
          candidate = `${name.slice(0, NAME_LENGTH - 4)} (${n++})`;
        }
        return candidate;
      };
      if (mode === 'replace') {
        const kept = parsed.profiles.slice(0, MAX_PROFILES);
        result.skipped += parsed.profiles.length - kept.length;
        data.profiles = kept;
        data.settings = { ...parsed.settings };
        result.added = kept.length;
      } else {
        parsed.profiles.forEach(profile => {
          const index = data.profiles.findIndex(p => p.id === profile.id);
          if (index >= 0) {
            const name = uniqueName(profile.name, index);
            if (name !== profile.name) result.renamed += 1;
            data.profiles[index] = { ...profile, name };
            result.replaced += 1;
          } else if (data.profiles.length >= MAX_PROFILES) {
            result.skipped += 1;
          } else {
            const name = uniqueName(profile.name, -1);
            if (name !== profile.name) result.renamed += 1;
            data.profiles.push({ ...profile, name });
            result.added += 1;
          }
        });
      }
      if (!save()) {
        originalProfiles.length = 0;
        originalProfiles.push(...originalList);
        data.profiles = originalProfiles;
        data.settings = originalSettings;
        try {
          if (previousUndo === null) root.localStorage.removeItem(BACKUP_KEY);
          else root.localStorage.setItem(BACKUP_KEY, previousUndo);
        } catch (error) { /* nothing more can be done; the data in use is already back as it was */ }
        return { added: 0, replaced: 0, renamed: 0, skipped: 0, imported: false, backedUp: false, saved: false, error: 'This browser would not save the imported data, so nothing was changed. Please try again.' };
      }
      result.imported = true;
      result.saved = true;
      return result;
    },

    hasBackup() {
      try { return !!root.localStorage.getItem(BACKUP_KEY); } catch (error) { return false; }
    },

    // Undo the last import: put back the data taken just before it. Parent-only, because the copy can hold older
    // balances and reward settings. Returns { restored, denied?, error?, saved? }.
    // The Undo copy is deleted only after the restored data has been saved. If saving fails, the in-memory data is
    // put back as it was and the copy is kept, so the parent can try again.
    restoreBackup() {
      const denied = parentDenied(IMPORT_DENIED);
      if (denied) return { ...denied, restored: false };
      const previous = data;
      try {
        const saved = JSON.parse(root.localStorage.getItem(BACKUP_KEY));
        if (!saved || !saved.data) return { restored: false };
        data = clean({ schema: SCHEMA, settings: saved.data.settings, profiles: saved.data.profiles });
      } catch (error) {
        data = previous;
        return { restored: false };
      }
      if (!save()) {
        data = previous;
        return { restored: false, saved: false, kept: true, error: 'This browser would not save the change. The Undo copy was kept, so you can try again.' };
      }
      try { root.localStorage.removeItem(BACKUP_KEY); } catch (error) { /* restored data is already saved; a leftover copy is harmless */ }
      return { restored: true, saved: true };
    },

    // Asks the browser not to clear saved data automatically (not every browser honours this).
    requestPersistence() {
      try {
        if (root.navigator && root.navigator.storage && root.navigator.storage.persist) return root.navigator.storage.persist();
      } catch (error) { /* ignore */ }
      return Promise.resolve(false);
    },

    // Test helper: replace everything with fresh data.
    _reset() { data = defaults(); live.clear(); }
  };

  reconcilePlay();   // end any Playzone session left behind by a refresh, crash or closed browser
  root.MQStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
