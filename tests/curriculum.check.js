// Curriculum scope: Age 6 and Grade 1 question pools, no standalone number comparisons for Grades 1-4,
// decimal-versus-fraction comparisons for Grades 5-6, and Age 2-5 left exactly as they were.
// Every answer is recomputed here from the question text / picture data; the generators' own answers are never trusted.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 15) console.log('FAIL', m, JSON.stringify(q)); };
const N = 4000;
const LESS = '< (less than)', EQUAL = '= (equal to)', MORE = '> (greater than)';

const ans = (q) => q.answers[q.correct];
const sum = (a) => a.reduce((s, v) => s + v, 0);
const isNum = (s) => s.trim() !== '' && !isNaN(Number(s));
const countX = (rows) => rows.join('').split('').filter(ch => ch === 'X').length;
const coinValue = (s) => s.startsWith('$') ? 100 * Number(s.slice(1)) : Number(s.slice(0, -1));
const COIN_TOKEN = /^(5c|10c|20c|50c|\$1|\$2)$/;
const NO_SMALL_COINS = /(?<![\d$])[12]c\b/;      // 1c and 2c must never appear
const rel = (x, y) => x < y ? LESS : x > y ? MORE : EQUAL;

// Checks every question must pass: valid answer index, distinct non-empty answers, numeric answers ascending.
function common(label, q) {
  const a = q.answers;
  if (!Array.isArray(a) || a.length < 2 || a.length > 5) return fail(label + ': answer count', q), false;
  if (!(q.correct >= 0 && q.correct < a.length)) return fail(label + ': bad correct index', q), false;
  if (new Set(a).size !== a.length || a.some(x => typeof x !== 'string' || x.trim() === '')) return fail(label + ': duplicate/empty answer slot', q), false;
  if (a.every(isNum)) { const n = a.map(Number); if (n.some((v, i) => v < 0 || (i && v <= n[i - 1]))) fail(label + ': numeric answers negative/not ascending', q); }
  return true;
}

// ---------------- number words (independent of the generator) ----------------
const WORD = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function wordToNumber(text) {
  let total = 0;
  for (const part of text.replace(/ and /g, ' ').split(' ')) {
    if (part === 'hundred') { total = (total || 1) * 100; continue; }
    for (const piece of part.split('-')) { if (!(piece in WORD)) return NaN; total += WORD[piece]; }
  }
  return total;
}
// A number sequence shown as ['4', '?', '6']: returns { step, answer, values } or null when it is not an arithmetic sequence.
function readSequence(numbers) {
  const hole = numbers.indexOf('?');
  if (hole < 0 || numbers.indexOf('?', hole + 1) >= 0) return null;
  const known = numbers.map((v, i) => [i, Number(v)]).filter(([i]) => i !== hole);
  const [i0, v0] = known[0], [i1, v1] = known[1];
  const step = (v1 - v0) / (i1 - i0);
  if (!Number.isInteger(step) || step === 0) return null;
  const values = numbers.map((_, i) => v0 + step * (i - i0));
  if (known.some(([i, v]) => values[i] !== v)) return null;
  return { step, answer: values[hole], values };
}

// ============================ AGE 6 ============================
// Position, picture-graph, cube-bar and coin checks are shared by Age 6 and Grade 1 (`label` names the level).
function checkPosition(label, q) {
  let m;
  if ((m = q.question.match(/^Which way does the arrow point\? (.+)$/))) {
    const want = m[1].includes('⬆') ? 'Up' : m[1].includes('⬇') ? 'Down' : m[1].includes('⬅') ? 'Left' : m[1].includes('➡') ? 'Right' : null;
    if (!want || ans(q) !== want || q.answers.length !== 4) fail(label + ': arrow', q);
    return;
  }
  const g = q.picture && q.picture.groups[0], row = g && g.rows.length === 1 ? g.rows[0] : '';
  if (q.question !== 'Counting from the left, which place is the ⭐?' || !/^[XY]{3,5}$/.test(row) || (row.match(/Y/g) || []).length !== 1 || g.emoji2 !== '⭐' || Number(ans(q)) !== row.indexOf('Y') + 1) fail(label + ': place in a row', q);
}

function checkData(label, q, maxTotal, simple) {
  let m;
  if ((m = q.question.match(/^Each \|\|\|\|\/ is a group of 5\. How many tally marks\? (.+)$/))) {
    const marks = m[1];
    if (simple || /[^|/ ]/.test(marks) || Number(ans(q)) !== (marks.match(/\|/g) || []).length + (marks.match(/\//g) || []).length) fail(label + ': tally count', q);
    return;
  }
  const pg = (q.picture && q.picture.label.match(/^Picture graph: (.+)$/));
  if (!pg) return fail(label + ': data question not recognised', q);
  const items = pg[1].split(', ').map(s => s.match(/^(\d+) (.+)$/)), counts = {};
  if (items.some(x => !x) || items.length < 2 || items.length > 3) return fail(label + ': picture graph label', q);
  items.forEach(x => { counts[x[2]] = Number(x[1]); });
  if (q.picture.groups.map(g => countX(g.rows)).join() !== items.map(x => x[1]).join()) fail(label + ': picture graph drawing', q);
  if (sum(Object.values(counts)) > maxTotal) fail(label + ': picture graph too big', q);
  if (q.question === 'How many altogether?') { if (Number(ans(q)) !== sum(Object.values(counts))) fail(label + ': graph total', q); }
  else if (!simple && (m = q.question.match(/^How many (.+)\?$/)) && m[1] in counts) { if (Number(ans(q)) !== counts[m[1]]) fail(label + ': graph count', q); }
  else fail(label + ': graph question (Age 6 asks totals only, so counting is never a classification exercise)', q);
}

// Measurement must be a real task on explicit numbers: cubes counted in a bar picture.
function checkBars(label, q, max) {
  const g = q.picture && q.picture.groups.length === 1 ? q.picture.groups[0] : null, rows = g ? g.rows.map(r => r.length) : [];
  if (!g || g.rows.some(r => /[^X]/.test(r)) || rows.some(r => r < 1 || r > max)) return fail(label + ': cube bar picture', q);
  const n = Number(ans(q)); let m;
  if (q.question === 'How many cubes long is the bar?') { if (rows.length !== 1 || n !== rows[0]) fail(label + ': bar length', q); }
  else if ((m = q.question.match(/^How many cubes longer is the (top|bottom) bar\?$/))) {
    const diff = m[1] === 'top' ? rows[0] - rows[1] : rows[1] - rows[0];
    if (rows.length !== 2 || diff <= 0 || n !== diff) fail(label + ': bar difference', q);
  } else if (q.question === 'How many cubes in both bars?') { if (rows.length !== 2 || n !== sum(rows)) fail(label + ': bars total', q); }
  else fail(label + ': measurement must be a numeric task', q);
}

// Money questions draw Australian coins; Grade 1 totals use child-friendly currency labels.
function checkMoney(label, q, limit, totalValues) {
  if (NO_SMALL_COINS.test([q.question, ...q.answers].join(' '))) return fail(label + ': 1c/2c coin', q);
  if (!Array.isArray(q.coins) || !q.coins.length || q.coins.some(c => ![5, 10, 20, 50, 100, 200].includes(c))) return fail(label + ': coin illustration missing or not Australian', q);
  if (q.question === 'How much money is there altogether?') {
    const total = sum(q.coins), value = a => {
      if (/^\$\d+\.\d{2}$/.test(a)) return Math.round(Number(a.slice(1)) * 100);
      if (/^\d+c$/.test(a)) return Number(a.slice(0, -1));
      return NaN;
    };
    if (q.coins.length < 2 || q.coins.length > 3 || q.coins.some(c => !totalValues.includes(c)) || total !== value(ans(q)) || total > limit || q.answers.some(a => !Number.isFinite(value(a)) || value(a) % 5 !== 0) || q.answers.some((a, i) => i && value(a) <= value(q.answers[i - 1]))) fail(label + ': Grade 1 money total', q);
  } else if (q.question === 'How many cents altogether?') {
    const total = sum(q.coins);
    if (q.coins.length < 2 || q.coins.length > 3 || q.coins.some(c => !totalValues.includes(c)) || total !== Number(ans(q)) || total > limit || q.answers.some(a => Number(a) % 5 !== 0)) fail(label + ': coin total', q);
  } else if (q.question === 'How many cents is this coin?') { if (q.coins.length !== 1 || q.coins[0] !== Number(ans(q))) fail(label + ': coin value', q); }
  else fail(label + ': money question not recognised', q);
}

// Text that must never come back at Age 6 / Grade 1: everyday knowledge, routines, stories, vague measurement.
const BANNED = /what happens|When do you|What day|days are in a week|Which takes longer|Which is quicker|heavier|lighter|longer\?|shorter|bigger|smaller|holds (more|less)|\b(Sam|Mia) has\b|gives \d+ away|gets \d+ more|shared equally between|are shared|go in groups|more than \d+\?|less than \d+\?/;
const noBanned = (label, q) => { if (BANNED.test(q.question)) fail(label + ': banned question style', q); };

const age6Seen = {};
for (let i = 0; i < N; i++) {
  const q = Q.generateQuestion('age6'); let m;
  if (!common('age6', q)) continue;
  age6Seen[q.topic] = (age6Seen[q.topic] || 0) + 1;
  noBanned('age6', q);
  if (!q.simple || !q.topic || !q.kind || ![1, 2, 3].includes(q.tier)) fail('age6: missing simple/topic/kind/tier', q);
  if (['grouping', 'sharing', 'measurement', 'position'].includes(q.topic) || /^Counting from the left|^What number comes (after|before) |^Which way does the arrow point\?/.test(q.question)) fail('age6: excluded question type', q);
  if (/[×÷]/.test(q.question) || q.groups) fail('age6: no multiplication, division or compare-groups', q);
  if (q.topic === 'compare' || /^Compare|[<>]|^Which group has (more|fewer)/.test(q.question)) fail('age6: number comparison appeared', q);
  const n = Number(ans(q));
  switch (q.topic) {
    case 'counting': if (countX(q.picture.groups.flatMap(g => g.rows)) !== n || n < 1 || n > 20 || /\d/.test(q.picture.label)) fail('age6 counting', q); break;
    case 'subitising': {
      // "How many chicks?" shows ONLY chicks: one kind of object, no unrelated objects
      if (!q.visual || q.visual.length !== n || n < 1 || n > 5 || new Set(q.visual).size !== 1 || /\d/.test(q.visualLabel) || q.picture) fail('age6 subitising must show only the counted objects', q);
      break;
    }
    case 'sequences':
      { const s = q.numbers && readSequence(q.numbers); if (!s || Math.abs(s.step) !== 1 || s.answer !== n || Math.max(...s.values) > 20 || Math.min(...s.values) < 1) fail('age6 sequence', q); }
      break;
    case 'addsub':
      if (!(m = q.question.match(/^What is (\d+) ([+−]) (\d+)\?$/))) { fail('age6 addsub text', q); break; }
      { const a = Number(m[1]), b = Number(m[3]), r = m[2] === '+' ? a + b : a - b;
        if (r !== n || r < 0 || a > 10 || (m[2] === '+' && r > 10) || q.answers.some(x => Number(x) > 10)) fail('age6 within 10', q);
        if (q.kind === 'objects' && !(m[2] === '+' && q.stage && q.stage.baseCount === a && q.stage.change === b && q.stage.op === 'add' && q.stage.delayAdd && q.stage.added.emoji !== q.stage.base.emoji)) fail('age6 delayed object addition stage lost', q);
        if (q.kind === 'symbols' && (q.stage || q.picture)) fail('age6 symbolic question must have no illustration', q);
        if (q.kind === 'objects-sub') {
          // All starting objects are drawn, with cross-outs held for the shared teaching-aid delay.
          const cells = q.picture && q.picture.groups.length === 1 ? q.picture.groups[0].rows.join('') : '';
          if (m[2] !== '−' || q.stage || q.picture.immediate || /[^Xx.]/.test(cells) || (cells.match(/x/g) || []).length !== b || (cells.match(/X/g) || []).length !== r || a !== r + b) fail('age6 subtraction illustration must delay cross-outs of the removed objects', q);
          if (/\d/.test(q.picture.label)) fail('age6 subtraction illustration reveals the answer', q);
        } }
      break;
    case 'bonds':
      if ((m = q.question.match(/^Which two numbers make (\d+)\?$/))) {
        const pairSum = (t) => { const p = t.match(/^(\d+) and (\d+)$/); return p ? Number(p[1]) + Number(p[2]) : NaN; };
        if (pairSum(ans(q)) !== Number(m[1]) || Number(m[1]) > 10 || q.answers.some((a, i) => i !== q.correct && pairSum(a) === Number(m[1]))) fail('age6 bond', q);
      } else if ((m = q.question.match(/^(\d+) = (\d+) \+ \?$/))) { if (Number(m[1]) > 10 || n !== m[1] - m[2] || q.resultText !== `${m[1]} = ${m[2]} + ${n}`) fail('age6 partition equation', q); }
      else if ((m = q.question.match(/^(\d+) \+ \? = (\d+)$/))) { if (n !== m[2] - m[1] || Number(m[2]) > 10) fail('age6 missing part', q); }
      else if ((m = q.question.match(/^\? \+ (\d+) = (\d+)$/))) { if (n !== m[2] - m[1] || Number(m[2]) > 10) fail('age6 missing part', q); }
      else if ((m = q.question.match(/^(\d+) − \? = (\d+)$/))) { if (n !== m[1] - m[2] || Number(m[1]) > 10) fail('age6 missing subtrahend', q); }
      else fail('age6 bonds text', q);
      break;
    case 'patterns': if (!q.pattern || q.pattern[q.pattern.length - 1] !== null) fail('age6 pattern', q); break;
    case 'shapes': if (!q.figure && !q.answerVisuals) fail('age6 shapes', q); break;
    case 'money': checkMoney('age6', q, 100, [5, 10, 20, 50]); break;
    case 'data': checkData('age6', q, 10, true); break;
    default: fail('age6: unknown topic ' + q.topic, q);
  }
}
['counting', 'subitising', 'sequences', 'addsub', 'bonds', 'patterns', 'money', 'shapes', 'data']
  .forEach(t => { if ((age6Seen[t] || 0) < 40) fail('age6: topic too rare or missing: ' + t, age6Seen); });
// One unified pool: no stage or sub-level fields, difficulty only through tier.
for (let i = 0; i < 300; i++) { const q = Q.generateQuestion('age6'); if (q.stageLevel || q.level || q.subLevel) fail('age6: stages/sub-levels are not allowed', q); }

// ============================ GRADE 1 ============================
const g1Topics = Q.topicsFor('grade1').map(t => t.value).join();
if (g1Topics !== 'all,mixed,add,sub,numbers,fractions,money,clock,shapes') fail('grade1 topics', g1Topics);

function checkGrade1(topic, q) {
  const label = 'grade1/' + topic, text = q.question, n = Number(ans(q)); let m;
  if (/[×÷]/.test(text) || /^Compare/.test(text) || q.answers.includes(LESS)) return fail(label + ': multiplication/division/comparison', q);
  if (/^Which number word is \d+\?$|^Which number is ".+"\?$|^What number comes (after|before) \d+\?$|^Which way does the arrow point\?|^A \w+ is cut into 2 pieces\.|^How many (groups|each)\?$|^How many (?!altogether\b|cents\b|halves\b|10s\b|1s\b)[a-z]+\?$/.test(text)) fail(label + ': excluded English / standalone question type', q);
  if (['add', 'sub', 'mixed'].includes(topic) && text.length > 40) fail(label + ': question sentence too long (no stories)', q);
  noBanned(label, q);
  const arithmetic = () => {
    const checkOperands = (values, operator) => {
      if (!values.some(v => v >= 10 && v <= 19)) fail(label + ': arithmetic needs an operand from 10 to 19', q);
      if (values.some(v => v < 0 || v > 20)) fail(label + ': arithmetic operand outside 0 to 20', q);
      if (operator === '+' && values[0] + values[1] > 20) fail(label + ': addition above 20', q);
      if (operator === '−' && values[0] < values[1]) fail(label + ': negative subtraction', q);
    };
    if ((m = text.match(/^What is (\d+) ([+−]) (\d+)\?$/))) {
      const a = Number(m[1]), b = Number(m[3]), r = m[2] === '+' ? a + b : a - b;
      if (r !== n || r < 0 || a > 20 || b > 20 || (m[2] === '+' && r > 20)) fail(label + ': arithmetic', q);
      checkOperands([a, b], m[2]);
      return m[2];
    }
    if ((m = text.match(/^(\d+) \+ \? = (\d+)$/))) { const values = [Number(m[1]), n]; if (n !== m[2] - m[1] || Number(m[2]) > 20) fail(label + ': missing addend', q); checkOperands(values, '+'); return '+'; }
    if ((m = text.match(/^\? \+ (\d+) = (\d+)$/))) { const values = [n, Number(m[1])]; if (n !== m[2] - m[1] || Number(m[2]) > 20) fail(label + ': missing first addend', q); checkOperands(values, '+'); return '+'; }
    if ((m = text.match(/^(\d+) − \? = (\d+)$/))) { const values = [Number(m[1]), n]; if (n !== m[1] - m[2] || Number(m[1]) > 20 || m[2] < 0) fail(label + ': missing subtrahend', q); checkOperands(values, '−'); return '−'; }
    if ((m = text.match(/^\? − (\d+) = (\d+)$/))) { const values = [n, Number(m[1])]; if (n !== Number(m[2]) + Number(m[1]) || n > 20) fail(label + ': missing minuend', q); checkOperands(values, '−'); return '−'; }
    fail(label + ': arithmetic text not recognised', q);
    return null;
  };
  if (topic === 'add' || topic === 'sub' || topic === 'mixed') {
    const op = arithmetic();
    if (topic === 'add' && op !== '+') fail('grade1/add: only addition allowed', q);
    if (topic === 'sub' && op !== '−') fail('grade1/sub: only subtraction allowed', q);
    return;
  }
  if (topic === 'numbers') {
    if (q.numbers) {
      const s = readSequence(q.numbers);
      if (!s || s.answer !== n || Math.min(...s.values) < 1 || Math.max(...s.values) > 120) return fail(label + ': sequence', q);
      if (q.kind === 'skip' ? ![2, 5, 10].includes(Math.abs(s.step)) : Math.abs(s.step) !== 1) fail(label + ': sequence step/kind', q);
    } else if ((m = text.match(/^Which number is "(.+)"\?$/)) || (m = text.match(/^Which number word is (\d+)\?$/)) || (m = text.match(/^What number comes (after|before) (\d+)\?$/))) fail(label + ': excluded number words / before-after', q);
    else if ((m = text.match(/^(\d+) ([+−]) 10 = \?$/))) { const x = Number(m[1]); if (n !== (m[2] === '+' ? x + 10 : x - 10) || x > 120 || n > 120 || n < 0) fail(label + ': ten more/less as an equation', q); }
    else if ((m = text.match(/^10 \+ (\d+) = \?$/))) { const x = Number(m[1]); if (n !== x + 10 || x > 110) fail(label + ': ten more as an equation', q); }
    else if (q.topic === 'placevalue') {
      const pv = q.promptVisual;
      if (text === 'What number is shown?') { if (!pv || pv.tens * 10 + pv.ones !== n) fail(label + ': blocks', q); }
      else if (text === 'How many 10s?') { if (!pv || pv.tens !== n) fail(label + ': count tens', q); }
      else if (text === 'How many 1s?') { if (!pv || pv.ones !== n) fail(label + ': count ones', q); }
      else if ((m = text.match(/^(\d+) = (\d+) \+ \?$/))) { if (n !== m[1] - m[2] || m[2] % 10 !== 0) fail(label + ': partition', q); }
      else if ((m = text.match(/^(\d+) = \? \+ (\d+)$/))) { if (n !== m[1] - m[2] || n % 10 !== 0) fail(label + ': partition', q); }
      else if ((m = text.match(/^(\d+) = (\d+) tens and \? ones$/))) { if (n !== m[1] - 10 * m[2]) fail(label + ': tens and ones', q); }
      else if ((m = text.match(/^(\d+) = \? tens and (\d+) ones$/))) { if (10 * n + Number(m[2]) !== Number(m[1])) fail(label + ': tens and ones', q); }
      else if ((m = text.match(/^What is the value of the digit (\d) in (\d+)\?$/))) {
        const at = m[2].indexOf(m[1]);
        if (m[2].lastIndexOf(m[1]) !== at || n !== (at === 0 ? m[1] * 10 : Number(m[1]))) fail(label + ': digit value', q);
      } else if ((m = text.match(/^What number is (\d+) tens and (\d+) ones\?$/))) { if (n !== m[1] * 10 + Number(m[2])) fail(label + ': make number', q); }
      else fail(label + ': place value text', q);
      if (pv && pv.tens * 10 + pv.ones > 99) fail(label + ': blocks out of range', q);
    } else fail(label + ': numbers text not recognised', q);
    if (q.answers.every(isNum) && q.answers.some(a => Number(a) > 120)) fail(label + ': number above 120', q);
    return;
  }
  if (topic === 'fractions') {
    if (/third|quarter|fourth|\d\/\d|\d\.\d/.test(text + q.answers.join(' '))) return fail(label + ': only halves are allowed', q);
    if ((m = text.match(/^What is half of (\d+)\?$/))) { if (m[1] % 2 || m[1] > 20 || n !== m[1] / 2) fail(label + ': half', q); }
    else if (text === 'How many halves make one whole?') { if (n !== 2) fail(label + ': halves in a whole', q); }
    else fail(label + ': fractions text', q);
    return;
  }
  if (topic === 'money') return checkMoney(label, q, 300, [5, 10, 20, 50, 100, 200]);
  if (topic === 'clock') {
    const f = q.figure;
    if (!f || f.type !== 'clock' || ![0, 30].includes(f.minute) || ans(q) !== `${f.hour}:${String(f.minute).padStart(2, '0')}`) fail(label + ': clock (hour / half hour)', q);
    return;
  }
  if (topic === 'shapes') {
    if (q.figure) { if (q.figure.type !== 'polygon' || String(q.figure.sides) !== ans(q) || q.figure.sides < 3 || q.figure.sides > 6 || !/^How many (sides|corners) does this shape have\?$/.test(text)) fail(label + ': polygon', q); }
    else if (/^Counting from the left/.test(text)) checkPosition(label, q);
    else if (/^Which way does the arrow point\?/.test(text)) fail(label + ': direction identification excluded', q);
    else if (/cubes/.test(text)) checkBars(label, q, 12);
    else checkData(label, q, 20, false);
    return;
  }
  fail(label + ': unknown topic', q);
}

const g1Seen = {};
for (const t of ['mixed', 'add', 'sub', 'numbers', 'fractions', 'money', 'clock', 'shapes']) {
  for (let i = 0; i < N; i++) { const q = Q.generateQuestion('grade1', t); if (common('grade1/' + t, q)) { checkGrade1(t, q); if (!q.tier) fail('grade1/' + t + ': tier missing', q); g1Seen[q.topic] = (g1Seen[q.topic] || 0) + 1; } }
}
['addsub', 'placevalue', 'numbers', 'fractions', 'money', 'shapes', 'position', 'measurement', 'data'].forEach(t => { if (!g1Seen[t]) fail('grade1: topic never generated: ' + t, g1Seen); });
// Mixed All draws from every Grade 1 topic and nothing outside Grade 1 scope.
{
  const seen = {};
  for (let i = 0; i < N; i++) {
    const q = Q.generateQuestion('grade1', 'all');
    if (!common('grade1/all', q)) continue;
    const text = q.question + ' ' + q.answers.join(' ');
    if (/[×÷]/.test(q.question) || /^Compare/.test(q.question) || q.answers.includes(LESS) || NO_SMALL_COINS.test(text)) fail('grade1/all: out of scope question', q);
    if (/^Which number word is \d+\?|^Which number is ".+"\?|^What number comes (after|before) \d+\?|^Which way does the arrow point\?|^A \w+ is cut into 2 pieces\.|^How many (groups|each)\?$|^How many (?!altogether\b|cents\b|halves\b|10s\b|1s\b)[a-z]+\?$/.test(q.question)) fail('grade1/all: excluded question type', q);
    if (q.topic === 'addsub') checkGrade1('mixed', q);
    const cat = q.figure && q.figure.type === 'clock' ? 'clock' : q.topic === 'money' ? 'money' : q.topic === 'fractions' ? 'fractions' : ['numbers', 'placevalue'].includes(q.topic) ? 'numbers' : ['addsub', 'grouping', 'sharing'].includes(q.topic) ? 'arithmetic' : 'shapes';
    seen[cat] = (seen[cat] || 0) + 1;
    const n = Number(ans(q));
    if (q.topic === 'addsub' && /^What is \d+ \+ \d+\?$/.test(q.question)) { const [a, b] = q.question.match(/\d+/g).map(Number); if (a + b > 20 || a + b !== n) fail('grade1/all: addition above 20', q); }
  }
  ['arithmetic', 'numbers', 'fractions', 'money', 'clock', 'shapes'].forEach(c => { if ((seen[c] || 0) < 200) fail('grade1/all: category too rare: ' + c, seen); });
}

// A larger sample guards the Grade 1 mixed-pool arithmetic weighting against random noise.
{
  const sampleSize = 24000;
  const seen = { arithmetic: 0, numbers: 0, fractions: 0, money: 0, clock: 0, shapes: 0 };
  for (let i = 0; i < sampleSize; i++) {
    const q = Q.generateQuestion('grade1', 'all');
    const category = q.topic === 'addsub' ? 'arithmetic' : q.figure && q.figure.type === 'clock' ? 'clock' : ['numbers', 'placevalue'].includes(q.topic) ? 'numbers' : ['fractions', 'money'].includes(q.topic) ? q.topic : 'shapes';
    seen[category]++;
    if (category === 'arithmetic') checkGrade1('mixed', q);
  }
  const arithmeticShare = seen.arithmetic / sampleSize;
  const increaseFromCurrentEqualWeight = arithmeticShare / (1 / Object.keys(seen).length);
  if (increaseFromCurrentEqualWeight < 1.4 || increaseFromCurrentEqualWeight > 1.6) fail('grade1/all: arithmetic frequency should be about 50% above equal weighting', { seen, increaseFromCurrentEqualWeight });
  Object.entries(seen).forEach(([category, count]) => { if (count < 1000) fail('grade1/all frequency: category missing or too rare: ' + category, seen); });
}

// ============================ COMPARISONS ============================
// Grades 1-4: no standalone number comparison, no `compare` topic; an old saved selection falls back to Mixed All Questions.
for (const g of [1, 2, 3, 4]) {
  const level = 'grade' + g;
  if (Q.topicsFor(level).some(t => t.value === 'compare')) fail(level + ': compare topic is still offered', Q.topicsFor(level).map(t => t.value));
  if (Q.normaliseTopic(level, 'compare') !== 'all') fail(level + ': old compare selection not normalised', Q.normaliseTopic(level, 'compare'));
  for (const t of [...Q.topicsFor(level).map(x => x.value), 'compare']) {   // 'compare' = an old saved selection reaching the generator
    for (let i = 0; i < 1500; i++) {
      const q = Q.generateQuestion(level, t);
      if (!common(level + '/' + t, q)) continue;
      if (/^Compare/.test(q.question)) fail(level + '/' + t + ': standalone comparison', q);
      if (q.answers.includes(LESS) || q.answers.includes(EQUAL) || q.answers.includes(MORE)) fail(level + '/' + t + ': <, = or > answers', q);
    }
  }
}
// Grades 5-6: Fractions and Mixed All contain decimal-versus-fraction comparisons, and nothing else compares numbers.
for (const g of [5, 6]) {
  const level = 'grade' + g;
  if (Q.topicsFor(level).some(t => t.value === 'compare')) fail(level + ': general Comparing numbers topic exposed', {});
  for (const t of ['fractions', 'all']) {
    const seen = { [LESS]: 0, [EQUAL]: 0, [MORE]: 0 };
    let compares = 0;
    for (let i = 0; i < 6000; i++) {
      const q = Q.generateQuestion(level, t);
      if (!common(level + '/' + t, q)) continue;
      const m = q.question.match(/^Compare: (\S+) \? (\S+)$/);
      if (!m) { if (q.answers.includes(LESS)) fail(level + '/' + t + ': comparison answers on a non-comparison', q); continue; }
      compares++;
      const tokens = [m[1], m[2]], dec = tokens.filter(x => /^0\.\d{1,2}$/.test(x)), fr = tokens.filter(x => /^[1-9]\d*\/[1-9]\d*$/.test(x));
      if (dec.length !== 1 || fr.length !== 1) { fail(level + '/' + t + ': must compare ONE decimal with ONE fraction', q); continue; }
      const [fn, fd] = fr[0].split('/').map(Number);
      if (fn >= fd) fail(level + '/' + t + ': fraction should be below 1', q);
      const dv = Number(dec[0]), fv = fn / fd;
      const want = tokens[0] === dec[0] ? rel(Math.round(dv * 1e9), Math.round(fv * 1e9)) : rel(Math.round(fv * 1e9), Math.round(dv * 1e9));
      const exact = Math.abs(dv - fv) < 1e-9, expect = exact ? EQUAL : want;
      if (q.answers.join('|') !== [LESS, EQUAL, MORE].join('|') || ans(q) !== expect) fail(level + '/' + t + ': wrong comparison answer', q);
      seen[ans(q)]++;
    }
    if (compares < 100) fail(level + '/' + t + ': decimal/fraction comparisons too rare', compares);
    Object.entries(seen).forEach(([k, v]) => { if (v < 25) fail(level + '/' + t + ': relationship never/rarely generated: ' + k, seen); });
  }
}

// ============================ AGE 2-5 COMPARISON BEHAVIOUR IS UNCHANGED ============================
{
  const toddler = { groups: 0, counting: 0 }, age4 = new Set(), age5 = new Set(), age5Compare = { more: 0, fewer: 0 };
  for (let i = 0; i < 3000; i++) {
    const t = Q.generateQuestion('toddler'); if (t.groups) toddler.groups++; else toddler.counting++;
    if (t.topic || t.tier) fail('toddler gained Age 5/6 fields', t);
    const q4 = Q.generateQuestion('age4'); age4.add(q4.question); if (q4.topic) fail('age4 gained Age 5/6 fields', q4);
    const q5 = Q.generateQuestion('age5'); age5.add(q5.topic); if (q5.topic === 'compare') age5Compare[q5.kind]++;
    if (q5.stage) fail('age5 gained an object stage', q5);
  }
  if (!toddler.groups || !toddler.counting) fail('toddler pool changed (counting + "which group has more")', toddler);
  if (![...age4].some(x => /^Which group has more\?/.test(x))) fail('age4 lost "Which group has more?"', [...age4]);
  if ([...age5].sort().join() !== 'addition,compare,counting,grouping,patterns,placevalue,sequences,shapes,sharing,subtraction') fail('age5 topic set changed', [...age5]);
  if (!age5Compare.more || !age5Compare.fewer) fail('age5 more/fewer comparison changed', age5Compare);
}

console.log('curriculum checked: age6', JSON.stringify(age6Seen), 'grade1', JSON.stringify(g1Seen));
process.exit(bad ? 1 : 0);
