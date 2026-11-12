// Question generators. Pure logic (no DOM) so it can be tested on its own.
(function (root) {
  'use strict';

  const DIFFICULTIES = [
    { value: 'toddler', label: 'Age 2–3 · Counting' },
    { value: 'age4', label: 'Age 4 · Counting to 10' },
    { value: 'age5', label: 'Age 5 · Making 10' },
    { value: 'age6', label: 'Age 6 · Add & subtract to 10' },
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
    { value: 'compare', label: 'Comparing numbers', grades: [1, 2, 3, 4] },
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
    if (grade === 1) {
      const n = intBetween(1, 10) * 2;
      return makeNumericQuestion(`What is half of ${n}?`, n / 2, { extras: [n, n * 2] });
    }
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
      let b = intBetween(2, 10), c = intBetween(2, 10);
      if (Math.random() > 0.1) while (c === b) c = intBetween(2, 10);
      return makeCompareQuestion(`Compare: 1/${b} ? 1/${c}`, sign(c - b));
    }
    if (grade === 4) {
      const kind = choose(['equiv', 'add', 'sub', 'compare', 'amount']);
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
      if (kind === 'compare') {
        if (Math.random() < 0.5) {
          const d = intBetween(4, 12);
          let a = intBetween(1, d - 1), b = intBetween(1, d - 1);
          return makeCompareQuestion(`Compare: ${a}/${d} ? ${b}/${d}`, sign(a - b));
        }
        const n = intBetween(1, 5);
        let d1 = intBetween(n + 1, 12), d2 = intBetween(n + 1, 12);
        return makeCompareQuestion(`Compare: ${n}/${d1} ? ${n}/${d2}`, sign(d2 - d1));
      }
      return ofAmount([3, 4, 5, 6, 8, 10], 12);
    }
    if (grade === 5) {
      const kind = choose(['add', 'sub', 'compare', 'amount']);
      if (kind === 'amount') return ofAmount([3, 4, 5, 6, 8, 10, 12], 12);
      if (kind === 'compare') {
        let a, b, c, d;
        do { b = intBetween(2, 8); d = intBetween(2, 8); a = intBetween(1, b - 1); c = intBetween(1, d - 1); } while (b === d);
        return makeCompareQuestion(`Compare: ${a}/${b} ? ${c}/${d}`, sign(a * d - c * b));
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
    const kind = choose(['mul', 'divWhole', 'howMany', 'addUnlike']);
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

  // ---------- comparing numbers ----------
  function makeCompareNumbersQuestion(grade) {
    const range = [null, [0, 20], [10, 99], [100, 999], [1000, 9999]][grade];
    const [min, max] = range;
    const near = Math.max(1, Math.round((max - min) * (grade === 1 ? 0.15 : 0.06)));
    const clamp = (v) => Math.min(max, Math.max(min, v));
    const a = intBetween(min, max);
    const mode = Math.random();
    let b;
    if (mode < 0.12) b = a;
    else if (mode < 0.62) b = clamp(a + choose([-1, 1]) * intBetween(1, near));
    else b = intBetween(min, max);
    return makeCompareQuestion(`Compare: ${a} ? ${b}`, sign(a - b));
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
  function makeMoneyQuestion(grade) {
    if (grade === 1 || grade === 2) {
      const values = grade === 1 ? [1, 2, 5, 10] : [5, 10, 20, 50, 100];
      let coins;
      do { coins = Array.from({ length: intBetween(2, grade === 1 ? 3 : 4) }, () => choose(values)); }
      while (coins.reduce((s, c) => s + c, 0) > (grade === 1 ? 25 : 250));
      const total = coins.reduce((s, c) => s + c, 0);
      return makeNumericQuestion(`You have ${coins.map(coinText).join(', ')}. How many cents altogether?`, total, { extras: [Math.max(...coins), coins.length] });
    }
    if (grade === 3) {
      if (Math.random() < 0.5) {
        const pay = choose([50, 100]);
        const price = pay === 50 ? intBetween(1, 9) * 5 : intBetween(1, 19) * 5;
        return makeNumericQuestion(`Something costs ${price}c. You pay ${coinText(pay)}. How many cents change?`, pay - price, { extras: [price, pay + price] });
      }
      const a = intBetween(1, 19) * 5, b = intBetween(1, 19) * 5;
      return makeNumericQuestion(`A pen costs ${a}c and a rubber costs ${b}c. How many cents altogether?`, a + b, { extras: [Math.abs(a - b), a] });
    }
    if (Math.random() < 0.5) {
      const qty = intBetween(2, 9), each = intBetween(2, 19) * 5;
      return makeNumericQuestion(`${qty} stickers cost ${each}c each. How many cents in total?`, qty * each, { extras: [qty + each, each] });
    }
    const price = intBetween(5, 99) * 5, pay = choose([500, 1000]);
    return makeNumericQuestion(`A book costs ${price}c. You pay ${coinText(pay)}. How many cents change?`, pay - price, { extras: [price, pay + price] });
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
    if (grade === 1 || grade === 2) {
      const n = grade === 1 ? intBetween(3, 6) : intBetween(3, 8);
      const word = grade === 1 ? 'sides' : choose(['sides', 'corners']);
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

  // Age 5: number bonds to 10 (3 + ? = 10 -> 7).
  // The object stage shows the first number; the correct answer adds that many objects of another type.
  function makeBondsTo10Question() {
    const known = intBetween(1, 9);
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    const choices = makeNumberChoices(10 - known, 0, 10, 4);
    return {
      question: `${known} + ? = 10`,
      resultText: `${known} + ${10 - known} = 10`,
      stage: { base: first, baseCount: known, op: 'add', change: 10 - known, added: second },
      ...choices,
      simple: true
    };
  }

  // Age 6: addition with a sum of at most 10, or subtraction starting from at most 10.
  function makeWithin10Question() {
    let a, b, answer, operator;
    if (Math.random() < 0.5) {
      operator = '+';
      a = intBetween(1, 9);
      b = intBetween(1, 10 - a);
      answer = a + b;
    } else {
      operator = '−';
      a = intBetween(2, 10);
      b = intBetween(1, a - 1);
      answer = a - b;
    }
    const choices = makeNumberChoices(answer, 0, 10, 4);
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    // The stage shows the first number; the correct answer adds objects of another type or removes some.
    return {
      question: `What is ${a} ${operator} ${b}?`,
      resultText: `${a} ${operator} ${b} = ${answer}`,
      stage: operator === '+'
        ? { base: first, baseCount: a, op: 'add', change: b, added: second }
        : { base: first, baseCount: a, op: 'remove', change: b },
      ...choices,
      simple: true
    };
  }

  // ---------- Grade 1-6 arithmetic ----------
  function arithmeticQuestion(grade, topic) {
    const all = grade === 1 ? ['+', '−'] : ['+', '−', '×', '÷'];
    const ops = topic === 'add' ? ['+'] : topic === 'sub' ? ['−'] : topic === 'mul' ? ['×'] : topic === 'div' ? ['÷'] : all;
    const operator = choose(ops);
    let a, b, answer;

    // Number ranges and multiplication/division complexity increase by level.
    if (grade === 1) {
      a = intBetween(0, 20);
      b = intBetween(0, 20);
      if (operator === '−' && b > a) [a, b] = [b, a];
      answer = operator === '+' ? a + b : a - b;
    } else if (grade === 2) {
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
  const ALL_MIX_TOPICS = ['mixed', 'tables', 'compare', 'fractions', 'money', 'clock', 'shapes'];

  function generateRawQuestion(difficulty, topic) {
    if (difficulty === 'toddler') return makeToddlerQuestion();
    if (difficulty === 'age4') return makeAge4Question();
    if (difficulty === 'age5') return makeBondsTo10Question();
    if (difficulty === 'age6') return makeWithin10Question();
    const grade = gradeOf(difficulty);
    let name = normaliseTopic(difficulty, topic);
    if (name === 'all') {
      const offered = topicsFor(difficulty).map(t => t.value);
      name = choose(ALL_MIX_TOPICS.filter(t => offered.includes(t)));
    }
    switch (name) {
      case 'tables': return makeTablesQuestion(grade);
      case 'compare': return makeCompareNumbersQuestion(grade);
      case 'fractions': return makeFractionsQuestion(grade);
      case 'money': return makeMoneyQuestion(grade);
      case 'clock': return makeClockQuestion(grade);
      case 'shapes': return makeShapesQuestion(grade);
      default: return arithmeticQuestion(grade, name);
    }
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
    if (q.picture) identity.push(q.picture.key);   // Age 4: the same sum in another arrangement is a different question
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
