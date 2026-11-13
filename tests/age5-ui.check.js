// UI checks in jsdom: age-level labels, delayed teaching aids (circles / crossed-out objects) that never block answering,
// reduced motion, and that every Age 5 question type renders and can be answered.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'public') + '/';
const html = fs.readFileSync(dir + 'index.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const SCRIPTS = ['questions.js', 'trophies.js', 'parent.js', 'report.js', 'store.js', 'audio.js', 'menus.js', 'game.js'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

function boot({ reducedMotion = false } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, errors = [];
  w.addEventListener('error', e => errors.push(String(e.message)));
  if (reducedMotion) w.matchMedia = (q) => ({ matches: /reduced-motion/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  SCRIPTS.forEach(f => w.eval(fs.readFileSync(dir + f, 'utf8')));
  const d = w.document, $ = id => d.getElementById(id);
  const tap = b => b.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true }));
  const board = () => d.querySelector('.question-board');
  const buttons = () => [...board().querySelectorAll('.answer-button')];
  const score = () => d.querySelectorAll('.score-value')[0].textContent;
  // Plays exactly this question: the game builds its deck from the bank (cached per level for the page), so a bank of one repeats it.
  async function play(question, level) {
    w.MQQuestions.buildQuestionBank = () => [question];
    $('difficulty1').value = level; $('difficulty1').dispatchEvent(new w.Event('change', { bubbles: true }));
    $('startButton').click();
    await sleep(30);
  }
  return { w, d, $, tap, board, buttons, score, play, errors };
}

const Q = require(path.join(dir, 'questions.js'));
const find = (level, pred) => { for (let i = 0; i < 20000; i++) { const q = Q.generateQuestion(level); if (pred(q)) return q; } throw new Error('no question found'); };
const hasCell = (q, re) => q.picture && q.picture.groups.some(g => g.rows.some(r => re.test(r)));

(async () => {
  // ---- age-level labels: no descriptions on the level selection screen
  {
    const g = boot();
    const text = v => [...g.$('difficulty1').options].find(o => o.value === v).textContent;
    ok(['toddler', 'age4', 'age5', 'age6'].map(text).join('|') === 'Age 2–3|Age 4|Age 5|Age 6', 'level selector shows plain Age 2–3, Age 4, Age 5, Age 6');
    ok([...g.$('difficulty1').options].every(o => !/·|Counting|Making|Add &/.test(o.textContent)) && text('grade1') === 'Grade 1', 'no descriptions in any level label; Grade labels unchanged');
    ok([...g.$('difficulty2').options].map(o => o.textContent).join() === [...g.$('difficulty1').options].map(o => o.textContent).join(), 'player 2 selector matches');
  }

  // ---- delayed teaching aids
  const sub = find('age4', q => /^\d+ − \d+ = \?$/.test(q.question) && hasCell(q, /x/));
  const miss = find('age4', q => hasCell(q, /O/));
  const add = find('age4', q => /^\d+ \+ \d+ = \?$/.test(q.question));
  const countObjs = q => q.picture.groups.reduce((s, grp) => s + grp.rows.join('').replace(/[^XxY]/g, '').length, 0);
  {
    const g = boot();
    await g.play(sub, 'age4');
    let pic = g.d.querySelector('.picture');
    const cells = pic.querySelectorAll('.cell').length;
    ok(pic.classList.contains('aids-pending') && !pic.classList.contains('aids-flash'), 'crossed-out objects are held back at first');
    ok(pic.querySelectorAll('.obj').length === countObjs(sub) && pic.querySelectorAll('.cell.removed').length > 0, 'every original object is on screen from the start');
    const label = pic.getAttribute('aria-label');
    ok(/crossed out/.test(label) && pic.getAttribute('role') === 'img', 'screen readers get the full picture description straight away');
    const wrong = g.buttons().find((b, j) => j !== sub.correct);
    g.tap(wrong);
    ok(wrong.classList.contains('wrong') && wrong.disabled && /Try another/.test(g.d.getElementById('roundFeedback').textContent), 'a wrong tap during the delay works normally');
    ok(g.d.querySelector('.picture').classList.contains('aids-pending'), 'the aid timing is not affected by answering');
    await sleep(1500);
    pic = g.d.querySelector('.picture');
    ok(!pic.classList.contains('aids-pending') && pic.classList.contains('aids-flash'), 'after a short delay the crossed-out objects appear with a highlight');
    ok(pic.querySelectorAll('.cell').length === cells && pic.getAttribute('aria-label') === label, 'layout and description are unchanged when the aids appear');
    g.tap(g.buttons()[sub.correct]);
    ok(g.score() === '1', 'the correct answer scores after the aids appeared');
    ok(g.errors.length === 0, 'no script errors');
  }
  {
    const g = boot();
    await g.play(miss, 'age4');
    const pic = g.d.querySelector('.picture'), slots = pic.querySelectorAll('.cell.slot').length;
    ok(pic.classList.contains('aids-pending') && slots > 0, 'empty circles are held back at first (same number of cells, so nothing moves)');
    g.tap(g.buttons()[miss.correct]);
    ok(g.score() === '1', 'answering before the circles appear still scores');
    await sleep(1500);
    ok(g.errors.length === 0, 'a delayed aid for a question that is already gone causes no error');
    const g2 = boot();
    await g2.play(add, 'age4');
    const addPic = g2.d.querySelector('.picture');
    await sleep(1500);
    ok(!addPic.classList.contains('aids-pending') && !addPic.classList.contains('aids-flash'), 'pictures without circles or crossed-out objects have no delay or flash');
    ok(g.errors.length === 0 && g2.errors.length === 0, 'no script errors after switching questions');
  }
  {
    const g = boot({ reducedMotion: true });
    await g.play(sub, 'age4');
    const pic = g.d.querySelector('.picture');
    ok(!pic.classList.contains('aids-pending') && !pic.classList.contains('aids-flash'), 'reduced motion: crossed-out objects show at once, with no animation class');
    await sleep(1500);
    ok(!pic.classList.contains('aids-flash'), 'reduced motion: still no flash later');
    g.tap(g.buttons()[sub.correct]);
    ok(g.score() === '1', 'reduced motion: answering works');
  }
  {
    const css = fs.readFileSync(dir + 'style.css', 'utf8');
    ok(/prefers-reduced-motion: reduce\)[^}]*aids-flash/.test(css), 'CSS switches the highlight off for reduced motion');
    ok(/\.aids-pending \.cell\.slot \{ border-color: transparent/.test(css), 'pending circles keep their space (only the outline is hidden)');
  }

  // ---- every Age 5 question type renders and can be answered
  const errorsAll = [];
  const kinds = {};
  for (let i = 0; i < 6000; i++) { const q = Q.generateQuestion('age5'); const k = q.topic + ':' + q.kind; if (!kinds[k]) kinds[k] = q; }
  ok(Object.keys(kinds).length >= 36, `sampled ${Object.keys(kinds).length} Age 5 question types`);
  let rendered = 0;
  for (const [k, q] of Object.entries(kinds)) {
    const g = boot();
    errorsAll.push(g.errors);
    await g.play(q, 'age5');
    const b = g.board(), btns = g.buttons();
    const problems = [];
    if (b.querySelector('.question-text').textContent !== q.question) problems.push('question text');
    if (btns.length !== q.answers.length || btns.some(x => x.disabled)) problems.push('answer buttons');
    if (q.answerVisuals) {
      if (!b.classList.contains('visual-choices') || btns.some((x, j) => !x.querySelector('svg, .blocks') || x.getAttribute('aria-label') !== q.answerLabels[j])) problems.push('visual choices');
      if (btns.some(x => /\d{2,}/.test(x.textContent) && !x.querySelector('.blocks'))) problems.push('visual choice text');
    } else if (!q.groups && btns.map(x => x.textContent).join() !== q.answers.join()) problems.push('answer text');
    if (q.numbers) {
      const row = b.querySelector('.number-sequence');
      if (!row || row.querySelectorAll('.seq-item').length !== q.numbers.length || row.querySelectorAll('.seq-blank').length !== 1 || row.parentElement.className.includes('question-text')) problems.push('number sequence line');
    }
    if (q.pattern && (b.querySelectorAll('.pattern-row svg').length !== 5 || b.querySelectorAll('.pattern-blank').length !== 1)) problems.push('pattern row');
    if (q.promptVisual) {
      const pv = b.querySelector('.prompt-visual');
      if (!pv || pv.querySelectorAll('.block-ten').length !== q.promptVisual.tens || pv.querySelectorAll('.block-one').length !== q.promptVisual.ones) problems.push('place-value blocks');
      if (pv && !/^10$/.test(pv.querySelector('.block-ten').textContent)) problems.push('block-ten numeral');
      if (/\$|coin|money/i.test(pv ? pv.outerHTML : '')) problems.push('money imagery');
    }
    if (q.picture) {
      const pic = b.querySelector('.picture');
      const cellsX = pic ? pic.querySelectorAll('.obj').length : -1;
      const want = q.picture.groups.reduce((s, grp) => s + grp.rows.join('').replace(/[^XxY]/g, '').length, 0);
      if (cellsX !== want) problems.push('picture objects');
      if (q.picture.groups.some(grp => grp.lead) && b.querySelectorAll('.picture-lead').length !== q.picture.groups.length) problems.push('sharing children');
    }
    if (q.figure && !b.querySelector('svg.figure-shape')) problems.push('shape figure');
    if (/\b(tens?|ones?)\b/i.test(b.textContent)) problems.push('"tens"/"ones" wording');
    g.tap(btns[q.correct]);
    if (g.score() !== '1') problems.push('scoring the correct answer');
    ok(!problems.length, `Age 5 ${k} renders and scores${problems.length ? ' — ' + problems.join(', ') : ''}`);
    rendered++;
  }
  ok(errorsAll.every(e => e.length === 0), 'no script errors while rendering all Age 5 types');
  process.exit(failures ? 1 : 0);
})();
