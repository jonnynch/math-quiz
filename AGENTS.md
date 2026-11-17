# Math Quiz Battle — AI coding guide

## Project

Touch-friendly maths quiz for ages 2–6 and Grades 1–6, played Solo or 1 vs 1 on one shared screen. Static HTML/CSS/vanilla JavaScript; Cloudflare Workers serves the app. Questions, profiles and settings live in the browser. Users often hold phones sideways; do not assume an iPad.

## Navigation

| Path | Responsibility |
|---|---|
| `public/index.html` | Markup and script loading order |
| `public/questions.js` | DOM-free question generators and topic rules |
| `public/store.js` | DOM-free profiles, settings, storage and rewards |
| `public/game.js` | Game flow, answers, timers and results |
| `public/parent.js`, `report.js` | Parent gate, progress report and CSV export |
| `public/audio.js`, `menus.js` | Read-aloud, sounds, settings and profiles UI |
| `public/playzone.js`, `public/pz-*.js` | Playzone shell and separate mini-games |
| `public/style.css` | All layout, palettes and text scaling |
| `public/sw.js`, `pwa.js`, `manifest.webmanifest` | Offline and install support |
| `tests/` | Node/browser checks; see `docs/TESTING.md` |
| `docs/` | Curriculum, architecture, UI, testing and owner decisions |

## Critical rules

- Answers are smallest to largest, with the correct position randomized. Keep the answer-position-first distractor helpers.
- Answers stay one per row. Handle answer `pointerdown` for simultaneous players; only honour `click` when `event.detail === 0` (keyboard).
- Solo wrong answers allow retries. In 1 vs 1 a wrong answer locks that player out; if both are wrong, reveal the correct answer, award no points and continue.
- Keep the Age 6 object stage at 10 fixed slots (2×5); empty slots stay invisible, added objects use a different type, and subtraction removes the last objects.
- Phone landscape must show the question and all answers without scrolling in Solo and 1 vs 1. Preserve the landscape layout and text-size behavior.
- Age 2–6 and Grades 1–3 have no decimal questions. Grade 4 onwards may use decimals according to the curriculum; shared generator support does not justify adding them earlier.
- Preserve the Grade 4+ same-last-digit distractor, clear non-colour correctness cues, and score fairness (streaks/stars/stickers do not affect score).
- Keep age topics unavailable; topics are Grade 1–6 only. Follow the curriculum in `docs/QUESTIONS.md`.
- User text must use `textContent`. Keep storage access try/catch-safe and surface failed saves.
- Preserve storage key `mathQuizBattle.v1`, the `schema` field, migrations, and importable backup shape (`app`, `schema`, `profiles`).
- When public files change, update `FILES` and bump `VERSION` in `public/sw.js`. Keep network-first/no-cache behavior.
- Do not deploy, merge, or change production configuration unless explicitly instructed. Production uses Cloudflare Workers; GitHub Actions deploy integration and preview deployments are documented project setup.
- Keep `questions.js` and `store.js` DOM-free. No framework, build step, external runtime libraries or CDNs.

## AI implementation efficiency

- Do not explore the entire repository for a localised change.
- Read only relevant documentation and source files; identify affected generators, shared helpers and tests before editing.
- Do not rewrite working code or refactor unrelated modules. Reuse existing helpers; do not duplicate functionality.
- Modify only necessary files. Expand investigation when shared behavior or dependencies require it.
- Do not repeat requirements already documented here.
- Return a concise summary and Git diff only.

## Testing

- Run only relevant targeted checks: curriculum `npm run test:curriculum`; illustrations `npm run test:illustration`; question generation `npm run test:questions`; UI/layout relevant existing checks.
- Never run `npm test`, `npm run test`, or an alternative that triggers the full suite locally. Full verification is reserved for GitHub Actions.
- Inspect/update relevant tests when needed; do not weaken assertions to accommodate incorrect behavior. See `docs/TESTING.md` for scripts and coverage.
- Run locally with `cd public && python3 -m http.server 8080`.

## Detailed references

- `docs/QUESTIONS.md` — topics, curriculum, generators and answer ordering.
- `docs/ARCHITECTURE.md` — modules, state, storage and data flow.
- `docs/UI-AND-LAYOUT.md` — UI and landscape layout constraints.
- `docs/TESTING.md` — targeted commands, coverage and manual checks.
- `docs/REQUIREMENTS.md` — owner decisions and remaining ideas.
- `CLAUDE.md` — short Claude Code entry point; follow this file for shared rules.
