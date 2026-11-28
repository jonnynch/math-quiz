// Grade 6 arithmetic calibration (add / sub / mul / div, plus signed-number add / sub): operand ranges,
// carrying/borrowing, question formats, one correct choice and the same-last-digit distractor.
// Also checks Grade 4 and Grade 5 keep their own ranges. Every answer is recomputed here from the
// question text; the generator's own answer field is only compared against that result.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const N = 600;   // questions per operation
const between = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const toNum = s => Number(String(s).replace(/,/g, '').replace('−', '-'));
const calc = (a, op, b) => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;

// Parses an arithmetic question into { op, a, b, r, format, unknown } and solves it independently.
// a op b = r always holds; `unknown` is the value the question asks for. Signed questions have format 'signed'.
function solve(text) {
  const n = '(\\d[\\d,]*)', sym = '([+−×÷])';
  let m;
  if ((m = text.match(/^(−?\d+) ([+−]) (\(−\d+\)|\d+) = \?$/)) && /−/.test(m[1] + m[3])) {
    const a = toNum(m[1]), b = toNum(m[3].replace(/[()]/g, ''));
    return { op: m[2], a, b, r: calc(a, m[2], b), format: 'signed', unknown: calc(a, m[2], b) };
  }
  if ((m = text.match(new RegExp(`^${n} ${sym} ${n} = \\?$`)))) {
    const a = toNum(m[1]), b = toNum(m[3]);
    return { op: m[2], a, b, r: calc(a, m[2], b), format: 'plain', unknown: calc(a, m[2], b) };
  }
  if ((m = text.match(new RegExp(`^${n} ${sym} ${n} = ${n}, so ${n} ${sym} ${n} = \\?$`)))) {
    const [a, b, r, x, y] = [toNum(m[1]), toNum(m[3]), toNum(m[4]), toNum(m[5]), toNum(m[7])];
    if (calc(a, m[2], b) !== r || x !== r) return null;
    return { op: m[2], a, b, r, format: 'inverse', unknown: calc(x, m[6], y) };
  }
  if ((m = text.match(new RegExp(`^□ ${sym} ${n} = ${n}$`)))) {
    const [op, b, r] = [m[1], toNum(m[2]), toNum(m[3])];
    const a = op === '+' ? r - b : op === '−' ? r + b : op === '×' ? r / b : r * b;
    return { op, a, b, r, format: 'missing', unknown: a };
  }
  if ((m = text.match(new RegExp(`^${n} ${sym} □ = ${n}$`)))) {
    const [a, op, r] = [toNum(m[1]), m[2], toNum(m[3])];
    const b = op === '+' ? r - a : op === '−' ? a - r : op === '×' ? r / a : a / r;
    return { op, a, b, r, format: 'missing', unknown: b };
  }
  return null;
}

// Number of place-value columns that carry (+) or borrow (−), propagating the carry/borrow.
function columns(op, a, b) {
  let count = 0, carry = 0;
  for (let p = 1; p <= 1000; p *= 10) {
    const x = Math.floor(a / p) % 10, y = Math.floor(b / p) % 10;
    carry = op === '+' ? (x + y + carry >= 10 ? 1 : 0) : (x - y - carry < 0 ? 1 : 0);
    count += carry;
  }
  return count;
}

// Choice checks shared by every question. Positive answers use thousands separators; negatives use "−".
function choices(tag, q, s) {
  if (q.answers.length !== 4 || new Set(q.answers).size !== 4) return fail(tag + 'need four distinct choices', q);
  if (!q.answers.every(a => /^(\d{1,3}(,\d{3})+|\d+|−\d+)$/.test(a))) fail(tag + 'choice not a clearly formatted integer', q);
  const values = q.answers.map(toNum);
  if (values.some((v, i) => i && v <= values[i - 1])) fail(tag + 'choices not ascending', q);
  const wanted = values.filter(v => v === s.unknown);
  if (wanted.length !== 1 || values[q.correct] !== s.unknown) fail(tag + 'wrong or non-unique correct answer', q);
  return values;
}
const sameLast = (values, q, unknown) => values.some((v, k) => k !== q.correct && Math.abs(v) % 10 === Math.abs(unknown) % 10);

const g6 = {
  add: s => s.op === '+' && between(s.a, 1000, 9999) && between(s.b, 1000, 9999) && s.r === s.a + s.b,
  sub: s => s.op === '−' && between(s.a, 2000, 9999) && between(s.b, 1000, 4999) && s.b < s.a && s.r === s.a - s.b && s.r > 0,
  mul: s => s.op === '×' && between(s.a, 12, 99) && between(s.b, 12, 25) && s.r === s.a * s.b,
  div: s => s.op === '÷' && between(s.r, 12, 99) && between(s.b, 12, 25) && s.a === s.b * s.r && s.a % s.b === 0,
};
const signedOk = s => between(Math.abs(s.a), 2, 30) && between(Math.abs(s.b), 2, 30) && s.unknown !== 0;
// The five required forms, from the signs of the two operands as written.
const signedForm = s => s.op === '+' ? (s.a < 0 && s.b > 0 ? 'negPos' : s.a > 0 && s.b < 0 ? 'posNeg' : s.a < 0 && s.b < 0 ? 'negNeg' : null)
  : (s.a > 0 && s.b < 0 ? 'posMinusNeg' : s.a < 0 && s.b > 0 ? 'negMinusPos' : null);

const signed = { total: 0, forms: {}, positive: 0, negative: 0 }, posAS = { total: 0, multi: 0 };
const OPS = { add: '+', sub: '−', mul: '×', div: '÷' };
for (const topic of ['add', 'sub', 'mul', 'div']) {
  const tag = 'grade6/' + topic + ': ', seen = { plain: 0, missing: 0, inverse: 0 };
  for (let i = 0; i < N; i++) {
    const q = Q.generateQuestion('grade6', topic), s = solve(q.question);
    if (!s) { fail(tag + 'unrecognised format', q); continue; }
    const values = choices(tag, q, s);
    if (!values) continue;
    if (s.op !== OPS[topic]) fail(tag + 'wrong operation', q);
    if (!Number.isInteger(s.a) || !Number.isInteger(s.b) || !Number.isInteger(s.r) || !Number.isInteger(s.unknown)) { fail(tag + 'non-integer value', q); continue; }
    if (s.format === 'signed') {
      signed.total++;
      const form = signedForm(s);
      if (!signedOk(s) || !form) { fail(tag + 'bad signed question', q); continue; }
      signed.forms[form] = (signed.forms[form] || 0) + 1;
      signed[s.unknown > 0 ? 'positive' : 'negative']++;
      if (!values.includes(-s.unknown)) fail(tag + 'opposite-sign answer should be offered', q);
      if (/-/.test(q.question + q.answers.join(''))) fail(tag + 'use the − sign, not a hyphen', q);
      continue;
    }
    if (!g6[topic](s)) { fail(tag + 'value outside specified range', q); continue; }
    if (!sameLast(values, q, s.unknown)) fail(tag + 'no same-last-digit distractor', q);
    seen[s.format]++;
    if (topic === 'add' || topic === 'sub') { posAS.total++; if (columns(s.op, s.a, s.b) >= 2) posAS.multi++; }
  }
  if (topic === 'add' || topic === 'sub') {
    for (const [k, min] of [['plain', 200], ['missing', 60], ['inverse', 40]]) if (seen[k] < min) fail(tag + 'format rarely used: ' + k, seen);
  } else {
    const mulKind = topic === 'mul' ? 'factor' : 'divisor';
    if (seen.inverse || seen.plain < N * 0.6) fail(tag + 'expected ordinary and missing-' + mulKind + ' questions only', seen);
    if (seen.missing < N * 0.18 || seen.missing > N * 0.32) fail(tag + 'missing ' + mulKind + ' should be about 25%', seen);
  }
}
if (posAS.multi < posAS.total * 0.7) fail('grade6 add/sub: carrying/borrowing across several columns should be common', posAS);
// Signed share of all Grade 6 addition/subtraction questions (generated above: N for add + N for sub).
const share = signed.total / (2 * N);
if (share < 0.16 || share > 0.30) fail('grade6 add/sub: signed questions should be about 20-25%', { share, signed });
for (const f of ['negPos', 'posNeg', 'negNeg', 'posMinusNeg', 'negMinusPos']) if ((signed.forms[f] || 0) < 10) fail('grade6 signed form rarely used: ' + f, signed);
if (signed.positive < signed.total * 0.2 || signed.negative < signed.total * 0.2) fail('grade6 signed: positive and negative results should both occur', signed);

// Mixed arithmetic keeps all four operations; Mixed All still generates valid questions.
{
  const ops = new Set();
  for (let i = 0; i < 400; i++) {
    const q = Q.generateQuestion('grade6', 'mixed'), s = solve(q.question);
    if (!s || !choices('grade6/mixed: ', q, s)) { fail('grade6/mixed: bad question', q); continue; }
    ops.add(s.op);
  }
  if (ops.size !== 4) fail('grade6/mixed: missing operations', [...ops]);
  for (let i = 0; i < 500; i++) {
    const q = Q.generateQuestion('grade6', 'all');
    if (q.answers.length < 2 || !(q.correct >= 0 && q.correct < q.answers.length) || new Set(q.answers).size !== q.answers.length) fail('grade6/all: invalid question', q);
  }
}

// Grade 4 and Grade 5 arithmetic keep their own ranges (plain digits, no separators, no negatives).
const g4 = {
  add: s => s.op === '+' && between(s.a, 120, 650) && between(s.b, 100, 300) && s.r <= 950,
  sub: s => s.op === '−' && between(s.a, 300, 999) && between(s.b, 100, 600) && s.r >= 100,
  mul: s => s.op === '×' && between(s.a, 12, 35) && between(s.b, 2, 6),
  div: s => s.op === '÷' && between(s.r, 12, 24) && between(s.b, 2, 9),
};
const g5 = {
  add: s => s.op === '+' && between(s.a, 250, 999) && between(s.b, 250, 999) && s.r === s.a + s.b,
  sub: s => s.op === '−' && between(s.a, 1000, 9999) && between(s.b, 100, 999) && s.r === s.a - s.b && s.r > 0,
  mul: s => s.op === '×' && between(s.a, 25, 99) && between(s.b, 6, 12) && s.r === s.a * s.b,
  div: s => s.op === '÷' && between(s.r, 25, 99) && between(s.b, 6, 12) && s.a === s.b * s.r && s.a % s.b === 0,
};
for (const [grade, ranges] of [[4, g4], [5, g5]]) {
  for (const topic of ['add', 'sub', 'mul', 'div']) {
    const tag = `grade${grade}/${topic}: `;
    for (let i = 0; i < 300; i++) {
      const q = Q.generateQuestion('grade' + grade, topic), s = solve(q.question);
      if (!s || s.format === 'signed' || /\d,\d{3}/.test(q.question) || !q.answers.every(a => /^\d+$/.test(a))) { fail(tag + 'unexpected format', q); continue; }
      if (!ranges[topic](s)) fail(tag + 'outside original range', q);
      if (q.answers[q.correct] !== String(s.unknown) || new Set(q.answers).size !== 4) fail(tag + 'wrong answer', q);
    }
  }
}

console.log(bad ? `FAILED (${bad})` : 'PASS grade6 arithmetic');
process.exit(bad ? 1 : 0);
