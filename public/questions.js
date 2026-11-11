// Question generators. Pure logic (no DOM) so it can be tested on its own.
(function (root) {
  'use strict';

  const DIFFICULTIES = [
    { value: 'toddler', label: 'Age 2–3' },
    { value: 'age4', label: 'Age 4' },
    { value: 'age5', label: 'Age 5' },
    { value: 'age6', label: 'Age 6 (Foundation)' },
    { value: 'grade1', label: 'Grade 1' },
    { value: 'grade2', label: 'Grade 2' },
    { value: 'grade3', label: 'Grade 3' },
    { value: 'grade4', label: 'Grade 4' },
    { value: 'grade5', label: 'Grade 5' },
    { value: 'grade6', label: 'Grade 6' }
  ];

  // Each topic lists the grades (`grades`) and/or age levels (`levels`) that offer it. `all` (Mixed All Questions)
  // is offered everywhere. The order here is the order shown in the Topic list.
  const ALL = [1, 2, 3, 4, 5, 6];
  const AGES = ['toddler', 'age4', 'age5', 'age6'];
  const T = (value, label, grades, levels = []) => ({ value, label, grades, levels });
  const TOPICS = [
    T('all', 'Mixed All Questions', ALL, AGES),
    T('mixed', 'Mixed arithmetic', ALL),
    T('add', 'Addition only', ALL),
    T('sub', 'Subtraction only', ALL),
    T('mul', 'Multiplication only', [2, 3, 4, 5, 6]),
    T('div', 'Division only', [2, 3, 4, 5, 6]),
    T('tables', 'Times tables', [2, 3, 4]),
    T('count', 'Counting', [], ['toddler', 'age4', 'age5', 'age6']),
    T('match', 'Numbers & quantities', [], ['toddler', 'age4']),
    T('subitise', 'Quick look (subitising)', [], ['toddler', 'age4', 'age6']),
    T('numbers', 'Numbers to 120', [1]),
    T('skip', 'Skip counting', [1]),
    T('place', 'Tens & ones', [1]),
    T('combine', 'Put together & take apart', [], ['toddler']),
    T('addsub', 'Add & subtract', [], ['age4', 'age5', 'age6']),
    T('partition', 'Make & break numbers', [], ['age4', 'age5', 'age6']),
    T('missing', 'Missing numbers', [1], ['age5']),
    T('word', 'Word problems', [1]),
    T('sharing', 'Sharing & grouping', [1], ['age5', 'age6']),
    T('groups', 'Equal groups', [1]),
    T('patterns', 'Patterns', [], ['toddler', 'age4', 'age5', 'age6']),
    T('compare', 'Comparing numbers', [1, 2, 3, 4], ['toddler', 'age4', 'age5', 'age6']),
    T('sort', 'Sorting', [], ['toddler', 'age4']),
    T('fractions', 'Fractions', ALL),
    T('money', 'Money', [1, 2, 3, 4], ['age5', 'age6']),
    T('measure', 'Measuring', [1], AGES),
    T('time', 'Days & time', [1], ['age5', 'age6']),
    T('clock', 'Clock reading', [1, 2, 3, 4]),
    T('shapes', 'Shapes & measures', ALL),
    T('shape2d', 'Shapes', [], AGES),
    T('position', 'Positions & directions', [1], AGES),
    T('data', 'Data & graphs', [1], ['age5', 'age6'])
  ];

  // Default for new profiles and for any missing or unavailable topic. Saved choices are never replaced.
  const DEFAULT_TOPIC = 'all';

  const isGrade = (difficulty) => /^grade[1-6]$/.test(difficulty);
  const gradeOf = (difficulty) => Number(String(difficulty).replace('grade', ''));
  const difficultyLabel = (value) => (DIFFICULTIES.find(d => d.value === value) || {}).label || value;
  const topicLabel = (value) => (TOPICS.find(t => t.value === value) || {}).label || value;
  const topicsFor = (difficulty) => TOPICS.filter(t => isGrade(difficulty) ? t.grades.includes(gradeOf(difficulty)) : t.levels.includes(difficulty));
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
      const kind = choose(['half', 'half', 'half', 'name', 'name', 'whole', 'equal']);
      if (kind === 'name') return choiceQuestion('A cake is cut into 2 equal parts. What is each part called?', 'a half', ['a whole', 'a third', 'a quarter'], { simple: false });
      if (kind === 'whole') return makeNumericQuestion('How many halves make one whole?', 2, { extras: [1, 3, 4] });
      if (kind === 'equal') {
        const same = Math.random() < 0.5;
        return choiceQuestion(`A pizza is cut into 2 parts. ${same ? 'The two parts are the same size.' : 'One part is bigger than the other.'} Are these halves?`, same ? 'Yes' : 'No', [same ? 'No' : 'Yes'], { simple: false });
      }
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
    const range = [null, [0, 120], [10, 99], [100, 999], [1000, 9999]][grade];
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
    if (grade === 1) return makeMoneyEarly('grade1');
    if (grade === 2) {
      const values = [5, 10, 20, 50, 100];
      let coins;
      do { coins = Array.from({ length: intBetween(2, 4) }, () => choose(values)); }
      while (coins.reduce((s, c) => s + c, 0) > 250);
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
    if (grade === 1 && Math.random() < 0.65) return makeShape2dQuestion('grade1');
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
    { emoji: '🎈', name: 'balloons', one: 'balloon' },
    { emoji: '⚽', name: 'balls', one: 'ball' },
    { emoji: '🍎', name: 'apples', one: 'apple' },
    { emoji: '🐶', name: 'puppies', one: 'puppy' },
    { emoji: '🐥', name: 'chicks', one: 'chick' },
    { emoji: '🚗', name: 'cars', one: 'car' },
    { emoji: '⭐', name: 'stars', one: 'star' },
    { emoji: '🍓', name: 'strawberries', one: 'strawberry' },
    { emoji: '🐟', name: 'fish', one: 'fish' },
    { emoji: '🦆', name: 'ducks', one: 'duck' },
    { emoji: '🍌', name: 'bananas', one: 'banana' },
    { emoji: '🐱', name: 'kittens', one: 'kitten' }
  ];

  function makeCountingQuestion() {
    const item = choose(COUNT_OBJECTS);
    // Mostly 1-5, with some 6-10 so the range extends towards 10 (no adaptive difficulty).
    const count = Math.random() < 0.75 ? intBetween(1, 5) : intBetween(6, 10);
    const choices = makeNumberChoices(count, 1, count > 5 ? 10 : 5, 3);
    return {
      question: `How many ${item.name}?`,
      visual: Array(count).fill(item.emoji),
      visualLabel: `${item.name}: ${count}`,
      rowsOfFive: true,
      ...choices,
      simple: true
    };
  }

  // Age 4: count 1-10 objects, laid out in rows of 5 (6 = 5 + 1, 7 = 5 + 2, ...).
  function makeCounting10Question() {
    const item = choose(COUNT_OBJECTS);
    const count = intBetween(1, 10);
    const choices = makeNumberChoices(count, 1, 10, 4);
    return {
      question: `How many ${item.name}?`,
      visual: Array(count).fill(item.emoji),
      visualLabel: `${item.name}: ${count}`,
      rowsOfFive: true,
      ...choices,
      simple: true
    };
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

  // ---------- Age 2-3 to Grade 1 curriculum topics ----------
  // Every generator takes the level ('toddler', 'age4', 'age5', 'age6' or 'grade1') and returns a raw question.
  // Age-level questions are `simple` (big centred buttons, no A/B/C); Grade 1 questions are not.
  // Answers that are not plain numbers are shuffled here (choiceQuestion) so the correct position stays random;
  // numeric answers are sorted smallest -> largest by generateQuestion as usual.
  const NAMES = ['Mia', 'Liam', 'Ava', 'Noah', 'Zoe', 'Jack', 'Ella', 'Oscar', 'Ruby', 'Leo'];
  const thing = (n, obj) => `${n} ${n === 1 ? obj.one : obj.name}`;
  const twoNames = () => shuffledCopy(NAMES).slice(0, 2);
  const rowOf = (n, emoji) => Array.from({ length: 5 }, (_, i) => (i < n ? emoji : ''));
  const centred = (items) => { const pad = (5 - items.length) >> 1; return Array.from({ length: 5 }, (_, i) => items[i - pad] || ''); };
  // Dice-like layouts so small quantities can be recognised without counting (columns 0-4, two rows).
  const DICE = { 1: [[2]], 2: [[1, 3]], 3: [[1, 3], [2]], 4: [[1, 3], [1, 3]], 5: [[0, 2, 4], [1, 3]], 6: [[0, 2, 4], [0, 2, 4]] };
  const diceVisual = (n, emoji) => DICE[n].flatMap(cols => Array.from({ length: 5 }, (_, c) => (cols.includes(c) ? emoji : '')));

  function choiceQuestion(text, correct, wrong, extra = {}) {
    const others = [...new Set(wrong)].filter(w => w !== correct);
    const answers = shuffledCopy([correct, ...others]);
    return { question: text, answers, correct: answers.indexOf(correct), simple: true, ...extra };
  }
  const numQ = (text, answer, min, max, count, extra = {}) =>
    ({ question: text, ...makeNumberChoices(answer, min, max, count), simple: true, ...extra });
  // Multiple-choice for money totals: every option is a multiple of `step`, so "ends in 5 or 0" is no clue.
  function stepQ(text, answer, step, max, count, extra = {}) {
    const pool = [];
    for (let v = step; v <= max; v += step) if (v !== answer) pool.push(v);
    return { question: text, answers: [answer, ...pickWrongAnswers(answer, pool, count - 1)].map(String), correct: 0, simple: true, ...extra };
  }
  const levelNumQ = (level, text, answer, extras, min, max) =>
    level === 'grade1' ? makeNumericQuestion(text, answer, { extras }) : numQ(text, answer, min, max, 4);

  // ----- counting and number sequences -----
  function makeSequenceQuestion(level) {
    const lo = level === 'age6' ? 0 : 1;
    const hi = level === 'age4' && Math.random() < 0.5 ? 10 : 20;
    const kind = choose(level === 'age4' ? ['next', 'back', 'after', 'before'] : ['next', 'back', 'after', 'before', 'between']);
    let text, ans;
    if (kind === 'next') { const s = intBetween(lo, hi - 3); text = `What comes next? ${s}, ${s + 1}, ${s + 2}, ?`; ans = s + 3; }
    else if (kind === 'back') { const s = intBetween(lo + 3, hi); text = `What comes next? ${s}, ${s - 1}, ${s - 2}, ?`; ans = s - 3; }
    else if (kind === 'after') { const n = intBetween(lo, hi - 1); text = `What number comes after ${n}?`; ans = n + 1; }
    else if (kind === 'before') { const n = intBetween(lo + 1, hi); text = `What number comes before ${n}?`; ans = n - 1; }
    else { const n = intBetween(lo, hi - 2); text = `What number is between ${n} and ${n + 2}?`; ans = n + 1; }
    return numQ(text, ans, Math.max(lo, ans - 5), Math.min(hi, ans + 5), 4);
  }

  function makeCountTopic(level) {
    if (level === 'toddler') return makeCountingQuestion();
    if (Math.random() < (level === 'age4' ? 0.5 : 0.3)) return makeCounting10Question();
    return makeSequenceQuestion(level);
  }

  // Numeral -> quantity: "Which group shows 4?" with groups of the same object, listed fewest to most.
  function makeMatchQuestion(level) {
    const item = choose(COUNT_OBJECTS);
    const n = intBetween(1, 5);
    const nums = makeNumberChoices(n, 1, 5, level === 'toddler' ? 3 : 4).answers.map(Number);
    return { question: `Which group shows ${n}?`, answers: nums.map(k => item.emoji.repeat(k)), keys: nums, correct: 0, simple: true };
  }

  function makeSubitiseQuestion(level) {
    const item = choose(COUNT_OBJECTS);
    const n = intBetween(1, level === 'toddler' ? 4 : 5);
    return numQ(`Look quickly. How many ${item.name}?`, n, 1, 5, level === 'toddler' ? 3 : 4,
      { visual: diceVisual(n, item.emoji), visualLabel: `${item.name}: ${n}`, rowsOfFive: true });
  }

  // ----- comparing -----
  function makeCompareGroups() {
    const [A, B] = shuffledCopy(COUNT_OBJECTS);
    const a = intBetween(1, 5);
    const b = Math.random() < 0.25 ? a : intBetween(1, 5);
    const more = Math.random() < 0.5;
    const correct = a === b ? 'Same' : (more === (a > b)) ? A.emoji : B.emoji;
    return choiceQuestion(`Which has ${more ? 'more' : 'fewer'}, or are they the same?`, correct, [A.emoji, B.emoji, 'Same'],
      { visual: [...rowOf(a, A.emoji), ...rowOf(b, B.emoji)], visualLabel: `${a} ${A.name}, ${b} ${B.name}`, rowsOfFive: true });
  }

  function makeCompareNumberChoice(min, max) {
    const distinct = (k) => { const s = new Set(); while (s.size < k) s.add(intBetween(min, max)); return shuffledCopy([...s]); };
    const kind = choose(['two', 'three', 'middle']);
    const big = Math.random() < 0.5;
    if (kind === 'two') {
      const [a, b] = distinct(2);
      return { question: `Which number is ${big ? 'bigger' : 'smaller'}? ${a} or ${b}`, answers: [String(big ? Math.max(a, b) : Math.min(a, b)), String(big ? Math.min(a, b) : Math.max(a, b))], correct: 0, simple: true };
    }
    const three = distinct(3);
    const sorted = [...three].sort((x, y) => x - y);
    const correct = kind === 'middle' ? sorted[1] : big ? sorted[2] : sorted[0];
    const text = kind === 'middle' ? `Which number is between the other two? ${three.join(', ')}` : `Which number is the ${big ? 'biggest' : 'smallest'}? ${three.join(', ')}`;
    return { question: text, answers: [correct, ...three.filter(v => v !== correct)].map(String), correct: 0, simple: true };
  }

  function makeCollectionStory() {
    const [n1, n2] = twoNames();
    const item = choose(['stickers', 'marbles', 'cards', 'shells']);
    const a = intBetween(5, 20);
    const b = Math.random() < 0.2 ? a : intBetween(5, 20);
    const more = Math.random() < 0.5;
    const correct = a === b ? 'Same' : (more === (a > b)) ? n1 : n2;
    return choiceQuestion(`${n1} has ${a} ${item}. ${n2} has ${b} ${item}. Who has ${more ? 'more' : 'fewer'}, or is it the same?`, correct, [n1, n2, 'Same']);
  }

  function makeEarlyCompare(level) {
    if (level === 'toddler') return makeCompareGroups();
    if (level === 'age4') return Math.random() < 0.5 ? makeCompareGroups() : makeCompareNumberChoice(1, 10);
    if (level === 'age5') return makeCompareNumberChoice(0, 20);
    return Math.random() < 0.5 ? makeCollectionStory() : makeCompareNumberChoice(0, 20);
  }

  // ----- sorting -----
  const SORT_SETS = {
    Fruit: ['🍎', '🍌', '🍓', '🍐', '🍊'],
    Animals: ['🐶', '🐱', '🐟', '🦆', '🐰'],
    Vehicles: ['🚗', '🚌', '🚲', '🚂', '✈️']
  };
  function makeSortQuestion(level) {
    const [c1, c2, c3] = shuffledCopy(Object.keys(SORT_SETS));
    const kind = level === 'toddler' ? 'goes' : choose(['goes', 'odd', 'group']);
    if (kind === 'group') {
      const e = choose(SORT_SETS[c1]);
      return choiceQuestion(`Which group does ${e} go in?`, c1, [c2, c3]);
    }
    const same = shuffledCopy(SORT_SETS[c1]);
    if (kind === 'goes') {
      const shown = same.slice(0, 3);
      const q = choiceQuestion('Which one goes with these?', same[3], [choose(SORT_SETS[c2]), choose(SORT_SETS[c3])],
        { visual: [...shown, '', ''], visualLabel: 'Three things that belong together', rowsOfFive: true });
      q.keyExtra = shown.join('');
      return q;
    }
    const odd = choose(SORT_SETS[c2]);
    const q = choiceQuestion('Which one is different?', odd, same.slice(0, 3));
    q.keyExtra = [...q.answers].sort().join('');
    return q;
  }

  // ----- patterns and instructions -----
  function makePatternQuestion(level) {
    const r = Math.random();
    if (level !== 'toddler' && level !== 'age4' && r < 0.3) {
      const steps = level === 'age5' ? [1, 2] : [1, 2, 5, 10];
      const step = choose(steps);
      const cap = level === 'age5' ? 20 : 50;
      const start = intBetween(0, Math.floor((cap - 4 * step) / step)) * step;
      const last = start + 3 * step, ans = start + 4 * step;
      return { ...makeNumericQuestion(`What comes next? ${[0, 1, 2, 3].map(i => start + i * step).join(', ')}, ?`, ans, { extras: [last + 1, ans + 1, ans - 1] }), simple: true };
    }
    if (level === 'age6' && r < 0.5) {
      const [x, y] = choose([['jumps', 'claps'], ['hops', 'spins'], ['steps', 'claps']]);
      const a = intBetween(1, 5), b = intBetween(1, 5);
      return numQ(`Follow the instructions: do ${a} ${x}, then ${b} ${y}. How many actions altogether?`, a + b, 2, 10, 4);
    }
    const unit = choose(level === 'toddler' ? ['AB'] : level === 'age4' ? ['AB', 'AAB', 'ABB', 'ABC'] : ['AB', 'AAB', 'ABB', 'ABC', 'AABB']);
    const L = unit.length;
    const k = 2 * L + (level === 'toddler' || L === 4 ? 0 : intBetween(0, L - 1));
    const syms = shuffledCopy(COUNT_OBJECTS).map(o => o.emoji);
    const map = { A: syms[0], B: syms[1], C: syms[2] };
    const seq = Array.from({ length: k }, (_, i) => map[unit[i % L]]);
    const next = map[unit[k % L]];
    const wrong = [...new Set([...unit].map(ch => map[ch]))].filter(s => s !== next).concat(syms.slice(3, 5));
    const count = level === 'toddler' ? 2 : 3;
    return choiceQuestion('What comes next?', next, wrong.slice(0, count),
      { visual: [...seq, '❓'], visualLabel: `Pattern: ${seq.join(' ')} then what comes next`, rowsOfFive: true });
  }

  // ----- adding, taking away and partitioning (object stage) -----
  function makeStoryAddSub(maxTotal, count = 4) {
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    if (Math.random() < 0.5) {
      const a = intBetween(1, maxTotal - 1), b = intBetween(1, maxTotal - a), ans = a + b;
      return numQ(`${thing(a, first)} and ${thing(b, second)}. How many altogether?`, ans, 0, Math.max(maxTotal, 5), count,
        { resultText: `${a} + ${b} = ${ans}`, stage: { base: first, baseCount: a, op: 'add', change: b, added: second } });
    }
    const a = intBetween(2, maxTotal), b = intBetween(1, a - 1), ans = a - b;
    return numQ(`There are ${a} ${first.name}. ${b} ${b === 1 ? 'is' : 'are'} taken away. How many are left?`, ans, 0, Math.max(maxTotal, 5), count,
      { resultText: `${a} − ${b} = ${ans}`, stage: { base: first, baseCount: a, op: 'remove', change: b } });
  }

  function makeEarlyAddSub(level) {
    if (level === 'age4') return makeStoryAddSub(Math.random() < 0.6 ? 5 : 10);
    if (level === 'age5') return makeWithin10Question();
    return Math.random() < 0.5 ? makeWithin10Question() : makeStoryAddSub(10);
  }

  function makePartitionQuestion(level) {
    const total = level === 'age4' ? intBetween(2, 5) : level === 'age5' && Math.random() < 0.4 ? 10 : intBetween(3, 10);
    if (level === 'age5' && total === 10) return makeBondsTo10Question();
    const known = intBetween(1, total - 1);
    const rest = total - known;
    if (level === 'age6' && Math.random() < 0.5) return numQ(`Split ${total} into ${known} and ?`, rest, 0, Math.max(total, 5), 4);
    const [first, second] = shuffledCopy(COUNT_OBJECTS);
    return numQ(`${known} + ? = ${total}`, rest, 0, Math.max(total, 5), 4,
      { resultText: `${known} + ${rest} = ${total}`, stage: { base: first, baseCount: known, op: 'add', change: rest, added: second } });
  }

  // a + ? = t, ? + b = t, t - ? = r, ? - b = r (all within `max`)
  function makeMissingQuestion(level) {
    const max = level === 'grade1' ? 20 : 10;
    const form = choose(['a', 'b', 'c', 'd']);
    let text, ans, extras;
    if (form === 'd') {
      const b = intBetween(1, max - 1), r = intBetween(1, max - b);
      text = `? − ${b} = ${r}`; ans = r + b; extras = [r - b >= 0 ? r - b : r, b];
    } else {
      const t = intBetween(3, max), x = intBetween(1, t - 1);
      if (form === 'a') { text = `${x} + ? = ${t}`; ans = t - x; extras = [t + x, t]; }
      else if (form === 'b') { text = `? + ${x} = ${t}`; ans = t - x; extras = [t + x, t]; }
      else { text = `${t} − ? = ${x}`; ans = t - x; extras = [t + x, t]; }
    }
    return levelNumQ(level, text, ans, extras, 0, max);
  }

  // ----- sharing, grouping and equal groups -----
  function makeSharingQuestion(level) {
    const item = choose(COUNT_OBJECTS.filter(o => o.name.length <= 8)); // short names keep the wording on two lines at Extra large text
    const g1 = level === 'grade1';
    const cap = g1 ? 20 : level === 'age5' ? 10 : 12;
    const share = Math.random() < 0.5;
    const sizes = share ? (g1 ? [2, 3, 4, 5, 10] : level === 'age5' ? [2] : [2, 3, 4]) : (g1 ? [2, 3, 4, 5, 10] : level === 'age5' ? [2, 5] : [2, 3, 5]);
    const k = choose(sizes);
    const m = intBetween(1, Math.floor(cap / k));
    const n = k * m;
    const text = share
      ? `Share ${n} ${item.name} equally between ${k} children. How many each?`
      : `Put ${n} ${item.name} into groups of ${k}. How many groups?`;
    const q = levelNumQ(level, text, m, [n, k, n - k], 1, Math.max(6, m + 3));
    if (!g1 && n <= 10) Object.assign(q, { visual: Array(n).fill(item.emoji), visualLabel: `${item.name}: ${n}`, rowsOfFive: true });
    return q;
  }

  function makeGroupsQuestion() {
    const m = choose([2, 5, 10]), g = intBetween(2, 5), total = g * m;
    if (Math.random() < 0.5) {
      const container = choose(['bags', 'plates', 'boxes']);
      const item = choose(COUNT_OBJECTS).name;
      return makeNumericQuestion(`${g} ${container} have ${m} ${item} in each. How many ${item} altogether?`, total, { extras: [g + m, m, total - m] });
    }
    return makeNumericQuestion(`${Array(g).fill(m).join(' + ')} = ?`, total, { extras: [g + m, m, total - m] });
  }

  // ----- Grade 1 number work -----
  function makeSkipQuestion() {
    const step = choose([2, 5, 10]);
    const at = (i) => step * i;
    const kind = choose(['next', 'missing', 'back']);
    const i0 = intBetween(kind === 'back' ? 4 : 1, 8);
    if (kind === 'next') {
      return makeNumericQuestion(`Count by ${step}s: ${at(i0)}, ${at(i0 + 1)}, ${at(i0 + 2)}, ?`, at(i0 + 3), { extras: [at(i0 + 2) + 1, at(i0 + 3) + 1, at(i0 + 3) - 1] });
    }
    if (kind === 'missing') {
      return makeNumericQuestion(`Count by ${step}s: ${at(i0)}, ?, ${at(i0 + 2)}, ${at(i0 + 3)}`, at(i0 + 1), { extras: [at(i0) + 1, at(i0 + 1) + 1, at(i0 + 1) - 1] });
    }
    return makeNumericQuestion(`Count back by ${step}s: ${at(i0)}, ${at(i0 - 1)}, ${at(i0 - 2)}, ?`, at(i0 - 3), { extras: [at(i0 - 2) - 1, at(i0 - 3) + 1, at(i0 - 3) - 1] });
  }

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function numberWord(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    return n === 100 ? 'one hundred' : `one hundred and ${numberWord(n - 100)}`;
  }
  const swapDigits = (n) => { const s = String(n); return s.length < 2 ? n : Number(s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1)); };

  function makeNumbersQuestion() {
    const kind = choose(['after', 'before', 'between', 'tenMore', 'tenLess', 'word']);
    if (kind === 'after') { const n = intBetween(0, 119); return makeNumericQuestion(`What number comes after ${n}?`, n + 1, { extras: [n, n + 2, n + 10] }); }
    if (kind === 'before') { const n = intBetween(1, 120); return makeNumericQuestion(`What number comes before ${n}?`, n - 1, { extras: [n, n - 2, n - 10] }); }
    if (kind === 'between') { const n = intBetween(0, 118); return makeNumericQuestion(`What number is between ${n} and ${n + 2}?`, n + 1, { extras: [n, n + 2, n + 10] }); }
    if (kind === 'tenMore') { const n = intBetween(0, 110); return makeNumericQuestion(`What is 10 more than ${n}?`, n + 10, { extras: [n + 1, n + 20, n + 100] }); }
    if (kind === 'tenLess') { const n = intBetween(10, 120); return makeNumericQuestion(`What is 10 less than ${n}?`, n - 10, { extras: [n - 1, n - 20] }); }
    const n = intBetween(11, 120);
    return makeNumericQuestion(`Which number is ${numberWord(n)}?`, n, { extras: [swapDigits(n), n + 10, n - 10, n + 1] });
  }

  function makePlaceQuestion() {
    const kind = choose(['tens', 'ones', 'build', 'value', 'split', 'splitOne']);
    const n = intBetween(11, 99);
    const tens = Math.floor(n / 10), ones = n % 10;
    if (kind === 'tens') return makeNumericQuestion(`How many tens are in ${n}?`, tens, { extras: [ones, n] });
    if (kind === 'ones') return makeNumericQuestion(`${n} is ${tens} tens and how many ones?`, ones, { extras: [tens, n] });
    if (kind === 'build') {
      const t = intBetween(1, 9), o = intBetween(0, 9);
      return makeNumericQuestion(`${t} tens and ${o} ones = ?`, t * 10 + o, { extras: [t + o, o * 10 + t, t * 10] });
    }
    if (kind === 'value') {
      let m = n;
      while (Math.floor(m / 10) === m % 10) m = intBetween(11, 99);
      return makeNumericQuestion(`What is the value of the ${Math.floor(m / 10)} in ${m}?`, Math.floor(m / 10) * 10, { extras: [Math.floor(m / 10), m % 10, (m % 10) * 10] });
    }
    if (kind === 'split') {
      const x = 10 * intBetween(1, ones === 0 ? tens - 1 : tens);
      return makeNumericQuestion(`${n} = ${x} + ?`, n - x, { extras: [n, x, tens] });
    }
    const whole = intBetween(4, 9), part = intBetween(1, whole - 1);
    return makeNumericQuestion(`${whole} = ${part} + ?`, whole - part, { extras: [whole, part] });
  }

  const THINGS = ['stickers', 'marbles', 'apples', 'pencils', 'shells', 'cards', 'biscuits', 'balloons'];
  function makeWordQuestion() {
    const [n1, n2] = twoNames();
    const t = choose(THINGS);
    const kind = choose(['join', 'separate', 'compare', 'part', 'change', 'total']);
    if (kind === 'join') { const a = intBetween(2, 18), b = intBetween(2, 20 - a >= 2 ? 20 - a : 2); const s = a + b; return makeNumericQuestion(`${n1} has ${a} ${t}. ${n1} gets ${b} more. How many ${t} does ${n1} have now?`, s, { extras: [a, b, Math.abs(a - b)] }); }
    if (kind === 'separate') { const a = intBetween(3, 20), b = intBetween(1, a - 1); return makeNumericQuestion(`${n1} has ${a} ${t}. ${n1} gives away ${b}. How many ${t} are left?`, a - b, { extras: [a, b, a + b] }); }
    if (kind === 'compare') { const b = intBetween(2, 15), a = intBetween(b + 1, 20); return makeNumericQuestion(`${n1} has ${a} ${t}. ${n2} has ${b} ${t}. How many more does ${n1} have?`, a - b, { extras: [a, b, a + b] }); }
    if (kind === 'part') { const a = intBetween(6, 20), b = intBetween(2, a - 2); return makeNumericQuestion(`There are ${a} children in the class. ${b} are boys. How many are girls?`, a - b, { extras: [a, b, a + b] }); }
    if (kind === 'change') { const a = intBetween(2, 12), b = intBetween(2, 20 - a >= 2 ? 20 - a : 2); return makeNumericQuestion(`${n1} had ${a} ${t}. Then ${n1} found some more. Now ${n1} has ${a + b}. How many did ${n1} find?`, b, { extras: [a, a + b, Math.abs(a - b)] }); }
    const a = intBetween(2, 12), b = intBetween(2, 20 - a >= 2 ? 20 - a : 2);
    return makeNumericQuestion(`${n1} has ${a} ${t} and ${n2} has ${b} ${t}. How many altogether?`, a + b, { extras: [a, b, Math.abs(a - b)] });
  }

  // ----- money (Australian coins; answers in cents) -----
  function makeMoneyEarly(level) {
    const g1 = level === 'grade1';
    const opts = { simple: !g1 };
    const kind = choose(level === 'age5' ? ['gold', 'most', 'least', 'total'] : level === 'age6' ? ['gold', 'most', 'least', 'make', 'afford'] : ['gold', 'most', 'least', 'cents', 'total', 'total']);
    const silver = [5, 10, 20, 50];
    if (kind === 'gold') return choiceQuestion('Which coin is gold?', coinText(choose([100, 200])), shuffledCopy(silver).slice(0, 2).map(coinText), opts);
    if (kind === 'most' || kind === 'least') {
      const three = shuffledCopy([5, 10, 20, 50, 100, 200]).slice(0, 3);
      const target = kind === 'most' ? Math.max(...three) : Math.min(...three);
      return choiceQuestion(`Which coin is worth the ${kind === 'most' ? 'most' : 'least'}?`, coinText(target), three.filter(v => v !== target).map(coinText), opts);
    }
    if (kind === 'cents') {
      const v = choose([100, 200]);
      const wrong = pickWrongAnswers(v, [1, 2, 10, 20, 50, 100, 150, 200, 250, 500], 3);
      return { question: `How many cents is a ${coinText(v)} coin worth?`, answers: [v, ...wrong].map(String), correct: 0, simple: false };
    }
    if (kind === 'make') {
      const c = choose([10, 20, 50]);
      return numQ(`How many ${coinText(c)} coins make $1?`, 100 / c, 1, 10, 4);
    }
    if (kind === 'afford') {
      const price = choose([10, 20, 50, 100, 200, 500]), coin = choose([5, 10, 20, 50, 100, 200]);
      return choiceQuestion(`A toy costs ${coinText(price)}. You have a ${coinText(coin)} coin. Do you have enough?`, coin >= price ? 'Yes' : 'No', [coin >= price ? 'No' : 'Yes'], opts);
    }
    const values = g1 ? [5, 10, 20, 50] : [5, 10];
    const cap = g1 ? 100 : 30;
    let coins;
    do { coins = Array.from({ length: intBetween(2, 3) }, () => choose(values)); } while (coins.reduce((s, c) => s + c, 0) > cap);
    const total = coins.reduce((s, c) => s + c, 0);
    return stepQ(`You have ${coins.map(coinText).join(', ')}. How many cents altogether?`, total, 5, total + 25, 4, { simple: !g1 });
  }

  // ----- measurement -----
  const SIZE_PAIRS = [['🐘', '🐭'], ['🚌', '🚗'], ['🌳', '🌱'], ['🏠', '🚪'], ['🐻', '🐥'], ['🐄', '🐓']];
  const MASS_PAIRS = [['🐘', '🐭'], ['🚗', '🚲'], ['🪨', '🪶'], ['📚', '📄'], ['🐻', '🐥']];
  const CAP_PAIRS = [['🛁', '🥛'], ['🪣', '☕'], ['🛁', '🥄']];
  const DURATION_PAIRS = [['😴 Sleep at night', '👏 Clap your hands'], ['🍽️ Eat dinner', '🤧 Sneeze'], ['🚶 Walk to school', '👁️ Blink']];
  const pairQuestion = (pairs, upText, downText, simple) => {
    const [big, small] = choose(pairs);
    const up = Math.random() < 0.5;
    return choiceQuestion(up ? upText : downText, up ? big : small, [up ? small : big], { simple });
  };

  function makeMeasureQuestion(level) {
    const g1 = level === 'grade1';
    const bars = () => {
      const a = intBetween(1, 5), b = Math.random() < 0.2 ? a : intBetween(1, 5);
      const longer = Math.random() < 0.5;
      const correct = a === b ? 'Same' : (longer === (a > b)) ? 'Top bar' : 'Bottom bar';
      return choiceQuestion(`Which bar is ${longer ? 'longer' : 'shorter'}?`, correct, ['Top bar', 'Bottom bar', 'Same'],
        { visual: [...rowOf(a, '🟧'), ...rowOf(b, '🟧')], visualLabel: `Top bar ${a} blocks, bottom bar ${b} blocks`, rowsOfFive: true });
    };
    const size = () => pairQuestion(SIZE_PAIRS, 'Which one is bigger?', 'Which one is smaller?', true);
    const mass = () => pairQuestion(MASS_PAIRS, 'Which one is heavier?', 'Which one is lighter?', !g1);
    const capacity = () => pairQuestion(CAP_PAIRS, 'Which one holds more?', 'Which one holds less?', !g1);
    const duration = () => pairQuestion(DURATION_PAIRS, 'Which takes longer?', 'Which is quicker?', false);
    const clips = () => {
      const [x, y] = choose([['pencil', 'crayon'], ['book', 'shoe'], ['spoon', 'fork']]);
      const b = intBetween(2, 9), a = intBetween(b + 1, 12);
      if (Math.random() < 0.5) return makeNumericQuestion(`A ${x} is ${a} paper clips long. A ${y} is ${b} paper clips long. How many more paper clips long is the ${x}?`, a - b, { extras: [a, b, a + b] });
      const longer = Math.random() < 0.5;
      return choiceQuestion(`A ${x} is ${a} paper clips long. A ${y} is ${b} paper clips long. Which is ${longer ? 'longer' : 'shorter'}?`, `The ${longer ? x : y}`, [`The ${longer ? y : x}`], { simple: false });
    };
    const pools = { toddler: [bars, size], age4: [bars, size, mass], age5: [bars, mass, capacity], age6: [bars, mass, capacity, duration], grade1: [clips, clips, mass, capacity, duration] };
    return choose(pools[level])();
  }

  // ----- days, time and sequences -----
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SEQUENCES = [
    ['Crack the egg', 'Cook the egg', 'Eat the egg'], ['Plant a seed', 'Water the seed', 'Pick the flower'],
    ['Put on socks', 'Put on shoes', 'Walk outside'], ['Fill the bath', 'Get in the bath', 'Dry with a towel'],
    ['Wake up', 'Eat breakfast', 'Go to school'], ['Wash your hands', 'Eat your lunch', 'Brush your teeth']
  ];
  const TIME_OF_DAY = [['wake up', 'morning'], ['eat breakfast', 'morning'], ['come home from school', 'afternoon'], ['see the moon and stars', 'night'], ['go to bed', 'night']];

  function makeTimeQuestion(level) {
    const g1 = level === 'grade1';
    const kinds = level === 'age5' ? ['dayAfter', 'dayBefore', 'first', 'last']
      : level === 'age6' ? ['dayAfter', 'dayBefore', 'tod', 'weekend', 'first', 'last']
        : ['dayAfter', 'dayBefore', 'monthAfter', 'monthBefore', 'weekend', 'count'];
    const kind = choose(kinds);
    const cycle = (list, word, dir) => {
      const i = intBetween(0, list.length - 1);
      const next = list[(i + dir + list.length) % list.length];
      const wrong = shuffledCopy(list.filter(x => x !== next && x !== list[i])).slice(0, g1 || level === 'age6' ? 3 : 2);
      return choiceQuestion(`Which ${word} comes ${dir > 0 ? 'after' : 'before'} ${list[i]}?`, next, wrong, { simple: !g1 });
    };
    if (kind === 'dayAfter') return cycle(DAYS, 'day', 1);
    if (kind === 'dayBefore') return cycle(DAYS, 'day', -1);
    if (kind === 'monthAfter') return cycle(MONTHS, 'month', 1);
    if (kind === 'monthBefore') return cycle(MONTHS, 'month', -1);
    if (kind === 'weekend') return choiceQuestion('Which day is in the weekend?', choose(['Saturday', 'Sunday']), shuffledCopy(DAYS.slice(0, 5)).slice(0, 3), { simple: !g1 });
    if (kind === 'tod') {
      const [action, part] = choose(TIME_OF_DAY);
      return choiceQuestion(`When do you ${action}?`, part, ['morning', 'afternoon', 'night']);
    }
    if (kind === 'count') {
      const [what, n] = choose([['days are in a week', 7], ['months are in a year', 12], ['hours are in a day', 24]]);
      return makeNumericQuestion(`How many ${what}?`, n, { extras: [n - 1, n + 1, n === 12 ? 10 : n === 7 ? 5 : 12] });
    }
    const events = choose(SEQUENCES);
    const q = choiceQuestion(`Which happens ${kind}?`, kind === 'first' ? events[0] : events[2], events.filter((_, i) => i !== (kind === 'first' ? 0 : 2)), { simple: false });
    q.keyExtra = [...events].sort().join('|');
    return q;
  }

  // ----- 2D shapes -----
  const SHAPE_FIGURE = {
    circle: { type: 'circle' }, square: { type: 'polygon', sides: 4 }, triangle: { type: 'polygon', sides: 3 },
    rectangle: { type: 'rect' }, pentagon: { type: 'polygon', sides: 5 }, hexagon: { type: 'polygon', sides: 6 }
  };
  const SHAPE_SIDES = { circle: 0, square: 4, triangle: 3, rectangle: 4, pentagon: 5, hexagon: 6 };
  const SHAPE_EMOJI = { circle: ['🔴', '🔵', '🟡', '🟢'], square: ['🟥', '🟦', '🟨', '🟩'], triangle: ['🔺'] };

  function makeShape2dQuestion(level) {
    const names = level === 'toddler' ? ['circle', 'square', 'triangle']
      : level === 'age4' ? ['circle', 'square', 'triangle', 'rectangle']
        : ['circle', 'square', 'triangle', 'rectangle', 'pentagon', 'hexagon'];
    const kinds = level === 'toddler' ? ['name', 'find'] : level === 'age4' ? ['name', 'find', 'sides'] : level === 'grade1' ? ['name', 'name', 'corners'] : ['name', 'sides', 'corners'];
    const kind = choose(kinds);
    const s = choose(names);
    let q;
    if (kind === 'find') {
      const f = choose(['circle', 'square', 'triangle']);
      const others = shuffledCopy(['circle', 'square', 'triangle'].filter(x => x !== f)).map(x => choose(SHAPE_EMOJI[x]));
      q = choiceQuestion(`Which one is a ${f}?`, choose(SHAPE_EMOJI[f]), others);
    } else if (kind === 'name') {
      // A square is also a rectangle, so a square is never offered next to the word "rectangle".
      const wrong = shuffledCopy(names.filter(x => x !== s && !(s === 'square' && x === 'rectangle'))).slice(0, level === 'toddler' ? 2 : 3);
      q = choiceQuestion('What shape is this?', s, wrong, { figure: SHAPE_FIGURE[s] });
    } else if (kind === 'sides') {
      const t = choose(names.filter(x => x !== 'circle'));
      q = numQ('How many sides does this shape have?', SHAPE_SIDES[t], 0, 8, 4, { figure: SHAPE_FIGURE[t] });
    } else {
      q = numQ('How many corners does this shape have?', SHAPE_SIDES[s], 0, 8, 4, { figure: SHAPE_FIGURE[s] });
    }
    if (level === 'grade1') q.simple = false;
    return q;
  }

  // ----- positions and directions -----
  const POSITION_WORDS = ['in', 'on', 'under', 'beside'];
  const ARROWS = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
  const SCENE_ITEMS = ['🐶', '🐱', '🐟', '🦆', '🐰', '🍎', '🚗', '⭐'];

  function makePositionQuestion(level) {
    const kind = choose(level === 'toddler' ? ['where'] : level === 'age4' ? ['where', 'arrow']
      : level === 'age5' ? ['row', 'stack'] : level === 'age6' ? ['between', 'next', 'stack'] : ['arrow', 'path', 'path']);
    if (kind === 'where') {
      const rel = choose(POSITION_WORDS);
      const wrong = shuffledCopy(POSITION_WORDS.filter(w => w !== rel)).slice(0, level === 'toddler' ? 2 : 3);
      return choiceQuestion('Where is the ball?', rel, wrong, { figure: { type: 'position', rel } });
    }
    if (kind === 'arrow') {
      const dir = choose(Object.keys(ARROWS));
      const q = choiceQuestion('Which way is the arrow pointing?', dir, Object.keys(ARROWS).filter(d => d !== dir), { visual: centred([ARROWS[dir]]), visualLabel: `Arrow pointing ${dir}`, rowsOfFive: true });
      if (level === 'grade1') q.simple = false;
      return q;
    }
    const items = shuffledCopy(SCENE_ITEMS);
    if (kind === 'row' || kind === 'between' || kind === 'next') {
      const [A, B, C, D] = items;
      const visual = centred([A, B, C]);
      let q;
      if (kind === 'between') q = choiceQuestion(`What is between ${A} and ${C}?`, B, [A, C, D], {});
      else if (kind === 'next') q = choiceQuestion(`What is next to ${A}?`, B, [C, D], {});
      else {
        const pos = choose(['left', 'middle', 'right']);
        q = choiceQuestion(`Which one is ${pos === 'middle' ? 'in the middle' : 'on the ' + pos}?`, pos === 'left' ? A : pos === 'right' ? C : B, [A, B, C], {});
      }
      return Object.assign(q, { visual, visualLabel: `${A} ${B} ${C} in a row`, rowsOfFive: true });
    }
    if (kind === 'stack') {
      const [X, Y, Z] = items;
      const top = Math.random() < 0.5;
      const q = choiceQuestion(`Which one is ${top ? 'on top' : 'at the bottom'}?`, top ? X : Y, [top ? Y : X, Z], {});
      return Object.assign(q, { visual: [...centred([X]), ...centred([Y])], visualLabel: `${X} above ${Y}`, rowsOfFive: true });
    }
    // path: start on one square of a row of five and move left or right
    const row = items.slice(0, 5);
    const dir = choose(['left', 'right']);
    const start = dir === 'right' ? intBetween(0, 3) : intBetween(1, 4);
    const steps = intBetween(1, dir === 'right' ? 4 - start : start);
    const end = row[dir === 'right' ? start + steps : start - steps];
    const q = choiceQuestion(`You start at ${row[start]}. Move ${steps} step${steps > 1 ? 's' : ''} to the ${dir}. Where do you stop?`, end, row.filter(x => x !== end).slice(0, 3),
      { visual: row, visualLabel: `A row of five: ${row.join(' ')}`, rowsOfFive: true, simple: false });
    return q;
  }

  // ----- data and picture displays -----
  const PETS = ['Dog', 'Cat', 'Fish', 'Bird', 'Rabbit'];
  function makeDataQuestion(level) {
    if (level === 'grade1') {
      const kind = choose(['tally', 'most', 'fewest', 'diff', 'total']);
      if (kind === 'tally') {
        const n = intBetween(1, 20);
        const q = makeNumericQuestion('Count the tally marks. How many are there?', n, { extras: [Math.floor(n / 5) * 4 + (n % 5), n + Math.floor(n / 5)] });
        q.figure = { type: 'tally', count: n };
        return q;
      }
      const [p1, p2, p3] = shuffledCopy(PETS);
      const v = shuffledCopy(Array.from({ length: 12 }, (_, i) => i + 1)).slice(0, 3);
      const list = `Votes for favourite pet: ${p1} ${v[0]}, ${p2} ${v[1]}, ${p3} ${v[2]}.`;
      if (kind === 'most' || kind === 'fewest') {
        const target = kind === 'most' ? Math.max(...v) : Math.min(...v);
        const names = [p1, p2, p3], win = names[v.indexOf(target)];
        return choiceQuestion(`${list} Which pet got the ${kind === 'most' ? 'most' : 'fewest'} votes?`, win, names.filter(x => x !== win), { simple: false });
      }
      if (kind === 'diff') {
        const [hi, lo] = v[0] > v[1] ? [v[0], v[1]] : [v[1], v[0]];
        const winner = v[0] > v[1] ? p1 : p2, loser = v[0] > v[1] ? p2 : p1;
        return makeNumericQuestion(`${p1} got ${v[0]} votes. ${p2} got ${v[1]} votes. How many more votes did ${winner} get than ${loser}?`, hi - lo, { extras: [hi, lo, hi + lo] });
      }
      return makeNumericQuestion(`${p1} got ${v[0]} votes. ${p2} got ${v[1]} votes. How many votes altogether?`, v[0] + v[1], { extras: [v[0], v[1], Math.abs(v[0] - v[1])] });
    }
    const [A, B] = shuffledCopy(COUNT_OBJECTS);
    let a = intBetween(1, 5), b = intBetween(1, 5);
    const kinds = level === 'age5' ? ['count', 'most'] : ['count', 'most', 'diff', 'total'];
    const kind = choose(kinds);
    if (kind !== 'count' && kind !== 'total') while (a === b) b = intBetween(1, 5);
    if (kind === 'diff' && a < b) [a, b] = [b, a];
    const extra = { visual: [...rowOf(a, A.emoji), ...rowOf(b, B.emoji)], visualLabel: `${a} ${A.name}, ${b} ${B.name}`, rowsOfFive: true };
    if (kind === 'count') return numQ(`How many ${A.name} are in the picture?`, a, 1, 6, 4, extra);
    if (kind === 'most') return choiceQuestion('Which one is there more of?', a > b ? A.emoji : B.emoji, [a > b ? B.emoji : A.emoji], extra);
    if (kind === 'diff') return numQ(`How many more ${A.name} than ${B.name} are there?`, a - b, 0, 5, 4, extra);
    return numQ('How many things are in the picture altogether?', a + b, 2, 10, 4, extra);
  }

  const EARLY = {
    count: makeCountTopic, match: makeMatchQuestion, subitise: makeSubitiseQuestion, compare: makeEarlyCompare,
    sort: makeSortQuestion, patterns: makePatternQuestion, combine: () => makeStoryAddSub(5, 3), addsub: makeEarlyAddSub,
    partition: makePartitionQuestion, missing: makeMissingQuestion, sharing: makeSharingQuestion, groups: makeGroupsQuestion,
    skip: makeSkipQuestion, numbers: makeNumbersQuestion, place: makePlaceQuestion, word: makeWordQuestion,
    money: makeMoneyEarly, measure: makeMeasureQuestion, time: makeTimeQuestion, shape2d: makeShape2dQuestion,
    position: makePositionQuestion, data: makeDataQuestion
  };
  // Grade 1 topics that already existed keep their own generators (updated for Grade 1 only).
  const GRADE1_LEGACY = ['mixed', 'add', 'sub', 'compare', 'fractions', 'money', 'clock', 'shapes'];

  // ---------- Grade 1-6 arithmetic ----------
  function arithmeticQuestion(grade, topic) {
    const all = grade === 1 ? ['+', '−'] : ['+', '−', '×', '÷'];
    const ops = topic === 'add' ? ['+'] : topic === 'sub' ? ['−'] : topic === 'mul' ? ['×'] : topic === 'div' ? ['÷'] : all;
    const operator = choose(ops);
    let a, b, answer;

    // Number ranges and multiplication/division complexity increase by level.
    if (grade === 1) {
      // Within 20: sums never go above 20, differences start from 20 or less.
      if (operator === '+') { a = intBetween(0, 20); b = intBetween(0, 20 - a); answer = a + b; }
      else { a = intBetween(1, 20); b = intBetween(0, a); answer = a - b; }
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

  // Each raw question carries `topic`, the topic that generated it (also inside Mixed All Questions).
  function generateRawQuestion(difficulty, topic) {
    const [q, name] = buildRawQuestion(difficulty, topic);
    q.topic = name;
    return q;
  }

  function buildRawQuestion(difficulty, topic) {
    let name = normaliseTopic(difficulty, topic);
    const grade = isGrade(difficulty) ? gradeOf(difficulty) : 0;
    const early = grade === 0 || grade === 1;
    if (name === 'all') {
      const offered = topicsFor(difficulty).map(t => t.value).filter(v => v !== 'all');
      if (grade === 0) name = choose(offered);
      // Grade 1: every topic once, with arithmetic (Mixed arithmetic) counted twice because it is the core skill.
      else if (grade === 1) name = choose([...offered.filter(v => v !== 'add' && v !== 'sub'), 'mixed']);
      else name = choose(ALL_MIX_TOPICS.filter(t => offered.includes(t)));
    }
    if (early && EARLY[name] && (grade === 0 || !GRADE1_LEGACY.includes(name))) return [EARLY[name](difficulty), name];
    switch (name) {
      case 'tables': return [makeTablesQuestion(grade), name];
      case 'compare': return [makeCompareNumbersQuestion(grade), name];
      case 'fractions': return [makeFractionsQuestion(grade), name];
      case 'money': return [makeMoneyQuestion(grade), name];
      case 'clock': return [makeClockQuestion(grade), name];
      case 'shapes': return [makeShapesQuestion(grade), name];
      default: return [arithmeticQuestion(grade, name), name];
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
  // does not say which one), the correct answer's text, the picture of objects (`visual`) and `keyExtra`, which a
  // generator sets when the wording and correct answer alone do not tell two questions apart. Answer ORDER and wrong options are ignored,
  // and so are decorative emoji (Age 5/6 stages), so "What is 6 × 7?" generated twice with different
  // wrong answers is the same question.
  function questionKey(q) {
    return JSON.stringify([q.question, q.figure || null, q.answers[q.correct], q.visual ? q.visual.join('') : null, q.keyExtra || null]);
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
    return {
      next() {
        if (index >= order.length) {
          order = shuffledCopy(bank);
          if (order.length > 1 && order[0] === last) {
            const j = intBetween(1, order.length - 1);
            [order[0], order[j]] = [order[j], order[0]];
          }
          index = 0;
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
