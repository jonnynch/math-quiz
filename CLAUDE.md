# Claude Code notes

@AGENTS.md

Extra tips for Claude Code in this repo:
- There is no build step. Edit files in `public/` directly and reload the browser.
- Install test dependencies once with `npm install` (only the tests use npm packages; the game has none).
- `npm run test:questions` and `npm run test:flow` are fast; run them after any change to `questions.js`, `store.js`, `menus.js` or `game.js`.
- `npm run test:layout` needs Chromium. On Linux x64 it uses the bundled `@sparticuz/chromium`; elsewhere set `CHROME_PATH` to a local Chrome/Chromium binary.
- When changing CSS, check three things at least: phone landscape (e.g. 667×300 and 844×390), phone portrait (390×844) and desktop (1280×800).
