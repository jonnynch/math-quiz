// Shared layout rule: whenever a question has an illustration (objects, picture, figure, pattern, blocks, coins ...) it is
// drawn ABOVE the question sentence; questions without one have no empty illustration container. Checked on the real
// rendering code (jsdom) for several levels, plus Age 6 progressive illustrations and Grade 1 coins.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'public') + '/';
const html = fs.readFileSync(dir + 'index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const SCRIPTS = ['questions.js', 'trophies.js', 'parent.js', 'report.js', 'store.js', 'audio.js', 'menus.js', 'game.js'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };
const Q = require(path.join(dir, 'questions.js'));
const find = (level, pred, topic) => { for (let i = 0; i < 20000; i++) { const q = Q.generateQuestion(level, topic); if (pred(q)) return q; } throw new Error('no question found for ' + level); };

const ILLUSTRATION = '.object-stage, .figure, .pattern-row, .number-sequence, .prompt-visual, .counting-visual';

// Renders exactly this question in a fresh page (the game caches banks per level, so a bank of one repeats it).
async function render(question, level) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  SCRIPTS.forEach(f => w.eval(fs.readFileSync(dir + f, 'utf8')));
  const d = w.document, $ = id => d.getElementById(id);
  w.MQQuestions.buildQuestionBank = () => [question];
  $('difficulty1').value = level; $('difficulty1').dispatchEvent(new w.Event('change', { bubbles: true }));
  $('startButton').click();
  await sleep(30);
  const board = d.querySelector('.question-board');
  const info = board.querySelector('.board-info');
  return { w, d, board, info, text: info.querySelector('.question-text'), pictures: [...info.children].filter(el => el.matches(ILLUSTRATION)) };
}
const above = (w, el, text) => !!(el.compareDocumentPosition(text) & w.Node.DOCUMENT_POSITION_FOLLOWING);

(async () => {
  const cases = [
    ['toddler', 'Age 2-3 objects', find('toddler', q => q.visual)],
    ['age4', 'Age 4 picture', find('age4', q => q.picture)],
    ['age5', 'Age 5 pattern', find('age5', q => q.pattern)],
    ['age5', 'Age 5 number sequence', find('age5', q => q.numbers)],
    ['age5', 'Age 5 place-value blocks', find('age5', q => q.promptVisual)],
    ['age5', 'Age 5 shape figure', find('age5', q => q.figure)],
    ['age6', 'Age 6 object stage', find('age6', q => q.stage)],
    ['age6', 'Age 6 crossed-out subtraction', find('age6', q => q.kind === 'objects-sub')],
    ['age6', 'Age 6 coins', find('age6', q => q.coins)],
    ['grade1', 'Grade 1 coins', find('grade1', q => q.coins, 'money')],
    ['grade2', 'Grade 2 coins', find('grade2', q => q.coins, 'money')],
    ['grade2', 'Grade 2 multiplication array', find('grade2', q => q.picture && q.question.includes('×') && q.question.endsWith('= ?'), 'tables')],
    ['grade2', 'Grade 2 fraction diagram', find('grade2', q => q.figure && q.figure.type === 'fraction', 'fractions')],
    ['grade2', 'Grade 2 perimeter diagram', find('grade2', q => q.figure && q.figure.type === 'perimeter', 'shapes')],
    ['grade2', 'Grade 2 bar chart', find('grade2', q => q.figure && q.figure.type === 'bar-chart', 'data')],
    ['grade2', 'Grade 2 number sequence', find('grade2', q => q.numbers, 'numbers')],
    ['grade3', 'Grade 3 coins', find('grade3', q => q.coins, 'money')],
    ['grade3', 'Grade 3 fraction diagram', find('grade3', q => q.figure && q.figure.type === 'fraction', 'fractions')],
    ['grade3', 'Grade 3 square-unit area grid', find('grade3', q => q.figure && q.figure.type === 'grid-area', 'shapes')],
    ['grade3', 'Grade 3 angle diagram', find('grade3', q => q.figure && q.figure.type === 'angle', 'shapes')],
    ['grade4', 'Grade 4 fraction bar', find('grade4', q => q.figure && q.figure.type === 'fraction-bar', 'fractions')],
    ['grade4', 'Grade 4 rectangle measurement', find('grade4', q => q.figure && q.figure.type === 'rectangle-measure', 'shapes')],
    ['grade4', 'Grade 4 angle diagram', find('grade4', q => q.figure && q.figure.type === 'angle', 'shapes')],
    ['grade4', 'Grade 4 banknote', find('grade4', q => q.notes, 'money')],
    ['grade1', 'Grade 1 place-value blocks', find('grade1', q => q.promptVisual, 'numbers')],
    ['grade1', 'Grade 1 picture (bars and graphs)', find('grade1', q => q.picture, 'shapes')],
    ['grade3', 'Grade 3 clock', find('grade3', q => q.figure, 'clock')],
    ['grade2', 'Grade 2 polygon', find('grade2', q => q.figure && q.figure.type === 'polygon', 'shapes')]
  ];
  for (const [level, name, question] of cases) {
    const r = await render(question, level);
    ok(r.pictures.length >= 1 && r.pictures.every(p => above(r.w, p, r.text)), `${name}: the illustration is above the question sentence`);
    ok(r.text && r.text.textContent === question.question, `${name}: the question sentence is still shown`);
    if (question.notes) {
      const notes = [...r.info.querySelectorAll('.banknote')];
      ok(notes.length === question.notes.length && notes.map(n => n.textContent).join() === question.notes.map(v => '$' + v / 100).join(), `${name}: Australian banknotes use the shared money illustration`);
    }
  }

  // No illustration: no empty illustration container is left behind, at several levels.
  const plain = [['grade3', find('grade3', q => !q.picture && !q.figure && !q.visual, 'tables')], ['grade5', find('grade5', q => !q.figure, 'fractions')], ['age6', find('age6', q => q.topic === 'bonds' && !q.picture)], ['grade1', find('grade1', q => !q.picture && !q.figure && !q.promptVisual && !q.coins, 'add')]];
  for (const [level, question] of plain) {
    const r = await render(question, level);
    ok(r.pictures.length === 0 && !r.info.querySelector(ILLUSTRATION), `${level}: a question without an illustration has no illustration container`);
  }

  // Age 6 addition: show the first addend, then reveal the added objects after the shared aid delay.
  {
    const q = find('age6', x => x.kind === 'objects'), m = q.question.match(/^(\d+) \+ (\d+) = \?$/), a = Number(m[1]), b = Number(m[2]);
    const r = await render(q, 'age6'), slots = [...r.d.querySelectorAll('.object-stage .slot')];
    const visible = () => slots.filter(slot => slot.textContent && !slot.classList.contains('added')).length;
    ok(slots.length === 10 && visible() === a && r.d.querySelector('.object-stage.aids-pending'), 'Age 6 addition: initially only the first addend is visible in the fixed ten slots');
    const css = fs.readFileSync(dir + 'style.css', 'utf8');
    ok(css.includes('.object-stage.aids-pending .slot.added { visibility: hidden; }'), 'Age 6 addition: added objects stay invisible during the delay');
    ok(!r.board.textContent.includes(q.resultText), 'Age 6 addition: the answer equation is not shown before answering');
    await sleep(1300);
    ok(slots.filter(slot => slot.textContent).length === a + b && r.d.querySelector('.object-stage.aids-flash'), 'Age 6 addition: the second addend appears after the shared delay');
    r.board.querySelectorAll('.answer-button')[q.correct].dispatchEvent(new r.w.Event('pointerdown', { bubbles: true, cancelable: true }));
    ok(r.board.querySelector('.question-text').textContent === q.resultText, 'Age 6 addition: the equation result appears only after the answer');
  }

  // Age 6 subtraction: every starting object appears before the shared delay; then taken-away objects are crossed out.
  {
    const q = find('age6', x => x.kind === 'objects-sub'), m = q.question.match(/^(\d+) − (\d+) = \?$/), a = Number(m[1]), b = Number(m[2]);
    const r = await render(q, 'age6');
    ok(r.d.querySelectorAll('.counting-visual.picture .obj').length === a, 'Age 6 subtraction: all ' + a + ' starting objects are shown');
    ok(r.d.querySelectorAll('.counting-visual.picture .cell.removed').length === b && r.d.querySelector('.picture.aids-pending'), 'Age 6 subtraction: all starting objects appear with cross-outs hidden at first');
    await sleep(1300);
    ok(r.d.querySelector('.picture.aids-flash'), 'Age 6 subtraction: the ' + b + ' objects taken away are crossed out after the shared delay');
    ok(!r.board.textContent.includes(q.resultText), 'Age 6 subtraction: the answer equation is not shown before answering');
  }

  // Grade 1 money: the coins are drawn (one element per coin, Australian denominations only).
  for (let i = 0; i < 5; i++) {
    const q = find('grade1', x => x.coins, 'money'), r = await render(q, 'grade1');
    const labels = [...r.d.querySelectorAll('.counting-visual.coins .coin-label')].map(e => e.textContent);
    const want = q.coins.map(v => v >= 100 ? '$' + v / 100 : v + 'c');
    ok(labels.join() === want.join() && labels.every(l => /^(5c|10c|20c|50c|\$1|\$2)$/.test(l)), 'Grade 1 money: coins drawn ' + labels.join(' '));
    if (q.kind === 'total') {
      ok(q.question === 'How much money is there altogether?' && /^\$\d+\.\d{2}$|^\d+c$/.test(q.answers[q.correct]), 'Grade 1 money total: natural question with a currency-value answer');
      ok(above(r.w, r.pictures[0], r.text), 'Grade 1 money total: coin illustration appears above the question');
    }
  }

  // Grade 3 bar chart: distinct category labels and accurate accessibility label.
  {
    const q = find('grade3', x => x.figure && x.figure.type === 'bar-chart', 'data');
    const r = await render(q, 'grade3');
    const svg = r.d.querySelector('.figure-bar-chart');
    const cats = [...svg.querySelectorAll('.figure-label[y="88"]')].map(e => e.textContent);
    const aria = svg.getAttribute('aria-label') || '';
    ok(cats.length === 4 && new Set(cats).size === 4 && cats.join() === 'Ap,Pe,Pl,Ba', 'Grade 3 bar chart: category labels are distinct (' + cats.join(', ') + ')');
    ok(q.figure.labels.every((l, i) => aria.includes(`${l} ${q.figure.values[i]}`)), 'Grade 3 bar chart: aria-label includes full fruit names and values');
  }
  process.exit(failures ? 1 : 0);
})();
