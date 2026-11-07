// Unit checks for public/sw.js using mocks (no browser): cache writes finish before the network response is
// returned, a failed cache write never breaks the page, offline fallbacks, install/activate behaviour.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ORIGIN = 'https://game.test';
const CURRENT_VERSION = code.match(/const VERSION = '([^']+)'/)[1];

function load(options = {}) {
  const events = [];
  const handlers = {};
  const stored = new Map();
  const cache = {
    async put(request, response) {
      events.push('put-start');
      await sleep(options.putDelay || 25);          // a slow cache write
      if (options.putFails) { events.push('put-failed'); throw new Error('QuotaExceededError'); }
      stored.set(request.url, response);
      events.push('put-done');
    },
    async match(request) {
      const url = typeof request === 'string' ? new URL(request, ORIGIN + '/').href : request.url;
      return stored.get(url);
    },
    async addAll(requests) { events.push(`addAll:${requests.length}`); }
  };
  const deleted = [];
  const sandbox = {
    self: {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      location: { origin: ORIGIN },
      skipWaiting: async () => { events.push('skipWaiting'); },
      clients: { claim: async () => { events.push('claim'); } }
    },
    caches: {
      open: async () => cache,
      keys: async () => ['mathquiz-old', 'mathquiz-' + CURRENT_VERSION, 'other-app-cache'],
      delete: async (name) => { deleted.push(name); return true; }
    },
    fetch: async (request, init) => {
      events.push('fetch-start');
      if (options.networkDown) throw new TypeError('Failed to fetch');
      events.push('fetch-done');
      const response = { ok: options.status ? options.status < 400 : true, status: options.status || 200, tag: 'network', clone() { return { tag: 'clone' }; } };
      return response;
    },
    Request: class { constructor(url, init) { this.url = url; this.init = init; } },
    URL, AbortController,
    setTimeout: (fn, ms) => { events.push('timer-set'); return setTimeout(fn, ms); },
    clearTimeout: (id) => { events.push('timer-cleared'); clearTimeout(id); }
  };
  vm.runInNewContext(code, sandbox);
  return { handlers, events, stored, cache, deleted };
}

function fetchEvent(overrides = {}) {
  return { request: { method: 'GET', url: ORIGIN + '/style.css', mode: 'no-cors', ...overrides }, respondWith(p) { this.promise = p; } };
}

(async () => {
  // --- the cache write is awaited before the response is returned
  let sw = load();
  let event = fetchEvent();
  sw.handlers.fetch(event);
  const response = await event.promise;
  ok(response.tag === 'network', 'the network response is returned');
  ok(sw.events.includes('put-done'), 'the cache write has finished by the time the response is returned');
  ok(sw.events.indexOf('put-done') > sw.events.indexOf('put-start') && sw.events.indexOf('fetch-done') < sw.events.indexOf('put-start'), 'order: fetch → cache write → response');
  ok(sw.stored.size === 1, 'the fresh copy is in the cache');
  ok(sw.events.indexOf('timer-cleared') < sw.events.indexOf('put-start'), 'the network timeout is cleared before the body is cached (it cannot abort the cache write)');

  // --- a failing cache write must not break the page
  sw = load({ putFails: true });
  event = fetchEvent();
  sw.handlers.fetch(event);
  const stillOk = await event.promise.catch(() => null);
  ok(stillOk && stillOk.tag === 'network' && sw.events.includes('put-failed'), 'if the cache write fails (quota), the network response is still returned');

  // --- errors from the server are returned and not cached
  sw = load({ status: 404 });
  event = fetchEvent();
  sw.handlers.fetch(event);
  const notFound = await event.promise;
  ok(notFound.status === 404 && sw.stored.size === 0 && !sw.events.includes('put-start'), 'a 404 is returned as is and not cached');

  // --- offline fallback
  sw = load();
  sw.stored.set(ORIGIN + '/style.css', { tag: 'cached-style' });
  sw.stored.set(ORIGIN + '/index.html', { tag: 'cached-index' });
  const off = load({ networkDown: true });
  off.stored.set(ORIGIN + '/style.css', { tag: 'cached-style' });
  off.stored.set(ORIGIN + '/index.html', { tag: 'cached-index' });
  event = fetchEvent();
  off.handlers.fetch(event);
  ok((await event.promise).tag === 'cached-style', 'offline: a cached file is served');
  event = fetchEvent({ url: ORIGIN + '/', mode: 'navigate' });
  off.handlers.fetch(event);
  ok((await event.promise).tag === 'cached-index', 'offline: a page navigation falls back to index.html');
  event = fetchEvent({ url: ORIGIN + '/missing.js' });
  off.handlers.fetch(event);
  ok(await event.promise.then(() => false, () => true), 'offline: an uncached non-page file fails normally');

  // --- not intercepted
  sw = load();
  event = fetchEvent({ method: 'POST' });
  sw.handlers.fetch(event);
  ok(!event.promise, 'non-GET requests are not intercepted');
  event = fetchEvent({ url: 'https://other.example/lib.js' });
  sw.handlers.fetch(event);
  ok(!event.promise, 'cross-origin requests are not intercepted');

  // --- install / activate
  sw = load();
  let waited;
  sw.handlers.install({ waitUntil(p) { waited = p; } });
  await waited;
  ok(sw.events.some(e => /^addAll:\d+$/.test(e)) && sw.events.includes('skipWaiting'), 'install precaches the file list and activates immediately');
  sw.handlers.activate({ waitUntil(p) { waited = p; } });
  await waited;
  ok(sw.deleted.join() === 'mathquiz-old', 'activate deletes only old mathquiz-* caches (keeps the current one): ' + sw.deleted.join());
  ok(!sw.deleted.includes('other-app-cache') && sw.events.includes('claim'), 'other caches are left alone and clients are claimed');

  console.log(failures ? `\n${failures} FAILED` : '\nAll service worker checks passed');
  process.exit(failures ? 1 : 0);
})();
