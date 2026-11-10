// Smart Difficulty checks: rules (adaptive.js), saved data and backups (store.js), and the game in jsdom.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const dir = path.join(__dirname, '..', 'public') + '/';
const Parent = require(dir + 'parent.js'); // sets globalThis.MQParent, which store.js checks
const { solveParent } = require('./parent-solver');
const Q = require(dir + 'questions.js');
const A = require(dir + 'adaptive.js');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

// ---------- rules ----------
const C = A.CONFIG;
const feed = (st, results, secs = 3) => results.forEach(r => A.record(st, r, secs));
const run = (st, base, topic, results, secs = 3) => { let last; results.forEach(r => { last = A.update(st, base, topic, r, secs); }); return last; };
const rep = (n, v) => Array(n).fill(v);

ok(C.minUp === 10 && C.upAccuracy === 0.9 && C.minDown === 8 && C.downAccuracy === 0.6, 'thresholds are the agreed defaults, kept in one internal CONFIG');
let s = A.emptyState();
feed(s, rep(9, 1));
ok(A.evaluate(s) === 'stay', '9 answers, all right: not enough recent answers to move up');
feed(s, [1]);
ok(A.evaluate(s) === 'up', '10 answers at 100%: move up');
s = A.emptyState(); feed(s, [...rep(9, 1), 0]);
ok(A.evaluate(s) === 'up', '10 answers at exactly 90%: move up');
s = A.emptyState(); feed(s, [...rep(8, 1), 0, 0]);
ok(A.evaluate(s) === 'stay', '10 answers at 80%: stay');
s = A.emptyState(); feed(s, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1].slice(0, 9));
ok(A.evaluate(s) === 'stay', 'a short lucky streak never moves up on its own');
s = A.emptyState(); feed(s, rep(7, 0));
ok(A.evaluate(s) === 'stay', '7 answers at 0%: not enough recent answers to move down');
feed(s, [0]);
ok(A.evaluate(s) === 'down', '8 answers at 0%: move down');
s = A.emptyState(); feed(s, [1, 1, 1, 1, 1, 0, 0, 0]);
ok(A.evaluate(s) === 'stay', '8 answers at 62.5%: stay (not below 60%)');
s = A.emptyState(); feed(s, [1, 1, 1, 1, 0, 0, 0, 0]);
ok(A.evaluate(s) === 'down', '8 answers at 50%: move down');
s = A.emptyState(); feed(s, [...rep(15, 1), ...rep(5, 0)]);
ok(s.recent.length === C.window, 'only the most recent ' + C.window + ' answers are kept');
s = A.emptyState(); feed(s, [...rep(30, 1), ...rep(8, 0)]);
ok(A.accuracy(s) === 12 / 20 && A.evaluate(s) === 'stay', 'recent performance counts, not lifetime totals (older good answers fall out of the window)');
s = A.emptyState(); feed(s, rep(10, 1), 40);
ok(A.isSlow(s) && A.evaluate(s) === 'stay', 'accurate but consistently slow: speed holds back a move up');
s = A.emptyState(); feed(s, [...rep(4, 0), ...rep(4, 1)], 1);
ok(A.evaluate(s) === 'down', 'speed never prevents a move down');
s = A.emptyState(); feed(s, rep(6, 0), 1);
ok(A.evaluate(s) === 'stay', 'fast but wrong, with too few answers: no change from speed alone');
s = A.emptyState(); feed(s, [...rep(5, 1), ...rep(5, 0)], 1);
ok(A.evaluate(s) === 'down', 'fast answers do not stop a move down when accuracy is low');
s = A.emptyState(); feed(s, [...rep(10, 1)], 0.5);
ok(A.evaluate(s) === 'up', 'fast and accurate: moves up through accuracy (speed is only a confirmation)');

// ---------- one step at a time, cooldown, no oscillation ----------
s = A.emptyState();
let r = run(s, 'grade3', 'fractions', rep(10, 1));
ok(r.changed && r.direction === 'up' && r.level === 'grade4' && s.offset === 1, '10 right answers: one step up (Grade 3 -> Grade 4)');
ok(s.recent.length === 0 && s.cd === C.cooldown, 'a change clears the history and starts the cooldown');
r = run(s, 'grade3', 'fractions', rep(10, 1));
ok(!r.changed && r.limited && s.offset === 1 && r.level === 'grade4', 'never more than one step from the chosen level (limit reached, no second step)');
s = A.emptyState(); run(s, 'grade3', 'fractions', rep(10, 1));
r = run(s, 'grade3', 'fractions', rep(8, 0));
ok(!r.changed && s.offset === 1, 'cooldown: 8 wrong answers straight after a change do not move it back');
r = run(s, 'grade3', 'fractions', rep(2, 0));
ok(r.changed && r.direction === 'down' && s.offset === 0, 'after the cooldown, enough poor answers step back down');
// alternating bursts: never more than one change per cooldown period
s = A.emptyState(); let changes = 0, answered = 0;
for (let round = 0; round < 12; round++) {
  const burst = round % 2 === 0 ? rep(10, 1) : rep(10, 0);
  burst.forEach(v => { answered++; if (A.update(s, 'grade4', 'mixed', v, 3).changed) changes++; });
}
ok(changes <= Math.floor(answered / C.cooldown), `no oscillation: ${changes} changes in ${answered} answers (max one per ${C.cooldown})`);
// middle of the road never changes
s = A.emptyState(); r = run(s, 'grade3', 'mixed', [1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1]);
ok(!r.changed && s.offset === 0, 'about 72% over 18 answers: no change');

// ---------- boundaries per grade and topic ----------
const gradesOk = ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'].every(g => {
  const i = Number(g.slice(5));
  const c = A.candidates(g, 'mixed');
  return c.every(l => Math.abs(Number(l.slice(5)) - i) <= 1) && c.includes(g) && c.every(l => /^grade[1-6]$/.test(l));
});
ok(gradesOk, 'Grade 1-6: candidate levels are the chosen grade +/- 1, always a real grade');
ok(A.candidates('grade1', 'mixed').join() === 'grade1,grade2' && A.candidates('grade6', 'mixed').join() === 'grade5,grade6', 'Grade 1 cannot go down and Grade 6 cannot go up');
s = A.emptyState(); r = run(s, 'grade6', 'mixed', rep(10, 1));
ok(!r.changed && r.level === 'grade6' && s.offset === 0, 'Grade 6 with perfect answers stays at Grade 6');
s = A.emptyState(); r = run(s, 'grade1', 'mixed', rep(8, 0));
ok(!r.changed && r.level === 'grade1' && s.offset === 0, 'Grade 1 with poor answers stays at Grade 1');
ok(A.candidates('grade2', 'mul').join() === 'grade2,grade3' && A.candidates('grade6', 'mul').join() === 'grade5,grade6', 'Multiplication (Grade 2-6): never moves to Grade 1');
ok(A.candidates('grade4', 'tables').join() === 'grade3,grade4' && A.candidates('grade2', 'tables').join() === 'grade2,grade3', 'Times tables (Grade 2-4): never moves to Grade 5 or Grade 1');
ok(A.candidates('grade4', 'money').join() === 'grade3,grade4', 'Money (Grade 1-4): never moves to Grade 5');
ok(['compare', 'clock', 'money', 'fractions', 'shapes', 'tables', 'mul', 'div', 'add', 'sub', 'all', 'mixed'].every(t => ['grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6'].every(g => A.candidates(g, t).every(l => Q.topicsFor(l).some(x => x.value === Q.normaliseTopic(g, t))))),
  'every candidate level offers the chosen topic');
ok(A.candidates('age6', 'mixed').join() === 'age5,age6' && A.candidates('toddler', 'mixed').join() === 'toddler,age4', 'Age levels stay within the Age levels (never jump to Grade 1)');
s = A.emptyState(); s.offset = 1;
ok(A.levelFor('grade4', 'tables', s) === 'grade4' && A.levelFor('grade3', 'tables', s) === 'grade4', 'a stored offset that no longer fits falls back to the chosen level');
const level = A.levelFor('grade4', 'tables', { offset: -1 });
ok(level === 'grade3', 'stored offsets apply when they fit');

// ---------- cleaning: old, damaged and hostile data ----------
ok(JSON.stringify(A.cleanState(null)) === JSON.stringify(A.emptyState()) && JSON.stringify(A.cleanMap(undefined)) === '{}' && JSON.stringify(A.cleanMap([1, 2])) === '{}', 'missing or wrong-type adaptive data becomes empty state');
const dirty = A.cleanMap({ 'grade3|fractions': { offset: 9, recent: [{ c: 1, s: 5 }, { c: 7, s: 1 }, null, { c: 0, s: 'x' }], cd: 500, u: 5 }, 'grade9|mixed': {}, 'grade1|mul': {}, junk: {}, 'grade2|mul|x': {}, 'age5|mixed': { offset: -1 } });
ok(Object.keys(dirty).sort().join() === 'age5|mixed,grade3|fractions', 'unknown levels, topics a grade does not offer and malformed keys are dropped: ' + Object.keys(dirty));
ok(dirty['grade3|fractions'].offset === 1 && dirty['grade3|fractions'].recent.length === 2 && dirty['grade3|fractions'].cd === C.cooldown, 'offsets, answers and cooldown are clamped to valid values');
const many = {}; for (let i = 0; i < 80; i++) many[`grade${(i % 6) + 1}|${['mixed', 'all', 'add', 'sub', 'fractions', 'shapes'][Math.floor(i / 6) % 6]}`] = { u: i };
ok(Object.keys(A.cleanMap(many)).length <= C.maxKeys, 'at most ' + C.maxKeys + ' setups are stored per profile');

// ---------- store: settings, persistence, backups ----------
function freshStore(existing) {
  const mem = existing || {};
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem(k, v) { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  delete require.cache[require.resolve(dir + 'store.js')];
  return { S: require(dir + 'store.js'), mem };
}
const unlock = () => Parent.submit(solveParent(Parent.current().text));
let { S, mem } = freshStore();
ok(S.getSettings().smartDifficulty === 'off', 'Smart Difficulty defaults to off');
ok(S.setSetting('smartDifficulty', 'maybe').error && S.getSettings().smartDifficulty === 'off', 'invalid value rejected');
S.setSetting('smartDifficulty', 'on');
const mia = S.addProfile('Mia', '🦊').profile;
ok(JSON.stringify(mia.smart) === '{}', 'a new profile starts with no adaptive progress');
const st = A.stateFor(mia.smart, 'grade3', 'fractions'); A.record(st, true, 2); st.offset = 1; S.save();
({ S, mem } = freshStore(mem));
ok(S.getSettings().smartDifficulty === 'on' && S.getProfiles()[0].smart['grade3|fractions'].offset === 1 && S.getProfiles()[0].smart['grade3|fractions'].recent.length === 1, 'setting and per-profile progress survive a reload');
const text = S.exportText();
ok(JSON.parse(text).profiles[0].smart['grade3|fractions'].offset === 1 && JSON.parse(text).settings.smartDifficulty === 'on', 'export includes adaptive progress and the setting');
const other = freshStore();
unlock();
const parsed = other.S.parseBackup(text);
ok(!parsed.error, 'export parses back');
unlock(); const applied = other.S.applyBackup(parsed, 'replace');
ok(applied.imported !== false && other.S.getProfiles()[0].smart['grade3|fractions'].offset === 1 && other.S.getSettings().smartDifficulty === 'on', 'replace-import restores adaptive progress and the setting');
// older backup/profile without any adaptive data
const old = JSON.stringify({ app: 'mathQuizBattle', schema: 2, settings: { palette: 'standard', text: 'normal' }, profiles: [{ id: 'pold', name: 'Old', avatar: '🦊', totals: { games: 3, correct: 9, taps: 12, correctTaps: 9, bestStreak: 4 }, history: [{ t: 1, level: 'grade2', topic: 'mixed', mode: 'solo', seconds: 0, score: 3, taps: 4, correctTaps: 3, avgTime: 2, streak: 3 }], bests: { 'grade2|mixed|60': 5 }, stickers: ['🦄'], lastSetup: { difficulty: 'grade2', topic: 'mixed' } }] });
const oldStore = freshStore();
const oldParsed = oldStore.S.parseBackup(old);
ok(!oldParsed.error && JSON.stringify(oldParsed.profiles[0].smart) === '{}', 'an older backup without adaptive data imports with empty progress');
unlock(); oldStore.S.applyBackup(oldParsed, 'replace');
const oldProfile = oldStore.S.getProfiles()[0];
ok(oldStore.S.getSettings().smartDifficulty === 'off' && oldProfile.history.length === 1 && oldProfile.totals.games === 3 && oldProfile.bests['grade2|mixed|60'] === 5 && oldProfile.stickers.length === 1, 'older data keeps its history, totals, bests and stickers; Smart Difficulty is off');
const legacyMem = { 'mathQuizBattle.v1': JSON.stringify({ schema: 1, settings: { palette: 'cb' }, profiles: [{ id: 'p1', name: 'Zed', avatar: '🦊', smart: 'garbage' }] }) };
const legacy = freshStore(legacyMem);
ok(legacy.S.getProfiles()[0].name === 'Zed' && JSON.stringify(legacy.S.getProfiles()[0].smart) === '{}' && legacy.S.getSettings().smartDifficulty === 'off', 'schema 1 / damaged adaptive data loads safely');

// ---------- game flow (jsdom) ----------
const html = fs.readFileSync(dir + 'index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const sleep = ms => new Promise(res => setTimeout(res, ms));
(async () => {
  const seed = {
    schema: 2, settings: { palette: 'standard', text: 'normal', smartDifficulty: 'on' },
    profiles: [
      { id: 'pmia', name: 'Mia', avatar: '🦊', smart: { 'grade3|tables': { offset: 0, cd: 0, recent: rep(9, 1).map(c => ({ c, s: 2 })) } } },
      { id: 'pleo', name: 'Leo', avatar: '🐼', smart: { 'grade3|tables': { offset: 0, cd: 0, recent: [1, 1, 1, 0, 0, 0, 0, 0].map(c => ({ c, s: 4 })) } } }
    ]
  };
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('mathQuizBattle.v1', JSON.stringify(seed));
  ['questions.js', 'trophies.js', 'adaptive.js', 'parent.js', 'report.js', 'store.js', 'audio.js', 'menus.js', 'game.js'].forEach(f => w.eval(fs.readFileSync(dir + f, 'utf8')));
  const d = w.document, $ = id => d.getElementById(id);
  const tap = b => b.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  const click = b => b.click();
  const change = (sel, val) => { sel.value = val; sel.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const store = () => JSON.parse(w.localStorage.getItem('mathQuizBattle.v1'));
  const prof = id => store().profiles.find(p => p.id === id);
  const btns = i => [...d.querySelectorAll('.question-board')[i].querySelectorAll('.answer-button')];
  const solve = i => {
    const t = d.querySelectorAll('.question-board')[i].querySelector('.question-text').textContent; let m;
    if (m = t.match(/^What is (\d+) (×|÷) (\d+)\?$/)) return String(m[2] === '×' ? +m[1] * +m[3] : +m[1] / +m[3]);
    if (m = t.match(/^(\d+) × \? = (\d+)$/)) return String(+m[2] / +m[1]);
    throw new Error('cannot solve ' + t);
  };
  const right = i => btns(i).find(b => b.textContent.replace(/^[A-E]\. /, '') === solve(i));
  const wrong = i => btns(i).find(b => b !== right(i));
  const labelOf = i => d.querySelectorAll('.question-board')[i].querySelector('.difficulty-label').textContent;
  const setup = (mode, p1, p2, level = 'grade3', topic = 'tables') => {
    change($('difficulty1'), level); change($('topic1'), topic);
    if (mode === 'versus') { click(d.querySelector('[data-mode=versus]')); change($('difficulty2'), level); change($('topic2'), topic); change($('profile2'), p2 || ''); }
    else click(d.querySelector('[data-mode=solo]'));
    change($('profile1'), p1 || '');
    change($('difficulty1'), level); change($('topic1'), topic);
  };

  // Smart Difficulty OFF: exactly the chosen level, nothing recorded
  click($('settingsButton')); click(d.querySelector('[data-setting=smartDifficulty][data-value=off]')); click($('settingsClose'));
  ok(store().settings.smartDifficulty === 'off', 'turning it off in Settings is saved');
  setup('solo', 'pmia');
  click($('startButton')); await sleep(80);
  ok(labelOf(0) === 'Grade 3 · Times tables' && !d.querySelector('.smart-badge'), 'OFF: label is the chosen level and there is no Smart indicator');
  tap(right(0)); await sleep(60);
  ok(prof('pmia').smart['grade3|tables'].recent.length === 9 && prof('pmia').smart['grade3|tables'].offset === 0, 'OFF: no adaptive data is recorded or changed');
  click($('stopButton'));
  click($('changeSetupButton'));

  // ON, 1 vs 1: players are independent
  click($('settingsButton')); click(d.querySelector('[data-setting=smartDifficulty][data-value=on]')); click($('settingsClose'));
  ok(store().settings.smartDifficulty === 'on', 'turning it on is saved');
  ok($('difficulty1').value === 'grade3' && $('topic1').value === 'tables', 'turning it on does not change the manually chosen level or topic');
  setup('versus', 'pmia', 'pleo');
  click($('startButton')); await sleep(80);
  ok(d.querySelectorAll('.smart-badge').length === 2 && labelOf(0).includes('🎯') && labelOf(1).includes('Grade 3'), 'ON: Smart indicator on both players; both start at their chosen Grade 3');
  tap(right(0)); await sleep(60);                    // round 1: Mia answers, Leo does not
  ok(prof('pmia').smart['grade3|tables'].offset === 1, "Mia's 10th good answer moves only her up one step");
  ok(prof('pleo').smart['grade3|tables'].offset === 0 && prof('pleo').smart['grade3|tables'].recent.length === 8, "Leo, who did not answer, is untouched");
  ok($('roundFeedback').textContent.includes('Questions adjusted'), 'a short note shows that questions were adjusted');
  await sleep(950);                                  // round 2: new questions at each player's own level
  ok(labelOf(0).includes('Grade 4') && labelOf(1).includes('Grade 3'), 'next round: Mia gets Grade 4, Leo still Grade 3');
  tap(wrong(1)); tap(right(0)); await sleep(60);     // Leo wrong (locked out), Mia right
  ok(d.querySelectorAll('.question-board')[1].classList.contains('locked-out'), 'incorrect-answer locking still works in 1 vs 1');
  ok(prof('pleo').smart['grade3|tables'].offset === -1 && prof('pleo').smart['grade3|tables'].recent.length === 0, "Leo's poor recent answers move only him down one step");
  ok(prof('pmia').smart['grade3|tables'].offset === 1 && prof('pmia').smart['grade3|tables'].recent.length === 1, "Mia's progress carries on separately (cooldown keeps her at Grade 4)");
  ok(d.querySelectorAll('.score-value')[0].textContent === '2' && d.querySelectorAll('.score-value')[1].textContent === '0', 'scoring is unchanged (Mia 2, Leo 0)');
  await sleep(950);
  ok(labelOf(0).includes('Grade 4') && labelOf(1).includes('Grade 2'), 'next round: Mia Grade 4, Leo Grade 2');
  click($('stopButton'));
  ok(prof('pmia').history[0].level === 'grade3' && prof('pmia').lastSetup.difficulty === 'grade3' && prof('pleo').lastSetup.difficulty === 'grade3', 'saved history and last setup keep the level the players chose');
  ok(prof('pmia').trophies.grade3 && !prof('pmia').trophies.grade4, 'trophies and rewards stay with the chosen level');
  click($('changeSetupButton'));

  // profile switching and persistence
  setup('solo', 'pleo');
  click($('startButton')); await sleep(80);
  ok(labelOf(0).includes('Grade 2') && labelOf(0).includes('🎯'), "switching to Leo uses Leo's own saved level (Grade 2)");
  click($('stopButton')); click($('changeSetupButton'));
  setup('solo', 'pmia');
  click($('startButton')); await sleep(80);
  ok(labelOf(0).includes('Grade 4'), "switching to Mia uses Mia's own saved level (Grade 4)");
  click($('stopButton')); click($('changeSetupButton'));
  setup('solo', '');
  click($('startButton')); await sleep(80);
  const before = JSON.stringify(store().profiles);
  ok(labelOf(0).includes('Grade 3') && labelOf(0).includes('🎯'), 'a guest starts at the chosen level with Smart Difficulty on');
  tap(right(0)); await sleep(60);
  ok(JSON.stringify(store().profiles) === before, 'a guest never changes any saved profile');
  click($('stopButton')); click($('changeSetupButton'));

  // Profiles window shows the adjusted level; reload keeps everything
  click($('profilesButton'));
  const detailsButtons = [...d.querySelectorAll('#profileList button')].filter(b => b.textContent === 'Details');
  click(detailsButtons[1]);
  ok($('profileList').textContent.includes('Smart Difficulty') && $('profileList').textContent.includes('now Grade 2'), 'Profiles window shows Leo\'s current adjusted level');
  click($('profilesClose'));
  const dom2 = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  dom2.window.localStorage.setItem('mathQuizBattle.v1', w.localStorage.getItem('mathQuizBattle.v1'));
  ['questions.js', 'trophies.js', 'adaptive.js', 'parent.js', 'report.js', 'store.js', 'audio.js', 'menus.js', 'game.js'].forEach(f => dom2.window.eval(fs.readFileSync(dir + f, 'utf8')));
  const again = dom2.window.MQStore.getProfiles();
  ok(again[0].smart['grade3|tables'].offset === 1 && again[1].smart['grade3|tables'].offset === -1 && dom2.window.MQStore.getSettings().smartDifficulty === 'on', 'after a browser restart both players keep their own level and the setting');

  process.exit(failures ? 1 : (process.exitCode || 0));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
if (failures) process.exitCode = 1;
