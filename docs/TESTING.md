# Testing

No framework. Plain Node scripts in `tests/`. Install once: `npm install` (only the tests need packages: `jsdom`, `puppeteer-core`, `@sparticuz/chromium`).

| Command | Speed | What it proves |
|---|---|---|
| `npm run test:questions` | seconds | Generates ~165,000 questions (every Grade 1–6 level × topic) and **recomputes each answer from the question text**. Checks: valid `correct` index, no duplicate/empty answers, numeric answers strictly ascending and non-negative, fractions/clock sorted by value and in simplest form, topic ranges, allowed operators per topic, Grade 4+ same-last-digit rule, clock labels match the drawn time, polygon sides match, money/change arithmetic. Prints the correct-answer position distribution (should be ~even; fixed `< = >` topics are naturally lopsided). |
| `npm run test:flow` | ~20 s | In jsdom, drives the real UI: topics shown only for grades (and per-grade lists), Settings applied/saved, profile add/duplicate/XSS-safe names, scoreboard names, streak badge at 2, sticker + confetti at 3, wrong answer resets streak, profile totals/history/last setup saved, stars, "choosing a profile restores its level/topic", duplicate profile prevention, timed game ends and records a personal best, delete needs two taps, guest games don't touch saved profiles. Expect `51 PASS` and no `FAIL`. |
| `npm run test:layout` | ~1–3 min | In headless Chromium: (a) `layout-game.check.js` – game screen across phone landscape sizes × text sizes (normal/large/xlarge) × Solo/1 vs 1 × endless/timed × 15 level/topic configs, with long profile names, a streak badge and a long feedback message injected as a stress test; (b) `layout-screens.check.js` – setup, both windows, game and result screens on landscape/portrait phones, tablet and desktop, checking no horizontal overflow, windows inside the viewport, score numbers inside their cards. |

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
