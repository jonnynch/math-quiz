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
    '🥨', '🍬', '🍰', '🍮', '🍯', '🍡', '🧋', '🌰', '🧇'];
  const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🐢', '🦁', '🐶', '🐱', '🚀', '🌟'];
  const MAX_PROFILES = 8;
  const MAX_HISTORY = 30;
  const NAME_LENGTH = 14;
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
  // Missing or damaged data becomes an empty bank; redeemed can never exceed earned.
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
      redeemed: Math.min(whole(r.redeemed), earned),
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
      rewards: cleanRewards(raw.rewards)
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
  const rewardPercent = (correct, completed) => (completed ? Math.floor((correct * 100) / completed) : 0);

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
    STICKERS, AVATARS, MAX_PROFILES, MAX_HISTORY, NAME_LENGTH, SCHEMA,
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
      if (minutes > balance) return `Only ${balance} minute${balance === 1 ? ' is' : 's are'} available.`;
      return '';
    },
    // Parent-only (needs a successful parent verification).
    redeem(profile, minutes) {
      const denied = parentDenied();
      if (denied) return denied;
      const error = api.checkRedeem(profile, minutes);
      if (error) return { error };
      profile.rewards.redeemed += minutes;
      profile.rewards.redeemTx.unshift({ t: Date.now(), minutes });
      profile.rewards.redeemTx.length = Math.min(profile.rewards.redeemTx.length, MAX_REWARD_TX);
      return { redeemed: minutes, saved: save() };
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
    _reset() { data = defaults(); }
  };

  root.MQStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
