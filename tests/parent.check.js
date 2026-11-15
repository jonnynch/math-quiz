// Unit checks for parent.js (parent verification): challenges, wrong/right answers, cooldown, session lock. No browser needed.
const path = require('path');
const P = require(path.join(__dirname, '..', 'public', 'parent.js'));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

// localStorage must never be touched: the unlocked state and the answer are not stored permanently.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('localStorage used'); } });

const { solveParent, solveHard } = require('./parent-solver');

function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function memStorage() { const m = {}; return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }
function session(extra) {
  const clock = { t: 1000000 };
  const storage = memStorage();
  const s = P.create({ rng: lcg(7), now: () => clock.t, storage, ...extra });
  return { s, clock, storage };
}
const answerOf = (s) => solveParent(s.current().text);
// An answer that is certainly wrong for the current question (answers are never 0).
const wrongOf = (s) => '0';

// --- challenge generation: one short quadratic or probability question
{
  const texts = new Set();
  const kinds = new Set();
  let good = true;
  const rng = lcg(42);
  for (let i = 0; i < 3000; i++) {
    const c = P.generateChallenge(rng);
    const quad = /^What is the positive value of x if x² = (\d+)\?$/.exec(c.text);
    const prob = /^A bag contains (\d+) (\w+) balls? and (\d+) (\w+) balls?\. What is the probability of picking (\w+)\?$/.exec(c.text);
    if (quad) {
      const root = Math.sqrt(Number(quad[1]));
      if (!Number.isInteger(root) || root < 3 || root > 12 || c.answer.num !== root || c.answer.den !== 1) good = false;
    } else if (prob) {
      const [n1, n2] = [Number(prob[1]), Number(prob[3])];
      const favourable = prob[5] === prob[2] ? n1 : n2;
      if (prob[2] === prob[4] || n1 < 1 || n2 < 1 || ![2, 4, 5, 8, 10].includes(n1 + n2) || (prob[5] !== prob[2] && prob[5] !== prob[4])) good = false;
      if (c.answer.num !== favourable || c.answer.den !== n1 + n2) good = false;
      if (/1 \w+ balls|[02-9]\d* \w+ ball\b/.test(c.text)) good = false; // singular/plural wording
    } else good = false;
    if (c.text.length > 100) good = false;
    kinds.add(quad ? 'quadratic' : 'probability');
    texts.add(c.text);
  }
  ok(good, '3000 generated questions all use the short quadratic or probability formats, with correct stored answers');
  ok(kinds.size === 2, 'both quadratic and probability questions are generated');
  ok(texts.size >= 60, 'values and colours are randomised, not one fixed question (' + texts.size + ' distinct)');
  ok(P.generateChallenge(() => 0).text.includes('x² = 9?'), 'quadratic questions look like "What is the positive value of x if x² = 9?"');
  const bag = P.generateChallenge(() => 0.99).text;
  ok(/^A bag contains/.test(bag) && bag.includes('probability of picking'), 'probability questions look like "A bag contains … What is the probability of picking …?"');
}

// --- no multiple choice, no leaked answer
{
  const { s } = session();
  const c = s.current();
  ok(Object.keys(c).join() === 'text' && !JSON.stringify(c).includes('options') && !/answer|choices/i.test(JSON.stringify(c)), 'the challenge exposes only its text: no options, answer or hint');
  ok(typeof c.text === 'string' && !s.isUnlocked(), 'starts locked');
}

// --- correct and incorrect answers
{
  const { s } = session();
  const r1 = s.submit(wrongOf(s));
  ok(r1.ok === false && r1.reason === 'wrong' && !s.isUnlocked() && r1.attemptsLeft === 2, 'a wrong answer is rejected and does not unlock');
  const q = s.current().text;
  ok(s.submit('abc').reason === 'invalid' && s.submit('').reason === 'invalid' && s.submit('1/0').reason === 'invalid' && s.submit('-3').reason === 'invalid' && s.current().text === q && s.attemptsLeft() === 2, 'blank or non-numeric input is not counted as an attempt and keeps the question');
  const r2 = s.submit(' ' + answerOf(s) + ' ');
  ok(r2.ok === true && s.isUnlocked(), 'the right answer unlocks (surrounding spaces tolerated)');
}

// --- equivalent answer formats
{
  // Finds a seed whose first question matches, and returns a function that makes a fresh session showing it.
  const withQuestion = (test) => {
    for (let i = 0; i < 5000; i++) {
      const seed = i * 104729 + 12345;
      const make = () => P.create({ rng: lcg(seed), now: () => 0, storage: memStorage() });
      if (test(make().current().text)) return make;
    }
    throw new Error('no matching question found');
  };
  const probability = (num, den) => withQuestion(t => /probability/.test(t) && solveParent(t) === num + '/' + den);
  const accepts = (make, typed) => { const s = make(); return s.submit(typed).ok === true; };
  const threeQuarters = probability(3, 4), half = probability(1, 2);
  ok(['3/4', '0.75', '.75', '75%', ' 3 / 4 ', '6/8', '0.750'].every(a => accepts(threeQuarters, a)), '3/4 is accepted as 3/4, 0.75, .75, 75%, 6/8 and with spaces');
  ok(['1/2', '0.5', '.5', '50%', '2/4', '5/10'].every(a => accepts(half, a)), '1/2 is accepted as 1/2, 0.5, 50%, 2/4 and 5/10');
  ok(['3/5', '0.74', '4/3', '1', '0', '75', '7/4'].every(a => !accepts(threeQuarters, a)), 'close or reversed values for 3/4 are rejected');
  const quad = withQuestion(t => t.includes('x² = 49?'));
  ok(['7', '7.0', '07'].every(a => accepts(quad, a)) && ['-7', '49', '6', '7/2'].every(a => !accepts(quad, a)), 'x² = 49 accepts 7 (also 7.0) and rejects -7, 49, 6, 7/2');
  ok(P.sameValue(P.parseAnswer('0.75'), P.parseAnswer('3/4')) && P.sameValue(P.parseAnswer('75%'), P.parseAnswer('3/4')) && !P.sameValue(P.parseAnswer('0.7'), P.parseAnswer('2/3')), 'parseAnswer compares decimals, percentages and fractions exactly')
}

// --- a new challenge after every attempt
{
  const { s } = session();
  const seen = [s.current().text];
  for (let i = 0; i < 2; i++) { s.submit(wrongOf(s)); seen.push(s.current().text); }
  ok(new Set(seen).size === 3, 'a new, different question is generated after each wrong attempt');
}

// --- three failures, cooldown, no bypass
{
  const { s, clock, storage } = session();
  s.submit(wrongOf(s)); s.submit(wrongOf(s));
  ok(s.cooldownRemaining() === 0, 'two failures do not start a cooldown');
  const r3 = s.submit(wrongOf(s));
  ok(r3.reason === 'cooldown' && r3.remaining === 30 && s.cooldownRemaining() === 30, 'the third consecutive failure starts a 30-second cooldown');
  const correctNow = answerOf(s);
  const during = s.submit(correctNow);
  ok(during.ok === false && during.reason === 'cooldown' && !s.isUnlocked(), 'even the right answer is refused during the cooldown');
  clock.t += 12000;
  ok(s.cooldownRemaining() === 18, 'the remaining time counts down');
  // "refresh": a new instance with the same session storage is still in cooldown
  const reloaded = P.create({ rng: lcg(99), now: () => clock.t, storage });
  ok(reloaded.cooldownRemaining() === 18 && reloaded.submit(solveParent(reloaded.current().text)).reason === 'cooldown' && !reloaded.isUnlocked(), 'refreshing the page does not skip the cooldown');
  // closing and reopening the bank (lock) does not skip it either
  s.lock();
  ok(s.cooldownRemaining() === 18, 'locking and reopening does not clear the cooldown');
  clock.t += 18000;
  ok(s.cooldownRemaining() === 0 && s.attemptsLeft() === 3, 'after 30 seconds the player gets three new tries');
  ok(s.submit(answerOf(s)).ok === true && s.isUnlocked(), 'a correct answer works after the cooldown');
}

// --- success resets the counter
{
  const { s } = session();
  s.submit(wrongOf(s)); s.submit(wrongOf(s));
  ok(s.submit(answerOf(s)).ok === true && s.attemptsLeft() === 3, 'a successful verification resets the failure counter');
  s.lock();
  s.submit(wrongOf(s)); s.submit(wrongOf(s));
  ok(s.cooldownRemaining() === 0 && s.attemptsLeft() === 1, 'failures before a success are not added to later ones');
}

// --- session lock and storage
{
  const { s, storage } = session();
  s.submit(answerOf(s));
  ok(s.isUnlocked(), 'unlocked after verification');
  ok(!Object.keys(storage.m).some(k => /unlock/i.test(k)) && Object.values(storage.m).every(v => !/unlocked|answer/i.test(v)), 'unlocked state and answer are never written to storage');
  s.lock();
  ok(!s.isUnlocked() && s.submit('0').ok === false, 'closing the bank locks again and fresh verification is required');
  const fresh = P.create({ rng: lcg(5), now: () => 0, storage });
  ok(!fresh.isUnlocked(), 'a new page load starts locked');
  const broken = P.create({ rng: lcg(5), now: () => 0, storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } });
  ok(broken.submit(wrongOf(broken)).reason === 'wrong' && broken.submit(answerOf(broken)).ok === true, 'works when sessionStorage is unavailable');
}

// --- the harder quadratic question used for manual bank adjustments
{
  let bad = 0; let multi = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const c = P.generateHardChallenge(lcg(seed));
    seen.add(c.text);
    const [r1, r2] = c.answer.roots;
    const m = c.text.match(/^(?:Solve|Find the roots of) (\d*)x²(?: ([+-]) (\d*)x)?(?: ([+-]) (\d+))? = 0/);
    const A = m[1] ? +m[1] : 1; const B = m[2] ? (m[2] === '-' ? -1 : 1) * (m[3] ? +m[3] : 1) : 0; const C = m[4] ? (m[4] === '-' ? -1 : 1) * +m[5] : 0;
    // both stated roots must satisfy A x² + B x + C = 0 exactly, and be different
    const zero = (r) => A * r.num * r.num + B * r.num * r.den + C * r.den * r.den === 0;
    if (!zero(r1) || !zero(r2) || P.sameValue(r1, r2) || c.kind !== 'roots') bad++;
    if (A > 1) multi++;
  }
  ok(bad === 0, 'hard questions: both answers are exact roots of the printed equation and differ (300 samples)');
  ok(seen.size > 50 && multi > 30, 'hard questions: many different equations, including a leading coefficient above 1');
  const h = P.create({ rng: lcg(21), now: () => 0, storage: null, generate: P.generateHardChallenge });
  const q = h.current().text;
  ok(/x²/.test(q) && /Solve|Find the roots/.test(q) && !h.isUnlocked(), 'hard instance asks a quadratic and starts locked');
  ok(h.submit('').reason === 'invalid' && h.submit('3').reason === 'invalid' && h.submit('1,2,3').reason === 'invalid' && h.submit('a, b').reason === 'invalid', 'hard: not exactly two numbers is invalid (no try used)');
  ok(h.attemptsLeft() === 3, 'hard: invalid input does not use a try');
  const wrong = h.submit('100, 200');
  ok(wrong.ok === false && wrong.reason === 'wrong' && !h.isUnlocked(), 'hard: wrong roots do not unlock');
  const q2 = h.current().text;
  ok(q2 !== q, 'hard: a wrong answer gives a new question');
  const [a1, a2] = solveHard(q2).split(', ');
  ok(h.submit(`${a1}, 100`).ok === false, 'hard: one correct root is not enough');
  const q3 = h.current().text;
  const [b1, b2] = solveHard(q3).split(', ');
  ok(h.submit(`x = ${b2}; ${b1}`).ok === true && h.isUnlocked(), 'hard: both roots in the other order (with "x =") unlock');
  h.lock(); ok(!h.isUnlocked(), 'hard: lock() locks again');
  const h2 = P.create({ rng: lcg(3), now: () => 0, storage: null, generate: P.generateHardChallenge });
  const d = h2.current().text; const [c1, c2] = solveHard(d).split(', ');
  const dec = (s) => (s.includes('/') ? String(Number(s.split('/')[0]) / Number(s.split('/')[1])) : s);
  ok([dec(c1), dec(c2)].every(v => Number.isFinite(Number(v))) && h2.submit(`${dec(c1)}, ${dec(c2)}`).ok === true || h2.submit(`${c1}, ${c2}`).ok === true, 'hard: fractions or exact decimals are accepted');
  const easy = P.create({ rng: lcg(4), now: () => 0, storage: null });
  const hard = P.create({ rng: lcg(4), now: () => 0, storage: null, generate: P.generateHardChallenge });
  easy.submit(solveParent(easy.current().text));
  ok(easy.isUnlocked() && !hard.isUnlocked() && P.hard.isUnlocked() === false, 'hard instance is separate: unlocking the normal check does not unlock it');
  ok(P.parseRoots('-3, 1/2').length === 2 && P.parseRoots('−3, 1/2')[0].num === -3 && P.parseRoots('3') === null, 'parseRoots reads negatives and fractions');
}

console.log(failures ? `\n${failures} FAILED` : '\nAll parent verification checks passed');
process.exit(failures ? 1 : 0);
