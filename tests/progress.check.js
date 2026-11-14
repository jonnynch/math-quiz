// Achievements, screen-time rewards and stickers: Mixed All Questions eligibility, 80% accuracy, required batch,
// no duplicate rewards, and the larger sticker collection (old profiles stay valid). No browser needed.
const path = require('path');
const pub = (f) => path.join(__dirname, '..', 'public', f);
const Q = require(pub('questions.js'));
const T = require(pub('trophies.js'));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

function freshStore(mem = {}) {
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  delete require.cache[require.resolve(pub('store.js'))];
  return { S: require(pub('store.js')), mem };
}

// ---- eligibility rule: Grade 1-6 progress only counts in Mixed All Questions
ok(Q.countsForProgress('grade3', 'all') === true, 'Grade 3 Mixed All Questions counts');
ok(['mixed', 'add', 'sub', 'tables', 'fractions', 'money', 'clock', 'shapes', 'mul', 'div'].every(t => Q.countsForProgress('grade4', t) === false), 'Grade 1-6 single topics do not count');
ok(Q.countsForProgress('age5', 'all') === true && Q.countsForProgress('toddler', undefined) === true, 'age levels have no topics, so their achievements still count');

// ---- achievements (Mixed All): progress, unlocks, saving
{
  const { S, mem } = freshStore();
  const kid = S.addProfile('Kid', '🦊').profile;
  const level = 'grade2', target = T.TARGETS[level];
  let unlockedAt = {};
  for (let i = 1; i <= target.bronze; i++) {
    const won = T.record(kid, level, i % 10 !== 0);              // every 10th answer wrong
    won.forEach(t => { unlockedAt[t.id] = i; });
  }
  ok(kid.trophies[level].completed === target.bronze, 'achievement progress counts each completed question once');
  ok(unlockedAt.bronze === target.bronze && kid.trophies[level].unlocked.includes('bronze'), 'bronze unlocks exactly at its target');
  ok(kid.trophies[level].correct === target.bronze - Math.floor(target.bronze / 10) && kid.trophies[level].streak <= 9, 'correct and streak follow first answers; a wrong answer restarts the streak');
  S.save();
  const reloaded = freshStore(mem).S.getProfiles()[0];
  const norm = (x) => JSON.stringify({ ...x, unlocked: [...x.unlocked].sort() });
  ok(norm(reloaded.trophies[level]) === norm(kid.trophies[level]), 'progress and unlocks are saved and reload unchanged');
}

// ---- screen time: 80% accuracy, required batch, per grade, no duplicates
{
  const { S } = freshStore();
  const Parent = require(pub('parent.js')); const { solveParent } = require('./parent-solver');
  Parent.submit(solveParent(Parent.current().text)); S.setRewardConfig({ minBatch: 20, minAccuracy: 80 }); Parent.lock();
  const kid = S.addProfile('Kid', '🦊').profile;
  const play = (id, grade, n, right) => { for (let i = 0; i < n; i++) S.rewardAnswer(kid, id, grade, i < right); return S.settleRewards(kid, id); };

  let r = play('a', 3, 19, 19);
  ok(r.batch === null && kid.rewards.earned === 0 && kid.rewards.pending[3].completed === 19, 'less than the required 20 questions pays nothing and carries forward');
  r = play('b', 3, 1, 1);
  ok(r.batch && r.batch.completed === 20 && kid.rewards.earned > 0, 'the required number of questions completes the batch and pays');
  const afterPay = kid.rewards.earned;
  ok(S.settleRewards(kid, 'b').settled === false && kid.rewards.earned === afterPay, 'settling the same game again does not pay twice');
  ok(S.rewardAnswer(kid, 'b', 3, true) === false, 'a settled game cannot add more answers');

  r = play('c', 3, 20, 15);
  ok(r.batch && r.batch.minutes === 0 && kid.rewards.earned === afterPay, '75% accuracy earns no screen time');
  r = play('d', 3, 20, 16);
  ok(r.batch && r.batch.minutes > 0 && kid.rewards.earned > afterPay, 'exactly 80% accuracy earns screen time');
  ok(S.rewardAnswer(kid, 'e', 'age5', true) === false && S.rewardAnswer(null, 'e', 3, true) === false, 'age levels and guests never earn');
}

// ---- stickers: new ones are appended, distinct, and old data stays valid
{
  const { S, mem } = freshStore();
  const list = S.STICKERS;
  ok(new Set(list).size === list.length, 'no duplicate stickers in the collection (' + list.length + ')');
  ok(list.length >= 131 && list.slice(0, 5).join('') === '🦄🐶🐱🐼🦊', 'collection grew and the original stickers keep their place');
  const added = ['🐳', '🦈', '🚌', '🏀', '🎹', '🧩', '🪐', '🔭'];
  ok(added.every(s => list.includes(s) && list.indexOf(s) >= 100), 'new stickers are appended after the previous 100');
  ok(list.every(s => !/[\uFE0E\uFE0F]/.test(s)), 'stickers are plain emoji without variation selectors (same format as before)');
  // an existing profile saved with only old stickers loads unchanged and can still collect the new ones
  const old = list.slice(0, 100);
  mem['mathQuizBattle.v1'] = JSON.stringify({ schema: 2, settings: {}, profiles: [{ id: 'old', name: 'Old', avatar: '🐼', stickers: [...old, '🧿'] }] });
  const S2 = freshStore(mem).S, p = S2.getProfiles()[0];
  ok(p.stickers.length === 100 && old.every(s => p.stickers.includes(s)), 'a saved profile keeps its stickers; unknown ones are dropped as before');
  const missing = S2.STICKERS.filter(s => !p.stickers.includes(s));
  ok(missing.length === list.length - 100 && added.every(s => missing.includes(s)), 'the new stickers are available to unlock for that profile');
  p.stickers.push(added[0]); S2.save();
  ok(freshStore(mem).S.getProfiles()[0].stickers.includes(added[0]), 'a newly unlocked sticker is saved and reloaded');
}

console.log(failures ? failures + ' FAILED' : 'all progress checks passed');
process.exit(failures ? 1 : 0);
