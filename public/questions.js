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
    { value: 'numbers', label: 'Numbers & place value', grades: [1, 2, 3, 4, 5, 6] },
    { value: 'patterns', label: 'Patterns', grades: [2, 3, 4] },
    { value: 'data', label: 'Data', grades: [2, 3] },
    { value: 'decimals', label: 'Decimals', grades: [4, 5, 6] },
    { value: 'percentages', label: 'Percentages', grades: [5, 6] },
    { value: 'ratio', label: 'Ratio', grades: [5, 6] },
    { value: 'probability', label: 'Probability', grades: [5, 6] },
    { value: 'algebra', label: 'Algebra', grades: [6] },
    { value: 'statistics', label: 'Statistics', grades: [6] },
    // Kept for old saved games and reports; Grade 2 comparisons live inside Numbers and Fractions.
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
    const sameDigitOptions = options.sameLastDigit ? [answer + 10, answer - 10] : [];
    const extras = [...new Set([...(options.extras || []), ...sameDigitOptions].filter(v => Number.isInteger(v) && v >= 0 && v !== answer))];
    const offsets = answer > 40 ? [1, 2, 3, 5, 10, 20] : answer > 12 ? [1, 2, 3, 4, 5, 10] : [1, 2, 3, 4, 5, 6];
    const pool = [];
    offsets.forEach(n => pool.push(answer + n, answer - n));
    pool.push(...extras);
    if (options.sameLastDigit && Number.isInteger(answer)) {
      pool.push(...sameDigitOptions);
    }
    for (let i = 0; i < 12; i++) pool.push(answer + intBetween(3, 30));
    const sameDigit = answer >= 10 ? answer - 10 : answer + 10;
    const wrong = options.sameLastDigit
      ? pickWrongAnswers(answer, pool, count - 1, [sameDigit])
      : pickWithMistake(answer, pool, count - 1, extras);
    return { question: text, answers: [answer, ...wrong].map(String), correct: 0 };
  }

  // Signed choices keep negative integer facts ordered while placing the correct option randomly.
  function makeSignedNumericQuestion(text, answer, extras = []) {
    const sameDigit = answer < 0 ? answer - 10 : answer + 10;
    const pool = [...new Set([...Array.from({ length: 60 }, (_, i) => answer + i - 30), ...extras, sameDigit])].filter(value => Number.isInteger(value) && value !== answer);
    const wrong = pickWrongAnswers(answer, pool, 3, [sameDigit], intBetween(0, 3));
    const values = [...wrong, answer].sort((a, b) => a - b);
    return { question: text, answers: values.map(String), keys: values, correct: values.indexOf(answer) };
  }

  function makeDecimalQuestion(text, answer, places = 1) {
    const scale = 10 ** places, key = Math.round(answer * scale), sameDigit = key + scale * 10;
    const pool = [-20, -10, -5, -2, -1, 1, 2, 5, 10, 20].map(offset => key + offset).filter(v => v >= 0);
    pool.push(sameDigit);
    const wrong = pickWithMistake(key, pool, 3, [sameDigit]);
    const keys = [key, ...wrong];
    return { question: text, answers: keys.map(v => (v / scale).toFixed(places)), keys, correct: 0 };
  }

  // Builds a four-choice multiple-choice arithmetic question.
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
      // Decide first where the correct answer will sit (0-3 wrong answers below it), then put the
      // same-last-digit wrong answer on a side that allows that position.
      const target = intBetween(0, 3);
      let sides = sameDigit;
      if (target === 0) sides = sameDigit.filter(v => v > answer);
      if (target === 3) sides = sameDigit.filter(v => v < answer);
      if (sides.length) preferredBelow = target; else sides = sameDigit;
      const pick = choose(sides);
      must.push(pick);
      pool.push(pick);
    }
    for (let i = 0; i < 12; i++) pool.push(answer + intBetween(5, 30)); // safety net
    const wrong = pickWrongAnswers(answer, pool, 3, must, preferredBelow);
    return {
      question: `${a} ${operator} ${b} = ?`,
      answers: [answer, ...wrong].map(String),
      correct: 0
    };
  }

  // ---------- fractions ----------
  const reduceFrac = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
  const fracText = (n, d) => d === 1 ? String(n) : `${n}/${d}`;

  // Before Grade 3, keep fraction ideas in words while preserving the same questions and values.
  function fractionWords(text) {
    const names = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'] };
    return String(text).replace(/\?\/(\d+)/g, (_, bottom) => `how many ${names[Number(bottom)]?.[1] || `parts out of ${bottom}`}`).replace(/(\d+)\/(\d+)/g, (_, top, bottom) => {
      const n = Number(top), d = Number(bottom), word = names[d];
      if (!word) return `${n} part${n === 1 ? '' : 's'} out of ${d}`;
      if (n === 1) return `one ${word[0]}`;
      const numerals = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
      return `${numerals[n] || n} ${word[1]}`;
    });
  }

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

  function makeGrade2FractionsQuestion() {
    const kind = weightedChoose([['amount', 30], ['diagram', 30], ['equivalent', 20], ['compare', 20]]);
    if (kind === 'amount') {
      const denominator = choose([2, 4, 8]), whole = denominator * intBetween(2, 10);
      return Object.assign(makeNumericQuestion(`1/${denominator} of ${whole} = ?`, whole / denominator, { extras: [whole, whole - whole / denominator] }), { topic: 'fractions', kind });
    }
    if (kind === 'diagram') {
      const denominator = choose([2, 4, 8]), numerator = intBetween(1, denominator - 1);
      const options = [[1, 8], [1, 4], [3, 8], [1, 2], [5, 8], [3, 4], [7, 8]].map(([n, d]) => ({ value: n / d, text: `${n}/${d}` }));
      const correctValue = numerator / denominator, wrong = pickWrongAnswers(correctValue, options.map(o => o.value).filter(v => v !== correctValue), 3);
      const values = [correctValue, ...wrong];
      const q = { question: 'What fraction of the shape is shaded?', answers: values.map(v => options.find(o => o.value === v).text), keys: values, correct: 0 };
      q.figure = { type: 'fraction', numerator, denominator };
      q.topic = 'fractions'; q.kind = kind;
      return q;
    }
    if (kind === 'equivalent') return Object.assign(makeNumericQuestion('1/2 = ?/4', 2, { extras: [1, 3, 4] }), { topic: 'fractions', kind });
    const pairs = [['1/2', 1, 2], ['1/4', 1, 4], ['1/8', 1, 8], ['2/4', 2, 4], ['2/8', 2, 8], ['4/8', 4, 8]];
    const a = choose(pairs), b = choose(pairs);
    return Object.assign(makeCompareQuestion(`Compare: ${a[0]} ? ${b[0]}`, Math.sign(a[1] * b[2] - b[1] * a[2])), { topic: 'fractions', kind });
  }

  function makeFractionsQuestion(grade) {
    if (grade === 1) return makeGrade1FractionsQuestion();
    if (grade === 2) return makeGrade2FractionsQuestion();
    const ofAmount = (dens, maxK) => {
      const den = choose(dens);
      const num = intBetween(1, den - 1);
      const k = intBetween(2, maxK);
      const n = den * k;
      return makeNumericQuestion(`${num}/${den} of ${n} = ?`, num * k, { extras: [k, n - num * k, n] });
    };
    if (grade === 3) {
      const kind = weightedChoose([['amount', 35], ['diagram', 25], ['equivalent', 20], ['compare', 20]]);
      if (kind === 'amount') {
        const den = choose([2, 3, 4, 5, 6, 8]), num = intBetween(1, den - 1), k = intBetween(2, 10), whole = den * k;
        return Object.assign(makeNumericQuestion(`${num}/${den} of ${whole} = ?`, num * k, { extras: [k, whole - num * k, whole] }), { topic: 'fractions', kind });
      }
      if (kind === 'diagram') {
        const den = choose([2, 3, 4, 6, 8]), num = intBetween(1, den - 1);
        const choices = [2, 3, 4, 6, 8].flatMap(d => Array.from({ length: d - 1 }, (_, i) => ({ value: (i + 1) / d, text: `${i + 1}/${d}` })));
        const value = num / den, wrong = pickWrongAnswers(value, choices.map(x => x.value).filter(x => x !== value), 3), values = [value, ...wrong];
        return Object.assign({ question: 'What fraction of the shape is shaded?', answers: values.map(v => choices.find(x => x.value === v).text), keys: values, correct: 0, figure: { type: 'fraction', numerator: num, denominator: den } }, { topic: 'fractions', kind });
      }
      if (kind === 'equivalent') {
        const [n, d, mult] = choose([[1, 2, 2], [1, 2, 4], [1, 3, 2], [2, 3, 2]]);
        return Object.assign(makeNumericQuestion(`${n}/${d} = ?/${d * mult}`, n * mult, { extras: [n, d * mult, n * mult + 1] }), { topic: 'fractions', kind });
      }
      const pairs = [['1/2', 1, 2], ['1/3', 1, 3], ['1/4', 1, 4], ['2/4', 2, 4], ['2/6', 2, 6], ['3/6', 3, 6], ['3/8', 3, 8], ['1/8', 1, 8]];
      const a = choose(pairs), b = choose(pairs);
      return Object.assign(makeCompareQuestion(`Compare: ${a[0]} ? ${b[0]}`, Math.sign(a[1] * b[2] - b[1] * a[2])), { topic: 'fractions', kind });
    }
    if (grade === 4) {
      const kind = weightedChoose([['equiv', 16], ['add', 16], ['sub', 12], ['amount', 12], ['unitAmount', 8], ['compare', 12], ['order', 10], ['diagram', 8], ['mixed', 6]]);
      if (kind === 'equiv') {
        const [n, d, target, answer] = choose([[2, 4, 2, 1], [2, 6, 3, 1], [4, 8, 2, 1], [3, 6, 2, 1], [1, 2, 4, 2]]);
        return Object.assign(makeNumericQuestion(`${n}/${d} = ?/${target}`, answer, { extras: [answer + 1, answer + 2, target] }), { topic: 'fractions', kind });
      }
      if (kind === 'add') {
        const d = choose([5, 8, 10]), a = intBetween(1, d - 2), b = intBetween(1, d - a - 1);
        return Object.assign(makeFractionQuestion(`${a}/${d} + ${b}/${d} = ? (simplest form)`, [a + b, d], [[a + b, d + d]]), { topic: 'fractions', kind });
      }
      if (kind === 'sub') {
        const d = choose([5, 8, 10]), a = intBetween(2, d - 1), b = intBetween(1, a - 1);
        return Object.assign(makeFractionQuestion(`${a}/${d} − ${b}/${d} = ? (simplest form)`, [a - b, d], [[a + b, d]]), { topic: 'fractions', kind });
      }
      if (kind === 'amount' || kind === 'unitAmount') {
        const d = choose([2, 3, 4, 5, 8, 10]), numerator = kind === 'unitAmount' ? 1 : intBetween(1, d - 1), groups = intBetween(2, 8), whole = d * groups;
        return Object.assign(makeNumericQuestion(`${numerator}/${d} of ${whole} = ?`, numerator * groups, { extras: [groups, whole - numerator * groups, whole] }), { topic: 'fractions', kind });
      }
      if (kind === 'compare') {
        const pairs = [['1/2', 1, 2], ['2/3', 2, 3], ['3/4', 3, 4], ['3/8', 3, 8], ['5/8', 5, 8], ['7/10', 7, 10]], a = choose(pairs), b = choose(pairs);
        return Object.assign(makeCompareQuestion(`Compare: ${a[0]} ? ${b[0]}`, Math.sign(a[1] * b[2] - b[1] * a[2])), { topic: 'fractions', kind });
      }
      if (kind === 'order') {
        const d = choose([4, 5, 8, 10]), nums = shuffledCopy([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => n < d)).slice(0, 3).sort((a, b) => a - b), answer = nums.map(n => `${n}/${d}`).join(', ');
        const wrong = [`${nums[2]}/${d}, ${nums[1]}/${d}, ${nums[0]}/${d}`, `${nums[1]}/${d}, ${nums[0]}/${d}, ${nums[2]}/${d}`, `${nums[0]}/${d}, ${nums[2]}/${d}, ${nums[1]}/${d}`];
        return Object.assign(textChoices(answer, wrong), { question: `Order from smallest to largest: ${shuffledCopy(nums).map(n => `${n}/${d}`).join(', ')}.`, topic: 'fractions', kind });
      }
      if (kind === 'diagram') {
        const d = choose([2, 3, 4, 5, 6, 8, 10]), numerator = intBetween(1, d - 1), options = [2, 3, 4, 5, 6, 8, 10].flatMap(den => Array.from({ length: den - 1 }, (_, i) => ({ value: (i + 1) / den, text: `${i + 1}/${den}` })));
        const value = numerator / d, values = [value, ...pickWrongAnswers(value, options.map(x => x.value).filter(x => x !== value), 3)];
        return Object.assign({ question: 'What fraction is shown?', answers: values.map(v => options.find(x => x.value === v).text), keys: values, correct: 0, figure: { type: 'fraction-bar', whole: 0, numerator, denominator: d } }, { topic: 'fractions', kind });
      }
      const whole = choose([1, 2]), numerator = choose([1, 2, 3]), denominator = choose([4, 5, 8]);
      return Object.assign(makeNumericQuestion(`${whole} ${numerator}/${denominator} = ?/${denominator}`, whole * denominator + numerator, { extras: [whole * denominator, whole * denominator + numerator - 1, numerator] }), { topic: 'fractions', kind });
    }
    if (grade === 5) {
      const kind = weightedChoose([['add', 16], ['sub', 14], ['amount', 16], ['equivalent', 12], ['simplify', 12], ['multiplyWhole', 12], ['compare', 10], ['compareFractions', 8]]);
      if (kind === 'amount') return Object.assign(ofAmount([3, 4, 5, 6, 8, 10, 12], 12), { topic: 'fractions', kind });
      if (kind === 'equivalent') {
        const [n, d, multiplier] = choose([[3, 4, 2], [2, 5, 2], [5, 6, 2], [3, 8, 2]]);
        return Object.assign(makeNumericQuestion(`${n}/${d} = ?/${d * multiplier}`, n * multiplier, { extras: [n, d * multiplier, n * multiplier + 1] }), { topic: 'fractions', kind });
      }
      if (kind === 'simplify') {
        const [n, d] = choose([[6, 8], [10, 15], [12, 18], [9, 12], [15, 20]]);
        return Object.assign(makeFractionQuestion(`${n}/${d} = ? (simplest form)`, [n, d]), { topic: 'fractions', kind });
      }
      if (kind === 'multiplyWhole') {
        const [n, d] = choose([[1, 2], [1, 3], [2, 3], [3, 4], [2, 5]]), whole = choose([2, 3, 4, 6]);
        return Object.assign(makeFractionQuestion(`${n}/${d} × ${whole} = ? (simplest form)`, [n * whole, d]), { topic: 'fractions', kind });
      }
      if (kind === 'compare') return Object.assign(makeDecimalFractionCompare(5), { topic: 'fractions', kind });
      if (kind === 'compareFractions') {
        const pairs = [[1, 2], [2, 3], [3, 4], [3, 8], [5, 8], [7, 10], [4, 5]];
        const [a, b] = choose(pairs), [c, d] = choose(pairs);
        return Object.assign(makeCompareQuestion(`Compare: ${a}/${b} ? ${c}/${d}`, Math.sign(a * d - c * b)), { topic: 'fractions', kind });
      }
      // The unlike denominators are compatible (one divides the other), and results stay below one.
      for (let tries = 0; tries < 200; tries++) {
        const b = choose([2, 3, 4, 5]), multiplier = intBetween(2, 4), d = b * multiplier;
        const a = intBetween(1, b - 1), c = intBetween(1, d - 1), total = a * multiplier + c;
        if (kind === 'add' && total < d) return Object.assign(makeFractionQuestion(`${a}/${b} + ${c}/${d} = ? (simplest form)`, [total, d], [[a + c, b + d]]), { topic: 'fractions', kind });
        const difference = a * multiplier - c;
        if (kind === 'sub' && difference > 0) return Object.assign(makeFractionQuestion(`${a}/${b} − ${c}/${d} = ? (simplest form)`, [difference, d], [[Math.abs(a - c), Math.abs(b - d) || d]]), { topic: 'fractions', kind });
      }
      return Object.assign(ofAmount([3, 4, 5, 6, 8, 10, 12], 12), { topic: 'fractions', kind: 'amount' });
    }
    // Grade 6
    const kind = weightedChoose([['mulFractions', 12], ['divWhole', 10], ['multiplyWhole', 14], ['addUnlike', 14], ['subtractUnlike', 14], ['simplify', 12], ['compareFractions', 12], ['compareDecimalFraction', 12], ['howMany', 10]]);
    if (kind === 'compareDecimalFraction') return Object.assign(makeDecimalFractionCompare(6), { topic: 'fractions', kind });
    if (kind === 'mulFractions') {
      const b = intBetween(2, 9), d = intBetween(2, 9);
      const a = intBetween(1, b - 1), c = intBetween(1, d - 1);
      return Object.assign(makeFractionQuestion(`${a}/${b} × ${c}/${d} = ? (simplest form)`, [a * c, b * d], [[a + c, b + d]]), { topic: 'fractions', kind });
    }
    if (kind === 'divWhole') {
      const b = intBetween(2, 9), a = intBetween(1, b - 1), w = intBetween(2, 6);
      return Object.assign(makeFractionQuestion(`${a}/${b} ÷ ${w} = ? (simplest form)`, [a, b * w], [[a * w, b]]), { topic: 'fractions', kind });
    }
    if (kind === 'multiplyWhole') {
      const [n, d] = choose([[2, 3], [3, 4], [1, 2], [3, 8]]), whole = choose([2, 3, 4, 6]);
      return Object.assign(makeFractionQuestion(`${n}/${d} × ${whole} = ? (simplest form)`, [n * whole, d]), { topic: 'fractions', kind });
    }
    if (kind === 'simplify') {
      const [n, d] = choose([[12, 18], [15, 20], [14, 21], [18, 24], [16, 20]]);
      return Object.assign(makeFractionQuestion(`${n}/${d} = ? (simplest form)`, [n, d]), { topic: 'fractions', kind });
    }
    if (kind === 'compareFractions') {
      const pairs = [[1, 2], [2, 3], [3, 4], [3, 8], [5, 8], [7, 10], [4, 5], [5, 6]];
      const [a, b] = choose(pairs), [c, d] = choose(pairs);
      return Object.assign(makeCompareQuestion(`Compare: ${a}/${b} ? ${c}/${d}`, Math.sign(a * d - c * b)), { topic: 'fractions', kind });
    }
    if (kind === 'howMany') {
      const d = intBetween(2, 8), w = intBetween(2, 9);
      return Object.assign(makeNumericQuestion(`${w} ÷ (1/${d}) = ?`, w * d, { extras: [w, w + d, Math.max(1, Math.round(w / d))] }), { topic: 'fractions', kind });
    }
    for (let tries = 0; tries < 300; tries++) {
      const b = choose([2, 3, 4, 5, 6]), multiplier = intBetween(2, 4), d = b * multiplier;
      const a = intBetween(1, b - 1), c = intBetween(1, d - 1), total = a * multiplier + c, difference = a * multiplier - c;
      if (kind === 'addUnlike' && total < d) return Object.assign(makeFractionQuestion(`${a}/${b} + ${c}/${d} = ? (simplest form)`, [total, d], [[a + c, b + d]]), { topic: 'fractions', kind });
      if (kind === 'subtractUnlike' && difference > 0) return Object.assign(makeFractionQuestion(`${a}/${b} − ${c}/${d} = ? (simplest form)`, [difference, d], [[Math.abs(a - c), Math.abs(b - d) || d]]), { topic: 'fractions', kind });
    }
    return Object.assign(makeFractionQuestion(kind === 'subtractUnlike' ? '3/4 − 1/2 = ? (simplest form)' : '1/2 + 1/4 = ? (simplest form)', kind === 'subtractUnlike' ? [1, 4] : [3, 4]), { topic: 'fractions', kind });
  }

  // ---------- times tables ----------
  function makeGrade2FactQuestion(operator = null) {
    const divisor = choose([2, 5, 10]), factor = intBetween(2, 10), product = divisor * factor;
    const kind = operator === '×'
      ? weightedChoose([['multiply', 65], ['missingFactor', 35]])
      : operator === '÷'
        ? weightedChoose([['divide', 65], ['missingDivisor', 35]])
        : weightedChoose([['multiply', 40], ['divide', 25], ['missingFactor', 20], ['missingDivisor', 15]]);
    if (kind === 'multiply') {
      const q = makeQuestion(factor, '×', divisor, product);
      if (product <= 30) q.picture = { groups: [{ emoji: '●', rows: Array.from({ length: factor }, () => 'X'.repeat(divisor)) }], label: `An array with ${factor} rows of ${divisor}`, key: `array:${factor}:${divisor}` };
      return q;
    }
    if (kind === 'divide') return makeQuestion(product, '÷', divisor, factor);
    if (kind === 'missingFactor') return makeNumericQuestion(`? × ${divisor} = ${product}`, factor, { extras: [divisor, product - divisor] });
    return makeNumericQuestion(`${product} ÷ ? = ${factor}`, divisor, { extras: [factor, product - factor] });
  }

  function makeGrade2ArithmeticQuestion(operator) {
    const kind = weightedChoose([['twoDigit', 45], ['friendlyThreeDigit', 25], ['missing', 22], ['inverse', 8]]);
    if (kind === 'friendlyThreeDigit') {
      if (operator === '+') {
        const a = intBetween(1, 7) * 100, b = intBetween(1, 9) * 10;
        return makeQuestion(a, '+', b, a + b);
      }
      const a = intBetween(3, 9) * 100, b = intBetween(1, Math.floor((a - 100) / 10)) * 10;
      return makeQuestion(a, '−', b, a - b);
    }
    if (kind === 'twoDigit') {
      if (operator === '+') {
        const a = intBetween(20, 79), b = intBetween(10, Math.min(69, 150 - a));
        return makeQuestion(a, '+', b, a + b);
      }
      const a = intBetween(40, 99), b = intBetween(10, Math.min(59, a - 10));
      return makeQuestion(a, '−', b, a - b);
    }
    if (operator === '+') {
      const a = intBetween(20, 59), b = intBetween(15, Math.min(60, 130 - a)), total = a + b;
      if (kind === 'inverse') return makeNumericQuestion(`${a} + ${b} = ${total}, so ${total} − ${a} = ?`, b, { extras: [a, total] });
      const missingFirst = Math.random() < 0.5;
      return makeNumericQuestion(missingFirst ? `? + ${b} = ${total}` : `${a} + ? = ${total}`, missingFirst ? a : b, { extras: [a, b, total] });
    }
    const a = intBetween(50, 99), b = intBetween(10, a - 10), difference = a - b;
    if (kind === 'inverse') return makeNumericQuestion(`${a} − ${b} = ${difference}, so ${difference} + ${b} = ?`, a, { extras: [b, difference] });
    return makeNumericQuestion(`${a} − ? = ${difference}`, b, { extras: [a, difference] });
  }

  function makeGrade3ArithmeticQuestion(operator) {
    const kind = weightedChoose([['friendly', 40], ['threeDigit', 25], ['missing', 20], ['inverse', 15]]);
    if (kind === 'threeDigit') {
      if (operator === '+') { const a = intBetween(1, 7) * 100 + choose([0, 20, 50]), b = choose([100, 120, 150, 200]); return makeQuestion(a, '+', b, a + b); }
      const a = choose([300, 400, 500, 600, 700, 800, 900]), b = choose([125, 150, 175, 200, 250, 300]);
      if (b >= a) return makeQuestion(a, '−', Math.floor(a / 2 / 25) * 25, a - Math.floor(a / 2 / 25) * 25);
      return makeQuestion(a, '−', b, a - b);
    }
    if (kind === 'friendly') {
      if (operator === '+') { const a = intBetween(20, 79), b = choose([10, 20, 25, 30, 40]); return makeQuestion(a, '+', b, a + b); }
      const a = intBetween(80, 199), b = choose([20, 25, 30, 40, 50]); return makeQuestion(a, '−', Math.min(b, a - 20), a - Math.min(b, a - 20));
    }
    if (operator === '+') {
      const a = intBetween(100, 350), b = choose([50, 75, 100, 125]), total = a + b;
      if (kind === 'inverse') return makeNumericQuestion(`${a} + ${b} = ${total}, so ${total} − ${a} = ?`, b, { extras: [a, total] });
      const missingFirst = Math.random() < 0.5;
      return makeNumericQuestion(missingFirst ? `? + ${b} = ${total}` : `${a} + ? = ${total}`, missingFirst ? a : b, { extras: [a, b, total] });
    }
    const a = intBetween(200, 600), b = choose([50, 75, 100, 125]), difference = a - b;
    if (kind === 'inverse') return makeNumericQuestion(`${a} − ${b} = ${difference}, so ${difference} + ${b} = ?`, a, { extras: [b, difference] });
    return makeNumericQuestion(`${a} − ? = ${difference}`, b, { extras: [a, difference] });
  }

  function makeGrade4ArithmeticQuestion(operator) {
    const numeric = (text, answer, extras = []) => makeNumericQuestion(text, answer, { sameLastDigit: true, extras });
    if (operator === '+' || operator === '−') {
      const kind = weightedChoose([['friendly', 45], ['missing', 30], ['inverse', 25]]);
      if (operator === '+') {
        const a = intBetween(120, 650), b = intBetween(100, Math.min(300, 950 - a)), total = a + b;
        if (kind === 'friendly') return makeQuestion(a, '+', b, total, true);
        if (kind === 'inverse') return numeric(`${a} + ${b} = ${total}, so ${total} − ${a} = ?`, b, [b - 10, a, total]);
        const missingFirst = Math.random() < 0.5;
        return numeric(missingFirst ? `□ + ${b} = ${total}` : `${a} + □ = ${total}`, missingFirst ? a : b, [a - 10, b + 10, b - 10]);
      }
      const a = intBetween(300, 999), b = intBetween(100, Math.min(600, a - 100)), difference = a - b;
      if (kind === 'friendly') return makeQuestion(a, '−', b, difference, true);
      if (kind === 'inverse') return numeric(`${a} − ${b} = ${difference}, so ${difference} + ${b} = ?`, a, [a - 10, b, difference]);
      return numeric(`${a} − □ = ${difference}`, b, [b - 10, a, difference]);
    }
    if (operator === '×') {
      const kind = weightedChoose([['multiply', 65], ['missingFactor', 35]]), factor = intBetween(2, 6), value = intBetween(12, 35), product = value * factor;
      if (kind === 'missingFactor') return numeric(`□ × ${factor} = ${product}`, value, [value - 10, factor, product - factor]);
      return makeQuestion(value, '×', factor, product, true);
    }
    const kind = weightedChoose([['divide', 65], ['missingDivisor', 35]]), divisor = intBetween(2, 9), quotient = intBetween(12, 24), dividend = divisor * quotient;
    if (kind === 'missingDivisor') return numeric(`${dividend} ÷ □ = ${quotient}`, divisor, [divisor - 1, quotient, dividend - quotient]);
    return makeQuestion(dividend, '÷', divisor, quotient, true);
  }

  function makeGrade3FactQuestion(operator = null, fromTables = false) {
    let a = intBetween(2, 10), b = intBetween(2, 10);
    const kind = fromTables ? weightedChoose([['multiply', 35], ['divide', 22], ['missingFactor', 18], ['missingDivisor', 15], ['byTen', 10]])
      : operator === '×' ? weightedChoose([['multiply', 50], ['missingFactor', 25], ['twoDigit', 15], ['byTen', 10]])
      : operator === '÷' ? weightedChoose([['divide', 55], ['missingDivisor', 25], ['missingFactor', 20]])
        : weightedChoose([['multiply', 30], ['divide', 22], ['missingFactor', 18], ['missingDivisor', 10], ['twoDigit', 10], ['byTen', 10]]);
    if (kind === 'byTen') b = 10;
    const product = a * b;
    let q;
    if (kind === 'divide') q = makeQuestion(product, '÷', a, b);
    else if (kind === 'missingDivisor') q = makeNumericQuestion(`${product} ÷ ? = ${b}`, a, { extras: [b, product - b] });
    else if (kind === 'missingFactor') q = makeNumericQuestion(`${a} × ? = ${product}`, b, { extras: [a, product - a] });
    else if (kind === 'twoDigit') { const value = intBetween(21, 29), factor = choose([2, 3, 4]); q = makeQuestion(value, '×', factor, value * factor); }
    else q = makeQuestion(a, '×', b, product);
    if (kind === 'multiply' && Number(q.answers[q.correct]) <= 30) q.picture = { groups: [{ emoji: '●', rows: Array.from({ length: a }, () => 'X'.repeat(b)) }], label: `An array with ${a} rows of ${b}`, key: `array:${a}:${b}` };
    if (fromTables) Object.assign(q, { topic: 'tables', kind });
    return q;
  }

  function makeTablesQuestion(grade) {
    if (grade === 2) return makeGrade2FactQuestion();
    if (grade === 3) return makeGrade3FactQuestion(null, true);
    let a, b;
    if (grade === 2) { a = intBetween(2, 10); b = choose([2, 5, 10]); }
    else if (grade === 3) { a = intBetween(2, 10); b = intBetween(2, 10); }
    else if (grade === 4) { a = intBetween(2, 10); b = intBetween(2, 10); }
    else { a = intBetween(2, 12); b = intBetween(6, 12); }
    if (Math.random() < 0.5) [a, b] = [b, a];
    const product = a * b;
    const kind = choose(['mul', 'mul', 'div', 'missing']);
    if (kind === 'div') return makeQuestion(product, '÷', a, b, grade >= 4);
    if (kind === 'missing') return makeNumericQuestion(`${a} × ? = ${product}`, b, { sameLastDigit: grade >= 4, extras: [a, product - a] });
    return makeQuestion(a, '×', b, product, grade >= 4);
  }

  function makeGrade2NumbersQuestion() {
    const kind = weightedChoose([['recognise', 16], ['expanded', 18], ['missingPlace', 16], ['compare', 18], ['order', 12], ['sequence', 20]]);
    const h = intBetween(1, 9), t = intBetween(1, 9), o = intBetween(1, 9), number = h * 100 + t * 10 + o;
    const tier = number < 300 ? 1 : number < 700 ? 2 : 3;
    const markNumber = q => Object.assign(q, { topic: 'numbers', kind, tier });
    if (kind === 'recognise') {
      const n = Math.random() < 0.5 ? intBetween(2, 9) * 10 + intBetween(1, 9) : number;
      const phrase = n < 100 ? `${Math.floor(n / 10)} tens and ${n % 10} ones` : `${Math.floor(n / 100)} hundreds, ${Math.floor(n / 10) % 10} tens and ${n % 10} ones`;
      const min = n < 100 ? 10 : 100, max = n < 100 ? 99 : 999;
      return markNumber({ question: `What number is ${phrase}?`, ...numberChoices(n, min, max, [n + 1, n - 1, swapDigits(n), n + 10]) });
    }
    if (kind === 'expanded') {
      const answer = `${h * 100} + ${t * 10} + ${o}`;
      return markNumber(Object.assign(textChoices(answer, [`${h * 100} + ${t} + ${o}`, `${h * 10} + ${t * 100} + ${o}`, `${h * 100} + ${t * 10} + ${o + 1}`]), { question: `${number} = ?` }));
    }
    if (kind === 'missingPlace') {
      const form = choose(['hundreds', 'tens']);
      const text = form === 'hundreds' ? `□00 + ${t * 10} + ${o} = ${number}` : `${h * 100} + □0 + ${o} = ${number}`;
      return markNumber({ question: text, ...numberChoices(form === 'hundreds' ? h : t, 0, 9, [h + 1, t + 1, 0]) });
    }
    if (kind === 'compare') {
      let a = intBetween(100, 999), b = Math.random() < 0.15 ? a : intBetween(100, 999);
      if (Math.random() < 0.5) [a, b] = [b, a];
      return markNumber(makeCompareQuestion(`Compare: ${a} ? ${b}`, Math.sign(a - b)));
    }
    if (kind === 'order') {
      const a = intBetween(110, 600), b = a + intBetween(5, 40), c = b + intBetween(5, 40);
      return markNumber(Object.assign(textChoices(`${a}, ${b}, ${c}`, [`${c}, ${b}, ${a}`, `${b}, ${a}, ${c}`, `${a}, ${c}, ${b}`]), { question: 'Order from smallest to largest.' }));
    }
    const step = choose([1, 2, 5, 10, 20, 50]), start = intBetween(120, 850 - step * 4), hole = intBetween(1, 3);
    const sequence = Array.from({ length: 5 }, (_, i) => start + i * step);
    const answer = sequence[hole]; sequence[hole] = '?';
    return markNumber({ question: 'What number is missing?', numbers: sequence.map(String), ...numberChoices(answer, 1, 999, [answer - step, answer + step]) });
  }

  function makeGrade2DataQuestion() {
    const labels = ['Books', 'Games', 'Balls'], values = shuffledCopy([2, 3, 4, 5, 6, 7, 8]).slice(0, 3);
    const kind = weightedChoose([['read', 30], ['most', 25], ['total', 25], ['difference', 20]]);
    const figure = { type: 'bar-chart', labels, values };
    if (kind === 'read') {
      const i = intBetween(0, labels.length - 1);
      return Object.assign(makeNumericQuestion(`How many ${labels[i].toLowerCase()}?`, values[i]), { figure, topic: 'data', kind });
    }
    if (kind === 'most') {
      const i = values.indexOf(Math.max(...values));
      return Object.assign(textChoices(labels[i], labels.filter((_, j) => j !== i)), { question: 'Which has the most?', figure, topic: 'data', kind });
    }
    if (kind === 'difference') {
      const hi = values.indexOf(Math.max(...values)), lo = values.indexOf(Math.min(...values));
      return Object.assign(makeNumericQuestion(`How many more ${labels[hi].toLowerCase()} than ${labels[lo].toLowerCase()}?`, values[hi] - values[lo]), { figure, topic: 'data', kind });
    }
    return Object.assign(makeNumericQuestion('How many items altogether?', values.reduce((a, b) => a + b, 0)), { figure, topic: 'data', kind });
  }

  function makeGrade2PatternQuestion() {
    const q = makePatternQuestion();
    delete q.simple;
    return q;
  }

  function makeGrade3NumbersQuestion() {
    const kind = weightedChoose([['recognise', 12], ['expanded', 16], ['missingPlace', 12], ['compare', 12], ['order', 10], ['round10', 14], ['round100', 14], ['sequence', 10]]);
    const mark = q => Object.assign(q, { topic: 'numbers', kind });
    if (kind === 'recognise') {
      const n = Math.random() < 0.45 ? intBetween(1000, 9999) : intBetween(100, 999);
      const units = n >= 1000 ? ['thousand', 'hundred', 'ten', 'one'] : ['hundred', 'ten', 'one'];
      const digits = String(n).split('').map(Number), placeWords = digits.map((d, i) => `${d} ${units[i]}${d === 1 ? '' : 's'}`);
      const prompt = `What number is ${placeWords.join(', ')}?`;
      return mark({ question: prompt, ...numberChoices(n, n < 1000 ? 100 : 1000, n < 1000 ? 999 : 9999, [n + 1, n - 1, n + 10]) });
    }
    if (kind === 'expanded') {
      const digits = [intBetween(1, 9), intBetween(0, 9), intBetween(0, 9), intBetween(0, 9)];
      if (digits.filter(Boolean).length < 2) digits[2] = 1;
      const n = digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3], parts = digits.map((d, i) => d * [1000, 100, 10, 1][i]).filter(Boolean), answer = parts.join(' + ');
      const wrong = [`${parts[0] + 10} + ${parts.slice(1).join(' + ')}`, [...parts].reverse().join(' + '), `${digits[0] * 100} + ${parts.slice(1).join(' + ')}`];
      return mark(Object.assign(textChoices(answer, wrong), { question: `${n.toLocaleString('en-AU')} = ?` }));
    }
    if (kind === 'missingPlace') {
      const a = intBetween(1, 9), b = intBetween(1, 9), c = intBetween(1, 9), d = intBetween(1, 9), place = choose([0, 1, 2, 3]), digits = [a, b, c, d], values = digits.map((x, i) => x * [1000, 100, 10, 1][i]), n = values.reduce((x, y) => x + y, 0), answer = values[place];
      const parts = values.map((v, i) => i === place ? '□' : String(v));
      return mark({ question: `${parts.join(' + ')} = ${n}`, ...numberChoices(answer, answer < 10 ? 1 : answer < 100 ? 10 : answer < 1000 ? 100 : 1000, answer < 10 ? 9 : answer < 100 ? 90 : answer < 1000 ? 900 : 9000, [answer + (answer < 10 ? 1 : answer < 100 ? 10 : answer < 1000 ? 100 : 1000)]) });
    }
    if (kind === 'compare') {
      if (Math.random() < 0.2) {
        const a = intBetween(100, 9999), b = Math.random() < 0.15 ? a : intBetween(100, 9999);
        return mark(makeCompareQuestion(`Compare: ${a} ? ${b}`, Math.sign(a - b)));
      }
      const [lo, hi] = choose([[2, 20], [10, 80], [30, 250]]);
      const addSide = (target) => {
        if (target === undefined) { const x = intBetween(lo, hi), y = intBetween(lo, hi); return [`${x} + ${y}`, x + y]; }
        const x = intBetween(Math.max(1, Math.floor(target / 4)), Math.max(1, target - 1));
        return [`${x} + ${target - x}`, target];
      };
      const subSide = (target) => {
        if (target === undefined) { const y = intBetween(lo, hi), x = y + intBetween(lo, hi); return [`${x} − ${y}`, x - y]; }
        const y = intBetween(lo, hi);
        return [`${target + y} − ${y}`, target];
      };
      const mode = weightedChoose([['addAdd', 28], ['subSub', 26], ['addSub', 28], ['equal', 18]]);
      let left, right;
      if (mode === 'addAdd') { left = addSide(); right = addSide(); }
      else if (mode === 'subSub') { left = subSide(); right = subSide(); }
      else if (mode === 'addSub') {
        if (Math.random() < 0.5) { left = addSide(); right = subSide(); }
        else { left = subSide(); right = addSide(); }
      } else {
        const target = intBetween(lo * 2, hi * 2);
        left = (Math.random() < 0.5 ? addSide : subSide)(target);
        right = (Math.random() < 0.5 ? addSide : subSide)(target);
      }
      return mark(makeCompareQuestion(`Compare: ${left[0]} ? ${right[0]}`, Math.sign(left[1] - right[1])));
    }
    if (kind === 'order') {
      const a = intBetween(100, 700), b = a + intBetween(10, 80), c = b + intBetween(10, 80);
      return mark(Object.assign(textChoices(`${a}, ${b}, ${c}`, [`${c}, ${b}, ${a}`, `${b}, ${a}, ${c}`, `${a}, ${c}, ${b}`]), { question: 'Order from smallest to largest.' }));
    }
    if (kind === 'round10' || kind === 'round100') {
      const step = kind === 'round10' ? 10 : 100, n = intBetween(1, kind === 'round10' ? 999 : 9999), answer = Math.round(n / step) * step;
      return mark(Object.assign(makeNumericQuestion(`${n.toLocaleString('en-AU')} rounded to the nearest ${step} = ?`, answer, { extras: [answer - step, answer + step, Math.floor(n / step) * step] }), { topic: 'numbers', kind }));
    }
    const step = choose([25, 50, 100, 200, 500]), start = intBetween(100, 9000 - step * 4), hole = intBetween(1, 3);
    const seq = Array.from({ length: 5 }, (_, i) => start + i * step), answer = seq[hole]; seq[hole] = '?';
    return mark({ question: 'What number is missing?', numbers: seq.map(String), ...numberChoices(answer, 1, 10000, [answer - step, answer + step]) });
  }

  function makeGrade3PatternQuestion() {
    const start = choose([2, 3, 4, 5, 10]), factor = choose([2, 3]), hole = intBetween(1, 3);
    const seq = Array.from({ length: 5 }, (_, i) => start * factor ** i), answer = seq[hole]; seq[hole] = '?';
    return Object.assign({ question: 'What number is missing?', numbers: seq.map(String), ...numberChoices(answer, 1, Math.max(1000, answer * 2), [answer / factor, answer * factor]) }, { topic: 'patterns', kind: 'multiplySequence' });
  }

  function makeGrade3DataQuestion() {
    const labels = ['Apples', 'Pears', 'Plums', 'Bananas'], values = shuffledCopy([3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4);
    const kind = weightedChoose([['read', 25], ['most', 25], ['total', 25], ['difference', 25]]), figure = { type: 'bar-chart', labels, values };
    if (kind === 'read') { const i = intBetween(0, 3); return Object.assign(makeNumericQuestion(`How many ${labels[i].toLowerCase()}?`, values[i]), { figure, topic: 'data', kind }); }
    if (kind === 'most') { const i = values.indexOf(Math.max(...values)); return Object.assign(textChoices(labels[i], labels.filter((_, j) => j !== i)), { question: 'Which has the most?', figure, topic: 'data', kind }); }
    if (kind === 'difference') { return Object.assign(makeNumericQuestion('How many more are there in the largest group than the smallest?', Math.max(...values) - Math.min(...values)), { figure, topic: 'data', kind }); }
    return Object.assign(makeNumericQuestion('How many items altogether?', values.reduce((a, b) => a + b, 0)), { figure, topic: 'data', kind });
  }

  function makeGrade4NumbersQuestion() {
    const kind = weightedChoose([['placeValue', 18], ['expanded', 12], ['round', 18], ['estimate', 12], ['factors', 16], ['multiple', 12], ['prime', 12]]);
    const mark = q => Object.assign(q, { topic: 'numbers', kind });
    if (kind === 'placeValue') {
      const n = intBetween(1000, 9999), digits = String(n).split('').map(Number), units = ['thousands', 'hundreds', 'tens', 'ones'];
      return mark({ question: `What number is ${digits.map((d, i) => `${d} ${units[i]}`).join(', ')}?`, ...numberChoices(n, 1000, 9999, [n + 10, n - 10]) });
    }
    if (kind === 'expanded') {
      const digits = [intBetween(1, 9), intBetween(1, 9), intBetween(0, 9), intBetween(0, 9)], n = digits.reduce((s, d, i) => s + d * [1000, 100, 10, 1][i], 0), parts = digits.map((d, i) => d * [1000, 100, 10, 1][i]).filter(Boolean), answer = parts.join(' + ');
      return mark(Object.assign(textChoices(answer, [`${parts[0] + 10} + ${parts.slice(1).join(' + ')}`, [...parts].reverse().join(' + '), `${digits[0] * 100} + ${parts.slice(1).join(' + ')}`]), { question: `${n.toLocaleString('en-AU')} = ?` }));
    }
    if (kind === 'round') {
      const step = choose([10, 100, 1000]), n = intBetween(1000, 9999), answer = Math.round(n / step) * step;
      return mark(makeNumericQuestion(`${n.toLocaleString('en-AU')} rounded to the nearest ${step} = ?`, answer, { extras: [answer - step, answer + step] }));
    }
    if (kind === 'estimate') {
      const a = intBetween(120, 780), b = intBetween(120, 780), answer = Math.round(a / 100) * 100 + Math.round(b / 100) * 100;
      return mark(makeNumericQuestion(`Estimate ${a} + ${b} by rounding each to the nearest 100.`, answer, { extras: [a + b, Math.round((a + b) / 100) * 100] }));
    }
    if (kind === 'factors') {
      const target = choose([24, 30, 36]), factors = Array.from({ length: target }, (_, i) => i + 1).filter(v => target % v === 0), answer = factors.join(', ');
      const wrong = [factors.slice(0, -1).join(', '), [...factors, target + 1].join(', '), factors.map(v => v === 6 ? 5 : v).join(', ')];
      return mark(Object.assign(textChoices(answer, wrong), { question: `Which list shows all factors of ${target}?` }));
    }
    if (kind === 'multiple') {
      const base = choose([4, 5, 6, 7, 8, 9]), answer = Array.from({ length: 5 }, (_, i) => base * (i + 1)).join(', ');
      const wrong = [Array.from({ length: 5 }, (_, i) => base * (i + 2)).join(', '), Array.from({ length: 5 }, (_, i) => base + i * (base + 1)).join(', '), Array.from({ length: 5 }, (_, i) => base * (i + 1) + 1).join(', ')];
      return mark(Object.assign(textChoices(answer, wrong), { question: `First five multiples of ${base}:` }));
    }
    const n = choose([17, 19, 21, 23, 25, 27, 29, 31, 33, 37, 39, 41]), answer = [21, 25, 27, 33, 39].includes(n) ? 'composite' : 'prime';
    return mark(Object.assign(textChoices(answer, [answer === 'prime' ? 'composite' : 'prime'], 2), { question: `Is ${n} prime or composite?` }));
  }

  function makeGrade4PatternQuestion() {
    const kind = choose(['interval', 'multiply']), hole = intBetween(1, 3);
    const start = kind === 'interval' ? intBetween(30, 250) : choose([2, 3, 4, 5]);
    const step = kind === 'interval' ? choose([4, 6, 10, 25, 50, 100]) : choose([2, 3]);
    const values = Array.from({ length: 5 }, (_, i) => kind === 'interval' ? start + i * step : start * step ** i), answer = values[hole]; values[hole] = '?';
    return Object.assign({ question: 'What number is missing?', numbers: values.map(String), ...numberChoices(answer, 1, Math.max(1000, answer * 2), kind === 'interval' ? [answer - step, answer + step] : [answer / step, answer * step]) }, { topic: 'patterns', kind });
  }

  function makeGrade4DecimalsQuestion() {
    const kind = weightedChoose([['tenths', 15], ['hundredths', 15], ['compare', 20], ['add', 20], ['subtract', 15], ['fractionDecimal', 15]]);
    if (kind === 'tenths') { const digit = intBetween(1, 9); return Object.assign(makeNumericQuestion(`0.${digit} = ?/10`, digit, { extras: [digit + 1, digit - 1, 10 - digit] }), { topic: 'decimals', kind }); }
    if (kind === 'hundredths') { const value = intBetween(10, 99); return Object.assign(makeNumericQuestion(`0.${String(value).padStart(2, '0')} = ?/100`, value, { extras: [value + 1, value - 1, Math.floor(value / 10)] }), { topic: 'decimals', kind }); }
    if (kind === 'compare') {
      const pairs = [[0.7, 0.65], [0.4, 0.35], [0.25, 0.5], [0.8, 0.75], [0.6, 0.6]], [a, b] = choose(pairs);
      return Object.assign(makeCompareQuestion(`Compare: ${a} ? ${b}`, Math.sign(a - b)), { topic: 'decimals', kind });
    }
    if (kind === 'fractionDecimal') {
      const [fraction, value] = choose([['1/2', 0.5], ['1/4', 0.25], ['3/4', 0.75], ['1/10', 0.1]]);
      return Object.assign(makeDecimalQuestion(`${fraction} = ?`, value, 2), { topic: 'decimals', kind });
    }
    const a = choose(kind === 'add' ? [1.2, 1.5, 2.3, 0.7, 0.4] : [1.5, 1.8, 2.4, 0.9, 0.6]);
    const b = choose(kind === 'add' ? [0.1, 0.2, 0.3, 0.4, 0.5] : [0.1, 0.2, 0.3, 0.4]);
    const answer = Math.round((kind === 'add' ? a + b : a - b) * 10) / 10;
    return Object.assign(makeDecimalQuestion(`${a} ${kind === 'add' ? '+' : '−'} ${b} = ?`, answer, 1), { topic: 'decimals', kind });
  }

  function makeGrade5NumbersQuestion() {
    const kind = weightedChoose([['round', 14], ['estimate', 12], ['factors', 12], ['multiple', 10], ['divisible', 14], ['orderOps', 22], ['missingFactor', 16]]);
    const mark = q => Object.assign(q, { topic: 'numbers', kind });
    if (kind === 'round') {
      const step = choose([10, 100, 1000]), value = intBetween(1000, 9999), rounded = Math.round(value / step) * step;
      return mark(makeNumericQuestion(`${value} rounded to the nearest ${step} = ?`, rounded, { extras: [rounded - step, rounded + step] }));
    }
    if (kind === 'estimate') {
      const a = intBetween(120, 780), b = intBetween(120, 780), answer = Math.round(a / 100) * 100 + Math.round(b / 100) * 100;
      return mark(makeNumericQuestion(`Estimate ${a} + ${b} by rounding each to the nearest 100.`, answer, { extras: [a + b, Math.round((a + b) / 100) * 100] }));
    }
    if (kind === 'factors') {
      const target = choose([36, 40, 48, 60]), factors = Array.from({ length: target }, (_, i) => i + 1).filter(value => target % value === 0), answer = factors.join(', ');
      const wrong = [factors.slice(0, -1).join(', '), [...factors, target + 1].join(', '), factors.slice(1).join(', ')];
      return mark(Object.assign(textChoices(answer, wrong), { question: `Which list shows all factors of ${target}?` }));
    }
    if (kind === 'multiple') {
      const base = choose([6, 7, 8, 9, 12]), answer = Array.from({ length: 5 }, (_, i) => base * (i + 1)).join(', ');
      const wrong = [Array.from({ length: 5 }, (_, i) => base * (i + 2)).join(', '), Array.from({ length: 5 }, (_, i) => base + i * (base + 1)).join(', '), Array.from({ length: 5 }, (_, i) => base * (i + 1) + 1).join(', ')];
      return mark(Object.assign(textChoices(answer, wrong), { question: `First five multiples of ${base}:` }));
    }
    if (kind === 'divisible') {
      const divisor = choose([2, 3, 4, 5, 6, 8, 9, 10]), multiplier = intBetween(2, 20), divisible = Math.random() < 0.5, value = divisible ? divisor * multiplier : divisor * multiplier + 1;
      return mark(Object.assign(textChoices(divisible ? 'yes' : 'no', [divisible ? 'no' : 'yes'], 2), { question: `Is ${value} divisible by ${divisor}?` }));
    }
    if (kind === 'orderOps') {
      const a = choose([4, 5, 6, 7, 8]), b = choose([2, 3, 4, 5]), c = choose([2, 3, 4]);
      if (Math.random() < 0.5) return mark(makeNumericQuestion(`${a} + ${b} × ${c} = ?`, a + b * c));
      return mark(makeNumericQuestion(`(${a} + ${b}) × ${c} = ?`, (a + b) * c));
    }
    const factor = choose([6, 7, 8, 9]), value = choose([9, 10, 11, 12]);
    return mark(makeNumericQuestion(`□ × ${factor} = ${value * factor}`, value, { extras: [factor, value - 1], sameLastDigit: true }));
  }

  function makeGrade5DecimalsQuestion() {
    const kind = weightedChoose([['thousandths', 12], ['compare', 14], ['order', 10], ['add', 12], ['subtract', 10], ['multiply', 12], ['divide', 10], ['fractionDecimal', 12], ['decimalFraction', 8]]);
    if (kind === 'thousandths') {
      const value = intBetween(101, 999);
      return Object.assign(makeNumericQuestion(`0.${String(value).padStart(3, '0')} = ?/1000`, value, { extras: [value - 1, value + 1, Math.floor(value / 10)] }), { topic: 'decimals', kind });
    }
    if (kind === 'compare') {
      const pairs = [[0.7, 0.65], [0.4, 0.35], [0.25, 0.5], [0.8, 0.75], [0.6, 0.6], [1.25, 1.205], [0.375, 0.4]], [a, b] = choose(pairs);
      return Object.assign(makeCompareQuestion(`Compare: ${a} ? ${b}`, Math.sign(a - b)), { topic: 'decimals', kind });
    }
    if (kind === 'order') {
      const sorted = [0.35, 0.4, 0.52], values = shuffledCopy(sorted), answer = sorted.join(', '), wrong = [`${sorted[2]}, ${sorted[1]}, ${sorted[0]}`, `${sorted[1]}, ${sorted[2]}, ${sorted[0]}`, `${sorted[2]}, ${sorted[0]}, ${sorted[1]}`];
      return Object.assign(textChoices(answer, wrong), { question: `Order from smallest to largest: ${values.join(', ')}.`, topic: 'decimals', kind });
    }
    if (kind === 'fractionDecimal') {
      const [fraction, value] = choose([['1/2', 0.5], ['1/4', 0.25], ['3/4', 0.75], ['1/5', 0.2], ['2/5', 0.4], ['1/8', 0.125], ['3/8', 0.375]]);
      return Object.assign(makeDecimalQuestion(`${fraction} = ?`, value, 3), { topic: 'decimals', kind });
    }
    if (kind === 'decimalFraction') {
      const [decimal, numerator] = choose([[0.25, 25], [0.5, 50], [0.75, 75], [0.2, 20], [0.4, 40]]);
      return Object.assign(makeNumericQuestion(`${decimal} = ?/100`, numerator, { extras: [numerator - 1, numerator + 1, numerator / 10] }), { topic: 'decimals', kind });
    }
    if (kind === 'multiply') {
      const a = choose([0.6, 1.2, 1.5, 2.4, 3.5]), b = choose([2, 3, 4]), answer = Math.round(a * b * 10) / 10;
      return Object.assign(makeDecimalQuestion(`${a} × ${b} = ?`, answer, 1), { topic: 'decimals', kind });
    }
    if (kind === 'divide') {
      const answer = choose([0.6, 0.8, 1.2, 1.5, 2.4]), divisor = choose([2, 3, 4]), dividend = Math.round(answer * divisor * 10) / 10;
      return Object.assign(makeDecimalQuestion(`${dividend} ÷ ${divisor} = ?`, answer, 1), { topic: 'decimals', kind });
    }
    const a = kind === 'add' ? choose([0.25, 0.4, 0.75, 1.25, 2.4]) : choose([1.5, 1.8, 2.4, 0.9, 0.6]);
    const b = kind === 'add' ? choose([0.1, 0.2, 0.3, 0.5]) : choose([0.1, 0.2, 0.3, 0.4]);
    const answer = Math.round((kind === 'add' ? a + b : a - b) * 100) / 100;
    return Object.assign(makeDecimalQuestion(`${a} ${kind === 'add' ? '+' : '−'} ${b} = ?`, answer, 2), { topic: 'decimals', kind });
  }

  function makeGrade5PercentQuestion() {
    const kind = weightedChoose([['ofAmount', 28], ['fraction', 16], ['decimal', 16], ['decimalToPercent', 12], ['fractionToPercent', 14], ['compare', 14]]);
    if (kind === 'ofAmount') {
      const pct = choose([10, 20, 25, 50, 75, 100]), whole = choose([20, 40, 60, 80, 100, 120]), answer = whole * pct / 100;
      return Object.assign(makeNumericQuestion(`${pct}% of ${whole} = ?`, answer, { extras: [whole - answer, pct, whole] }), { topic: 'percentages', kind });
    }
    if (kind === 'fraction') {
      const [pct, n, d] = choose([[10, 1, 10], [20, 1, 5], [25, 1, 4], [50, 1, 2], [75, 3, 4], [100, 1, 1]]);
      return Object.assign(makeFractionQuestion(`${pct}% = ? (simplest form)`, [n, d]), { topic: 'percentages', kind });
    }
    if (kind === 'decimal') {
      const pct = choose([10, 20, 25, 50, 75, 100]);
      return Object.assign(makeDecimalQuestion(`${pct}% = ?`, pct / 100, 2), { topic: 'percentages', kind });
    }
    if (kind === 'decimalToPercent') {
      const [decimal, pct] = choose([[0.1, 10], [0.2, 20], [0.25, 25], [0.5, 50], [0.75, 75], [1, 100]]);
      return Object.assign(makeNumericQuestion(`${decimal} = ?%`, pct, { extras: [pct - 10, pct + 10] }), { topic: 'percentages', kind });
    }
    if (kind === 'fractionToPercent') {
      const [fraction, pct] = choose([['1/2', 50], ['1/4', 25], ['3/4', 75], ['1/5', 20], ['1/10', 10]]);
      return Object.assign(makeNumericQuestion(`${fraction} = ?%`, pct, { extras: [pct - 10, pct + 10] }), { topic: 'percentages', kind });
    }
    const [a, b] = choose([[25, 0.2], [50, 0.5], [75, 0.8], [20, 0.25]]);
    return Object.assign(makeCompareQuestion(`Compare: ${a}% ? ${b}`, Math.sign(a / 100 - b)), { topic: 'percentages', kind });
  }

  function makeGrade5RatioQuestion() {
    const kind = weightedChoose([['simplify', 34], ['partOfTotal', 33], ['proportion', 33]]);
    if (kind === 'simplify') {
      const [a, b, x, y] = choose([[4, 8, 1, 2], [6, 9, 2, 3], [10, 15, 2, 3], [12, 18, 2, 3], [8, 20, 2, 5]]);
      const answer = `${x}:${y}`, wrong = [`${a}:${b}`, `${x + 1}:${y}`, `${x}:${y + 1}`];
      return Object.assign(textChoices(answer, wrong), { question: `Simplify ${a}:${b}.`, topic: 'ratio', kind });
    }
    if (kind === 'partOfTotal') {
      const [red, blue, total] = choose([[2, 3, 10], [1, 2, 12], [3, 2, 20], [2, 5, 21]]), answer = red * total / (red + blue);
      return Object.assign(makeNumericQuestion(`Red : Blue = ${red}:${blue}. Total = ${total}. How many are red?`, answer, { extras: [total - answer, red, blue] }), { topic: 'ratio', kind });
    }
    const [a, b, scale] = choose([[2, 5, 2], [1, 3, 4], [3, 4, 2], [2, 3, 3]]), answer = b * scale;
    return Object.assign(makeNumericQuestion(`${a}:${b} = ${a * scale}:□`, answer, { extras: [b, a * scale, answer + a] }), { topic: 'ratio', kind });
  }

  function makeGrade5ProbabilityQuestion() {
    const kind = weightedChoose([['bag', 40], ['coin', 20], ['die', 20], ['likely', 20]]);
    if (kind === 'bag') {
      const [red, blue] = choose([[3, 2], [4, 1], [2, 3], [5, 3]]), total = red + blue;
      return Object.assign(makeFractionQuestion(`A bag has ${red} red and ${blue} blue balls. P(red) = ?`, [red, total]), { topic: 'probability', kind });
    }
    if (kind === 'coin') return Object.assign(makeFractionQuestion('A fair coin is tossed. P(heads) = ?', [1, 2]), { topic: 'probability', kind });
    if (kind === 'die') return Object.assign(makeFractionQuestion('A fair die is rolled. P(even) = ?', [3, 6]), { topic: 'probability', kind });
    return Object.assign(textChoices('red', ['blue'], 2), { question: 'A bag has 3 red and 2 blue balls. Which colour is more likely?', topic: 'probability', kind });
  }

  function makeGrade5ArithmeticQuestion(operator) {
    const numeric = (text, answer, extras = []) => makeNumericQuestion(text, answer, { sameLastDigit: true, extras });
    if (operator === '+' || operator === '−') {
      const a = operator === '+' ? intBetween(120, 650) : intBetween(300, 999), b = operator === '+' ? intBetween(120, Math.min(300, 950 - a)) : intBetween(100, Math.min(500, a - 100));
      const answer = operator === '+' ? a + b : a - b, kind = weightedChoose([['plain', 65], ['missing', 20], ['inverse', 15]]);
      if (kind === 'plain') return makeQuestion(a, operator, b, answer, true);
      if (kind === 'inverse') return numeric(`${a} ${operator} ${b} = ${answer}, so ${answer} ${operator === '+' ? '−' : '+'} ${operator === '+' ? a : b} = ?`, operator === '+' ? b : a, [a, b, answer]);
      return operator === '+' ? numeric(`□ + ${b} = ${answer}`, a, [b, answer]) : numeric(`${a} − □ = ${answer}`, b, [a, answer]);
    }
    if (operator === '×') {
      const factor = intBetween(2, 9), value = intBetween(12, 35), answer = factor * value;
      if (Math.random() < 0.25) return numeric(`□ × ${factor} = ${answer}`, value, [factor, answer - factor]);
      return makeQuestion(value, '×', factor, answer, true);
    }
    const divisor = intBetween(2, 9), quotient = intBetween(12, 24), dividend = divisor * quotient;
    if (Math.random() < 0.25) return numeric(`${dividend} ÷ □ = ${quotient}`, divisor, [quotient, dividend - quotient]);
    return makeQuestion(dividend, '÷', divisor, quotient, true);
  }

  function makeGrade6NumbersQuestion() {
    const kind = weightedChoose([['negative', 28], ['numberLine', 14], ['round', 8], ['estimate', 8], ['factors', 8], ['multiple', 8], ['divisible', 8], ['orderOps', 10], ['missingFactor', 8]]);
    if (kind === 'negative') {
      if (Math.random() < 0.5) {
        const a = intBetween(1, 9), b = intBetween(5, 15);
        return Object.assign(makeSignedNumericQuestion(`−${a} + ${b} = ?`, b - a), { topic: 'numbers', kind });
      }
      const a = intBetween(2, 8), b = intBetween(9, 15);
      return Object.assign(makeSignedNumericQuestion(`${a} − ${b} = ?`, a - b), { topic: 'numbers', kind });
    }
    if (kind === 'numberLine') {
      const [a, b] = choose([[-5, 2], [-3, 8], [-7, -2], [4, -6]]);
      return Object.assign(makeCompareQuestion(`Compare: ${a < 0 ? `−${Math.abs(a)}` : a} ? ${b < 0 ? `−${Math.abs(b)}` : b}`, Math.sign(a - b)), { topic: 'numbers', kind });
    }
    const q = makeGrade5NumbersQuestion();
    return Object.assign(q, { topic: 'numbers' });
  }

  function makeGrade6DecimalQuestion() {
    if (Math.random() < 0.2) {
      const [decimal, n, d] = choose([[0.375, 3, 8], [0.125, 1, 8], [0.625, 5, 8], [0.2, 1, 5], [0.75, 3, 4]]);
      return Object.assign(makeFractionQuestion(`${decimal} = ? (simplest fraction)`, [n, d]), { topic: 'decimals', kind: 'decimalFraction' });
    }
    return makeGrade5DecimalsQuestion();
  }

  function makeGrade6PercentQuestion() {
    const kind = weightedChoose([['increase', 16], ['decrease', 16], ['ofAmount', 20], ['fractionToPercent', 16], ['decimalToPercent', 16], ['complement', 16]]);
    if (kind === 'increase' || kind === 'decrease') {
      const base = choose([40, 60, 80, 100, 120, 160]), pct = choose([10, 20, 25, 50]), change = base * pct / 100, answer = kind === 'increase' ? base + change : base - change;
      return Object.assign(makeNumericQuestion(`${kind === 'increase' ? 'Increase' : 'Decrease'} ${base} by ${pct}%.`, answer, { extras: [base, change, base + (kind === 'increase' ? 1 : -1)] }), { topic: 'percentages', kind });
    }
    if (kind === 'ofAmount') {
      const pct = choose([15, 20, 25, 35, 50, 75]), base = choose([40, 60, 80, 100, 120, 200]);
      return Object.assign(makeNumericQuestion(`${pct}% of ${base} = ?`, pct * base / 100, { extras: [base, pct, base - pct * base / 100] }), { topic: 'percentages', kind });
    }
    if (kind === 'fractionToPercent') {
      const [f, pct] = choose([['3/8', 37.5], ['1/4', 25], ['3/4', 75], ['2/5', 40], ['7/10', 70]]);
      if (Number.isInteger(pct)) return Object.assign(makeNumericQuestion(`${f} = ?%`, pct, { extras: [pct - 10, pct + 10] }), { topic: 'percentages', kind });
      return Object.assign(makeDecimalQuestion(`${f} = ?%`, pct, 1), { topic: 'percentages', kind });
    }
    if (kind === 'decimalToPercent') {
      const [decimal, pct] = choose([[0.35, 35], [0.125, 12.5], [0.6, 60], [0.75, 75], [0.4, 40]]);
      return Object.assign(Number.isInteger(pct) ? makeNumericQuestion(`${decimal} = ?%`, pct, { extras: [pct - 10, pct + 10] }) : makeDecimalQuestion(`${decimal} = ?%`, pct, 1), { topic: 'percentages', kind });
    }
    const [pct, answer] = choose([[30, 0.7], [65, 0.35], [25, 0.75], [80, 0.2]]);
    return Object.assign(makeDecimalQuestion(`P(A) = ${pct}%. P(not A) = ?`, answer, 2), { topic: 'percentages', kind: 'complement' });
  }

  function makeGrade6RatioQuestion() {
    if (Math.random() < 0.35) {
      const [a, b, total] = choose([[2, 3, 30], [3, 5, 40], [1, 2, 24], [4, 5, 45]]), first = a * total / (a + b);
      return Object.assign(makeNumericQuestion(`Divide ${total} in the ratio ${a}:${b}. How many are in the first part?`, first, { extras: [total - first, a, b] }), { topic: 'ratio', kind: 'sharing' });
    }
    return makeGrade5RatioQuestion();
  }

  function makeGrade6AlgebraQuestion() {
    const kind = weightedChoose([['substitute', 22], ['likeTerms', 20], ['oneStepAdd', 14], ['oneStepMultiply', 14], ['twoStep', 18], ['patternRule', 12]]);
    if (kind === 'substitute') {
      const x = intBetween(2, 6), a = choose([2, 3, 4]), b = choose([1, 2, 3]), answer = a * x + b;
      return Object.assign(makeNumericQuestion(`If x = ${x}, calculate ${a}x + ${b}.`, answer), { topic: 'algebra', kind });
    }
    if (kind === 'likeTerms') {
      const a = intBetween(2, 5), b = intBetween(1, 4);
      return Object.assign(textChoices(`${a + b}x`, [`${a * b}x`, `${a + b}`, `${a}x + ${b}`, `${a + b + 1}x`]), { question: `Simplify ${a}x + ${b}x.`, topic: 'algebra', kind });
    }
    if (kind === 'oneStepAdd') {
      const x = intBetween(5, 18), n = intBetween(2, 9);
      return Object.assign(makeNumericQuestion(`x + ${n} = ${x + n}. x = ?`, x), { topic: 'algebra', kind });
    }
    if (kind === 'oneStepMultiply') {
      const x = intBetween(3, 12), a = choose([2, 3, 4, 5]);
      return Object.assign(makeNumericQuestion(`${a}x = ${a * x}. x = ?`, x), { topic: 'algebra', kind });
    }
    if (kind === 'twoStep') {
      const x = intBetween(3, 9), a = choose([2, 3]), b = choose([3, 5, 7]);
      return Object.assign(makeNumericQuestion(`${a}x + ${b} = ${a * x + b}. x = ?`, x), { topic: 'algebra', kind });
    }
    const multiplier = choose([2, 3, 4]), offset = choose([1, 2, 3]);
    return Object.assign(textChoices(`${multiplier}n + ${offset}`, [`n + ${multiplier + offset}`, `${multiplier + offset}n`, `${multiplier}n − ${offset}`]), { question: `Rule for the sequence ${multiplier + offset}, ${2 * multiplier + offset}, ${3 * multiplier + offset}, ${4 * multiplier + offset}:`, topic: 'algebra', kind });
  }

  function makeGrade6StatisticsQuestion() {
    const kind = choose(['mean', 'median', 'mode', 'range']);
    const values = kind === 'mode' ? choose([[3, 5, 5, 7, 10], [2, 3, 3, 6, 11]]) : choose([[3, 5, 5, 7, 10], [4, 6, 8, 10], [2, 3, 3, 6, 11], [5, 7, 8, 9, 11]]);
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2), answer = kind === 'mean' ? values.reduce((sum, value) => sum + value, 0) / values.length : kind === 'median' ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : kind === 'mode' ? values.find(value => values.filter(item => item === value).length > 1) : sorted[sorted.length - 1] - sorted[0];
    return Object.assign(makeNumericQuestion(`Data: ${values.join(', ')}. Find the ${kind}.`, answer, { extras: [sorted[0], sorted[middle], sorted[sorted.length - 1]] }), { topic: 'statistics', kind });
  }

  function makeGrade6ProbabilityQuestion() {
    const kind = weightedChoose([['coin', 12], ['die', 16], ['sampleSpace', 14], ['complementDecimal', 14], ['complementPercent', 10], ['experimental', 12], ['asPercent', 12], ['likely', 10]]);
    if (kind === 'coin') return Object.assign(makeFractionQuestion('A fair coin is tossed. P(heads) = ?', [1, 2]), { topic: 'probability', kind });
    if (kind === 'die') return Object.assign(makeFractionQuestion('A fair die is rolled. P(number > 4) = ?', [2, 6]), { topic: 'probability', kind });
    if (kind === 'sampleSpace') return Object.assign(makeFractionQuestion('A fair spinner has 4 equal sections numbered 1 to 4. P(even) = ?', [2, 4]), { topic: 'probability', kind });
    if (kind === 'complementDecimal') return Object.assign(makeDecimalQuestion('P(A) = 0.3. What is P(not A)?', 0.7, 1), { topic: 'probability', kind });
    if (kind === 'complementPercent') return Object.assign(makeNumericQuestion('P(A) = 35%. What is P(not A)?', 65, { extras: [35, 75, 55] }), { topic: 'probability', kind });
    if (kind === 'experimental') return Object.assign(makeFractionQuestion('A coin landed heads 4 times in 10 tosses. Experimental P(heads) = ?', [4, 10]), { topic: 'probability', kind });
    if (kind === 'asPercent') return Object.assign(makeNumericQuestion('P(A) = 0.3. Write P(A) as a percent.', 30, { extras: [3, 70, 33] }), { topic: 'probability', kind });
    return Object.assign(textChoices('red', ['blue', 'equally likely', 'neither']), { question: 'A bag has 3 red and 2 blue counters. Which colour is more likely?', topic: 'probability', kind });
  }

  function makeGrade6ArithmeticQuestion(operator) {
    if (operator === '+' || operator === '−') {
      const kind = weightedChoose([['plain', 60], ['missing', 22], ['inverse', 18]]);
      if (kind === 'plain' && Math.random() < 0.35) {
        if (operator === '+') {
          const a = intBetween(1, 9), b = intBetween(5, 15);
          return makeSignedNumericQuestion(`−${a} + ${b} = ?`, b - a);
        }
        const a = intBetween(2, 8), b = intBetween(9, 15);
        return makeSignedNumericQuestion(`${a} − ${b} = ?`, a - b);
      }
      const a = intBetween(50, 99), b = intBetween(10, Math.min(40, a - 10)), answer = operator === '+' ? a + b : a - b;
      if (kind === 'inverse') return makeNumericQuestion(`${a} ${operator} ${b} = ${answer}, so ${answer} ${operator === '+' ? '−' : '+'} ${operator === '+' ? a : b} = ?`, operator === '+' ? b : a, { sameLastDigit: true });
      if (kind === 'missing') return operator === '+' ? makeNumericQuestion(`□ + ${b} = ${answer}`, a, { sameLastDigit: true }) : makeNumericQuestion(`${a} − □ = ${answer}`, b, { sameLastDigit: true });
      return makeQuestion(a, operator, b, answer, true);
    }
    if (operator === '×') {
      const a = intBetween(12, 35), b = intBetween(2, 9), product = a * b;
      return Math.random() < 0.25 ? makeNumericQuestion(`□ × ${b} = ${product}`, a, { sameLastDigit: true }) : makeQuestion(a, '×', b, product, true);
    }
    const divisor = intBetween(2, 9), quotient = intBetween(12, 24), dividend = divisor * quotient;
    return Math.random() < 0.25 ? makeNumericQuestion(`□ ÷ ${divisor} = ${quotient}`, dividend, { sameLastDigit: true }) : makeQuestion(dividend, '÷', divisor, quotient, true);
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
    if (grade === 3 && Math.random() < 0.45) {
      const hours = intBetween(1, 3), minutes = choose([10, 15, 20, 30, 40, 45, 50]), total = hours * 60 + minutes;
      return Object.assign(makeNumericQuestion(`${hours} h ${minutes} min = ? min`, total, { extras: [hours + minutes, hours * 60, total - 10] }), { topic: 'clock', kind: 'elapsed' });
    }
    const hour = intBetween(1, 12);
    const step = [null, 30, 5, 5, 1][grade];
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
    const wrongKeys = pickWithMistake(correctKey, [...cand.keys()], 3, must);
    const entries = [[correctKey, label(correctKey)], ...wrongKeys.map(k => [k, cand.get(k)])];
    return Object.assign({
      question: 'Read the time.',
      figure: { type: 'clock', hour, minute },
      answers: entries.map(e => e[1]),
      keys: entries.map(e => e[0]),
      correct: 0
    }, grade === 3 ? { topic: 'clock', kind: 'read' } : {});
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
    if (grade === 4) {
      const kind = weightedChoose([['perimeter', 14], ['area', 18], ['angle', 12], ['angleCompare', 10], ['convert', 14], ['duration', 10], ['symmetry', 10], ['properties', 8], ['triangleAngle', 4]]);
      let q;
      if (kind === 'perimeter' || kind === 'area') {
        const length = intBetween(4, 12), width = intBetween(2, 8), result = kind === 'perimeter' ? 2 * (length + width) : length * width;
        q = makeNumericQuestion(kind === 'perimeter' ? `Perimeter of ${length} cm × ${width} cm rectangle = ? cm` : `Area of ${length} cm × ${width} cm rectangle = ? cm²`, result, { extras: [length + width, 2 * length, 2 * width, length * width, result + 10, result - 10] });
        q.figure = { type: 'rectangle-measure', length, width };
      } else if (kind === 'angle') {
        const angle = choose([{ name: 'acute', degrees: 45 }, { name: 'right', degrees: 90 }, { name: 'obtuse', degrees: 135 }]);
        q = Object.assign(textChoices(angle.name, ['acute', 'right', 'obtuse', 'straight'].filter(x => x !== angle.name)), { question: 'What type of angle is shown?', figure: { type: 'angle', degrees: angle.degrees } });
      } else if (kind === 'angleCompare') {
        const a = choose([35, 45, 60, 90, 120]), b = choose([30, 50, 75, 90, 135]);
        q = makeCompareQuestion(`Compare: ${a}° ? ${b}°`, Math.sign(a - b));
      } else if (kind === 'convert') {
        const metres = choose([1.5, 2.5, 3.5, 4.5]), centimetres = metres * 100;
        q = makeNumericQuestion(`${metres} m = ? cm`, centimetres, { extras: [metres * 10, centimetres + 10, centimetres - 10, centimetres + 100, centimetres - 100] });
      } else if (kind === 'duration') {
        const hours = intBetween(1, 3), minutes = choose([10, 15, 20, 30, 40, 45, 50]), total = hours * 60 + minutes;
        q = makeNumericQuestion(`${hours} h ${minutes} min = ? min`, total, { extras: [hours + minutes, hours * 60, total - 10, total + 10] });
      } else if (kind === 'symmetry') {
        const shape = choose([{ name: 'square', lines: 4 }, { name: 'rectangle', lines: 2 }, { name: 'equilateral triangle', lines: 3 }]);
        q = makeNumericQuestion(`Lines of symmetry in a ${shape.name} = ?`, shape.lines, { extras: [1, 2, 4, shape.lines + 1] });
        q.figure = { type: 'shape', shape: shape.name === 'equilateral triangle' ? 'triangle' : shape.name };
      } else if (kind === 'properties') {
        const shape = choose([{ name: 'hexagon', sides: 6 }, { name: 'pentagon', sides: 5 }, { name: 'octagon', sides: 8 }]);
        q = makeNumericQuestion(`Sides of a ${shape.name} = ?`, shape.sides, { extras: [shape.sides - 1, shape.sides + 1, shape.sides + 2] });
      } else {
        const a = choose([35, 45, 60, 70, 80]), b = choose([25, 35, 40, 50, 60]);
        const answer = 180 - a - b;
        q = makeNumericQuestion(`Third angle = 180° − ${a}° − ${b}°`, answer, { extras: [180 - a, 180 - b, a + b, answer + 10, answer - 10] });
      }
      return Object.assign(q, { topic: 'shapes', kind });
    }
    if (grade === 3) {
      const kind = weightedChoose([['polygon', 12], ['solid', 12], ['perimeter', 16], ['area', 16], ['angle', 16], ['convert', 14], ['measure', 14]]);
      let q;
      if (kind === 'polygon') { const n = intBetween(3, 10); q = makeNumericQuestion(`Sides of ${POLYGON_NAMES[n]} = ?`, n, { count: 4 }); }
      else if (kind === 'solid') { const solid = choose(SOLIDS), prop = choose(['faces', 'edges', 'vertices']); q = makeNumericQuestion(`${prop} of a ${solid.name} = ?`, solid[prop], { count: 4 }); }
      else if (kind === 'perimeter') { const length = choose([4, 5, 6, 8, 10]), width = choose([2, 3, 4, 5]); q = makeNumericQuestion('Perimeter = ? cm', 2 * (length + width), { extras: [length + width, 2 * length, 2 * width] }); q.figure = { type: 'perimeter', length, width }; }
      else if (kind === 'area') { const rows = intBetween(2, 5), cols = intBetween(2, 6); q = makeNumericQuestion('How many square units cover the shape?', rows * cols, { extras: [rows + cols, 2 * (rows + cols), rows * cols - 1] }); q.figure = { type: 'grid-area', rows, cols }; }
      else if (kind === 'angle') { const angles = [{ name: 'acute', degrees: 45 }, { name: 'right', degrees: 90 }, { name: 'obtuse', degrees: 135 }], angle = choose(angles); q = Object.assign(textChoices(angle.name, ['acute', 'right', 'obtuse', 'straight'].filter(x => x !== angle.name)), { question: 'What type of angle is shown?', figure: { type: 'angle', degrees: angle.degrees } }); }
      else if (kind === 'convert') { const m = intBetween(1, 9); q = makeNumericQuestion(`${m} m = ? cm`, m * 100, { extras: [m * 10, m * 1000, m + 100] }); }
      else { const unit = choose(['cm', 'kg', 'L']), a = intBetween(10, 99), b = intBetween(10, 99); q = makeCompareQuestion(`Compare: ${a} ${unit} ? ${b} ${unit}`, Math.sign(a - b)); }
      return Object.assign(q, { topic: 'shapes', kind });
    }
    if (grade === 2) {
      const kind = weightedChoose([['polygon', 20], ['solid', 15], ['measure', 20], ['perimeter', 15], ['symmetry', 10], ['identify', 20]]);
      if (kind === 'polygon') {
        const n = intBetween(3, 8), word = choose(['sides', 'corners']);
        const q = makeNumericQuestion(`How many ${word}?`, n, { count: 4 });
        q.figure = { type: 'polygon', sides: n }; q.topic = 'shapes'; q.kind = kind;
        return q;
      }
      if (kind === 'solid') {
        const solids = [{ name: 'cube', emoji: '🧊' }, { name: 'sphere', emoji: '⚽' }, { name: 'cylinder', emoji: '🥫' }, { name: 'cone', emoji: '🍦' }];
        const solid = choose(solids);
        return Object.assign(textChoices(solid.name, solids.filter(s => s !== solid).map(s => s.name)), {
          question: 'Which solid is shown?', picture: { groups: [{ emoji: solid.emoji, rows: ['X'] }], label: `A ${solid.name}`, key: `solid:${solid.name}` }, topic: 'shapes', kind
        });
      }
      if (kind === 'measure') {
        const unit = choose(['cm', 'kg', 'L']), a = intBetween(10, 99), b = Math.random() < 0.15 ? a : intBetween(10, 99);
        return Object.assign(makeCompareQuestion(`Compare: ${a} ${unit} ? ${b} ${unit}`, Math.sign(a - b)), { topic: 'shapes', kind });
      }
      if (kind === 'perimeter') {
        const length = intBetween(4, 12), width = intBetween(2, 8);
        const q = makeNumericQuestion('Perimeter = ?', 2 * (length + width), { extras: [length + width, 2 * length, 2 * width] });
        q.figure = { type: 'perimeter', length, width }; q.topic = 'shapes'; q.kind = kind;
        return q;
      }
      if (kind === 'symmetry') {
        const shape = choose([{ name: 'triangle', shape: 'triangle', lines: 3 }, { name: 'square', shape: 'square', lines: 4 }, { name: 'rectangle', shape: 'rectangle', lines: 2 }]);
        const q = { question: `${shape.name}: lines of symmetry = ?`, ...numberChoices(shape.lines, 1, 4, [1, 2, 3, 4]) };
        q.figure = { type: 'shape', shape: shape.shape, ratio: shape.name === 'rectangle' ? 1.7 : 1 }; q.topic = 'shapes'; q.kind = kind;
        return q;
      }
      const sides = intBetween(3, 6), names = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' };
      const q = textChoices(names[sides], Object.values(names).filter(name => name !== names[sides]));
      q.question = 'Which shape is shown?'; q.figure = { type: 'polygon', sides }; q.topic = 'shapes'; q.kind = kind;
      return q;
    }
    if (grade === 4) {
      if (Math.random() < 0.5) {
        const a = intBetween(20, 80), b = intBetween(20, 160 - a);
        return makeNumericQuestion(`Third angle = 180° − ${a}° − ${b}°`, 180 - a - b, { extras: [180 - a, 180 - b, a + b] });
      }
      const l = intBetween(4, 15), w = intBetween(2, l);
      return makeNumericQuestion(`Perimeter of ${l} cm × ${w} cm rectangle = ? cm`, 2 * (l + w), { extras: [l * w, l + w, 2 * l + w] });
    }
    if (grade === 5) {
      const kind = weightedChoose([['area', 18], ['squareArea', 10], ['perimeter', 12], ['compositeArea', 12], ['volume', 12], ['angle', 12], ['convert', 10], ['coordinate', 8], ['duration', 6]]);
      if (kind === 'area') {
        const l = intBetween(6, 20), w = intBetween(3, 15);
        return Object.assign(makeNumericQuestion(`Area of ${l} cm × ${w} cm rectangle = ? cm²`, l * w, { extras: [2 * (l + w), l + w] }), { topic: 'shapes', kind });
      }
      if (kind === 'squareArea') {
        const s = intBetween(3, 15);
        return Object.assign(makeNumericQuestion(`Area of square with ${s} cm sides = ? cm²`, s * s, { extras: [4 * s, 2 * s] }), { topic: 'shapes', kind });
      }
      if (kind === 'perimeter') {
        const l = intBetween(4, 15), w = intBetween(2, 10);
        return Object.assign(makeNumericQuestion(`Perimeter of ${l} cm × ${w} cm rectangle = ? cm`, 2 * (l + w), { extras: [l * w, l + w, 2 * l] }), { topic: 'shapes', kind });
      }
      if (kind === 'compositeArea') {
        const l = intBetween(6, 10), h = intBetween(4, 8), cutW = choose([2, 3]), cutH = intBetween(1, h - 1), area = l * h - cutW * cutH;
        return Object.assign(makeNumericQuestion(`L-shape area: ${l} × ${h} − ${cutW} × ${cutH} = ? cm²`, area, { extras: [l * h, cutW * cutH, area + cutW] }), { topic: 'shapes', kind });
      }
      if (kind === 'volume') {
        const [l, w, h] = choose([[3, 2, 4], [4, 2, 5], [3, 3, 4], [5, 2, 3]]);
        return Object.assign(makeNumericQuestion(`Volume: ${l} × ${w} × ${h} unit cubes = ?`, l * w * h, { extras: [l * w + h, 2 * (l + w + h)] }), { topic: 'shapes', kind });
      }
      if (kind === 'angle') {
        const given = choose([35, 45, 60, 75, 110, 125]);
        return Object.assign(makeNumericQuestion(`Angles on a straight line total 180°. One is ${given}°. The other = ?`, 180 - given, { extras: [180 - given + 10, given, 180] }), { topic: 'shapes', kind });
      }
      if (kind === 'convert') {
        const metres = choose([1.2, 1.5, 2.5, 3.5]);
        return Object.assign(makeNumericQuestion(`${metres} m = ? cm`, metres * 100, { extras: [metres * 10, metres * 100 + 10, metres * 100 - 10] }), { topic: 'shapes', kind });
      }
      if (kind === 'coordinate') {
        const x = intBetween(1, 9), y = intBetween(1, 9), axis = choose(['x', 'y']);
        return Object.assign(makeNumericQuestion(`On a coordinate grid, point A is at (${x}, ${y}). What is its ${axis}-coordinate?`, axis === 'x' ? x : y, { extras: [axis === 'x' ? y : x, 0, 10] }), { topic: 'shapes', kind });
      }
      const hours = intBetween(1, 2), minutes = choose([15, 20, 25, 30, 35, 40, 45]), extra = choose([15, 20, 30, 35, 40, 45]);
      return Object.assign(makeNumericQuestion(`${hours} h ${minutes} min + ${extra} min = ? min`, hours * 60 + minutes + extra, { extras: [hours * 60 + minutes, minutes + extra] }), { topic: 'shapes', kind: 'duration' });
    }
    const kind = weightedChoose([['triangle', 12], ['trianglePerimeter', 4], ['parallelogram', 8], ['quad', 8], ['rectangleArea', 12], ['perimeter', 10], ['volume', 12], ['angleLine', 12], ['coordinate', 10], ['convert', 8], ['scale', 4]]);
    if (kind === 'quad') {
      const a = intBetween(60, 120), b = intBetween(60, 120), c = intBetween(60, 120);
      return Object.assign(makeNumericQuestion(`Fourth angle = 360° − ${a}° − ${b}° − ${c}°`, 360 - a - b - c, { extras: [360 - a - b, 180 - c] }), { topic: 'shapes', kind });
    }
    if (kind === 'triangle') {
      const base = choose([6, 8, 10, 12]), height = choose([4, 5, 6, 8]);
      return Object.assign(makeNumericQuestion(`Triangle area: base ${base} cm × height ${height} cm ÷ 2 = ? cm²`, base * height / 2, { extras: [base * height, base + height] }), { topic: 'shapes', kind });
    }
    if (kind === 'trianglePerimeter') {
      const [a, b, c] = choose([[3, 4, 5], [5, 5, 6], [6, 7, 8], [4, 6, 7]]);
      return Object.assign(makeNumericQuestion(`Triangle perimeter: sides ${a} cm, ${b} cm and ${c} cm = ? cm`, a + b + c, { extras: [a + b, a + c, b + c] }), { topic: 'shapes', kind });
    }
    if (kind === 'parallelogram') {
      const base = intBetween(4, 12), height = intBetween(3, 9);
      return Object.assign(makeNumericQuestion(`Parallelogram area: ${base} cm × ${height} cm = ? cm²`, base * height, { extras: [base * height / 2 | 0, 2 * (base + height)] }), { topic: 'shapes', kind });
    }
    if (kind === 'rectangleArea' || kind === 'perimeter') {
      const length = intBetween(5, 14), width = intBetween(3, 10), area = kind === 'rectangleArea';
      return Object.assign(makeNumericQuestion(`${area ? 'Area' : 'Perimeter'} of ${length} cm × ${width} cm rectangle = ? ${area ? 'cm²' : 'cm'}`, area ? length * width : 2 * (length + width), { extras: [area ? length + width : length * width, 2 * length, 2 * width] }), { topic: 'shapes', kind });
    }
    if (kind === 'volume') {
      const [length, width, height] = choose([[4, 3, 2], [5, 2, 3], [3, 3, 4], [6, 2, 2]]);
      return Object.assign(makeNumericQuestion(`Cuboid volume: ${length} × ${width} × ${height} = ? cm³`, length * width * height, { extras: [length * width, 2 * (length + width + height)] }), { topic: 'shapes', kind });
    }
    if (kind === 'angleLine') {
      const given = choose([45, 55, 65, 70, 115, 125]);
      return Object.assign(makeNumericQuestion(`Angles on a straight line: ${given}° + □ = 180°`, 180 - given, { extras: [given, 180, 180 - given + 10] }), { topic: 'shapes', kind });
    }
    if (kind === 'coordinate') {
      const x = intBetween(1, 8), rawY = intBetween(1, 8), y = rawY === x ? rawY % 8 + 1 : rawY, answer = `(${x}, ${y})`;
      return Object.assign(textChoices(answer, [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(${x}, ${y + 1})`]), { question: `On a coordinate grid, move ${x} right and ${y} up from the origin. What are the coordinates?`, topic: 'shapes', kind });
    }
    if (kind === 'convert') {
      const metres = choose([1.5, 2.4, 3.5, 4.2]);
      return Object.assign(makeNumericQuestion(`${metres} m = ? cm`, metres * 100, { extras: [metres * 10, metres * 100 + 10, metres * 100 - 10] }), { topic: 'shapes', kind });
    }
    const mapCm = choose([3, 4, 5]), kmPerCm = choose([2, 3, 5]);
    return Object.assign(makeNumericQuestion(`Map scale: 1 cm represents ${kmPerCm} km. A route is ${mapCm} cm. Real distance = ? km`, mapCm * kmPerCm, { extras: [mapCm + kmPerCm, mapCm * kmPerCm + kmPerCm] }), { topic: 'shapes', kind: 'scale' });
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

  function makeCountingQuestion(choiceCount = 3) {
    const item = choose(COUNT_OBJECTS);
    const count = intBetween(1, 5);
    const choices = makeNumberChoices(count, 1, 5, choiceCount);
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
      // Keep the picture as a teaching aid while using the same equation prompt at every sum size.
      const [a, b] = choose(ADD_PAIRS);
      const sum = a + b, layout = pictureLayout(a, b, sum);
      const tier = sum <= 6 && Math.random() < 0.65 ? 1 : 2;
      return tag({
        question: `${a} + ${b} = ?`,
        resultText: `${a} + ${b} = ${sum}`,
        picture: {
          groups: [{ emoji: first.emoji, emoji2: second.emoji, rows: arrangeCells('X'.repeat(a) + 'Y'.repeat(b), layout) }],
          label: `${a} ${first.name} and ${b} ${second.name}`,
          key: key('add5', a, b, layout)
        },
        ...numberChoices(sum, 1, 10, [a, b])
      }, 'addition', 'picture', tier);
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
      const tier = a <= 6 && Math.random() < 0.65 ? 1 : 2;
      return tag({
        question: `${a} − ${b} = ?`,
        resultText: `${a} − ${b} = ${keep}`,
        picture: {
          groups: [{ emoji: item.emoji, rows: arrangeCells('X'.repeat(keep) + 'x'.repeat(b), layout) }],
          label: `${a} ${item.name}, ${b} crossed out`,
          key: key('sub5', a, b, layout)
        },
        ...numberChoices(keep, 1, 10, [b, a])
      }, 'subtraction', 'picture', tier);
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
    const q = tag(makeCountingQuestion(4), 'subitising', 'quick-look', 1);
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
      question: `${a} + ${b} = ?`,
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
      question: `${a} − ${b} = ?`,
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
      question: `${a} ${add ? '+' : '−'} ${b} = ?`,
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
    const kind = weightedChoose([['read', 42], ['partition', 24], ['digit', 18], ['make', 16]]);
    let n;
    do { n = intBetween(11, 99); } while (n % 10 === 0 || (kind === 'digit' && Math.floor(n / 10) === n % 10));
    const tens = Math.floor(n / 10), ones = n % 10, swap = swapDigits(n);
    const tier = n < 30 ? 1 : n < 60 ? 2 : 3;
    if (kind === 'read') {
      return mark({ question: 'What number is shown?', promptVisual: blocksOf(n), ...choicesFrom(n, [n - 1, n + 1, n - 10, n + 10, swap, tens + ones], [swap, tens + ones]) }, 'placevalue', kind, tier, false);
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
      ...choicesFrom(answer, [...near, ...within120([answer - 3, answer - 2, answer - 1, answer + 1, answer + 2, answer + 3])], within120([answer + 1, answer - 1]))
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
      return mark(makeNumericQuestion(`1/2 of ${n} = ?`, n / 2, { extras: [n, n * 2] }), 'fractions', kind, n <= 10 ? 1 : 2, false);
    }
    return mark({ question: 'How many halves make one whole?', ...numberChoices(2, 1, 5, [1, 4]) }, 'fractions', kind, 1, false);
  }

  function makeGrade1MoneyQuestion() {
    return Math.random() < 0.65 ? makeCoinTotalQuestion(AU_COINS, 300, false, true) : makeCoinValueQuestion(false);
  }

  function makeGrade1ShapesQuestion() {
    const kind = weightedChoose([['polygon', 48], ['measure', 28], ['data', 24]]);
    if (kind === 'measure') return makeCubeBarQuestion(false);
    if (kind === 'data') return makeDataQuestion(false, true);
    const n = intBetween(3, 6), word = choose(['sides', 'corners']);
    const q = makeNumericQuestion(`How many ${word}?`, n, { count: 4 });
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
    if (grade === 2 && (operator === '+' || operator === '−')) return makeGrade2ArithmeticQuestion(operator);
    if (grade === 2 && (operator === '×' || operator === '÷')) return makeGrade2FactQuestion(operator);
    if (grade === 3 && (operator === '+' || operator === '−')) return makeGrade3ArithmeticQuestion(operator);
    if (grade === 3 && (operator === '×' || operator === '÷')) return makeGrade3FactQuestion(operator);
    if (grade === 4) return makeGrade4ArithmeticQuestion(operator);
    if (grade === 5) return makeGrade5ArithmeticQuestion(operator);
    if (grade === 6) return makeGrade6ArithmeticQuestion(operator);
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
  const ALL_MIX_TOPICS = ['mixed', 'numbers', 'tables', 'fractions', 'decimals', 'percentages', 'ratio', 'probability', 'algebra', 'statistics', 'money', 'clock', 'shapes', 'patterns', 'data'];

  function generateRawQuestion(difficulty, topic) {
    if (difficulty === 'toddler') return makeToddlerQuestion();
    if (difficulty === 'age4') return makeAge4Question();
    if (difficulty === 'age5') return makeAge5Question();
    if (difficulty === 'age6') return makeAge6Question();
    const grade = gradeOf(difficulty);
    let name = normaliseTopic(difficulty, topic);
    if (name === 'all') {
      const offered = topicsFor(difficulty).map(t => t.value);
      const pool = ALL_MIX_TOPICS.filter(t => offered.includes(t));
      // Grade 1 arithmetic gets weight 5; the five other categories get weight 3 each (25% vs 15% each).
      name = grade === 1 ? weightedChoose(pool.map(t => [t, t === 'mixed' ? 5 : 3])) : choose(pool);
    }
    let q;
    switch (name) {
      case 'numbers': q = grade === 1 ? makeGrade1NumbersQuestion() : grade === 2 ? makeGrade2NumbersQuestion() : grade === 3 ? makeGrade3NumbersQuestion() : grade === 4 ? makeGrade4NumbersQuestion() : grade === 5 ? makeGrade5NumbersQuestion() : grade === 6 ? makeGrade6NumbersQuestion() : makeGrade2NumbersQuestion(); break;
      case 'tables': q = makeTablesQuestion(grade); if (grade === 2 || grade === 4) Object.assign(q, { topic: 'tables', kind: 'fact' }); break;
      case 'fractions': q = makeFractionsQuestion(grade); break;
      case 'decimals': q = grade === 6 ? makeGrade6DecimalQuestion() : grade === 5 ? makeGrade5DecimalsQuestion() : makeGrade4DecimalsQuestion(); break;
      case 'percentages': q = grade === 6 ? makeGrade6PercentQuestion() : makeGrade5PercentQuestion(); break;
      case 'ratio': q = grade === 6 ? makeGrade6RatioQuestion() : makeGrade5RatioQuestion(); break;
      case 'probability': q = grade === 6 ? makeGrade6ProbabilityQuestion() : makeGrade5ProbabilityQuestion(); break;
      case 'algebra': q = makeGrade6AlgebraQuestion(); break;
      case 'statistics': q = makeGrade6StatisticsQuestion(); break;
      case 'money': q = makeMoneyQuestion(grade); break;
      case 'clock': q = makeClockQuestion(grade); break;
      case 'patterns': q = grade === 4 ? makeGrade4PatternQuestion() : grade === 3 ? makeGrade3PatternQuestion() : makeGrade2PatternQuestion(); break;
      case 'data': q = grade === 3 ? makeGrade3DataQuestion() : makeGrade2DataQuestion(); break;
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
    const grade = isGrade(difficulty) ? gradeOf(difficulty) : 0;
    if (!isGrade(difficulty) || grade <= 2) {
      q.question = fractionWords(q.question);
      q.answers = q.answers.map(fractionWords);
      if (q.resultText) q.resultText = fractionWords(q.resultText);
      if (q.visualLabel) q.visualLabel = fractionWords(q.visualLabel);
      if (q.answerLabels) q.answerLabels = q.answerLabels.map(fractionWords);
    }
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
  // and so are decorative emoji (Age 5/6 stages), so "6 × 7 = ?" generated twice with different
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
