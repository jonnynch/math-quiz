// Unit checks for store.js: saving, schema, backup export/import/undo, validation, save failures. No browser needed.
const path = require('path');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

function freshStore(existing) {
  const mem = existing || {};
  globalThis.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem(k, v) { if (globalThis.__fail) throw new Error('quota'); mem[k] = String(v); },
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
  { id: '../<script>a1', name: '<img src=x onerror=1>LongNameThatIsTooLong', avatar: 'nope', stickers: ['🦄', 'x', '🦄'], totals: { games: -5, correct: 'a' }, history: [{ score: -1, level: 'gr[...]
  { id: '../<script>a1', name: 'Duplicate id' }] }));
const hp = hostile.profiles[0];
ok(hostile.profiles.length === 1 && hostile.skipped === 1, 'duplicate ids inside a backup are dropped');
ok(/^[A-Za-z0-9_-]+$/.test(hp.id) && hp.name.length <= 14 && hp.stickers.length === 1 && hp.totals.games === 0 && S.AVATARS.includes(hp.avatar) && hp.history[0].score === 0 && !('k' in hp.bests), 'backup sanitises unsafe ids, names and values');

// --- merge
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
ok(S.hasBackup() && S.restoreBackup() && S.getProfiles().map(p => p.id).join() === idsBefore && !S.hasBackup(), 'undo: previous profiles are restored');

// --- failure while importing is reported
globalThis.__fail = true;
const r4 = S.applyBackup(S.parseBackup(text), 'merge');
ok(r4.saved === false && r4.backedUp === false, 'import reports when the browser would not save');
globalThis.__fail = false;

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

console.log(failures ? `\n${failures} FAILED` : '\nAll store checks passed');
process.exit(failures ? 1 : 0);
