'use strict';
// Parent progress report: parent gate, statistics, missing vs zero data, CSV, backup compatibility, and the UI.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const dir = path.join(__dirname, '..', 'public') + '/';
const Parent = require(dir + 'parent.js'); // sets globalThis.MQParent, which report.js checks at call time
const Report = require(dir + 'report.js');
const S = require(dir + 'store.js');
const { solveParent } = require('./parent-solver');

const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const unlock = () => Parent.submit(solveParent(Parent.current().text));

// Small RFC 4180 reader, written independently of report.js, to prove the CSV is valid and round-trips.
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  if (quoted) throw new Error('unterminated quote');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const day = (d, h = 12) => new Date(2026, 10, d, h).getTime();
const game = (t, level, topic, taps, correctTaps, extra) => ({ t, level, topic, mode: 'solo', seconds: 0, score: correctTaps, taps, correctTaps, avgTime: 0, streak: 3, ...extra });
// Newest first, like the real history.
const mia = {
  id: 'pmia', name: 'Mia', avatar: '🦊',
  totals: { games: 5, correct: 63, taps: 90, correctTaps: 63, bestStreak: 8 },
  history: [
    game(day(9), 'grade3', 'fractions', 20, 18, { played: 120 }),
    game(day(9, 9), 'grade3', 'add', 20, 16, { played: 90 }),
    game(day(8), 'grade2', 'add', 20, 14),
    game(day(7), 'age5', 'mixed', 10, 9, { played: 60 }),
    game(day(6), 'grade2', 'fractions', 20, 6)
  ]
};
const leo = { id: 'pleo', name: 'Leo', avatar: '🐯', totals: { games: 1, correct: 4, taps: 5, correctTaps: 4, bestStreak: 2 }, history: [game(day(9), 'grade1', 'add', 5, 4, { played: 30 })] };
const blank = { id: 'pnew', name: 'New', avatar: '🐸', totals: {}, history: [] };
const summaryOnly = { id: 'psum', name: 'Old', avatar: '🐸', totals: { games: 7, taps: 100, correctTaps: 80 }, history: [] };

// ---------- parent verification ----------
const saved = globalThis.MQParent;
Parent.lock();
ok(Report.build(mia).denied === true && Report.toCsv(mia).denied === true, 'locked: report and CSV export are refused');
delete globalThis.MQParent;
ok(Report.build(mia).denied === true && Report.toCsv(mia).denied === true, 'no parent module: refused (fails closed)');
globalThis.MQParent = saved;
Parent.submit('1'); // wrong answer
ok(Report.build(mia).denied === true, 'a wrong answer does not unlock the report');
unlock();
ok(!Report.build(mia).denied && typeof Report.toCsv(mia) === 'string', 'after verification the report and CSV work');
Parent.lock();
ok(Report.build(mia).denied === true, 'locking again blocks the report');

// ---------- statistics ----------
unlock();
const r = Report.build(mia);
ok(r.totals.games === 5 && r.totals.answers === 90 && r.totals.correct === 63 && r.totals.accuracy === 70, 'totals: 63 of 90 = 70%');
ok(r.state === 'detailed' && r.saved.games === 5 && r.saved.missing === 0, 'five saved games, none missing');
ok(r.time.seconds === 270 && r.time.recordedGames === 3 && r.time.unrecordedGames === 2, 'play time adds only games that recorded it (270 s over 3 of 5)');
const lv = Object.fromEntries(r.byLevel.map(x => [x.level, x]));
ok(r.byLevel.map(x => x.level).join() === 'age5,grade2,grade3', 'levels listed in game order');
ok(lv.grade3.games === 2 && lv.grade3.answers === 40 && lv.grade3.correct === 34 && lv.grade3.accuracy === 85, 'Grade 3: 34 of 40 = 85%');
ok(lv.grade2.games === 2 && lv.grade2.correct === 20 && lv.grade2.answers === 40 && lv.grade2.accuracy === 50, 'Grade 2: 20 of 40 = 50%');
const tp = Object.fromEntries(r.byTopic.map(x => [x.topic, x]));
ok(!('mixed' in tp) && tp.add.games === 2 && tp.add.accuracy === 75 && tp.fractions.games === 2 && tp.fractions.accuracy === 60, 'topics: age-level games excluded; Add 30/40 = 75%, Fractions 24/40 = 60%');
ok(r.byDay.map(x => x.day).join() === '2026-11-06,2026-11-07,2026-11-08,2026-11-09' && r.byDay[3].games === 2 && r.byDay[3].accuracy === 85, 'progress by day, oldest first, two games on 9 Nov');
ok(r.trend && r.trend.direction === 'up' && r.trend.recent === 85 && r.trend.earlier === 58, 'trend: latest 2 games 85% vs 58% before = improving');
ok(r.recent.length === 5 && r.recent[0].accuracy === 90 && r.recent[0].played === 120 && r.recent[2].played === null, 'recent games newest first; unrecorded time is null, not 0');
ok(Report.build(leo).totals.correct === 4 && Report.build(leo).name === 'Leo' && !JSON.stringify(Report.build(leo)).includes('Mia'), "each report holds only its own profile's data");

// ---------- empty and incomplete history ----------
const b = Report.build(blank);
ok(b.state === 'none' && b.totals.games === 0 && b.totals.accuracy === null && b.time.seconds === null && b.byLevel.length === 0 && b.trend === null && /No games/.test(b.notes[0]), 'new profile: real zero, no accuracy, no breakdowns');
const so = Report.build(summaryOnly);
ok(so.state === 'summary' && so.totals.accuracy === 80 && so.saved.missing === 7 && /not saved/.test(so.notes[0]), 'totals without a game list: shown, and flagged as missing detail (not zero)');
const odd = Report.build({ name: 'X', totals: { games: 'a', taps: -4 }, history: [null, 5, { taps: 'z', correctTaps: 9, level: 'nope', t: 'x' }, { taps: 3, correctTaps: 99, level: 'grade1' }] });
ok(odd.totals.accuracy === null && odd.state === 'detailed' && odd.byLevel.every(x => x.correct <= x.answers) && odd.byDay.length === 0, 'damaged data does not crash and never reports more correct than answers');
ok(!Report.build(null).denied && Report.build(undefined).state === 'none', 'missing profile object is handled');
ok(Report.build({ ...mia, history: mia.history.slice(0, 2) }).notes.join(' ').includes('last 2 saved games'), 'a trimmed history says the breakdown covers fewer games than the total');
ok(Report.build({ ...mia, history: [mia.history[2]] }).trend === null, 'one game is too little for a trend');

// ---------- CSV ----------
ok(Report.csvCell('a,b') === '"a,b"' && Report.csvCell('say "hi"') === '"say ""hi"""' && Report.csvCell('l1\nl2') === '"l1\nl2"' && Report.csvCell(null) === '' && Report.csvCell(0) === '0', 'cell escaping: comma, quote, line break, blank vs zero');
ok(Report.csvCell('=SUM(A1)') === "'=SUM(A1)" && Report.csvCell('@x') === "'@x" && Report.csvCell('-1+2') === "'-1+2", 'text that looks like a formula is neutralised');
const nasty = { ...mia, name: 'A,"B"\nC' };
const csv = Report.toCsv(nasty, Date.UTC(2026, 10, 9, 1, 2, 3));
const rows = parseCsv(csv);
ok(csv.endsWith('\r\n') && !csv.includes('\uFEFF') && rows.find(x => x[0] === 'Profile')[1] === 'A,"B"\nC', 'CSV parses and the awkward name round-trips exactly');
ok(rows.find(x => x[0] === 'Exported (UTC)')[1] === '2026-11-09T01:02:03.000Z', 'export time is written as ISO (UTC)');
const val = (label) => rows.find(x => x[0].startsWith(label))[1];
ok(val('Games played') === '5' && val('Answers given') === '90' && val('Correct answers') === '63' && val('Accuracy') === '70' && val('Play time recorded') === '270' && val('Games with play time') === '3', 'CSV summary matches the report');
const head = rows.findIndex(x => x[0] === 'Date and time (UTC)');
const hist = rows.slice(head + 1);
ok(hist.length === 5 && hist.every(x => x.length === rows[head].length), 'one CSV row per saved game, same column count as the header');
ok(hist[0][1] === 'Grade 3' && hist[0][2] === 'Fractions' && hist[0][4] === '18' && hist[0][5] === '20' && hist[0][6] === '90' && hist[0][8] === '120', 'game row values are right');
ok(hist[2][8] === '' && hist[3][2] === '' && hist[0][7] === '', 'blank cells for not-recorded time, age-level topic and endless length');
const empty = parseCsv(Report.toCsv(blank, 0));
ok(empty.find(x => x[0] === 'Games played')[1] === '0' && empty.find(x => x[0].startsWith('Accuracy'))[1] === '' && empty.find(x => x[0] === 'Date and time (UTC)') && empty[empty.length - 1][0] !== undefined, 'empty profile exports a valid CSV: zero games, blank accuracy, header only');
ok(Report.filename({ name: 'Mia' }, day(9)) === 'math-quiz-progress-mia-2026-11-09.csv', 'filename is sensible');
ok(/^math-quiz-progress-profile-\d{4}-\d\d-\d\d\.csv$/.test(Report.filename({ name: '🦊🦊' })) && !/[\\/:*?"<>|\s,]/.test(Report.filename({ name: 'A/B: "x", y' }).slice(0, -4)), 'filename is safe for odd names');

// ---------- existing data and backups stay compatible ----------
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const old = S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [{ id: 'o1', name: 'Old', history: [{ t: 5, level: 'grade3', taps: 4, correctTaps: 3, seconds: 60 }], totals: { games: 1, taps: 4, correctTaps: 3 } }] }));
ok(!old.error && !('played' in old.profiles[0].history[0]), 'schema 1 backup without play time still imports (played stays absent, not 0)');
const ro = Report.build(old.profiles[0]);
ok(ro.state === 'detailed' && ro.time.recordedGames === 0 && ro.time.seconds === null && ro.totals.accuracy === 75, 'old profile gives a report with play time "not recorded"');
const withTime = S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 2, profiles: [{ id: 'n1', name: 'New', history: [{ t: 5, level: 'grade3', taps: 4, correctTaps: 3, played: 77.9 }, { t: 4, level: 'grade3', taps: 4, correctTaps: 3, played: -1 }, { t: 3, level: 'grade3', taps: 1, correctTaps: 1, played: 'x' }] }] }));
const hs = withTime.profiles[0].history;
ok(hs[0].played === 77 && !('played' in hs[1]) && !('played' in hs[2]), 'played is kept when valid and dropped when invalid');
ok(S.parseBackup(JSON.stringify({ app: 'mathQuizBattle', schema: 2, profiles: withTime.profiles })).profiles[0].history[0].played === 77, 'played survives a backup round trip');
Parent.lock();

// ---------- UI (jsdom) ----------
(async () => {
  const html = fs.readFileSync(dir + 'index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem('mathQuizBattle.v1', JSON.stringify({ schema: 2, settings: {}, profiles: [mia, leo] }));
  ['questions.js', 'trophies.js', 'adaptive.js', 'parent.js', 'report.js', 'store.js', 'menus.js', 'game.js'].forEach(f => w.eval(fs.readFileSync(dir + f, 'utf8')));
  const d = w.document;
  const $ = (id) => d.getElementById(id);
  const click = (el) => el.click();
  const text = () => $('reportBody').textContent;
  const downloads = [];
  w.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } };
  w.URL.createObjectURL = (blob) => { downloads.push({ blob }); return 'blob:test'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloads[downloads.length - 1].name = this.download; };

  click($('reportButton'));
  ok(!$('reportModal').classList.contains('hidden') && !!$('reportChallenge') && $('reportContent').classList.contains('hidden') && $('reportBody').textContent === '', 'Progress opens locked: question shown, no report content');
  $('reportAnswer').value = '1'; click(d.querySelector('#reportLock .primary-button'));
  ok($('reportContent').classList.contains('hidden') && !!$('reportChallenge') && $('reportMessage'), 'a wrong answer keeps the report hidden');
  $('reportAnswer').value = solveParent($('reportChallenge').textContent); click(d.querySelector('#reportLock .primary-button'));
  ok(!$('reportContent').classList.contains('hidden') && $('reportProfile').options.length === 2, 'correct answer shows the report with a saved-profile picker only');
  ok($('reportProfile').value === 'pmia' && text().includes('63 of 90') && text().includes('70%') && text().includes('Grade 3') && text().includes('5 min') && /Improving/.test(text()), "Mia's report shows her totals, levels, play time and trend");
  ok(text().includes('Play time is only available for 3 of 5'), 'missing play time is explained');
  $('reportProfile').value = 'pleo'; $('reportProfile').dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(text().includes('4 of 5') && !text().includes('63 of 90') && !text().includes('Grade 3'), "switching profile shows only Leo's data");
  click($('reportExportButton'));
  const dl = downloads[0];
  ok(dl && dl.name === Report.filename(leo, Date.now()) && dl.blob.parts[0] === '\uFEFF' && dl.blob.opts.type.startsWith('text/csv') && parseCsv(dl.blob.parts[1]).find(x => x[0] === 'Profile')[1] === 'Leo', 'Export CSV downloads the selected profile as a CSV file');
  ok(!$('reportMessage').classList.contains('hidden') && $('reportMessage').textContent.includes('nothing was sent'), 'export confirms that nothing is sent anywhere');
  click($('reportClose'));
  ok(!w.MQParent.isUnlocked(), 'closing the window locks parent access again');
  click($('reportButton'));
  ok($('reportContent').classList.contains('hidden') && !!$('reportChallenge'), 'reopening needs a new verification');
  click($('reportClose'));
  w.MQStore._reset();
  click($('reportButton')); $('reportAnswer').value = solveParent($('reportChallenge').textContent); click(d.querySelector('#reportLock .primary-button'));
  ok($('reportBody').textContent.includes('No saved profiles') && $('reportExportButton').disabled, 'no saved profiles: clear message, export disabled');
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
