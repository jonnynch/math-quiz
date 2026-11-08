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
    return LEVELS.reduce((sum, level) => sum + progressFor(profile, level).filter(t => t.unlocked).length, 0);
  }

  const api = { TARGETS, TIERS, LEVELS, emptyProgress, cleanProgress, cleanAll, record, resetStreak, progressFor, unlockedCount };
  root.MQTrophies = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
