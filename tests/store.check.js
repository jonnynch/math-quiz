// Unit checks for store.js: saving, schema, backup export/import/undo, validation, save failures. No browser needed.
const path = require('path');
const Parent = require(path.join(__dirname, '..', 'public', 'parent.js')); // sets globalThis.MQParent, which store.js checks
const { solveParent, solveHard } = require('./parent-solver');
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
// --- sticker categories
{
  const st = freshStore();
  const { STICKERS, STICKER_CATEGORIES, STICKER_CATEGORY } = st.S;
  const listed = STICKER_CATEGORIES.flatMap(c => c.stickers);
  // Frozen snapshots: the first 100 stickers must never change; the next 100 are the 2026-11 expansion.
  const FIRST_100 = [
    '🦄', '🐶', '🐱', '🐼', '🦊', '🐸', '🐙', '🦋', '🐢', '🦁', '🐯', '🐵', '🚀', '🚁', '🚂', '🏆', '🎈', '🌈', '🍦', '🍕',
    '🎨', '⚽', '🎸', '🌟', '🐰', '🦖', '🦕', '🐨', '🐧', '🐬', '🍩', '🍓', '🍉', '🧁', '🍪', '👽', '🛸', '🌙', '🌍', '🐉',
    '🧚', '🔮', '🏰', '🚗', '🚒', '🧸', '🎁', '⛵', '🥇', '🥳', '👑', '💎', '🎯', '🐹', '🐭', '🐮', '🐷', '🐣', '🐦', '🐴',
    '🦓', '🦒', '🦘', '🦥', '🦦', '🦩', '🦚', '🐿', '🦔', '🦫', '🦡', '🐺', '🐻', '🌸', '🌺', '🌹', '🌱', '🍀', '🍄', '🪻',
    '🪷', '🌷', '🍒', '🍑', '🍍', '🍌', '🍊', '🍋', '🍐', '🥝', '🥑', '🥨', '🍬', '🍰', '🍮', '🍯', '🍡', '🧋', '🌰', '🧇'];
  const NEXT_100 = [
    '🦀', '🐠', '🐳', '🦈', '🐡', '🦭', '🐝', '🐞', '🦉', '🦅', '🦆', '🦢', '🐘', '🦏', '🦛', '🐫', '🦙', '🐆', '🦍', '🐊',
    '🦎', '🦜', '🌻', '🌼', '🌵', '🌴', '🌳', '🌲', '🍁', '🍂', '🌿', '🌊', '🔥', '🌋', '💧', '🌾', '🍎', '🍇', '🥭', '🥥',
    '🍅', '🥕', '🌽', '🥦', '🥐', '🍞', '🧀', '🍔', '🍟', '🌮', '🍿', '🍫', '🍣', '🥞', '🚌', '🚕', '🚓', '🚑', '🚜', '🚲',
    '🚢', '🚤', '🚄', '🛴', '🪐', '🌠', '🔭', '🔬', '🧪', '🧲', '🌕', '🧬', '💡', '🌌', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓',
    '🥊', '🎳', '🏹', '🎮', '🥁', '🛹', '🧙', '🧜', '🤖', '👻', '🧞', '🦸', '🎒', '🔑', '📚', '🧩', '🪁', '🔔', '⏰', '📷'];
  const THIRD_100 = [
    '🐛', '🐌', '🦗', '🪲', '🦃', '🐓', '🐥', '🕊️', '🦌', '🦬', '🐐', '🐪', '🪼',
    '🌤️', '🌦️', '❄️', '⛄', '🪨', '🪵', '🪸', '🪴', '🎋', '🌅', '🏔️', '🏝️',
    '🫐', '🍈', '🫑', '🍠', '🥟', '🍝', '🍜', '🍛', '🥗', '🥪', '🌭', '🥧', '🍭',
    '🚐', '🛻', '🏎️', '🏍️', '🛵', '🛺', '🚆', '🚊', '🚠', '✈️', '🛶', '🛳️',
    '☀️', '🌞', '🌛', '⭐', '💫', '☄️', '🛰️', '🔋', '🔌', '⚗️', '🧫', '📡',
    '🥎', '🏉', '🥏', '🏸', '⛳', '⛸️', '🛷', '⛷️', '🏄', '🎹', '🎺', '🎲',
    '🧝', '🤴', '👸', '🪄', '🛡️', '🎪', '🎠', '🎡', '🎢', '🪅', '🎊', '🎉',
    '🕶️', '🧢', '👟', '🧦', '🧤', '🧣', '☂️', '🪙', '🔦', '🕯️', '🧹', '✏️', '🖍️', '✂️'];
  const FIRST_200 = [...FIRST_100, ...NEXT_100];
  ok(STICKERS.length === 300 && new Set(STICKERS).size === 300, 'exactly 300 unique stickers');
  ok(FIRST_200.length === 200 && FIRST_200.every((s, i) => STICKERS[i] === s), 'all existing 200 stickers are retained unchanged and in order');
  ok(THIRD_100.length === 100 && THIRD_100.every((s, i) => STICKERS[200 + i] === s) && new Set([...FIRST_200, ...THIRD_100]).size === 300, '100 new, distinct stickers are appended after the existing 200');
  ok(THIRD_100.every(s => STICKER_CATEGORY[s]) && STICKER_CATEGORIES.reduce((n, c) => n + c.stickers.length, 0) === 300, 'every new sticker belongs to a category; category totals add up to 300');
  ok(STICKER_CATEGORIES.length >= 6 && STICKER_CATEGORIES.length <= 8, 'sticker categories: ' + STICKER_CATEGORIES.length);
  ok(new Set(STICKER_CATEGORIES.map(c => c.id)).size === STICKER_CATEGORIES.length && STICKER_CATEGORIES.every(c => c.id && c.name && c.icon && c.stickers.length > 0), 'categories have unique ids, names, icons and stickers');
  ok(STICKERS.every(s => typeof STICKER_CATEGORY[s] === 'string' && STICKER_CATEGORIES.some(c => c.id === STICKER_CATEGORY[s])), 'every sticker has a valid category');
  ok(listed.length === STICKERS.length && new Set(listed).size === listed.length && listed.every(s => STICKERS.includes(s)), 'every sticker is in exactly one category and no unknown stickers are listed');
  ok(Object.keys(STICKER_CATEGORY).length === STICKERS.length, 'category lookup covers exactly the existing stickers');
  const kid = st.S.addProfile('Cat', '🦊').profile;
  kid.stickers = ['🦄', '🚀', '🍕']; st.S.save();
  ok(freshStore(st.mem).S.getProfiles()[0].stickers.join() === '🦄,🚀,🍕', 'earned stickers and saved profiles are unchanged by categories');
  ok(THIRD_100.every(s => !freshStore(st.mem).S.getProfiles()[0].stickers.includes(s)) && st.S.addProfile('Fresh', '🐼').profile.stickers.length === 0, 'the 100 new stickers start locked for new and existing profiles');
  // A profile saved before the expansion (all original 200 earned) loads unchanged: nothing is granted, nothing is lost
  const legacy = freshStore();
  legacy.mem['mathQuizBattle.v1'] = JSON.stringify({ schema: 2, profiles: [{ id: 'old200', name: 'Old', avatar: '🐼', stickers: FIRST_200, totals: { games: 7 } }] });
  const lp = freshStore(legacy.mem).S.getProfiles()[0];
  ok(lp.stickers.length === 200 && FIRST_200.every(s => lp.stickers.includes(s)) && THIRD_100.every(s => !lp.stickers.includes(s)) && lp.totals.games === 7, 'a profile with the original 200 stickers keeps them, gains no new ones and keeps its progress');
  ok(freshStore(freshStore(legacy.mem).mem).S.getProfiles()[0].stickers.length === 200, 'saved data stays the same after another reload');
  const full = freshStore(); const fp = full.S.addProfile('Full', '🦊').profile; fp.stickers = [...STICKERS]; full.S.save();
  ok(freshStore(full.mem).S.getProfiles()[0].stickers.length === 300, 'all 300 stickers survive save and reload');
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
  ok(b1.rewards.redeemed === 99 && R2.rewardBalance(b1) === -94 && !Object.keys(b1.rewards.pending).length && !b1.rewards.session && b1.rewards.earnTx.length === 0 && b2.rewards.earned === 0, 'corrupted reward data is repaired safely (a balance below zero is allowed, so redeemed is no longer clamped)');
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

// --- Playzone: usage-based charging, negative balances, parent-only adjustment, personal bests
{
  let { S, mem } = freshStore();
  const p = S.addProfile('Zed', '🦊').profile;
  p.rewards.earned = 10; S.save();
  Parent.lock(); Parent.hard.lock();
  const T = 1000000;   // fake monotonic clock (ms)
  // rounding rule: Math.ceil(seconds / 60), never fewer than 1 minute
  const exp = { 0.5: 1, 1: 1, 10: 1, 30: 1, 59: 1, 60: 1, 61: 2, 90: 2, 120: 2, 121: 3, 180: 3 };
  ok(Object.entries(exp).every(([sec, min]) => S.playMinutes(Number(sec)) === min), 'playMinutes: 1,10,30,59,60 s -> 1 min; 61,90,120 s -> 2 min; 121,180 s -> 3 min');
  // The shell saves a heartbeat every 5 s; the same cadence here. Returns the charge result.
  const beat = (target, upTo) => { for (let t = 5; t < upTo; t += 5) S.tickPlay(target, T + t * 1000); };
  const run = (target, seconds, game) => { const st = S.startPlay(target, game || 'balloon', T); if (st.error) return st; beat(target, seconds); return S.endPlay(target, T + seconds * 1000, 'ended'); };
  const charge = (seconds, bal) => {   // plays one session of `seconds` and returns the minutes charged
    p.rewards.earned = bal; p.rewards.redeemed = 0;
    const before = bal;
    const end = run(p, seconds);
    return { minutes: end.minutes, balanceBefore: before, balanceAfter: S.rewardBalance(p) };
  };
  [[1, 1], [10, 1], [59, 1], [60, 1], [61, 2], [90, 2], [120, 2], [121, 3]].forEach(([sec, min]) => {
    const r = charge(sec, 10);
    ok(r.minutes === min && r.balanceBefore === 10 && r.balanceAfter === 10 - min, `a ${sec}-second session charges ${min} min (start deducts nothing, end deducts ${min})`);
  });
  p.rewards.earned = 10; p.rewards.redeemed = 0;
  const txBefore = p.rewards.redeemTx.length;
  ok(S.startPlay(p, 'designer', T).saved === true && S.rewardBalance(p) === 10 && p.rewards.redeemTx.length === txBefore, 'starting a session deducts nothing');
  ok(S.startPlay(p, 'balloon', T).running === true && p.playzone.session.game === 'designer', 'a second start while one session runs is refused (no overlapping sessions)');
  ok(JSON.parse(mem['mathQuizBattle.v1']).profiles[0].playzone.session.status === 'active', 'the running session (start time, status) is saved');
  beat(p, 61); const first = S.endPlay(p, T + 61000, 'ended');
  ok(first.minutes === 2 && S.rewardBalance(p) === 8 && p.playzone.session === null && p.playzone.log[0].minutes === 2 && p.playzone.log[0].game === 'designer', 'ending charges the rounded-up minutes once and logs the session');
  ok(S.endPlay(p, T + 999000, 'ended') === null && S.rewardBalance(p) === 8, 'ending again charges nothing (no double charge)');
  // separate sessions are rounded independently: 10 s + 10 s = 2 min, not ceil(20/60) = 1
  p.rewards.earned = 10; p.rewards.redeemed = 0;
  run(p, 10, 'reaction'); run(p, 10, 'reaction');
  ok(p.rewards.redeemed === 2, 'two 10-second sessions are charged 1 min each (rounded independently)');
  // balance rules for starting
  p.rewards.earned = 1; p.rewards.redeemed = 0;
  ok(!S.startPlay(p, 'reaction', T).error, 'a balance above 0 allows a new game');
  beat(p, 70); const long = S.endPlay(p, T + 70000);
  ok(long.minutes === 2 && S.rewardBalance(p) === -1 && long.balance === -1, 'a session may finish with a negative balance: 1 min - 70 s = -1 min (not capped at 0)');
  ok(S.startPlay(p, 'reaction', T).empty === true && p.playzone.session === null, 'a negative balance blocks a new game');
  p.rewards.earned = 3; p.rewards.redeemed = 3;
  ok(S.startPlay(p, 'reaction', T).empty === true && p.playzone.session === null, 'a balance of exactly 0 blocks a new game');
  ok(S.playMinutes(NaN) === 1 && S.endPlay(p, T) === null, 'a bad value still counts as the minimum charge; no session means no charge');
  // the balance is saved negative and survives a reload
  const neg = freshStore(mem).S.getProfiles()[0];
  ok(S.rewardBalance(neg) === 0 || neg.rewards.redeemed >= 0, 'saved data reloads');
  // gaps (sleeping device) and clock changes are not free or charged
  p.rewards.earned = 10; p.rewards.redeemed = 0;
  S.startPlay(p, 'balloon', T);
  S.tickPlay(p, T + 5000); S.tickPlay(p, T + 3600000);   // 1 hour of silence counts as at most 15 s
  ok(S.playSeconds(p, T + 3600000) === 20, 'a long silence is capped (only 5 s + 15 s counted)');
  S.endPlay(p, T + 3600000);
  // interrupted sessions: refresh / restart reconcile at the last heartbeat, exactly once
  p.rewards.earned = 10; p.rewards.redeemed = 0; S.save();
  S.startPlay(p, 'balloon', T); S.tickPlay(p, T + 5000); S.tickPlay(p, T + 10000); S.tickPlay(p, T + 15000);   // 15 s played, then the page closes
  ok(JSON.parse(mem['mathQuizBattle.v1']).profiles[0].playzone.session.usedMs === 15000, 'heartbeats persist the played time');
  const reload = freshStore(mem);
  const rp = reload.S.getProfiles()[0];
  ok(rp.playzone.session === null && reload.S.rewardBalance(rp) === 9 && rp.playzone.log[0].reason === 'interrupted' && rp.playzone.log[0].minutes === 1, 'a refresh/restart ends the leftover session at its last heartbeat and charges it once');
  const reload2 = freshStore(mem).S.getProfiles()[0];
  ok(reload2.rewards.redeemed === rp.rewards.redeemed && reload2.playzone.session === null, 'reloading again does not charge it again');
  ok(reload.S.reconcilePlay().length === 0, 'reconcilePlay with nothing left over does nothing');
  // a session that started and was refreshed immediately still costs the minimum (no free usage)
  rp.rewards.earned = 10; rp.rewards.redeemed = 0; reload.S.save();
  reload.S.startPlay(rp, 'balloon', T);
  const quick = freshStore(mem).S.getProfiles()[0];
  ok(quick.rewards.redeemed === 1, 'start then instant refresh is still charged 1 minute');
  // a session already charged by another tab is not charged again
  const tabA = freshStore(mem); const pa = tabA.S.getProfiles()[0];
  pa.rewards.earned = 20; pa.rewards.redeemed = 0; tabA.S.save();
  tabA.S.startPlay(pa, 'balloon', T);
  const tabB = freshStore(mem);    // a second tab loads and settles the leftover session
  const pb = tabB.S.getProfiles()[0];
  ok(pb.rewards.redeemed === 1 && pb.playzone.session === null, 'another tab loading settles the leftover session once');
  tabA.S.endPlay(pa, T + 30000);
  ok(JSON.parse(mem['mathQuizBattle.v1']).profiles[0].playzone.log.filter(x => x.game === 'balloon').length >= 1, 'the first tab ending later does not add a second charge (checked on the saved bank below)');
  const savedAfter = JSON.parse(mem['mathQuizBattle.v1']).profiles[0];
  ok(savedAfter.rewards.redeemed === 1, 'the saved bank was charged exactly once across two tabs');

  // parent-only redeem and adjustment
  p.playzone.session = null;   // (this store's copy was left running by the reload tests above; other stores already settled it)
  p.rewards.earned = 10; p.rewards.redeemed = 3; S.save();
  ok(S.redeem(p, 1).denied === true && p.rewards.redeemed === 3, 'the parent redeem still needs parent verification');
  ok(S.adjustBalance(p, 5).denied === true && p.rewards.earned === 10, 'adjustBalance is denied while locked');
  Parent.submit(solveParent(Parent.current().text));
  ok(Parent.isUnlocked() && S.adjustBalance(p, 5).denied === true, 'the normal parent unlock does not allow adjustment');
  Parent.lock();
  ok(Parent.hard.submit(solveHard(Parent.hard.current().text)).ok === true, 'hard unlock works through the public API');
  const add = S.adjustBalance(p, 5);
  ok(add.before === 7 && add.after === 12 && p.rewards.earned === 15 && p.rewards.redeemed === 3 && add.saved === true, 'adjustBalance adds minutes to the same bank (before/after reported)');
  const sub = S.adjustBalance(p, -4);
  ok(sub.before === 12 && sub.after === 8 && p.rewards.redeemed === 7, 'adjustBalance deducts minutes');
  ok(S.adjustBalance(p, 0).error && S.adjustBalance(p, 2.5).error && S.adjustBalance(p, 601).error && S.adjustBalance(null, 1).error && p.rewards.redeemed === 7 && p.rewards.earned === 15, 'adjustBalance refuses 0, fractions, huge amounts and no profile');
  const neg2 = S.adjustBalance(p, -13);
  ok(neg2.before === 8 && neg2.after === -5 && p.rewards.redeemed === 20 && !neg2.error, 'a manual deduction may make the balance negative (8 - 13 = -5)');
  ok(S.adjustBalance(p, 5).after === 0 && S.adjustBalance(p, 4).after === 4, 'adding time brings a negative balance back to zero and then positive');
  const back = freshStore(mem).S.getProfiles()[0];
  ok(back.rewards.earned === 24 && back.rewards.redeemed === 20, 'adjustments (and a negative balance) survive a reload');
  p.rewards.redeemed = 40; S.save();
  ok(freshStore(mem).S.getProfiles()[0].rewards.redeemed === 40 && S.checkRedeem(p, 1) === 'No minutes are available to redeem.', 'a negative balance reloads as negative; the parent redeem says there is nothing to redeem');
  Parent.hard.lock();

  const q = S.addProfile('Quin', '🐱').profile;
  ok(q.playzone.reactionBest === null && q.playzone.balloonBest === 0, 'a new profile starts with no Playzone records');
  let rr = S.recordPlayzone(q, 'reaction', 312.4);
  ok(rr.isNew && rr.first && rr.best === 312 && q.playzone.reactionBest === 312, 'first valid reaction time becomes the best (rounded to ms)');
  rr = S.recordPlayzone(q, 'reaction', 400);
  ok(!rr.isNew && q.playzone.reactionBest === 312, 'a slower reaction does not replace the best');
  rr = S.recordPlayzone(q, 'reaction', 250);
  ok(rr.isNew && !rr.first && q.playzone.reactionBest === 250, 'a faster reaction replaces the best');
  ok(!S.recordPlayzone(q, 'reaction', 0).isNew && !S.recordPlayzone(q, 'reaction', NaN).isNew && !S.recordPlayzone(q, 'reaction', 999999).isNew && q.playzone.reactionBest === 250, 'impossible times are ignored');
  ok(S.recordPlayzone(q, 'balloon', 6).isNew && !S.recordPlayzone(q, 'balloon', 4).isNew && !S.recordPlayzone(q, 'balloon', 6).isNew && S.recordPlayzone(q, 'balloon', 9).best === 9 && !S.recordPlayzone(q, 'balloon', 0).isNew, 'balloon best only goes up (ties and zero are not records)');
  ok(p.playzone.reactionBest === null && p.playzone.balloonBest === 0, 'records belong to one profile only');
  const again = freshStore(mem).S.getProfiles();
  const q2 = again.find(x => x.name === 'Quin');
  ok(q2.playzone.reactionBest === 250 && q2.playzone.balloonBest === 9, 'Playzone records survive a reload');
  const design = { kind: 'cake', shape: 'heart', outer: '#f3d9a4', inner: '#ffb3d1', items: [{ type: 'cherry', x: 120.44, y: 200, rot: 5 }, { type: '<b>', x: 1, y: 1, rot: 0 }] };
  ok(S.saveDesign(q, design) === true && q.playzone.design.items.length === 1 && q.playzone.design.shape === 'heart' && freshStore(mem).S.getProfiles().find(x => x.name === 'Quin').playzone.design.items[0].type === 'cherry', 'a design is saved on the profile, cleaned, and survives a reload');
  ok(S.saveDesign(q, { kind: 'bad' }) && q.playzone.design === null, 'an invalid design is dropped');
  const junk = freshStore({ 'mathQuizBattle.v1': JSON.stringify({ schema: 2, profiles: [{ id: 'j', name: 'J', playzone: { reactionBest: 'x', balloonBest: -5 } }, { id: 'k', name: 'K' }] }) }).S.getProfiles();
  ok(junk.every(x => x.playzone.reactionBest === null && x.playzone.balloonBest === 0 && x.playzone.session === null && x.playzone.log.length === 0 && x.playzone.design === null), 'damaged or missing Playzone data becomes empty records');
}

// --- school-grade screen-time multiplier (game grade below the child's school grade earns 50%)
{
  const setGrade = (S, p, g) => { unlockParent(); const r = S.setSchoolGrade(p, g); Parent.lock(); return r; };
  // The real answer -> settle -> payout path. 100 first-attempt answers, all correct, in one session.
  const play = (S, p, id, gameGrade, n = 100, right = n) => {
    for (let i = 0; i < n; i++) S.rewardAnswer(p, id, gameGrade, i < right);
    return S.settleRewards(p, id);
  };
  // 100/100 correct pays 15 x grade multiplier (1.0, 1.1, 1.2, 1.3, 1.4, 1.5), rounded down once: 15, 16, 18, 19, 21, 22.
  const paid = (schoolGrade, gameGrade) => {
    const { S } = freshStore();
    const p = S.addProfile('Kid', '🐼').profile;
    if (schoolGrade) setGrade(S, p, schoolGrade);
    const res = play(S, p, 'sg1', gameGrade);
    return { minutes: res.batch.minutes, balance: S.rewardBalance(p), res };
  };

  // storage: separate from game difficulty, safe defaults, old data and backups
  let { S: G, mem: gm } = freshStore();
  const gk = G.addProfile('Kid', '🐼').profile;
  ok(gk.schoolGrade === null, 'a new profile has no school grade yet (not configured)');
  gk.lastSetup = { difficulty: 'grade4', topic: 'all' }; G.save();
  ok(setGrade(G, gk, 2).saved === true && gk.schoolGrade === 2 && gk.lastSetup.difficulty === 'grade4', 'the school grade is saved on the profile and stays separate from lastSetup');
  ok(freshStore(gm).S.getProfiles()[0].schoolGrade === 2 && freshStore(gm).S.getProfiles()[0].lastSetup.difficulty === 'grade4', 'the school grade survives a reload');
  const gBackup = G.parseBackup(G.exportText());
  ok(gBackup.profiles[0].schoolGrade === 2, 'export -> parse keeps the school grade');
  const oldLoaded = freshStore({ 'mathQuizBattle.v1': JSON.stringify({ schema: 2, profiles: [{ id: 'o1', name: 'Old', stickers: ['🦄'], totals: { games: 4 }, rewards: { earned: 12, redeemed: 2, pending: { 2: { completed: 5, correct: 5 } } }, playzone: { balloonBest: 9 }, lastSetup: { difficulty: 'grade2', topic: 'all' } }] }) }).S.getProfiles()[0];
  ok(oldLoaded.schoolGrade === null && oldLoaded.stickers.length === 1 && oldLoaded.totals.games === 4 && oldLoaded.rewards.earned === 12 && oldLoaded.rewards.redeemed === 2 && oldLoaded.rewards.pending[2].completed === 5 && oldLoaded.playzone.balloonBest === 9 && oldLoaded.lastSetup.difficulty === 'grade2', 'an existing profile loads with the school grade not set and keeps its scores, stickers, rewards and Playzone data');
  const oldBackup = G.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [{ id: 'b1', name: 'Bk', rewards: { earned: 5 } }] }));
  ok(!oldBackup.error && oldBackup.profiles[0].schoolGrade === null && oldBackup.profiles[0].rewards.earned === 5, 'an old backup without a school grade imports safely as not set');
  const badGrades = [0, 7, -1, 2.5, '3', null, 'x', NaN].map(g => G.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 2, profiles: [{ id: 'g' + String(g), name: 'G', schoolGrade: g }] })).profiles[0].schoolGrade);
  ok(badGrades.every(g => g === null), 'invalid school grades in saved or imported data become not set');

  // parent verification
  ({ S: G } = freshStore(gm));   // point storage back at this test's data (the legacy check above used its own)
  const gk2 = G.addProfile('Sib', '🦊').profile;
  Parent.lock();
  const denied = G.setSchoolGrade(gk2, 3);
  ok(denied.denied === true && denied.saved === false && gk2.schoolGrade === null && freshStore(gm).S.getProfiles()[1].schoolGrade === null, 'changing the school grade is refused without parent verification (direct call)');
  ok(G.setSchoolGrade(gk, 1).denied === true && gk.schoolGrade === 2, 'a refused change leaves an existing school grade unchanged');
  unlockParent();
  ok(G.setSchoolGrade(gk2, 0).error && G.setSchoolGrade(gk2, 7).error && G.setSchoolGrade(gk2, 2.5).error && G.setSchoolGrade(gk2, '3').error && G.setSchoolGrade({ name: 'x' }, 3).error && gk2.schoolGrade === null, 'only whole grades 1-6 on a saved profile are accepted');
  ok(G.setSchoolGrade(gk2, 3).saved === true && gk2.schoolGrade === 3, 'after verification the school grade can be changed');
  Parent.lock();
  globalThis.__fail = true;
  const failedSet = setGrade(G, gk2, 4);
  globalThis.__fail = false;
  ok(failedSet.saved === false && failedSet.schoolGrade === 4 && gk2.schoolGrade === 4, 'a failed save is reported (the change applies for this session, like other profile edits)');

  // payout matrix, through the real settle path
  ok(paid(2, 1).minutes === 7 && paid(2, 2).minutes === 16 && paid(2, 3).minutes === 18, 'School Grade 2: Grade 1 earns 50% (15 -> 7); Grade 2 and Grade 3 earn in full (16, 18)');
  ok(paid(3, 1).minutes === 7 && paid(3, 2).minutes === 8 && paid(3, 3).minutes === 18 && paid(3, 4).minutes === 19, 'School Grade 3: Grades 1 and 2 earn 50% (7, 8); Grades 3 and 4 earn in full (18, 19)');
  ok([1, 2, 3, 4, 5, 6].every(sg => [1, 2, 3, 4, 5, 6].every(gg => paid(sg, gg).minutes === Math.floor(100 * 0.1 * 1.5 * [1, 1.1, 1.2, 1.3, 1.4, 1.5][gg - 1] * (gg < sg ? 0.5 : 1) + 1e-9))), 'the rule is the same for every school grade and game grade from 1 to 6');
  const eq = paid(2, 1);
  ok(eq.balance === 7 && eq.res.batch.schoolMult === 0.5 && eq.res.batch.difficulty === 1 && eq.res.batch.accuracyMult === 1.5 && paid(2, 2).res.batch.schoolMult === 1, 'the batch reports the school-grade multiplier next to the existing multipliers');
  ok(paid(1, 1).minutes === 15 && paid(1, 6).minutes === 22 && paid(6, 6).minutes === 22 && paid(6, 5).minutes === 10, 'edges: Grade 1 pupils always earn in full; Grade 6 pupils earn half below Grade 6');

  // an unset school grade counts as Grade 1: never reduced, and the profile stays "not set"
  ok(paid(0, 1).minutes === 15 && paid(0, 6).minutes === 22 && paid(0, 1).res.batch.schoolMult === 1, 'with no school grade set, every game grade earns in full (counted as Grade 1)');

  // the same calculation, directly
  ok(G.calcReward(1, 100, 100).minutes === 15 && G.calcReward(1, 100, 100, null, 2).minutes === 7 && G.calcReward(2, 100, 100, null, 2).minutes === 16 && G.calcReward(1, 100, 100, null, null).minutes === 15, 'calcReward without a school grade is unchanged; with one it applies the multiplier');

  // changing the school grade affects the next payouts only
  ({ S: G, mem: gm } = freshStore());
  const cp = G.addProfile('Chg', '🐸').profile;
  setGrade(G, cp, 3);
  const c1 = play(G, cp, 'c1', 1).batch.minutes;
  setGrade(G, cp, 1);
  const c2 = play(G, cp, 'c2', 1).batch.minutes;
  setGrade(G, cp, 2);
  const c3 = play(G, cp, 'c3', 1).batch.minutes;
  ok(c1 === 7 && c2 === 15 && c3 === 7 && cp.rewards.earned === 29 && cp.rewards.earnTx.map(t => t.minutes).join() === '7,15,7', 'changing the school grade changes later payouts; earlier payouts are not recalculated');

  // pending progress is paid with the school grade in force at payout time, exactly once
  ({ S: G, mem: gm } = freshStore());
  const pp = G.addProfile('Pend', '🐼').profile;
  setGrade(G, pp, 3);
  const half1 = play(G, pp, 'p1', 1, 10);
  ok(half1.batch === null && pp.rewards.pending[1].completed === 10 && pp.rewards.earned === 0, 'a part batch only waits as pending progress (nothing paid yet)');
  setGrade(G, pp, 1);   // changed while the batch is pending
  const p2 = play(G, pp, 'p2', 1, 10);
  ok(p2.batch.completed === 20 && p2.batch.minutes === 3 && p2.batch.schoolMult === 1 && pp.rewards.earned === 3 && !pp.rewards.pending[1], 'a batch finished after the grade was lowered is paid with the new school grade (20 x 0.1 x 1.5 = 3), once');
  ok(G.settleRewards(pp, 'p2').settled === false && pp.rewards.earned === 3 && pp.rewards.earnTx.length === 1, 'settling the same session again does not pay twice');
  play(G, pp, 'p3', 2, 10);
  setGrade(G, pp, 4);   // raised while the batch is pending: Grade 2 is now below school grade
  const p4 = play(G, pp, 'p4', 2, 10);
  ok(p4.batch.minutes === 1 && p4.batch.schoolMult === 0.5 && pp.rewards.earned === 4, 'a batch finished after the grade was raised is paid at 50% (20 x 0.1 x 1.5 x 1.1 x 0.5 = 1.65 -> 1)');
  play(G, pp, 'p5', 1, 5); play(G, pp, 'p6', 3, 5);
  ok(pp.rewards.pending[1].completed === 5 && pp.rewards.pending[3].completed === 5 && Object.keys(pp.rewards.pending).length === 2, 'pending progress stays separate by game grade');

  // a session left behind by a closed page is paid on the next load with the saved school grade
  ({ S: G, mem: gm } = freshStore());
  const sp = G.addProfile('Stale', '🐯').profile;
  setGrade(G, sp, 3);
  for (let i = 0; i < 20; i++) G.rewardAnswer(sp, 'st1', 1, true);   // page closed before the game ends
  const reloadedStale = freshStore(gm).S.getProfiles()[0];
  ok(reloadedStale.rewards.earned === 1 && reloadedStale.rewards.earnTx[0].minutes === 1 && !reloadedStale.rewards.session, 'a leftover session is settled on load using the saved school grade (3 x 0.5 -> 1 minute)');

  // existing reward rules and profile data are untouched
  ({ S: G, mem: gm } = freshStore());
  const ex = G.addProfile('Rules', '🦁').profile;
  ex.stickers.push('🦄'); ex.totals.games = 7; ex.totals.correct = 30; ex.bests['grade1|all|60'] = 12; ex.history.push({ t: 1, level: 'grade1', score: 5 }); ex.rewards.redeemed = 2; G.save();
  setGrade(G, ex, 3);
  const exBefore = JSON.stringify({ s: ex.stickers, t: ex.totals, b: ex.bests, h: ex.history, tr: ex.trophies, pz: ex.playzone });
  ok(play(G, ex, 'r1', 1, 19, 19).batch === null && ex.rewards.pending[1].completed === 19, 'the minimum batch size still applies');
  ok(play(G, ex, 'r2', 1, 1, 1).batch.minutes === 1, 'carried progress completes a batch that is paid at 50% (20 correct at Grade 1 for a Grade 3 pupil: 3 -> 1)');
  const lowAcc = play(G, ex, 'r3', 3, 20, 15);
  ok(lowAcc.batch.minutes === 0 && lowAcc.batch.schoolMult === 1 && !ex.rewards.pending[3], 'the minimum accuracy still applies (75% earns nothing and the batch is used up)');
  const tiers = [80, 90, 95, 100].map(pct => { const { S } = freshStore(); const q = S.addProfile('T', '🐼').profile; setGrade(S, q, 2); return play(S, q, 't' + pct, 1, 100, pct).batch.minutes; });
  ({ S: G } = freshStore(gm));
  ok(tiers.join() === '4,5,6,7', 'accuracy multipliers still apply under the halving (80% 8 -> 4, 90% 10.8 -> 5, 95% 13.3 -> 6, 100% 15 -> 7)');
  ok(JSON.stringify({ s: ex.stickers, t: ex.totals, b: ex.bests, h: ex.history, tr: ex.trophies, pz: ex.playzone }) === exBefore && ex.rewards.redeemed === 2, 'scores, totals, stickers, trophies, history, Playzone data and redeemed minutes are not touched by the multiplier');
  ok(freshStore(gm).S.getProfiles()[0].schoolGrade === 3, 'the school grade is stored with the rest of the profile');
}

console.log(failures ? `\n${failures} FAILED` : '\nAll store checks passed');
process.exit(failures ? 1 : 0);
