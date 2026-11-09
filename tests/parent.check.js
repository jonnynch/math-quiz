// Unit checks for parent.js (parent verification): challenges, wrong/right answers, cooldown, session lock. No browser needed.
const path = require('path');
const P = require(path.join(__dirname, '..', 'public', 'parent.js'));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

// localStorage must never be touched: the unlocked state and the answer are not stored permanently.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('localStorage used'); } });

// Independent evaluation of the question text (digits and + − × ( ) only).
const evalText = (t) => { if (!/^[\d\s+−×()]+$/.test(t)) throw new Error('bad text ' + t); return Function('return ' + t.replace(/×/g, '*').replace(/−/g, '-'))(); };

function lcg(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function memStorage() { const m = {}; return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }
function session(extra) {
  const clock = { t: 1000000 };
  const storage = memStorage();
  const s = P.create({ rng: lcg(7), now: () => clock.t, storage, ...extra });
  return { s, clock, storage };
}
const answerOf = (s) => String(evalText(s.current().text));
const wrongOf = (s) => String(evalText(s.current().text) + 1);

// --- challenge generation
{
  const texts = new Set();
  let good = true;
  const rng = lcg(42);
  for (let i = 0; i < 5000; i++) {
    const c = P.generateChallenge(rng);
    const v = evalText(c.text);
    const ops = (c.text.match(/[+−×]/g) || []).length;
    if (v !== c.answer || !Number.isInteger(v) || v <= 0 || ops < 2 || v < 100) good = false;
    texts.add(c.text);
  }
  ok(good, '5000 generated challenges: whole positive answers equal to the recomputed text, at least two operations, multi-digit sizes');
  ok(texts.size > 4000, 'challenges are randomly generated, not a fixed list (' + texts.size + ' distinct of 5000)');
  const kinds = new Set([...texts].map(t => t.replace(/\d+/g, 'n')));
  ok(kinds.size >= 4, 'several different question shapes are used (' + kinds.size + ')');
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
  ok(s.submit('abc').reason === 'invalid' && s.submit('').reason === 'invalid' && s.submit('12.5').reason === 'invalid' && s.current().text === q && s.attemptsLeft() === 2, 'blank or non-numeric input is not counted as an attempt and keeps the question');
  const r2 = s.submit(' ' + String(evalText(q)).replace(/(\d)(?=(\d{3})+$)/g, '$1,') + ' ');
  ok(r2.ok === true && s.isUnlocked(), 'the right answer unlocks (spaces and thousands commas tolerated)');
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
  ok(reloaded.cooldownRemaining() === 18 && reloaded.submit(String(evalText(reloaded.current().text))).reason === 'cooldown' && !reloaded.isUnlocked(), 'refreshing the page does not skip the cooldown');
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

console.log(failures ? `\n${failures} FAILED` : '\nAll parent verification checks passed');
process.exit(failures ? 1 : 0);
