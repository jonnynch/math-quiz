// Unit checks for store.js: saving, schema, backup export/import/undo, validation, save failures. No browser needed.
const path = require('path');
const Parent = require(path.join(__dirname, '..', 'public', 'parent.js')); // sets globalThis.MQParent, which store.js checks
const { solveParent } = require('./parent-solver');
const unlockParent = () => Parent.submit(solveParent(Parent.current().text));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

function freshStore(existing) {
  const mem = existing || {};
  globalThis.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem(k, v) { if (globalThis.__fail || (globalThis.__failKey && k === globalThis.__failKey)) throw new Error('quota'); mem[k] = String(v); },
    removeItem: k => { delete mem[k]; }
  };
  delete require.cache[require.resolve(path.join(__dirname, '..', 'public', 'store.js'))];
  const S = require(path.join(__dirname, '..', 'public', 'store.js'));
  return { S, mem };
}

// --- saving and loading
let { S, mem } = freshStore();
const mia = S.addProfile('Mia', '🦊');
ok(mia.profile && mia.saved === true, 'addProfile reports it was saved');
ok(JSON.parse(mem['mathQuizBattle.v1']).schema === S.SCHEMA, 'saved data carries the schema number');
({ S, mem } = freshStore(mem)); // reload: same storage, new page load
ok(S.getProfiles().length === 1 && S.getProfiles()[0].name === 'Mia', 'profile survives a reload');

// data saved before the schema number existed still loads
const legacy = freshStore();
legacy.mem['mathQuizBattle.v1'] = JSON.stringify({ settings: { palette: 'cb', text: 'large' }, profiles: [{ id: 'old1', name: 'Old', avatar: '🐼' }] });
delete require.cache[require.resolve(path.join(__dirname, '..', 'public', 'store.js'))];
const legacyStore = require(path.join(__dirname, '..', 'public', 'store.js'));
ok(legacyStore.getProfiles()[0].name === 'Old' && legacyStore.getSettings().palette === 'cb', 'data without a schema number still loads');

// --- save failure is reported
({ S } = freshStore());
globalThis.__fail = true;
const failed = S.addProfile('Zed', '🐸');
ok(failed.profile && failed.saved === false && S.isAvailable() === false, 'addProfile reports a failed save (storage full/blocked)');
globalThis.__fail = false;

// --- settings and deletion report failed saves too
({ S, mem } = freshStore());
S.addProfile('Del', '🐸');
const setOk = S.setSetting('text', 'large');
ok(setOk.saved === true && S.getSettings().text === 'large', 'setSetting reports a successful save');
ok(S.setSetting('palette', 'nope').error && S.setSetting('bogus', 'x').error, 'setSetting rejects unknown settings/values');
globalThis.__fail = true;
const setFail = S.setSetting('palette', 'cb');
ok(setFail.saved === false && S.getSettings().palette === 'cb' && S.isAvailable() === false, 'setSetting reports a failed save (the change still applies for this session)');
const delId = S.getProfiles()[0].id;
const delFail = S.deleteProfile(delId);
ok(delFail.deleted === true && delFail.saved === false && S.getProfiles().length === 0, 'deleteProfile reports a failed save');
globalThis.__fail = false;
S.addProfile('Del2', '🐸');
const delOk = S.deleteProfile(S.getProfiles()[0].id);
ok(delOk.deleted === true && delOk.saved === true, 'deleteProfile reports a successful save');
const delNone = S.deleteProfile('does-not-exist');
ok(delNone.deleted === false && delNone.saved === true, 'deleting an unknown id changes nothing and is not an error');

// --- backup parsing
({ S, mem } = freshStore());
S.addProfile('Mia', '🦊'); S.addProfile('Leo', '🦁');
S.getProfiles()[0].stickers.push('🦄', '🚀'); S.getProfiles()[0].totals.games = 5; S.save();
const text = S.exportText();
const parsed = S.parseBackup(text);
ok(!parsed.error && parsed.profiles.length === 2 && parsed.profiles[0].stickers.length === 2, 'export → parse round trip keeps profiles and stickers');
ok(S.parseBackup('').error && S.parseBackup('{bad json').error, 'empty text and invalid JSON are rejected');
ok(S.parseBackup('{"app":"other","profiles":[]}').error.includes('not a Math Quiz'), 'a file from another app is rejected');
ok(S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 99, profiles: [{ name: 'X' }] })).error.includes('newer version'), 'a backup from a newer schema is rejected');
ok(S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [{ name: '' }, 5, null] })).error.includes('no usable'), 'a backup with no valid profiles is rejected');
ok(S.parseBackup('x'.repeat(1000001)).error.includes('too large'), 'oversized input is rejected');
const hostile = S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [
  { id: '../<script>a1', name: '<img src=x onerror=1>LongNameThatIsTooLong', avatar: 'nope', stickers: ['🦄', 'x', '🦄'], totals: { games: -5, correct: 'a' }, history: [{ score: -1, level: 'grade3' }], bests: { 'k': 'z' } },
  { id: '../<script>a1', name: 'Duplicate id' }] }));
const hp = hostile.profiles[0];
ok(hostile.profiles.length === 1 && hostile.skipped === 1, 'duplicate ids inside a backup are dropped');
ok(/^[A-Za-z0-9_-]+$/.test(hp.id) && hp.name.length <= 14 && hp.stickers.length === 1 && hp.totals.games === 0 && S.AVATARS.includes(hp.avatar) && hp.history[0].score === 0 && !('k' in hp.bests), 'ids, names, stickers, numbers and avatars are sanitised');

// --- merge (parent-only, so verify first; protection itself is checked further down)
unlockParent();
const before = S.getProfiles().map(p => p.id);
const incoming = JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [
  { id: before[0], name: 'Mia', totals: { games: 9 }, stickers: ['🐶'] },       // same id → replaced
  { id: 'newid1', name: 'leo', avatar: '🐯' },                                 // same name as Leo, different id → renamed
  { id: 'newid2', name: 'Zoe', avatar: '🐢' }] });
const res = S.applyBackup(S.parseBackup(incoming), 'merge');
ok(res.replaced === 1 && res.added === 2 && res.renamed === 1 && res.saved === true, 'merge: replaced 1, added 2, renamed 1: ' + JSON.stringify(res));
ok(S.getProfiles().find(p => p.id === before[0]).totals.games === 9, 'merge: same id takes the backup version');
ok(new Set(S.getProfiles().map(p => p.name.toLowerCase())).size === S.getProfiles().length, 'merge: names stay unique');
ok(S.getProfiles().find(p => p.id === 'newid1').name === 'leo (2)', 'merge: duplicate name renamed to "leo (2)"');

// --- merge respects the profile limit
const many = { app: 'mathQuizBattle', schema: 1, profiles: Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, name: 'Kid' + i })) };
const r2 = S.applyBackup(S.parseBackup(JSON.stringify(many)), 'merge');
ok(S.getProfiles().length === S.MAX_PROFILES && r2.skipped > 0, `merge: stops at ${S.MAX_PROFILES} profiles and reports skipped (${r2.skipped})`);

// --- replace + undo
const idsBefore = S.getProfiles().map(p => p.id).join();
const r3 = S.applyBackup(S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, settings: { palette: 'cb', text: 'xlarge' }, profiles: [{ id: 'only1', name: 'Only' }] })), 'replace');
ok(S.getProfiles().length === 1 && S.getSettings().text === 'xlarge' && r3.backedUp, 'replace: backup becomes everything (settings too) and a safety copy is kept');
ok(S.hasBackup() && S.restoreBackup().restored === true && S.getProfiles().map(p => p.id).join() === idsBefore && !S.hasBackup(), 'undo: previous profiles are restored');

// --- failure while importing is reported
globalThis.__fail = true;
const r4 = S.applyBackup(S.parseBackup(text), 'merge');
ok(r4.saved === false && r4.backedUp === false, 'import reports when the browser would not save');
globalThis.__fail = false;
Parent.lock();

// --- backup import and Undo need parent verification, inside the Store itself
{
  ({ S, mem } = freshStore());
  S.addProfile('Mia', '🦊'); S.addProfile('Leo', '🦁');
  const mia = S.getProfiles()[0];
  mia.rewards.earned = 30; mia.rewards.redeemed = 10; S.save();
  // exportedAt is a timestamp, so compare exports without it (otherwise the check fails whenever a millisecond ticks over)
  const sameExport = (a, b) => JSON.stringify({ ...JSON.parse(a), exportedAt: 0 }) === JSON.stringify({ ...JSON.parse(b), exportedAt: 0 });
  const goodText = S.exportText();                    // export needs no verification
  const incoming = JSON.parse(goodText);
  incoming.profiles[0].rewards.earned = 999;          // a backup that would inflate the balance
  incoming.settings.rewards = { ...S.getRewardConfig(), base: 5 };
  const incomingText = JSON.stringify(incoming);
  const snapshot = () => JSON.stringify([S.getProfiles(), S.getSettings(), mem['mathQuizBattle.v1'], S.hasBackup()]);

  Parent.lock();
  const start = snapshot();
  ok(!Parent.isUnlocked() && sameExport(S.exportText(), goodText) && !S.parseBackup(incomingText).error, 'locked: export and backup preview still work without verification');
  const parsedIn = S.parseBackup(incomingText);
  const dm = S.applyBackup(parsedIn, 'merge');
  ok(dm.denied === true && dm.saved === false && /Parent verification/.test(dm.error) && snapshot() === start, 'Merge import is denied without verification and changes nothing');
  const dr = S.applyBackup(parsedIn, 'replace');
  ok(dr.denied === true && snapshot() === start, 'Replace import is denied without verification and changes nothing (no Undo copy written either)');
  ok(S.applyBackup(parsedIn).denied === true && S.applyBackup(null, 'replace').denied === true, 'direct Store calls with any arguments cannot bypass verification');

  // a wrong answer does not unlock
  const wrongAnswer = '-1'; // never correct: x is positive and a probability cannot be negative (a fixed guess like '1' can be right)
  Parent.submit(wrongAnswer);
  ok(S.applyBackup(parsedIn, 'merge').denied === true && snapshot() === start, 'a wrong verification answer still cannot import');
  // without the parent module nothing is allowed (fails closed)
  const saved = globalThis.MQParent; delete globalThis.MQParent;
  ok(S.applyBackup(parsedIn, 'merge').denied === true && S.restoreBackup().denied === true && snapshot() === start, 'with no parent module loaded, import and Undo are refused');
  globalThis.MQParent = saved;
  // tampering with a leftover Undo copy is also blocked: build one while verified, then lock
  unlockParent();
  ok(S.applyBackup(parsedIn, 'merge').saved === true && S.getProfiles()[0].rewards.earned === 999 && S.hasBackup(), 'after verification Merge import works');
  Parent.lock();
  const afterMerge = snapshot();
  const du = S.restoreBackup();
  ok(du.denied === true && du.restored === false && snapshot() === afterMerge && S.hasBackup(), 'Undo import is denied without verification, keeps the Undo copy and changes nothing');
  ok(S.restoreBackup().denied === true && S.getProfiles()[0].rewards.earned === 999, 'a direct Undo call cannot restore older balances without verification');
  unlockParent();
  ok(S.restoreBackup().restored === true && S.getProfiles()[0].rewards.earned === 30 && !S.hasBackup(), 'after verification Undo import works and restores the earlier balance');
  // Undo recovery: the Undo copy is deleted only after the restored data is saved.
  unlockParent();
  ok(S.applyBackup(parsedIn, 'merge').saved === true && S.hasBackup() && S.getProfiles()[0].rewards.earned === 999, 'undo setup: Merge import made an Undo copy');
  const afterImport = snapshot();
  globalThis.__fail = true;
  const failedUndo = S.restoreBackup();
  globalThis.__fail = false;
  ok(failedUndo.restored === false && failedUndo.saved === false && !!failedUndo.error && S.hasBackup(), 'failed save: Undo reports failure and keeps the Undo copy');
  ok(snapshot() === afterImport, 'failed save: the data in use is unchanged');
  const retryUndo = S.restoreBackup();
  ok(retryUndo.restored === true && retryUndo.saved === true && !S.hasBackup() && S.getProfiles()[0].rewards.earned === 30, 'retry after a failed save restores the earlier data and removes the Undo copy');
  ok(freshStore(mem).S.getProfiles()[0].rewards.earned === 30, 'the restored data is what is stored');
  Parent.lock();
  ok(S.applyBackup(parsedIn, 'merge').denied === true, 'locking again blocks import again');
  unlockParent();
  const rep = S.applyBackup(S.parseBackup(incomingText), 'replace');
  ok(rep.saved === true && rep.added === 2 && S.getRewardConfig().base === 5, 'after verification Replace import works (profiles and reward settings)');
  Parent.lock();
}

// --- stickers
{
  const ORIGINAL = ['🦄', '🐶', '🐱', '🐼', '🦊', '🐸', '🐙', '🦋', '🐢', '🦁', '🐯', '🐵',
    '🚀', '🚁', '🚂', '🏆', '🎈', '🌈', '🍦', '🍕', '🎨', '⚽', '🎸', '🌟'];
  const st = freshStore();
  ok(ORIGINAL.every((s, i) => st.S.STICKERS[i] === s), 'original 24 stickers keep their identity and order');
  ok(new Set(st.S.STICKERS).size === st.S.STICKERS.length, 'no duplicate stickers');
  ok(st.S.STICKERS.length >= 44, 'sticker collection has grown: ' + st.S.STICKERS.length);
  ok(st.S.STICKERS.every(s => /^\p{Extended_Pictographic}\u{FE0F}?$/u.test(s)), 'every sticker is a single emoji');
  const kid = st.S.addProfile('Stick', '🦊').profile;
  kid.stickers = [...st.S.STICKERS]; st.S.save();
  const again = freshStore(st.mem);
  ok(again.S.getProfiles()[0].stickers.length === st.S.STICKERS.length, 'every sticker (old and new) survives save and reload');
  const old = freshStore();
  old.mem['mathQuizBattle.v1'] = JSON.stringify({ schema: 1, profiles: [{ id: 'o1', name: 'Old', stickers: ['🦄', '🚀', '❌'] }] });
  const oldLoaded = freshStore(old.mem);
  ok(oldLoaded.S.getProfiles()[0].stickers.join() === '🦄,🚀', 'previously earned stickers stay intact; unknown ones are dropped');
}
// --- screen-time reward bank
{
  const rs = freshStore();
  const R = rs.S;
  Parent.lock();
  const kid = R.addProfile('Kid', '🐼').profile;
  const cfg = R.getRewardConfig();
  ok(cfg.base === 0.1 && cfg.minAccuracy === 80 && cfg.minBatch === 20 && cfg.accuracy.join() === '1,1.2,1.4,1.5' && cfg.grades.join() === '1,1.1,1.2,1.3,1.4,1.5', 'reward defaults match the specification');
  const mins = (g, n, c) => R.calcReward(g, n, c).minutes;
  ok(mins(3, 50, 45) === 6, 'worked example: Grade 3, 45 of 50 correct = 6 minutes (6.48 rounded down)');
  ok(mins(1, 100, 79) === 0 && mins(1, 100, 80) === 8 && mins(1, 100, 89) === 8, 'under 80% earns nothing; 80-89% x1.0');
  ok(mins(1, 100, 90) === 10 && mins(1, 100, 94) === 11, '90-94% x1.2');
  ok(mins(1, 100, 95) === 13 && mins(1, 100, 99) === 13, '95-99% x1.4');
  ok(mins(1, 100, 100) === 15, '100% x1.5');
  ok([1, 2, 3, 4, 5, 6].map(g => mins(g, 100, 100)).join() === '15,16,18,19,21,22', 'difficulty multipliers rise from Grade 1 to Grade 6');
  ok(mins(0, 50, 50) === 0 && mins(7, 50, 50) === 0 && mins('age5', 50, 50) === 0, 'only Grade 1-6 can earn');
  ok(R.rewardAnswer(kid, 's0', 'age5', true) === false && R.rewardAnswer(kid, 's0', 0, true) === false && !kid.rewards.session, 'age levels never start reward progress');

  const answer = (id, grade, n, right) => { for (let i = 0; i < n; i++) R.rewardAnswer(kid, id, grade, i < right); };
  answer('s1', 3, 12, 11);
  let res = R.settleRewards(kid, 's1');
  ok(res.settled && !res.batch && res.pending.completed === 12 && R.rewardBalance(kid) === 0 && kid.rewards.earnTx.length === 0, 'a short session earns nothing yet; its progress is carried forward');
  answer('s2', 4, 5, 5); R.settleRewards(kid, 's2');
  ok(kid.rewards.pending[3].completed === 12 && kid.rewards.pending[4].completed === 5, 'different grades are never combined');
  answer('s3', 3, 10, 10);
  res = R.settleRewards(kid, 's3');
  ok(res.batch && res.batch.completed === 22 && res.batch.correct === 21 && res.batch.minutes === 3 && R.rewardBalance(kid) === 3 && !kid.rewards.pending[3], 'carried progress joins the next session at the same grade and pays as one batch (21 of 22 = 3 min)');
  const before = JSON.stringify(kid.rewards);
  ok(R.settleRewards(kid, 's3').settled === false && JSON.stringify(kid.rewards) === before, 'settling the same session twice adds nothing');
  ok(R.rewardAnswer(kid, 's3', 3, true) === false, 'a settled session cannot receive more answers');
  answer('s4', 5, 20, 15); res = R.settleRewards(kid, 's4');
  ok(res.batch && res.batch.minutes === 0 && kid.rewards.earnTx[0].minutes === 0 && !kid.rewards.pending[5] && R.rewardBalance(kid) === 3, 'a batch under 80% earns 0 and is used up');

  answer('s5', 6, 20, 20); // the page is closed before the game ends
  const R2 = freshStore(rs.mem).S;
  const k2 = R2.getProfiles()[0];
  ok(R2.rewardBalance(k2) === 7 && !k2.rewards.session, 'progress is saved after every answer; a session left by a closed page is settled on the next load');
  Parent.lock();
  ok(R2.redeem(k2, 1).denied === true && k2.rewards.redeemed === 0 && R2.setRewardConfig({ base: 9 }).denied === true && R2.resetRewardConfig().denied === true && R2.getRewardConfig().base === 0.1, 'redeem, settings changes and reset are refused without parent verification (direct calls)');
  ok(R2.rewardBalance(k2) === 7 && Array.isArray(R2.rewardProgress(k2)) && R2.getRewardConfig().minBatch === 20, 'balance and progress can still be viewed while locked');
  unlockParent();
  ok(R2.redeem(k2, 8).error && R2.redeem(k2, 0).error && R2.redeem(k2, 1.5).error && R2.redeem(k2, -1).error && R2.rewardBalance(k2) === 7, 'redemption cannot overdraw the balance or take bad amounts');
  const rd = R2.redeem(k2, 5);
  ok(rd.redeemed === 5 && rd.saved && R2.rewardBalance(k2) === 2 && k2.rewards.earned === 7 && k2.rewards.redeemed === 5 && k2.rewards.redeemTx.length === 1, 'redeeming lowers the balance and is recorded');
  R2.addProfile('Sib', '🦊');
  const sib = R2.getProfiles()[1];
  R2.rewardAnswer(sib, 'x1', 2, true); R2.settleRewards(sib, 'x1');
  ok(R2.rewardBalance(sib) === 0 && R2.rewardBalance(k2) === 2 && sib.rewards.pending[2].completed === 1, 'each profile has its own balance and progress');

  const backup = R2.parseBackup(R2.exportText());
  ok(backup.profiles[0].rewards.earned === 7 && backup.profiles[0].rewards.redeemed === 5 && backup.profiles[0].rewards.earnTx.length === 3 && backup.settings.rewards.minBatch === 20, 'export/import keeps balances, history and reward settings');
  const bad = R2.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, settings: { rewards: { base: -5, minBatch: 'x', grades: 'no' } }, profiles: [
    { id: 'c1', name: 'Bad', rewards: { earned: 5, redeemed: 99, pending: { 3: { completed: -4 }, 9: { completed: 5 } }, earnTx: 'x', session: { grade: 99 } } },
    { id: 'c2', name: 'Junk', rewards: 'junk' }] }));
  const [b1, b2] = bad.profiles;
  ok(b1.rewards.redeemed === 5 && R2.rewardBalance(b1) === 0 && !Object.keys(b1.rewards.pending).length && !b1.rewards.session && b1.rewards.earnTx.length === 0 && b2.rewards.earned === 0, 'corrupted reward data is repaired safely');
  ok(bad.settings.rewards.base === 0.1 && bad.settings.rewards.minBatch === 20 && bad.settings.rewards.grades.length === 6, 'corrupted reward settings fall back to defaults');

  const set = R2.setRewardConfig({ base: 0.5, minBatch: 5, grades: [1, 1, 1, 1, 1, 2] });
  ok(set.saved && freshStore(rs.mem).S.getRewardConfig().base === 0.5 && R2.calcReward(6, 10, 10).minutes === 15, 'parent settings are saved and used in the calculation');
  ok(R2.setRewardConfig({ base: -1 }).config.base === 0.1 && R2.resetRewardConfig().config.minBatch === 20, 'invalid values fall back to defaults; reset restores them');

  // Regression: reset must not report success when localStorage refuses the write, and must keep the old settings.
  R2.setRewardConfig({ base: 0.5, minBatch: 5 });
  globalThis.__fail = true;
  const failedReset = R2.resetRewardConfig();
  globalThis.__fail = false;
  ok(failedReset.saved === false && R2.getRewardConfig().base === 0.5 && R2.getRewardConfig().minBatch === 5, 'reset reports a failed save and keeps the existing settings');
  ok(R2.resetRewardConfig().saved === true && R2.getRewardConfig().minBatch === 20, 'reset works again once saving succeeds');

  // Reward progress save failures are reported and never double-count.
  const okAns = R2.rewardAnswer(k2, 'f1', 3, true);
  ok(okAns.counted === true && okAns.saved === true && k2.rewards.session.completed === 1, 'successful reward save is reported as counted and saved');
  const rBefore = JSON.stringify(k2.rewards);
  globalThis.__fail = true;
  const badAns = R2.rewardAnswer(k2, 'f1', 3, true);
  const badAns2 = R2.rewardAnswer(k2, 'f1', 3, true); // a retry of the same answer
  globalThis.__fail = false;
  ok(badAns.saved === false && badAns.counted === false && badAns2.saved === false, 'failed reward save is reported to the caller');
  ok(JSON.stringify(k2.rewards) === rBefore, 'failed reward saves leave progress unchanged (no double counting on retry)');
  ok(R2.rewardAnswer(k2, 'f1', 3, true).saved === true && k2.rewards.session.completed === 2, 'after saving works again the answer counts once');
  globalThis.__fail = true;
  const staleFail = R2.rewardAnswer(k2, 'f2', 4, true); // would close session f1 first
  globalThis.__fail = false;
  ok(staleFail.saved === false && JSON.stringify(k2.rewards.session) === JSON.stringify({ id: 'f1', grade: 3, completed: 2, correct: 2 }) && !k2.rewards.pending[3], 'a failed save also undoes closing the previous session');
  Parent.lock();
}

// --- transactional import and reward settlement (save failures roll everything back)
{
  const MAIN = 'mathQuizBattle.v1';
  const BACKUP_KEY = 'mathQuizBattle.backup'; // must match BACKUP_KEY in store.js

  const setup = () => {
    const f = freshStore();
    f.S.addProfile('Mia', '🦊');
    const other = freshStore();
    other.S.addProfile('Zoe', '🐼');
    const parsed = f.S.parseBackup(other.S.exportText());
    unlockParent();
    return { ...f, parsed, state: () => JSON.stringify([f.S.getProfiles(), f.S.getSettings(), f.mem[MAIN], f.mem[BACKUP_KEY] || null]) };
  };

  // Import aborted when the Undo copy cannot be created
  for (const mode of ['merge', 'replace']) {
    const t = setup();
    const start = t.state();
    globalThis.__failKey = BACKUP_KEY;
    const res = t.S.applyBackup(t.parsed, mode);
    globalThis.__failKey = null;
    ok(res.imported === false && res.saved === false && res.backedUp === false && !!res.error && t.state() === start && !t.S.hasBackup(), `${mode}: import is aborted when the Undo copy cannot be made (nothing changed)`);
  }

  // Import save failure restores the original data and the previous Undo copy
  for (const mode of ['merge', 'replace']) {
    const t = setup();
    t.S.applyBackup(t.S.parseBackup(t.S.exportText()), 'merge'); // leaves an earlier Undo copy
    const profilesRef = t.S.getProfiles();
    const first = profilesRef[0];
    const start = t.state();
    unlockParent();
    globalThis.__failKey = MAIN;
    const res = t.S.applyBackup(t.parsed, mode);
    globalThis.__failKey = null;
    ok(res.imported === false && res.saved === false && !!res.error && res.added === 0, `${mode}: a failed save is reported with an error`);
    ok(t.state() === start && t.S.getProfiles() === profilesRef && t.S.getProfiles()[0] === first, `${mode}: a failed save restores the original data and the earlier Undo copy`);
  }
  {
    const t = setup();
    globalThis.__failKey = MAIN;
    t.S.applyBackup(t.parsed, 'merge');
    globalThis.__failKey = null;
    ok(!t.S.hasBackup() && t.S.getProfiles().length === 1, 'a failed first import leaves no Undo copy behind');
    unlockParent();
    const retry = t.S.applyBackup(t.parsed, 'merge');
    ok(retry.imported === true && retry.saved === true && retry.added === 1 && t.S.getProfiles().length === 2, 'retrying the import after a failed save works once');
  }

  // Successful import and Undo still work
  {
    const t = setup();
    const res = t.S.applyBackup(t.parsed, 'replace');
    ok(res.imported === true && res.saved === true && res.backedUp === true && t.S.hasBackup() && t.S.getProfiles().map(p => p.name).join() === 'Zoe', 'successful Replace import keeps the Undo copy');
    unlockParent();
    const undo = t.S.restoreBackup();
    ok(undo.restored === true && !t.S.hasBackup() && t.S.getProfiles().map(p => p.name).join() === 'Mia', 'Undo after a successful import restores the original profiles');
  }

  // Reward settlement is transactional
  const rewardSetup = () => {
    const f = freshStore();
    f.S.addProfile('Kid', '🐼');
    const kid = f.S.getProfiles()[0];
    for (let i = 0; i < 20; i++) f.S.rewardAnswer(kid, 'tx1', 3, true);
    return { ...f, kid };
  };
  {
    const t = rewardSetup();
    const before = JSON.stringify(t.kid.rewards);
    globalThis.__failKey = MAIN;
    const res = t.S.settleRewards(t.kid, 'tx1');
    globalThis.__failKey = null;
    ok(res.settled === false && res.saved === false && !!res.error && !res.batch, 'failed reward save returns a failure result with no payout');
    ok(JSON.stringify(t.kid.rewards) === before && t.kid.rewards.earned === 0 && !t.kid.rewards.settled.includes('tx1') && t.kid.rewards.session.completed === 20 && !t.kid.rewards.pending[3], 'failed reward save restores earned minutes, pending progress, session and settled list');
    const retry = t.S.settleRewards(t.kid, 'tx1');
    ok(retry.settled === true && retry.saved === true && retry.batch && retry.batch.minutes === 3 && t.kid.rewards.earned === 3 && t.kid.rewards.earnTx.length === 1, 'successful reward settlement pays once (retry after failure)');
    ok(t.S.settleRewards(t.kid, 'tx1').settled === false && t.kid.rewards.earned === 3 && t.kid.rewards.earnTx.length === 1, 'settling again does not duplicate the reward or count the session twice');
    ok(freshStore(t.mem).S.getProfiles()[0].rewards.earned === 3, 'the paid reward is what is stored');
  }
  {
    const t = rewardSetup();
    globalThis.__failKey = MAIN;
    t.S.settleRewards(t.kid, 'tx1');
    t.S.settleRewards(t.kid, 'tx1'); // repeated failed attempts change nothing either
    globalThis.__failKey = null;
    const reloaded = freshStore(t.mem).S.getProfiles()[0];
    ok(reloaded.rewards.earned === 3 && reloaded.rewards.earnTx.length === 1 && !reloaded.rewards.session, 'after failed attempts a reload settles the saved session exactly once');
  }
  Parent.lock();
}

// --- default question type: saved choices are kept, missing ones fall back to Mixed All Questions
{
  const { S: S2 } = freshStore();
  const raw = (lastSetup, history) => ({ app: 'mathQuizBattle', schema: 1, profiles: [{ id: 'p1', name: 'Kit', lastSetup, history }] });
  const parse = (lastSetup, history) => S2.parseBackup(JSON.stringify(raw(lastSetup, history))).profiles[0];
  ok(parse({ difficulty: 'grade3', topic: 'mixed' }).lastSetup.topic === 'mixed', 'saved Mixed arithmetic preference is preserved');
  ok(parse({ difficulty: 'grade3', topic: 'tables' }).lastSetup.topic === 'tables', 'saved Times tables preference is preserved');
  ok(parse({ difficulty: 'grade3' }).lastSetup.topic === 'all', 'saved setup without a topic defaults to Mixed All Questions');
  ok(parse(undefined).lastSetup === null, 'older profile without a saved setup stays without one (UI default applies)');
  ok(parse(undefined, [{ level: 'grade3', score: 4 }]).history[0].topic === 'mixed', 'older history entries without a topic keep their original meaning (Mixed arithmetic)');
  S2.addProfile('Zoe', '🦊');
  S2.getProfiles()[0].lastSetup = { difficulty: 'grade2', topic: 'mixed' }; S2.save();
  const back = S2.parseBackup(S2.exportText()).profiles[0];
  ok(back.lastSetup.topic === 'mixed' && back.lastSetup.difficulty === 'grade2', 'export then import keeps the saved question type');
  ok(S2.addProfile('Neo', '🐸').profile.lastSetup === null, 'a new profile has no saved setup, so the Mixed All Questions default applies');
}

console.log(failures ? `\n${failures} FAILED` : '\nAll store checks passed');
process.exit(failures ? 1 : 0);
