// No repeated questions within a game: bank de-duplication, deck dealing, reshuffle and reset.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };
const keysOf = list => list.map(Q.questionKey);
const allDistinct = list => new Set(list).size === list.length;
const deal = (deck, n) => Array.from({ length: n }, () => deck.next());

// ---- question identity
const base = { question: 'What is 6 × 7?', answers: ['40', '42', '44'], correct: 1 };
ok(Q.questionKey(base) === Q.questionKey({ question: base.question, answers: ['41', '42', '45'], correct: 1 }),
  'same wording + same correct answer = same question, whatever the wrong options');
ok(Q.questionKey(base) !== Q.questionKey({ ...base, figure: { type: 'clock', hour: 3, minute: 0 } }),
  'same wording but different figure = different question');
ok(Q.questionKey({ question: '4 + ? = 10', stage: { base: { emoji: '🐱' } }, answers: ['5', '6'], correct: 1 }) ===
   Q.questionKey({ question: '4 + ? = 10', stage: { base: { emoji: '🐶' } }, answers: ['6', '7'], correct: 0 }),
  'same maths with different decorative emoji = same question');

// ---- every level and topic (incl. Mixed All Questions)
const combos = [];
Q.DIFFICULTIES.forEach(d => {
  const topics = Q.isGrade(d.value) ? Q.topicsFor(d.value).map(t => t.value) : ['mixed'];
  topics.forEach(t => combos.push([d.value, t]));
});
ok(combos.some(([, t]) => t === 'all') && combos.length > 50, `covering ${combos.length} level/topic combinations incl. Mixed All Questions`);

let bad = [];
combos.forEach(([d, t]) => {
  const label = `${d}/${t}`;
  const bank = Q.buildQuestionBank(d, t, 500);
  if (!bank.length || bank.length > 500) bad.push(`${label}: bank size ${bank.length}`);
  if (!allDistinct(keysOf(bank))) bad.push(`${label}: bank has duplicate questions`);
  const n = bank.length;
  // First full round: no repeats.
  const deck = Q.createQuestionDeck(bank);
  const round1 = keysOf(deal(deck, n));
  if (!allDistinct(round1)) bad.push(`${label}: repeat before the pool was used up`);
  // Keeps going afterwards (never stops), uses the whole pool again, no back-to-back repeat at the boundary.
  const round2 = deal(deck, n);
  if (round2.some(q => !q || !bank.includes(q))) bad.push(`${label}: deck stopped or returned a foreign question`);
  if (n > 1 && Q.questionKey(round2[0]) === round1[n - 1]) bad.push(`${label}: same question twice in a row at reshuffle`);
  if (new Set(keysOf(round2)).size !== n) bad.push(`${label}: second round did not use the whole pool`);
});
ok(bad.length === 0, 'every level/topic: de-duplicated bank, no repeats until exhausted, then reshuffles' + (bad.length ? ' :: ' + bad.slice(0, 5).join(' | ') : ''));

// ---- repeats become possible after exhaustion
{
  const bank = Q.buildQuestionBank('grade3', 'tables', 500);
  const deck = Q.createQuestionDeck(bank);
  const first = keysOf(deal(deck, bank.length));
  const next = Q.questionKey(deck.next());
  ok(first.includes(next), 'after the pool is used up, previously shown questions can be dealt again');
}

// ---- tracking resets for a new game
{
  const bank = Q.buildQuestionBank('grade2', 'mixed', 500);
  const gameA = Q.createQuestionDeck(bank);
  deal(gameA, bank.length - 3);                       // part-way through game A
  const gameB = Q.createQuestionDeck(bank);           // new game = new deck
  const b = keysOf(deal(gameB, bank.length));
  ok(allDistinct(b) && b.length === bank.length, 'a new game starts with the full pool again (not affected by the previous game)');
  const p1 = Q.createQuestionDeck(bank), p2 = Q.createQuestionDeck(bank); // 1 v 1: each player has own deck
  deal(p1, 10);
  ok(allDistinct(keysOf(deal(p2, bank.length))), '1 v 1: one player using questions does not use up the other player\'s pool');
}

// ---- small pools: no infinite loop, game never stops
{
  const t0 = Date.now();
  const small = Q.buildQuestionBank('age5', 'mixed', 500);    // only a handful of distinct questions
  const tiny = Q.buildQuestionBank('grade1', 'shapes', 500);
  ok(Date.now() - t0 < 2000, 'building a bank for a tiny pool finishes quickly (attempts are capped)');
  ok(small.length >= 1 && small.length < 500 && allDistinct(keysOf(small)), `small pool (age5) gives ${small.length} distinct questions`);
  ok(tiny.length >= 1 && allDistinct(keysOf(tiny)), `small pool (grade1 shapes) gives ${tiny.length} distinct questions`);
  const deck = Q.createQuestionDeck(small);
  ok(deal(deck, small.length * 10).every(Boolean), 'deck keeps dealing questions for a small pool');

  const one = [Q.generateQuestion('grade3', 'add')];
  const d1 = Q.createQuestionDeck(one);
  ok(deal(d1, 25).every(q => q === one[0]), 'a pool of 1 repeats that question instead of stopping');
  const two = [Q.generateQuestion('grade3', 'add'), Q.generateQuestion('grade3', 'sub')];
  const d2 = Q.createQuestionDeck(two);
  const seq = deal(d2, 40);
  ok(seq.every(q => two.includes(q)) && seq.slice(1).every((q, i) => q !== seq[i]), 'a pool of 2 alternates without back-to-back repeats');
  ok(Q.buildQuestionBank('grade3', 'add', 5, 2).length <= 2, 'attempt cap is honoured');
}

// ---- speed
{
  const bank = Q.buildQuestionBank('grade6', 'all', 500);
  const deck = Q.createQuestionDeck(bank);
  const t0 = process.hrtime.bigint();
  deal(deck, 20000);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  ok(ms < 500, `20,000 next-question calls took ${ms.toFixed(1)} ms`);
}
