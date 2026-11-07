// Saved profiles and settings (kept in this browser's localStorage). No DOM code here.
(function (root) {
  'use strict';

  const KEY = 'mathQuizBattle.v1';
  const STICKERS = ['🦄', '🐶', '🐱', '🐼', '🦊', '🐸', '🐙', '🦋', '🐢', '🦁', '🐯', '🐵',
    '🚀', '🚁', '🚂', '🏆', '🎈', '🌈', '🍦', '🍕', '🎨', '⚽', '🎸', '🌟'];
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
      id: String(raw.id || '').slice(0, 30) || newId(),
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
    const s = raw.settings || {};
    if (PALETTES.includes(s.palette)) base.settings.palette = s.palette;
    if (TEXT_SIZES.includes(s.text)) base.settings.text = s.text;
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
      root.localStorage.setItem(KEY, JSON.stringify(data));
      available = true;
      return true;
    } catch (error) {
      available = false;
      return false;
    }
  }

  const api = {
    STICKERS, AVATARS, MAX_PROFILES, MAX_HISTORY, NAME_LENGTH,
    isAvailable: () => available,
    getSettings: () => data.settings,
    setSetting(name, value) {
      if (name === 'palette' && PALETTES.includes(value)) data.settings.palette = value;
      else if (name === 'text' && TEXT_SIZES.includes(value)) data.settings.text = value;
      else return false;
      save();
      return true;
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
      save();
      return { profile };
    },
    deleteProfile(id) {
      const before = data.profiles.length;
      data.profiles = data.profiles.filter(p => p.id !== id);
      if (data.profiles.length !== before) save();
      return data.profiles.length !== before;
    },
    save,
    // Test helper: replace everything with fresh data.
    _reset() { data = defaults(); }
  };

  root.MQStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
