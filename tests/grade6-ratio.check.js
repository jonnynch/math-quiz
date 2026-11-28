// Grade 6 ratio: five independent question types (three-part, scaling, simplify, ratio-to-total, multi-step).
// Every answer is recomputed here from the question text; the generator's answer is only compared with it.
const fs = require('fs');
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const N = 1500;
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const ans = (q) => q.answers[q.correct];
const N_ = '(\\d+)';

// Question text -> { type, answer (string), ...checks }. Returns null when the text matches no Grade 6 format.
function solve(t) {
  let m;
  if ((m = t.match(/^(\w+) : (\w+) : (\w+) = (\d+):(\d+):(\d+)\. There are (\d+) ([a-z]+)\. How many are ([a-z]+)\?$/))) {
    const parts = m.slice(4, 7).map(Number), total = Number(m[7]), i = [m[1], m[2], m[3]].map(s => s.toLowerCase()).indexOf(m[9]), sum = parts[0] + parts[1] + parts[2];
    if (i < 0) return null;
    return { type: 'threePart', quantities: [...parts, total], exact: total % sum === 0, distinctTerms: new Set(parts).size, simplest: gcd(gcd(parts[0], parts[1]), parts[2]) === 1, answer: parts[i] * total / sum };
  }
  if ((m = t.match(/^(\d+|□):(\d+|□) = (\d+|□):(\d+|□)$/))) {
    const v = m.slice(1, 5).map(s => s === '□' ? null : Number(s)), pos = v.indexOf(null);
    if (v.filter(x => x === null).length !== 1) return null;
    const known = v.filter(x => x !== null), [a, b, c, d] = v;
    const answer = pos === 0 ? b * c / d : pos === 1 ? a * d / c : pos === 2 ? a * d / b : b * c / a;
    return { type: 'scaling', quantities: known, pos, exact: true, factor: pos === 0 || pos === 2 ? d / b : c / a, answer };
  }
  if ((m = t.match(/^Simplify (\d+):(\d+)\.$/))) {
    const a = Number(m[1]), b = Number(m[2]), g = gcd(a, b);
    return { type: 'simplify', quantities: [a, b], g, answer: `${a / g}:${b / g}` };
  }
  if ((m = t.match(/^The ratio of (.+) to (.+) is (\d+):(\d+)\. There are (\d+) (.+)\. How many are (.+)\?$/))) {
    const r = [Number(m[3]), Number(m[4])], total = Number(m[5]), i = [m[1], m[2]].indexOf(m[7]);
    if (i < 0) return null;
    return { type: 'totalParts', quantities: [...r, total], exact: total % (r[0] + r[1]) === 0, simplest: gcd(r[0], r[1]) === 1, answer: r[i] * total / (r[0] + r[1]) };
  }
  if ((m = t.match(/^The ratio of (.+) to (.+) is (\d+):(\d+)\. There are (\d+) (.+)\. How many (.+) are there altogether\?$/))) {
    const r = [Number(m[3]), Number(m[4])], known = Number(m[5]), i = [m[1], m[2]].indexOf(m[6]);
    if (i < 0) return null;
    return { type: 'multiStep', sub: 'total', quantities: [...r, known], exact: known % r[i] === 0, simplest: gcd(r[0], r[1]) === 1, answer: known / r[i] * (r[0] + r[1]) };
  }
  if ((m = t.match(/^The ratio of (.+) to (.+) is (\d+):(\d+)\. There are (\d+) more (.+) than (.+)\. How many (.+) are there\?$/))) {
    const r = [Number(m[3]), Number(m[4])], diff = Number(m[5]), hi = [m[1], m[2]].indexOf(m[6]), lo = [m[1], m[2]].indexOf(m[7]);
    if (hi < 0 || lo < 0 || hi === lo || m[8] !== m[6] || r[hi] <= r[lo]) return null;
    return { type: 'multiStep', sub: 'difference', quantities: [...r, diff], exact: diff % (r[hi] - r[lo]) === 0, simplest: gcd(r[0], r[1]) === 1, answer: diff / (r[hi] - r[lo]) * r[hi] };
  }
  if ((m = t.match(/^Share (\d+) (.+) in the ratio (\d+):(\d+)\. How many more does the larger share get\?$/))) {
    const total = Number(m[1]), r = [Number(m[3]), Number(m[4])], sum = r[0] + r[1];
    return { type: 'multiStep', sub: 'share', quantities: [...r, total], exact: total % sum === 0, simplest: gcd(r[0], r[1]) === 1, answer: Math.abs(r[0] - r[1]) * total / sum };
  }
  return null;
}

const qs = Array.from({ length: N }, () => Q.generateQuestion('grade6', 'ratio'));
const g5 = new Set(Array.from({ length: 4000 }, () => Q.generateQuestion('grade5', 'ratio').question));
const types = { threePart: 0, scaling: 0, simplify: 0, totalParts: 0, multiStep: 0 }, subs = { total: 0, difference: 0, share: 0 };
const positions = [0, 0, 0, 0], asked = [0, 0, 0], factors = new Set(), uniq = new Set();

for (const q of qs) {
  if (q.topic !== 'ratio') fail('topic', q);
  const s = solve(q.question);
  if (!s) { fail('unrecognised Grade 6 ratio question', q); continue; }
  if (q.kind !== s.type) fail('kind does not match question type', q);
  types[s.type]++; uniq.add(q.question);
  if (s.sub) subs[s.sub]++;
  if (g5.has(q.question)) fail('reuses a Grade 5 ratio question', q);

  // choices
  if (!Array.isArray(q.answers) || q.answers.length !== 4 || new Set(q.answers).size !== 4) fail('need four distinct choices', q);
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) { fail('correct index invalid', q); continue; }
  if (q.answers.filter(a => a === ans(q)).length !== 1) fail('correct answer must appear exactly once', q);
  if (s.type === 'simplify') {
    const pairs = q.answers.map(a => (a.match(/^(\d+):(\d+)$/) || []).slice(1).map(Number));
    if (pairs.some(p => p.length !== 2 || p[0] < 1 || p[1] < 1)) fail('simplify choices must be positive ratios', q);
    else if (pairs.some((p, i) => i && (pairs[i - 1][0] > p[0] || (pairs[i - 1][0] === p[0] && pairs[i - 1][1] >= p[1])))) fail('simplify choices not ascending', q);
  } else {
    const v = q.answers.map(a => /^\d+$/.test(a) ? Number(a) : NaN);
    if (v.some(x => !Number.isInteger(x) || x <= 0)) fail('choices must be positive whole numbers', q);
    else if (v.some((x, i) => i && v[i - 1] >= x)) fail('choices not in ascending order', q);
  }

  // question quantities and answer
  if (s.quantities.some(x => !Number.isInteger(x) || x <= 0)) fail('zero, negative or non-integer quantity', q);
  if (s.type === 'simplify') {
    if (s.g < 2) fail('simplify needs a common factor above 1', q);
    const [x, y] = ans(q).split(':').map(Number);
    if (gcd(x, y) !== 1) fail('answer not fully simplified', q);
  } else {
    if (s.exact === false || !Number.isInteger(s.answer) || s.answer <= 0) fail('result is not an exact positive whole number', q);
    if (s.simplest === false) fail('ratio in question is not in simplest form', q);
  }
  if (ans(q) !== String(s.answer)) fail('wrong answer', { q, expected: s.answer });

  if (s.type === 'threePart') { if (s.distinctTerms < 2) fail('three-part ratio has equal terms', q); asked[[...q.question.matchAll(/(\w+) : (\w+) : (\w+) =/g)][0].slice(1).map(x => x.toLowerCase()).indexOf(q.question.match(/How many are ([a-z]+)\?/)[1])]++; }
  if (s.type === 'scaling') { positions[s.pos]++; factors.add(s.factor); if (!Number.isInteger(s.factor) || s.factor < 3 || s.factor > 12) fail('scale factor outside 3-12', q); }
}

Object.entries(types).forEach(([k, v]) => { if (v < 100) fail('type rarely generated: ' + k, types); });
Object.entries(subs).forEach(([k, v]) => { if (v < 40) fail('multi-step variant rarely generated: ' + k, subs); });
if (positions.some(v => v < 40)) fail('missing value not spread over all four positions', positions);
if (asked.some(v => v < 40)) fail('three-part questions do not ask every part', asked);
if (factors.size < 8) fail('scaling factors lack variety', [...factors]);
if (uniq.size < N * 0.5) fail('too few distinct questions', uniq.size);

// Independence: the Grade 6 generator must not call the Grade 5 ratio generator.
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'questions.js'), 'utf8');
const body = src.slice(src.indexOf('function makeGrade6RatioQuestion'), src.indexOf('function makeGrade6AlgebraQuestion'));
if (!body || /makeGrade5RatioQuestion/.test(body)) fail('Grade 6 ratio generator uses the Grade 5 generator', {});

console.log(bad ? `FAILED (${bad})` : 'PASS grade6 ratio');
process.exit(bad ? 1 : 0);
