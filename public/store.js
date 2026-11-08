// Saved profiles and settings (kept in this browser's localStorage). No DOM code here.
(function (root) {
  'use strict';

  const KEY = 'mathQuizBattle.v1';
  const BACKUP_KEY = 'mathQuizBattle.backup';   // copy of the data taken just before an import (for Undo)
  const SCHEMA = 1;                              // version of the saved data format (see migrate())
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
  const TEXT_SIZES = ['normal', 'large', 'xlarge'];

  let available = true;
  const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

  function defaults() {
    return { settings: { palette: 'standard', text: 'normal' }, profiles: [] };
  }

  // Saved data and backup files carry a schema number. When the format changes, bump SCHEMA and add a
  // step here that upgrades older data, e.g.  if (raw.schema === 1) { /* transform */ raw.schema = 2; }
  // Data saved before the number existed counts as schema 1.
  function migrate(raw) {
    return raw;
  }

  function cleanSettings(raw) {
    const out = defaults().settings;
    const s = raw && typeof raw === 'object' ? raw : {};
    if (PALETTES.includes(s.palette)) out.palette = s.palette;
    if (TEXT_SIZES.includes(s.text)) out.text = s.text;
    return out;
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
      streak: num(h && h.streak)
    }));
    const last = raw.lastSetup && typeof raw.lastSetup === 'object'
      ? { difficulty: String(raw.lastSetup.difficulty || '').slice(0, 20), topic: String(raw.lastSetup.topic || 'mixed').slice(0, 20) }
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
      lastSetup: last
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

  const api = {
    STICKERS, AVATARS, MAX_PROFILES, MAX_HISTORY, NAME_LENGTH, SCHEMA,
    isAvailable: () => available,
    getSettings: () => data.settings,
    setSetting(name, value) {
      if (name === 'palette' && PALETTES.includes(value)) data.settings.palette = value;
      else if (name === 'text' && TEXT_SIZES.includes(value)) data.settings.text = value;
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
    applyBackup(parsed, mode) {
      let backedUp = true;
      try {
        root.localStorage.setItem(BACKUP_KEY, JSON.stringify({ t: Date.now(), data: { settings: data.settings, profiles: data.profiles } }));
      } catch (error) { backedUp = false; }
      const result = { added: 0, replaced: 0, renamed: 0, skipped: parsed.skipped || 0, backedUp };
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
      result.saved = save();
      return result;
    },

    hasBackup() {
      try { return !!root.localStorage.getItem(BACKUP_KEY); } catch (error) { return false; }
    },

    // Undo the last import: put back the data taken just before it.
    restoreBackup() {
      try {
        const saved = JSON.parse(root.localStorage.getItem(BACKUP_KEY));
        if (!saved || !saved.data) return false;
        data = clean({ schema: SCHEMA, settings: saved.data.settings, profiles: saved.data.profiles });
        root.localStorage.removeItem(BACKUP_KEY);
        return save();
      } catch (error) {
        return false;
      }
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
