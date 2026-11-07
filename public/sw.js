// Service worker: lets the game open and play offline once it has been loaded over https:// (or localhost).
// Strategy: network first, so updates always arrive as soon as the device is online, with the cached
// copy as the offline fallback. Requests always revalidate with the server (cache: 'no-cache'), so
// the browser's ordinary HTTP cache can never serve an outdated script.
'use strict';

// Bump VERSION whenever the FILES list below changes (new, renamed or removed files).
// Edited files do not need a bump: they are refreshed in the cache every time they are fetched.
const VERSION = '2026-11-07.1';
const CACHE = `mathquiz-${VERSION}`;
const FILES = [
  './', 'index.html', 'style.css', 'questions.js', 'store.js', 'menus.js', 'game.js', 'pwa.js',
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const fresh = await fetch(request, { cache: 'no-cache', signal: controller.signal });
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true })
      || (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
