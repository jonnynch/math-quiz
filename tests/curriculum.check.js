// Curriculum scope: Age 6 and Grades 1-3, embedded Grade 2 comparisons,
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
  const starRow = q.picture?.groups?.some(group => group.emoji2 === '⭐' && group.rows?.some(row => /^[XY]+$/.test(row)));
  if (q.topic === 'position' && q.kind === 'place' || /^Counting from the left/i.test(q.question || '') || starRow) fail(label + ': ordinal star-position question generated', q);
  const a = q.answers;
  if (!Array.isArray(a) || a.length < 2 || a.length > 5) return fail(label + ': answer count', q), false;
  if (!(q.correct >= 0 && q.correct < a.length)) return fail(label + ': bad correct index', q), false;
  if (new Set(a).size !== a.length || a.some(x => typeof x !== 'string' || x.trim() === '')) return fail(label + ': duplicate/empty answer slot', q), false;
  if (a.every(isNum)) { const n = a.map(Number); if (n.some((v, i) => (v < 0 && !label.startsWith('grade6')) || (i && v <= n[i - 1]))) fail(label + ': numeric answers negative/not ascending', q); }
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
      if (!(m = q.question.match(/^(\d+) ([+−]) (\d+) = \?$/))) { fail('age6 addsub text', q); break; }
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
  if (text === 'How many 10s?' || text === 'How many 1s?') fail(label + ': excluded standalone tens/ones question', q);
  if (/[×÷]/.test(text) || /^Compare/.test(text) || q.answers.includes(LESS)) return fail(label + ': multiplication/division/comparison', q);
  if (/^Which number word is \d+\?$|^Which number is ".+"\?$|^What number comes (after|before) \d+\?$|^Which way does the arrow point\?|^A \w+ is cut into 2 pieces\.|^How many (groups|each)\?$|^How many (?!altogether\b|cents\b|halves\b|sides\b|corners\b)[a-z]+\?$/.test(text)) fail(label + ': excluded English / standalone question type', q);
  if (['add', 'sub', 'mixed'].includes(topic) && text.length > 40) fail(label + ': question sentence too long (no stories)', q);
  noBanned(label, q);
  const arithmetic = () => {
    const checkOperands = (values, operator) => {
      if (!values.some(v => v >= 10 && v <= 19)) fail(label + ': arithmetic needs an operand from 10 to 19', q);
      if (values.some(v => v < 0 || v > 20)) fail(label + ': arithmetic operand outside 0 to 20', q);
      if (operator === '+' && values[0] + values[1] > 20) fail(label + ': addition above 20', q);
      if (operator === '−' && values[0] < values[1]) fail(label + ': negative subtraction', q);
    };
    if ((m = text.match(/^(\d+) ([+−]) (\d+) = \?$/))) {
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
      if (text === 'What number is shown?') {
        if (!pv || !Number.isInteger(pv.tens) || !Number.isInteger(pv.ones) || pv.tens < 1 || pv.tens > 9 || pv.ones < 1 || pv.ones > 9 || pv.tens * 10 + pv.ones !== n) fail(label + ': full number must match tens-and-ones blocks', q);
      }
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
    const displayed = text + ' ' + q.answers.join(' ');
    if (/third|quarter|fourth|\b\d+\s*\/\s*\d+\b|\d\.\d/i.test(displayed)) return fail(label + ': only word-based halves are allowed', q);
    if ((m = text.match(/^one half of (\d+) = \?$/))) { if (m[1] % 2 || m[1] > 20 || n !== m[1] / 2) fail(label + ': half', q); }
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
    if (q.figure) { if (q.figure.type !== 'polygon' || String(q.figure.sides) !== ans(q) || q.figure.sides < 3 || q.figure.sides > 6 || !/^How many (sides|corners)\?$/.test(text)) fail(label + ': polygon', q); }
    else if (/cubes/.test(text)) checkBars(label, q, 12);
    else checkData(label, q, 20, false);
    return;
  }
  fail(label + ': unknown topic', q);
}

const g1Seen = {};
const g1ShownByPath = { numbers: 0, all: 0 };
for (const t of ['mixed', 'add', 'sub', 'numbers', 'fractions', 'money', 'clock', 'shapes']) {
  for (let i = 0; i < N; i++) { const q = Q.generateQuestion('grade1', t); if (common('grade1/' + t, q)) { checkGrade1(t, q); if (t === 'numbers' && q.question === 'What number is shown?') g1ShownByPath.numbers++; if (!q.tier) fail('grade1/' + t + ': tier missing', q); g1Seen[q.topic] = (g1Seen[q.topic] || 0) + 1; } }
}
['addsub', 'placevalue', 'numbers', 'fractions', 'money', 'shapes', 'measurement', 'data'].forEach(t => { if (!g1Seen[t]) fail('grade1: topic never generated: ' + t, g1Seen); });
// Mixed All draws from every Grade 1 topic and nothing outside Grade 1 scope.
{
  const seen = {};
  for (let i = 0; i < N; i++) {
    const q = Q.generateQuestion('grade1', 'all');
    if (!common('grade1/all', q)) continue;
    const text = q.question + ' ' + q.answers.join(' ');
    if (/[×÷]/.test(q.question) || /^Compare/.test(q.question) || q.answers.includes(LESS) || NO_SMALL_COINS.test(text)) fail('grade1/all: out of scope question', q);
    if (/^Which number word is \d+\?|^Which number is ".+"\?|^What number comes (after|before) \d+\?|^Which way does the arrow point\?|^A \w+ is cut into 2 pieces\.|^How many (groups|each)\?$|^How many (?!altogether\b|cents\b|halves\b|sides\b|corners\b)[a-z]+\?$/.test(q.question)) fail('grade1/all: excluded question type', q);
    if (q.topic === 'placevalue' && q.question === 'What number is shown?') g1ShownByPath.all++;
    if (q.topic === 'addsub') checkGrade1('mixed', q);
    else if (q.topic === 'numbers' || q.topic === 'placevalue') checkGrade1('numbers', q);
    const cat = q.figure && q.figure.type === 'clock' ? 'clock' : q.topic === 'money' ? 'money' : q.topic === 'fractions' ? 'fractions' : ['numbers', 'placevalue'].includes(q.topic) ? 'numbers' : ['addsub', 'grouping', 'sharing'].includes(q.topic) ? 'arithmetic' : 'shapes';
    seen[cat] = (seen[cat] || 0) + 1;
    const n = Number(ans(q));
    if (q.topic === 'addsub' && /^\d+ \+ \d+ = \?$/.test(q.question)) { const [a, b] = q.question.match(/\d+/g).map(Number); if (a + b > 20 || a + b !== n) fail('grade1/all: addition above 20', q); }
  }
  ['arithmetic', 'numbers', 'fractions', 'money', 'clock', 'shapes'].forEach(c => { if ((seen[c] || 0) < 200) fail('grade1/all: category too rare: ' + c, seen); });
}
Object.entries(g1ShownByPath).forEach(([path, count]) => { if (!count) fail('grade1/' + path + ': no full-number tens-and-ones question was checked', g1ShownByPath); });

// A larger sample guards the Grade 1 mixed-pool arithmetic weighting against random noise.
{
  const sampleSize = 24000;
  const seen = { arithmetic: 0, numbers: 0, fractions: 0, money: 0, clock: 0, shapes: 0 };
  for (let i = 0; i < sampleSize; i++) {
    const q = Q.generateQuestion('grade1', 'all');
    common('grade1/all repeated sample', q);
    const category = q.topic === 'addsub' ? 'arithmetic' : q.figure && q.figure.type === 'clock' ? 'clock' : ['numbers', 'placevalue'].includes(q.topic) ? 'numbers' : ['fractions', 'money'].includes(q.topic) ? q.topic : 'shapes';
    seen[category]++;
    if (category === 'arithmetic') checkGrade1('mixed', q);
  }
  const arithmeticShare = seen.arithmetic / sampleSize;
  const increaseFromCurrentEqualWeight = arithmeticShare / (1 / Object.keys(seen).length);
  if (increaseFromCurrentEqualWeight < 1.4 || increaseFromCurrentEqualWeight > 1.6) fail('grade1/all: arithmetic frequency should be about 50% above equal weighting', { seen, increaseFromCurrentEqualWeight });
  Object.entries(seen).forEach(([category, count]) => { if (count < 1000) fail('grade1/all frequency: category missing or too rare: ' + category, seen); });
}

// ============================ GRADE 2 ============================
const grade2Topics = Q.topicsFor('grade2').map(t => t.value);
['numbers', 'patterns', 'data', 'tables', 'fractions', 'clock', 'shapes'].forEach(t => { if (!grade2Topics.includes(t)) fail('grade2 topic missing: ' + t, grade2Topics); });
const g2Kinds = {};
const fractionValue = text => {
  const raw = String(text), m = raw.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const words = { 'one half': 0.5, 'two halves': 1, 'one quarter': 0.25, 'two quarters': 0.5, 'three quarters': 0.75, 'one eighth': 0.125, 'two eighths': 0.25, 'three eighths': 0.375, 'four eighths': 0.5, 'five eighths': 0.625, 'six eighths': 0.75, 'seven eighths': 0.875 };
  return words[raw] ?? NaN;
};
function checkGrade2Arithmetic(label, q, allowed = ['+', '−', '×', '÷']) {
  const text = q.question, n = Number(ans(q)); let m, op, a, b, expected;
  if ((m = text.match(/^(\d+) ([+−×÷]) (\d+) = \?$/))) {
    a = Number(m[1]); op = m[2]; b = Number(m[3]);
    expected = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    if (!allowed.includes(op) || expected !== n || !Number.isInteger(expected) || expected < 0) fail(label + ': arithmetic equation', q);
    if (op === '+' && !((a >= 10 && b >= 10 && a < 100 && b < 100 && expected <= 150) || (a % 10 === 0 && b % 10 === 0 && expected <= 800))) fail(label + ': addition outside mental range', q);
    if (op === '−' && (a < b || !((a >= 10 && b >= 10 && a < 100 && b < 100) || (a % 10 === 0 && b % 10 === 0)))) fail(label + ': subtraction outside mental range', q);
    if ((op === '×' || op === '÷') && (Math.max(a, b) > 100 || (op === '×' && ![2, 5, 10].includes(a) && ![2, 5, 10].includes(b)) || (op === '÷' && a % b !== 0))) fail(label + ': fact outside Grade 2 tables', q);
  } else if ((m = text.match(/^\? × (2|5|10) = (\d+)$/))) {
    b = Number(m[1]); expected = Number(m[2]); if (n * b !== expected || n > 10) fail(label + ': missing factor', q);
  } else if ((m = text.match(/^(\d+) ÷ \? = (\d+)$/))) {
    a = Number(m[1]); expected = Number(m[2]); if (a / n !== expected || ![2, 5, 10].includes(n)) fail(label + ': missing divisor', q);
  } else if ((m = text.match(/^(\d+) \+ \? = (\d+)$/))) {
    a = Number(m[1]); expected = Number(m[2]); if (a + n !== expected) fail(label + ': missing addend', q);
  } else if ((m = text.match(/^\? \+ (\d+) = (\d+)$/))) {
    b = Number(m[1]); expected = Number(m[2]); if (n + b !== expected) fail(label + ': missing first addend', q);
  } else if ((m = text.match(/^(\d+) − \? = (\d+)$/))) {
    a = Number(m[1]); expected = Number(m[2]); if (a - n !== expected || n < 0) fail(label + ': missing subtrahend', q);
  } else if ((m = text.match(/^(\d+) \+ (\d+) = (\d+), so (\d+) − (\d+) = \?$/))) {
    a = Number(m[1]); b = Number(m[2]); expected = Number(m[3]); if (a + b !== expected || Number(m[4]) - Number(m[5]) !== n) fail(label + ': addition/subtraction inverse', q);
  } else if ((m = text.match(/^(\d+) − (\d+) = (\d+), so (\d+) \+ (\d+) = \?$/))) {
    a = Number(m[1]); b = Number(m[2]); expected = Number(m[3]); if (a - b !== expected || Number(m[4]) + Number(m[5]) !== n || n !== a) fail(label + ': subtraction/addition inverse', q);
  } else fail(label + ': unrecognised arithmetic wording', q);
  if (text.length > 80) fail(label + ': arithmetic prompt too long', q);
}
function checkGrade2(label, topic, q) {
  if (!q.question || q.question.length > 80) fail(label + ': prompt too long or missing', q);
  if (/[√²³]|probability|quadratic|decimal/i.test(q.question)) fail(label + ': excluded higher-grade content', q);
  const n = Number(ans(q)), text = q.question;
  if (['mixed', 'add', 'sub', 'mul', 'div'].includes(topic)) return checkGrade2Arithmetic(label, q, topic === 'add' ? ['+'] : topic === 'sub' ? ['−'] : topic === 'mul' ? ['×'] : topic === 'div' ? ['÷'] : undefined);
  if (topic === 'tables') {
    checkGrade2Arithmetic(label, q, ['×', '÷']);
    if (q.picture) {
      const rows = q.picture.groups[0].rows;
      if (!rows.length || rows.some(row => row.length !== rows[0].length) || rows.join('').length !== n) fail(label + ': array does not represent product', q);
    }
    return;
  }
  if (topic === 'numbers') {
    g2Kinds['numbers/' + q.kind] = (g2Kinds['numbers/' + q.kind] || 0) + 1;
    let m;
    if ((m = text.match(/^What number is (\d+) tens and (\d+) ones\?$/))) { if (Number(m[1]) * 10 + Number(m[2]) !== n || n < 20 || n > 99) fail(label + ': two-digit place value', q); }
    else if ((m = text.match(/^What number is (\d+) hundreds, (\d+) tens and (\d+) ones\?$/))) { if (Number(m[1]) * 100 + Number(m[2]) * 10 + Number(m[3]) !== n || n < 100 || n > 999) fail(label + ': three-digit place value', q); }
    else if ((m = text.match(/^(\d+) = \?$/))) { if (q.answers[q.correct].split(' + ').reduce((s, x) => s + Number(x), 0) !== Number(m[1])) fail(label + ': expanded notation', q); }
    else if ((m = text.match(/^□00 \+ (\d+) \+ (\d+) = (\d+)$/))) { if (n * 100 + Number(m[1]) + Number(m[2]) !== Number(m[3])) fail(label + ': missing hundreds', q); }
    else if ((m = text.match(/^(\d+) \+ □0 \+ (\d+) = (\d+)$/))) { if (Number(m[1]) + n * 10 + Number(m[2]) !== Number(m[3])) fail(label + ': missing tens', q); }
    else if ((m = text.match(/^Compare: (\d+) \? (\d+)$/))) { if (ans(q) !== (Number(m[1]) < Number(m[2]) ? LESS : Number(m[1]) > Number(m[2]) ? MORE : EQUAL)) fail(label + ': number comparison', q); }
    else if (text === 'Order from smallest to largest.') { const values = ans(q).split(',').map(Number); if (values.length !== 3 || values.some((v, i) => i && v <= values[i - 1])) fail(label + ': number ordering', q); }
    else if (q.numbers) { const s = readSequence(q.numbers); if (!s || s.answer !== n || Math.abs(s.step) > 50 || Math.max(...s.values) > 999) fail(label + ': number sequence', q); }
    else fail(label + ': unknown number/place-value question', q);
    return;
  }
  if (topic === 'fractions') {
    g2Kinds['fractions/' + q.kind] = (g2Kinds['fractions/' + q.kind] || 0) + 1;
    let m;
    if ((m = text.match(/^(one half|one quarter|one eighth) of (\d+) = \?$/))) { const divisor = { 'one half': 2, 'one quarter': 4, 'one eighth': 8 }[m[1]]; if (Number(m[2]) / divisor !== n || Number(m[2]) % divisor) fail(label + ': unit fraction amount', q); }
    else if (text === 'What fraction of the shape is shaded?') { if (!q.figure || q.figure.type !== 'fraction' || Math.abs(fractionValue(ans(q)) - q.figure.numerator / q.figure.denominator) > 1e-9) fail(label + ': equal-parts fraction diagram', q); }
    else if (text === 'one half = how many quarters') { if (n !== 2) fail(label + ': equivalent halves and quarters', q); }
    else if ((m = text.match(/^Compare: (.+) \? (.+)$/))) { const left = fractionValue(m[1]), right = fractionValue(m[2]), correct = left < right ? LESS : left > right ? MORE : EQUAL; if (!Number.isFinite(left) || !Number.isFinite(right) || ans(q) !== correct) fail(label + ': fraction comparison', q); }
    else fail(label + ': unknown Grade 2 fraction question', q);
    return;
  }
  if (topic === 'clock') { if (!q.figure || q.figure.type !== 'clock' || q.figure.minute % 5 || ans(q) !== `${q.figure.hour}:${String(q.figure.minute).padStart(2, '0')}`) fail(label + ': five-minute clock reading', q); return; }
  if (topic === 'shapes') {
    g2Kinds['shapes/' + q.kind] = (g2Kinds['shapes/' + q.kind] || 0) + 1;
    if (q.kind === 'polygon') { if (!q.figure || q.figure.type !== 'polygon' || String(q.figure.sides) !== ans(q)) fail(label + ': 2D shape', q); }
    else if (q.kind === 'solid') { if (!q.picture || q.picture.label !== 'A ' + ans(q)) fail(label + ': 3D solid identification', q); }
    else if (q.kind === 'measure') { const m = text.match(/^Compare: (\d+) (cm|kg|L) \? (\d+) \2$/); if (!m || ans(q) !== (Number(m[1]) < Number(m[3]) ? LESS : Number(m[1]) > Number(m[3]) ? MORE : EQUAL)) fail(label + ': measurement comparison', q); }
    else if (q.kind === 'perimeter') { if (!q.figure || q.figure.type !== 'perimeter' || n !== 2 * (q.figure.length + q.figure.width)) fail(label + ': rectangle perimeter', q); }
    else if (q.kind === 'symmetry') { const shape = text.match(/^(triangle|square|rectangle): lines of symmetry = \?$/)?.[1], sides = { triangle: 3, square: 4, rectangle: 2 }[shape]; if (!q.figure || Number(ans(q)) !== sides) fail(label + ': symmetry', q); }
    else if (q.kind === 'identify') { const names = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' }; if (!q.figure || names[q.figure.sides] !== ans(q)) fail(label + ': 2D shape identification', q); }
    else fail(label + ': unknown Grade 2 shape/measure question', q);
    return;
  }
  if (topic === 'patterns') {
    g2Kinds['patterns/' + q.kind] = (g2Kinds['patterns/' + q.kind] || 0) + 1;
    const period = q.kind.length, base = q.pattern && q.pattern.slice(0, period).map(v => v.label);
    if (!q.pattern || q.pattern.length !== 6 || q.pattern[5] !== null || !q.answerVisuals || q.answerVisuals[q.correct].label !== base[5 % period]) fail(label + ': repeating visual pattern', q);
    return;
  }
  if (topic === 'data') {
    g2Kinds['data/' + q.kind] = (g2Kinds['data/' + q.kind] || 0) + 1;
    const f = q.figure; if (!f || f.type !== 'bar-chart' || f.values.length !== 3) return fail(label + ': bar chart missing', q);
    let expected;
    if (q.kind === 'read') { const word = text.match(/^How many (books|games|balls)\?$/)?.[1]; expected = f.values[f.labels.findIndex(x => x.toLowerCase() === word)]; }
    else if (q.kind === 'most') expected = f.labels[f.values.indexOf(Math.max(...f.values))];
    else if (q.kind === 'total') expected = f.values.reduce((a, b) => a + b, 0);
    else expected = Math.max(...f.values) - Math.min(...f.values);
    if (String(expected) !== ans(q)) fail(label + ': bar chart answer', q);
    return;
  }
}
if (grade2Topics.includes('numbers')) {
  for (const topic of grade2Topics.filter(t => t !== 'all')) {
    for (let i = 0; i < 1000; i++) checkGrade2('grade2/' + topic, topic, Q.generateQuestion('grade2', topic));
  }
  const seen = { arithmetic: 0, tables: 0, numbers: 0, fractions: 0, money: 0, clock: 0, shapes: 0, patterns: 0, data: 0 };
  for (let i = 0; i < 12000; i++) {
    const q = Q.generateQuestion('grade2', 'all');
    const category = q.topic === 'numbers' || q.topic === 'patterns' || q.topic === 'data' || q.topic === 'tables' || q.topic === 'fractions' || q.topic === 'shapes'
      ? q.topic : q.figure && q.figure.type === 'clock' ? 'clock' : /cents/.test(q.question) ? 'money' : 'arithmetic';
    seen[category]++;
    if (q.topic === 'numbers' || q.topic === 'patterns' || q.topic === 'data' || q.topic === 'shapes' || q.topic === 'fractions') checkGrade2('grade2/all', q.topic, q);
    else if (category === 'arithmetic') checkGrade2Arithmetic('grade2/all', q);
  }
  Object.entries(seen).forEach(([category, count]) => { if (count < 150) fail('grade2/all: category missing or too rare: ' + category, seen); });
  Object.entries(g2Kinds).forEach(([kind, count]) => { if (!count) fail('grade2: question kind never generated: ' + kind, g2Kinds); });
}

// ============================ GRADE 3 ============================
const grade3Topics = Q.topicsFor('grade3').map(t => t.value);
['numbers', 'patterns', 'data', 'tables', 'fractions', 'clock', 'shapes'].forEach(t => { if (!grade3Topics.includes(t)) fail('grade3 topic missing: ' + t, grade3Topics); });
const g3Kinds = {};
function checkGrade3(label, topic, q) {
  if (!q.question || q.question.length > 80) fail(label + ': prompt too long or missing', q);
  const text = q.question, n = Number(ans(q)); let m;
  if (['mixed', 'add', 'sub', 'mul', 'div'].includes(topic)) {
    if ((m = text.match(/^([?\d,]+) ([+−×÷]) ([?\d,]+) = \?$/))) {
      const a = Number(m[1].replace(/,/g, '')), b = Number(m[3].replace(/,/g, '')), op = m[2], result = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
      if (result !== n || !Number.isInteger(result) || result < 0 || (topic === 'add' && op !== '+') || (topic === 'sub' && op !== '−') || (topic === 'mul' && op !== '×') || (topic === 'div' && op !== '÷')) fail(label + ': arithmetic equation', q);
      if ((op === '+' || op === '−') && (Math.max(a, b, n) > 1000 || (op === '−' && a < b))) fail(label + ': arithmetic exceeds manageable three-digit range', q);
      if (op === '×' && !((a >= 2 && a <= 10 && b >= 2 && b <= 10) || (a >= 21 && a <= 29 && b >= 2 && b <= 4) || (b >= 21 && b <= 29 && a >= 2 && a <= 4))) fail(label + ': multiplication range', q);
      if (op === '÷' && (a % b !== 0 || b < 2 || b > 10)) fail(label + ': division not exact/known fact', q);
    } else if ((m = text.match(/^([?\d]+) × \? = (\d+)$/))) { if (Number(m[1]) * n !== +m[2]) fail(label + ': missing factor', q); }
    else if ((m = text.match(/^([?\d]+) ÷ \? = (\d+)$/))) { if (+m[1] / n !== +m[2]) fail(label + ': missing divisor', q); }
    else if ((m = text.match(/^\? \+ (\d+) = (\d+)$/))) { if (n + +m[1] !== +m[2]) fail(label + ': missing addend', q); }
    else if ((m = text.match(/^(\d+) \+ \? = (\d+)$/))) { if (+m[1] + n !== +m[2]) fail(label + ': missing addend', q); }
    else if ((m = text.match(/^(\d+) − \? = (\d+)$/))) { if (+m[1] - n !== +m[2]) fail(label + ': missing subtrahend', q); }
    else if ((m = text.match(/^(\d+) \+ (\d+) = (\d+), so (\d+) − (\d+) = \?$/))) { if (+m[1] + +m[2] !== +m[3] || +m[4] - +m[5] !== n) fail(label + ': inverse fact', q); }
    else if ((m = text.match(/^(\d+) − (\d+) = (\d+), so (\d+) \+ (\d+) = \?$/))) { if (+m[1] - +m[2] !== +m[3] || +m[4] + +m[5] !== n || n !== +m[1]) fail(label + ': inverse fact', q); }
    else fail(label + ': unsupported arithmetic format', q);
    return;
  }
  if (topic === 'numbers') {
    g3Kinds['numbers/' + q.kind] = (g3Kinds['numbers/' + q.kind] || 0) + 1;
    if (q.kind === 'round10' || q.kind === 'round100') { const step = q.kind === 'round10' ? 10 : 100, value = Number(text.match(/^[\d,]+/)[0].replace(/,/g, '')); if (Math.round(value / step) * step !== n) fail(label + ': rounding', q); }
    else if (q.kind === 'sequence') { const hole = q.numbers.indexOf('?'), vals = q.numbers.map(Number), indexes = vals.map((v, i) => Number.isFinite(v) ? [i, v] : null).filter(Boolean), step = (indexes[1][1] - indexes[0][1]) / (indexes[1][0] - indexes[0][0]); if (hole < 0 || q.numbers.filter(x => x === '?').length !== 1 || Number(q.numbers[0]) + hole * step !== n || Math.abs(step) > 500) fail(label + ': varied interval sequence', q); }
    else if (q.kind === 'recognise') { const words = text.match(/^What number is (.+)\?$/)?.[1].split(', ').map(x => Number(x.match(/^\d+/)?.[0]) * ({ thousand: 1000, thousands: 1000, hundred: 100, hundreds: 100, ten: 10, tens: 10, one: 1, ones: 1 }[x.replace(/^\d+ /, '')] || 0)); if (!words || sum(words) !== n) fail(label + ': number recognition/place value', q); }
    else if (q.kind === 'expanded') { const expected = text.match(/^([\d,]+) = \?$/), sumParts = ans(q).split(' + ').reduce((s, x) => s + Number(x), 0); if (!expected || Number(expected[1].replace(/,/g, '')) !== sumParts) fail(label + ': expanded notation', q); }
    else if (q.kind === 'missingPlace') { const parts = text.match(/^([\d□ +]+) = (\d+)$/), terms = parts && parts[1].split(' + '); if (!terms || terms.filter(x => x === '□').length !== 1 || terms.reduce((sum, x) => sum + (x === '□' ? n : Number(x)), 0) !== +parts[2]) fail(label + ': missing place value', q); }
    else if (q.kind === 'compare') { const a = Number(text.match(/^Compare: (\d+)/)[1]), b = Number(text.match(/\? (\d+)$/)[1]); if (ans(q) !== (a < b ? LESS : a > b ? MORE : EQUAL)) fail(label + ': comparison', q); }
    else if (q.kind === 'order') { const xs = ans(q).split(',').map(Number); if (xs.length !== 3 || xs.some((x, i) => i && x <= xs[i - 1])) fail(label + ': ordering', q); }
    else fail(label + ': unknown number kind', q);
    return;
  }
  if (topic === 'tables' || topic === 'mul' || topic === 'div') {
    g3Kinds['tables/' + q.kind] = (g3Kinds['tables/' + q.kind] || 0) + 1;
    if (q.kind === 'twoDigit' && !/^\d{2} × [234] = \?$/.test(text)) fail(label + ': two-digit multiplication', q);
    return;
  }
  if (topic === 'fractions') {
    g3Kinds['fractions/' + q.kind] = (g3Kinds['fractions/' + q.kind] || 0) + 1;
    if (q.kind === 'diagram') { const f = q.figure; if (!f || f.type !== 'fraction' || Math.abs(f.numerator / f.denominator - fractionValue(ans(q))) > 1e-9) fail(label + ': fraction diagram', q); }
    else if (q.kind === 'amount') { const x = text.match(/^(\d+)\/(\d+) of (\d+) = \?$/); if (!x || +x[1] * +x[3] / +x[2] !== n) fail(label + ': fraction amount', q); }
    else if (q.kind === 'equivalent') { const x = text.match(/^(\d+)\/(\d+) = \?\/(\d+)$/); if (!x || +x[1] / +x[2] !== n / +x[3]) fail(label + ': equivalent fractions', q); }
    else if (q.kind === 'compare') { const x = text.match(/^Compare: (\d+)\/(\d+) \? (\d+)\/(\d+)$/), left = +x[1] / +x[2], right = +x[3] / +x[4]; if (!x || ans(q) !== (left < right ? LESS : left > right ? MORE : EQUAL)) fail(label + ': fraction comparison', q); }
    else fail(label + ': unknown fraction format', q);
    return;
  }
  if (topic === 'patterns') { g3Kinds['patterns/' + q.kind] = (g3Kinds['patterns/' + q.kind] || 0) + 1; const hole = q.numbers.indexOf('?'), known = q.numbers.map((v, i) => [i, Number(v)]).filter(([i]) => i !== hole), gap = known[1][0] - known[0][0], ratio = (known[1][1] / known[0][1]) ** (1 / gap), start = Number(q.numbers[0]); if (q.kind !== 'multiplySequence' || hole < 1 || !Number.isInteger(ratio) || ratio < 2 || ratio > 3 || known.some(([i, v]) => v !== start * ratio ** i) || n !== Number(q.numbers[hole - 1]) * ratio) fail(label + ': multiplication sequence', q); return; }
  if (topic === 'data') { g3Kinds['data/' + q.kind] = (g3Kinds['data/' + q.kind] || 0) + 1; const f = q.figure; if (!f || f.type !== 'bar-chart' || f.values.length !== 4 || f.labels.join() !== 'Apples,Pears,Plums,Bananas') fail(label + ': bar chart', q); else if (q.kind === 'total' && n !== sum(f.values) || q.kind === 'difference' && n !== Math.max(...f.values) - Math.min(...f.values) || q.kind === 'read' && !f.values.includes(n) || q.kind === 'most' && !f.labels.includes(ans(q))) fail(label + ': chart answer', q); return; }
  if (topic === 'clock') { g3Kinds['clock/' + q.kind] = (g3Kinds['clock/' + q.kind] || 0) + 1; if (q.kind === 'elapsed') { const x = text.match(/^(\d+) h (\d+) min = \? min$/); if (!x || +x[1] * 60 + +x[2] !== n) fail(label + ': hour/minute calculation', q); } else if (!q.figure || ans(q) !== `${q.figure.hour}:${String(q.figure.minute).padStart(2, '0')}`) fail(label + ': clock reading', q); return; }
  if (topic === 'shapes') {
    g3Kinds['shapes/' + q.kind] = (g3Kinds['shapes/' + q.kind] || 0) + 1; const f = q.figure;
    if (q.kind === 'area' && (!f || f.type !== 'grid-area' || n !== f.rows * f.cols)) fail(label + ': unit square area', q);
    else if (q.kind === 'perimeter' && (!f || f.type !== 'perimeter' || n !== 2 * (f.length + f.width))) fail(label + ': perimeter', q);
    else if (q.kind === 'angle' && (!f || f.type !== 'angle' || ans(q) !== (f.degrees < 90 ? 'acute' : f.degrees === 90 ? 'right' : 'obtuse'))) fail(label + ': angle recognition', q);
    else if (q.kind === 'convert' && !/^\d+ m = \? cm$/.test(text) || q.kind === 'convert' && n !== Number(text.match(/^(\d+)/)[1]) * 100) fail(label + ': metric conversion', q);
    else if (q.kind === 'solid' && !/^(faces|edges|vertices) of a /.test(text)) fail(label + ': solid properties', q);
    else if (q.kind === 'polygon' && !/^Sides of /.test(text)) fail(label + ': polygon', q);
    else if (q.kind === 'measure' && !/^Compare: /.test(text)) fail(label + ': measurement comparison', q);
    return;
  }
}
for (const topic of grade3Topics.filter(t => t !== 'all')) for (let i = 0; i < 1000; i++) checkGrade3('grade3/' + topic, topic, Q.generateQuestion('grade3', topic));
const g3Seen = {};
for (let i = 0; i < 12000; i++) {
  const q = Q.generateQuestion('grade3', 'all');
  const topic = ['numbers', 'patterns', 'data', 'tables', 'fractions', 'clock', 'shapes'].includes(q.topic) ? q.topic : /cents/.test(q.question) ? 'money' : 'mixed';
  g3Seen[topic] = (g3Seen[topic] || 0) + 1;
  if (topic !== 'money') checkGrade3('grade3/all', topic, q);
}
for (const topic of ['mixed', 'numbers', 'patterns', 'data', 'tables', 'fractions', 'money', 'clock', 'shapes']) if ((g3Seen[topic] || 0) < 500) fail('grade3/all category too rare: ' + topic, g3Seen);
for (const topic of ['mixed', 'add', 'sub', 'mul', 'div']) {
  const sample = Array.from({ length: 4000 }, () => Q.generateQuestion('grade3', topic));
  if ((topic === 'mixed' || topic === 'add' || topic === 'sub') && sample.some(q => /[√²³]|probability|quadratic|decimal|long division/i.test(q.question))) fail('grade3 arithmetic excluded concept', sample.find(q => /[√²³]|probability|quadratic|decimal|long division/i.test(q.question)));
}
const g3MixedSample = Array.from({ length: 6000 }, () => Q.generateQuestion('grade3', 'mixed'));
const g3Multiplicative = g3MixedSample.filter(q => /[×÷]/.test(q.question) || /(?:× \?|÷ \?)/.test(q.question)).length;
if (g3Multiplicative < 2400 || g3Multiplicative > 3600) fail('grade3 mixed: multiplication and division should remain balanced with addition/subtraction', { g3Multiplicative, sample: g3MixedSample.length });
for (const prefix of ['fractions/', 'shapes/', 'tables/', 'patterns/', 'data/', 'clock/']) for (const [kind, count] of Object.entries(g3Kinds)) if (kind.startsWith(prefix) && count < 10) fail('grade3 kind too rare: ' + kind, count);

// ============================ GRADE 4 ============================
const grade4Topics = Q.topicsFor('grade4').map(t => t.value), g4Kinds = {};
['numbers', 'patterns', 'tables', 'fractions', 'decimals', 'clock', 'shapes'].forEach(t => { if (!grade4Topics.includes(t)) fail('grade4 topic missing: ' + t, grade4Topics); });
if (Q.topicsFor('grade3').some(t => t.value === 'decimals') || !Q.topicsFor('grade4').some(t => t.value === 'decimals') || !Q.topicsFor('grade5').some(t => t.value === 'decimals')) fail('decimals topic should be offered in Grades 4 and 5', {});
function checkGrade4(label, topic, q) {
  if (!q.question || q.question.length > 90 || /quadratic|square root|factorisation|long division/i.test(q.question)) fail(label + ': prompt length or excluded content', q);
  const text = q.question, n = Number(ans(q)); let m;
  if (['mixed', 'add', 'sub', 'mul', 'div'].includes(topic)) {
    if ((m = text.match(/^(\d+) ([+−×÷]) (\d+) = \?$/))) {
      const a = +m[1], b = +m[3], op = m[2], expected = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
      if (expected !== n || !Number.isInteger(expected) || expected < 0 || (topic === 'add' && op !== '+') || (topic === 'sub' && op !== '−') || (topic === 'mul' && op !== '×') || (topic === 'div' && op !== '÷')) fail(label + ': arithmetic equation', q);
      if ((op === '+' || op === '−') && (a < 100 || b < 100 || Math.max(a, b, n) > 999)) fail(label + ': addition/subtraction outside three digits', q);
      if (op === '×' && !((a >= 12 && a <= 35 && b >= 2 && b <= 6) || (b >= 12 && b <= 35 && a >= 2 && a <= 6))) fail(label + ': multiplication outside mental range', q);
      if (op === '÷' && (a % b !== 0 || b < 2 || b > 9 || n < 12 || n > 24)) fail(label + ': division must be exact by one digit', q);
    } else if ((m = text.match(/^□ × (\d+) = (\d+)$/))) { if (n * +m[1] !== +m[2] || n < 12 || n > 35) fail(label + ': missing factor', q); }
    else if ((m = text.match(/^([\d]+) ÷ □ = (\d+)$/))) { if (+m[1] / n !== +m[2] || n < 2 || n > 9) fail(label + ': missing divisor', q); }
    else if ((m = text.match(/^□ \+ (\d+) = (\d+)$/))) { if (n + +m[1] !== +m[2]) fail(label + ': missing addend', q); }
    else if ((m = text.match(/^(\d+) \+ □ = (\d+)$/))) { if (+m[1] + n !== +m[2]) fail(label + ': missing addend', q); }
    else if ((m = text.match(/^(\d+) − □ = (\d+)$/))) { if (+m[1] - n !== +m[2]) fail(label + ': missing subtrahend', q); }
    else if ((m = text.match(/^(\d+) \+ (\d+) = (\d+), so (\d+) − (\d+) = \?$/))) { if (+m[1] + +m[2] !== +m[3] || +m[4] - +m[5] !== n) fail(label + ': inverse operation', q); }
    else if ((m = text.match(/^(\d+) − (\d+) = (\d+), so (\d+) \+ (\d+) = \?$/))) { if (+m[1] - +m[2] !== +m[3] || +m[4] + +m[5] !== n) fail(label + ': inverse operation', q); }
    else fail(label + ': unknown arithmetic format', q);
    if (q.answers.every(isNum) && !q.answers.some((value, i) => i !== q.correct && value.slice(-1) === ans(q).slice(-1))) fail(label + ': no same-last-digit distractor', q);
    return;
  }
  if (topic === 'tables') {
    if ((m = text.match(/^(\d+) ([×÷]) (\d+) = \?$/))) { const expected = m[2] === '×' ? +m[1] * +m[3] : +m[1] / +m[3], inTables = m[2] === '×' ? Math.max(+m[1], +m[3]) <= 10 : (+m[1] / +m[3] <= 10 && +m[3] <= 10); if (expected !== n || !Number.isInteger(expected) || !inTables) fail(label + ': times-table fact', q); }
    else if ((m = text.match(/^(\d+) × \? = (\d+)$/))) { if (+m[1] * n !== +m[2]) fail(label + ': table missing factor', q); }
    else fail(label + ': table format', q);
    if (!q.answers.some((value, i) => i !== q.correct && value.slice(-1) === ans(q).slice(-1))) fail(label + ': table missing same-last-digit distractor', q);
    return;
  }
  if (topic === 'numbers') {
    g4Kinds['numbers/' + q.kind] = (g4Kinds['numbers/' + q.kind] || 0) + 1;
    if (q.kind === 'placeValue') { const terms = text.match(/^What number is (.+)\?$/)?.[1].split(', ').map(x => { const m = x.match(/^(\d+) (thousands|hundreds|tens|ones)$/), v = { thousands: 1000, hundreds: 100, tens: 10, ones: 1 }; return m ? +m[1] * v[m[2]] : NaN; }); if (!terms || sum(terms) !== n) fail(label + ': place value', q); }
    else if (q.kind === 'expanded') { const value = Number(text.match(/^[\d,]+/)[0].replace(/,/g, '')), total = ans(q).split(' + ').reduce((s, x) => s + Number(x), 0); if (value !== total) fail(label + ': expanded notation', q); }
    else if (q.kind === 'round') { const m = text.match(/^([\d,]+) rounded to the nearest (10|100|1000) = \?$/), value = Number(m[1].replace(/,/g, '')); if (Math.round(value / +m[2]) * +m[2] !== n) fail(label + ': rounding', q); }
    else if (q.kind === 'estimate') { const m = text.match(/^Estimate (\d+) \+ (\d+) by rounding each to the nearest 100\.$/); if (!m || Math.round(+m[1] / 100) * 100 + Math.round(+m[2] / 100) * 100 !== n) fail(label + ': estimate', q); }
    else if (q.kind === 'factors') { const target = Number(text.match(/factors of (\d+)/)[1]), factors = Array.from({ length: target }, (_, i) => i + 1).filter(x => target % x === 0); if (ans(q).split(', ').map(Number).join() !== factors.join()) fail(label + ': factors', q); }
    else if (q.kind === 'multiple') { const base = Number(text.match(/multiples of (\d+)/)[1]), values = ans(q).split(', ').map(Number); if (values.length !== 5 || values.some((v, i) => v !== base * (i + 1))) fail(label + ': first five multiples', q); }
    else if (q.kind === 'prime') { const value = Number(text.match(/^Is (\d+) prime/)[1]), prime = value > 1 && !Array.from({ length: value - 2 }, (_, i) => i + 2).some(d => value % d === 0); if (ans(q) !== (prime ? 'prime' : 'composite') || q.answers.length !== 2) fail(label + ': prime/composite', q); }
    else fail(label + ': unknown number question', q);
    return;
  }
  if (topic === 'patterns') { g4Kinds['patterns/' + q.kind] = (g4Kinds['patterns/' + q.kind] || 0) + 1; const hole = q.numbers.indexOf('?'), values = q.numbers.map(Number), known = values.map((v, i) => Number.isFinite(v) ? [i, v] : null).filter(Boolean); if (hole < 0 || q.numbers.filter(x => x === '?').length !== 1) fail(label + ': missing pattern term', q); else if (q.kind === 'interval') { const steps = known.slice(1).map((pair, i) => (pair[1] - known[i][1]) / (pair[0] - known[i][0])), step = steps[0]; if (steps.some(value => value !== step) || Number(q.numbers[0]) + step * hole !== n) fail(label + ': interval pattern', q); } else { const ratio = (known[1][1] / known[0][1]) ** (1 / (known[1][0] - known[0][0])); if (!Number.isInteger(ratio) || ratio < 2 || ratio > 3 || Number(q.numbers[hole - 1]) * ratio !== n) fail(label + ': multiplication pattern', q); } return; }
  if (topic === 'fractions') {
    g4Kinds['fractions/' + q.kind] = (g4Kinds['fractions/' + q.kind] || 0) + 1;
    if (q.kind === 'diagram') { const f = q.figure; if (!f || f.type !== 'fraction-bar' || Math.abs(f.numerator / f.denominator - fractionValue(ans(q))) > 1e-9) fail(label + ': fraction bar', q); }
    else if (q.kind === 'equiv') { const m = text.match(/^(\d+)\/(\d+) = \?\/(\d+)$/); if (!m || +m[1] / +m[2] !== n / +m[3]) fail(label + ': equivalent fractions', q); }
    else if (q.kind === 'compare') { const m = text.match(/^Compare: (\d+)\/(\d+) \? (\d+)\/(\d+)$/), left = +m?.[1] / +m?.[2], right = +m?.[3] / +m?.[4]; if (!m || ans(q) !== rel(left, right)) fail(label + ': fraction comparison', q); }
    else if (q.kind === 'order') { const input = text.match(/^Order from smallest to largest: (.+)\.$/)?.[1].split(', ').map(fractionValue), ordered = ans(q).split(', ').map(fractionValue); if (!input || ordered.some((v, i) => v !== [...input].sort((a, b) => a - b)[i])) fail(label + ': fraction ordering', q); }
    else if (q.kind === 'mixed') { const m = text.match(/^(\d+) (\d+)\/(\d+) = \?\/(\d+)$/); if (!m || n !== +m[1] * +m[4] + +m[2] || +m[3] !== +m[4]) fail(label + ': mixed-number equivalence', q); }
    else if ((m = text.match(/^(\d+)\/(\d+) (of|[+−]) (\d+)(?:\/(\d+))? = \?(?: \(simplest form\))?$/))) { const result = m[3] === 'of' ? +m[1] / +m[2] * +m[4] : (m[3] === '+' ? +m[1] / +m[2] + +m[4] / +m[2] : +m[1] / +m[2] - +m[4] / +m[2]); if (Math.abs(result - fractionValue(ans(q))) > 1e-9 && Math.abs(result - n) > 1e-9) fail(label + ': fraction calculation', q); }
    else fail(label + ': unsupported fraction question', q);
    return;
  }
  if (topic === 'decimals') {
    g4Kinds['decimals/' + q.kind] = (g4Kinds['decimals/' + q.kind] || 0) + 1;
    if ((m = text.match(/^(\d+(?:\.\d+)?) ([+−]) (\d+(?:\.\d+)?) = \?$/))) { const result = m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]; if (Math.abs(result - n) > 1e-9) fail(label + ': decimal operation', q); }
    else if ((m = text.match(/^Compare: (\d*\.\d+) \? (\d*\.\d+)$/))) { if (ans(q) !== rel(+m[1], +m[2])) fail(label + ': decimal comparison', q); }
    else if ((m = text.match(/^(\d+)\/(\d+) = \?$/))) { if (Math.abs(+m[1] / +m[2] - n) > 1e-9) fail(label + ': fraction/decimal equivalence', q); }
    else if ((m = text.match(/^0\.(\d) = \?\/10$/))) { if (+m[1] !== n) fail(label + ': tenths place value', q); }
    else if ((m = text.match(/^0\.(\d{2}) = \?\/100$/))) { if (+m[1] !== n) fail(label + ': hundredths place value', q); }
    else fail(label + ': unknown decimal question', q);
    return;
  }
  if (topic === 'shapes') {
    g4Kinds['shapes/' + q.kind] = (g4Kinds['shapes/' + q.kind] || 0) + 1; const f = q.figure;
    if (q.kind === 'area' && (!f || f.type !== 'rectangle-measure' || n !== f.length * f.width)) fail(label + ': rectangle area', q);
    else if (q.kind === 'perimeter' && (!f || f.type !== 'rectangle-measure' || n !== 2 * (f.length + f.width))) fail(label + ': rectangle perimeter', q);
    else if (q.kind === 'angle' && (!f || f.type !== 'angle' || ans(q) !== (f.degrees < 90 ? 'acute' : f.degrees === 90 ? 'right' : 'obtuse'))) fail(label + ': angle identification', q);
    else if (q.kind === 'angleCompare') { const m = text.match(/^Compare: (\d+)° \? (\d+)°$/); if (!m || ans(q) !== rel(+m[1], +m[2])) fail(label + ': angle comparison', q); }
    else if (q.kind === 'convert') { const m = text.match(/^(\d+(?:\.\d+)?) m = \? cm$/); if (!m || +m[1] * 100 !== n) fail(label + ': metric conversion', q); }
    else if (q.kind === 'duration') { const m = text.match(/^(\d+) h (\d+) min = \? min$/); if (!m || +m[1] * 60 + +m[2] !== n) fail(label + ': duration', q); }
    else if (q.kind === 'symmetry' && !q.figure) fail(label + ': symmetry figure', q);
    else if (q.kind === 'properties' && !/^Sides of a /.test(text)) fail(label + ': shape property', q);
    else if (q.kind === 'triangleAngle') { const m = text.match(/^Third angle = 180° − (\d+)° − (\d+)°$/); if (!m || 180 - +m[1] - +m[2] !== n) fail(label + ': triangle angle', q); }
    return;
  }
  if (topic === 'clock' && (!q.figure || ans(q) !== `${q.figure.hour}:${String(q.figure.minute).padStart(2, '0')}`)) fail(label + ': clock reading', q);
}
for (const topic of grade4Topics.filter(t => t !== 'all')) for (let i = 0; i < 1200; i++) checkGrade4('grade4/' + topic, topic, Q.generateQuestion('grade4', topic));
const g4Seen = {};
for (let i = 0; i < 12000; i++) {
  const q = Q.generateQuestion('grade4', 'all');
  const topic = ['numbers', 'patterns', 'tables', 'fractions', 'decimals', 'shapes'].includes(q.topic) ? q.topic : q.coins || q.notes ? 'money' : q.figure?.type === 'clock' ? 'clock' : 'mixed';
  g4Seen[topic] = (g4Seen[topic] || 0) + 1;
  checkGrade4('grade4/all', topic, q);
}
for (const topic of ['mixed', 'numbers', 'patterns', 'tables', 'fractions', 'decimals', 'money', 'clock', 'shapes']) if ((g4Seen[topic] || 0) < 500) fail('grade4/all category too rare: ' + topic, g4Seen);
for (const [kind, count] of Object.entries(g4Kinds)) if (count < 10) fail('grade4 question type too rare: ' + kind, count);

// ============================ GRADE 6 ============================
const grade6Topics = Q.topicsFor('grade6').map(t => t.value);
const requiredGrade6Topics = ['all', 'mixed', 'add', 'sub', 'mul', 'div', 'numbers', 'decimals', 'percentages', 'ratio', 'probability', 'algebra', 'statistics', 'fractions', 'shapes'];
for (const topic of requiredGrade6Topics) if (!grade6Topics.includes(topic)) fail('grade6 topic missing: ' + topic, grade6Topics);
for (const topic of ['patterns', 'data', 'tables', 'money', 'clock']) if (grade6Topics.includes(topic)) fail('grade6 unrelated topic exposed: ' + topic, grade6Topics);
const g6Seen = {}, g6Kinds = {};
for (const topic of grade6Topics.filter(t => t !== 'all')) {
  for (let i = 0; i < 1200; i++) {
    const q = Q.generateQuestion('grade6', topic), text = q.question;
    if (!q.question || /quadratic|square root|factorisation|long division|compound probability|trigonometry/i.test(text)) fail('grade6 excluded concept', q);
    if (/\d{4,}/.test(text) && !/rounded|estimate|\?\/1000/.test(text)) fail('grade6 oversized operand', q);
    if (q.answers.length < 2 || new Set(q.answers).size !== q.answers.length || q.correct < 0 || q.correct >= q.answers.length) fail('grade6 invalid choices', q);
    if (q.topic) { g6Seen[q.topic] = (g6Seen[q.topic] || 0) + 1; g6Kinds[q.topic + '/' + q.kind] = (g6Kinds[q.topic + '/' + q.kind] || 0) + 1; }
    if (q.topic === 'numbers' && q.kind === 'negative' && !/[−] \d+ = \?|−\d+ \+ \d+ = \?/.test(text)) fail('grade6 negative numbers missing', q);
    if (q.topic === 'algebra' && !/x|n|Simplify|Rule for the sequence/.test(text)) fail('grade6 algebra not symbolic', q);
    if (q.topic === 'statistics' && !/Find the (mean|median|mode|range)/.test(text)) fail('grade6 statistics missing', q);
    if (q.topic === 'ratio' && !/ratio|\d+:\d+/.test(text)) fail('grade6 ratio missing', q);
    if (q.topic === 'percentages' && !/%/.test(text)) fail('grade6 percentage missing', q);
    if (q.topic === 'probability' && !/P\(|likely/.test(text)) fail('grade6 probability missing', q);
  }
}
for (const topic of ['numbers', 'fractions', 'decimals', 'percentages', 'ratio', 'probability', 'algebra', 'statistics', 'shapes']) if (!g6Seen[topic]) fail('grade6 topic generates no questions: ' + topic, g6Seen);
const g6MixedSample = Array.from({ length: 18000 }, () => Q.generateQuestion('grade6', 'all'));
for (const topic of ['numbers', 'fractions', 'decimals', 'percentages', 'ratio', 'probability', 'algebra', 'statistics', 'shapes']) {
  const count = g6MixedSample.filter(q => q.topic === topic).length;
  if (count < 100) fail('grade6 mixed pool topic too rare: ' + topic, { count });
}

// ============================ COMPARISONS ============================
// Grade 4 compares decimals and angles within their topics; the other comparisons stay embedded in their curriculum.
for (const g of [1, 2, 3, 4]) {
  const level = 'grade' + g;
  if (Q.topicsFor(level).some(t => t.value === 'compare')) fail(level + ': compare topic is still offered', Q.topicsFor(level).map(t => t.value));
  if (Q.normaliseTopic(level, 'compare') !== 'all') fail(level + ': old compare selection not normalised', Q.normaliseTopic(level, 'compare'));
  if (g === 2 || g === 3) continue;
  for (const t of [...Q.topicsFor(level).map(x => x.value), 'compare']) {   // 'compare' = an old saved selection reaching the generator
    for (let i = 0; i < 1500; i++) {
      const q = Q.generateQuestion(level, t);
      if (!common(level + '/' + t, q)) continue;
      if (/^Compare/.test(q.question)) {
        const allowed = g === 4 && ((q.topic === 'decimals' && q.kind === 'compare') || (q.topic === 'shapes' && q.kind === 'angleCompare') || (q.topic === 'fractions' && q.kind === 'compare'));
        const m = q.question.match(/^Compare: (\d+(?:\.\d+)?|\d+\/\d+)(?:°)? \? (\d+(?:\.\d+)?|\d+\/\d+)(?:°)?$/), value = token => token.includes('/') ? fractionValue(token) : Number(token);
        if (!allowed || !m || ans(q) !== rel(value(m[1]), value(m[2]))) fail(level + '/' + t + ': comparison outside Grade 4 scope or answer mismatch', q);
      } else if (q.answers.includes(LESS) || q.answers.includes(EQUAL) || q.answers.includes(MORE)) fail(level + '/' + t + ': <, = or > answers on a non-comparison', q);
    }
  }
}
// Grades 5-6 compare within their taught topics; Grade 5 also compares decimals and percentages.
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
      const tokens = [m[1], m[2]], dec = tokens.filter(x => /^\d+\.\d{1,3}$/.test(x)), fr = tokens.filter(x => /^[1-9]\d*\/[1-9]\d*$/.test(x));
      if (g === 6 && q.topic === 'numbers') {
        const signed = tokens.map(x => Number(x.replace('−', '-')));
        if (signed.some(x => !Number.isInteger(x)) || q.answers.join('|') !== [LESS, EQUAL, MORE].join('|') || ans(q) !== rel(signed[0], signed[1])) fail(level + '/' + t + ': negative number comparison', q);
        seen[ans(q)]++;
        continue;
      }
      if ((g === 5 || g === 6) && q.topic === 'decimals') {
        if (dec.length !== 2 || q.answers.join('|') !== [LESS, EQUAL, MORE].join('|') || ans(q) !== rel(Number(tokens[0]), Number(tokens[1]))) fail(level + '/' + t + ': decimal comparison', q);
        seen[ans(q)]++;
        continue;
      }
      if (g === 5 && q.topic === 'percentages') {
        const pct = tokens.map(x => x.endsWith('%') ? Number(x.slice(0, -1)) / 100 : Number(x));
        if (!tokens[0].endsWith('%') || tokens[1].endsWith('%') || q.answers.join('|') !== [LESS, EQUAL, MORE].join('|') || ans(q) !== rel(pct[0], pct[1])) fail(level + '/' + t + ': percentage comparison', q);
        seen[ans(q)]++;
        continue;
      }
      if ((g === 5 || g === 6) && q.topic === 'fractions' && dec.length === 0 && fr.length === 2) {
        if (q.answers.join('|') !== [LESS, EQUAL, MORE].join('|') || ans(q) !== rel(fractionValue(tokens[0]), fractionValue(tokens[1]))) fail(level + '/' + t + ': fraction comparison', q);
        seen[ans(q)]++;
        continue;
      }
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
