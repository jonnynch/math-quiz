// Grade 6 probability and statistics: every answer is recomputed here from the question text (the generator's answer is only compared with it).
// Exports verifyProbability / verifyStatistics so tests/questions.check.js can reuse the same independent checks.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const isPrime = v => v > 1 && Array.from({ length: v - 2 }, (_, i) => i + 2).every(d => v % d);
const sum = v => v.reduce((s, x) => s + x, 0);
const close = (a, b) => Math.abs(a - b) < 1e-9;
const toNum = s => { const m = String(s).match(/^(\d+)\/(\d+)$/); return m ? +m[1] / +m[2] : Number(s); };
const parseList = s => s.split(/, | and /).map(p => { const m = p.match(/^(\d+) (\w+)$/); return m ? [+m[1], m[2]] : null; });
const EVENTS = [[/^an even number$/, v => v % 2 === 0], [/^an odd number$/, v => v % 2 === 1], [/^a prime number$/, isPrime],
  [/^a number greater than (\d+)$/, (v, k) => v > k], [/^a number less than (\d+)$/, (v, k) => v < k], [/^a multiple of (\d+)$/, (v, k) => v % k === 0]];
function countEvent(desc, max) {
  for (const [re, f] of EVENTS) { const m = desc.match(re); if (m) return Array.from({ length: max }, (_, i) => i + 1).filter(v => f(v, +m[1])).length; }
  return null;
}
const BANNED = /tree diagram|compound|independent|dependent|conditional|two dice|two coins|twice|and then|standard deviation|variance|quartile|interquartile|box plot|box-and-whisker/i;

// Returns { family, err, expected } where expected is {frac:[n,d]} | {num:x} | {text:s}.
function expectedProbability(text) {
  let m;
  if ((m = text.match(/^A fair coin is (?:tossed|flipped)\. (?:P\((not )?(heads|tails)\) = \?|What is the probability of (not )?getting (heads|tails)\?)$/))) return { family: 'coin', expected: { frac: [1, 2] } };
  if ((m = text.match(/^A fair six-sided die is rolled\. What is the probability of (?:rolling|getting) (.+)\?$/))) { const f = countEvent(m[1], 6); return f && f > 0 && f < 6 ? { family: 'die', expected: { frac: [f, 6] } } : { err: 'die event' }; }
  if ((m = text.match(/^A spinner has (\d+) equal sections numbered 1 to (\d+)\. What is P\((.+)\)\?$/))) { const f = +m[1] === +m[2] && m[1] >= 4 && m[1] <= 10 ? countEvent(m[3], +m[1]) : null; return f && f > 0 && f < +m[1] ? { family: 'spinnerNumber', expected: { frac: [f, +m[1]] } } : { err: 'spinner number event' }; }
  if ((m = text.match(/^A spinner has (\d+) equal sections, (\d+) of which are (\w+)\. What is P\((\w+)\)\?$/))) return m[3] === m[4] && +m[1] >= 4 && +m[1] <= 10 && +m[2] > 0 && +m[2] < +m[1] ? { family: 'spinnerColour', expected: { frac: [+m[2], +m[1]] } } : { err: 'spinner colour' };
  if ((m = text.match(/^A spinner has (\d+) equal sections: (.+)\. What is P\((not )?(\w+)\)\?$/))) {
    const parts = parseList(m[2]); if (parts.includes(null)) return { err: 'spinner list' };
    const total = sum(parts.map(p => p[0])), c = parts.find(p => p[1] === m[4]); if (!c || total !== +m[1] || total < 4 || total > 10) return { err: 'spinner list total' };
    return { family: 'spinnerList', expected: { frac: [m[3] ? total - c[0] : c[0], total] } };
  }
  if ((m = text.match(/^A bag contains (.+) counters\. What is P\((not )?(\w+)\)\?$/))) {
    const parts = parseList(m[1]); if (parts.includes(null)) return { err: 'bag list' };
    const total = sum(parts.map(p => p[0])), c = parts.find(p => p[1] === m[3]); if (!c) return { err: 'bag colour' };
    return { family: parts.length === 2 ? 'bag2' : 'bag3', expected: { frac: [m[2] ? total - c[0] : c[0], total] } };
  }
  if ((m = text.match(/^P\(A\) = (\d+)\/(\d+)\. What is P\(not A\)\?$/))) return { family: 'complementFraction', expected: { frac: [+m[2] - +m[1], +m[2]] } };
  if ((m = text.match(/^P\(A\) = (\d\.\d+)\. What is P\(not A\)\?$/))) return { family: 'complementDecimal', expected: { num: 1 - +m[1] } };
  if ((m = text.match(/^P\(A\) = (\d+)%\. What is P\(not A\)\?$/))) return { family: 'complementPercent', expected: { num: 100 - +m[1] } };
  if ((m = text.match(/^A coin lands (heads|tails) (\d+) times in (\d+) tosses\. What is the experimental probability of (heads|tails)\?$/))) return m[1] === m[4] && 2 * m[2] !== +m[3] ? { family: 'experimentalCoin', expected: { frac: [+m[2], +m[3]] } } : { err: 'experimental coin' };
  if ((m = text.match(/^A spinner lands on (\w+) (\d+) times in (\d+) spins\. What is the experimental probability of (\w+)\?$/))) return m[1] === m[4] ? { family: 'experimentalSpinner', expected: { frac: [+m[2], +m[3]] } } : { err: 'experimental spinner' };
  if ((m = text.match(/^P\(A\) = (.+)\. Write P\(A\) as (a percent|a decimal|a fraction in simplest form)\.$/))) {
    let h, from; const s = m[1];
    if (/^\d+\/\d+$/.test(s)) { const [n, d] = s.split('/').map(Number); h = n * 100 / d; from = 'fraction'; } else if (/%$/.test(s)) { h = parseInt(s, 10); from = 'percent'; } else { h = Math.round(Number(s) * 100); from = 'decimal'; }
    if (!Number.isInteger(h) || h <= 0 || h >= 100) return { err: 'conversion value' };
    const to = m[2] === 'a percent' ? 'percent' : m[2] === 'a decimal' ? 'decimal' : 'fraction';
    return { family: `${from}To${to}`, expected: to === 'percent' ? { num: h } : to === 'decimal' ? { num: h / 100 } : { frac: [h, 100] } };
  }
  if ((m = text.match(/^(Bag|Spinner) A: (\d+) (\w+) out of (\d+) (counters|sections)\. (Bag|Spinner) B: (\d+) (\w+) out of (\d+) (counters|sections)\. Which (bag|spinner) gives the greater probability of (?:selecting|landing on) (\w+)\?$/))) {
    if (m[1] !== m[6] || m[3] !== m[8] || m[3] !== m[12] || m[1].toLowerCase() !== m[11]) return { err: 'likely wording' };
    const a = +m[2], ta = +m[4], b = +m[7], tb = +m[9], cross = a * tb - b * ta;
    return { family: cross === 0 ? 'likelyEqual' : (a - b) * cross < 0 ? 'likelyTrap' : 'likely', expected: { text: cross > 0 ? `${m[1]} A` : cross < 0 ? `${m[1]} B` : 'Equally likely' } };
  }
  return { err: 'unrecognised probability question' };
}

function checkChoices(q, expected) {
  const a = q.answers;
  if (a.length !== 4 || new Set(a).size !== 4) return 'need four distinct choices';
  if (!(q.correct >= 0 && q.correct < 4)) return 'bad correct index';
  const hit = a.map((x, i) => i).filter(i => expected.text !== undefined ? a[i] === expected.text : expected.frac ? close(toNum(a[i]), expected.frac[0] / expected.frac[1]) : close(toNum(a[i]), expected.num));
  if (hit.length !== 1 || hit[0] !== q.correct) return 'expected answer is not the one correct choice';
  if (expected.frac) { const m = a[q.correct].match(/^(\d+)\/(\d+)$/); if (!m || gcd(+m[1], +m[2]) !== 1 || +m[1] >= +m[2]) return 'correct fraction not a simplified proper fraction'; }
  const nums = a.map(toNum);
  if (nums.every(n => !isNaN(n)) && nums.some((n, i) => i && n <= nums[i - 1])) return 'numeric choices not ascending';
  return null;
}

function verifyProbability(q) {
  if (q.topic !== 'probability') return { err: 'topic' };
  if (BANNED.test(q.question)) return { err: 'Grade 7+ content' };
  const r = expectedProbability(q.question); if (r.err) return r;
  if (r.expected.num !== undefined && !/^\d+(\.\d{1,2})?$/.test(q.answers[q.correct])) return { err: 'recurring or long decimal answer' };
  const err = checkChoices(q, r.expected); if (err) return { err, family: r.family };
  if (r.expected.text === undefined) {   // every choice must be a valid probability: 0–1 (0–100 for percents)
    const limit = r.expected.num !== undefined && /percent$/i.test(r.family) ? 100 : 1;
    if (q.answers.some(a => !(toNum(a) >= 0 && toNum(a) <= limit))) return { err: 'choice outside 0 to ' + limit, family: r.family };
  }
  return { family: r.family };
}

function verifyStatistics(q) {
  const m = q.question.match(/^Data: ([\d, ]+)\. Find the (mean|median|mode|range)\.$/);
  if (q.topic !== 'statistics' || !m) return { err: 'unrecognised statistics question' };
  const shown = m[1].split(', ').map(Number), sorted = [...shown].sort((a, b) => a - b), n = shown.length, kind = m[2];
  if (kind !== q.kind) return { err: 'kind metadata' };
  if (n < 4 || n > 7 || shown.some(v => !Number.isInteger(v) || v < 1 || v > 30)) return { err: 'dataset size or range' };
  let expected;
  if (kind === 'mean') { const mean = sum(shown) / n; if (!Number.isInteger(mean * 2) || sum(shown) > 100) return { err: 'mean not whole/half or total too large' }; expected = { num: mean }; }
  else if (kind === 'median') expected = { num: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 };
  else if (kind === 'range') expected = { num: sorted[n - 1] - sorted[0] };
  else {
    const counts = new Map(); shown.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const top = Math.max(...counts.values()), modes = [...counts].filter(([, c]) => c === top).map(([v]) => v);
    if (top === 1) expected = { text: 'No mode' }; else if (modes.length === 1) expected = { text: String(modes[0]) }; else return { err: 'ambiguous multiple modes' };
  }
  const a = q.answers;
  if (a.length !== 4 || new Set(a).size !== 4 || !(q.correct >= 0 && q.correct < 4)) return { err: 'need four distinct choices' };
  const hit = a.map((x, i) => i).filter(i => expected.text !== undefined ? a[i] === expected.text : close(Number(a[i]), expected.num));
  if (hit.length !== 1 || hit[0] !== q.correct) return { err: 'expected answer is not the one correct choice' };
  if (kind === 'mode') {   // "No mode" is the answer exactly when no value repeats, and is otherwise one of the three wrong choices
    const noModeIdx = a.indexOf('No mode'), noRepeats = new Set(shown).size === n;
    if (noModeIdx < 0) return { err: 'No mode choice missing' };
    if (noRepeats !== (noModeIdx === q.correct)) return { err: noRepeats ? 'no-mode dataset: No mode must be correct' : 'repeated dataset: No mode must be incorrect' };
  }
  if (kind !== 'mode') { const v = a.map(Number); if (v.some(isNaN) || v.some((x, i) => i && x <= v[i - 1])) return { err: 'numeric choices not ascending' }; }
  return { kind, n, sorted: shown.every((v, i) => !i || v >= shown[i - 1]), half: expected.num !== undefined && expected.num % 1 !== 0, noMode: expected.text === 'No mode', distinct: new Set(shown).size === n };
}
module.exports = { verifyProbability, verifyStatistics };

if (require.main === module) {
  const N = 3000; let bad = 0;
  const fail = (m, q) => { if (bad++ < 20) console.log('FAIL', m, q ? JSON.stringify(q) : ''); };
  const fam = {}, pos = [0, 0, 0, 0], texts = new Set(), kinds = {};
  const WEIGHTS = { coin: 10, die: 14, sampleSpace: 14, bag: 14, complementFraction: 5, complementDecimal: 5, complementPercent: 5, experimental: 12, conversion: 12, likely: 9 };
  for (let i = 0; i < N; i++) {
    const q = Q.generateQuestion('grade6', 'probability'), r = verifyProbability(q);
    if (r.err) { fail(r.err, q); continue; }
    fam[r.family] = (fam[r.family] || 0) + 1; kinds[q.kind] = (kinds[q.kind] || 0) + 1; pos[q.correct]++; texts.add(q.question);
  }
  for (const [k, w] of Object.entries(WEIGHTS)) { const p = w / 100, obs = (kinds[k] || 0) / N; if (Math.abs(obs - p) > 5 * Math.sqrt(p * (1 - p) / N) + 0.005) fail(`kind frequency ${k}: ${obs}`); }
  if (Object.keys(kinds).some(k => !(k in WEIGHTS))) fail('unexpected probability kind ' + Object.keys(kinds));
  for (const f of ['coin', 'die', 'spinnerNumber', 'spinnerColour', 'spinnerList', 'bag2', 'bag3', 'complementFraction', 'complementDecimal', 'complementPercent', 'experimentalCoin', 'experimentalSpinner', 'decimalTopercent', 'percentTodecimal', 'fractionTodecimal', 'fractionTopercent', 'decimalTofraction', 'percentTofraction', 'likely', 'likelyEqual', 'likelyTrap']) if ((fam[f] || 0) < 20) fail('probability family under-represented: ' + f);
  const likelyAll = (fam.likely || 0) + (fam.likelyEqual || 0) + (fam.likelyTrap || 0);
  if (fam.likelyEqual / likelyAll < 0.1 || fam.likelyEqual / likelyAll > 0.3) fail('equal-likelihood share out of range');
  if (texts.size < 400) fail('probability questions lack variety: ' + texts.size);
  const dieTypes = new Set(); for (let i = 0; i < 600; i++) { const q = Q.generateQuestion('grade6', 'probability'); const m = q.question.match(/^A fair six-sided die is rolled\. What is the probability of (?:rolling|getting) (.+)\?$/); if (m) dieTypes.add(m[1].replace(/\d+/, 'k')); }
  if (dieTypes.size < 6) fail('die events lack variety: ' + [...dieTypes]);
  if (pos.some(c => c / N < 0.1 || c / N > 0.45)) fail('probability correct position not spread: ' + pos);

  const sf = {}, lens = {}, medLens = {}, spos = [0, 0, 0, 0]; let unsorted = 0, medHalf = 0, medWhole = 0, meanHalf = 0, meanWhole = 0, noMode = 0, modes = 0, repeated = 0, noRepeat = 0;
  for (let i = 0; i < N; i++) {
    const q = Q.generateQuestion('grade6', 'statistics'), r = verifyStatistics(q);
    if (r.err) { fail(r.err, q); continue; }
    sf[r.kind] = (sf[r.kind] || 0) + 1; lens[r.n] = (lens[r.n] || 0) + 1; spos[q.correct]++;
    if (!r.sorted) unsorted++; r.distinct ? noRepeat++ : repeated++;
    if (r.kind === 'median') { medLens[r.n] = (medLens[r.n] || 0) + 1; r.half ? medHalf++ : medWhole++; }
    if (r.kind === 'mean') r.half ? meanHalf++ : meanWhole++;
    if (r.kind === 'mode') { modes++; if (r.noMode) noMode++; }
  }
  for (const k of ['mean', 'median', 'mode', 'range']) if ((sf[k] || 0) < N * 0.2) fail('statistics kind under-represented: ' + k);
  for (const n of [4, 5, 6, 7]) if (!lens[n] || !medLens[n]) fail('dataset length missing: ' + n);
  if (!medHalf || !medWhole || !meanHalf || !meanWhole) fail('whole/half answers missing for mean or median');
  if (!noMode || noMode === modes || modes - noMode < 1) fail('mode needs both unique-mode and no-mode questions');
  if (unsorted < N * 0.8) fail('displayed data is too often sorted: ' + unsorted);
  if (!repeated || !noRepeat) fail('need datasets with and without repeated values');
  if (spos.some(c => c / N < 0.1 || c / N > 0.45)) fail('statistics correct position not spread: ' + spos);
  console.log(bad ? `FAILED (${bad})` : 'PASS grade6 probability and statistics', JSON.stringify({ kinds, sf, lens, medHalf, medWhole, noMode, modes, pos, spos, variety: texts.size }));
  process.exit(bad ? 1 : 0);
}
