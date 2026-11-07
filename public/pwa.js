// Installable / offline support: registers the service worker, shows "new version ready", and the
// Install section in Settings. Everything here is optional; the game works without it.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canUseWorker = window.isSecureContext && 'serviceWorker' in navigator;
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- service worker and update notice ----------
  if (canUseWorker) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            // A new version took over while an older one was open: offer a reload (never mid-game).
            if (worker.state === 'activated' && hadController) $('updateBanner').classList.remove('hidden');
          });
        });
        // Look for a new version whenever the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      }).catch(() => { /* offline support is optional */ });
    });
    $('updateReload').addEventListener('click', () => window.location.reload());
  }

  // ---------- Install section in Settings ----------
  const info = $('installInfo');
  const button = $('installButton');
  let deferredPrompt = null;

  if (standalone) {
    info.textContent = 'You are using the installed app.';
    if (isIos) {
      $('installIos').textContent = 'On iPhone/iPad the installed app keeps its own profiles, separate from Safari. Use Backup and restore in Profiles to copy them across.';
      $('installIos').classList.remove('hidden');
    }
  } else if (!canUseWorker) {
    info.textContent = 'Installing and offline play need a secure (https://) web address. This address is not secure, so the game works normally but cannot be installed.';
  } else {
    info.textContent = 'Install the game to open it from the home screen and play without an internet connection.';
    if (isIos) {
      $('installIos').textContent = 'On iPhone/iPad: tap Share, then Add to Home Screen. The installed app keeps its own profiles, separate from Safari — use Backup and restore in Profiles to copy them across.';
      $('installIos').classList.remove('hidden');
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    button.classList.remove('hidden');
  });
  button.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (error) { /* ignore */ }
    deferredPrompt = null;
    button.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    button.classList.add('hidden');
    info.textContent = 'The app was installed.';
  });
})();
