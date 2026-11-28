// Grade 6 algebra: every answer is recomputed here from the question text; the generator's answer is only compared with it.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const N = 4000;
const num = (s) => Number(String(s).replace('−', '-'));
const minus = (s) => s.replace(/−/g, '-');
const coefText = (c, v) => c === 1 ? v : `${c}${v}`;

// Linear side such as "3x − 4", "x ÷ 4 + 2", "10" -> { n, d (x coefficient n/d), k (constant), terms, division }
function parseSide(side) {
  const s = minus(side), toks = s.match(/[+-]?\s*(?:\d*x(?:\s*÷\s*\d+)?|\d+)/g);
  if (!toks || toks.join('').replace(/\s/g, '') !== s.replace(/\s/g, '').replace(/^\+/, '')) return null;
  let n = 0, d = 1, k = 0, division = false;
  for (const t of toks) {
    const sg = t.trim().startsWith('-') ? -1 : 1, body = t.replace(/[+-]/, '').replace(/\s/g, '');
    const m = body.match(/^(\d*)x(?:÷(\d+))?$/);
    if (m) { const cn = (m[1] === '' ? 1 : Number(m[1])) * sg, cd = m[2] ? Number(m[2]) : 1; if (m[2]) division = true; n = n * cd + cn * d; d *= cd; }
    else k += sg * Number(body);
  }
  return { n, d, k, division, hasX: n !== 0 };
}

// Returns { format, kind, answer } or null.
function solve(t) {
  let m;
  if ((m = t.match(/^If x = (−?\d+), calculate (.+)\.$/))) {
    const x = num(m[1]); let e = minus(m[2]), v, mm;
    if ((mm = e.match(/^(\d+)x ([+-]) (\d+)$/))) v = Number(mm[1]) * x + (mm[2] === '+' ? 1 : -1) * Number(mm[3]);
    else if ((mm = e.match(/^(\d+) - (\d+)x$/))) v = Number(mm[1]) - Number(mm[2]) * x;
    else return null;
    return { format: 'substitute', kind: 'substitute', answer: String(v), negX: x < 0, sub: /^\d+x −/.test(m[2]) };
  }
  if ((m = t.match(/^Simplify (.+)\.$/))) {
    const parts = minus(m[1]).match(/^(\d+)([xan])((?: [+-] \d+[xan])*)$/);
    if (!parts) return null;
    const letter = parts[2]; let total = Number(parts[1]), count = 1, hasSub = false;
    for (const mm of parts[3].matchAll(/ ([+-]) (\d+)([xan])/g)) { if (mm[3] !== letter) return null; total += (mm[1] === '+' ? 1 : -1) * Number(mm[2]); count++; if (mm[1] === '-') hasSub = true; }
    return { format: 'likeTerms', kind: 'likeTerms', answer: coefText(total, letter), letter, count, hasSub, positive: total >= 1 };
  }
  if ((m = t.match(/^(.+)\. x = \?$/))) {
    const sides = m[1].split(' = ');
    if (sides.length !== 2) return null;
    const L = parseSide(sides[0]), R = parseSide(sides[1]);
    if (!L || !R) return null;
    // L.n/L.d x + L.k = R.n/R.d x + R.k  ->  (L.n R.d - R.n L.d) x = (R.k - L.k) L.d R.d
    const p = L.n * R.d - R.n * L.d, rhs = (R.k - L.k) * L.d * R.d;
    const unique = p !== 0, integer = unique && rhs % p === 0;
    const both = L.hasX && R.hasX, side = L.hasX ? L : R;
    const kind = both ? (Math.abs(L.n / L.d - R.n / R.d) === 1 ? 'oneStepAdd' : 'twoStep')
      : side.k === 0 ? 'oneStepMultiply' : (side.n === 1 && side.d === 1 ? 'oneStepAdd' : 'twoStep');
    if (!L.hasX && !R.hasX) return null;
    return { format: 'equation', kind, unique, integer, both, division: L.division || R.division, minus: /x [−] \d/.test(m[1]), answer: integer ? String(rhs / p) : null };
  }
  if ((m = t.match(/^(\d+(?:, \d+){3}), \.\.\. (What is the next number\?|Rule for the sequence:)$/))) {
    const s = m[1].split(', ').map(Number), diffs = s.slice(1).map((v, i) => v - s[i]);
    const arith = diffs.every(v => v === diffs[0]), geo = s.slice(1).every((v, i) => v === s[i] * (s[1] / s[0]));
    if (m[2].startsWith('What')) {
      if (arith === geo) return null;
      const next = arith ? s[3] + diffs[0] : s[3] * (s[1] / s[0]);
      return { format: 'next', kind: 'patternRule', answer: String(next), seqType: arith ? 'add' : 'mul', negStep: arith && diffs[0] < 0, start: s[0] };
    }
    return { format: 'rule', kind: 'patternRule', seq: s, arith, geo, negStep: arith && diffs[0] < 0 };
  }
  return null;
}

// Does a rule answer reproduce the shown sequence?
function ruleFits(rule, s) {
  let m;
  if ((m = rule.match(/^Add (\d+)$/))) return s.every((v, i) => i === 0 || v - s[i - 1] === Number(m[1]));
  if ((m = rule.match(/^Subtract (\d+)$/))) return s.every((v, i) => i === 0 || s[i - 1] - v === Number(m[1]));
  if ((m = rule.match(/^Multiply by (\d+)$/))) return s.every((v, i) => i === 0 || v === s[i - 1] * Number(m[1]));
  if ((m = minus(rule).match(/^(\d*)n ([+-]) (\d+)$/))) { const d = m[1] === '' ? 1 : Number(m[1]), c = (m[2] === '+' ? 1 : -1) * Number(m[3]); return s.every((v, i) => v === d * (i + 1) + c); }
  return null;
}

const kinds = { substitute: 0, likeTerms: 0, oneStepAdd: 0, oneStepMultiply: 0, twoStep: 0, patternRule: 0 };
const expected = { substitute: .22, likeTerms: .20, oneStepAdd: .14, oneStepMultiply: .14, twoStep: .18, patternRule: .12 };
const seen = {};
const note = (k) => { seen[k] = (seen[k] || 0) + 1; };
const letters = new Set(), positions = [0, 0, 0, 0];

for (let i = 0; i < N; i++) {
  const q = Q.generateQuestion('grade6', 'algebra');
  if (q.topic !== 'algebra') fail('topic', q);
  if (!(q.kind in kinds)) { fail('kind', q); continue; }
  kinds[q.kind]++;
  const t = q.question;
  if (/[²³√^()]|quadratic|factor|root|expand|bracket|[a-z]\s*[×*]\s*[a-z]|x\s*[×*]\s*x/i.test(t.replace(/^If x = .*?, calculate /, '').replace(/Rule for the sequence:|What is the next number\?/, ''))) fail('grade 7+ content', q);
  if (!Array.isArray(q.answers) || q.answers.length !== 4 || new Set(q.answers).size !== 4) { fail('four distinct choices', q); continue; }
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) { fail('correct index', q); continue; }
  positions[q.correct]++;
  const r = solve(t);
  if (!r) { fail('unrecognised format', q); continue; }
  if (r.kind !== q.kind) fail(`kind metadata ${q.kind} vs ${r.kind}`, q);
  if (r.format === 'equation') {
    if (!r.unique || !r.integer) { fail('equation without exactly one integer solution', q); continue; }
    if (num(r.answer) < 1 || num(r.answer) > 80) fail('solution out of range', q);
    note(`eq:${r.kind}${r.both ? ':both' : ''}`); if (r.division) note('eq:division'); if (r.minus) note('eq:minus');
  } else if (r.format === 'substitute') {
    if (r.negX) note('sub:negX'); if (r.sub) note('sub:minus'); note('sub'); if (num(r.answer) < 0) note('sub:negAnswer');
    if (Math.abs(num(r.answer)) > 80) fail('substitution too large', q);
  } else if (r.format === 'likeTerms') {
    letters.add(r.letter); note(`like:${r.count}terms`); if (r.hasSub) note('like:sub');
    if (!r.positive) fail('like terms result not positive', q);
  } else if (r.format === 'next') {
    note(`next:${r.seqType}`); if (r.negStep) note('next:negStep');
  } else if (r.format === 'rule') {
    note('rule'); if (r.negStep) note('rule:negStep'); if (r.geo && !r.arith) note('rule:mul'); if (/n [+−]/.test(q.answers[q.correct])) note('rule:nth');
    const fits = q.answers.map(a => ruleFits(a, r.seq));
    if (fits.some(f => f === null)) fail('unrecognised rule answer', q);
    else if (fits.filter(Boolean).length !== 1 || !fits[q.correct]) fail('rule choices: exactly one must fit the sequence', q);
    continue;
  }
  // Answer checks: the correct choice equals the independently computed answer, and no other choice does.
  const keyOf = (a) => /^−?\d+$/.test(a) ? num(a) : a;
  if (String(keyOf(q.answers[q.correct])) !== String(keyOf(r.answer))) fail(`wrong answer: expected ${r.answer}`, q);
  if (q.answers.filter(a => String(keyOf(a)) === String(keyOf(r.answer))).length !== 1) fail('not exactly one correct choice', q);
  const numeric = q.answers.every(a => /^−?\d+$/.test(a));
  if (r.format === 'likeTerms' || (r.format === 'rule')) { if (numeric) fail('text choices expected', q); }
  else {
    if (!numeric) fail('numeric choices expected', q);
    else { const v = q.answers.map(num); if (v.some((x, j) => j && x <= v[j - 1])) fail('numeric choices not ascending', q); }
  }
}

for (const k of Object.keys(expected)) {
  const f = kinds[k] / N;
  if (Math.abs(f - expected[k]) > 0.04) fail(`category frequency ${k}: ${(f * 100).toFixed(1)}% vs ${expected[k] * 100}%`, kinds);
}
const need = ['sub', 'sub:negX', 'sub:minus', 'sub:negAnswer', 'like:2terms', 'like:3terms', 'like:sub', 'eq:oneStepAdd', 'eq:oneStepAdd:both', 'eq:oneStepMultiply', 'eq:twoStep', 'eq:twoStep:both', 'eq:division', 'eq:minus', 'next:add', 'next:mul', 'next:negStep', 'rule', 'rule:negStep', 'rule:mul', 'rule:nth'];
for (const k of need) if ((seen[k] || 0) < 20) fail(`format coverage too low: ${k}`, seen);
for (const l of ['x', 'a', 'n']) if (!letters.has(l)) fail('variable letter never used: ' + l, [...letters]);
positions.forEach((c, j) => { if (c < N * 0.15) fail('correct answer position too rare: ' + j, positions); });

if (bad) { console.log(`Grade 6 algebra check FAILED (${bad})`); process.exit(1); }
console.log(`Grade 6 algebra check passed (${N} questions)`);
console.log('kinds:', JSON.stringify(kinds), 'positions:', JSON.stringify(positions));
