// Installable/offline checks: manifest and icons, then a real browser (http://localhost is a secure context):
// service worker installs and precaches, the game still loads and plays after the server is stopped,
// updates are never held back by the HTTP cache, and the "new version" notice appears. Env: CHROME_PATH.
const fs = require('fs');
const http = require('http');
const path = require('path');
const PUBLIC = path.join(__dirname, '..', 'public');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- static checks ----------
const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
const files = JSON.parse('[' + sw.match(/const FILES = \[([\s\S]*?)\];/)[1].replace(/'/g, '"') + ']');
ok(files.every(f => f === './' || fs.existsSync(path.join(PUBLIC, f))), `every file listed in sw.js exists (${files.length} files)`);
const scripts = [...fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
ok(scripts.every(s => files.includes(s)), 'every <script> in index.html is precached by sw.js');
ok(files.includes('style.css') && files.includes('index.html') && files.includes('manifest.webmanifest'), 'page, stylesheet and manifest are precached');
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
ok(manifest.name && manifest.short_name && manifest.start_url === './' && manifest.display === 'standalone', 'manifest has name, start_url and display');
ok(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512') && manifest.icons.some(i => i.purpose === 'maskable'), 'manifest has 192, 512 and maskable icons');
const pngSize = (f) => { const d = fs.readFileSync(path.join(PUBLIC, f)); return `${d.readUInt32BE(16)}x${d.readUInt32BE(20)}`; };
ok(manifest.icons.filter(i => i.type === 'image/png').every(i => fs.existsSync(path.join(PUBLIC, i.src)) && pngSize(i.src) === i.sizes), 'icon files exist and match the sizes declared in the manifest');
ok(pngSize('icons/apple-touch-icon.png') === '180x180', 'apple-touch-icon is 180x180');
const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
ok(html.includes('rel="manifest"') && html.includes('apple-touch-icon') && html.includes('rel="icon"'), 'index.html links the manifest and icons');

// ---------- browser checks ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let marker = 'mq-marker-1';
let swVersion = null;
const sockets = new Set();
const server = http.createServer((req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file.endsWith('/')) file += 'index.html';
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) { res.writeHead(404); res.end('not found'); return; }
  let body = fs.readFileSync(full);
  if (file === '/index.html') body = Buffer.from(body.toString().replace('</body>', `<!--${marker}--></body>`));
  if (file === '/sw.js' && swVersion) body = Buffer.from(body.toString().replace(/const VERSION = '[^']*'/, `const VERSION = '${swVersion}'`));
  // A long max-age tempts the browser's own cache to keep old files; the service worker must still get fresh ones.
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
  res.end(body);
});
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${server.address().port}/`;
  let browser;
  try {
    const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'], headless: true }
      : { executablePath: await chromium.executablePath(), args: [...chromium.args, '--no-sandbox'], headless: 'shell' });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 500 });
    await page.goto(base);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await sleep(400);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0]);
      return { names, urls: (await cache.keys()).map(r => new URL(r.url).pathname) };
    });
    ok(cached.names.length === 1 && cached.names[0].startsWith('mathquiz-'), 'one versioned cache is created: ' + cached.names.join());
    ok(files.filter(f => f !== './').every(f => cached.urls.includes('/' + f)) && cached.urls.includes('/'), 'all app files are precached');

    // updates are not held back by the HTTP cache (server says max-age=3600)
    await page.reload(); await sleep(300);
    ok((await page.content()).includes('mq-marker-1'), 'page loads (marker 1)');
    marker = 'mq-marker-2';
    await page.reload(); await sleep(300);
    ok((await page.content()).includes('mq-marker-2'), 'a changed page is picked up on reload despite max-age=3600');
    ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the page is controlled by the service worker');

    // a new service worker version: old cache is replaced and the "new version" notice appears
    ok(await page.evaluate(() => document.getElementById('updateBanner').classList.contains('hidden')), 'no update notice before an update');
    swVersion = 'test-update';
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await page.waitForFunction(() => !document.getElementById('updateBanner').classList.contains('hidden'), { timeout: 8000 })
      .then(() => ok(true, 'the "new version is ready" notice appears after an update'), () => ok(false, 'the "new version is ready" notice appears after an update'));
    const names = await page.evaluate(() => caches.keys());
    ok(names.length === 1 && names[0] === 'mathquiz-test-update', 'the old cache is deleted when the new version activates: ' + names.join());

    // offline: stop the server completely
    await new Promise(r => { server.close(r); sockets.forEach(s => s.destroy()); });
    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(500);
    const offline = await page.evaluate(() => ({ title: document.title, setup: !document.getElementById('setupPanel').classList.contains('hidden') }));
    ok(offline.title === 'Math Quiz Battle' && offline.setup, 'with the server stopped, the game still loads from the cache');
    await page.evaluate(() => { document.getElementById('difficulty1').value = 'grade2'; document.getElementById('difficulty1').dispatchEvent(new Event('change')); document.getElementById('topic1').value = 'fractions'; document.getElementById('startButton').click(); });
    await sleep(300);
    const playing = await page.evaluate(() => ({ board: document.querySelectorAll('.answer-button').length, text: document.querySelector('.question-text').textContent }));
    ok(playing.board >= 3 && playing.text.length > 3, 'a game can be started and played offline: "' + playing.text + '"');
    await page.evaluate(() => document.getElementById('stopButton').click());

  } catch (error) {
    ok(false, 'browser checks crashed: ' + error.message);
  }
  if (browser) await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll PWA checks passed');
  process.exit(failures ? 1 : 0);
})();
