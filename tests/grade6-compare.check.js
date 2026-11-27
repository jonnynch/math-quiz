// Grade 6 comparisons: integers, negative-number expressions, decimals, fractions, fraction vs decimal, percentages.
// Every answer is recomputed here with exact integer arithmetic from the question text.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const LESS = '< (less than)', EQUAL = '= (equal to)', MORE = '> (greater than)', ALL = [LESS, EQUAL, MORE].join('|');
const rel = (x, y) => x < y ? LESS : x > y ? MORE : EQUAL;
const ans = (q) => q.answers[q.correct];
const milli = (s) => { const [i, f = ''] = s.split('.'); return Number(i) * 1000 + Number(f.padEnd(3, '0')); };   // exact thousandths
const int = (s) => Number(s.replace('−', '-'));
const DEC = /^\d+\.\d{1,3}$/, FRAC = /^(\d+)\/(\d+)$/, PCT = /^(\d+(?:\.\d)?)%$/, INT = /^−?\d+$/;

function collect(topic, kind, count = 8000) {
  const out = [];
  for (let i = 0; i < count; i++) { const q = Q.generateQuestion('grade6', topic); if (q.topic === topic && q.kind === kind) out.push(q); }
  return out;
}
const outcomes = () => ({ [LESS]: 0, [EQUAL]: 0, [MORE]: 0 });
const needAll = (label, seen, min = 100) => Object.entries(seen).forEach(([k, v]) => { if (v < min) fail(label + ': too few ' + k, seen); });
function sides(label, q) { const m = q.question.match(/^Compare: (.+) \? (.+)$/); if (!m) fail(label + ': not a comparison', q); return m && [m[1], m[2]]; }

// ---- Integers (negative closer to zero is greater)
{
  const label = 'numbers/numberLine', qs = collect('numbers', 'numberLine'), seen = outcomes(), uniq = new Set();
  let bothNeg = 0, opposites = 0, mixed = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    if (!s.every(x => INT.test(x)) || q.answers.join('|') !== ALL) { fail(label + ': format', q); continue; }
    const [a, b] = s.map(int);
    if (Math.abs(a) > 20 || Math.abs(b) > 20 || a === b) fail(label + ': range or identical', q);
    if (ans(q) !== rel(a, b)) fail(label + ': wrong answer', q);
    if (a < 0 && b < 0) { bothNeg++; if (ans(q) !== (Math.abs(a) < Math.abs(b) ? MORE : LESS)) fail(label + ': closer to zero must be greater', q); }
    else if (a === -b) opposites++; else if (a < 0 || b < 0) mixed++;
    seen[ans(q)]++; uniq.add(q.question);
  }
  if (seen[EQUAL]) fail(label + ': identical integers compared', seen);
  [LESS, MORE].forEach(k => { if (seen[k] < 100) fail(label + ': too few ' + k, seen); });
  if (bothNeg < qs.length * 0.3 || !opposites || !mixed) fail(label + ': needs many negative-vs-negative pairs plus opposites and mixed signs', { bothNeg, opposites, mixed, total: qs.length });
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Expressions with negative numbers
{
  const label = 'numbers/compareExpr', qs = collect('numbers', 'compareExpr', 12000), seen = outcomes(), uniq = new Set();
  const types = { plain: 0, negAdd: 0, sub: 0, add: 0, mul: 0 };
  let bothNegative = 0, equalDifferent = 0, negResultSub = 0;
  const ev = (t) => {
    let m = t.match(/^(−?\d+)$/); if (m) return { v: int(m[1]), type: 'plain' };
    m = t.match(/^(−?\d+) ([+−×]) (\d+)$/); if (!m) return null;
    const a = int(m[1]), b = Number(m[3]);
    if (m[2] === '×') return a < 0 ? null : { v: a * b, type: 'mul' };
    if (m[2] === '+') return { v: a + b, type: a < 0 ? 'negAdd' : 'add' };
    return a < 0 ? null : { v: a - b, type: 'sub' };
  };
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    const e = s.map(ev);
    if (e.some(x => !x) || q.answers.join('|') !== ALL) { fail(label + ': unreadable side', q); continue; }
    if (e.some(x => x.v < -12 || x.v > 18)) fail(label + ': value range', q);
    if (s.some(t => /\d{3,}/.test(t))) fail(label + ': operand too large', q);
    if (ans(q) !== rel(e[0].v, e[1].v)) fail(label + ': wrong answer', q);
    seen[ans(q)]++; uniq.add(q.question); e.forEach(x => types[x.type]++);
    if (e[0].v < 0 && e[1].v < 0) bothNegative++;
    if (e[0].v === e[1].v) { if (s[0] === s[1]) fail(label + ': identical sides', q); else equalDifferent++; }
    e.forEach(x => { if (x.type === 'sub' && x.v < 0) negResultSub++; });
  }
  needAll(label, seen);
  Object.entries(types).forEach(([k, v]) => { if (v < 100) fail(label + ': expression type rarely generated: ' + k, types); });
  if (bothNegative < qs.length * 0.2) fail(label + ': too few comparisons with negative values on both sides', { bothNegative, total: qs.length });
  if (negResultSub < 50) fail(label + ': too few subtractions with negative results (3 − 8)', negResultSub);
  if (equalDifferent < 100) fail(label + ': too few equal values in different forms', equalDifferent);
  if (uniq.size < 300) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Decimals (positive, up to 3 places, whole part up to 9)
{
  const label = 'decimals/compare', qs = collect('decimals', 'compare', 20000), seen = outcomes(), pl = new Set(), uniq = new Set();
  let big = 0, equalDiff = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    if (!s.every(x => DEC.test(x)) || q.answers.join('|') !== ALL) { fail(label + ': format', q); continue; }
    const [a, b] = s.map(milli);
    if (a <= 0 || b <= 0 || a >= 10000 || b >= 10000) fail(label + ': value range', q);
    if (ans(q) !== rel(a, b)) fail(label + ': wrong answer', q);
    if (a >= 3000) big++;
    s.forEach(x => pl.add(x.split('.')[1].length)); seen[ans(q)]++; uniq.add(q.question);
    if (a === b && s[0].length !== s[1].length) equalDiff++;
  }
  needAll(label, seen, 50);
  if (![1, 2, 3].every(p => pl.has(p))) fail(label + ': tenths, hundredths and thousandths not all used', [...pl]);
  if (!big) fail(label + ': whole parts above 2 never used', {});
  if (equalDiff < 30) fail(label + ': too few equal values with different places', equalDiff);
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Fraction vs fraction (proper and improper)
{
  const label = 'fractions/compareFractions', qs = collect('fractions', 'compareFractions'), seen = outcomes(), uniq = new Set();
  let improper = 0, proper = 0, equivalent = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    if (!s.every(x => FRAC.test(x)) || q.answers.join('|') !== ALL) { fail(label + ': two fractions expected', q); continue; }
    const [[, n1, d1], [, n2, d2]] = s.map(x => x.match(FRAC).map(Number));
    if (d1 > 20 || d2 > 20 || n1 >= 2 * d1 || n2 >= 2 * d2 || n1 < 1 || n2 < 1 || s[0] === s[1]) fail(label + ': range or identical sides', q);
    if (ans(q) !== rel(n1 * d2, n2 * d1)) fail(label + ': wrong answer', q);
    if (n1 > d1 && n2 > d2) improper++; else proper++;
    if (n1 * d2 === n2 * d1) equivalent++;
    seen[ans(q)]++; uniq.add(q.question);
  }
  needAll(label, seen);
  if (improper < 200 || proper < 200) fail(label + ': proper/improper mix', { improper, proper });
  if (equivalent < 100) fail(label + ': too few equivalent fractions', equivalent);
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Fraction vs decimal
{
  const label = 'fractions/compareDecimalFraction', qs = collect('fractions', 'compareDecimalFraction'), seen = outcomes(), dens = new Set(), uniq = new Set();
  let eighths = 0, trailing = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    const dec = s.filter(x => DEC.test(x)), fr = s.filter(x => FRAC.test(x));
    if (dec.length !== 1 || fr.length !== 1 || q.answers.join('|') !== ALL) { fail(label + ': one decimal and one fraction expected', q); continue; }
    const [, n, d] = fr[0].match(FRAC).map(Number), v = milli(dec[0]);
    if (n < 1 || n >= d || v <= 0 || v >= 1000) fail(label + ': range', q);
    const cmp = s[0] === dec[0] ? rel(v * d, 1000 * n) : rel(1000 * n, v * d);
    if (ans(q) !== cmp) fail(label + ': wrong answer', q);
    if (ans(q) === EQUAL) { if (d === 8) eighths++; if (/0$/.test(dec[0])) trailing++; }
    seen[ans(q)]++; dens.add(d); uniq.add(q.question);
  }
  needAll(label, seen);
  if (dens.size < 6) fail(label + ': denominators lack variety', [...dens]);
  if (!eighths || !trailing) fail(label + ': missing 3/8 ? 0.375 or 1/2 ? 0.50 style equal pairs', { eighths, trailing });
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Percentage vs fraction / decimal
{
  const label = 'percentages/compare', qs = collect('percentages', 'compare'), seen = outcomes(), uniq = new Set();
  let withFraction = 0, withDecimal = 0, equalDifferent = 0, percentFirst = 0, percentSecond = 0;
  for (const q of qs) {
    const s = sides(label, q); if (!s) continue;
    const pc = s.filter(x => PCT.test(x)), rest = s.filter(x => !PCT.test(x));
    if (pc.length !== 1 || rest.length !== 1 || q.answers.join('|') !== ALL) { fail(label + ': one percentage and one fraction/decimal expected', q); continue; }
    const t = Math.round(Number(pc[0].slice(0, -1)) * 10);   // percentage as thousandths of 1 (37.5% -> 375)
    if (t < 10 || t > 990) fail(label + ': percentage range', q);
    let cmpPercentFirst;
    if (FRAC.test(rest[0])) { const [, n, d] = rest[0].match(FRAC).map(Number); if (n < 1 || n >= d) fail(label + ': fraction range', q); cmpPercentFirst = rel(t * d, 1000 * n); withFraction++; }
    else if (DEC.test(rest[0])) { cmpPercentFirst = rel(t, milli(rest[0])); withDecimal++; }
    else { fail(label + ': unreadable side', q); continue; }
    const flipped = cmpPercentFirst === LESS ? MORE : cmpPercentFirst === MORE ? LESS : EQUAL, expected = s[0] === pc[0] ? cmpPercentFirst : flipped;
    if (ans(q) !== expected) fail(label + ': wrong answer', q);
    if (cmpPercentFirst === EQUAL) equalDifferent++;
    s[0] === pc[0] ? percentFirst++ : percentSecond++;
    seen[ans(q)]++; uniq.add(q.question);
  }
  needAll(label, seen);
  if (withFraction < 100 || withDecimal < 100) fail(label + ': fraction/decimal mix', { withFraction, withDecimal });
  if (percentFirst < 100 || percentSecond < 100) fail(label + ': order not mixed', { percentFirst, percentSecond });
  if (equalDifferent < 100) fail(label + ': too few equal values in different forms', equalDifferent);
  if (uniq.size < 150) fail(label + ': too few distinct questions', uniq.size);
}

// ---- Mixed Grade 6 pool offers every comparison type
{
  const shapes = { integer: 0, expression: 0, decimal: 0, fraction: 0, fractionDecimal: 0, percentage: 0 };
  for (let i = 0; i < 9000; i++) {
    const q = Q.generateQuestion('grade6', 'all'), m = /^Compare: (.+) \? (.+)$/.exec(q.question);
    if (!m) continue;
    if (q.answers.join('|') !== ALL) fail('grade6/all: comparison answers', q);
    if (q.topic === 'numbers') shapes[INT.test(m[1]) && INT.test(m[2]) ? 'integer' : 'expression']++;
    else if (q.topic === 'percentages') shapes.percentage++;
    else if (q.topic === 'decimals') shapes.decimal++;
    else if (q.topic === 'fractions') shapes[FRAC.test(m[1]) && FRAC.test(m[2]) ? 'fraction' : 'fractionDecimal']++;
  }
  Object.entries(shapes).forEach(([k, v]) => { if (v < 20) fail('grade6/all: comparison type missing: ' + k, shapes); });
}

console.log(bad ? `FAILED (${bad})` : 'PASS grade6 comparisons');
process.exit(bad ? 1 : 0);
