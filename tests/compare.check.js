// Comparison questions: Age 6 whole numbers 1-20 only; Grade 1-6 have no whole-number comparison;
// Grade 5 compares fractions with fractions; Grade 6 adds unlike denominators and fraction vs decimal.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };
const gen = (level, topic, n = 3000) => Array.from({ length: n }, () => Q.generateQuestion(level, topic));
const sign = x => (x < 0 ? -1 : x > 0 ? 1 : 0);
const picked = q => q.answers[q.correct];

// ---- Age 6
{
  const qs = gen('age6').filter(q => !q.stage);
  const kinds = { pick: 0, sign: 0, statements: 0 };
  let bad = 0, outOfRange = 0, badOrder = 0, extra = 0;
  const tiers = new Set(), signs = new Set(), closePairs = new Set(), positions = [0, 0];
  qs.forEach(q => {
    const nums = (q.question.match(/\d+/g) || []).map(Number);
    let m;
    if ((m = q.question.match(/^Which number is (greater|smaller)\? (\d+) or (\d+)$/))) {
      kinds.pick++;
      const [a, b] = [+m[2], +m[3]], want = m[1] === 'greater' ? Math.max(a, b) : Math.min(a, b);
      if (a === b || Number(picked(q)) !== want || q.answers.length !== 2 || q.answers.join() !== `${a},${b}`) bad++;
      if (Math.abs(a - b) <= 3) closePairs.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
      positions[q.correct]++;
    } else if ((m = q.question.match(/^Which sign goes here\? (\d+) \? (\d+)$/))) {
      kinds.sign++;
      const cmp = sign(+m[1] - +m[2]);
      if (!(picked(q).startsWith(cmp < 0 ? '<' : cmp > 0 ? '>' : '='))) bad++;
      q.answers.forEach(a => signs.add(a[0]));
      if (q.tier === 2 && (cmp === 0 || q.answers.length !== 2)) bad++;       // tier 2 has no equals
    } else if (q.question === 'Which is true?') {
      kinds.statements++;
      if (q.answers.length !== 4 && !(q.answers.length === 3)) bad++;
      const truth = s => { const [x, op, y] = s.split(' '); return op === '<' ? +x < +y : op === '>' ? +x > +y : +x === +y; };
      if (q.answers.filter(truth).length !== 1 || !truth(picked(q))) bad++;
    } else extra++;
    if (nums.some(n => n < 1 || n > 20) || q.answers.some(a => (a.match(/\d+/g) || []).some(n => +n > 20))) outOfRange++;
    if (q.simple !== true) bad++;
    tiers.add(q.tier);
  });
  ok(kinds.pick && kinds.sign && kinds.statements && !extra, 'Age 6 has pick, sign and "Which is true?" comparison questions: ' + JSON.stringify(kinds));
  ok(!bad, 'Age 6 comparison answers are correct and unambiguous (' + bad + ' bad)');
  ok(!outOfRange, 'Age 6 comparison uses whole numbers 1 to 20 only');
  ok(['<', '=', '>'].every(s => signs.has(s)), 'Age 6 introduces <, > and =');
  ok(closePairs.has('16-17') && closePairs.has('18-20'), 'close numbers such as 16 and 17, or 18 and 20, appear');
  ok(positions[0] > 200 && positions[1] > 200, 'the correct number is on either side, not always last: ' + positions);
  ok([1, 2, 3].every(t => tiers.has(t)), 'Age 6 questions carry tiers 1-3 (progressive difficulty)');
  // progression: the first round starts with tier 1 and is not all comparison or all sums
  const deck = Q.createQuestionDeck(Q.buildQuestionBank('age6', 'all', 500));
  const first = Array.from({ length: 6 }, () => deck.next());
  ok(first.every(q => (q.tier || 1) === 1), 'the first six Age 6 questions are tier 1 (easiest)');
  const sixty = gen('age6', 'all', 400);
  ok(sixty.some(q => q.stage) && sixty.some(q => !q.stage), 'sums/differences within 10 are still part of the Age 6 pool');
  ok(sixty.filter(q => q.stage).every(q => /^What is \d+ [+−] \d+\?$/.test(q.question)), 'existing Age 6 sum/difference questions are unchanged');
}

// ---- Grade 1-6: no standalone whole-number comparison
{
  let found = 0;
  for (let g = 1; g <= 6; g++) {
    const topics = Q.topicsFor('grade' + g).map(t => t.value);
    ok(!topics.includes('compare'), `Grade ${g} has no "Comparing numbers" topic`);
    topics.forEach(t => gen('grade' + g, t, 600).forEach(q => { if (/^Compare: \d+ \? \d+$/.test(q.question) || /^Which (number|sign)/.test(q.question)) found++; }));
  }
  ok(found === 0, 'no whole-number comparison question in any Grade 1-6 topic or Mixed All Questions');
  ok(Q.normaliseTopic('grade3', 'compare') === 'all', 'a saved "compare" topic falls back to Mixed All Questions');
  ok(gen('grade2', 'compare', 50).every(q => !/^Compare: \d+ \? \d+$/.test(q.question)), 'a stale "compare" topic request never produces whole-number comparisons');
}

// ---- Grade 5 / Grade 6 fractions
{
  const frac = s => { const m = s.match(/^Compare: (\d+)\/(\d+) \? (\d+)\/(\d+)$/); return m && m.slice(1).map(Number); };
  const cmpOK = (q, v) => (picked(q).startsWith(v < 0 ? '<' : v > 0 ? '>' : '=')) && q.answers.length === 3;
  const g5 = gen('grade5', 'fractions', 6000).filter(q => q.question.startsWith('Compare'));
  const k5 = { same: 0, related: 0, equiv: 0 };
  let bad5 = 0, notFrac5 = 0;
  g5.forEach(q => {
    const f = frac(q.question); if (!f) { notFrac5++; return; }
    const [a, b, c, d] = f, v = sign(a * d - c * b);
    if (!cmpOK(q, v)) bad5++;
    if (b === d) k5.same++; else if (b % d === 0 || d % b === 0) { if (v === 0) k5.equiv++; else k5.related++; } else bad5++;
  });
  ok(g5.length > 300 && !notFrac5, 'Grade 5 has fraction comparisons and every one is fraction vs fraction');
  ok(!bad5, 'Grade 5 answers are correct; denominators are the same or related (' + bad5 + ' bad)');
  ok(k5.same && k5.related && k5.equiv, 'Grade 5 includes same-denominator, related-denominator and equivalent pairs: ' + JSON.stringify(k5));

  const g6 = gen('grade6', 'fractions', 6000).filter(q => q.question.startsWith('Compare'));
  let bad6 = 0, unlike = 0, dec = 0, less = 0, same6 = 0;
  const seen = new Set();
  g6.forEach(q => {
    seen.add(q.question);
    let m, f = frac(q.question);
    if (f) {
      const [a, b, c, d] = f, v = sign(a * d - c * b);
      if (!cmpOK(q, v) || b === d || v === 0) bad6++;
      if (b % d !== 0 && d % b !== 0) unlike++; else less++;
    } else if ((m = q.question.match(/^Compare: (\d+)\/(\d+) \? (0\.\d+)$/))) {
      dec++; if (!cmpOK(q, sign(m[1] * 100 - Math.round(m[3] * 100) * m[2]))) bad6++;
    } else if ((m = q.question.match(/^Compare: (0\.\d+) \? (\d+)\/(\d+)$/))) {
      dec++; if (!cmpOK(q, sign(Math.round(m[1] * 100) * m[3] - m[2] * 100))) bad6++;
    } else bad6++;
  });
  ok(g6.length > 300 && !bad6, 'Grade 6 comparisons are all fractions or fraction vs decimal with one correct answer (' + bad6 + ' bad)');
  ok(unlike > 50 && dec > 50, `Grade 6 has unlike-denominator (${unlike}) and fraction-vs-decimal (${dec}) comparisons`);
  ok(seen.size > 150, 'Grade 6 comparison pool is wide (' + seen.size + ' distinct)');
  // difficulty rises: Grade 5 never has an unrelated denominator pair; Grade 6 never has an "equal" answer or same denominator
  ok(unlike > less * 0.3, 'Grade 6 leans on harder (unlike) denominators more than Grade 5 does');
  const tag = new Set(g5.map(q => q.answers.length)); ok(tag.size === 1, 'comparison answers are the three signs');
}

// ---- Mixed All still offers comparisons only as fractions (Grade 5-6)
{
  const q5 = gen('grade5', 'all', 3000).filter(q => q.question.startsWith('Compare'));
  ok(q5.length > 0 && q5.every(q => /\d+\/\d+/.test(q.question)), 'Mixed All Questions comparisons at Grade 5 are fraction comparisons');
}
console.log(failures ? failures + ' FAILED' : 'all comparison checks passed');
process.exit(failures ? 1 : 0);
