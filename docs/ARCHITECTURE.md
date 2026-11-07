# Architecture

## Overview
Static single-page app. No framework, no build. Four scripts share three globals:

```
questions.js  -> window.MQQuestions   (pure generators; also module.exports for Node tests)
store.js      -> window.MQStore       (localStorage; also module.exports)
menus.js      -> window.MQMenus       (Settings/Profiles windows + profile <select>s)
game.js       -> uses all three; owns game state, rounds, rewards, results
```
Load order in `index.html` matters: questions → store → menus → game. `game.js` runs last, fills the level selects, calls `MQMenus.init()` and sets `MQMenus.onProfileChosen`.

## Screens (all in `index.html`)
- `#setupPanel` – mode (Solo / 1 vs 1), game length (Endless / Timed + duration), per player: profile, level, topic (topic row hidden for age levels).
- `#gamePanel` – `#scoreboard`, round banner (round number, `#countdown`, Stop), `#questionBoards`, `#roundFeedback`.
- `#resultPanel` – final cards, Play Again / Change Settings.
- `#settingsModal`, `#profilesModal` – overlay windows (`.modal-backdrop > .modal`).
- `#confettiLayer` – fixed, `pointer-events: none` overlay for confetti.
- `body.playing` is set during a game (hides the title bar/Profiles button; used by the landscape layout).

## Game state (`state` in `game.js`)
`mode` ('solo'|'versus'), `players[]`, `questionSets` (cache keyed `"<level>|<topic>"`), `round`, `active`, `locked` (a round has been decided; taps ignored), `advanceTimer` (pause before next round), `roundStart`, `length` ('endless'|'timed'), `durationSeconds`, `startedAt`, `deadline`, `clockTimer`.

Player object (`createPlayer`): `id` (1|2), `name` (profile avatar + name, or "Player n"), `profile` (reference into the store, or null), `difficulty`, `topic`, `setKey`, `questions` (shuffled copy of the bank), `currentQuestion`, `score`, `lockedOut`, `answeredThisRound`, `streak`, `bestStreak`, `stickers` (won this game), `stats {taps, correctTaps, timedQuestions, totalSeconds}`, `color` ('blue'|'orange').

## Round lifecycle
1. `startGame()` loads/builds the 500-question bank per `(level, topic)` (`loadQuestionSet`), creates players, shows the game panel, starts the countdown if timed, calls `showNextRound()`.
2. `showNextRound()` increments the round, resets `locked`/`lockedOut`, takes `nextQuestionFor(player)` for each player and renders one board each via `createQuestionBoard()`.
3. A tap fires `pointerdown` → `handleAnswer(playerId, index, button)`:
   - always counts stats (`taps`, `correctTaps`, response time of the first tap on that question);
   - **wrong** → button disabled, `streak = 0`. Solo: player may retry. 1 vs 1: player is locked out (`lockedOut`, board dimmed, badge). If everyone is locked out: `locked = true`, correct answers revealed (`.reveal`), result animation shown, next round after 1800 ms (2400 ms if an object stage is involved);
   - **correct** → `locked = true`, `score++`, streak/sticker/confetti logic, buttons disabled, `showResult()` animates object stages, next round after 850 ms (1700 ms when the question has a `stage`).
4. `endGame(timedOut)` (Stop button, or the countdown reaching 0): records profile results, builds result cards (stars, stats, stickers), confetti if anyone scored.

Timers: `advanceTimer` is cleared by `clearTimers()`; the countdown interval (`clockTimer`) is separate and **must not** be cleared by `showNextRound()`.

## Board DOM (one per player)
```
article.question-board.{blue|orange}[.solo][.toddler]
  div.board-body
    div.board-info
      div.question-topline  (.player-label, .difficulty-label, [.lock-badge])
      [div.object-stage]        age 5/6: 10 .slot spans
      [svg.figure]              clock / polygon
      h3.question-text
      [div.counting-visual]     age 2–4 objects (rows of 5)
    div.answer-grid > button.answer-button ×N
```
`.board-body` and `.board-info` are `display: contents` normally (no effect) and become a two-column grid in the phone-landscape layout. `.toddler` means "simple" questions (large centred number buttons, no letter prefix).

## Rewards (in `game.js`)
- Streak = consecutive correct questions; wrong tap resets it; in 1 vs 1 a round won by the other player also resets it. Milestones at 3, 5, 10, then every 5 → `awardSticker()` + `launchConfetti()`.
- `awardSticker` prefers stickers not owned (profile stickers + this game's); saves to the profile immediately.
- `starsFor()` – 3 stars ≥ 90% correct taps, 2 ≥ 70%, else 1; 0 if nothing correct.
- Confetti is skipped under `prefers-reduced-motion`.

## Profiles & storage (`store.js`)
One JSON object under `localStorage['mathQuizBattle.v1']`:
```json
{
  "settings": { "palette": "standard|cb", "text": "normal|large|xlarge" },
  "profiles": [{
    "id": "p…", "name": "≤14 chars", "avatar": "🦊", "created": 0,
    "stickers": ["🦄"],
    "totals": { "games": 0, "correct": 0, "taps": 0, "correctTaps": 0, "bestStreak": 0 },
    "bests": { "grade3|fractions|60": 14 },
    "history": [{ "t": 0, "level": "grade3", "topic": "fractions", "mode": "solo|versus",
                  "seconds": 60, "score": 10, "taps": 14, "correctTaps": 10, "avgTime": 3.1, "streak": 4 }],
    "lastSetup": { "difficulty": "grade3", "topic": "fractions" }
  }]
}
```
Limits: 8 profiles, 30 history entries, names unique (case-insensitive). Loading runs everything through `clean()` (validates and trims). `bests` keys are `level|topic|seconds` and only timed games set them. Games with zero taps are not recorded. Guests are never saved. Two players cannot pick the same profile (options disabled in the other select; `startGame` also guards).

## Menus (`menus.js`)
- Settings: `.seg-button[data-setting][data-value]` → `MQStore.setSetting` → `html[data-palette]`, `html[data-text]`.
- Profiles window: list, expandable details (sticker book, best timed scores, last 5 games), two-step delete ("Tap again to delete"), add form with avatar picker. Rebuilds with `textContent` only.
- Escape or a backdrop tap closes a window; `body.modal-open` stops background scrolling.
