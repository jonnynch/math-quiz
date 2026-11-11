# Testing

No framework. Plain Node scripts in `tests/`. Install once: `npm install` (only the tests need packages: `jsdom`, `puppeteer-core`, `@sparticuz/chromium`).

| Command | Speed | What it proves |
|---|---|---|
| `npm run test:parent` | instant | Unit checks of `parent.js` with a fake clock and storage: short quadratic/probability questions recomputed from their text, typed answer only (no options), wrong/right answers, new question per attempt, 3 failures → 30 s cooldown (also after refresh and after lock/reopen), success resets the counter, unlock never stored. |
| `npm run test:report` | instant | `report.js` and its window: parent gate (locked, wrong answer, no parent module), statistics recomputed by hand, per-profile separation, empty / summary-only / damaged history, CSV escaping and round trip through an independent parser, filename, schema 1 and `played` backup compatibility, and the UI in jsdom (opens locked, profile switch, CSV download, re-lock on close). |
| `npm run test:trophies` | instant | Unit checks of `trophies.js` (targets table, 3 trophies per level, thresholds, streak reset, no duplicates, validation) and of trophy progress through `store.js` (per-profile separation, persistence, backup export/import, schema 1 data). |
| `npm run test:store` | instant | Unit checks of `store.js` (no browser): saving/reloading, data without a schema number, failed-save reporting, backup round trip, rejection of bad/newer/oversized/foreign files, sanitising of hostile data, merge rules (same id, duplicate names, 8-profile limit), replace + Undo. |
| `npm run test:sw` | instant | Unit checks of `public/sw.js` with mocks (no browser): the cache write finishes before the response is returned, the network timeout is cleared before caching, a failing cache write still returns the network response, 404s are not cached, offline fallbacks (file, page navigation, uncached file), only same-origin GETs are intercepted, install precaches and activate removes only old `mathquiz-*` caches. |
| `npm run test:pwa` | ~15 s | Static: every file in `sw.js` exists, every `<script>` is precached, manifest fields, icon files match declared sizes. Browser (real Chromium against a temporary local server on `localhost`): the service worker installs and precaches everything, a changed page is picked up despite `Cache-Control: max-age=3600`, the "new version" notice appears after a worker update and the old cache is deleted, and **with the server stopped the game still loads and can be played**. |
| `npm run test:questions` | seconds | Generates ~165,000 questions (every Grade 1–6 level × topic) and **recomputes each answer from the question text**. Checks: valid `correct` index, no duplicate/empty answers, numeric answers strictly ascending and non-negative, fractions/clock sorted by value and in simplest form, topic ranges, allowed operators per topic, Grade 4+ same-last-digit rule, clock labels match the drawn time, polygon sides match, money/change arithmetic. Prints the correct-answer position distribution (should be ~even; fixed `< = >` topics are naturally lopsided). |
| `npm run test:norepeat` | instant | Unit checks of the no-repeat rules in `questions.js`: question identity (`questionKey`), de-duplicated bank (`buildQuestionBank`), deck dealing (`createQuestionDeck`): no repeats until the pool is used up, reshuffle afterwards without stopping, fresh deck per game/player, small pools (no infinite loop), speed. |
| `npm run test:audio` | ~5 s | jsdom with fake `speechSynthesis`/`AudioContext`: symbols spoken as words, both settings off by default, Listen button/replay, speech cancelled on answer/next question/Stop/Change Settings/page hide, no speech API → control disabled and game unaffected, sounds only when the setting is on and never throw when audio is blocked, settings survive reload and old backups/saves still load. |
| `npm run test:flow` | ~20 s | In jsdom, drives the real UI: topics shown only for grades (and per-grade lists), Settings applied/saved, profile add/duplicate/XSS-safe names, scoreboard names, streak badge at 2, sticker + confetti at 3, wrong answer resets streak, profile totals/history/last setup saved, stars, "choosing a profile restores its level/topic", duplicate profile prevention, timed game ends and records a personal best, delete needs two taps, guest games don't touch saved profiles. Also covers the backup UI (copy text, check/preview, merge, undo, replace needs two taps). Expect only `PASS` lines. Also covers the Screen-time Bank parent lock (hidden redeem/settings, wrong answer, unlock, re-lock on reopen, cooldown) and the reset-settings save failure. |
| `npm run test:layout` | ~1–3 min | In headless Chromium: (a) `layout-game.check.js` – game screen across phone landscape sizes × text sizes (normal/large/xlarge) × Solo/1 vs 1 × endless/timed × 15 level/topic configs, with long profile names, a streak badge and a long feedback message injected as a stress test; (b) `layout-screens.check.js` – setup, both windows, game and result screens on landscape/portrait phones, tablet and desktop, checking no horizontal overflow, windows inside the viewport, score numbers inside their cards. |

### Exit codes
Every check script exits non-zero when anything fails, so `npm test` (and CI) goes red. The only tolerated result is the **known limit** below, which `layout-game.check.js` counts separately ("accepted known limit") and does not fail on.

### Continuous integration
`.github/workflows/ci.yml` runs on every push and pull request: checkout → Node 22 → `npm ci` (exact versions from `package-lock.json`) → `npm test`. It uses the Chromium bundled with `@sparticuz/chromium`, needs no secrets, and takes about 3–4 minutes. If `package.json` changes, run `npm install` and commit the updated `package-lock.json`, otherwise `npm ci` fails. Node must be 22.22 or newer (jsdom and puppeteer-core requirement).

### Layout check options
- `VP=667x300,844x390` limit viewports. `TEXTS=normal,large,xlarge`. `REPS=1` fewer repetitions (questions are random). `SHOW=5` print example failures.
- Browser: Linux x64 uses the bundled `@sparticuz/chromium`. Elsewhere set `CHROME_PATH=/path/to/chrome`.
- `layout-screens.check.js` saves screenshots into a temp folder and prints its path – open a few; numbers alone miss visual problems.

### What "pass" means for layout
Every gameplay check must show the board, question, objects/figure, each answer, feedback, Stop button, countdown and score cards fully inside the viewport with **no document scroll**, no horizontal overflow, no text overflowing its button, and nothing spilling out of its board.
Current status: **Normal and Large text: 0 problems in every tested size (568×280 up to 932×360).** Extra large: passes from 667×300 up except it is capped on short screens; at the smallest tested size (568×280) a few 1 vs 1 cases with long fraction questions need a small scroll (nothing is clipped). That is accepted. Do not make it worse.

### Viewports used (CSS px)
Landscape phones 568×280, 667×300, 740×320, 800×300, 844×340, 844×390, 932×360 (heights include browser toolbars); portrait 390×844 and 360×640; tablet 768×1024; desktop 1280×800.

## Writing new checks
- Derive the expected answer independently from the question text (as `questions.check.js` does).
- Age 2–3 to Grade 1 question types are checked by `tests/questions-early.check.js` (`npm run test:early`).
- For UI flow tests, dispatch `pointerdown` on `.answer-button` (that is the real input path).
- Layout stress ideas already used: 14-character profile names, 15-streak badge, long feedback text, Extra large text, colour-blind palette.

## Manual checklist on a real device (tests cannot cover these)
1. Rotate between portrait and landscape mid-game.
2. Two people tap different answers almost simultaneously in 1 vs 1 (both taps must register; first correct wins).
3. Solo: wrong then correct works; 1 vs 1: a wrong answer locks only that player; both wrong → reveal then next question.
4. Age 5 and Age 6: objects appear/disappear and the answers do not move.
5. Timed game ends exactly at zero with the summary; Endless keeps going until Stop.
6. Profiles persist after reloading the page; stickers collect; delete works.
7. Colour-blind palette and Extra large text look right; ✓/✗ marks are visible.
8. Safari iOS and Chrome Android toolbars showing/hiding do not hide answers in landscape.
