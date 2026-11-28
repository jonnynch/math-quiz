// Grade 5 arithmetic calibration (add / sub / mul / div): operand and answer ranges, exact answers,
// one correct choice, same-last-digit distractor. Also checks Grade 4 keeps its own ranges (Grade 6: grade6-arithmetic.check.js).
// Every answer is recomputed here from the question text.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const N = 1000;   // questions per operation
const between = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;

// Parses an arithmetic question into { op, a, b, r, format, unknown } and solves it independently.
// a op b = r always holds; `unknown` is the value the question asks for.
function solve(text) {
  const num = '(−?\\d+)', sym = '([+−×÷])';
  const calc = (a, op, b) => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
  let m;
  if ((m = text.match(new RegExp(`^${num} ${sym} (\\d+) = \\?$`)))) {
    const a = +m[1].replace('−', '-'), b = +m[3];
    return { op: m[2], a, b, r: calc(a, m[2], b), format: 'plain', unknown: calc(a, m[2], b) };
  }
  if ((m = text.match(new RegExp(`^(\\d+) ${sym} (\\d+) = (\\d+), so (\\d+) ${sym} (\\d+) = \\?$`)))) {
    const [a, b, r, x, y] = [+m[1], +m[3], +m[4], +m[5], +m[7]];
    if (calc(a, m[2], b) !== r || x !== r) return null;
    return { op: m[2], a, b, r, format: 'inverse', unknown: calc(x, m[6], y) };
  }
  if ((m = text.match(new RegExp(`^□ ${sym} (\\d+) = (\\d+)$`)))) {
    const [op, b, r] = [m[1], +m[2], +m[3]];
    const a = op === '+' ? r - b : op === '−' ? r + b : op === '×' ? r / b : r * b;
    return { op, a, b, r, format: 'missing', unknown: a, side: 'first' };
  }
  if ((m = text.match(new RegExp(`^(\\d+) ${sym} □ = (\\d+)$`)))) {
    const [a, op, r] = [+m[1], m[2], +m[3]];
    const b = op === '+' ? r - a : op === '−' ? a - r : op === '×' ? r / a : a / r;
    return { op, a, b, r, format: 'missing', unknown: b, side: 'second' };
  }
  return null;
}

// Column test: does the sum carry (+) or the subtraction borrow (−) in any place value?
const digit = (n, place) => Math.floor(n / place) % 10;
const crosses = (op, a, b) => [1, 10, 100].some(p => op === '+' ? digit(a, p) + digit(b, p) >= 10 : digit(a, p) < digit(b, p));

function check(grade, topic, label, rangeFn, extra) {
  const seen = { plain: 0, missing: 0, inverse: 0, crossing: 0, missingFactor: 0 };
  for (let i = 0; i < N; i++) {
    const q = Q.generateQuestion('grade' + grade, topic), tag = label + ': ';
    const s = solve(q.question);
    if (!s) { fail(tag + 'unrecognised format', q); continue; }
    if (q.answers.length !== 4 || new Set(q.answers).size !== 4) fail(tag + 'need four distinct choices', q);
    const wanted = String(s.unknown);
    if (q.answers.filter(a => a === wanted).length !== 1 || q.answers[q.correct] !== wanted) fail(tag + 'wrong or non-unique correct answer', q);
    if (!q.answers.every(a => /^\d+$/.test(a))) fail(tag + 'choices must be whole non-negative numbers', q);
    if (grade >= 4 && !q.answers.some((a, k) => k !== q.correct && a.slice(-1) === wanted.slice(-1))) fail(tag + 'no same-last-digit distractor', q);
    if (!Number.isInteger(s.a) || !Number.isInteger(s.b) || !Number.isInteger(s.r)) fail(tag + 'non-integer value', q);
    if (!rangeFn(s)) fail(tag + 'value outside specified range', q);
    seen[s.format]++;
    if (s.format === 'missing' && (s.op === '×' || s.op === '÷')) seen.missingFactor++;
    if (extra && crosses(s.op, s.a, s.b)) seen.crossing++;
  }
  return seen;
}

const g5 = {
  add: s => s.op === '+' && between(s.a, 250, 999) && between(s.b, 250, 999) && s.r === s.a + s.b && s.r > 0,
  sub: s => s.op === '−' && between(s.a, 1000, 9999) && between(s.b, 100, 999) && s.r === s.a - s.b && s.r > 0,
  mul: s => s.op === '×' && between(s.a, 25, 99) && between(s.b, 6, 12) && s.r === s.a * s.b,
  div: s => s.op === '÷' && between(s.r, 25, 99) && between(s.b, 6, 12) && s.a === s.b * s.r && s.a % s.b === 0,
};
const fmt = (label, seen) => [['plain', 400], ['missing', 100], ['inverse', 60]].forEach(([k, min]) => { if (seen[k] < min) fail(label + ': format rarely used: ' + k, seen); });

for (const topic of ['add', 'sub']) {
  const label = 'grade5/' + topic, seen = check(5, topic, label, g5[topic], true);
  fmt(label, seen);
  if (seen.crossing < N * 0.7) fail(label + ': carrying/borrowing should appear in most questions', seen);
}
for (const [topic, op] of [['mul', '×'], ['div', '÷']]) {
  const label = 'grade5/' + topic, seen = check(5, topic, label, g5[topic], false);
  if (seen.plain < 500 || seen.inverse) fail(label + ': expected ordinary questions', seen);
  if (seen.missingFactor < N * 0.18 || seen.missingFactor > N * 0.32) fail(label + ': missing ' + (op === '×' ? 'factor' : 'divisor') + ' should be about 25%', seen);
}

// Grade 5 mixed arithmetic keeps all four operations; Mixed All still generates valid questions.
{
  const ops = new Set();
  for (let i = 0; i < 400; i++) {
    const q = Q.generateQuestion('grade5', 'mixed'), s = solve(q.question);
    if (!s || !g5[{ '+': 'add', '−': 'sub', '×': 'mul', '÷': 'div' }[s.op]](s) || q.answers[q.correct] !== String(s.unknown)) fail('grade5/mixed: bad question', q);
    else ops.add(s.op);
  }
  if (ops.size !== 4) fail('grade5/mixed: missing operations', [...ops]);
  for (let i = 0; i < 500; i++) {
    const q = Q.generateQuestion('grade5', 'all');
    if (q.answers.length < 2 || !(q.correct >= 0 && q.correct < q.answers.length) || new Set(q.answers).size !== q.answers.length) fail('grade5/all: invalid question', q);
  }
}

// Grade 4 arithmetic keeps its original ranges.
const g4 = {
  add: s => s.op === '+' && between(s.a, 120, 650) && between(s.b, 100, 300) && s.r <= 950,
  sub: s => s.op === '−' && between(s.a, 300, 999) && between(s.b, 100, 600) && s.r >= 100,
  mul: s => s.op === '×' && between(s.a, 12, 35) && between(s.b, 2, 6),
  div: s => s.op === '÷' && between(s.r, 12, 24) && between(s.b, 2, 9),
};
for (const topic of ['add', 'sub', 'mul', 'div']) {
  check(4, topic, 'grade4/' + topic, g4[topic], false);
}

console.log(bad ? `FAILED (${bad})` : 'PASS grade5 arithmetic');
process.exit(bad ? 1 : 0);
