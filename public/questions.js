// Question generators. Pure logic (no DOM) so it can be tested on its own.
(function (root) {
  'use strict';

  const DIFFICULTIES = [
    { value: 'toddler', label: 'Age 2–3' },
    { value: 'age4', label: 'Age 4' },
    { value: 'age5', label: 'Age 5' },
    { value: 'age6', label: 'Age 6' },
    { value: 'grade1', label: 'Grade 1' },
    { value: 'grade2', label: 'Grade 2' },
    { value: 'grade3', label: 'Grade 3' },
    { value: 'grade4', label: 'Grade 4' },
    { value: 'grade5', label: 'Grade 5' },
    { value: 'grade6', label: 'Grade 6' }
  ];

  // Topics exist only for Grade 1-6. The age levels (2-3 to 6) have a fixed activity.
  const ALL = [1, 2, 3, 4, 5, 6];
  const TOPICS = [
    { value: 'all', label: 'Mixed All Questions', grades: ALL },
    { value: 'mixed', label: 'Mixed arithmetic', grades: ALL },
    { value: 'add', label: 'Addition only', grades: ALL },
    { value: 'sub', label: 'Subtraction only', grades: ALL },
    { value: 'mul', label: 'Multiplication only', grades: [2, 3, 4, 5, 6] },
    { value: 'div', label: 'Division only', grades: [2, 3, 4, 5, 6] },
    { value: 'tables', label: 'Times tables', grades: [2, 3, 4] },
    { value: 'numbers', label: 'Numbers & place value', grades: [1] },
    // Kept only so old saved games and reports still show a label. Not offered at any grade: standalone
    // comparisons were removed for Grades 1-4; Grades 5-6 compare a decimal with a fraction inside Fractions.
    { value: 'compare', label: 'Comparing numbers', grades: [] },
    { value: 'fractions', label: 'Fractions', grades: ALL },
    { value: 'money', label: 'Money', grades: [1, 2, 3, 4] },
    { value: 'clock', label: 'Clock reading', grades: [1, 2, 3, 4] },
    { value: 'shapes', label: 'Shapes & measures', grades: ALL }
  ];

  // Default for new profiles and for any missing or unavailable topic. Saved choices are never replaced.
  const DEFAULT_TOPIC = 'all';

  const isGrade = (difficulty) => /^grade[1-6]$/.test(difficulty);
  const gradeOf = (difficulty) => Number(String(difficulty).replace('grade', ''));
  const difficultyLabel = (value) => (DIFFICULTIES.find(d => d.value === value) || {}).label || value;
  const topicLabel = (value) => (TOPICS.find(t => t.value === value) || {}).label || value;
  const topicsFor = (difficulty) => isGrade(difficulty) ? TOPICS.filter(t => t.grades.includes(gradeOf(difficulty))) : [];
  const normaliseTopic = (difficulty, topic) =>
    topicsFor(difficulty).some(t => t.value === topic) ? topic : DEFAULT_TOPIC;

  // ---------- helpers ----------
  function shuffledCopy(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  const intBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const choose = (items) => items[intBetween(0, items.length - 1)];
  const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
  const sign = (x) => x < 0 ? -1 : x > 0 ? 1 : 0;

  // Chooses `count` wrong answers. Because the options are shown from smallest to largest, the
  // number of wrong answers placed below the correct one is picked at random, so the correct
  // answer lands in a random position instead of usually sitting in the middle.
  // `must` lists wrong answers that have to be included.
  function pickWrongAnswers(correct, pool, count, must = [], preferredBelow = null) {
    const unique = [...new Set(pool)].filter(v => v !== correct && v >= 0);
    const lower = unique.filter(v => v < correct);
    const upper = unique.filter(v => v > correct);
    const mustLower = must.filter(v => v < correct);
    const mustUpper = must.filter(v => v > correct);

    // Prefer values near the correct answer (with some randomness), after any required ones.
    const pickSide = (list, k, required) => {
      const rest = list
        .filter(v => !required.includes(v))
        .map(v => ({ v, key: Math.abs(v - correct) + Math.random() * 3 }))
        .sort((x, y) => x.key - y.key)
        .map(item => item.v);
      return [...required, ...rest].slice(0, k);
    };

    const lo = Math.max(mustLower.length, count - upper.length);
    const hi = Math.min(count - mustUpper.length, lower.length);
    if (lo <= hi) {
      const below = preferredBelow !== null && preferredBelow >= lo && preferredBelow <= hi
        ? preferredBelow
        : intBetween(lo, hi);
      return [...pickSide(lower, below, mustLower), ...pickSide(upper, count - below, mustUpper)];
    }
    // Not enough candidates for a split: just take the nearest ones.
    return pickSide(unique, count, must);
  }

  // Picks `count` wrong answers, including one typical mistake from `mistakes`. The position of the
  // correct answer is chosen first, and the mistake is taken from a side that allows it, so the correct
  // answer can still appear anywhere in the sorted list.
  function pickWithMistake(correct, pool, count, mistakes) {
    const target = intBetween(0, count);
    let candidates = [...new Set(mistakes)].filter(v => v !== correct && v >= 0);
    if (target === 0) candidates = candidates.filter(v => v > correct);
    else if (target === count) candidates = candidates.filter(v => v < correct);
    const must = candidates.length ? [choose(candidates)] : [];
    return pickWrongAnswers(correct, pool, count, must, target);
  }

  // Four (or `count`) numeric options between min and max, including the correct one.
  function makeNumberChoices(correct, min, max, count) {
    const pool = [];
    for (let n = min; n <= max; n++) if (n !== correct) pool.push(n);
    const wrong = pickWrongAnswers(correct, pool, count - 1);
    return { answers: [correct, ...wrong].map(String), correct: 0 };
  }

  // A numeric question with plausible wrong answers. `extras` are typical mistakes
  // (e.g. adding instead of multiplying); one of them is always included.
  function makeNumericQuestion(text, answer, options = {}) {
    const count = options.count || 4;
    const extras = [...new Set((options.extras || []).filter(v => Number.isInteger(v) && v >= 0 && v !== answer))];
    const offsets = answer > 40 ? [1, 2, 3, 5, 10, 20] : answer > 12 ? [1, 2, 3, 4, 5, 10] : [1, 2, 3, 4, 5, 6];
    const pool = [];
    offsets.forEach(n => pool.push(answer + n, answer - n));
    pool.push(...extras);
    for (let i = 0; i < 12; i++) pool.push(answer + intBetween(3, 30));
    const wrong = pickWithMistake(answer, pool, count - 1, extras);
    return { question: text, answers: [answer, ...wrong].map(String), correct: 0 };
  }

  // Builds a multiple-choice arithmetic question.
  // When `sameLastDigit` is true (Grade 4 and above), at least one wrong answer ends in the
  // same last digit as the correct answer, so the answer cannot be guessed from the last digit alone.
  function makeQuestion(a, operator, b, answer, sameLastDigit = false) {
    const pool = [];
    const must = [];
    let preferredBelow = null;
    const near = sameLastDigit ? [1, 2, 3, 4, 5, 6, 7, 9] : [1, 2, 3, 4];
    near.forEach(n => pool.push(answer + n, answer - n));
    if (sameLastDigit) {
      // Shifting by a multiple of 10 keeps the last digit.
      const sameDigit = [1, 2, 3, 4, 5, 10].flatMap(k => [answer + 10 * k, answer - 10 * k]).filter(v => v >= 0);
      // Decide first where the correct answer will sit (0-4 wrong answers below it), then put the
      // same-last-digit wrong answer on a side that allows that position.
      const target = intBetween(0, 4);
      let sides = sameDigit;
      if (target === 0) sides = sameDigit.filter(v => v > answer);
      if (target === 4) sides = sameDigit.filter(v => v < answer);
      if (sides.length) preferredBelow = target; else sides = sameDigit;
      const pick = choose(sides);
      must.push(pick);
      pool.push(pick);
    }
    for (let i = 0; i < 12; i++) pool.push(answer + intBetween(5, 30)); // safety net
    const wrong = pickWrongAnswers(answer, pool, 4, must, preferredBelow);
    return {
      question: `What is ${a} ${operator} ${b}?`,
      answers: [answer, ...wrong].map(String),
      correct: 0
    };
  }

  // ---------- fractions ----------
  const reduceFrac = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
  const fracText = (n, d) => d === 1 ? String(n) : `${n}/${d}`;

  // Fraction answers are listed by value, smallest to largest (the sort uses `keys`).
  function makeFractionQuestion(text, correctPair, mistakePairs = []) {
    const [rn, rd] = reduceFrac(correctPair[0], correctPair[1]);
    const key = (n, d) => Math.round((n / d) * 100);
    const correctKey = key(rn, rd);
    const cand = new Map();
    const add = (n, d) => {
      if (!(n > 0 && d > 0)) return null;
      const [a, b] = reduceFrac(n, d);
      const k = key(a, b);
      if (k !== correctKey && !cand.has(k)) cand.set(k, fracText(a, b));
      return k;
    };
    [-2, -1, 1, 2].forEach(o => { add(rn + o, rd); add(rn, rd + o); });
    const mustKeys = [];
    mistakePairs.forEach(([n, d]) => { const k = add(n, d); if (k !== null && cand.has(k)) mustKeys.push(k); });
    for (let i = 0; i < 40 && cand.size < 8; i++) add(intBetween(1, 9), intBetween(2, 12));
    const wrongKeys = pickWithMistake(correctKey, [...cand.keys()], 3, mustKeys);
    const entries = [[correctKey, fracText(rn, rd)], ...wrongKeys.map(k => [k, cand.get(k)])];
    return { question: text, answers: entries.map(e => e[1]), keys: entries.map(e => e[0]), correct: 0 };
  }

  const COMPARE_ANSWERS = ['< (less than)', '= (equal to)', '> (greater than)'];
  function makeCompareQuestion(text, cmp) {
    return { question: text, answers: [...COMPARE_ANSWERS], correct: cmp < 0 ? 0 : cmp === 0 ? 1 : 2 };
  }

  function makeFractionsQuestion(grade) {
    if (grade === 1) return makeGrade1FractionsQuestion();
    if (grade === 2) {
      const den = choose([2, 3, 4]);
      const n = den * intBetween(1, 10);
      return makeNumericQuestion(`What is 1/${den} of ${n}?`, n / den, { extras: [n, n - n / den] });
    }
    const ofAmount = (dens, maxK) => {
      const den = choose(dens);
      const num = intBetween(1, den - 1);
      const k = intBetween(2, maxK);
      const n = den * k;
      return makeNumericQuestion(`What is ${num}/${den} of ${n}?`, num * k, { extras: [k, n - num * k, n] });
    };
    if (grade === 3) {
      if (Math.random() < 0.5) return ofAmount([2, 3, 4, 5, 6, 8, 10], 10);
      const den = choose([2, 3, 4, 5, 6, 8, 10]), k = intBetween(2, 10);
      return makeNumericQuestion(`What is 1/${den} of ${den * k}?`, k, { extras: [den * k, den, den * k - k] });
    }
    if (grade === 4) {
      const kind = choose(['equiv', 'add', 'sub', 'amount']);
      if (kind === 'equiv') {
        const d = intBetween(2, 6), n = intBetween(1, d - 1), k = intBetween(2, 5);
        return makeNumericQuestion(`${n}/${d} = ?/${d * k}`, n * k, { extras: [n, n + k, d * k] });
      }
      if (kind === 'add') {
        const d = intBetween(5, 12), a = intBetween(1, d - 2), b = intBetween(1, d - 1 - a);
        return makeFractionQuestion(`${a}/${d} + ${b}/${d} = ? (simplest form)`, [a + b, d], [[a + b, d + d]]);
      }
      if (kind === 'sub') {
        const d = intBetween(5, 12), a = intBetween(2, d - 1), b = intBetween(1, a - 1);
        return makeFractionQuestion(`${a}/${d} − ${b}/${d} = ? (simplest form)`, [a - b, d], [[a + b, d]]);
      }
      return ofAmount([3, 4, 5, 6, 8, 10], 12);
    }
    if (grade === 5) {
      const kind = choose(['add', 'sub', 'compare', 'amount']);
      if (kind === 'amount') return ofAmount([3, 4, 5, 6, 8, 10, 12], 12);
      if (kind === 'compare') {
        return makeDecimalFractionCompare(5);
      }
      // Denominators where one is a multiple of the other, answer below 1.
      for (let tries = 0; tries < 200; tries++) {
        const b = choose([2, 3, 4, 5]);
        const k = intBetween(2, 4);
        const d = b * k;
        const a = intBetween(1, b - 1);
        const c = intBetween(1, d - 1);
        const total = a * k + c;
        if (kind === 'add' && total < d) {
          return makeFractionQuestion(`${a}/${b} + ${c}/${d} = ? (simplest form)`, [total, d], [[a + c, b + d]]);
        }
        const diff = a * k - c;
        if (kind === 'sub' && diff > 0) {
          return makeFractionQuestion(`${a}/${b} − ${c}/${d} = ? (simplest form)`, [diff, d], [[Math.abs(a - c), Math.abs(b - d) || d]]);
        }
      }
      return ofAmount([3, 4, 5, 6, 8, 10, 12], 12);
    }
    // Grade 6
    const kind = choose(['mul', 'divWhole', 'howMany', 'addUnlike', 'compare']);
    if (kind === 'compare') return makeDecimalFractionCompare(6);
    if (kind === 'mul') {
      const b = intBetween(2, 9), d = intBetween(2, 9);
      const a = intBetween(1, b - 1), c = intBetween(1, d - 1);
      return makeFractionQuestion(`${a}/${b} × ${c}/${d} = ? (simplest form)`, [a * c, b * d], [[a + c, b + d]]);
    }
    if (kind === 'divWhole') {
      const b = intBetween(2, 9), a = intBetween(1, b - 1), w = intBetween(2, 6);
      return makeFractionQuestion(`${a}/${b} ÷ ${w} = ? (simplest form)`, [a, b * w], [[a * w, b]]);
    }
    if (kind === 'howMany') {
      const d = intBetween(2, 8), w = intBetween(2, 9);
      return makeNumericQuestion(`How many 1/${d}s are in ${w}?`, w * d, { extras: [w, w + d, Math.max(1, Math.round(w / d))] });
    }
    for (let tries = 0; tries < 300; tries++) {
      const b = choose([2, 3, 4, 5, 6]), d = choose([2, 3, 4, 5, 6]);
      if (b === d || b % d === 0 || d % b === 0) continue;
      const a = intBetween(1, b - 1), c = intBetween(1, d - 1);
      const total = a * d + c * b;
      if (total < b * d) {
        return makeFractionQuestion(`${a}/${b} + ${c}/${d} = ? (simplest form)`, [total, b * d], [[a + c, b + d]]);
      }
    }
    return makeFractionQuestion('1/2 × 1/3 = ? (simplest form)', [1, 6], [[2, 5]]);
  }

  // ---------- times tables ----------
  function makeTablesQuestion(grade) {
    let a, b;
    if (grade === 2) { a = intBetween(2, 10); b = choose([2, 5, 10]); }
    else if (grade === 3) { a = intBetween(2, 10); b = intBetween(2, 10); }
    else { a = intBetween(2, 12); b = intBetween(6, 12); }
    if (Math.random() < 0.5) [a, b] = [b, a];
    const product = a * b;
    const kind = choose(['mul', 'mul', 'div', 'missing']);
    if (kind === 'div') return makeQuestion(product, '÷', a, b, grade >= 4);
    if (kind === 'missing') return makeNumericQuestion(`${a} × ? = ${product}`, b, { count: 5, extras: [a, product - a] });
    return makeQuestion(a, '×', b, product, grade >= 4);
  }

  // ---------- money (answers are in cents) ----------
  const coinText = (c) => c >= 100 ? `$${c / 100}` : `${c}c`;
  const moneyTotalText = (c) => c >= 100 ? `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}` : `${c}c`;
  const coinBreakdown = cents => {
    const coins = [];
    for (const value of AU_COINS.slice().reverse()) while (cents >= value) { coins.push(value); cents -= value; }
    return coins;
  };
  function makeMoneyQuestion(grade) {
    if (grade === 1) return makeGrade1MoneyQuestion();
    if (grade === 2) {
      const values = [5, 10, 20, 50, 100];
      let coins;
      do { coins = Array.from({ length: intBetween(2, 4) }, () => choose(values)); }
      while (coins.reduce((s, c) => s + c, 0) > 250);
      const total = coins.reduce((s, c) => s + c, 0);
      return Object.assign(makeNumericQuestion(`You have ${coins.map(coinText).join(', ')}. How many cents altogether?`, total, { extras: [Math.max(...coins), coins.length] }), { coins });
    }
    if (grade === 3) {
      if (Math.random() < 0.5) {
        const pay = choose([50, 100]);
        const price = pay === 50 ? intBetween(1, 9) * 5 : intBetween(1, 19) * 5;
        return Object.assign(makeNumericQuestion(`Something costs ${price}c. You pay ${coinText(pay)}. How many cents change?`, pay - price, { extras: [price, pay + price] }), { coins: [pay] });
      }
      const a = intBetween(1, 19) * 5, b = intBetween(1, 19) * 5;
      return Object.assign(makeNumericQuestion(`A pen costs ${a}c and a rubber costs ${b}c. How many cents altogether?`, a + b, { extras: [Math.abs(a - b), a] }), { coins: coinBreakdown(a + b) });
    }
    if (Math.random() < 0.5) {
      const qty = intBetween(2, 9), each = intBetween(2, 19) * 5;
      return Object.assign(makeNumericQuestion(`${qty} stickers cost ${each}c each. How many cents in total?`, qty * each, { extras: [qty + each, each] }), { coins: coinBreakdown(qty * each) });
    }
    const price = intBetween(5, 99) * 5, pay = choose([500, 1000]);
    return Object.assign(makeNumericQuestion(`A book costs ${price}c. You pay ${coinText(pay)}. How many cents change?`, pay - price, { extras: [price, pay + price] }), { notes: [pay] });
  }

  // ---------- clock reading (analogue clock figure, answers sorted by time) ----------
  function makeClockQuestion(grade) {
    const hour = intBetween(1, 12);
    const step = [null, 30, 15, 5, 1][grade];
    const minute = grade === 4 ? intBetween(0, 59) : intBetween(0, 60 / step - 1) * step;
    const keyOf = (h, m) => (h % 12) * 60 + m;
    const wrap = (k) => ((k % 720) + 720) % 720;
    const label = (k) => { const kk = wrap(k); const h = Math.floor(kk / 60) || 12; return `${h}:${String(kk % 60).padStart(2, '0')}`; };
    const correctKey = keyOf(hour, minute);
    const offsets = grade === 1 ? [30, 60, 90, 120, 150, 180]
      : grade === 2 ? [15, 30, 45, 60, 90, 120, 180]
        : grade === 3 ? [5, 10, 15, 30, 60, 120]
          : [1, 2, 3, 5, 10, 15, 30, 60];
    const cand = new Map();
    const add = (k) => { const kk = wrap(k); if (kk !== correctKey && !cand.has(kk)) cand.set(kk, label(kk)); return kk; };
    offsets.forEach(o => { add(correctKey + o); add(correctKey - o); });
    const must = [];
    // Hour and minute hands mixed up (e.g. 3:30 read as 6:15).
    if (minute % 5 === 0 && minute !== 0) {
      const swapped = keyOf(minute / 5, (hour % 12) * 5);
      if (wrap(swapped) !== correctKey && (grade !== 1 || (hour % 12) * 5 % 30 === 0)) must.push(add(swapped));
    }
    const wrongKeys = pickWithMistake(correctKey, [...cand.keys()], 4, must);
    const entries = [[correctKey, label(correctKey)], ...wrongKeys.map(k => [k, cand.get(k)])];
    return {
      question: 'What time does the clock show?',
      figure: { type: 'clock', hour, minute },
      answers: entries.map(e => e[1]),
      keys: entries.map(e => e[0]),
      correct: 0
    };
  }

  // ---------- shapes & measures ----------
  const POLYGON_NAMES = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon' };
  const SOLIDS = [
    { name: 'cube', faces: 6, edges: 12, vertices: 8 },
    { name: 'rectangular prism', faces: 6, edges: 12, vertices: 8 },
    { name: 'triangular prism', faces: 5, edges: 9, vertices: 6 },
    { name: 'square pyramid', faces: 5, edges: 8, vertices: 5 },
    { name: 'triangular pyramid', faces: 4, edges: 6, vertices: 4 }
  ];

  function makeShapesQuestion(grade) {
    if (grade === 1) return makeGrade1ShapesQuestion();
    if (grade === 2) {
      const n = intBetween(3, 8);
      const word = choose(['sides', 'corners']);
      const q = makeNumericQuestion(`How many ${word} does this shape have?`, n, { count: 4 });
      q.figure = { type: 'polygon', sides: n };
      return q;
    }
    if (grade === 3) {
      if (Math.random() < 0.4) {
        const n = intBetween(3, 10);
        return makeNumericQuestion(`How many sides does a ${POLYGON_NAMES[n]} have?`, n, { count: 4 });
      }
      const solid = choose(SOLIDS);
      const prop = choose(['faces', 'edges', 'vertices']);
      return makeNumericQuestion(`How many ${prop} does a ${solid.name} have?`, solid[prop], { count: 4 });
    }
    if (grade === 4) {
      if (Math.random() < 0.5) {
        const a = intBetween(20, 80), b = intBetween(20, 160 - a);
        return makeNumericQuestion(`A triangle has angles of ${a}° and ${b}°. What is the third angle?`, 180 - a - b, { extras: [180 - a, 180 - b, a + b] });
      }
      const l = intBetween(4, 15), w = intBetween(2, l);
      return makeNumericQuestion(`A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter in cm?`, 2 * (l + w), { extras: [l * w, l + w, 2 * l + w] });
    }
    if (grade === 5) {
      if (Math.random() < 0.7) {
        const l = intBetween(6, 20), w = intBetween(3, 15);
        return makeNumericQuestion(`A rectangle is ${l} cm long and ${w} cm wide. What is its area in cm²?`, l * w, { extras: [2 * (l + w), l + w] });
      }
      const s = intBetween(3, 15);
      return makeNumericQuestion(`A square has sides of ${s} cm. What is its area in cm²?`, s * s, { extras: [4 * s, 2 * s] });
    }
    const kind = choose(['triangle', 'parallelogram', 'quad']);
    if (kind === 'quad') {
      const a = intBetween(60, 120), b = intBetween(60, 120), c = intBetween(60, 120);
      return makeNumericQuestion(`A quadrilateral has angles of ${a}°, ${b}° and ${c}°. What is the fourth angle?`, 360 - a - b - c, { extras: [360 - a - b, 180 - c] });
    }
    let base = intBetween(3, 24);
    const height = intBetween(3, 20);
    if (kind === 'triangle') {
      if ((base * height) % 2 === 1) base += 1;
      return makeNumericQuestion(`A triangle has a base of ${base} cm and a height of ${height} cm. What is its area in cm²?`, base * height / 2, { extras: [base * height, base + height] });
    }
    return makeNumericQuestion(`A parallelogram has a base of ${base} cm and a height of ${height} cm. What is its area in cm²?`, base * height, { extras: [base * height / 2 | 0, 2 * (base + height)] });
  }

  // ---------- counting and age levels ----------
  const COUNT_OBJECTS = [
    { emoji: '🎈', name: 'balloons' },
    { emoji: '⚽', name: 'balls' },
    { emoji: '🍎', name: 'apples' },
    { emoji: '🐶', name: 'puppies' },
    { emoji: '🐥', name: 'chicks' },
    { emoji: '🚗', name: 'cars' },
    { emoji: '⭐', name: 'stars' },
    { emoji: '🍓', name: 'strawberries' },
    { emoji: '🐟', name: 'fish' },
    { emoji: '🦆', name: 'ducks' },
    { emoji: '🍌', name: 'bananas' },
    { emoji: '🐱', name: 'kittens' }
  ];

  function makeCountingQuestion() {
    const item = choose(COUNT_OBJECTS);
    const count = intBetween(1, 5);
    const choices = makeNumberChoices(count, 1, 5, 3);
    return {
      question: `How many ${item.name}?`,
      visual: Array(count).fill(item.emoji),
      visualLabel: `${item.name}: ${count}`,
      rowsOfFive: true,
      ...choices,
      simple: true
    };
  }

  // Age 2-3: two groups of different objects; the child taps the group with MORE (never "fewer").
  // The answers are the groups themselves (emoji strings); `answerLabels` are for screen readers / read-aloud.
  const COMPARE_PAIRS = [[1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 5]]; // clearly different, 1-5 objects
  function makeCompareGroupsQuestion() {
    const [small, large] = choose(COMPARE_PAIRS);
    const [itemA, itemB] = shuffledCopy(COUNT_OBJECTS);
    const more = itemA, less = itemB;
    const groups = [
      { item: more, count: large },
      { item: less, count: small }
    ];
    if (choose([true, false])) groups.reverse();   // random position for the correct group
    return {
      question: 'Which group has more?',
      answers: groups.map(g => g.item.emoji.repeat(g.count)),
      answerLabels: groups.map(g => `${g.item.name}: ${g.count}`),
      correct: groups.findIndex(g => g.count === large),
      groups: true,
      simple: true
    };
  }

  // Age 2-3 has exactly two question types: counting and comparing two groups.
  function makeToddlerQuestion() {
    return choose([true, false]) ? makeCountingQuestion() : makeCompareGroupsQuestion();
  }

  // ---------- Age 4: five picture question types that teach number sense ----------
  // A picture is a list of groups; a group is rows of cells written as strings:
  // X object, x crossed-out (removed) object, O empty slot (missing object), . blank space.
  // Layouts are chosen once per question and never change while the child answers.
  const COUNT_LAYOUTS = {
    1: { single: ['X'] },
    2: { pair: ['XX'], column: ['X', 'X'] },
    3: { row: ['XXX'], diagonal: ['X..', '.X.', '..X'], corner: ['XX', 'X.'] },
    4: { square: ['XX', 'XX'], row: ['XXXX'], 'three-one': ['XXX', 'X..'] },
    5: { row: ['XXXXX'], dice: ['X.X', '.X.', 'X.X'], 'three-two': ['XXX', 'XX.'] },
    6: { 'two-threes': ['XXX', 'XXX'], 'three-pairs': ['XX', 'XX', 'XX'], 'five-one': ['XXXXX', 'X....'] },
    7: { 'four-three': ['XXXX', 'XXX.'], 'five-two': ['XXXXX', 'XX...'], 'dice-seven': ['X.X', 'XXX', 'X.X'] },
    8: { 'two-fours': ['XXXX', 'XXXX'], 'five-three': ['XXXXX', 'XXX..'], ring: ['XXX', 'X.X', 'XXX'] },
    9: { 'three-by-three': ['XXX', 'XXX', 'XXX'], 'five-four': ['XXXXX', 'XXXX.'], 'four-four-one': ['XXXX', 'XXXX', 'X...'] },
    10: { 'two-fives': ['XXXXX', 'XXXXX'], 'three-four-three': ['XXX.', 'XXXX', 'XXX.'], 'four-four-two': ['XXXX', 'XXXX', 'XX..'] }
  };

  // A scattered, irregular arrangement on a small grid, so children learn the quantity and not one pattern.
  function irregularLayout(count) {
    const cols = count > 8 ? 5 : 4, rows = 3;
    const known = Object.values(COUNT_LAYOUTS[count]).map(l => l.join('/'));
    for (let attempt = 0; attempt < 60; attempt++) {
      const chosen = shuffledCopy([...Array(cols * rows).keys()]).slice(0, count);
      let grid = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => chosen.includes(r * cols + c) ? 'X' : '.').join(''));
      grid = grid.filter(r => r.includes('X'));
      const used = [...grid[0]].map((_, c) => grid.some(r => r[c] === 'X'));
      const first = used.indexOf(true), last = used.lastIndexOf(true);
      grid = grid.map(r => r.slice(first, last + 1));
      if (grid.length >= 2 && grid[0].length >= 2 && grid.some(r => r.includes('.')) && !known.includes(grid.join('/'))) {
        return { kind: 'irregular', rows: grid };
      }
    }
    const [kind, rows2] = choose(Object.entries(COUNT_LAYOUTS[count]));
    return { kind, rows: rows2 };
  }

  // One layout rule for every Age 4 arithmetic picture (add, subtract, missing number). It looks at EVERY number
  // in the equation, answer included:
  //  - all in {3, 6, 9}: 3 per row, so each number fills whole rows;
  //  - else all in {2, 4, 6, 8}: two rows filled column by column, so each number fills whole columns;
  //  - else 5 per row (up to two rows), filled in reading order.
  function pictureLayout(...numbers) {
    if (numbers.every(n => [3, 6, 9].includes(n))) return 'threes';
    if (numbers.every(n => [2, 4, 6, 8].includes(n))) return 'twos';
    return 'fives';
  }

  // Lays the cells of `sequence` (a string such as 'XXXOO') out as rows for the chosen layout.
  function arrangeCells(sequence, layout) {
    const cells = sequence.split('');
    if (layout === 'twos') {
      const rows = ['', ''];
      cells.forEach((c, i) => { rows[i % 2] += c; });
      return rows;
    }
    const perRow = layout === 'threes' ? 3 : 5;
    const rows = [];
    for (let i = 0; i < cells.length; i += perRow) rows.push(cells.slice(i, i + perRow).join(''));
    return rows;
  }

  const tierOf = (size) => size <= 5 ? 1 : size <= 8 ? 2 : 3;
  const key = (...parts) => parts.join(' ');

  // A. Count 1-10 objects in a varied arrangement. Prompt: "How many?"
  function makeCounting10Question() {
    const item = choose(COUNT_OBJECTS);
    const count = intBetween(1, 10);
    const layout = count >= 4 && Math.random() < 0.25
      ? irregularLayout(count)
      : (([kind, rows]) => ({ kind, rows }))(choose(Object.entries(COUNT_LAYOUTS[count])));
    return {
      question: 'How many?',
      picture: {
        groups: [{ emoji: item.emoji, rows: layout.rows }],
        label: `${item.name}: ${count}`,
        key: key('count', count, layout.kind === 'irregular' ? 'irregular' : layout.rows.join('/'))
      },
      ...makeNumberChoices(count, 1, 10, 4),
      tier: tierOf(count),
      simple: true
    };
  }

  // B. "Which group has more?" with two groups of different objects (up to 10 each); tap a group.
  // Groups of more than 5 wrap after five so rows line up and are easy to compare.
  const groupText = (emoji, n) => n <= 5 ? emoji.repeat(n) : `${emoji.repeat(5)}\n${emoji.repeat(n - 5)}`;
  const COMPARE_PAIRS10 = [];
  for (let large = 2; large <= 10; large++) for (let small = 1; small < large; small++) COMPARE_PAIRS10.push([small, large]);
  function makeCompare10Question() {
    const [small, large] = choose(COMPARE_PAIRS10);
    const [more, less] = shuffledCopy(COUNT_OBJECTS);
    const groups = [{ item: more, count: large }, { item: less, count: small }];
    if (choose([true, false])) groups.reverse();
    const gap = large - small;
    return {
      question: 'Which group has more?',
      answers: groups.map(g => groupText(g.item.emoji, g.count)),
      answerLabels: groups.map(g => `${g.item.name}: ${g.count}`),
      correct: groups.findIndex(g => g.count === large),
      groups: true,
      tier: gap === 1 ? 3 : (gap >= 3 && large <= 6) ? 1 : 2,
      simple: true
    };
  }

  // C. Picture addition within 10: "3 + 2 = ?" with the two groups shown side by side.
  const ADD_PAIRS = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; a + b <= 10; b++) ADD_PAIRS.push([a, b]);
  function makeAddition10Question() {
    const [a, b] = choose(ADD_PAIRS);
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    const layout = pictureLayout(a, b, a + b);
    return {
      question: `${a} + ${b} = ?`,
      resultText: `${a} + ${b} = ${a + b}`,
      picture: {
        // X = first kind of object, Y = second kind; one frame shows both addends together
        groups: [{ emoji: first.emoji, emoji2: second.emoji, rows: arrangeCells('X'.repeat(a) + 'Y'.repeat(b), layout) }],
        label: `${a} ${first.name} and ${b} ${second.name}`,
        key: key('add', a, b, layout)
      },
      ...makeNumberChoices(a + b, 1, 10, 4),
      tier: tierOf(a + b),
      simple: true
    };
  }

  // D. Picture subtraction within 10: all objects are shown in one frame, the remaining ones first and the
  // ones taken away (crossed out) last, laid out by pictureLayout(a, b, a - b).
  const SUB_PAIRS = [];
  for (let a = 2; a <= 10; a++) for (let b = 1; b < a; b++) SUB_PAIRS.push([a, b]);
  function makeSubtraction10Question() {
    const [a, b] = choose(SUB_PAIRS);
    const item = choose(COUNT_OBJECTS);
    const keep = a - b;
    const layout = pictureLayout(a, b, keep);
    return {
      question: `${a} − ${b} = ?`,
      resultText: `${a} − ${b} = ${keep}`,
      picture: {
        groups: [{ emoji: item.emoji, rows: arrangeCells('X'.repeat(keep) + 'x'.repeat(b), layout) }],
        label: `${a} ${item.name}, ${b} crossed out`,
        key: key('sub', a, b, layout)
      },
      ...makeNumberChoices(keep, 1, 10, 4),
      tier: tierOf(a),
      simple: true
    };
  }

  // E. Missing-number addition within 10: "3 + ? = 5" or "? + 2 = 5". One frame shows the whole total:
  // objects for the known number and empty circles for the missing one, in the order of the equation,
  // laid out by pictureLayout(known, missing, total).
  const MISSING_CASES = [];
  for (let k = 1; k <= 9; k++) for (let m = 1; k + m <= 10; m++) { MISSING_CASES.push([k, m, true]); MISSING_CASES.push([k, m, false]); }
  function makeMissingNumberQuestion() {
    const [known, missing, knownFirst] = choose(MISSING_CASES);
    const total = known + missing;
    const item = choose(COUNT_OBJECTS);
    const layout = pictureLayout(known, missing, total);
    const rows = arrangeCells(knownFirst ? 'X'.repeat(known) + 'O'.repeat(missing) : 'O'.repeat(missing) + 'X'.repeat(known), layout);
    return {
      question: knownFirst ? `${known} + ? = ${total}` : `? + ${known} = ${total}`,
      resultText: knownFirst ? `${known} + ${missing} = ${total}` : `${missing} + ${known} = ${total}`,
      picture: {
        groups: [{ emoji: item.emoji, rows }],
        label: `${known} ${item.name} and ${missing} empty ${missing === 1 ? 'space' : 'spaces'}`,
        key: key('missing', known, missing, knownFirst ? 'known-first' : 'known-last', layout)
      },
      ...makeNumberChoices(missing, 1, 10, 4),
      tier: tierOf(total),
      simple: true
    };
  }

  // Age 4 has exactly five question types, picked at random.
  function makeAge4Question() {
    return choose([makeCounting10Question, makeCompare10Question, makeAddition10Question, makeSubtraction10Question, makeMissingNumberQuestion])();
  }

  // ---------- Age 5: ONE question pool, ten topics, difficulty rising through `tier` ----------
  // There are no stages or sub-levels. Every question carries a `topic`, a `kind` and a `tier` (1 easiest);
  // `createQuestionDeck` deals easier tiers first (allowed tier +1 every 6 questions), so "fewer", crossing 10,
  // place value, number notation and so on arrive gradually inside the same pool.
  const weightedChoose = (pairs) => {
    let roll = Math.random() * pairs.reduce((sum, p) => sum + p[1], 0);
    for (const [item, weight] of pairs) { roll -= weight; if (roll < 0) return item; }
    return pairs[pairs.length - 1][0];
  };
  const tag = (q, topic, kind, tier) => Object.assign(q, { topic, kind, tier, simple: true });

  // Four numeric choices within min..max around `answer`; `extras` are typical mistakes (one is always included).
  function numberChoices(answer, min, max, extras = []) {
    const pool = [];
    for (let n = Math.max(min, answer - 5); n <= Math.min(max, answer + 5); n++) if (n !== answer) pool.push(n);
    const mistakes = [...new Set(extras)].filter(v => Number.isInteger(v) && v >= min && v <= max && v !== answer);
    pool.push(...mistakes);
    return { answers: [answer, ...pickWithMistake(answer, pool, 3, mistakes)].map(String), correct: 0 };
  }

  // Same, but from an explicit candidate list (skip counting, tens).
  function choicesFrom(answer, candidates, mistakes = []) {
    const fits = (v) => Number.isInteger(v) && v >= 0 && v !== answer;
    const pool = [...new Set(candidates)].filter(fits);
    return { answers: [answer, ...pickWithMistake(answer, pool, 3, mistakes.filter(fits))].map(String), correct: 0 };
  }

  const chunkRows = (size, perRow) => {
    const rows = [];
    for (let i = 0; i < size; i += perRow) rows.push('X'.repeat(Math.min(perRow, size - i)));
    return rows;
  };

  // ----- 1. Counting objects 1-20 -----
  // 11-20 are shown as familiar groups of [size, objects per row]: 10 + n as a ten-frame, 6 + 6, 10 + 5, 10 + 10 ...
  const GROUPED_COUNTS = {
    11: [[[10, 5], [1, 1]], [[5, 5], [6, 3]]],
    12: [[[10, 5], [2, 2]], [[6, 3], [6, 3]]],
    13: [[[10, 5], [3, 3]], [[5, 5], [8, 4]]],
    14: [[[10, 5], [4, 2]], [[7, 4], [7, 4]]],
    15: [[[10, 5], [5, 5]], [[6, 3], [9, 3]]],
    16: [[[10, 5], [6, 3]], [[8, 4], [8, 4]]],
    17: [[[10, 5], [7, 4]], [[9, 3], [8, 4]]],
    18: [[[10, 5], [8, 4]], [[9, 3], [9, 3]]],
    19: [[[10, 5], [9, 3]], [[10, 5], [9, 5]]],
    20: [[[10, 5], [10, 5]]]
  };

  // Scattered arrangement of 11-15 objects on a 6 x 3 grid (never a full block, so it is not a known pattern).
  function scatterLayout(count) {
    const cols = 6, rows = 3;
    for (let attempt = 0; attempt < 60; attempt++) {
      const chosen = shuffledCopy([...Array(cols * rows).keys()]).slice(0, count);
      let grid = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => chosen.includes(r * cols + c) ? 'X' : '.').join(''));
      grid = grid.filter(r => r.includes('X'));
      const used = [...grid[0]].map((_, c) => grid.some(r => r[c] === 'X'));
      const first = used.indexOf(true), last = used.lastIndexOf(true);
      grid = grid.map(r => r.slice(first, last + 1));
      if (grid.length >= 2 && grid.some(r => r.includes('.'))) return grid;
    }
    return null;
  }

  function makeCounting20Question() {
    const item = choose(COUNT_OBJECTS);
    const count = intBetween(1, 20);
    let groups, arrangement, irregular = false;
    if (count <= 10) {
      const layout = count >= 4 && Math.random() < 0.25
        ? irregularLayout(count)
        : (([kind, rows]) => ({ kind, rows }))(choose(Object.entries(COUNT_LAYOUTS[count])));
      irregular = layout.kind === 'irregular';
      groups = [{ emoji: item.emoji, rows: layout.rows }];
      arrangement = layout.rows.join('/');
    } else {
      const scatter = count <= 15 && Math.random() < 0.25 ? scatterLayout(count) : null;
      if (scatter) {
        irregular = true;
        groups = [{ emoji: item.emoji, rows: scatter }];
        arrangement = scatter.join('/');
      } else {
        const spec = choose(GROUPED_COUNTS[count]);
        groups = spec.map(([size, perRow]) => ({ emoji: item.emoji, rows: chunkRows(size, perRow) }));
        arrangement = groups.map(g => g.rows.join('/')).join('+');
      }
    }
    const base = count <= 6 ? 1 : count <= 15 ? 2 : 3;
    return tag({
      question: 'How many?',
      picture: { groups, label: `${item.name}: ${count}`, key: key('count5', count, irregular ? 'irregular ' + arrangement : arrangement) },
      ...numberChoices(count, 1, 20)
    }, 'counting', irregular ? 'irregular' : count > 10 ? 'grouped' : 'arranged', Math.min(3, base + (irregular && count > 6 ? 1 : 0)));
  }

  // ----- 2. Comparing groups: "more", with "fewer" introduced gradually -----
  const COMPARE_PAIRS12 = [];
  for (let large = 2; large <= 12; large++) for (let small = 1; small < large; small++) COMPARE_PAIRS12.push([small, large]);
  const groupTextSix = (emoji, n) => n <= 6 ? emoji.repeat(n) : `${emoji.repeat(6)}\n${emoji.repeat(n - 6)}`;

  function makeCompareAge5Question() {
    const [small, large] = choose(COMPARE_PAIRS12);
    const gap = large - small;
    const base = gap === 1 || large >= 10 ? 3 : gap >= 4 && large <= 8 ? 1 : 2;
    // "fewer" needs a clear gap; it is rare among the easy pairs and common among the harder ones.
    const fewer = gap >= 2 && Math.random() < [0, 0.1, 0.25, 0.6][base];
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    const groups = [{ item: first, count: large }, { item: second, count: small }];
    if (choose([true, false])) groups.reverse();
    const target = fewer ? small : large;
    return tag({
      question: fewer ? 'Which group has fewer?' : 'Which group has more?',
      answers: groups.map(g => groupTextSix(g.item.emoji, g.count)),
      answerLabels: groups.map(g => `${g.item.name}: ${g.count}`),
      correct: groups.findIndex(g => g.count === target),
      groups: true
    }, 'compare', fewer ? 'fewer' : 'more', fewer ? Math.max(2, base) : base);
  }

  // ----- 3. Addition -----
  const DOUBLE_ITEMS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  function makeAdditionAge5Question() {
    const kind = weightedChoose([['picture', 26], ['bond', 14], ['make10', 16], ['double', 14], ['missing', 16], ['beyond', 14]]);
    const [first, second] = shuffledCopy(COUNT_OBJECTS);

    if (kind === 'picture') {
      // Picture first. Small sums are asked without any numbers ("How many altogether?"); notation comes in with larger sums.
      const [a, b] = choose(ADD_PAIRS);
      const sum = a + b, layout = pictureLayout(a, b, sum);
      const words = sum <= 6 && Math.random() < 0.65;
      return tag({
        question: words ? 'How many altogether?' : `${a} + ${b} = ?`,
        resultText: `${a} + ${b} = ${sum}`,
        picture: {
          groups: [{ emoji: first.emoji, emoji2: second.emoji, rows: arrangeCells('X'.repeat(a) + 'Y'.repeat(b), layout) }],
          label: `${a} ${first.name} and ${b} ${second.name}`,
          key: key('add5', a, b, layout, words ? 'words' : 'sum')
        },
        ...numberChoices(sum, 1, 10, [a, b])
      }, 'addition', 'picture', words ? 1 : 2);
    }

    if (kind === 'bond') {
      // Number bonds within 10: the whole is shown, find the missing part.
      const total = intBetween(3, 10), known = intBetween(1, total - 1), missing = total - known;
      const layout = pictureLayout(known, missing, total);
      return tag({
        question: `${known} and ? make ${total}`,
        resultText: `${known} + ${missing} = ${total}`,
        picture: {
          groups: [{ emoji: first.emoji, rows: arrangeCells('X'.repeat(known) + 'O'.repeat(missing), layout) }],
          label: `${known} ${first.name} and ${missing} empty ${missing === 1 ? 'space' : 'spaces'}`,
          key: key('bond5', known, missing, layout)
        },
        ...numberChoices(missing, 1, 10, [known, total])
      }, 'addition', 'bond', total <= 6 ? 1 : 2);
    }

    if (kind === 'make10') {
      const known = intBetween(1, 9), missing = 10 - known, knownFirst = Math.random() < 0.7;
      const withPicture = Math.random() < 0.6;
      const q = {
        question: knownFirst ? `${known} + ? = 10` : `? + ${known} = 10`,
        resultText: knownFirst ? `${known} + ${missing} = 10` : `${missing} + ${known} = 10`,
        ...numberChoices(missing, 0, 10, [known, 9])
      };
      if (withPicture) {
        const seq = knownFirst ? 'X'.repeat(known) + 'O'.repeat(missing) : 'O'.repeat(missing) + 'X'.repeat(known);
        q.picture = { groups: [{ emoji: first.emoji, rows: arrangeCells(seq, 'fives') }], label: `${known} ${first.name} and ${missing} empty spaces`, key: key('make10', known, knownFirst ? 'first' : 'last') };
      }
      return tag(q, 'addition', 'make10', withPicture ? 1 : 2);
    }

    if (kind === 'double') {
      const a = choose(DOUBLE_ITEMS);
      const q = { question: `${a} + ${a} = ?`, resultText: `${a} + ${a} = ${2 * a}`, ...numberChoices(2 * a, 2, 20, [a, 2 * a - 1, 2 * a + 1]) };
      if (a <= 5) {
        // two matching rows make the "double" easy to see
        q.picture = { groups: [{ emoji: first.emoji, emoji2: second.emoji, rows: ['X'.repeat(a), 'Y'.repeat(a)] }], label: `${a} ${first.name} and ${a} ${second.name}`, key: key('double', a) };
      }
      return tag(q, 'addition', 'double', a <= 3 ? 1 : a <= 5 ? 2 : 3);
    }

    if (kind === 'missing') {
      // Missing addend. Within 10 a picture is shown; beyond 10 it is numbers only.
      const big = Math.random() < 0.4;
      let known, total;
      if (big) { known = intBetween(10, 17); total = intBetween(known + 1, 10 * Math.floor(known / 10) + 9); }
      else { total = intBetween(3, 10); known = intBetween(1, total - 1); }
      const missing = total - known, knownFirst = Math.random() < 0.6;
      const q = {
        question: knownFirst ? `${known} + ? = ${total}` : `? + ${known} = ${total}`,
        resultText: knownFirst ? `${known} + ${missing} = ${total}` : `${missing} + ${known} = ${total}`,
        ...numberChoices(missing, 1, big ? 9 : 10, [known > 9 ? known - 10 : known, total])
      };
      if (!big) {
        const layout = pictureLayout(known, missing, total);
        const seq = knownFirst ? 'X'.repeat(known) + 'O'.repeat(missing) : 'O'.repeat(missing) + 'X'.repeat(known);
        q.picture = { groups: [{ emoji: first.emoji, rows: arrangeCells(seq, layout) }], label: `${known} ${first.name} and ${missing} empty ${missing === 1 ? 'space' : 'spaces'}`, key: key('miss5', known, missing, knownFirst ? 'first' : 'last', layout) };
      }
      return tag(q, 'addition', 'missing', big ? 3 : 2);
    }

    // Beyond 10 with no carrying: 12 + 3, 3 + 12 ...
    const a = intBetween(10, 18), b = intBetween(1, 9 - (a % 10));
    const swap = a > 10 && Math.random() < 0.3;
    const [x, y] = swap ? [b, a] : [a, b];
    return tag({
      question: `${x} + ${y} = ?`,
      resultText: `${x} + ${y} = ${a + b}`,
      ...numberChoices(a + b, 11, 20, [a, a + b - 10, a + b + 1])
    }, 'addition', 'beyond10', a === 10 ? 2 : 3);
  }

  // ----- 4. Subtraction -----
  // Picture of up to 20 objects as a ten-frame group plus the rest; the last `gone` objects are crossed out.
  function crossedGroups(emoji, keep, gone) {
    const seq = 'X'.repeat(keep) + 'x'.repeat(gone);
    return [seq.slice(0, 10), seq.slice(10)].filter(Boolean).map(s => ({ emoji, rows: s.match(/.{1,5}/g) }));
  }

  function makeSubtractionAge5Question() {
    const kind = weightedChoose([['picture10', 20], ['picture20', 12], ['beyond10', 14], ['cross10', 14], ['missingSub', 12], ['missingMin', 8], ['inverse', 18]]);
    const item = choose(COUNT_OBJECTS);

    if (kind === 'picture10') {
      const [a, b] = choose(SUB_PAIRS), keep = a - b, layout = pictureLayout(a, b, keep);
      const words = a <= 6 && Math.random() < 0.65;
      return tag({
        question: words ? 'How many are left?' : `${a} − ${b} = ?`,
        resultText: `${a} − ${b} = ${keep}`,
        picture: {
          groups: [{ emoji: item.emoji, rows: arrangeCells('X'.repeat(keep) + 'x'.repeat(b), layout) }],
          label: `${a} ${item.name}, ${b} crossed out`,
          key: key('sub5', a, b, layout, words ? 'words' : 'sum')
        },
        ...numberChoices(keep, 1, 10, [b, a])
      }, 'subtraction', 'picture', words ? 1 : 2);
    }

    if (kind === 'picture20') {
      // Within 20 with a picture. Taking away across 10 (13 − 5) is the harder version and is only tier 3.
      const crossing = Math.random() < 0.3;
      const a = intBetween(11, 20);
      const b = crossing ? intBetween(a - 9, Math.min(9, a - 1)) : intBetween(1, a - 10);
      if (crossing && a - 9 > Math.min(9, a - 1)) return makeSubtractionAge5Question();
      const keep = a - b;
      return tag({
        question: `${a} − ${b} = ?`,
        resultText: `${a} − ${b} = ${keep}`,
        picture: { groups: crossedGroups(item.emoji, keep, b), label: `${a} ${item.name}, ${b} crossed out`, key: key('sub5', 'twenty', a, b) },
        ...numberChoices(keep, 1, 20, [b, crossing ? b - (a - 10) : a - b - 1, a])
      }, 'subtraction', crossing ? 'cross10' : 'within20', crossing ? 3 : 2);
    }

    if (kind === 'beyond10') {
      const a = intBetween(12, 19), b = intBetween(1, a - 10);
      return tag({
        question: `${a} − ${b} = ?`,
        resultText: `${a} − ${b} = ${a - b}`,
        ...numberChoices(a - b, 10, 19, [b, a, a - b - 1])
      }, 'subtraction', 'within20', 3);
    }

    if (kind === 'cross10') {
      // Crossing 10 with numbers only, e.g. 13 − 5.
      const a = intBetween(11, 18), b = intBetween(a - 9, 9);
      if (b >= a) return makeSubtractionAge5Question();
      const answer = a - b;
      return tag({
        question: `${a} − ${b} = ?`,
        resultText: `${a} − ${b} = ${answer}`,
        ...numberChoices(answer, 1, 19, [b - (a - 10), answer + 2, a - 10])
      }, 'subtraction', 'cross10', 3);
    }

    if (kind === 'missingSub') {
      const a = intBetween(4, 20), b = intBetween(1, a - 1), c = a - b;
      return tag({
        question: `${a} − ? = ${c}`,
        resultText: `${a} − ${b} = ${c}`,
        ...numberChoices(b, 1, 19, [c, a])
      }, 'subtraction', 'missingSubtrahend', a <= 10 ? 2 : 3);
    }

    if (kind === 'missingMin') {
      const b = intBetween(1, 9), c = intBetween(1, 20 - b), a = b + c;
      return tag({
        question: `? − ${b} = ${c}`,
        resultText: `${a} − ${b} = ${c}`,
        ...numberChoices(a, 2, 20, [c, b, c - b > 0 ? c - b : c + 1])
      }, 'subtraction', 'missingMinuend', 3);
    }

    // Inverse relationship: a fact family. "3 + 4 = 7, so 7 − 4 = ?" or "7 − 4 = 3, so 3 + 4 = ?"
    const total = intBetween(3, 20), y = intBetween(1, total - 1), x = total - y;
    const tier = total <= 10 ? 2 : 3;
    if (Math.random() < 0.55) {
      return tag({ question: `${x} + ${y} = ${total}, so ${total} − ${y} = ?`, ...numberChoices(x, 1, 19, [y, total]) }, 'subtraction', 'inverse', tier);
    }
    return tag({ question: `${total} − ${y} = ${x}, so ${x} + ${y} = ?`, ...numberChoices(total, 2, 20, [x, y, total - 1]) }, 'subtraction', 'inverse', tier);
  }

  // ----- 5. Place value: a rectangle marked 10 = one ten, a circle marked 1 = one one (never money) -----
  const blocksOf = (n) => {
    const tens = Math.floor(n / 10), ones = n % 10;
    const label = `${tens} ${tens === 1 ? 'rectangle' : 'rectangles'} marked 10${ones ? ` and ${ones} ${ones === 1 ? 'circle' : 'circles'} marked 1` : ''}`;
    return { type: 'blocks', tens, ones, label };
  };
  const swapDigits = (n) => (n % 10) * 10 + Math.floor(n / 10);

  function makePlaceValueQuestion() {
    const kind = weightedChoose([['read', 28], ['build', 24], ['count', 22], ['decompose', 26]]);
    let n = intBetween(11, 29);
    if (n % 10 === 0) n += 1;
    const tens = Math.floor(n / 10), ones = n % 10;

    if (kind === 'read') {
      const swap = swapDigits(n);
      const candidates = [n - 1, n + 1, n - 10, n + 10, swap, tens + ones, n + 2, n - 2];
      return tag({
        question: 'What number is shown?',
        promptVisual: blocksOf(n),
        ...choicesFrom(n, candidates, [swap !== n ? swap : n + 1, tens + ones])
      }, 'placevalue', 'read', n < 20 ? 1 : 2);
    }

    if (kind === 'build') {
      const swap = swapDigits(n);
      const candidates = [n - 1, n + 1, n - 10, n + 10, swap, n + 9, n - 9].filter(v => v >= 1 && v <= 49);
      const wrong = pickWithMistake(n, candidates, 3, swap !== n && swap <= 49 ? [swap] : []);
      const values = [n, ...wrong].sort((a, b) => a - b);
      return tag({
        question: `Which shows ${n}?`,
        answers: values.map(v => blocksOf(v).label),
        answerLabels: values.map(v => blocksOf(v).label),
        answerVisuals: values.map(blocksOf),
        correct: values.indexOf(n)
      }, 'placevalue', 'build', n < 20 ? 2 : 3);
    }

    if (kind === 'count') {
      const askTens = Math.random() < 0.5;
      const choices = askTens ? numberChoices(tens, 0, 5, [ones <= 5 ? ones : tens + 1]) : numberChoices(ones, 0, 9, [tens]);
      return tag({ question: askTens ? 'How many 10s?' : 'How many 1s?', promptVisual: blocksOf(n), ...choices }, 'placevalue', askTens ? 'count10s' : 'count1s', 2);
    }

    // Decomposing. With one ten there is a picture; beyond that it is numbers only.
    const form = tens === 1 ? choose(['pic', 'tail']) : choose(['head', 'tail']);
    if (form === 'pic') {
      return tag({ question: `${n} = 10 + ?`, promptVisual: blocksOf(n), ...numberChoices(ones, 0, 9, [tens + 1, ones + 1]) }, 'placevalue', 'decompose', 2);
    }
    if (form === 'head') {
      return tag({ question: `${n} = ${tens * 10} + ?`, ...numberChoices(ones, 0, 9, [tens, ones + 1]) }, 'placevalue', 'decompose', 3);
    }
    const answer = tens * 10;
    return tag({
      question: `${n} = ? + ${ones}`,
      ...choicesFrom(answer, [answer + 10, answer - 10, answer + 20, ones, tens, n], [ones, tens])
    }, 'placevalue', 'decompose', 3);
  }

  // ----- 6. Counting sequences: short, one missing number, forwards/backwards by 1, skip counting by 2, 5, 10 -----
  function makeSequenceQuestion() {
    const kind = weightedChoose([['forward', 30], ['backward', 22], ['skip2', 18], ['skip5', 16], ['skip10', 14]]);
    const len = choose([3, 4, 4, 5, 5]);
    let step, start, base;
    if (kind === 'forward') { step = 1; start = intBetween(1, 21 - len); base = 1; }
    else if (kind === 'backward') { step = -1; start = intBetween(len, 20); base = 2; }
    else if (kind === 'skip2') { step = 2; start = intBetween(1, 20 - 2 * (len - 1)); base = start % 2 === 0 ? 2 : 3; }
    else if (kind === 'skip5') { step = 5; start = 5 * intBetween(1, 10 - (len - 1)); base = start <= 15 ? 2 : 3; }
    else { step = 10; start = 10 * intBetween(1, 11 - len); base = start <= 30 ? 2 : 3; }
    const seq = Array.from({ length: len }, (_, i) => start + step * i);
    const hole = intBetween(0, len - 1), answer = seq[hole], size = Math.abs(step);
    const candidates = [answer + size, answer - size, answer + 2 * size, answer - 2 * size, answer + 1, answer - 1, answer + 2, answer - 2];
    const mistakes = size > 1 ? [answer + 1, answer - 1, answer + 2 * size] : [answer + 2, answer - 2];
    return tag({
      question: 'What number is missing?',
      numbers: seq.map((v, i) => i === hole ? '?' : String(v)),
      ...choicesFrom(answer, candidates, mistakes)
    }, 'sequences', kind, Math.min(3, base + (hole === 0 ? 1 : 0)));
  }

  // ----- 7. Visual patterns: AB, AAB, ABB, ABC in shapes and colours -----
  // Colours come from the colour-blind-safe palette; shapes always differ between pattern elements.
  const PATTERN_SHAPES = ['circle', 'square', 'triangle'];
  const PATTERN_COLOURS = [
    { name: 'blue', hex: '#0072B2' }, { name: 'orange', hex: '#E69F00' },
    { name: 'pink', hex: '#CC79A7' }, { name: 'green', hex: '#009E73' }
  ];
  const shapeVisual = (shape, colour, extra = {}) => ({ type: 'shape', shape, color: colour.hex, label: `${colour.name} ${shape}`, rotate: 0, scale: 1, ratio: shape === 'rectangle' ? 2 : 1, variant: 0, ...extra });

  function makePatternQuestion() {
    const kind = weightedChoose([['AB', 30], ['AAB', 24], ['ABB', 24], ['ABC', 22]]);
    const letters = [...new Set(kind)];
    const mode = choose(['shape', 'both', 'both']);   // 'shape': same colour, different shapes; 'both': shape and colour change
    const shapes = shuffledCopy(PATTERN_SHAPES), colours = shuffledCopy(PATTERN_COLOURS);
    const items = {};
    letters.forEach((l, i) => { items[l] = shapeVisual(shapes[i], mode === 'shape' ? colours[0] : colours[i]); });
    const shown = Array.from({ length: 5 }, (_, i) => items[kind[i % kind.length]]);
    const next = items[kind[5 % kind.length]];
    // Wrong choices: the other pattern elements first, then mixed-up shape/colour combinations.
    const usedColours = mode === 'shape' ? [colours[0], colours[letters.length]] : colours.slice(0, letters.length + 1);
    const pool = PATTERN_SHAPES.flatMap(s => usedColours.map(c => shapeVisual(s, c)));
    const wrong = [];
    const add = (v) => { if (v.label !== next.label && !wrong.some(w => w.label === v.label)) wrong.push(v); };
    shuffledCopy(Object.values(items)).forEach(add);
    shuffledCopy(pool).forEach(v => { if (wrong.length < 3) add(v); });
    const choices = shuffledCopy([next, ...wrong.slice(0, 3)]);
    const base = kind === 'AB' ? 1 : kind === 'ABC' ? 3 : 2;
    return tag({
      question: 'What comes next?',
      pattern: [...shown, null],
      answers: choices.map(c => c.label),
      answerLabels: choices.map(c => c.label),
      answerVisuals: choices,
      correct: choices.findIndex(c => c.label === next.label)
    }, 'patterns', kind, Math.min(3, base + (mode === 'both' ? 1 : 0)));
  }

  // ----- 8. Equal grouping: how many groups? (no multiplication or division symbols) -----
  const GROUP_ROWS = { 2: ['X', 'X'], 3: ['XX', 'X.'], 4: ['XX', 'XX'], 5: ['XXX', 'XX.'] };
  const GROUPING_CASES = [];
  [[2, [2, 3, 4, 5, 6]], [3, [2, 3, 4]], [4, [2, 3, 4]], [5, [2, 3]]].forEach(([size, list]) => list.forEach(g => GROUPING_CASES.push([size, g])));

  function makeGroupingQuestion() {
    const [size, count] = choose(GROUPING_CASES);
    const item = choose(COUNT_OBJECTS), total = size * count;
    return tag({
      question: 'How many groups?',
      picture: {
        groups: Array.from({ length: count }, () => ({ emoji: item.emoji, rows: [...GROUP_ROWS[size]], framed: true })),
        label: `${total} ${item.name} in groups of ${size}`,
        key: key('group', size, count)
      },
      ...numberChoices(count, 1, 8, [size, total])
    }, 'grouping', 'groups', total <= 8 ? 1 : total <= 12 ? 2 : 3);
  }

  // ----- 9. Equal sharing: objects shared equally between children; how many each? -----
  const SHARE_ROWS = { 1: ['X'], 2: ['XX'], 3: ['XX', 'X.'], 4: ['XX', 'XX'], 5: ['XXX', 'XX.'] };
  const SHARE_CASES = [];
  [[2, [1, 2, 3, 4, 5]], [3, [1, 2, 3, 4, 5]], [4, [1, 2, 3, 4]]].forEach(([kids, list]) => list.forEach(each => SHARE_CASES.push([kids, each])));
  const CHILD_EMOJI = ['👧', '👦', '🧒'];

  function makeSharingQuestion() {
    const [kids, each] = choose(SHARE_CASES);
    const item = choose(COUNT_OBJECTS), total = kids * each;
    const children = Array.from({ length: kids }, (_, i) => CHILD_EMOJI[i % CHILD_EMOJI.length]);
    return tag({
      question: 'How many each?',
      picture: {
        groups: children.map(lead => ({ emoji: item.emoji, rows: [...SHARE_ROWS[each]], framed: true, lead })),
        label: `${item.name} shared equally between ${kids} children`,
        key: key('share', kids, each)
      },
      ...numberChoices(each, 1, 20, [total, kids])
    }, 'sharing', 'each', total <= 6 ? 1 : total <= 10 ? 2 : 3);
  }

  // ----- 10. 2D shapes: circle, square, triangle, rectangle (different sizes and orientations) -----
  const SHAPE_NAMES = ['circle', 'square', 'triangle', 'rectangle'];
  const SHAPE_TURNS = { circle: [0], square: [0, 15, -15, 25, -25], rectangle: [0, 90, 15, -15, 75], triangle: [0, 180, 90, 270, 20, -20, 45] };
  function randomShape(shape, plain) {
    const colour = choose(PATTERN_COLOURS);
    if (plain) return shapeVisual(shape, colour, { rotate: 0, scale: 1, ratio: shape === 'rectangle' ? 2 : 1, variant: 0 });
    return shapeVisual(shape, colour, {
      rotate: choose(SHAPE_TURNS[shape]),
      scale: choose([0.65, 0.8, 1]),
      ratio: shape === 'rectangle' ? choose([1.7, 2, 2.3]) : 1,
      variant: shape === 'triangle' ? choose([0, 1, 2]) : 0
    });
  }

  function makeShapes2dQuestion() {
    const kind = weightedChoose([['name', 30], ['sides', 18], ['corners', 18], ['pick', 22], ['property', 12]]);

    if (kind === 'name') {
      const shape = choose(SHAPE_NAMES), plain = Math.random() < 0.35;
      const names = shuffledCopy(SHAPE_NAMES);
      return tag({ question: 'Which shape is this?', figure: randomShape(shape, plain), answers: names, correct: names.indexOf(shape) }, 'shapes', 'name', plain ? 1 : 2);
    }

    if (kind === 'sides' || kind === 'corners') {
      const shape = choose(['triangle', 'square', 'rectangle']), answer = shape === 'triangle' ? 3 : 4;
      return tag({
        question: kind === 'sides' ? 'How many sides?' : 'How many corners?',
        figure: randomShape(shape, Math.random() < 0.3),
        ...numberChoices(answer, 1, 8, [3, 4, 5])
      }, 'shapes', kind, 2);
    }

    const visuals = shuffledCopy(SHAPE_NAMES.map(s => randomShape(s, false)));
    const ask = kind === 'pick'
      ? (() => { const s = choose(SHAPE_NAMES); return { text: `Which shape is a ${s}?`, shape: s, tier: 2 }; })()
      : choose([
        { text: 'Which shape has 3 sides?', shape: 'triangle', tier: 3 },
        { text: 'Which shape has 3 corners?', shape: 'triangle', tier: 3 },
        { text: 'Which shape has no corners?', shape: 'circle', tier: 3 },
        { text: 'Which shape has 4 equal sides?', shape: 'square', tier: 3 }
      ]);
    return tag({
      question: ask.text,
      answers: visuals.map(v => v.label),
      answerLabels: visuals.map(v => v.label),
      answerVisuals: visuals,
      correct: visuals.findIndex(v => v.shape === ask.shape),
      // the shape names in the labels would give the property away only to someone who already knows it
      shapeKey: visuals.map(v => `${v.shape}:${v.rotate}:${v.scale}:${v.ratio}:${v.variant}`).join('|')
    }, 'shapes', kind, ask.tier);
  }

  // Age 5 has ten topics in ONE pool; none is a stage. Weights keep every topic well represented.
  function makeAge5Question() {
    return weightedChoose([
      [makeCounting20Question, 14], [makeCompareAge5Question, 10], [makeAdditionAge5Question, 14],
      [makeSubtractionAge5Question, 14], [makePlaceValueQuestion, 10], [makeSequenceQuestion, 10],
      [makePatternQuestion, 8], [makeGroupingQuestion, 6], [makeSharingQuestion, 6], [makeShapes2dQuestion, 8]
    ])();
  }

  // ---------- shared by Age 6 and Grade 1 ----------
  // `simple` gives the Age 6 look (big centred buttons); Grade 1 keeps the normal A/B/C buttons.
  const mark = (q, topic, kind, tier, simple) => Object.assign(q, { topic, kind, tier }, simple ? { simple: true } : {});

  // Text answers in random order (numeric answers are sorted by generateQuestion instead).
  function textChoices(correct, wrong, count = 4) {
    const others = shuffledCopy([...new Set(wrong)].filter(w => w !== correct)).slice(0, count - 1);
    const answers = shuffledCopy([correct, ...others]);
    return { answers, correct: answers.indexOf(correct) };
  }

  // Australian coins only (5c, 10c, 20c, 50c, $1, $2): never 1c or 2c. Totals are multiples of 5 and so are the wrong totals.
  const AU_COINS = [5, 10, 20, 50, 100, 200];
  function totalChoices(total, coins) {
    const pool = [];
    for (let k = 1; k <= 5; k++) pool.push(total + 5 * k, total - 5 * k);
    const mistakes = [Math.max(...coins), total - Math.min(...coins), total + Math.min(...coins)].filter(v => v > 0);
    const wrong = pickWithMistake(total, pool.filter(v => v > 0), 3, mistakes);
    return { answers: [total, ...wrong].map(String), correct: 0 };
  }

  function makeCoinTotalQuestion(values, limit, simple, grade1Total = false) {
    let coins, total;
    do { coins = Array.from({ length: intBetween(2, 3) }, () => choose(values)); total = coins.reduce((s, c) => s + c, 0); } while (total > limit);
    const choices = totalChoices(total, coins);
    if (grade1Total) {
      const cents = choices.answers.map(Number);
      choices.answers = cents.map(moneyTotalText);
      choices.keys = cents;
    }
    return mark({ question: grade1Total ? 'How much money is there altogether?' : 'How many cents altogether?', coins, ...choices }, 'money', 'total', total <= 30 ? 1 : total <= 100 ? 2 : 3, simple);
  }

  // One coin is drawn; the child says what it is worth.
  function makeCoinValueQuestion(simple) {
    const coin = choose(AU_COINS);
    return mark({
      question: 'How many cents is this coin?', coins: [coin],
      ...choicesFrom(coin, AU_COINS.filter(v => v !== coin), [])
    }, 'money', 'identify', coin >= 100 ? 3 : coin >= 50 ? 2 : 1, simple);
  }

  // Measurement by counting cubes (an explicit number, never "which is heavier"): read a bar, find how much
  // longer one bar is, or join two bars. Bars are rows of one picture group.
  function makeCubeBarQuestion(simple) {
    const kind = weightedChoose(simple ? [['read', 60], ['longer', 40]] : [['read', 30], ['longer', 40], ['total', 30]]);
    const max = simple ? 10 : 12;
    const bars = (counts, label) => ({ groups: [{ emoji: '🟦', rows: counts.map(c => 'X'.repeat(c)) }], label, key: key('bars', ...counts) });
    if (kind === 'read') {
      const n = intBetween(2, max);
      return mark({ question: 'How many cubes long is the bar?', picture: bars([n], 'A bar made of cubes'), ...numberChoices(n, 1, max + 2, [n - 1, n + 1]) }, 'measurement', 'bar-read', n <= 5 ? 1 : 2, simple);
    }
    if (kind === 'longer') {
      const b = intBetween(1, max - 2), a = intBetween(b + 1, max), topLonger = Math.random() < 0.5;
      return mark({
        question: `How many cubes longer is the ${topLonger ? 'top' : 'bottom'} bar?`,
        picture: bars(topLonger ? [a, b] : [b, a], 'Two bars made of cubes'),
        ...numberChoices(a - b, 1, max, [a, b])
      }, 'measurement', 'bar-longer', 3, simple);
    }
    const x = intBetween(2, 9), y = intBetween(2, 9);
    return mark({ question: 'How many cubes in both bars?', picture: bars([x, y], 'Two bars made of cubes'), ...numberChoices(x + y, 2, 20, [x, y]) }, 'measurement', 'bar-total', 2, simple);
  }

  // Position and direction with a clear maths task: an arrow's direction, or the place (1st, 2nd ...) of the star in a row.
  function makePositionQuestion(simple, allowDirection = true, allowPlace = true) {
    if (allowDirection && (!allowPlace || Math.random() < 0.5)) {
      const dirs = [['Up', '⬆️'], ['Down', '⬇️'], ['Left', '⬅️'], ['Right', '➡️']], [name, arrow] = choose(dirs);
      return mark({ question: `Which way does the arrow point? ${arrow}`, ...textChoices(name, dirs.map(d => d[0])) }, 'position', 'arrow', 2, simple);
    }
    const n = intBetween(3, 5), at = intBetween(1, n), item = choose(COUNT_OBJECTS);
    return mark({
      question: 'Counting from the left, which place is the ⭐?',
      picture: {
        groups: [{ emoji: item.emoji, emoji2: '⭐', rows: [Array.from({ length: n }, (_, i) => i === at - 1 ? 'Y' : 'X').join('')] }],
        label: `A row of ${n} with one star`, key: key('place', item.emoji, n, at)
      },
      ...numberChoices(at, 1, 5, [n + 1 - at])
    }, 'position', 'place', 2, simple);
  }

  // Simple data: a picture graph (groups of objects) or, from Grade 1, tally marks.
  function makeDataQuestion(simple, totalOnly = false) {
    const kind = weightedChoose(simple || totalOnly ? [['total', 100]] : [['count', 35], ['total', 30], ['tally', 35]]);
    if (kind === 'tally') {
      const n = intBetween(3, 20), gates = Math.floor(n / 5);
      const marks = ['||||/ '.repeat(gates).trim(), '|'.repeat(n % 5)].filter(Boolean).join(' ');
      return mark({ question: `Each ||||/ is a group of 5. How many tally marks? ${marks}`, ...numberChoices(n, 1, 20, [n - gates, gates + (n % 5)]) }, 'data', 'tally', n <= 10 ? 2 : 3, simple);
    }
    const cats = shuffledCopy(COUNT_OBJECTS).slice(0, intBetween(2, 3)), limit = simple ? 10 : 20;
    let counts;
    do { counts = cats.map(() => intBetween(1, simple ? 4 : 6)); } while (counts.reduce((s, c) => s + c, 0) > limit);
    const sum = counts.reduce((s, c) => s + c, 0);
    const picture = {
      groups: cats.map((c, i) => ({ emoji: c.emoji, rows: chunkRows(counts[i], 5), framed: true })),
      label: `Picture graph: ${cats.map((c, i) => `${counts[i]} ${c.name}`).join(', ')}`,
      key: key('data', ...cats.map((c, i) => c.emoji + counts[i]))
    };
    if (kind === 'total') return mark({ question: 'How many altogether?', picture, ...numberChoices(sum, 1, limit + 2, counts) }, 'data', kind, 2, simple);
    const pick = intBetween(0, cats.length - 1);
    return mark({ question: `How many ${cats[pick].name}?`, picture, ...numberChoices(counts[pick], 1, 8, counts.filter((_, i) => i !== pick)) }, 'data', kind, 1, simple);
  }

  // ---------- Age 6: ONE pool; `tier` (1-3) lets createQuestionDeck start with the easier questions ----------
  // No number-comparison, standalone before/after, grouping, sharing, measurement or row-position questions.
  function makeAge6OrderQuestion() {
    const kind = weightedChoose([['forward', 54], ['backward', 46]]);
    const len = choose([4, 4, 5]), forward = kind === 'forward';
    const start = forward ? intBetween(1, 21 - len) : intBetween(len, 20);
    const seq = Array.from({ length: len }, (_, i) => start + (forward ? i : -i));
    const hole = intBetween(0, len - 1), answer = seq[hole];
    const near = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, answer - 3].filter(v => v >= 0 && v <= 20);
    return tag({
      question: 'What number is missing?',
      numbers: seq.map((v, i) => i === hole ? '?' : String(v)),
      ...choicesFrom(answer, near, near.slice(0, 2))
    }, 'sequences', kind, start > 10 ? 2 : 1);
  }

  // Quick look at 1-5 objects (subitising).
  function makeSubitisingQuestion() {
    const q = tag(makeCountingQuestion(), 'subitising', 'quick-look', 1);
    q.visualLabel = q.question.replace(/^How many (.+)\?$/, 'Some $1');   // the label must not say how many
    return q;
  }
  function makeAge6CountingQuestion() {
    const q = makeCounting20Question();
    q.picture.label = q.picture.label.split(':')[0];
    return q;
  }

  // Joining with objects: the added objects appear after the shared teaching-aid delay. Sum at most 10.
  function makeWithin10Question() {
    const a = intBetween(1, 9), b = intBetween(1, 10 - a), answer = a + b;
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    return tag({
      question: `What is ${a} + ${b}?`,
      resultText: `${a} + ${b} = ${answer}`,
      stage: { base: first, baseCount: a, op: 'add', change: b, added: second, delayAdd: true },
      ...makeNumberChoices(answer, 0, 10, 4)
    }, 'addsub', 'objects', tierOf(answer));
  }

  // Taking away with objects: all starting objects appear first; the shared teaching-aid delay then crosses out the
  // objects being removed. The picture never shows the answer as a number.
  function makeSubtractionPicture6() {
    const [a, b] = choose(SUB_PAIRS), item = choose(COUNT_OBJECTS), keep = a - b, layout = pictureLayout(a, b, keep);
    return tag({
      question: `What is ${a} − ${b}?`,
      resultText: `${a} − ${b} = ${keep}`,
      picture: {
        groups: [{ emoji: item.emoji, rows: arrangeCells('X'.repeat(keep) + 'x'.repeat(b), layout) }],
        label: `${item.name}, some crossed out`, key: key('sub6', a, b, layout)
      },
      ...makeNumberChoices(keep, 1, 10, 4)
    }, 'addsub', 'objects-sub', tierOf(a));
  }

  // Symbols only: addition with a sum of at most 10, subtraction from at most 10.
  function makeSymbolic10Question() {
    const add = Math.random() < 0.5;
    let a, b, answer;
    if (add) { a = intBetween(1, 9); b = intBetween(1, 10 - a); answer = a + b; }
    else { a = intBetween(2, 10); b = intBetween(1, a - 1); answer = a - b; }
    return tag({
      question: `What is ${a} ${add ? '+' : '−'} ${b}?`,
      resultText: `${a} ${add ? '+' : '−'} ${b} = ${answer}`,
      ...makeNumberChoices(answer, 0, 10, 4)
    }, 'addsub', 'symbols', Math.min(3, tierOf(Math.max(a, answer)) + 1));
  }

  // Number bonds, partitioning and missing parts, all within 10.
  function makeBondQuestion() {
    const kind = weightedChoose([['bond', 34], ['partition', 28], ['missing', 38]]);
    const total = intBetween(2, 10), a = intBetween(1, total - 1), b = total - a;
    if (kind === 'bond') {
      const pair = (x, y) => `${Math.min(x, y)} and ${Math.max(x, y)}`, wrong = [];
      for (let s = Math.max(2, total - 3); s <= Math.min(10, total + 3); s++) if (s !== total) { const p = intBetween(1, s - 1); wrong.push(pair(p, s - p)); }
      return tag({ question: `Which two numbers make ${total}?`, ...textChoices(pair(a, b), wrong) }, 'bonds', kind, tierOf(total));
    }
    if (kind === 'partition') {
      return tag({ question: `${total} = ${a} + ?`, resultText: `${total} = ${a} + ${b}`, ...numberChoices(b, 0, 10, [a, total]) }, 'bonds', kind, tierOf(total));
    }
    const form = choose(['add2', 'add1', 'sub']);
    return tag({
      question: form === 'add2' ? `${a} + ? = ${total}` : form === 'add1' ? `? + ${a} = ${total}` : `${total} − ? = ${a}`,
      resultText: form === 'add2' ? `${a} + ${b} = ${total}` : form === 'add1' ? `${b} + ${a} = ${total}` : `${total} − ${b} = ${a}`,
      ...numberChoices(b, 0, 10, [a, total])
    }, 'bonds', 'missing', Math.min(3, tierOf(total) + 1));
  }

  function makeAge6MoneyQuestion() {
    return Math.random() < 0.65 ? makeCoinTotalQuestion([5, 10, 20, 50], 100, true) : makeCoinValueQuestion(true);
  }

  function makeAge6Question() {
    return weightedChoose([
      [makeAge6CountingQuestion, 12], [makeSubitisingQuestion, 6], [makeAge6OrderQuestion, 12],
      [makeWithin10Question, 8], [makeSubtractionPicture6, 12], [makeSymbolic10Question, 12], [makeBondQuestion, 12],
      [makePatternQuestion, 6], [makeAge6MoneyQuestion, 7],
      [makeShapes2dQuestion, 6], [() => makeDataQuestion(true), 5]
    ])();
  }

  // ---------- Grade 1: numbers to 120, skip counting, place value (topic 'numbers') ----------
  const ONES_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const numberWord = (n) => n >= 100
    ? (n === 100 ? 'one hundred' : `one hundred and ${numberWord(n - 100)}`)
    : n < 20 ? ONES_WORDS[n] : TENS_WORDS[Math.floor(n / 10)] + (n % 10 ? `-${ONES_WORDS[n % 10]}` : '');
  const within120 = (list) => list.filter(v => Number.isInteger(v) && v >= 0 && v <= 120);

  function makeGrade1PlaceValueQuestion() {
    const kind = weightedChoose([['read', 22], ['count', 20], ['partition', 24], ['digit', 18], ['make', 16]]);
    let n;
    do { n = intBetween(11, 99); } while (n % 10 === 0 || (kind === 'digit' && Math.floor(n / 10) === n % 10));
    const tens = Math.floor(n / 10), ones = n % 10, swap = swapDigits(n);
    const tier = n < 30 ? 1 : n < 60 ? 2 : 3;
    if (kind === 'read') {
      return mark({ question: 'What number is shown?', promptVisual: blocksOf(n), ...choicesFrom(n, [n - 1, n + 1, n - 10, n + 10, swap, tens + ones], [swap, tens + ones]) }, 'placevalue', kind, tier, false);
    }
    if (kind === 'count') {
      const askTens = Math.random() < 0.5;
      return mark({
        question: askTens ? 'How many 10s?' : 'How many 1s?', promptVisual: blocksOf(n),
        ...(askTens ? numberChoices(tens, 0, 9, [ones]) : numberChoices(ones, 0, 9, [tens]))
      }, 'placevalue', askTens ? 'count10s' : 'count1s', tier, false);
    }
    if (kind === 'partition') {
      const form = choose(['head', 'tail', 'tensHead', 'tensTail']);
      if (form === 'head') return mark({ question: `${n} = ${tens * 10} + ?`, ...numberChoices(ones, 0, 9, [tens, ones + 1]) }, 'placevalue', kind, tier, false);
      if (form === 'tail') return mark({ question: `${n} = ? + ${ones}`, ...choicesFrom(tens * 10, [tens * 10 + 10, tens * 10 - 10, tens * 10 + 20, ones, tens], [ones, tens]) }, 'placevalue', kind, tier, false);
      if (form === 'tensHead') return mark({ question: `${n} = ${tens} tens and ? ones`, ...numberChoices(ones, 0, 9, [tens]) }, 'placevalue', kind, tier, false);
      return mark({ question: `${n} = ? tens and ${ones} ones`, ...numberChoices(tens, 0, 9, [ones]) }, 'placevalue', kind, tier, false);
    }
    if (kind === 'digit') {
      const askTens = Math.random() < 0.5, digit = askTens ? tens : ones, value = askTens ? tens * 10 : ones;
      const other = askTens ? ones : tens;
      return mark({
        question: `What is the value of the digit ${digit} in ${n}?`,
        ...choicesFrom(value, [digit, digit * 10, other, other * 10].filter(v => v !== value), [askTens ? digit : digit * 10])
      }, 'placevalue', kind, 3, false);
    }
    return mark({ question: `What number is ${tens} tens and ${ones} ones?`, ...choicesFrom(n, [swap, n + 10, n - 10, n + 1, n - 1, tens + ones], [swap]) }, 'placevalue', kind, tier, false);
  }

  function makeGrade1NumbersQuestion() {
    const kind = weightedChoose([['missing', 18], ['tenmore', 22], ['skip', 30], ['place', 30]]);
    if (kind === 'place') return makeGrade1PlaceValueQuestion();
    if (kind === 'tenmore') {
      const form = choose(['add', 'addFirst', 'sub']), more = form !== 'sub', n = more ? intBetween(0, 110) : intBetween(10, 120), answer = more ? n + 10 : n - 10;
      const equation = form === 'add' ? `${n} + 10 = ?` : form === 'addFirst' ? `10 + ${n} = ?` : `${n} − 10 = ?`;
      const near = within120([answer + 1, answer - 1, answer + 10, answer - 10, n + 1, n - 1]).filter(v => v !== answer);
      return mark({ question: equation, ...choicesFrom(answer, near, within120([n + 1, n - 1])) }, 'numbers', more ? 'tenmore' : 'tenless', n <= 50 ? 1 : 2, false);
    }
    const skip = kind === 'skip', step = skip ? choose([2, 5, 10]) : 1, forward = Math.random() < 0.6, len = choose([4, 5, 5]);
    const top = Math.floor(120 / step);
    const first = skip
      ? step * (forward ? intBetween(1, top - (len - 1)) : intBetween(len, top))
      : (forward ? intBetween(1, 121 - len) : intBetween(len, 120));
    const seq = Array.from({ length: len }, (_, i) => first + (forward ? 1 : -1) * step * i);
    const hole = intBetween(0, len - 1), answer = seq[hole];
    const near = within120([answer + step, answer - step, answer + 2 * step, answer - 2 * step, answer + 1, answer - 1]).filter(v => v !== answer);
    return mark({
      question: 'What number is missing?',
      numbers: seq.map((v, i) => i === hole ? '?' : String(v)),
      ...choicesFrom(answer, near, within120([answer + 1, answer - 1]))
    }, 'numbers', skip ? 'skip' : 'missing', skip ? (forward ? 2 : 3) : (first <= 20 ? 1 : 2), false);
  }

  // ---------- Grade 1: addition and subtraction within 20 ----------
  const tier20 = (n) => n <= 10 ? 1 : n <= 15 ? 2 : 3;
  function makeGrade1AddQuestion() {
    const kind = weightedChoose([['plain', 34], ['double', 14], ['near', 14], ['bond', 14], ['missing', 24]]);
    let a, b;
    if (kind === 'double' || kind === 'near') {
      a = kind === 'double' ? 10 : 9; b = kind === 'double' ? 10 : 10;
      if (kind === 'near' && Math.random() < 0.5) [a, b] = [b, a];
      return mark(makeQuestion(a, '+', b, a + b), 'addsub', kind, tier20(a + b), false);
    }
    if (kind === 'bond' || kind === 'missing') {
      const total = kind === 'bond' ? 20 : intBetween(11, 20);
      a = intBetween(10, total - 1); b = total - a;
      const second = Math.random() < 0.6;
      return mark(makeNumericQuestion(second ? `${a} + ? = ${total}` : `? + ${b} = ${total}`, second ? b : a, { extras: [total, second ? a : b] }), 'addsub', kind, Math.min(3, tier20(total) + 1), false);
    }
    a = intBetween(10, 19); b = intBetween(1, Math.min(9, 20 - a));
    return mark(makeQuestion(a, '+', b, a + b), 'addsub', 'plain', tier20(a + b), false);
  }

  function makeGrade1SubQuestion() {
    const kind = weightedChoose([['plain', 34], ['bond', 14], ['double', 12], ['missing', 28]]);
    let a, b;
    if (kind === 'bond') {
      a = intBetween(10, 19); b = intBetween(1, Math.min(9, a - 1));
      return mark(makeQuestion(a, '−', b, a - b), 'addsub', kind, tier20(a), false);
    }
    if (kind === 'double') {
      b = intBetween(5, 9); a = 2 * b;
      return mark(makeQuestion(a, '−', b, b), 'addsub', kind, tier20(a), false);
    }
    if (kind === 'missing') {
      a = intBetween(10, 19); b = intBetween(1, Math.min(9, a));
      const second = Math.random() < 0.6;
      return mark(makeNumericQuestion(second ? `${a} − ? = ${a - b}` : `? − ${b} = ${a - b}`, second ? b : a, { extras: [a - b, second ? a : b] }), 'addsub', kind, Math.min(3, tier20(a) + 1), false);
    }
    a = intBetween(10, 19); b = intBetween(1, Math.min(9, a - 1));
    return mark(makeQuestion(a, '−', b, a - b), 'addsub', 'plain', tier20(a), false);
  }

  function makeGrade1ArithmeticQuestion(topic) {
    const add = topic === 'add' || (topic !== 'sub' && Math.random() < 0.5);
    return add ? makeGrade1AddQuestion() : makeGrade1SubQuestion();
  }

  // ---------- Grade 1: halves only ----------
  function makeGrade1FractionsQuestion() {
    const kind = weightedChoose([['half', 80], ['whole', 20]]);
    if (kind === 'half') {
      const n = intBetween(1, 10) * 2;
      return mark(makeNumericQuestion(`What is half of ${n}?`, n / 2, { extras: [n, n * 2] }), 'fractions', kind, n <= 10 ? 1 : 2, false);
    }
    return mark({ question: 'How many halves make one whole?', ...numberChoices(2, 1, 5, [1, 4]) }, 'fractions', kind, 1, false);
  }

  function makeGrade1MoneyQuestion() {
    return Math.random() < 0.65 ? makeCoinTotalQuestion(AU_COINS, 300, false, true) : makeCoinValueQuestion(false);
  }

  function makeGrade1ShapesQuestion() {
    const kind = weightedChoose([['polygon', 40], ['position', 16], ['measure', 24], ['data', 20]]);
    if (kind === 'position') return makePositionQuestion(false, false, true);
    if (kind === 'measure') return makeCubeBarQuestion(false);
    if (kind === 'data') return makeDataQuestion(false, true);
    const n = intBetween(3, 6), word = choose(['sides', 'corners']);
    const q = makeNumericQuestion(`How many ${word} does this shape have?`, n, { count: 4 });
    q.figure = { type: 'polygon', sides: n };
    return mark(q, 'shapes', word, n <= 4 ? 1 : 2, false);
  }

  // ---------- Grades 5-6: compare ONE decimal with ONE fraction (the only number comparison above Age 6) ----------
  function makeDecimalFractionCompare(grade) {
    const dens = grade === 5 ? [2, 3, 4, 5, 8, 10] : [2, 3, 4, 5, 6, 8, 10, 20, 25];
    const offsets = grade === 5 ? [5, 10, 15, 20] : [1, 2, 5, 10];   // hundredths away from the fraction's value
    for (let tries = 0; tries < 500; tries++) {
      const want = choose([-1, 0, 1]), d = choose(dens), n = intBetween(1, d - 1);
      let h = Math.round(100 * n / d);
      if (want === 0 && (100 * n) % d !== 0) continue;   // equal only when the fraction is an exact 1-2 place decimal
      if (want !== 0) h += want * choose(offsets);
      if (h < 1 || h > 99 || sign(h * d - 100 * n) !== want) continue;
      const decimal = String(h / 100), fraction = `${n}/${d}`, flip = Math.random() < 0.3;
      return makeCompareQuestion(flip ? `Compare: ${fraction} ? ${decimal}` : `Compare: ${decimal} ? ${fraction}`, flip ? -want : want);
    }
    return makeCompareQuestion('Compare: 0.5 ? 1/2', 0);
  }

  // ---------- Grade 1-6 arithmetic ----------
  function arithmeticQuestion(grade, topic) {
    if (grade === 1) return makeGrade1ArithmeticQuestion(topic);   // within 20, no × ÷
    const all = ['+', '−', '×', '÷'];
    const ops = topic === 'add' ? ['+'] : topic === 'sub' ? ['−'] : topic === 'mul' ? ['×'] : topic === 'div' ? ['÷'] : all;
    const operator = choose(ops);
    let a, b, answer;

    // Number ranges and multiplication/division complexity increase by level.
    if (grade === 2) {
      if (operator === '+') { a = intBetween(10, 99); b = intBetween(1, 99); answer = a + b; }
      if (operator === '−') { a = intBetween(10, 150); b = intBetween(1, a); answer = a - b; }
      if (operator === '×') { a = intBetween(2, 10); b = choose([2, 5, 10]); answer = a * b; }
      if (operator === '÷') { b = choose([2, 5, 10]); answer = intBetween(2, 10); a = b * answer; }
    } else if (grade === 3) {
      if (operator === '+') { a = intBetween(100, 999); b = intBetween(100, 999); answer = a + b; }
      if (operator === '−') { a = intBetween(200, 999); b = intBetween(1, a); answer = a - b; }
      if (operator === '×') { a = intBetween(2, 12); b = intBetween(2, 12); answer = a * b; }
      if (operator === '÷') { b = intBetween(2, 12); answer = intBetween(2, 12); a = b * answer; }
    } else if (grade === 4) {
      if (operator === '+') { a = intBetween(100, 9999); b = intBetween(100, 9999); answer = a + b; }
      if (operator === '−') { a = intBetween(1000, 9999); b = intBetween(100, a); answer = a - b; }
      if (operator === '×') { a = intBetween(12, 99); b = intBetween(2, 12); answer = a * b; }
      if (operator === '÷') { b = intBetween(2, 12); answer = intBetween(12, 99); a = b * answer; }
    } else if (grade === 5) {
      if (operator === '+') { a = intBetween(1000, 99999); b = intBetween(1000, 99999); answer = a + b; }
      if (operator === '−') { a = intBetween(10000, 99999); b = intBetween(1000, a); answer = a - b; }
      if (operator === '×') { a = intBetween(12, 99); b = intBetween(12, 99); answer = a * b; }
      if (operator === '÷') { b = intBetween(12, 99); answer = intBetween(12, 99); a = b * answer; }
    } else {
      if (operator === '+') { a = intBetween(10000, 999999); b = intBetween(1000, 999999); answer = a + b; }
      if (operator === '−') { a = intBetween(10000, 999999); b = intBetween(1000, a); answer = a - b; }
      if (operator === '×') { a = intBetween(100, 999); b = intBetween(12, 99); answer = a * b; }
      if (operator === '÷') { b = intBetween(12, 99); answer = intBetween(100, 999); a = b * answer; }
    }
    return makeQuestion(a, operator, b, answer, grade >= 4);
  }

  // "Mixed All Questions" draws each question from one of these categories (only those the grade offers).
  // 'mixed' covers + − × ÷ (÷ and × from Grade 2); add/sub/mul/div are not listed so arithmetic is not over-weighted.
  const ALL_MIX_TOPICS = ['mixed', 'numbers', 'tables', 'fractions', 'money', 'clock', 'shapes'];

  function generateRawQuestion(difficulty, topic) {
    if (difficulty === 'toddler') return makeToddlerQuestion();
    if (difficulty === 'age4') return makeAge4Question();
    if (difficulty === 'age5') return makeAge5Question();
    if (difficulty === 'age6') return makeAge6Question();
    const grade = gradeOf(difficulty);
    let name = normaliseTopic(difficulty, topic);
    if (name === 'all') {
      const offered = topicsFor(difficulty).map(t => t.value);
      name = choose(ALL_MIX_TOPICS.filter(t => offered.includes(t)));
    }
    let q;
    switch (name) {
      case 'numbers': q = makeGrade1NumbersQuestion(); break;
      case 'tables': q = makeTablesQuestion(grade); break;
      case 'fractions': q = makeFractionsQuestion(grade); break;
      case 'money': q = makeMoneyQuestion(grade); break;
      case 'clock': q = makeClockQuestion(grade); break;
      case 'shapes': q = makeShapesQuestion(grade); break;
      default: q = arithmeticQuestion(grade, name);
    }
    if (grade === 1 && !q.tier) q.tier = 2;   // Grade 1 is one pool: easier tiers are dealt first (see createQuestionDeck)
    return q;
  }

  // Numeric answers are listed from smallest to largest. Fractions and times are sorted by their
  // value (`keys`). Text answers such as < = > keep a fixed order.
  function generateQuestion(difficulty, topic = DEFAULT_TOPIC) {
    const q = generateRawQuestion(difficulty, topic);
    const keys = q.keys || (q.answers.every(a => a.trim() !== '' && !isNaN(Number(a))) ? q.answers.map(Number) : null);
    if (keys) {
      const order = q.answers.map((_, i) => i).sort((x, y) => keys[x] - keys[y]);
      q.answers = order.map(i => q.answers[i]);
      q.correct = order.indexOf(q.correct);
    }
    delete q.keys;
    return q;
  }

  // ---------- no repeats within a game ----------
  // Identity of a question: its wording, its figure (clock time / polygon, where the wording alone
  // does not say which one) and the correct answer's text. Answer ORDER and wrong options are ignored,
  // and so are decorative emoji (Age 5/6 stages), so "What is 6 × 7?" generated twice with different
  // wrong answers is the same question.
  function questionKey(q) {
    const identity = [q.question, q.figure || null, q.answers[q.correct]];
    if (q.coins) identity.push(q.coins);        // Grade 1 / Age 6 money: the coins drawn are part of the question
    if (q.picture) identity.push(q.picture.key);   // Age 4: the same sum in another arrangement is a different question
    // Age 5: the sequence, pattern, place-value blocks or shape choices are part of the question too.
    if (q.numbers) identity.push(q.numbers);
    if (q.pattern) identity.push(q.pattern.map(p => p && p.label));
    if (q.promptVisual) identity.push(`${q.promptVisual.tens}:${q.promptVisual.ones}`);
    if (q.shapeKey) identity.push(q.shapeKey);
    return JSON.stringify(identity);
  }

  // Generates up to `size` distinct questions. Attempts are capped so a small pool (e.g. Age 5, which
  // has only a handful of distinct questions) ends the loop instead of spinning forever.
  function buildQuestionBank(difficulty, topic, size = 500, maxAttempts = size * 3) {
    const seen = new Set();
    const bank = [];
    for (let i = 0; i < maxAttempts && bank.length < size; i++) {
      const q = generateQuestion(difficulty, topic);
      const key = questionKey(q);
      if (seen.has(key)) continue;
      seen.add(key);
      bank.push(q);
    }
    return shuffledCopy(bank);
  }

  // A deck deals every question in the bank once, in random order. When all have been used it is
  // reshuffled (so the game never stops), and the first card of the new round is never the last one
  // just shown. Create a new deck for each game: that is what resets the tracking.
  function createQuestionDeck(bank) {
    let order = shuffledCopy(bank);
    let index = 0;
    let last = null;
    // Age 4 questions carry a `tier` (1 easiest). In the first round the highest tier allowed rises by one
    // for every 6 questions dealt, so a game starts with small, clearly different quantities.
    const tiered = bank.some(q => q.tier);
    let firstRound = true;
    return {
      next() {
        if (index >= order.length) {
          order = shuffledCopy(bank);
          if (order.length > 1 && order[0] === last) {
            const j = intBetween(1, order.length - 1);
            [order[0], order[j]] = [order[j], order[0]];
          }
          index = 0;
          firstRound = false;
        }
        if (tiered && firstRound) {
          const allowed = 1 + Math.floor(index / 6);
          const j = order.findIndex((q, i) => i >= index && (q.tier || 1) <= allowed);
          if (j > index) [order[index], order[j]] = [order[j], order[index]];
        }
        last = order[index++];
        return last;
      }
    };
  }

  const api = {
    DIFFICULTIES, TOPICS, DEFAULT_TOPIC, isGrade, gradeOf, difficultyLabel, topicLabel, topicsFor, normaliseTopic,
    generateQuestion, shuffledCopy, intBetween, choose,
    questionKey, buildQuestionBank, createQuestionDeck
  };
  root.MQQuestions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
