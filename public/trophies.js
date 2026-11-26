// Trophies: long-term achievements per profile and level. Pure logic (no DOM) so it can be tested in Node.
// Trophies are rewards only. They never change scores, stars, streaks or stickers.
(function (root) {
  'use strict';

  // ---------- central configuration: change the targets here ----------
  // bronze = questions completed, silver = questions answered correctly,
  // gold   = correct answers in a row (a wrong answer starts the count again).
  // The keys are the level ids from questions.js (DIFFICULTIES) and their order is the order shown on the page.
  const TARGETS = {
    toddler: { bronze: 30, silver: 20, gold: 5 },
    age4: { bronze: 40, silver: 30, gold: 7 },
    age5: { bronze: 50, silver: 40, gold: 8 },
    age6: { bronze: 60, silver: 50, gold: 10 },
    grade1: { bronze: 75, silver: 60, gold: 12 },
    grade2: { bronze: 100, silver: 80, gold: 15 },
    grade3: { bronze: 125, silver: 100, gold: 18 },
    grade4: { bronze: 150, silver: 120, gold: 20 },
    grade5: { bronze: 175, silver: 140, gold: 25 },
    grade6: { bronze: 200, silver: 160, gold: 30 }
  };

  // `field` is the progress counter each trophy is measured by (see emptyProgress).
  const TIERS = [
    { id: 'bronze', icon: '🥉', name: 'Bronze Practice', field: 'completed', describe: (n) => `Complete ${n} questions.` },
    { id: 'silver', icon: '🥈', name: 'Silver Accuracy', field: 'correct', describe: (n) => `Answer ${n} questions correctly.` },
    { id: 'gold', icon: '🥇', name: 'Gold Mastery', field: 'best', describe: (n) => `Get ${n} correct answers in a row.` }
  ];
  const LEVELS = Object.keys(TARGETS);

  // ---------- Balloon Pop trophies (same profile.trophies object, key `balloon`) ----------
  // Each one is measured by a best-ever value kept on the profile: `level` = highest level reached, `combo` = longest
  // combo in one game, `pops` = most balloons popped in one game. Saved profiles only; guests never collect them.
  const BALLOON_KEY = 'balloon';
  const BALLOON_TROPHIES = [
    { id: 'level10', icon: '🥉', name: 'Sky Climber', field: 'level', target: 10, describe: (n) => `Reach Level ${n} in Balloon Pop.` },
    { id: 'level20', icon: '🥈', name: 'Cloud Hopper', field: 'level', target: 20, describe: (n) => `Reach Level ${n} in Balloon Pop.` },
    { id: 'level30', icon: '🥇', name: 'Storm Chaser', field: 'level', target: 30, describe: (n) => `Reach Level ${n} in Balloon Pop.` },
    { id: 'level50', icon: '🏅', name: 'Night Flyer', field: 'level', target: 50, describe: (n) => `Reach Level ${n} in Balloon Pop.` },
    { id: 'level100', icon: '🏆', name: 'Balloon Legend', field: 'level', target: 100, describe: (n) => `Reach Level ${n} in Balloon Pop.` },
    { id: 'combo5', icon: '🔥', name: 'Combo Starter', field: 'combo', target: 5, describe: (n) => `Pop ${n} balloons in a row.` },
    { id: 'combo10', icon: '🔥', name: 'Combo Master', field: 'combo', target: 10, describe: (n) => `Pop ${n} balloons in a row.` },
    { id: 'combo20', icon: '🔥', name: 'Combo Champion', field: 'combo', target: 20, describe: (n) => `Pop ${n} balloons in a row.` },
    { id: 'pops50', icon: '🎈', name: 'Balloon Popper', field: 'pops', target: 50, describe: (n) => `Pop ${n} balloons in one game.` },
    { id: 'pops100', icon: '🎈', name: 'Balloon Expert', field: 'pops', target: 100, describe: (n) => `Pop ${n} balloons in one game.` }
  ];
  const BALLOON_FIELDS = ['level', 'combo', 'pops'];

  function cleanBalloon(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const out = { level: count(r.level), combo: count(r.combo), pops: count(r.pops), unlocked: [] };
    const ids = Array.isArray(r.unlocked) ? r.unlocked : [];
    out.unlocked = BALLOON_TROPHIES.map(t => t.id).filter(id => ids.includes(id));
    return out;
  }

  // Keeps the best values and returns the trophies newly unlocked by them. A trophy is only ever awarded once.
  function recordBalloon(profile, stats) {
    if (!profile || !stats) return [];
    if (!profile.trophies || typeof profile.trophies !== 'object') profile.trophies = {};
    const p = profile.trophies[BALLOON_KEY] = cleanBalloon(profile.trophies[BALLOON_KEY]);
    BALLOON_FIELDS.forEach(f => { p[f] = Math.max(p[f], count(stats[f])); });
    const won = [];
    BALLOON_TROPHIES.forEach(t => {
      if (!p.unlocked.includes(t.id) && p[t.field] >= t.target) { p.unlocked.push(t.id); won.push(t); }
    });
    return won;
  }

  function balloonProgress(profile) {
    const p = cleanBalloon(profile && profile.trophies && profile.trophies[BALLOON_KEY]);
    return BALLOON_TROPHIES.map(t => {
      const unlocked = p.unlocked.includes(t.id);
      return { tier: t, target: t.target, value: unlocked ? t.target : Math.min(p[t.field], t.target), unlocked, description: t.describe(t.target) };
    });
  }

  // ---------- Sticker Collection trophies (same profile.trophies object, key `stickers`) ----------
  const STICKER_KEY = 'stickers';
  const STICKER_TROPHIES = [
    { id: 'stickers100', icon: '🥉', name: 'Sticker Collector', target: 100, describe: (n) => `Collect ${n} unique stickers.` },
    { id: 'stickers200', icon: '🥈', name: 'Sticker Enthusiast', target: 200, describe: (n) => `Collect ${n} unique stickers.` },
    { id: 'stickers300', icon: '🥇', name: 'Sticker Master', target: 300, describe: (n) => `Collect ${n} unique stickers.` }
  ];
  const uniqueStickerCount = (profile) => (profile && Array.isArray(profile.stickers) ? new Set(profile.stickers).size : 0);

  function cleanStickers(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const ids = Array.isArray(r.unlocked) ? r.unlocked : [];
    return { unlocked: STICKER_TROPHIES.map(t => t.id).filter(id => ids.includes(id)) };
  }

  // Awards sticker collection milestones based on unique unlocked stickers. Each milestone is awarded once.
  function recordStickers(profile) {
    if (!profile) return [];
    const total = uniqueStickerCount(profile);
    const existing = profile.trophies && profile.trophies[STICKER_KEY];
    const p = cleanStickers(existing);
    const won = [];
    STICKER_TROPHIES.forEach(t => {
      if (!p.unlocked.includes(t.id) && total >= t.target) {
        p.unlocked.push(t.id);
        won.push(t);
      }
    });
    if (won.length || existing) {
      if (!profile.trophies || typeof profile.trophies !== 'object') profile.trophies = {};
      profile.trophies[STICKER_KEY] = p;
    }
    return won;
  }

  function stickerProgress(profile) {
    const p = cleanStickers(profile && profile.trophies && profile.trophies[STICKER_KEY]);
    const total = uniqueStickerCount(profile);
    return STICKER_TROPHIES.map(t => {
      const unlocked = p.unlocked.includes(t.id);
      return { tier: t, target: t.target, value: unlocked ? t.target : Math.min(total, t.target), unlocked, description: t.describe(t.target) };
    });
  }
  const MAX_COUNT = 1000000;

  const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), MAX_COUNT) : 0);

  // completed = questions finished (right or wrong), correct = finished with a correct first answer,
  // streak = current correct-first-answer run, best = longest run so far, unlocked = trophy ids won.
  function emptyProgress() {
    return { completed: 0, correct: 0, streak: 0, best: 0, unlocked: [] };
  }

  // Validates saved or imported progress for one level.
  function cleanProgress(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const out = emptyProgress();
    out.completed = count(r.completed);
    out.correct = Math.min(count(r.correct), out.completed);
    out.streak = Math.min(count(r.streak), out.correct);
    out.best = Math.min(Math.max(count(r.best), out.streak), out.correct);
    const ids = Array.isArray(r.unlocked) ? r.unlocked : [];
    out.unlocked = TIERS.map(t => t.id).filter(id => ids.includes(id));
    return out;
  }

  // Validates the whole `trophies` object of a profile. Unknown levels are dropped.
  function cleanAll(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    LEVELS.forEach(level => { if (raw[level] && typeof raw[level] === 'object') out[level] = cleanProgress(raw[level]); });
    if (raw[BALLOON_KEY] && typeof raw[BALLOON_KEY] === 'object') out[BALLOON_KEY] = cleanBalloon(raw[BALLOON_KEY]);
    if (raw[STICKER_KEY] && typeof raw[STICKER_KEY] === 'object') out[STICKER_KEY] = cleanStickers(raw[STICKER_KEY]);
    return out;
  }

  // Records one finished question for a profile and level. Returns the trophies unlocked by it (usually none).
  function record(profile, level, correct) {
    if (!profile || !TARGETS[level]) return [];
    if (!profile.trophies || typeof profile.trophies !== 'object') profile.trophies = {};
    const p = profile.trophies[level] || (profile.trophies[level] = emptyProgress());
    p.completed += 1;
    if (correct) {
      p.correct += 1;
      p.streak += 1;
      if (p.streak > p.best) p.best = p.streak;
    } else {
      p.streak = 0;
    }
    const won = [];
    TIERS.forEach(tier => {
      if (!p.unlocked.includes(tier.id) && p[tier.field] >= TARGETS[level][tier.id]) {
        p.unlocked.push(tier.id);
        won.push(tier);
      }
    });
    return won;
  }

  // A wrong answer ends the current run straight away. Returns true if something changed.
  function resetStreak(profile, level) {
    const p = profile && profile.trophies && profile.trophies[level];
    if (!p || !p.streak) return false;
    p.streak = 0;
    return true;
  }

  // The three trophies of a level with their progress, for the Achievements page.
  function progressFor(profile, level) {
    const p = (profile && profile.trophies && profile.trophies[level]) || emptyProgress();
    return TIERS.map(tier => {
      const target = TARGETS[level][tier.id];
      const unlocked = p.unlocked.includes(tier.id);
      const value = unlocked ? target : Math.min(p[tier.field], target);
      return { tier, target, value, unlocked, description: tier.describe(target) };
    });
  }

  function unlockedCount(profile) {
    return LEVELS.reduce((sum, level) => sum + progressFor(profile, level).filter(t => t.unlocked).length, 0)
      + balloonProgress(profile).filter(t => t.unlocked).length
      + stickerProgress(profile).filter(t => t.unlocked).length;
  }

  const api = { BALLOON_TROPHIES, recordBalloon, balloonProgress, STICKER_TROPHIES, recordStickers, stickerProgress, TARGETS, TIERS, LEVELS, emptyProgress, cleanProgress, cleanAll, record, resetStreak, progressFor, unlockedCount };
  root.MQTrophies = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
