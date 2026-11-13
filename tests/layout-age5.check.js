// Every Age 5 question type on phone landscape, phone portrait and tablet sizes, Solo and 1 vs 1: question, pictures, answers and
// feedback must be inside the viewport with no scrolling or spill-over. Env: VP, SHOW, CHROME_PATH.
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const path = require('path');
const Q = require(path.join(__dirname, '..', 'public', 'questions.js'));
const launch = async () => puppeteer.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'], headless: true } : { executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
const url = require('url').pathToFileURL(path.join(__dirname, '..', 'public', 'index.html')).href;
const VIEWPORTS = (process.env.VP || '568x280,667x300,844x390,390x844,1024x768').split(',').map(s => s.split('x').map(Number));
// Worst case per kind: several samples, keeping the visually largest (most objects / most blocks).
const kinds = {};
for (let i = 0; i < 20000; i++) {
  const q = Q.generateQuestion('age5'), k = q.topic + ':' + q.kind;
  (kinds[k] = kinds[k] || []).push(q);
}
const samples = [];
Object.values(kinds).forEach(list => {
  const size = q => JSON.stringify(q).length;
  list.sort((a, b) => size(b) - size(a));
  samples.push(list[0], list[Math.floor(list.length / 2)]);
});
(async () => {
  const browser = await launch(), page = await browser.newPage(), problems = [];
  let checks = 0;
  for (const [W, H] of VIEWPORTS) {
    await page.setViewport({ width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    for (const mode of ['solo', 'versus']) {
      for (const q of samples) {
        await page.goto(url);
        await page.evaluate((mode, q) => {
          window.MQQuestions.buildQuestionBank = () => [q];
          document.querySelector(`[data-mode=${mode}]`).click();
          [1, 2].forEach(n => { const d = document.getElementById('difficulty' + n); d.value = 'age5'; d.dispatchEvent(new Event('change')); });
          document.getElementById('startButton').click();
        }, mode, q);
        await new Promise(r => setTimeout(r, 40));
        const res = await page.evaluate(() => {
          const H = innerHeight, W = innerWidth, out = [], de = document.documentElement;
          if (de.scrollWidth > W + 1) out.push(`horizontal overflow ${de.scrollWidth}>${W}`);
          if (de.scrollHeight > H + 1) out.push(`needs vertical scroll ${de.scrollHeight}>${H}`);
          const chk = (el, name) => { const r = el.getBoundingClientRect(); if (r.bottom > H + 0.5 || r.top < -0.5 || r.right > W + 0.5 || r.left < -0.5) out.push(`${name} outside viewport`); };
          document.querySelectorAll('.question-board').forEach((b, i) => {
            chk(b, 'board' + i);
            b.querySelectorAll('.answer-button').forEach((a, j) => { chk(a, `board${i} answer${j}`); if (a.scrollWidth > a.clientWidth + 1) out.push(`board${i} answer content overflow`); });
            const q = b.querySelector('.question-text'); chk(q, `board${i} question`); if (q.scrollWidth > q.clientWidth + 1) out.push(`board${i} question overflow`);
            b.querySelectorAll('.picture, .prompt-visual, .number-sequence, .pattern-row, .figure').forEach(el => { chk(el, `board${i} ${el.classList[0]}`); if (el.scrollWidth > el.clientWidth + 1) out.push(`board${i} ${el.classList[0]} wider than its box`); });
            const bb = b.getBoundingClientRect();
            b.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > bb.right + 1 || r.bottom > bb.bottom + 1)) out.push(`board${i} ${(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName} spills out of board`); });
          });
          chk(document.getElementById('roundFeedback'), 'feedback'); chk(document.getElementById('stopButton'), 'stop button');
          // Portrait phones may scroll (the layout rules only promise no scrolling on phones held sideways), but never sideways.
          const portraitPhone = W < 681 && H > W;
          return [...new Set(out)].filter(m => !portraitPhone || !/vertical scroll|outside viewport/.test(m));
        });
        checks++;
        if (res.length) problems.push(`${W}x${H} ${mode} ${q.topic}:${q.kind} "${q.question}": ${res.slice(0, 3).join('; ')}`);
      }
    }
  }
  console.log('age5 layout checks', checks, 'problems', problems.length);
  const agg = {};
  problems.forEach(p => { const k = p.split(' ').slice(0, 3).join(' ') + ' | ' + p.split(': ').slice(1).join(': ').replace(/\d+/g, '#').slice(0, 80); agg[k] = (agg[k] || 0) + 1; });
  Object.entries(agg).slice(0, 25).forEach(([k, v]) => console.log(v, k));
  if (process.env.SHOW) problems.slice(0, Number(process.env.SHOW)).forEach(p => console.log('  e.g.', p));
  process.exitCode = problems.length ? 1 : 0;
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
