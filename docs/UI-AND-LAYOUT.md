# UI and layout

Everything is in `public/style.css` (one file). Sizes use `rem`, `clamp()` and viewport units so the text-size setting and small screens work.

## Design tokens (`:root`)
- Players: `--blue`, `--blue-light`, `--blue-line` (Player 1 / solo) and `--orange`, `--orange-light`, `--orange-line` (Player 2).
- Feedback: `--ok-bg/-line/-ink`, `--reveal-bg`, `--bad-bg/-line/-ink`, `--green`, `--red`.
- Figures: `--figure-fill`, `--figure-line` (polygon colours). Neutrals: `--navy`, `--ink`, `--muted`, `--line`.
- `--app-h`: `100vh`, upgraded to `100dvh` when supported (iOS toolbars). Use it, not raw `100vh`, for "fill the visible screen".
- `--ts`: text scale factor (1 / 1.125 / 1.28) mirroring the text-size setting; used only to size heights in the landscape layout.

Never hard-code a player/right/wrong colour in a rule; use the tokens so the palettes work.

## Settings (set on `<html>` by `menus.js`)
- `data-palette="standard|cb"`. `cb` = Okabe-Ito based: blue/orange players, blue-green (right) and vermillion (wrong). Meaning is also carried by marks: `.answer-button.correct/.reveal` get ` ✓`, `.wrong` gets ` ✗` (and strikethrough in `cb`), feedback text gets `✓ ` / `✗ ` via `::before`. Wrong = dashed border, right = solid border.
- `data-text="normal|large|xlarge"` → `html { font-size: 100% / 112.5% / 128% }` and `--ts`. On very short landscape screens the large sizes are capped (blocks at the end of the file: `max-height: 330px` and `300px`) so answers still fit.

## Breakpoints
- Default (desktop/tablet/portrait phone): boards stacked info-then-answers; two boards side by side in 1 vs 1 on wide screens; solo board centred, max 760px (`.question-boards.solo`).
- `max-width: 680px` rules: single-column stacking, tighter padding.
- **Phone landscape: `@media (orientation: landscape) and (max-height: 520px)`** – the important one, below.
- `max-height: 310px`: extra-compact overrides for very short screens.
- `max-height: 330px / 300px`: cap Large/Extra large text (see above).

## Phone-landscape layout (the "everything visible" rule)
Goal: in Solo and 1 vs 1 the question/objects and **all** answers are visible without scrolling.
- While playing (`body.playing`): title bar and footer hidden; `.app` is a flex column with `min-height: var(--app-h)`; `#gamePanel` is a grid: row 1 = scoreboard + round banner (one slim row), row 2 = boards (`minmax(0, 1fr)`), row 3 = feedback line (single line, ellipsis).
- Each board: `.board-body` becomes a 2-column grid. **Left** `.board-info` (name, objects/figure, question). **Right** `.answer-grid`, a grid with `grid-auto-rows: minmax(calc(32px * var(--ts)), 1fr)` so answers share whatever height is left. If content truly cannot fit (tiny screen + biggest text) the page scrolls instead of clipping.
- Object stage / counting visuals / figures are sized from viewport units (`vw`, `vh`, `--app-h`) with separate sizes for solo and `.versus` (narrower column).
- Score card: name (ellipsis) + optional `.streak-badge` + score. `.score-name .name-text` truncates; the badge never wraps.
- Setup, result screens and the windows may scroll in landscape; only gameplay must fit.

## Object stage (age 5/6)
`.object-stage` is a grid of 5 columns × 2 fixed rows (`grid-template-rows: repeat(2, 1.35em)`) holding exactly 10 `.slot` spans, so the height never changes when objects are added/removed. Animations: `.slot.pop` (added), `.slot.leaving` (removed); reduced-motion users get near-instant transitions. Empty slots are blank on purpose.

## Figures (SVG, drawn in `game.js`)
`.figure` is a square (`aspect-ratio: 1`, `width: min(100%, 200px)`, smaller in landscape). Clock: `.clock-face/.clock-tick/.clock-number/.clock-hand.hour/.minute`. Polygon: `.poly`. Colours come from tokens.

## Windows (Settings, Profiles)
`.modal-backdrop` (fixed, flex-centred, respects safe-area insets) > `.modal` (max-height 100%, scrolls inside). The `Done` button sits in the header so it stays reachable. `body.modal-open` disables background scroll. Escape and backdrop tap close.

## Update notice
`.update-banner` sits at the top of `.app` (hidden by default and during play). Settings has an Install block (`#installInfo`, `#installIos`, `#installButton`).

## Rewards visuals
`.streak-badge`, `.star-rating`, `.best-badge`, `.earned-stickers/.sticker-row`, `.sticker-book/.sticker(.locked)`, `.confetti-layer/.confetto` (fixed overlay, `pointer-events: none`, so it never blocks a tap).

## When you change CSS
Run `npm run test:layout` (see `docs/TESTING.md`) and look at screenshots at least for: 667×300 and 844×390 landscape (Solo + 1 vs 1, a clock topic and an Age 5/6 level), 390×844 portrait, 1280×800 desktop, with Normal and Extra large text and the colour-blind palette.

## Tablets (iPad)
Gameplay on touch screens wider than 680px and taller than 520px (`pointer: coarse`, no device sniffing) uses the same side-by-side board as a phone held sideways: question + figure left, all answers right, answers at least 48px x text scale. Landscape: always. Portrait: Solo always; in 1 vs 1 the two boards stack (each side by side) from 940px tall (1010px at Extra large text), below that the boards sit next to each other with the figure above the answers. Checked by `tests/layout-tablet.check.js`.
