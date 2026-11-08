// Service worker: lets the game open and play offline once it has been loaded over https:// (or localhost).
// Strategy: network first, so updates always arrive as soon as the device is online, with the cached
// copy as the offline fallback. Requests always revalidate with the server (cache: 'no-cache'), so
// the browser's ordinary HTTP cache can never serve an outdated script.
'use strict';

// Bump VERSION whenever the FILES list below changes (new, renamed or removed files).
// Edited files do not need a bump: they are refreshed in the cache every time they are fetched.
const VERSION = '2026-11-08.1';
const CACHE = `mathquiz-${VERSION}`;
const FILES = [
  './', 'index.html', 'style.css', 'questions.js', 'trophies.js', 'store.js', 'menus.js', 'game.js', 'pwa.js',
  'manifest.webmanifest', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mathquiz-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The timeout only covers waiting for the server to start answering. It is cleared as soon as the
// response headers arrive, so it can never cut off the body while it is being cached.
async function fetchFresh(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { cache: 'no-cache', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  let response;
  try {
    response = await fetchFresh(request);
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true })
      || (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (cached) return cached;
    throw error;
  }
  if (response.ok) {
    // Finish writing the cache before returning the response, so the browser cannot stop the worker
    // half-way through. A failed write (e.g. storage full) must never break the page itself.
    try {
      await cache.put(request, response.clone());
    } catch (error) { /* serve the network response anyway */ }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
