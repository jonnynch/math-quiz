// Age 5: ONE unified pool of ten topics whose difficulty rises through `tier` (no stages). Checks every topic is generated with
// valid, unambiguous answers, that the pool stays inside the agreed curriculum and that progression works inside one pool.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
let bad = 0;
const fail = (m, q) => { if (bad++ < 12) console.log('FAIL', m, JSON.stringify(q)); };
const N = 12000;

// ---- level labels: no explanatory descriptions after Age 2-6
const labels = Object.fromEntries(Q.DIFFICULTIES.map(d => [d.value, d.label]));
if (labels.toddler !== 'Age 2–3' || labels.age4 !== 'Age 4' || labels.age5 !== 'Age 5' || labels.age6 !== 'Age 6') fail('age labels must have no descriptions', labels);
if (Q.DIFFICULTIES.some(d => /·/.test(d.label))) fail('no label may carry a description', labels);
if (labels.grade1 !== 'Grade 1' || Q.topicsFor('age5').length) fail('Grade labels and topics unchanged; age levels have no topics', labels);

const TOPICS = ['counting', 'compare', 'addition', 'subtraction', 'placevalue', 'sequences', 'patterns', 'grouping', 'sharing', 'shapes'];
const KINDS = {
  counting: ['arranged', 'irregular', 'grouped'], compare: ['more', 'fewer'],
  addition: ['picture', 'bond', 'make10', 'double', 'missing', 'beyond10'],
  subtraction: ['picture', 'within20', 'cross10', 'missingSubtrahend', 'missingMinuend', 'inverse'],
  placevalue: ['read', 'build', 'count10s', 'count1s', 'decompose'], sequences: ['forward', 'backward', 'skip2', 'skip5', 'skip10'],
  patterns: ['AB', 'AAB', 'ABB', 'ABC'], grouping: ['groups'], sharing: ['each'], shapes: ['name', 'sides', 'corners', 'pick', 'property']
};
// Everything reserved for Age 6 / Grade 1 or explicitly excluded from Age 5.
const EXCLUDED = /[×÷]|\$|¢|\d\s?c\b|\bcents?\b|\bcoins?\b|\bnotes?\b|\bmoney\b|\bclock\b|o'clock|\btime\b|\blonger\b|\bshorter\b|\btaller\b|\bheavier\b|\blighter\b|\bliquid\b|\bcube\b|\bsphere\b|\bcone\b|\bcylinder\b|\bprism\b|\bpyramid\b|\b(tens?|ones?)\b|\bsame\b|\bpattern\b/i;
const objs = (rows, re) => rows.join('').replace(re, '').length;
const count = (g, ch) => g.rows.join('').split('').filter(c => c === ch).length;
const crosses = (a, b) => a > 10 && a - b < 10;
const numeric = (a) => a.every(x => /^\d+$/.test(x));
const seen = {}, tierOf = {}, keysSeen = new Set(), counts = {}, arrangements = {};
const compareTiers = { more: {}, fewer: {} };
const pos = {};
let numericQs = 0;

function checkEquation(q, k) {
  // Solve the shown equation independently and require that exactly the marked answer satisfies it.
  const ans = Number(q.answers[q.correct]);
  const holds = (v) => {
    let m;
    if ((m = q.question.match(/^(\d+) \+ (\d+) = \?$/))) return +m[1] + +m[2] === v;
    if ((m = q.question.match(/^(\d+) − (\d+) = \?$/))) return +m[1] - +m[2] === v;
    if ((m = q.question.match(/^(\d+) \+ \? = (\d+)$/))) return +m[1] + v === +m[2];
    if ((m = q.question.match(/^\? \+ (\d+) = (\d+)$/))) return v + +m[1] === +m[2];
    if ((m = q.question.match(/^(\d+) − \? = (\d+)$/))) return +m[1] - v === +m[2];
    if ((m = q.question.match(/^\? − (\d+) = (\d+)$/))) return v - +m[1] === +m[2];
    if ((m = q.question.match(/^(\d+) and \? make (\d+)$/))) return +m[1] + v === +m[2];
    if ((m = q.question.match(/^(\d+) \+ (\d+) = (\d+), so (\d+) − (\d+) = \?$/))) return +m[1] + +m[2] === +m[3] && +m[4] === +m[3] && +m[5] === +m[2] && +m[4] - +m[5] === v;
    if ((m = q.question.match(/^(\d+) − (\d+) = (\d+), so (\d+) \+ (\d+) = \?$/))) return +m[1] - +m[2] === +m[3] && +m[4] === +m[3] && +m[5] === +m[2] && +m[4] + +m[5] === v;
    return null;
  };
  if (holds(ans) === null) return false;
  q.answers.forEach((a, j) => { if ((j === q.correct) !== holds(Number(a))) fail(k + ': equation holds for the wrong number of answers', q); });
  return true;
}

for (let i = 0; i < N; i++) {
  const q = Q.generateQuestion('age5', i % 3 ? 'mixed' : 'compare');   // a topic argument must be ignored
  const k = q.topic + ':' + q.kind;
  seen[k] = (seen[k] || 0) + 1; counts[q.topic] = (counts[q.topic] || 0) + 1;
  (tierOf[q.topic] = tierOf[q.topic] || {})[q.tier] = ((tierOf[q.topic] || {})[q.tier] || 0) + 1;
  if (!TOPICS.includes(q.topic) || !(KINDS[q.topic] || []).includes(q.kind)) { fail('unknown topic/kind', q); continue; }
  if (!q.simple || !(q.tier >= 1 && q.tier <= 3)) fail('simple/tier', q);
  if (q.stage || q.visual || q.figure && q.figure.type === 'clock') fail('Age 6 / toddler structures must not appear', q);
  const texts = [q.question, ...(q.answers || []), ...(q.answerLabels || []), q.picture && q.picture.label, q.resultText, ...(q.numbers || []), ...((q.pattern || []).map(p => p && p.label)), q.promptVisual && q.promptVisual.label, ...((q.answerVisuals || []).map(a => a.label))].filter(Boolean).join(' | ');
  if (EXCLUDED.test(texts.replace(/Which group has (more|fewer)\?/, ''))) fail('excluded content: ' + (texts.match(EXCLUDED) || [])[0], q);
  if (!(q.correct >= 0 && q.correct < q.answers.length) || new Set(q.answers).size !== q.answers.length) fail('correct index / duplicate answers', q);
  const want = q.groups ? 2 : 4;
  if (q.answers.length !== want) fail('need ' + want + ' choices', q);
  if (q.answerVisuals && (q.answerVisuals.length !== q.answers.length || q.answerLabels.length !== q.answers.length)) fail('visual choices need labels', q);
  if (numeric(q.answers)) {
    numericQs++;
    const n = q.answers.map(Number);
    if (n.some((v, j) => j && v <= n[j - 1])) fail('numeric answers must ascend', q);
    pos[q.correct] = (pos[q.correct] || 0) + 1;
  }
  const ans = q.answers[q.correct];
  const g0 = q.picture && q.picture.groups[0];

  switch (q.topic) {
    case 'counting': {
      const n = q.picture.groups.reduce((s, g) => s + count(g, 'X'), 0);
      if (n < 1 || n > 20 || n !== Number(ans) || q.question !== 'How many?') fail('count: 1-20 and matches answer', q);
      if (q.picture.groups.some(g => !g.rows.every(r => /^[X.]+$/.test(r)))) fail('count: plain objects only', q);
      if (q.answers.some(a => +a < 1 || +a > 20)) fail('count: choices out of range', q);
      if (q.picture.groups.length > 2) fail('count: at most two groups', q);
      (arrangements[n] = arrangements[n] || new Set()).add(q.picture.groups.map(g => g.rows.join('/')).join('+'));
      break;
    }
    case 'compare': {
      const sizes = q.answerLabels.map(l => Number(l.split(': ')[1]));
      const names = q.answerLabels.map(l => l.split(': ')[0]);
      const larger = sizes[0] > sizes[1] ? 0 : 1;
      if (sizes[0] === sizes[1] || names[0] === names[1]) fail('compare: unequal counts, different objects', q);
      if (q.question === 'Which group has more?' ? q.correct !== larger : q.question === 'Which group has fewer?' ? q.correct !== 1 - larger : true) fail('compare: wrong group', q);
      if (q.question.includes('fewer') && (q.tier < 2 || Math.abs(sizes[0] - sizes[1]) < 2)) fail('compare: fewer must be introduced later and with a clear gap', q);
      if (Math.max(...sizes) > 12 || q.answers.some(a => /\d/.test(a))) fail('compare: size / written numbers', q);
      compareTiers[q.kind][q.tier] = (compareTiers[q.kind][q.tier] || 0) + 1;
      break;
    }
    case 'addition': {
      if (q.kind === 'picture') {
        const flat = g0.rows.join(''), a = (flat.match(/X/g) || []).length, b = (flat.match(/Y/g) || []).length;
        if (!g0.emoji2 || g0.emoji === g0.emoji2 || a + b > 10 || Number(ans) !== a + b || q.resultText !== `${a} + ${b} = ${a + b}`) fail('addition picture', q);
        if (q.question !== 'How many altogether?' && q.question !== `${a} + ${b} = ?`) fail('addition picture prompt', q);
        if (q.question === 'How many altogether?' && (a + b > 6 || q.tier !== 1)) fail('words-only prompt is for small sums', q);
      } else if (q.kind === 'double') {
        const m = q.question.match(/^(\d+) \+ (\d+) = \?$/);
        if (!m || m[1] !== m[2] || Number(ans) !== 2 * m[1]) fail('double', q);
        if (g0 && (g0.rows.length !== 2 || g0.rows[0].length !== +m[1] || g0.rows[1].length !== +m[1])) fail('double picture rows', q);
      } else if (!checkEquation(q, k)) fail('addition: unrecognised question', q);
      if (q.kind === 'bond' || q.kind === 'make10' || (q.kind === 'missing' && g0)) {
        const miss = q.picture ? count(g0, 'O') : null;
        if (q.picture && (miss !== Number(ans) || count(g0, 'X') + miss > 10)) fail('addition: picture does not match', q);
      }
      if (q.kind === 'make10' && !/10$/.test(q.question)) fail('make10 total', q);
      if (q.kind === 'beyond10') {
        const [, x, y] = q.question.match(/^(\d+) \+ (\d+) = \?$/).map(Number);
        const hi = Math.max(x, y), lo = Math.min(x, y);
        if (hi < 10 || hi + lo > 19 || (hi % 10) + lo > 9 || q.picture || q.tier < 2) fail('beyond 10: no carrying, numbers only', q);
      }
      if (q.kind === 'missing' && !g0 && q.tier !== 3) fail('missing addend beyond 10 is tier 3', q);
      if (!g0 && q.kind !== 'beyond10' && (q.question.match(/\d+/g) || []).every(n => +n <= 10) && q.tier < 2) fail('notation-only questions are introduced after picture ones', q);
      break;
    }
    case 'subtraction': {
      if (q.kind === 'picture') {
        const all = g0.rows.join(''), a = objs([all], /[^Xx]/g), b = (all.match(/x/g) || []).length;
        if (a > 10 || Number(ans) !== a - b || b < 1 || q.resultText !== `${a} − ${b} = ${a - b}`) fail('subtraction picture', q);
        if (q.question !== 'How many are left?' && q.question !== `${a} − ${b} = ?`) fail('subtraction picture prompt', q);
      } else if (q.kind === 'within20' || q.kind === 'cross10') {
        const [, a, b] = q.question.match(/^(\d+) − (\d+) = \?$/).map(Number);
        if (a > 20 || Number(ans) !== a - b || a - b < 1) fail('subtraction within 20', q);
        if (q.picture) {
          const gs = q.picture.groups, tot = gs.reduce((s, g) => s + objs(g.rows, /[^Xx]/g), 0), gone = gs.reduce((s, g) => s + count(g, 'x'), 0);
          if (tot !== a || gone !== b) fail('subtraction picture 11-20 mismatch', q);
          if (!gs[0] || objs(gs[0].rows, /[^Xx]/g) !== 10) fail('11-20 starts with a ten-frame group', q);
        }
        if ((q.kind === 'cross10') !== crosses(a, b)) fail('crossing 10 must match its kind', q);
        if (q.kind === 'cross10' && q.tier !== 3) fail('crossing 10 only at tier 3', q);
        if (q.kind === 'within20' && a > 10 && !(q.tier >= 2)) fail('within-20 tier', q);
      } else if (!checkEquation(q, k)) fail('subtraction: unrecognised question', q);
      if (q.kind === 'missingSubtrahend' && !/^\d+ − \? = \d+$/.test(q.question)) fail('missing subtrahend wording', q);
      if (q.kind === 'missingMinuend' && !/^\? − \d+ = \d+$/.test(q.question)) fail('missing minuend wording', q);
      if (q.kind === 'inverse' && !/, so /.test(q.question)) fail('inverse wording', q);
      if ((q.question.match(/\d+/g) || []).some(n => +n > 20)) fail('subtraction beyond 20', q);
      break;
    }
    case 'placevalue': {
      const blocks = q.promptVisual;
      if (q.kind === 'read') {
        if (!blocks || q.question !== 'What number is shown?' || blocks.tens * 10 + blocks.ones !== Number(ans) || Number(ans) < 11 || Number(ans) > 29) fail('place value: read', q);
      } else if (q.kind === 'build') {
        const m = q.question.match(/^Which shows (\d+)\?$/), vals = q.answerVisuals.map(v => v.tens * 10 + v.ones);
        if (!m || vals[q.correct] !== +m[1] || vals.filter(v => v === +m[1]).length !== 1 || new Set(vals).size !== 4 || vals.some((v, j) => j && v <= vals[j - 1])) fail('place value: build', q);
        if (q.answerVisuals.some(v => v.type !== 'blocks')) fail('place value: blocks only', q);
      } else if (q.kind === 'count10s' || q.kind === 'count1s') {
        if (!blocks || Number(ans) !== (q.kind === 'count10s' ? blocks.tens : blocks.ones) || q.question !== (q.kind === 'count10s' ? 'How many 10s?' : 'How many 1s?')) fail('place value: count', q);
      } else {
        const m = q.question.match(/^(\d+) = (\d+) \+ \?$/), m2 = q.question.match(/^(\d+) = \? \+ (\d+)$/);
        if (m ? +m[2] + Number(ans) !== +m[1] : m2 ? Number(ans) + +m2[2] !== +m2[1] : true) fail('place value: decompose', q);
        if (m && (+m[2] % 10 || (blocks && blocks.tens * 10 + blocks.ones !== +m[1]))) fail('place value: decompose picture', q);
        if (blocks && q.tier !== 2) fail('picture decomposition is tier 2', q);
      }
      if (blocks && (blocks.tens < 1 || blocks.tens > 2 || blocks.ones > 9 || !/rectangle(s)? marked 10/.test(blocks.label) || (blocks.ones && !/circle(s)? marked 1$/.test(blocks.label)))) fail('place value: notation', q);
      break;
    }
    case 'sequences': {
      const nums = q.numbers, holes = nums.filter(n => n === '?').length, len = nums.length;
      if (len < 3 || len > 5 || holes !== 1 || q.question !== 'What number is missing?') fail('sequence: 3-5 numbers, one missing', q);
      const hole = nums.indexOf('?'), known = nums.map(Number);
      const j1 = nums.findIndex((n, j) => j !== hole), j2 = nums.findIndex((n, j) => j > j1 && j !== hole);
      const step = (known[j2] - known[j1]) / (j2 - j1);
      const want = { forward: 1, backward: -1, skip2: 2, skip5: 5, skip10: 10 }[q.kind];
      if (step !== want) fail('sequence: step must be ' + want + ' (never 3)', q);
      const full = nums.map((n, j) => j === hole ? known[j1] + step * (j - j1) : +n);
      if (full.some((v, j) => j && v - full[j - 1] !== step) || full.some(v => v < 1 || v > 100)) fail('sequence: not a clean progression', q);
      if (Number(ans) !== full[hole]) fail('sequence: wrong answer', q);
      break;
    }
    case 'patterns': {
      const p = q.pattern, shown = p.slice(0, 5);
      if (p.length !== 6 || p[5] !== null || shown.some(x => !x || x.type !== 'shape') || q.question !== 'What comes next?') fail('pattern: 5 shapes then blank', q);
      const order = [...new Set(shown.map(x => x.label))], letters = shown.map(x => 'ABC'[order.indexOf(x.label)]).join('');
      const unit = q.kind, expectedShown = Array.from({ length: 5 }, (_, j) => unit[j % unit.length]).join('');
      if (letters !== expectedShown) fail('pattern: shape sequence does not follow ' + unit, q);
      const nextLetter = unit[5 % unit.length], nextLabel = order['ABC'.indexOf(nextLetter)];
      if (q.answers[q.correct] !== nextLabel || q.answers.filter(a => a === nextLabel).length !== 1) fail('pattern: wrong or ambiguous next item', q);
      if (q.answerVisuals.some(v => v.type !== 'shape')) fail('pattern: visual choices', q);
      if (new Set(order.map(l => l.split(' ')[1])).size !== order.length) fail('pattern: pattern elements must differ in shape', q);
      break;
    }
    case 'grouping': {
      const sizes = q.picture.groups.map(g => count(g, 'X'));
      if (q.question !== 'How many groups?' || new Set(sizes).size !== 1 || sizes[0] < 2 || sizes[0] > 5 || sizes.length !== Number(ans) || sizes.length < 2) fail('grouping', q);
      if (!q.picture.groups.every(g => g.framed)) fail('grouping: groups must be visibly separate', q);
      break;
    }
    case 'sharing': {
      const each = q.picture.groups.map(g => count(g, 'X'));
      if (q.question !== 'How many each?' || new Set(each).size !== 1 || each[0] !== Number(ans) || each.length < 2 || each.length > 4) fail('sharing: equal shares', q);
      if (!q.picture.groups.every(g => g.lead)) fail('sharing: every child shown', q);
      break;
    }
    case 'shapes': {
      const SHAPES = ['circle', 'square', 'triangle', 'rectangle'];
      if (q.kind === 'name') {
        if (!SHAPES.includes(q.figure.shape) || ans !== q.figure.shape || q.answers.slice().sort().join() !== SHAPES.slice().sort().join()) fail('shape name', q);
      } else if (q.kind === 'sides' || q.kind === 'corners') {
        if (!['triangle', 'square', 'rectangle'].includes(q.figure.shape) || Number(ans) !== (q.figure.shape === 'triangle' ? 3 : 4)) fail('sides/corners', q);
      } else {
        const shapes = q.answerVisuals.map(v => v.shape);
        const m = q.question.match(/^Which shape is a (\w+)\?$/);
        const target = m ? m[1] : /3 (sides|corners)/.test(q.question) ? 'triangle' : /no corners/.test(q.question) ? 'circle' : /4 equal sides/.test(q.question) ? 'square' : null;
        if (!target || shapes[q.correct] !== target || shapes.slice().sort().join() !== SHAPES.slice().sort().join()) fail('shape choice', q);
      }
      [q.figure, ...(q.answerVisuals || [])].filter(Boolean).forEach(f => { if (f.shape === 'rectangle' && f.ratio < 1.7) fail('rectangle must be clearly longer than a square', q); if (f.shape === 'square' && f.ratio !== 1) fail('square ratio', q); });
      break;
    }
  }
  keysSeen.add(Q.questionKey(q));
}

// ---- every topic and kind is generated and has a spread of tiers
TOPICS.forEach(t => { if (!counts[t] || counts[t] < N * 0.04) fail('topic under-represented: ' + t, counts); });
Object.entries(KINDS).forEach(([t, ks]) => ks.forEach(kd => { if (!seen[t + ':' + kd]) fail('kind never generated: ' + t + ':' + kd, seen); }));
if (keysSeen.size < 800) fail('pool too small / repetitive', keysSeen.size);
// Familiar groupings for 6-20 objects are all used, and not everything is arranged in rows of five.
const grouped = new Set(Object.values(arrangements).flatMap(s => [...s]));
['XXXXX/X....', 'XXXXX/XXX..', 'XXXXX/XXXXX', 'XXXXX/XXXXX+XX', 'XXX/XXX+XXX/XXX', 'XXXXX/XXXXX+XXXXX', 'XXXXX/XXXXX+XXXXX/XXXXX'].forEach(p => { if (!grouped.has(p)) fail('missing grouping ' + p, [...grouped].length); });
for (let n = 2; n <= 20; n++) if (n > 3 && (!arrangements[n] || arrangements[n].size < (n === 20 ? 1 : 2))) fail('count ' + n + ' needs varied arrangements', [...(arrangements[n] || [])]);
if ([...grouped].every(k => k.split('+').every(part => /^(XXXXX)(\/|$)/.test(part)))) fail('counting must not always use rows of five', {});
// Answer position is spread over the four slots.
for (let j = 0; j < 4; j++) if ((pos[j] || 0) < numericQs * 0.15) fail('answer position ' + j + ' under-used', pos);

// ---- "fewer" is introduced gradually: never at tier 1, and a larger share at tier 3 than at tier 2
{
  const share = (t) => (compareTiers.fewer[t] || 0) / ((compareTiers.fewer[t] || 0) + (compareTiers.more[t] || 0) || 1);
  if (compareTiers.fewer[1] || compareTiers.more[1] === undefined) fail('fewer at tier 1 / no easy "more"', compareTiers);
  if (!(share(3) > share(2) && share(2) > 0 && share(3) < 0.6)) fail('fewer share should grow from tier 2 to 3', { t2: share(2), t3: share(3) });
}
// Crossing 10, place value, notation-only and the harder kinds only start later.
const bank = Q.buildQuestionBank('age5');
if (bank.length < 450 || new Set(bank.map(Q.questionKey)).size !== bank.length) fail('bank size / duplicates', bank.length);
if (![1, 2, 3].every(t => bank.some(q => q.tier === t))) fail('bank must contain every tier', {});
if (!TOPICS.every(t => bank.some(q => q.topic === t && q.tier === 1) || ['placevalue', 'subtraction'].includes(t) && bank.some(q => q.topic === t))) fail('tier-1 questions should cover the easy topics', {});
let early = 0, late = 0, crossEarly = 0, topicsEarly = new Set(), decks = 150;
for (let g = 0; g < decks; g++) {
  const deck = Q.createQuestionDeck(bank);
  const first = Array.from({ length: 6 }, () => deck.next());
  if (first.some(q => q.tier !== 1)) fail('first 6 questions must be tier 1', first.map(q => q.tier));
  const second = Array.from({ length: 6 }, () => deck.next());
  if (second.some(q => q.tier > 2)) fail('questions 7-12 are at most tier 2', second.map(q => q.tier));
  [...first, ...second].forEach(q => { if (q.kind === 'cross10' || q.kind === 'fewer' && q.tier < 2) crossEarly += q.kind === 'cross10' ? 1 : 0; early += q.tier / 12; topicsEarly.add(q.topic); });
  const rest = Array.from({ length: 28 }, () => deck.next());
  late += rest.reduce((s, q) => s + q.tier, 0) / 28;
  const keys = new Set([...first, ...second, ...rest].map(Q.questionKey));
  if (keys.size !== 40) fail('repeat within the first round', keys.size);
}
if (crossEarly) fail('crossing-10 must not appear in the first 12 questions', crossEarly);
if (!(late / decks > early / decks + 0.5 && late / decks > 2.0)) fail('later questions should be harder on average', { early: early / decks, late: late / decks });
if (topicsEarly.size < 6) fail('the opening questions should already mix several topics', [...topicsEarly]);
// Share of crossing-10 among subtraction questions stays modest overall.
{
  const subs = bank.filter(q => q.topic === 'subtraction'), cross = subs.filter(q => q.kind === 'cross10');
  if (!cross.length || cross.length > subs.length * 0.5) fail('crossing 10 should be present but not dominant', { cross: cross.length, subs: subs.length });
}
// Age 6 and Age 4 generators are untouched by Age 5.
for (let i = 0; i < 300; i++) {
  const q6 = Q.generateQuestion('age6');
  if (!q6.stage || q6.topic || q6.tier || q6.picture) fail('Age 6 must still use the object stage only', q6);
  const q4 = Q.generateQuestion('age4');
  if (q4.topic || q4.kind) fail('Age 4 questions carry no Age 5 fields', q4);
}
console.log('age5 questions checked:', N, 'topics', counts, 'bank', bank.length, 'distinct', keysSeen.size);
process.exit(bad ? 1 : 0);
