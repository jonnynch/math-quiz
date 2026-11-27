// Grade 5 comparisons: decimal vs decimal, fraction vs decimal, fraction vs fraction, whole numbers / expressions.
// Every answer is recomputed here with exact integer arithmetic from the question text.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const LESS = '< (less than)', EQUAL = '= (equal to)', MORE = '> (greater than)', ALL = [LESS, EQUAL, MORE].join('|');
const N = 6000;
const rel = (x, y) => x < y ? LESS : x > y ? MORE : EQUAL;
const ans = (q) => q.answers[q.correct];
const milli = (s) => { const [i, f = ''] = s.split('.'); return Number(i) * 1000 + Number(f.padEnd(3, '0')); };   // exact thousandths
const DEC = /^\d+\.\d{1,3}$/, FRAC = /^(\d+)\/(\d+)$/;
const places = (s) => s.split('.')[1].length;

function collect(topic, kind, count = N) {
  const out = [];
  for (let i = 0; i < count; i++) { const q = Q.generateQuestion('grade5', topic); if (q.topic === topic && q.kind === kind) out.push(q); }
  return out;
}
const outcomes = () => ({ [LESS]: 0, [EQUAL]: 0, [MORE]: 0 });
function needAll(label, seen, min = 100) { Object.entries(seen).forEach(([k, v]) => { if (v < min) fail(label + ': too few ' + k, seen); }); }
function sides(label, q) { const m = q.question.match(/^Compare: (.+) \? (.+)$/); if (!m) fail(label + ': not a comparison', q); return m && [m[1], m[2]]; }

// ---- Decimal vs decimal
{
  const label = 'decimals/compare', qs = collect('decimals', 'compare'), seen = outcomes(), pl = new Set(), uniq = new Set();
  let equalDiffPlaces = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    if (!s.every(x => DEC.test(x)) || q.answers.join('|') !== ALL) { fail(label + ': format', q); continue; }
    const [a, b] = s.map(milli);
    if (a <= 0 || b <= 0 || a >= 3000 || b >= 3000) fail(label + ': value range', q);
    if (ans(q) !== rel(a, b)) fail(label + ': wrong answer', q);
    seen[ans(q)]++; uniq.add(q.question); s.forEach(x => pl.add(places(x)));
    if (a === b) { if (places(s[0]) === places(s[1])) fail(label + ': equal values must use different places', q); else equalDiffPlaces++; }
    else if (s.some(x => /\d0$/.test(x))) fail(label + ': trailing zero on unequal values', q);
  }
  needAll(label, seen);
  if (![1, 2, 3].every(p => pl.has(p))) fail(label + ': tenths, hundredths and thousandths not all used', [...pl]);
  if (equalDiffPlaces < 50) fail(label + ': too few equal-value cases', equalDiffPlaces);
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Fraction vs decimal
{
  const label = 'fractions/compare', qs = collect('fractions', 'compare'), seen = outcomes(), dens = new Set(), uniq = new Set();
  let fracFirst = 0, decFirst = 0, trailing = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    const dec = s.filter(x => DEC.test(x)), fr = s.filter(x => FRAC.test(x));
    if (dec.length !== 1 || fr.length !== 1 || q.answers.join('|') !== ALL) { fail(label + ': one decimal and one fraction expected', q); continue; }
    const [, n, d] = fr[0].match(FRAC).map(Number), v = milli(dec[0]);
    if (![2, 4, 5, 8, 10, 20, 25].includes(d) || n < 1 || n >= d || v <= 0 || v >= 1000) fail(label + ': range', q);
    const cmp = s[0] === dec[0] ? rel(v * d, 1000 * n) : rel(1000 * n, v * d);   // cross-multiplied, exact
    if (ans(q) !== cmp) fail(label + ': wrong answer', q);
    seen[ans(q)]++; dens.add(d); uniq.add(q.question);
    if (s[0] === fr[0]) fracFirst++; else decFirst++;
    if (ans(q) === EQUAL && /0$/.test(dec[0])) trailing++;
  }
  needAll(label, seen);
  if (dens.size < 6) fail(label + ': denominators lack variety', [...dens]);
  if (fracFirst < 100 || decFirst < 100) fail(label + ': fraction/decimal order not mixed', { fracFirst, decFirst });
  if (trailing < 10) fail(label + ': no equal pairs like 1/2 ? 0.50', trailing);
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Fraction vs fraction
{
  const label = 'fractions/compareFractions', qs = collect('fractions', 'compareFractions'), seen = outcomes(), dens = new Set(), uniq = new Set();
  let equivalent = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    if (!s.every(x => FRAC.test(x)) || q.answers.join('|') !== ALL) { fail(label + ': two fractions expected', q); continue; }
    const [[, n1, d1], [, n2, d2]] = s.map(x => x.match(FRAC).map(Number));
    if (n1 < 1 || n2 < 1 || n1 >= d1 || n2 >= d2 || d1 > 20 || d2 > 20 || s[0] === s[1]) fail(label + ': range or identical sides', q);
    if (ans(q) !== rel(n1 * d2, n2 * d1)) fail(label + ': wrong answer', q);
    seen[ans(q)]++; dens.add(d1); dens.add(d2); uniq.add(q.question);
    if (n1 * d2 === n2 * d1) equivalent++;
  }
  needAll(label, seen);
  if (dens.size < 8) fail(label + ': denominators lack variety', [...dens]);
  if (equivalent < 100) fail(label + ': too few equivalent fractions', equivalent);
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Whole numbers and arithmetic expressions
{
  const label = 'numbers/compare', qs = collect('numbers', 'compare', 12000), seen = outcomes(), uniq = new Set();
  const types = { whole: 0, add: 0, sub: 0, mul: 0, decMul: 0 };
  let equalDifferent = 0;
  // value in thousandths; an expression is `x`, `x + y`, `x − y` or `x × y`
  const evalSide = (t) => {
    const m = t.match(/^(\d+(?:\.\d+)?)(?: ([+−×]) (\d+(?:\.\d+)?))?$/);
    if (!m) return null;
    const x = milli(m[1]);
    if (!m[2]) return { v: x, type: 'whole' };
    if (m[2] === '×') { const dec = m[1].includes('.'), y = Number(m[3]); if (m[3].includes('.')) return null; const v = x * y; return { v, type: dec ? 'decMul' : 'mul' }; }
    if (m[1].includes('.') || m[3].includes('.')) return null;
    const y = milli(m[3]); return { v: m[2] === '+' ? x + y : x - y, type: m[2] === '+' ? 'add' : 'sub' };
  };
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    const e = s.map(evalSide);
    if (e.some(x => !x) || q.answers.join('|') !== ALL) { fail(label + ': unreadable side', q); continue; }
    if (e.some(x => x.v < 0 || x.v % 1000 !== 0 || x.v > 99999000)) fail(label + ': negative, fractional or out-of-range value', q);
    if (ans(q) !== rel(e[0].v, e[1].v)) fail(label + ': wrong answer', q);
    seen[ans(q)]++; uniq.add(q.question); e.forEach(x => types[x.type]++);
    if (e[0].v === e[1].v) { if (s[0] === s[1]) fail(label + ': identical sides', q); else equalDifferent++; }
    for (const t of s) { const m = t.match(/^(\d+(?:\.\d+)?) × (\d+)$/); if (m && m[1].includes('.') && !['0.2', '0.25', '0.4', '0.5', '0.6', '0.75', '0.8', '1.5', '2.5'].includes(m[1])) fail(label + ': decimal factor out of scope', q); }
  }
  needAll(label, seen);
  Object.entries(types).forEach(([k, v]) => { if (v < 100) fail(label + ': expression type rarely generated: ' + k, types); });
  if (equalDifferent < 100) fail(label + ': too few equal values in different forms', equalDifferent);
  if (uniq.size < 300) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Mixed Grade 5 pool offers each comparison type and still answers correctly (spot check via text shape)
{
  const shapes = { dec: 0, fracDec: 0, frac: 0, expr: 0 };
  for (let i = 0; i < 6000; i++) {
    const q = Q.generateQuestion('grade5', 'all'), m = /^Compare: (.+) \? (.+)$/.exec(q.question);
    if (!m) continue;
    if (q.answers.join('|') !== ALL) fail('grade5/all: comparison answers', q);
    const [a, b] = [m[1], m[2]];
    if (DEC.test(a) && DEC.test(b) && q.topic === 'decimals') shapes.dec++;
    else if (q.topic === 'fractions' && FRAC.test(a) && FRAC.test(b)) shapes.frac++;
    else if (q.topic === 'fractions') shapes.fracDec++;
    else if (q.topic === 'numbers') shapes.expr++;
  }
  Object.entries(shapes).forEach(([k, v]) => { if (v < 20) fail('grade5/all: comparison type missing: ' + k, shapes); });
}

console.log(bad ? `FAILED (${bad})` : 'PASS grade5 comparisons');
process.exit(bad ? 1 : 0);
