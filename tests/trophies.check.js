// Unit checks for trophies.js (targets, thresholds, streaks, no duplicates, validation) and for how
// store.js keeps trophy progress per profile (separation, persistence, backup, old data). No browser needed.
const path = require('path');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };
const T = require(path.join(__dirname, '..', 'public', 'trophies.js'));
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));

// --- configuration
ok(T.LEVELS.join() === Q.DIFFICULTIES.map(d => d.value).join(), 'there is a trophy set for every quiz level, in the same order');
ok(T.TIERS.length === 3 && T.TIERS.map(t => t.id).join() === 'bronze,silver,gold', 'exactly three trophies per level: bronze, silver, gold');
const SPEC = { toddler: [30, 20, 5], age4: [40, 30, 7], age5: [50, 40, 8], age6: [60, 50, 10], grade1: [75, 60, 12], grade2: [100, 80, 15], grade3: [125, 100, 18], grade4: [150, 120, 20], grade5: [175, 140, 25], grade6: [200, 160, 30] };
ok(Object.entries(SPEC).every(([l, [b, s, g]]) => T.TARGETS[l].bronze === b && T.TARGETS[l].silver === s && T.TARGETS[l].gold === g), 'default targets match the agreed table');
ok(T.LEVELS.every((l, i) => i === 0 || (T.TARGETS[l].bronze > T.TARGETS[T.LEVELS[i - 1]].bronze && T.TARGETS[l].gold > T.TARGETS[T.LEVELS[i - 1]].gold)), 'targets get harder from level to level');

// --- thresholds, streaks, duplicates (use a tiny custom target so it is quick)
const saved = T.TARGETS.grade3;
T.TARGETS.grade3 = { bronze: 5, silver: 3, gold: 3 };
const kid = { trophies: {} };
const names = (won) => won.map(t => t.id).join();
T.record(kid, 'grade3', false);                       // wrong first answer: completed, not correct
ok(kid.trophies.grade3.completed === 1 && kid.trophies.grade3.correct === 0, 'a wrong answer counts as completed but not correct');
T.record(kid, 'grade3', true); T.record(kid, 'grade3', true);
ok(kid.trophies.grade3.streak === 2 && kid.trophies.grade3.best === 2, 'consecutive correct answers build the streak');
T.record(kid, 'grade3', false);
ok(kid.trophies.grade3.streak === 0 && kid.trophies.grade3.best === 2, 'a wrong answer resets the streak but keeps the best run');
ok(kid.trophies.grade3.completed === 4 && kid.trophies.grade3.correct === 2 && kid.trophies.grade3.unlocked.length === 0, 'nothing is unlocked before a target is reached');
ok(names(T.record(kid, 'grade3', true)) === 'bronze,silver' && kid.trophies.grade3.completed === 5 && kid.trophies.grade3.correct === 3, 'bronze (5 completed) and silver (3 correct) unlock exactly at their targets');
ok(T.record(kid, 'grade3', true).length === 0 && kid.trophies.grade3.streak === 2, 'gold is not unlocked before the consecutive target');
ok(names(T.record(kid, 'grade3', true)) === 'gold', 'gold unlocks at the consecutive target');
ok(kid.trophies.grade3.unlocked.slice().sort().join() === 'bronze,gold,silver', 'gold unlocks at the consecutive target');
ok(T.record(kid, 'grade3', true).length === 0 && kid.trophies.grade3.unlocked.length === 3, 'no trophy is awarded twice');
T.record(kid, 'grade3', false);
ok(kid.trophies.grade3.unlocked.length === 3, 'unlocked trophies stay unlocked after wrong answers');
ok(T.resetStreak(kid, 'grade3') === false, 'resetStreak does nothing when there is no run');
T.record(kid, 'grade3', true);
ok(T.resetStreak(kid, 'grade3') === true && kid.trophies.grade3.streak === 0 && kid.trophies.grade3.best >= 4, 'resetStreak ends the run immediately');
const other = { trophies: {} };
T.record(other, 'grade2', true);
ok(!other.trophies.grade3 && other.trophies.grade2.completed === 1 && kid.trophies.grade2 === undefined, 'progress is separate per level and per profile');
ok(T.record(kid, 'not-a-level', true).length === 0 && !kid.trophies['not-a-level'], 'unknown levels are ignored');
const view = T.progressFor({ trophies: {} }, 'grade3');
ok(view.length === 3 && view.every(v => v.value === 0 && !v.unlocked), 'progressFor works for a profile with no progress');
const done = T.progressFor(kid, 'grade3');
ok(done.every(v => v.unlocked && v.value === v.target), 'unlocked trophies show target / target');
T.TARGETS.grade3 = saved;

// --- validation of saved data
const bad = T.cleanAll({ grade3: { completed: -5, correct: 'x', streak: 99, best: 1e12, unlocked: ['gold', 'gold', 'x', 7] }, fake: { completed: 5 }, grade2: 'nope' });
ok(Object.keys(bad).join() === 'grade3', 'unknown levels and non-objects are dropped');
ok(bad.grade3.completed === 0 && bad.grade3.correct === 0 && bad.grade3.streak === 0 && bad.grade3.best === 0, 'negative, non-numeric and inconsistent counters are repaired');
ok(bad.grade3.unlocked.join() === 'gold', 'unlocked ids are filtered and de-duplicated');
ok(JSON.stringify(T.cleanAll(null)) === '{}' && JSON.stringify(T.cleanAll([1, 2])) === '{}', 'missing or invalid trophy data becomes empty');

// --- through the store: separation, persistence, backup, old data
function freshStore(existing) {
  const mem = existing || {};
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem(k, v) { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  delete require.cache[require.resolve(path.join(__dirname, '..', 'public', 'store.js'))];
  return { S: require(path.join(__dirname, '..', 'public', 'store.js')), mem };
}
let { S, mem } = freshStore();
const a = S.addProfile('Mia', '🦊').profile, b = S.addProfile('Leo', '🦁').profile;
ok(JSON.stringify(a.trophies) === '{}', 'a new profile starts with no trophy progress');
T.record(a, 'grade1', true); T.record(a, 'grade1', true); T.record(b, 'grade1', false);
S.save();
({ S, mem } = freshStore(mem));
const [a2, b2] = S.getProfiles();
ok(a2.trophies.grade1.completed === 2 && a2.trophies.grade1.correct === 2 && b2.trophies.grade1.completed === 1 && b2.trophies.grade1.correct === 0, 'progress persists after a reload and stays separate per profile');
ok(JSON.parse(mem['mathQuizBattle.v1']).schema === 2, 'saved data uses schema 2');
const text = S.exportText();
ok(JSON.parse(text).profiles[0].trophies.grade1.completed === 2, 'export includes trophy progress');
({ S } = freshStore());
const imported = S.parseBackup(text);
S.applyBackup(imported, 'replace');
ok(S.getProfiles()[0].trophies.grade1.correct === 2 && S.getProfiles()[1].trophies.grade1.completed === 1, 'import restores trophy progress');
const unlockedBackup = JSON.parse(text); unlockedBackup.profiles[0].trophies.grade1.unlocked = ['bronze'];
({ S } = freshStore());
S.applyBackup(S.parseBackup(JSON.stringify(unlockedBackup)), 'replace');
ok(S.getProfiles()[0].trophies.grade1.unlocked.join() === 'bronze', 'import restores unlocked trophies');

// profiles and backups made before trophies existed (schema 1) still load
const old = freshStore();
old.mem['mathQuizBattle.v1'] = JSON.stringify({ schema: 1, settings: {}, profiles: [{ id: 'old1', name: 'Old', avatar: '🐼', stickers: ['🦄'] }] });
({ S } = freshStore(old.mem));
ok(S.getProfiles()[0].name === 'Old' && S.getProfiles()[0].stickers.length === 1 && JSON.stringify(S.getProfiles()[0].trophies) === '{}', 'schema 1 profiles load with empty trophies and keep their stickers');
const oldBackup = S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [{ id: 'x1', name: 'Zed' }] }));
ok(!oldBackup.error && JSON.stringify(oldBackup.profiles[0].trophies) === '{}', 'a schema 1 backup can still be imported');
old.mem['mathQuizBattle.v1'] = JSON.stringify({ schema: 2, settings: {}, profiles: [{ id: 'p9', name: 'Hurt', trophies: { grade3: { completed: 'lots', unlocked: 'all' }, zzz: 1 } }] });
({ S } = freshStore(old.mem));
ok(S.getProfiles().length === 1 && Object.keys(S.getProfiles()[0].trophies).join() === 'grade3' && S.getProfiles()[0].trophies.grade3.completed === 0, 'invalid saved trophy data is repaired safely');

console.log(failures ? `\n${failures} FAILED` : '\nAll trophy checks passed');
process.exit(failures ? 1 : 0);
