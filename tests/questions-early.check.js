// Age 2-3, Age 4, Age 5, Age 6 (Foundation) and Grade 1: every topic is checked with independent re-computation
// from the question text / picture (never from the generator's own answer), plus Mixed All Questions coverage,
// unsupported topics, no-repeat decks, Solo / 1 v 1 decks and saved-profile / backup compatibility.
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
require(path.join(__dirname, '..', 'public', 'parent.js'));
let total = 0; const fails = {};
const N = 1200;
const LEVELS = ['toddler', 'age4', 'age5', 'age6', 'grade1'];
const EXPECTED = {
  toddler: 'all,count,match,subitise,combine,patterns,compare,sort,measure,shape2d,position',
  age4: 'all,count,match,subitise,addsub,partition,patterns,compare,sort,measure,shape2d,position',
  age5: 'all,count,addsub,partition,missing,sharing,patterns,compare,money,measure,time,shape2d,position,data',
  age6: 'all,count,subitise,addsub,partition,sharing,patterns,compare,money,measure,time,shape2d,position,data',
  grade1: 'all,mixed,add,sub,numbers,skip,place,missing,word,sharing,groups,compare,fractions,money,measure,time,clock,shapes,position,data'
};
const num = (s) => Number(s);
const cnt = (q) => q.visual.filter(Boolean).length;
const rowCount = (q, r) => q.visual.slice(r * 5, r * 5 + 5).filter(Boolean).length;
const glyphs = (s) => Array.from(s).length;
const coinVal = (s) => s.startsWith('$') ? 100 * num(s.slice(1)) : num(s.slice(0, -1));
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function wordToNum(w) {
  let n = 0;
  w.replace(' and ', ' ').split(' ').forEach(part => {
    if (part === 'hundred') n *= 100;
    else part.split('-').forEach(p => { n += p in TENS ? TENS[p] : ONES.indexOf(p) >= 0 ? ONES.indexOf(p) : 0; });
  });
  return n;
}
const CAT = { Fruit: '🍎🍌🍓🍐🍊', Animals: '🐶🐱🐟🦆🐰', Vehicles: '🚗🚌🚲🚂✈️' };
const catOf = (e) => Object.keys(CAT).find(c => Array.from(CAT[c].match(/\p{Extended_Pictographic}\uFE0F?/gu)).includes(e));
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEQ = [['Crack the egg', 'Cook the egg', 'Eat the egg'], ['Plant a seed', 'Water the seed', 'Pick the flower'], ['Put on socks', 'Put on shoes', 'Walk outside'],
  ['Fill the bath', 'Get in the bath', 'Dry with a towel'], ['Wake up', 'Eat breakfast', 'Go to school'], ['Wash your hands', 'Eat your lunch', 'Brush your teeth']];
const TOD = { 'wake up': 'morning', 'eat breakfast': 'morning', 'come home from school': 'afternoon', 'see the moon and stars': 'night', 'go to bed': 'night' };
const SIZE = [['🐘', '🐭'], ['🚌', '🚗'], ['🌳', '🌱'], ['🏠', '🚪'], ['🐻', '🐥'], ['🐄', '🐓']];
const MASS = [['🐘', '🐭'], ['🚗', '🚲'], ['🪨', '🪶'], ['📚', '📄'], ['🐻', '🐥']];
const CAP = [['🛁', '🥛'], ['🪣', '☕'], ['🛁', '🥄']];
const DUR = [['😴 Sleep at night', '👏 Clap your hands'], ['🍽️ Eat dinner', '🤧 Sneeze'], ['🚶 Walk to school', '👁️ Blink']];
const pairOk = (pairs, q, upWord, downWord) => {
  const up = q.question.includes(upWord); if (!up && !q.question.includes(downWord)) return false;
  const pair = pairs.find(p => q.answers.includes(p[0]) && q.answers.includes(p[1])); if (!pair || q.answers.length !== 2) return false;
  return q.answers[q.correct] === (up ? pair[0] : pair[1]);
};
const SHAPE_BY_FIG = (f) => !f ? null : f.type === 'circle' ? 'circle' : f.type === 'rect' ? 'rectangle' : { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' }[f.sides];
const SIDES = { circle: 0, square: 4, triangle: 3, rectangle: 4, pentagon: 5, hexagon: 6 };
const EMO = { circle: '🔴🔵🟡🟢', square: '🟥🟦🟨🟩', triangle: '🔺' };
const emoShape = (e) => Object.keys(EMO).find(k => EMO[k].includes(e));

// Each verifier returns an error string, or '' when the question is correct.
const V = {
  count(l, q, a) {
    let m;
    if (q.visual && /^How many /.test(q.question)) return cnt(q) === num(a) && num(a) <= 10 && (l === 'toddler' ? num(a) <= 10 : true) ? '' : 'visual count';
    const lo = l === 'age6' ? 0 : 1, hi = 20;
    if ((m = q.question.match(/^What comes next\? (\d+), (\d+), (\d+), \?$/))) { const [x, y, z] = m.slice(1).map(num); const d = y - x; return (Math.abs(d) === 1 && z - y === d && num(a) === z + d && num(a) >= lo && num(a) <= hi) ? '' : 'sequence'; }
    if ((m = q.question.match(/^What number comes (after|before) (\d+)\?$/))) return num(a) === num(m[2]) + (m[1] === 'after' ? 1 : -1) && num(a) >= lo && num(a) <= hi ? '' : 'after/before';
    if ((m = q.question.match(/^What number is between (\d+) and (\d+)\?$/))) return (l !== 'age4') && num(m[2]) - num(m[1]) === 2 && num(a) === num(m[1]) + 1 ? '' : 'between';
    return 'unrecognised';
  },
  match(l, q, a) {
    const m = q.question.match(/^Which group shows (\d)\?$/); if (!m) return 'text';
    const counts = q.answers.map(glyphs); if (counts.some((c, i) => i && c <= counts[i - 1])) return 'not sorted';
    return glyphs(a) === num(m[1]) && num(m[1]) <= 5 && new Set(q.answers.flatMap(x => Array.from(x))).size === 1 ? '' : 'wrong group';
  },
  subitise(l, q, a) { const n = cnt(q); return n === num(a) && n <= (l === 'toddler' ? 4 : 5) && q.visual.length <= 10 ? '' : 'subitise count'; },
  compare(l, q, a) {
    let m;
    if (l === 'grade1') { m = q.question.match(/^Compare: (\d+) \? (\d+)$/); const x = num(m[1]), y = num(m[2]); return x <= 120 && y <= 120 && q.correct === (x < y ? 0 : x === y ? 1 : 2) ? '' : 'g1 compare'; }
    if (q.visual) {
      if (q.visual.length !== 10 || rowCount(q, 0) < 1 || rowCount(q, 1) < 1) return 'groups layout';
      const A = q.visual[0], B = q.visual[5], x = rowCount(q, 0), y = rowCount(q, 1);
      if (A === B) return 'same emoji';
      m = q.question.match(/^Which has (more|fewer), or are they the same\?$/); if (!m) return 'text';
      const exp = x === y ? 'Same' : (m[1] === 'more') === (x > y) ? A : B;
      return a === exp && q.answers.length === 3 ? '' : 'wrong group compare';
    }
    const [lo, hi] = l === 'age4' ? [1, 10] : [0, 20];
    if ((m = q.question.match(/^Which number is (bigger|smaller)\? (\d+) or (\d+)$/))) { const x = num(m[2]), y = num(m[3]); return x !== y && num(a) === (m[1] === 'bigger' ? Math.max(x, y) : Math.min(x, y)) && Math.min(x, y) >= lo && Math.max(x, y) <= hi ? '' : 'bigger'; }
    if ((m = q.question.match(/^Which number is the (biggest|smallest)\? ([\d, ]+)$/))) { const v = m[2].split(', ').map(num); return new Set(v).size === 3 && num(a) === (m[1] === 'biggest' ? Math.max(...v) : Math.min(...v)) && Math.min(...v) >= lo && Math.max(...v) <= hi ? '' : 'biggest'; }
    if ((m = q.question.match(/^Which number is between the other two\? ([\d, ]+)$/))) { const v = m[1].split(', ').map(num).sort((x, y) => x - y); return num(a) === v[1] && new Set(v).size === 3 ? '' : 'middle'; }
    if ((m = q.question.match(/^(\w+) has (\d+) (\w+)\. (\w+) has (\d+) \3\. Who has (more|fewer), or is it the same\?$/))) { const x = num(m[2]), y = num(m[5]); const exp = x === y ? 'Same' : (m[6] === 'more') === (x > y) ? m[1] : m[4]; return l === 'age6' && a === exp && x <= 20 && y <= 20 ? '' : 'story compare'; }
    return 'unrecognised';
  },
  sort(l, q, a) {
    let m;
    if (q.question === 'Which one goes with these?') { const shown = q.visual.filter(Boolean); const c = catOf(shown[0]); return shown.length === 3 && shown.every(e => catOf(e) === c) && catOf(a) === c && q.answers.filter(x => catOf(x) === c).length === 1 ? '' : 'goes with'; }
    if (q.question === 'Which one is different?') { const cats = q.answers.map(catOf); const odd = cats.filter(c => c !== cats[q.correct]); return l !== 'toddler' && q.answers.length === 4 && odd.length === 3 && new Set(odd).size === 1 ? '' : 'odd one'; }
    if ((m = q.question.match(/^Which group does (.+) go in\?$/))) return catOf(m[1]) === a && q.answers.length === 3 ? '' : 'group';
    return 'unrecognised';
  },
  patterns(l, q, a) {
    let m;
    if (q.visual && q.question === 'What comes next?') {
      const seq = q.visual.slice(0, -1); if (q.visual[q.visual.length - 1] !== '❓' || q.visual.length > 10) return 'layout';
      for (let L = 1; L <= 4; L++) if (seq.length >= 2 * L && seq.every((x, i) => x === seq[i % L])) return L >= 2 && seq[seq.length % L] === a && q.answers.length >= 3 && (l !== 'toddler' || L === 2) ? '' : 'wrong pattern';
      return 'no period';
    }
    if ((m = q.question.match(/^What comes next\? ([\d, ]+), \?$/))) { const v = m[1].split(', ').map(num); const d = v[1] - v[0]; return l !== 'toddler' && l !== 'age4' && v.every((x, i) => !i || x - v[i - 1] === d) && num(a) === v[3] + d && num(a) <= (l === 'age5' ? 20 : 50) ? '' : 'number pattern'; }
    if ((m = q.question.match(/^Follow the instructions: do (\d+) \w+, then (\d+) \w+\. How many actions altogether\?$/))) return l === 'age6' && num(a) === num(m[1]) + num(m[2]) ? '' : 'instructions';
    return 'unrecognised';
  },
  combine(l, q, a) { return V.addsub(l, q, a, 5); },
  addsub(l, q, a, cap) {
    let m;
    const bad1 = /\b1 (balloons|balls|apples|puppies|chicks|cars|stars|strawberries|ducks|bananas|kittens)\b/.test(q.question);
    if (bad1) return 'plural after 1';
    cap = cap || (l === 'age4' ? 10 : 10);
    if ((m = q.question.match(/^(\d+) .+? and (\d+) .+?\. How many altogether\?$/))) { const x = num(m[1]), y = num(m[2]); const s = q.stage; return s && s.op === 'add' && s.baseCount === x && s.change === y && s.added.emoji !== s.base.emoji && num(a) === x + y && x + y <= cap && x >= 1 && y >= 1 ? '' : 'story add'; }
    if ((m = q.question.match(/^There are (\d+) .+?\. (\d+) (is|are) taken away\. How many are left\?$/))) { const x = num(m[1]), y = num(m[2]); const s = q.stage; return s && s.op === 'remove' && s.baseCount === x && s.change === y && y < x && x <= cap && num(a) === x - y && (y === 1 ? m[3] === 'is' : m[3] === 'are') ? '' : 'story sub'; }
    if ((m = q.question.match(/^What is (\d+) (\+|−) (\d+)\?$/))) { const x = num(m[1]), y = num(m[3]); const r = m[2] === '+' ? x + y : x - y; return l !== 'age4' && r === num(a) && r >= 0 && Math.max(x, r) <= 10 && q.stage && q.stage.baseCount === x ? '' : 'symbolic'; }
    return 'unrecognised';
  },
  partition(l, q, a) {
    let m;
    const maxTotal = l === 'age4' ? 5 : 10;
    if ((m = q.question.match(/^(\d+) \+ \? = (\d+)$/))) { const x = num(m[1]), t = num(m[2]); return x + num(a) === t && t <= maxTotal && t >= 2 && x >= 1 && q.stage && q.stage.baseCount === x && q.stage.change === num(a) ? '' : 'bond'; }
    if ((m = q.question.match(/^Split (\d+) into (\d+) and \?$/))) return l === 'age6' && num(m[2]) + num(a) === num(m[1]) && num(m[1]) <= 10 ? '' : 'split';
    return 'unrecognised';
  },
  missing(l, q, a) {
    let m;
    const max = l === 'grade1' ? 20 : 10, n = num(a);
    if ((m = q.question.match(/^(\d+) \+ \? = (\d+)$/))) return num(m[1]) + n === num(m[2]) && num(m[2]) <= max ? '' : 'a+?';
    if ((m = q.question.match(/^\? \+ (\d+) = (\d+)$/))) return n + num(m[1]) === num(m[2]) && num(m[2]) <= max ? '' : '?+b';
    if ((m = q.question.match(/^(\d+) − \? = (\d+)$/))) return num(m[1]) - n === num(m[2]) && num(m[1]) <= max ? '' : 't-?';
    if ((m = q.question.match(/^\? − (\d+) = (\d+)$/))) return n - num(m[1]) === num(m[2]) && n <= max ? '' : '?-b';
    return 'unrecognised';
  },
  sharing(l, q, a) {
    let m;
    const cap = l === 'grade1' ? 20 : l === 'age5' ? 10 : 12, r = num(a);
    if ((m = q.question.match(/^Share (\d+) .+ equally between (\d+) children\. How many each\??$/))) { const n = num(m[1]), k = num(m[2]); if (n !== k * r || n > cap || (l === 'age5' && k !== 2)) return 'share'; }
    else if ((m = q.question.match(/^Put (\d+) .+ into groups of (\d+)\. How many groups\??$/))) { const n = num(m[1]), k = num(m[2]); if (n !== k * r || n > cap || n % k) return 'group'; }
    else return 'unrecognised';
    if (q.visual) return cnt(q) === num(m[1]) && num(m[1]) <= 10 ? '' : 'visual';
    return l === 'grade1' || num(m[1]) > 10 ? '' : 'missing visual';
  },
  groups(l, q, a) {
    let m;
    if ((m = q.question.match(/^(\d+) (bags|plates|boxes) have (\d+) .+ in each\. How many .+ altogether\?$/))) return num(m[1]) * num(m[3]) === num(a) && [2, 5, 10].includes(num(m[3])) && num(m[1]) >= 2 && num(m[1]) <= 5 ? '' : 'story';
    if ((m = q.question.match(/^(\d+(?: \+ \d+)+) = \?$/))) { const v = m[1].split(' + ').map(num); return new Set(v).size === 1 && v.reduce((s, x) => s + x, 0) === num(a) ? '' : 'repeated add'; }
    return 'unrecognised';
  },
  skip(l, q, a) {
    let m;
    if ((m = q.question.match(/^Count (back )?by (\d+)s: (.+)$/))) {
      const step = num(m[2]); const parts = m[3].split(', '); if (![2, 5, 10].includes(step)) return 'step';
      const dir = m[1] ? -step : step; const vals = parts.map(p => p === '?' ? num(a) : num(p));
      return vals.every((v, i) => !i || v - vals[i - 1] === dir) && vals.every(v => v >= 0 && v <= 120) ? '' : 'skip arithmetic';
    }
    return 'unrecognised';
  },
  numbers(l, q, a) {
    let m; const n = num(a);
    if ((m = q.question.match(/^What number comes (after|before) (\d+)\?$/))) return n === num(m[2]) + (m[1] === 'after' ? 1 : -1) && n >= 0 && n <= 120 ? '' : 'after/before';
    if ((m = q.question.match(/^What number is between (\d+) and (\d+)\?$/))) return num(m[2]) - num(m[1]) === 2 && n === num(m[1]) + 1 ? '' : 'between';
    if ((m = q.question.match(/^What is 10 (more|less) than (\d+)\?$/))) return n === num(m[2]) + (m[1] === 'more' ? 10 : -10) && n >= 0 && num(m[2]) <= 120 ? '' : 'ten more/less';
    if ((m = q.question.match(/^Which number is (.+)\?$/))) return wordToNum(m[1]) === n && n <= 120 && !/ hundred and zero/.test(m[1]) ? '' : 'number word';
    return 'unrecognised';
  },
  place(l, q, a) {
    let m; const n = num(a);
    if ((m = q.question.match(/^How many tens are in (\d+)\?$/))) return n === Math.floor(num(m[1]) / 10) ? '' : 'tens';
    if ((m = q.question.match(/^(\d+) is (\d+) tens and how many ones\?$/))) return num(m[2]) * 10 + n === num(m[1]) && n < 10 ? '' : 'ones';
    if ((m = q.question.match(/^(\d+) tens and (\d+) ones = \?$/))) return n === num(m[1]) * 10 + num(m[2]) && num(m[2]) < 10 ? '' : 'build';
    if ((m = q.question.match(/^What is the value of the (\d) in (\d+)\?$/))) { const s = m[2]; return s.indexOf(m[1]) === s.lastIndexOf(m[1]) && s[0] === m[1] && n === num(m[1]) * 10 ? '' : 'value'; }
    if ((m = q.question.match(/^(\d+) = (\d+) \+ \?$/))) return num(m[2]) + n === num(m[1]) && n > 0 && num(m[1]) <= 99 ? '' : 'split';
    return 'unrecognised';
  },
  word(l, q, a) {
    let m; const n = num(a), t = q.question;
    if ((m = t.match(/^(\w+) has (\d+) (\w+)\. \1 gets (\d+) more\./))) return num(m[2]) + num(m[4]) === n && n <= 20 ? '' : 'join';
    if ((m = t.match(/^(\w+) has (\d+) (\w+)\. \1 gives away (\d+)\./))) return num(m[2]) - num(m[4]) === n && n > 0 ? '' : 'separate';
    if ((m = t.match(/^(\w+) has (\d+) (\w+)\. (\w+) has (\d+) \3\. How many more does \1 have\?$/))) return num(m[2]) - num(m[5]) === n && n > 0 && num(m[2]) <= 20 ? '' : 'compare';
    if ((m = t.match(/^There are (\d+) children in the class\. (\d+) are boys\./))) return num(m[1]) - num(m[2]) === n && n > 0 && num(m[1]) <= 20 ? '' : 'part';
    if ((m = t.match(/^(\w+) had (\d+) (\w+)\. Then \1 found some more\. Now \1 has (\d+)\./))) return num(m[2]) + n === num(m[4]) && num(m[4]) <= 20 ? '' : 'change';
    if ((m = t.match(/^(\w+) has (\d+) (\w+) and (\w+) has (\d+) \3\. How many altogether\?$/))) return num(m[2]) + num(m[5]) === n && n <= 20 ? '' : 'total';
    return 'unrecognised';
  },
  fractions(l, q, a) {
    let m;
    if ((m = q.question.match(/^What is half of (\d+)\?$/))) return num(m[1]) % 2 === 0 && num(m[1]) / 2 === num(a) ? '' : 'half';
    if (q.question === 'How many halves make one whole?') return a === '2' ? '' : 'halves';
    if (q.question === 'A cake is cut into 2 equal parts. What is each part called?') return a === 'a half' ? '' : 'name';
    if ((m = q.question.match(/^A pizza is cut into 2 parts\. (The two parts are the same size\.|One part is bigger than the other\.) Are these halves\?$/))) return a === (m[1].startsWith('The two') ? 'Yes' : 'No') ? '' : 'equal parts';
    return 'unrecognised';
  },
  money(l, q, a) {
    const t = q.question; let m;
    if (/(^|\D)[12]c\b/.test(t) || q.answers.some(x => /^[12]c$/.test(x))) return 'withdrawn coin';
    if (t === 'Which coin is gold?') return ['$1', '$2'].includes(a) && q.answers.filter(x => x.startsWith('$')).length === 1 && q.answers.every(x => [5, 10, 20, 50, 100, 200].includes(coinVal(x))) ? '' : 'gold';
    if ((m = t.match(/^Which coin is worth the (most|least)\?$/))) { const v = q.answers.map(coinVal); return new Set(v).size === 3 && v.every(x => [5, 10, 20, 50, 100, 200].includes(x)) && coinVal(a) === (m[1] === 'most' ? Math.max(...v) : Math.min(...v)) ? '' : 'most/least'; }
    if ((m = t.match(/^How many cents is a (\S+) coin worth\?$/))) return l === 'grade1' && num(a) === coinVal(m[1]) && [100, 200].includes(num(a)) ? '' : 'cents';
    if ((m = t.match(/^How many (\S+) coins make \$1\?$/))) return l === 'age6' && num(a) * coinVal(m[1]) === 100 ? '' : 'make';
    if ((m = t.match(/^A toy costs (\S+)\. You have a (\S+) coin\. Do you have enough\?$/))) return l === 'age6' && a === (coinVal(m[2]) >= coinVal(m[1]) ? 'Yes' : 'No') && q.answers.length === 2 ? '' : 'afford';
    if ((m = t.match(/^You have (.+)\. How many cents altogether\?$/))) { const coins = m[1].split(', '); const s = coins.reduce((x, c) => x + coinVal(c), 0); return s === num(a) && coins.length >= 2 && coins.every(c => (l === 'grade1' ? [5, 10, 20, 50] : [5, 10]).includes(coinVal(c))) && s <= (l === 'grade1' ? 100 : 30) && q.answers.every(x => num(x) % 5 === 0) ? '' : 'total'; }
    return 'unrecognised';
  },
  measure(l, q, a) {
    const t = q.question; let m;
    if ((m = t.match(/^Which bar is (longer|shorter)\?$/))) { const x = rowCount(q, 0), y = rowCount(q, 1); const exp = x === y ? 'Same' : (m[1] === 'longer') === (x > y) ? 'Top bar' : 'Bottom bar'; return a === exp && q.visual.length === 10 ? '' : 'bars'; }
    if (/bigger|smaller/.test(t)) return l !== 'age5' && l !== 'age6' && l !== 'grade1' && pairOk(SIZE, q, 'bigger', 'smaller') ? '' : 'size';
    if (/heavier|lighter/.test(t)) return l !== 'toddler' && pairOk(MASS, q, 'heavier', 'lighter') ? '' : 'mass';
    if (/holds/.test(t)) return (l === 'age5' || l === 'age6' || l === 'grade1') && pairOk(CAP, q, 'more', 'less') ? '' : 'capacity';
    if (/takes longer|quicker/.test(t)) return (l === 'age6' || l === 'grade1') && pairOk(DUR, q, 'longer', 'quicker') ? '' : 'duration';
    if ((m = t.match(/^A (\w+) is (\d+) paper clips long\. A (\w+) is (\d+) paper clips long\. (.+)$/))) {
      const x = num(m[2]), y = num(m[4]); if (l !== 'grade1' || x === y || x < 2 || y < 2) return 'g1 clips';
      if ((m = m[5].match(/^How many more paper clips long is the (\w+)\?$/))) return x > y && num(a) === x - y ? '' : 'clip diff';
      const w = t.match(/Which is (longer|shorter)\?$/)[1]; return a === `The ${(w === 'longer') === (x > y) ? t.match(/^A (\w+)/)[1] : t.match(/\. A (\w+)/)[1]}` ? '' : 'clip which';
    }
    return 'unrecognised';
  },
  time(l, q, a) {
    const t = q.question; let m;
    const cyc = (list, w) => { const i = list.indexOf(m[2]); return a === list[(i + (m[1] === 'after' ? 1 : -1) + list.length) % list.length] && !q.answers.includes(m[2]) ? '' : w; };
    if ((m = t.match(/^Which day comes (after|before) (\w+)\?$/))) return cyc(DAYS, 'day');
    if ((m = t.match(/^Which month comes (after|before) (\w+)\?$/))) return l === 'grade1' ? cyc(MONTHS, 'month') : 'month level';
    if (t === 'Which day is in the weekend?') return ['Saturday', 'Sunday'].includes(a) && q.answers.filter(x => ['Saturday', 'Sunday'].includes(x)).length === 1 ? '' : 'weekend';
    if ((m = t.match(/^When do you (.+)\?$/))) return l === 'age6' && TOD[m[1]] === a ? '' : 'time of day';
    if ((m = t.match(/^How many (.+)\?$/))) return l === 'grade1' && ({ 'days are in a week': 7, 'months are in a year': 12, 'hours are in a day': 24 })[m[1]] === num(a) ? '' : 'count';
    if ((m = t.match(/^Which happens (first|last)\?$/))) { const s = SEQ.find(e => q.answers.every(x => e.includes(x))); return s && q.answers.length === 3 && a === s[m[1] === 'first' ? 0 : 2] && l !== 'grade1' ? '' : 'sequence'; }
    return 'unrecognised';
  },
  shape2d(l, q, a) {
    const t = q.question; let m;
    if ((m = t.match(/^Which one is a (\w+)\?$/))) return emoShape(a) === m[1] && q.answers.filter(x => emoShape(x) === m[1]).length === 1 && l !== 'age5' && l !== 'age6' && l !== 'grade1' ? '' : 'find';
    const s = SHAPE_BY_FIG(q.figure); if (!s) return 'no figure';
    if (t === 'What shape is this?') return a === s && !(a === 'square' && q.answers.includes('rectangle')) && (l !== 'toddler' || ['circle', 'square', 'triangle'].includes(s)) && (l === 'toddler' || l === 'age4' ? !['pentagon', 'hexagon'].includes(s) : true) ? '' : 'name';
    if (t === 'How many sides does this shape have?') return s !== 'circle' && SIDES[s] === num(a) ? '' : 'sides';
    if (t === 'How many corners does this shape have?') return SIDES[s] === num(a) ? '' : 'corners';
    return 'unrecognised';
  },
  position(l, q, a) {
    const t = q.question; let m; const f = q.figure;
    if (t === 'Where is the ball?') return f && f.type === 'position' && f.rel === a && ['in', 'on', 'under', 'beside'].includes(a) ? '' : 'where';
    if (t === 'Which way is the arrow pointing?') { const arrow = q.visual.find(Boolean); return ({ '⬆️': 'up', '⬇️': 'down', '⬅️': 'left', '➡️': 'right' })[arrow] === a ? '' : 'arrow'; }
    const items = q.visual.filter(Boolean);
    if ((m = t.match(/^Which one is (in the middle|on the left|on the right)\?$/))) return items.length === 3 && a === items[m[1] === 'on the left' ? 0 : m[1] === 'on the right' ? 2 : 1] ? '' : 'row';
    if ((m = t.match(/^What is between (\S+) and (\S+)\?$/))) return items.length === 3 && m[1] === items[0] && m[2] === items[2] && a === items[1] ? '' : 'between';
    if ((m = t.match(/^What is next to (\S+)\?$/))) return items.length === 3 && m[1] === items[0] && a === items[1] ? '' : 'next to';
    if ((m = t.match(/^Which one is (on top|at the bottom)\?$/))) return items.length === 2 && q.visual.slice(0, 5).some(Boolean) && q.visual.slice(5).some(Boolean) && a === (m[1] === 'on top' ? q.visual.slice(0, 5).find(Boolean) : q.visual.slice(5).find(Boolean)) ? '' : 'stack';
    if ((m = t.match(/^You start at (\S+)\. Move (\d+) steps? to the (left|right)\. Where do you stop\?$/))) { const s = items.indexOf(m[1]); const e = s + (m[3] === 'right' ? 1 : -1) * num(m[2]); return items.length === 5 && new Set(items).size === 5 && e >= 0 && e < 5 && items[e] === a ? '' : 'path'; }
    return 'unrecognised';
  },
  data(l, q, a) {
    const t = q.question; let m;
    if (q.figure && q.figure.type === 'tally') return q.figure.count >= 1 && q.figure.count <= 20 && num(a) === q.figure.count ? '' : 'tally';
    if (q.visual) {
      if (q.visual.length !== 10) return 'layout';
      const x = rowCount(q, 0), y = rowCount(q, 1), A = q.visual[0], B = q.visual[5]; if (x < 1 || y < 1 || A === B) return 'rows';
      if (/^How many .+ are in the picture\?$/.test(t)) return num(a) === x ? '' : 'count';
      if (t === 'Which one is there more of?') return x !== y && a === (x > y ? A : B) ? '' : 'most';
      if (/^How many more .+ than .+ are there\?$/.test(t)) return l === 'age6' && x > y && num(a) === x - y ? '' : 'diff';
      if (t === 'How many things are in the picture altogether?') return l === 'age6' && num(a) === x + y ? '' : 'total';
      return 'unrecognised';
    }
    if ((m = t.match(/^Votes for favourite pet: (\w+) (\d+), (\w+) (\d+), (\w+) (\d+)\. Which pet got the (most|fewest) votes\?$/))) { const v = [m[2], m[4], m[6]].map(num), n = [m[1], m[3], m[5]]; return new Set(v).size === 3 && a === n[v.indexOf(m[7] === 'most' ? Math.max(...v) : Math.min(...v))] ? '' : 'votes'; }
    if ((m = t.match(/^(\w+) got (\d+) votes\. (\w+) got (\d+) votes\. How many more votes did (\w+) get than (\w+)\?$/))) { const x = num(m[2]), y = num(m[4]); return x !== y && m[5] === (x > y ? m[1] : m[3]) && num(a) === Math.abs(x - y) ? '' : 'vote diff'; }
    if ((m = t.match(/^(\w+) got (\d+) votes\. (\w+) got (\d+) votes\. How many votes altogether\?$/))) return num(a) === num(m[2]) + num(m[4]) ? '' : 'vote total';
    return 'unrecognised';
  },
  // Grade 1 topics that existed before
  mixed(l, q, a) { return V.arith(q, a, '+−'); }, add(l, q, a) { return V.arith(q, a, '+'); }, sub(l, q, a) { return V.arith(q, a, '−'); },
  arith(q, a, ops) {
    const m = q.question.match(/^What is (\d+) (\+|−) (\d+)\?$/); if (!m || !ops.includes(m[2])) return 'text';
    const x = num(m[1]), y = num(m[3]), r = m[2] === '+' ? x + y : x - y;
    return r === num(a) && r >= 0 && x <= 20 && y <= 20 && (m[2] === '−' || r <= 20) ? '' : 'arithmetic within 20';
  },
  clock(l, q, a) { const f = q.figure; return f && f.type === 'clock' && a === `${f.hour}:${String(f.minute).padStart(2, '0')}` && f.minute % 30 === 0 ? '' : 'clock'; },
  shapes(l, q, a) {
    if (q.figure && q.figure.type === 'polygon' && /^How many sides does this shape have\?$/.test(q.question)) return q.figure.sides >= 3 && q.figure.sides <= 6 && String(q.figure.sides) === a ? '' : 'polygon';
    return V.shape2d(l, q, a);
  }
};

const fail = (k, msg, q) => { (fails[k] = fails[k] || []).push(msg + ' :: ' + JSON.stringify(q)); };
function generic(level, k, q) {
  const a = q.answers, c = q.correct;
  if (!(c >= 0 && c < a.length)) return fail(k, 'bad correct index', q);
  if (a.length < 2) fail(k, 'fewer than 2 answers', q);
  if (new Set(a).size !== a.length) fail(k, 'duplicate answers', q);
  if (a.some(x => x === '' || x == null)) fail(k, 'empty answer', q);
  if (a.every(x => x.trim() !== '' && !isNaN(Number(x)))) { const n = a.map(Number); if (n.some((v, i) => i && v <= n[i - 1])) fail(k, 'not ascending', q); if (n.some(v => v < 0)) fail(k, 'negative', q); }
  // Age levels use big simple buttons; only phrase answers (sequences, durations) use the lettered list.
  const lettered = q.topic === 'time' || q.topic === 'measure';
  if (level === 'grade1' ? q.simple : (!q.simple && !lettered)) fail(k, 'simple flag wrong for level', q);
  if (q.visual) { if (!q.visualLabel) fail(k, 'visual without label', q); if (q.visual.length > 10) fail(k, 'visual too tall', q); if (q.rowsOfFive && q.visual.some(x => typeof x !== 'string')) fail(k, 'bad visual', q); }
  if (q.stage && (q.stage.baseCount + (q.stage.op === 'add' ? q.stage.change : 0)) > 10) fail(k, 'stage beyond 10 slots', q);
  if (!q.question || /undefined|NaN|\[object/.test(q.question + a.join())) fail(k, 'bad text', q);
}
function verify(level, topic, q, k) {
  const err = V[topic](level, q, q.answers[q.correct]);
  if (err) fail(k, err, q);
}

// ---- each level offers exactly its intended topics, Mixed All Questions first
LEVELS.forEach(l => {
  const got = Q.topicsFor(l).map(t => t.value).join();
  if (got !== EXPECTED[l]) fail(l + '/topic-list', `topics ${got} != ${EXPECTED[l]}`, {});
  if (Q.normaliseTopic(l, 'bogus') !== 'all') fail(l + '/default', 'unknown topic does not fall back to all', {});
});

// ---- every topic: correct answers, valid distractors, answer position spread
const positions = {};
LEVELS.forEach(level => {
  Q.topicsFor(level).filter(t => t.value !== 'all').forEach(t => {
    const k = `${level}/${t.value}`, pos = {};
    for (let i = 0; i < N; i++) {
      const q = Q.generateQuestion(level, t.value); total++;
      if (q.topic !== t.value) { fail(k, 'wrong topic tag ' + q.topic, q); continue; }
      generic(level, k, q); verify(level, t.value, q, k);
      pos[q.correct] = (pos[q.correct] || 0) + 1;
    }
    positions[k] = pos;
  });
});

// ---- Mixed All Questions: all supported topics appear, with a reasonable balance, nothing unsupported
LEVELS.forEach(level => {
  const offered = Q.topicsFor(level).map(t => t.value).filter(v => v !== 'all');
  const seen = {}, K = 6000, k = `${level}/all`;
  for (let i = 0; i < K; i++) {
    const q = Q.generateQuestion(level, 'all'); total++;
    if (!offered.includes(q.topic)) { fail(k, 'unsupported topic in Mixed All: ' + q.topic, q); continue; }
    seen[q.topic] = (seen[q.topic] || 0) + 1;
    if (i < 1500) { generic(level, k, q); verify(level, q.topic, q, k); }
  }
  const weight = (v) => level === 'grade1' && v === 'mixed' ? 2 : 1;
  const sum = offered.filter(v => !(level === 'grade1' && (v === 'add' || v === 'sub'))).reduce((s, v) => s + weight(v), 0);
  offered.forEach(v => {
    if (level === 'grade1' && (v === 'add' || v === 'sub')) { if (seen[v]) fail(k, v + ' should only be inside mixed arithmetic', {}); return; }
    const expected = K * weight(v) / sum;
    if (!seen[v] || seen[v] < expected * 0.6 || seen[v] > expected * 1.5) fail(k, `topic ${v} unbalanced: ${seen[v] || 0} of ${K} (expected about ${Math.round(expected)})`, {});
  });
  // unsupported topics fall back to Mixed All Questions
  ['money', 'tables', 'clock', 'mul', 'data', 'groups', 'bogus'].filter(x => !offered.includes(x)).forEach(x => {
    if (Q.normaliseTopic(level, x) !== 'all') fail(k, 'unsupported topic accepted: ' + x, {});
    for (let i = 0; i < 100; i++) { const q = Q.generateQuestion(level, x); if (!offered.includes(q.topic)) fail(k, `unsupported ${x} generated ${q.topic}`, q); }
  });
});

// ---- position of the correct answer is not stuck (large numeric/text sets)
Object.entries(positions).forEach(([k, pos]) => {
  const t = Object.values(pos).reduce((a, b) => a + b, 0), n = Object.keys(pos).length;
  const top = Math.max(...Object.values(pos)) / t;
  if (n >= 3 && top > 0.7) fail(k + '/position', 'correct answer sits in one position too often: ' + JSON.stringify(pos), {});
});

// ---- no repeats within a game, small and large pools; Solo and 1 v 1 decks
let repeatsBad = [];
LEVELS.forEach(level => Q.topicsFor(level).forEach(t => {
  const bank = Q.buildQuestionBank(level, t.value, 500), keys = bank.map(Q.questionKey);
  if (!bank.length || new Set(keys).size !== keys.length) repeatsBad.push(`${level}/${t.value}: bank not distinct (${bank.length})`);
  const deck = Q.createQuestionDeck(bank), n = bank.length;
  const round = Array.from({ length: n }, () => Q.questionKey(deck.next()));
  if (new Set(round).size !== n) repeatsBad.push(`${level}/${t.value}: repeat before the pool was used up`);
}));
if (repeatsBad.length) fail('no-repeat', repeatsBad.slice(0, 4).join(' | '), {});
{
  // 1 v 1 with two different levels: each player has their own deck and stays inside their own level/topic.
  const b1 = Q.buildQuestionBank('age5', 'all', 500), b2 = Q.buildQuestionBank('grade1', 'all', 500);
  const d1 = Q.createQuestionDeck(b1), d2 = Q.createQuestionDeck(b2);
  for (let i = 0; i < 300; i++) {
    const q1 = d1.next(), q2 = d2.next(); total += 2;
    if (!Q.topicsFor('age5').some(t => t.value === q1.topic)) fail('versus', 'player 1 got foreign topic ' + q1.topic, q1);
    if (!Q.topicsFor('grade1').some(t => t.value === q2.topic)) fail('versus', 'player 2 got foreign topic ' + q2.topic, q2);
    verify('age5', q1.topic, q1, 'versus-p1'); verify('grade1', q2.topic, q2, 'versus-p2');
  }
}

// ---- Grade 2-6 are untouched: same topic lists as before and no early-years topics or tags leaking in
{
  const before = { 2: 'all,mixed,add,sub,mul,div,tables,compare,fractions,money,clock,shapes', 3: 'all,mixed,add,sub,mul,div,tables,compare,fractions,money,clock,shapes', 4: 'all,mixed,add,sub,mul,div,tables,compare,fractions,money,clock,shapes', 5: 'all,mixed,add,sub,mul,div,fractions,shapes', 6: 'all,mixed,add,sub,mul,div,fractions,shapes' };
  Object.entries(before).forEach(([g, list]) => { if (Q.topicsFor('grade' + g).map(t => t.value).join() !== list) fail('grade' + g, 'topic list changed', {}); });
}

// ---- saved profiles and backups
{
  const mem = {};
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const S = require(path.join(__dirname, '..', 'public', 'store.js'));
  const raw = (lastSetup) => JSON.stringify({ app: 'mathQuizBattle', schema: 1, profiles: [{ id: 'p1', name: 'Kit', lastSetup }] });
  const parse = (setup) => S.parseBackup(raw(setup)).profiles[0].lastSetup;
  // Backups made before age levels had topics stored 'all' (or nothing); new topics round-trip.
  if (parse({ difficulty: 'age4', topic: 'all' }).topic !== 'all') fail('compat', 'old age-level preference lost', {});
  if (parse({ difficulty: 'age6', topic: 'subitise' }).topic !== 'subitise') fail('compat', 'new age-level topic not kept', {});
  if (parse({ difficulty: 'grade1', topic: 'skip' }).topic !== 'skip') fail('compat', 'new Grade 1 topic not kept', {});
  if (parse({ difficulty: 'toddler' }).topic !== 'all') fail('compat', 'missing topic should default to all', {});
  // A saved preference the level no longer/yet offers falls back safely instead of breaking.
  if (Q.normaliseTopic('age4', 'mixed') !== 'all' || Q.normaliseTopic('grade1', 'tables') !== 'all') fail('compat', 'stale topic does not fall back', {});
  // Existing profiles are available for the new topics without a reset: topics are code, not saved data.
  if (Q.normaliseTopic('age5', 'data') !== 'data' || Q.normaliseTopic('grade1', 'word') !== 'word') fail('compat', 'new topic not selectable', {});
}

console.log('early-years questions checked:', total);
const keys = Object.keys(fails);
console.log('failing groups:', keys.length);
keys.slice(0, 25).forEach(k => console.log(k, fails[k].length, 'e.g.', fails[k][0].slice(0, 260)));
['toddler/compare', 'age4/patterns', 'age5/missing', 'grade1/money', 'grade1/skip'].forEach(k => { const p = positions[k]; if (p) { const t = Object.values(p).reduce((a, b) => a + b, 0); console.log(k.padEnd(16), Object.keys(p).sort().map(i => i + ':' + Math.round(p[i] / t * 100) + '%').join(' ')); } });
process.exit(keys.length ? 1 : 0);
