
# Math Quiz Battle — guide for AI coding assistants

Read this first. Deeper detail is in `docs/` (see the index at the bottom).

## What this is

A touch-friendly maths quiz for one shared touch screen (tablet, phone or touch laptop), played **Solo** or **1 vs 1** (each player has their own answer area on the same screen). It is a **static site**: plain HTML/CSS/vanilla JavaScript, no framework, no build step, no backend. Cloudflare Workers serves the static application. Everything (questions, profiles, settings) lives in the browser.

Audience: young children (ages 2–6 activities) up to Grade 6. The owner runs it on a home network and uses phones/tablets, often **held sideways**. Do not assume an iPad.

## Deployment

- Production is deployed on Cloudflare Workers.
- GitHub is integrated with Cloudflare for deployments.
- Feature branches and pull requests should use Cloudflare preview deployments for testing.
- Merging an approved pull request into the production branch triggers the production deployment.
- GitHub Actions handles CI verification.
- AI agents must not deploy to production, merge pull requests, or change production configuration unless explicitly instructed.
- Do not change Cloudflare configuration, deployment settings, or production environment variables as part of unrelated feature work.
- Do not assume the application is deployed through Nginx or Docker.

## File map

| Path | Role |
|---|---|
| `public/index.html` | All markup: setup screen, game screen, result screen, Settings and Profiles windows. Scripts load in order: `questions.js`, `trophies.js`, `parent.js`, `report.js`, `store.js`, `audio.js`, `menus.js`, `playzone.js`, `bank-adjust.js`, `pz-designer.js`, `pz-reaction.js`, `pz-balloon.js`, `game.js`, `pwa.js`. |
| `public/questions.js` | **Pure logic, no DOM.** Level/topic definitions and every question generator. `window.MQQuestions` (also `module.exports` for Node tests). |
| `public/trophies.js` | **Pure logic, no DOM.** Trophy targets (`TARGETS`, the one place to tune them) and the rules that record progress. `window.MQTrophies`. Trophies never change scores, stars, streaks or stickers. |
| `public/parent.js` | **Pure logic, no DOM.** Parent verification for the Screen-time Bank: one short random quadratic or probability question (typed answer, fractions/decimals accepted), 3 tries then 30 s cooldown, in-memory unlock. `window.MQParent`. A child-resistant barrier, not security. |
| `public/report.js` | **Pure logic, no DOM.** Parent progress report and CSV export for one saved profile, calculated from `profile.totals` / `profile.history`. Refuses to run unless `MQParent.isUnlocked()`. `window.MQReport`. |
| `public/store.js` | **No DOM.** Profiles + settings in `localStorage` (key `mathQuizBattle.v1`). `window.MQStore`. |
| `public/audio.js` | Optional read-aloud (`speechSynthesis`) and correct/wrong sound effects (Web Audio tones, no audio files). Both are saved settings (`readAloud`, `sound`), **off by default**. Every call is try/catch-safe; speech is cancelled on a new question, Stop Game, Change Settings and page hide. `window.MQAudio`. |
| `public/menus.js` | Settings window, Profiles window, the "Who is playing?" selects. `window.MQMenus`. |
| `public/playzone.js`, `public/pz-*.js` | **Playzone** mini-games (Pizza & Cake Designer, Reaction Battle, Balloon Pop) unlocked with Screen-time minutes. `playzone.js` is the shell (menu, cost screen, redemption, stage, `MQPlayzone.register`); each game is one self-contained `pz-*.js`. See `docs/ARCHITECTURE.md` (Playzone). `window.MQPlayzone`. |
| `public/game.js` | Game flow: setup, rounds, answers, timers, rewards, results, SVG figures. Wires everything together. |
| `public/pwa.js`, `public/sw.js`, `public/manifest.webmanifest`, `public/icons/`, `public/favicon.svg` | Installable/offline support: service worker registration, "new version" notice, Install section in Settings. See `docs/ARCHITECTURE.md` (Offline and install). |
| `public/style.css` | All styling: design tokens, palettes, text scale, components, and the phone-landscape layout. |
| `tests/` | Node checks (see `docs/TESTING.md`). These files are not part of the served application. |
| `docs/` | Architecture, question rules, UI/layout rules, testing, owner requirements. |

## Levels and topics

Levels: `toddler` (Age 2–3), `age4`, `age5`, `age6`, `grade1`…`grade6`. **Topics exist only for Grade 1–6**; the age levels have no topic selector. Age 5 is ONE pool of ten internal topics whose difficulty rises through `tier` (no stages or sub-levels). Full matrix: `docs/QUESTIONS.md`.

## Rules that must not be broken

These came directly from the owner (details and reasons in `docs/REQUIREMENTS.md`).

1. **Answers are listed smallest → largest** (numbers numerically; fractions and clock times by value). Fixed-order text choices (`< = >`) are the only exception.
2. **The correct answer's position must stay random.** Sorting alone makes it land in the middle. Pick the position first, then choose wrong answers to fit (`pickWrongAnswers` / `pickWithMistake`). Never reintroduce a "wrong answers symmetric around the right one" pattern.
3. **One answer per row** (single column, labelled A, B, C… except large "simple" boards for the youngest). Never go back to tiles.
4. **Grade 4+ arithmetic**: at least one wrong option has the same last digit as the correct one.
5. **Solo**: a wrong answer is disabled and the player may keep trying. **1 vs 1**: a wrong answer locks that player out of the question; if both are wrong nobody scores, the correct answers are revealed, then the next question.
6. **Answer input uses `pointerdown`** (so two fingers at nearly the same time both register). `click` is only honoured when `event.detail === 0` (keyboard). Do not switch to plain `click`.
7. **Age 6 object stage keeps a fixed height**: always 10 slots (2 rows of 5); empty slots are invisible (outlines would reveal the answer). Added objects must be a *different* type from the original; subtraction removes the last objects.
8. **Phones held sideways**: the question and every answer must be visible without scrolling in Solo and 1 vs 1 (layout in the `max-height: 520px` landscape block of `style.css`).
9. **Colour is never the only cue**: right/wrong also use ✓/✗; the colour-blind palette and text-size setting must keep working.
10. **Streaks, stars and stickers never change the score** (keeps 1 vs 1 fair).
11. No Adult level, no decimals. No iPad-specific wording in the UI.
12. Anything user-typed (profile names) is rendered with `textContent`, never `innerHTML`.
13. `localStorage` access is always wrapped in try/catch; the game must work when storage is unavailable, and save failures must be shown to the user (`saved: false`).
14. **Saved data stays upgradable**: keep the key `mathQuizBattle.v1`, keep the `schema` field, add a `migrate()` step instead of discarding old profiles. The backup file format (`app`, `schema`, `profiles`) must stay importable.
15. **Offline cache list**: when a file is added, renamed or removed in `public/`, update `FILES` in `public/sw.js` **and bump `VERSION`** (otherwise the offline copy can miss the file). `npm run test:pwa` checks every script is listed. The service worker is network-first with `cache: 'no-cache'`; do not change it to cache-first (users would get stale code).
16. **Screen-time bank (Grade 1–6 only)**: age levels and guests never earn. Only a player's *first* answer to a question is reported (`Store.rewardAnswer` from the first-tap block in `handleAnswer`); retries never count. Rewards are paid per batch (`Store.settleRewards`), grades are never mixed in a batch, and all reward numbers live in `REWARD_DEFAULTS` in `store.js`. Rewards never change score, stars, streaks or stickers. Parent-only actions (`setRewardConfig`, `resetRewardConfig`, `redeem`, backup `applyBackup` and Undo `restoreBackup`) refuse to run unless `MQParent.isUnlocked()`; the check lives in `store.js`, not only in the UI. See `docs/ARCHITECTURE.md`.
17. **Playzone** is charged by ACTUAL usage, never an advertised cost: a session starts with `Store.startPlay` (only while the balance is above 0), the played time is counted by monotonic heartbeats (`tickPlay`), and `Store.endPlay` charges `Math.ceil(seconds / 60)` whole minutes (at least 1) exactly once. Sessions are stored on `profile.playzone.session`, a session left by a refresh/crash is ended on the next launch (`reconcilePlay`), and the balance may go negative (a negative or zero balance only blocks starting a NEW game; a running one always finishes). Children never see a parent question in Playzone; it can never add minutes or change the maths reward rules. `Store.redeem`, backup import and reward settings stay parent-only. Manual +/− adjustment (may go negative) lives on the Screen-time page, needs the separate hard quadratic question (`MQParent.hard`, `Store.adjustBalance`, `bank-adjust.js`), and Playzone has no parent controls. Personal bests live on the profile (`profile.playzone`, `Store.recordPlayzone`) and are also listed in Profile Details. New games register with `MQPlayzone.register({ id, title, icon, desc, players, mount })`, live in their own `pz-*.js`, use `ctx.begin()` / `ctx.end()` for their session, and must clean up their timers in `destroy()`. Balloon Pop levels are endless and follow pops only (combo bonuses change the score, never the level); its trophies live in `profile.trophies.balloon` (`trophies.js`).

## Common tasks

- **Add or change a question type** → `docs/QUESTIONS.md` ("Adding a topic"). Run `npm run test:questions`.
- **Change layout/CSS** → `docs/UI-AND-LAYOUT.md`. Run `npm run test:layout` (needs a browser; see `docs/TESTING.md`).
- **Change game flow, rewards or profiles** → `docs/ARCHITECTURE.md`. Run `npm run test:flow`.
- **CI**: `.github/workflows/ci.yml` runs `npm ci && npm test` on every push and pull request. Full test execution is reserved for GitHub Actions; AI agents must not run it locally.
- **Run the game locally without Docker**: `cd public && python3 -m http.server 8080`, then open `http://localhost:8080`.

## Conventions

- Vanilla ES2020, one IIFE per file, `'use strict'`, no bundler, no external libraries or CDNs (the game must work offline).
- `questions.js` and `store.js` must stay DOM-free so Node can test them.
- Small, named functions; comments explain *why* (especially around the answer-position logic and the landscape layout).
- Keep UI text short and child-friendly. Use rem/clamp/vh for sizes so the text-size setting works.
- After editing, inspect relevant tests and update them when necessary. AI agents may run relevant targeted checks only; never run the full test suite locally. GitHub Actions performs full verification.

## Full Test Suite Restrictions

- AI coding agents must NEVER execute `npm test` or `npm run test`.
- Do not execute any alternative command that triggers the complete test suite.
- Full test execution is reserved for GitHub Actions CI.
- Targeted tests may be run only if they are confirmed not to trigger the full suite.
- If uncertain whether a command triggers the full suite, do not execute it.
- Do not ask an AI agent to run the full suite as part of its normal implementation workflow.
- Always report that full test execution was left to GitHub Actions.

## Docs index

- `docs/ARCHITECTURE.md` — modules, state, round lifecycle, storage schema, DOM structure.
- `docs/QUESTIONS.md` — question object format, generators, answer ordering/position algorithm, topic matrix.
- `docs/UI-AND-LAYOUT.md` — design tokens, palettes, text scale, landscape-phone layout, modals, figures.
- `docs/TESTING.md` — what each check does, how to run it, acceptable known limits, manual checklist.
- `docs/REQUIREMENTS.md` — the owner's requests in order, with the reasoning, so changes stay consistent.
