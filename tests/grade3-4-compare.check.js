// Grade 3 and Grade 4 comparisons (Numbers / compare): both sides are `a + b` or `a − b`, never a plain number.
// Every answer is recomputed here from the question text with exact integer arithmetic.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const LESS = '< (less than)', EQUAL = '= (equal to)', MORE = '> (greater than)', ALL = [LESS, EQUAL, MORE].join('|');
const rel = (x, y) => x < y ? LESS : x > y ? MORE : EQUAL;
const ans = (q) => q.answers[q.correct];
const N = 12000;
const EXPR = /^(\d+) ([+−]) (\d+)$/;
// Operand / result limits implied by each grade's generator (Grade 3 scales 2-250; Grade 4 uses 3-digit operands).
const GRADES = {
  grade3: { operand: [1, 750], result: [1, 500], sum: 500 },
  grade4: { operand: [50, 1350], result: [100, 1100], sum: 1100 },
};

for (const [grade, lim] of Object.entries(GRADES)) {
  const label = grade + '/compare', seen = { [LESS]: 0, [EQUAL]: 0, [MORE]: 0 };
  const ops = { '+': 0, '−': 0 }, pairs = { '+ +': 0, '− −': 0, mixed: 0 }, uniq = new Set();
  let total = 0, equalDifferent = 0;
  for (let i = 0; i < N; i++) {
    let q;
    try { q = Q.generateQuestion(grade, 'numbers'); } catch (e) { fail(label + ': generation error ' + e.message); continue; }
    if (q.topic !== 'numbers' || q.kind !== 'compare') continue;
    total++;
    const m = q.question.match(/^Compare: (.+) \? (.+)$/);
    if (!m) { fail(label + ': not a comparison', q); continue; }
    const s = [m[1], m[2]], e = s.map(t => t.match(EXPR));
    if (e.some(x => !x)) { fail(label + ': side is not an arithmetic expression', q); continue; }
    // answer choices: exactly <, =, > in order, no duplicates, valid index
    if (q.answers.join('|') !== ALL || new Set(q.answers).size !== 3 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 2) { fail(label + ': invalid answer choices', q); continue; }
    const vals = e.map(([, x, op, y]) => {
      const a = Number(x), b = Number(y);
      if (a < lim.operand[0] || a > lim.operand[1] || b < lim.operand[0] || b > lim.operand[1]) fail(label + ': operand out of range', q);
      ops[op]++;
      if (op === '+') { if (a + b > lim.sum) fail(label + ': sum too large', q); return a + b; }
      if (a <= b) fail(label + ': subtraction not positive', q);
      return a - b;
    });
    if (vals.some(v => v < lim.result[0] || v > lim.result[1])) fail(label + ': result out of range', q);
    if (ans(q) !== rel(vals[0], vals[1])) fail(label + ': wrong answer', q);
    seen[ans(q)]++; uniq.add(q.question);
    pairs[e[0][2] !== e[1][2] ? 'mixed' : e[0][2] === '+' ? '+ +' : '− −']++;
    if (s[0] === s[1]) fail(label + ': identical sides', q);
    if (vals[0] === vals[1]) equalDifferent++;
  }
  if (total < 500) fail(label + ': too few comparison questions sampled', total);
  Object.entries(seen).forEach(([k, v]) => { if (v < 100) fail(label + ': too few ' + k, seen); });
  Object.entries(ops).forEach(([k, v]) => { if (v < 100) fail(label + ': operation rarely used ' + k, ops); });
  Object.entries(pairs).forEach(([k, v]) => { if (v < 100) fail(label + ': side combination rarely used ' + k, pairs); });
  if (equalDifferent < 100) fail(label + ': too few equal values in different forms', equalDifferent);
  if (uniq.size < 300) fail(label + ': too few distinct questions', uniq.size);
}

// Mixed grade pools must also offer comparisons that are answered correctly.
for (const grade of Object.keys(GRADES)) {
  let seen = 0;
  for (let i = 0; i < 6000; i++) {
    const q = Q.generateQuestion(grade, 'all'), m = /^Compare: (\d+) ([+−]) (\d+) \? (\d+) ([+−]) (\d+)$/.exec(q.question);
    if (!m) continue;
    seen++;
    const v = (x, op, y) => op === '+' ? +x + +y : x - y;
    if (q.answers.join('|') !== ALL || ans(q) !== rel(v(m[1], m[2], m[3]), v(m[4], m[5], m[6]))) fail(grade + '/all: wrong comparison', q);
  }
  if (seen < 20) fail(grade + '/all: comparisons missing from mixed pool', seen);
}

console.log(bad ? `FAILED (${bad})` : 'PASS grade3-4 comparisons');
process.exit(bad ? 1 : 0);
