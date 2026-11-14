// Age 4: exactly five picture question types (count, compare, add, subtract, missing number), all within 10.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 10) console.log('FAIL', m, JSON.stringify(q)); };
const N = 6000;
const cnt = (rows, re) => rows.join('').replace(re, '').length;
const objects = (g) => g.rows.join('').replace(/[^Xx]/g, '').length;      // objects incl. crossed out
const kept = (g) => g.rows.join('').replace(/[^X]/g, '').length;
const removed = (g) => g.rows.join('').replace(/[^x]/g, '').length;
const slots = (g) => g.rows.join('').replace(/[^O]/g, '').length;
// Layout rule, restated from the spec: all numbers (answer included) in {3,6,9} -> 3 per row; else all in {2,4,6,8}
// -> two rows filled column by column; else 5 per row filled in reading order.
function expectedRows(seq, nums) {
  if (nums.every(n => [3, 6, 9].includes(n))) return seq.match(/.{1,3}/g);
  if (nums.every(n => [2, 4, 6, 8].includes(n))) return [0, 1].map(r => [...seq].filter((_, i) => i % 2 === r).join(''));
  return seq.match(/.{1,5}/g);
}
const seen = { count: 0, compare: 0, add: 0, sub: 0, missing: 0 };
const arrangements = {};                                  // count -> Set of arrangement keys
let irregular = 0, countTotal = 0;
const tiers = {};
const GROUPS = new Set();

for (let i = 0; i < N; i++) {
  const q = Q.generateQuestion('age4');
  if (!q.simple) fail('not simple', q);
  if (q.answers.length !== 4 && !q.groups) fail('need 4 numeric choices', q);
  if (!(q.tier >= 1 && q.tier <= 3)) fail('missing tier', q);
  tiers[q.tier] = (tiers[q.tier] || 0) + 1;
  if (/fewer|less|same|[×÷]|shape|clock|\$|left|right|heavier|lighter|quicker|pattern|next/i.test(q.question)) fail('excluded wording', q);
  const numeric = (a) => a.every(x => /^\d+$/.test(x));

  if (q.question === 'How many?') {
    seen.count++; countTotal++;
    const g = q.picture.groups[0], n = objects(g);
    if (q.picture.groups.length !== 1 || n < 1 || n > 10 || removed(g) || slots(g)) fail('count: 1-10 plain objects', q);
    if (!numeric(q.answers) || new Set(q.answers).size !== 4 || Number(q.answers[q.correct]) !== n) fail('count: wrong answer/choices', q);
    if (q.answers.some(a => +a < 1 || +a > 10)) fail('count: choices out of range', q);
    if (!g.rows.every(r => /^[X.]+$/.test(r))) fail('count: bad cells', q);
    (arrangements[n] = arrangements[n] || new Set()).add(q.picture.key.split(' ').slice(2).join(' '));
    if (q.picture.key.endsWith('irregular')) irregular++;
  } else if (q.question === 'Which group has more?') {
    seen.compare++;
    if (!q.groups || q.picture || q.answers.length !== 2 || q.answerLabels.length !== 2) fail('compare: two tappable groups', q);
    const g = q.answers.map(a => [...a].filter(c => c !== '\uFE0F' && c !== '\n'));
    const n = g.map(a => a.length);
    if (n.some(v => v < 1 || v > 10) || n[0] === n[1]) fail('compare: range/equal', q);
    if (new Set(g[0]).size !== 1 || new Set(g[1]).size !== 1 || g[0][0] === g[1][0]) fail('compare: need two different kinds', q);
    if (q.correct !== (n[0] > n[1] ? 0 : 1)) fail('compare: correct must be the larger group', q);
    if (q.answers.some(a => /\d/.test(a))) fail('compare: no written choices', q);
    const gap = Math.abs(n[0] - n[1]), big = Math.max(...n);
    if (q.tier !== (gap === 1 ? 3 : gap >= 3 && big <= 6 ? 1 : 2)) fail('compare: tier', q);
    GROUPS.add(gap);
  } else if (/^(\d+) \+ (\d+) = \?$/.test(q.question)) {
    seen.add++;
    const [, a, b] = q.question.match(/^(\d+) \+ (\d+)/).map(Number);
    const g1 = q.picture.groups[0], flat = g1.rows.join('');
    if (a + b > 10 || a < 1 || b < 1) fail('add: sum over 10', q);
    if (q.picture.joiner) fail('add: no plus sign between groups', q);
    if (q.picture.groups.length !== 1 || !g1.emoji2 || g1.emoji === g1.emoji2) fail('add: one frame, two kinds of object', q);
    if (cnt([flat], /[^X]/g) !== a || cnt([flat], /[^Y]/g) !== b || flat.length !== a + b) fail('add: picture does not match equation', q);
    if (g1.rows.join() !== expectedRows('X'.repeat(a) + 'Y'.repeat(b), [a, b, a + b]).join()) fail('add: layout rule', q);
    if (!numeric(q.answers) || Number(q.answers[q.correct]) !== a + b || new Set(q.answers).size !== 4) fail('add: wrong answer', q);
    if (q.resultText !== `${a} + ${b} = ${a + b}`) fail('add: resultText', q);
  } else if (/^(\d+) − (\d+) = \?$/.test(q.question)) {
    seen.sub++;
    const [, a, b] = q.question.match(/^(\d+) − (\d+)/).map(Number);
    const gs = q.picture.groups;
    const total = gs.reduce((s, g) => s + objects(g), 0), gone = gs.reduce((s, g) => s + removed(g), 0), left = gs.reduce((s, g) => s + kept(g), 0);
    if (a > 10 || b >= a || b < 1) fail('sub: range / negative', q);
    if (total !== a || gone !== b || left !== a - b) fail('sub: picture does not show removed/remaining', q);
    if (gs.length !== 1 || q.picture.groups[0].rows.join('').length !== a) fail('sub: one frame holding exactly the starting objects', q);
    if (gs[0].rows.join() !== expectedRows('X'.repeat(a - b) + 'x'.repeat(b), [a, b, a - b]).join()) fail('sub: layout rule', q);
    if (!numeric(q.answers) || Number(q.answers[q.correct]) !== a - b || Number(q.answers[q.correct]) < 0) fail('sub: wrong answer', q);
    if (q.resultText !== `${a} − ${b} = ${a - b}`) fail('sub: resultText', q);
  } else if (/\?/.test(q.question)) {
    seen.missing++;
    const m = q.question.match(/^(\d+) \+ \? = (\d+)$/) || q.question.match(/^\? \+ (\d+) = (\d+)$/);
    if (!m) { fail('unrecognised question', q); continue; }
    const known = Number(m[1]), total = Number(m[2]), g = q.picture.groups[0];
    const rowText = g.rows.join('');
    if (total > 10 || known < 1 || known >= total) fail('missing: range', q);
    if (q.picture.groups.length !== 1 || kept(g) !== known || slots(g) !== total - known) fail('missing: picture does not match equation', q);
    const correct = q.answers.filter(a => Number(a) === total - known);
    if (!numeric(q.answers) || correct.length !== 1 || new Set(q.answers).size !== 4 || Number(q.answers[q.correct]) !== total - known) fail('missing: need exactly one correct answer', q);
    // the equation really holds only for the correct answer
    q.answers.forEach((a, j) => { if ((j === q.correct) !== (known + Number(a) === total)) fail('missing: ambiguous answers', q); });
    const seq = q.question.startsWith('?') ? 'O'.repeat(total - known) + 'X'.repeat(known) : 'X'.repeat(known) + 'O'.repeat(total - known);
    if (g.rows.join() !== expectedRows(seq, [known, total - known, total]).join()) fail('missing: layout rule / order of addends', q);
  } else fail('unknown question type', q);
  q.answers.forEach((a, j, arr) => { if (/^\d+$/.test(a) && j && Number(a) <= Number(arr[j - 1])) fail('numeric answers must ascend', q); });
}

Object.entries(seen).forEach(([k, v]) => { if (v < N * 0.12) fail('type under-represented: ' + k, seen); });
// Same quantity, different arrangements, including recognisable patterns and occasional irregular ones.
for (let n = 4; n <= 10; n++) if (!arrangements[n] || arrangements[n].size < 3) fail('count ' + n + ' needs several arrangements', [...(arrangements[n] || [])]);
if (irregular < countTotal * 0.1 || irregular > countTotal * 0.4) fail('irregular arrangements should be occasional', { irregular, countTotal });
const rowOf5Only = Object.values(arrangements).every(s => [...s].every(k => /XXXXX/.test(k)));
if (rowOf5Only) fail('counting must not always use rows of five', {});
['X.X/.X./X.X', 'XXX/XXX/XXX'].forEach(p => { if (!Object.values(arrangements).some(s => s.has(p))) fail('missing recognisable pattern ' + p, {}); });
// Compare: clearly different quantities and close ones both appear (1 apart e.g. 7 vs 8).
if (!GROUPS.has(1) || ![...GROUPS].some(g => g >= 4)) fail('compare needs close and clearly different pairs', [...GROUPS]);
// Every layout in the table really holds n objects.
// (Checked via generated keys: each count question's picture has exactly the answer's number of objects, see above.)

// Progression: the bank is tiered, and the first questions of a game are the easiest.
const bank = Q.buildQuestionBank('age4');
if (bank.length < 150 || new Set(bank.map(Q.questionKey)).size !== bank.length) fail('bank size / duplicates', bank.length);
if (![1, 2, 3].every(t => bank.some(q => q.tier === t))) fail('bank must contain every tier', tiers);
let early = 0, late = 0;
for (let g = 0; g < 200; g++) {
  const deck = Q.createQuestionDeck(bank);
  const first = Array.from({ length: 6 }, () => deck.next());
  if (first.some(q => q.tier !== 1)) fail('first 6 questions must be tier 1', first.map(q => q.tier));
  const seenKeys = new Set(first.map(Q.questionKey));
  for (let j = 0; j < 34; j++) { const q = deck.next(); if (seenKeys.has(Q.questionKey(q))) fail('repeat within first round', q); seenKeys.add(Q.questionKey(q)); if (j >= 6) late += q.tier / 28; else early += q.tier / 6; }
  if (first.length !== 6) fail('deal', first);
}
if (!(late / 200 > 2.2 && late > early)) fail('later questions should be harder on average', { early: early / 200, late: late / 200 });
// Layout selection looks at every number, answer included (X known/first, Y second, x crossed out, O missing).
{
  const want = {
    '? + 6 = 10': ['OOOOX', 'XXXXX'], '3 + 3 = ?': ['XXX', 'YYY'], '? + 3 = 10': ['OOOOO', 'OOXXX'], '3 + ? = 10': ['XXXOO', 'OOOOO'], '7 + ? = 10': ['XXXXX', 'XXOOO'],
    '6 + ? = 9': ['XXX', 'XXX', 'OOO'], '? + 3 = 9': ['OOO', 'OOO', 'XXX'],
    '8 − 4 = ?': ['XXxx', 'XXxx'], '6 − 3 = ?': ['XXX', 'xxx'], '7 − 2 = ?': ['XXXXX', 'xx'],
    '2 + 4 = ?': ['XYY', 'XYY'],
    '3 + 6 = ?': ['XXX', 'YYY', 'YYY'], '4 + 3 = ?': ['XXXXY', 'YY'], '5 + 4 = ?': ['XXXXX', 'YYYY'],
    '? + 4 = 8': ['OOXX', 'OOXX'], '2 + ? = 4': ['XO', 'XO'], '4 + ? = 6': ['XXO', 'XXO'], '5 + ? = 7': ['XXXXX', 'OO']
  };
  const found = {};
  const total = Object.keys(want).length;
  for (let i = 0; i < 60000 && Object.keys(found).length < total; i++) {
    const q = Q.generateQuestion('age4');
    if (want[q.question] && q.picture) found[q.question] = q.picture.groups[0].rows;
  }
  Object.entries(want).forEach(([k, rows]) => { if (!found[k] || found[k].join() !== rows.join()) fail('layout for ' + k, found[k]); });
}
// The Age 2-3 and Age 6 generators are untouched (Age 5 has its own pictures and tiers, see age5.check.js).
for (let i = 0; i < 300; i++) {
  ['toddler', 'age6'].forEach(l => { const q = Q.generateQuestion(l); if (q.picture || q.tier) fail('picture/tier leaked into ' + l, q); });
  const q5 = Q.generateQuestion('age5');
  if (q5.stage) fail('Age 5 no longer uses the object stage', q5);
}
console.log('age4 questions checked:', N, seen, 'tiers', tiers, 'irregular', irregular + '/' + countTotal, 'bank', bank.length);
process.exit(bad ? 1 : 0);
