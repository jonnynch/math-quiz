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
    const [g1, g2] = q.picture.groups;
    if (a + b > 10 || a < 1 || b < 1) fail('add: sum over 10', q);
    if (q.picture.groups.length !== 2 || q.picture.joiner !== '+' || g1.emoji === g2.emoji) fail('add: two distinct groups joined by +', q);
    if (kept(g1) !== a || kept(g2) !== b || removed(g1) + removed(g2) + slots(g1) + slots(g2)) fail('add: picture does not match equation', q);
    if (!numeric(q.answers) || Number(q.answers[q.correct]) !== a + b || new Set(q.answers).size !== 4) fail('add: wrong answer', q);
    if (q.resultText !== `${a} + ${b} = ${a + b}`) fail('add: resultText', q);
  } else if (/^(\d+) − (\d+) = \?$/.test(q.question)) {
    seen.sub++;
    const [, a, b] = q.question.match(/^(\d+) − (\d+)/).map(Number);
    const gs = q.picture.groups;
    const total = gs.reduce((s, g) => s + objects(g), 0), gone = gs.reduce((s, g) => s + removed(g), 0), left = gs.reduce((s, g) => s + kept(g), 0);
    if (a > 10 || b >= a || b < 1) fail('sub: range / negative', q);
    if (total !== a || gone !== b || left !== a - b) fail('sub: picture does not show removed/remaining', q);
    if (gs.some(g => g.emoji !== gs[0].emoji) || gs.length !== 2) fail('sub: one kind of object in two groups', q);
    // removed objects are one whole group or the tail of one group (never scattered across both)
    if (gs.filter(g => removed(g) > 0).length !== 1) fail('sub: removed objects must sit in one group', q);
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
    // known objects and empty slots are each one contiguous block (so the missing part is easy to see)
    if (!/^X+O+$|^O+X+$/.test(rowText)) fail('missing: known and missing parts must be contiguous', q);
    if (q.question.startsWith('?') !== rowText.startsWith('O')) fail('missing: slots must come first only for "? + n"', q);
    const correct = q.answers.filter(a => Number(a) === total - known);
    if (!numeric(q.answers) || correct.length !== 1 || new Set(q.answers).size !== 4 || Number(q.answers[q.correct]) !== total - known) fail('missing: need exactly one correct answer', q);
    // the equation really holds only for the correct answer
    q.answers.forEach((a, j) => { if ((j === q.correct) !== (known + Number(a) === total)) fail('missing: ambiguous answers', q); });
    seen.missing += 0;
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
// The Age 2-3 and Age 5-6 generators are untouched.
for (let i = 0; i < 300; i++) {
  ['toddler', 'age5', 'age6'].forEach(l => { const q = Q.generateQuestion(l); if (q.picture || q.tier) fail('picture/tier leaked into ' + l, q); });
}
console.log('age4 questions checked:', N, seen, 'tiers', tiers, 'irregular', irregular + '/' + countTotal, 'bank', bank.length);
process.exit(bad ? 1 : 0);
