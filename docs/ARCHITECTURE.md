# Architecture

## Overview
Static single-page app. No framework, no build. Scripts share these globals:

```
questions.js  -> window.MQQuestions   (pure generators; also module.exports for Node tests)
trophies.js   -> window.MQTrophies    (trophy targets + progress rules; pure; also module.exports)
adaptive.js   -> window.MQAdaptive    (Smart Difficulty rules; pure; also module.exports)
parent.js     -> window.MQParent     (parent verification for the Screen-time Bank; pure; also module.exports)
report.js     -> window.MQReport     (parent progress report + CSV; pure; also module.exports)
store.js      -> window.MQStore       (localStorage; also module.exports)
audio.js      -> window.MQAudio      (read-aloud via speechSynthesis + Web Audio sound effects; both optional, off by default)
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

## Trophies (`trophies.js`, `game.js`, Achievements window in `menus.js`)
- `TARGETS` (level id → bronze/silver/gold target) is the single place to tune them; `LEVELS` follow its key order and must match `DIFFICULTIES`.
- Progress lives in `profile.trophies[level] = { completed, correct, streak, best, unlocked[] }` (schema 2, `cleanAll()` validates it; schema 1 data migrates to `{}`). Bronze = completed, Silver = correct, Gold = `best` run of correct first answers.
- `game.js` `settleRound()` calls `Trophies.record()` once when a round is decided (a correct answer, or everyone out). Each player who answered is credited with one completed question, correct only if their FIRST tap was right (no inflation by retrying). Players who never answered are not credited. A wrong tap calls `Trophies.resetStreak()` at once. Guests never earn trophies. Trophies never touch scores, stars, streaks or stickers.
- `#achievementsModal` lists every level with its 3 trophies for the chosen profile; locked ones are silhouettes with a 🔒 label.

## Smart Difficulty (`adaptive.js`, `game.js`, `store.js`, Settings and Profiles windows)
Optional, **off by default** (`settings.smartDifficulty`, `off|on`, additive: no schema bump; missing/invalid = off). With it off nothing is read, recorded or changed.
- **Idea**: the level the player chooses is the *base*. With it on, questions come from the base level or one step above/below (`CONFIG.maxOffset`), within the same family (Age levels with Age levels, Grades with Grades) and only at levels that offer the chosen topic (e.g. Times tables: Grade 2-4, so Grade 4 never goes up and Grade 2 never goes down to Grade 1). Existing generators are unchanged.
- **Rules** (all in `CONFIG`, internal, not parent settings): the last 20 first-attempt results are kept; up at >= 10 answers and >= 90 %; down at >= 8 answers and < 60 %; one step at a time. After a change the history is cleared and a 10-question cooldown starts, so there is no flip-flopping. Speed (average first-answer time) can only hold back a move up when answers are consistently slow (> 15 s); it never causes a change on its own.
- **State**: per profile `profile.smart["<base>|<topic>"] = { offset, recent: [{c, s}], cd, u }` (max 30 setups; `cleanMap` validates it, so older profiles, damaged data and imports are safe). Guests get a fresh in-memory state each game. It travels with Export/Import/Backup like every other profile field. The manual level (select, `lastSetup`) is never overwritten.
- **Game**: `player.difficulty` stays the chosen level (trophies, rewards, history, bests, last setup); `player.level` is where questions come from. The level changes only in `nextQuestionFor`, between questions. `settleRound` feeds each player's own first answer (and time) to `Adaptive.update`, so players never affect each other and a player who did not answer is not counted. All candidate levels' question banks are built before the game starts; each level has its own deck per player. Indicator: 🎯 badge on the scoreboard and "· 🎯 Smart" in the level label.
- **UI**: Settings -> Smart Difficulty; Profiles -> Details lists each chosen setup and its current level and recent accuracy (read-only).

## Rewards (in `game.js`)
- Streak = consecutive correct questions; wrong tap resets it; in 1 vs 1 a round won by the other player also resets it. Milestones at 3, 5, 10, then every 5 → `awardSticker()` + `launchConfetti()`.
- `awardSticker` prefers stickers not owned (profile stickers + this game's); saves to the profile immediately.
- `starsFor()` – 3 stars ≥ 90% correct taps, 2 ≥ 70%, else 1; 0 if nothing correct.
- Confetti is skipped under `prefers-reduced-motion`.

## Profiles & storage (`store.js`)
One JSON object under `localStorage['mathQuizBattle.v1']` (the key name is fixed; the format version is the `schema` field inside):
```json
{
  "schema": 2,
  "settings": { "palette": "standard|cb", "text": "normal|large|xlarge", "readAloud": "off|on", "sound": "off|on" },
  "profiles": [{
    "id": "p…", "name": "≤14 chars", "avatar": "🦊", "created": 0,
    "stickers": ["🦄"],
    "trophies": { "grade3": { "completed": 40, "correct": 31, "streak": 2, "best": 9, "unlocked": ["bronze"] } },
    "totals": { "games": 0, "correct": 0, "taps": 0, "correctTaps": 0, "bestStreak": 0 },
    "bests": { "grade3|fractions|60": 14 },
    "history": [{ "t": 0, "level": "grade3", "topic": "fractions", "mode": "solo|versus",
                  "seconds": 60, "score": 10, "taps": 14, "correctTaps": 10, "avgTime": 3.1, "streak": 4, "played": 75 }],
    "lastSetup": { "difficulty": "grade3", "topic": "fractions" }
  }]
}
```
`schema` is the data-format version (`SCHEMA` in `store.js`). When the format changes: bump `SCHEMA`, add an upgrade step in `migrate()`, and keep reading older data (data with no `schema` counts as 1). Never rename the key to drop old profiles.

Limits: 8 profiles, 30 history entries, names unique (case-insensitive). Loading runs everything through `clean()` (validates and trims). `bests` keys are `level|topic|seconds` and only timed games set them. Games with zero taps are not recorded. Guests are never saved. Two players cannot pick the same profile (options disabled in the other select; `startGame` also guards).

## Progress report (`report.js`, `#reportModal` in `menus.js`)
- **📊 Progress** button → window that opens locked and asks the parent question (`renderParentChallenge`, prefix `report`). Report and CSV appear only after verification; closing the window locks again. `Report.build()` and `Report.toCsv()` also refuse (`{ denied: true }`) unless `MQParent.isUnlocked()`, so the check is not only in the UI.
- Only saved profiles are listed; guests are never stored, so they cannot appear. Nothing is sent anywhere.
- Data: headline numbers come from `profile.totals` (all games). Level, topic, per-day, trend and recent-games sections come from `profile.history` (last 30 games) and say so. "Answers" are taps (including Solo second tries); accuracy = correctTaps ÷ taps.
- **Missing vs zero**: `state` is `none` (no games: real zero), `summary` (totals but no saved game list) or `detailed`. Unknown values are `null`/blank, never 0.
- **Play time**: `history[].played` (whole seconds from game start to end, same clock as the result screen) was added later as an optional field: older games and backups simply lack it, and the report counts only games that have it. No schema bump (additive, like `rewards`); `cleanProfile` keeps it only when valid.
- **CSV** (`math-quiz-progress-<name>-<local date>.csv`, CRLF, UTF-8 with BOM added by the download): summary, by level, by topic, by day, then every saved game. Values with commas, quotes or line breaks are quoted; text starting with `= + - @` gets a leading `'` so spreadsheets cannot run it. Blank cell = not recorded.

## Backup and restore (`store.js` + `menus.js`)
Profiles cannot move between browsers, devices or web addresses by themselves (each origin has its own `localStorage`; a home-screen app on iOS has separate storage from Safari). So the Profiles window offers:
- **Export to file** (`math-quiz-profiles-<date>.json`) and **Copy backup text** (falls back to a text box when the clipboard API is unavailable, e.g. on plain `http://`).
- **Import…**: choose a file or paste text → **Check backup** (validates, changes nothing, shows a preview) → **Add to my profiles** (merge) or **Replace all profiles** (two taps).
- Backup format: `{ "app": "mathQuizBattle", "schema": 2, "exportedAt", "settings", "profiles": [...] }`. `Store.parseBackup()` rejects empty/invalid JSON, other apps' files, newer schemas and files over 1 MB; every profile goes through `cleanProfile()` (names ≤14 chars, ids reduced to `[A-Za-z0-9_-]`, stickers must be known, numbers ≥ 0).
- Merge rules: same `id` → the backup's profile replaces it; same name with a different id → renamed `Name (2)`; stops at 8 profiles and reports how many were skipped. Replace also restores settings; merge does not touch settings.
- Before any import the current data is copied to `localStorage['mathQuizBattle.backup']`; **Undo last import** restores it.
- Save failures are surfaced everywhere data is written: `addProfile`, `deleteProfile`, `setSetting`, `applyBackup` and `restoreBackup` report `saved: false` (`applyBackup` is transactional: it aborts if the Undo copy cannot be written, and if the import cannot be saved it restores the data in use and the previous Undo copy, returning `imported: false` and an `error`; `settleRewards` likewise restores the reward state and returns `settled: false, saved: false`) (and `Store.save()` returns `false`). The UI shows a warning in the Profiles window (add / delete / import), in the Settings window (`#settingsMessage`) and on the result screen. The change still applies for the current session; the warning says it will be lost when the page closes. `Store.requestPersistence()` asks the browser not to evict the data (best effort).

## Offline and install (`sw.js`, `pwa.js`, `manifest.webmanifest`)
- Works only in a secure context: `https://` (e.g. Cloudflare) or `http://localhost`. On a plain `http://192.168…` address the service worker cannot register; the game still works online and Settings says why it cannot be installed.
- `sw.js` precaches the files in `FILES` on install (cache name `mathquiz-<VERSION>`), then serves **network-first** (`fetch(request, { cache: 'no-cache' })`, 4 s timeout) and falls back to the cache offline. The fresh copy is written to the cache (`await cache.put`) **before** the response is returned, and a failed write never breaks the page; the timeout is cleared as soon as headers arrive so it cannot cut off a body being cached; navigation requests fall back to `index.html`. `skipWaiting()` + `clients.claim()`; old `mathquiz-*` caches are deleted on activate. Because it always revalidates, the browser's HTTP cache cannot hold back a new release.
- Registered with `updateViaCache: 'none'`. `pwa.js` re-checks for a new version when the app returns to the foreground. If a new worker activates while an older page is open, `#updateBanner` ("A new version is ready" + Reload) appears (hidden during play).
- Settings has an **Install** section: an Install button on browsers that fire `beforeinstallprompt`, and Add-to-Home-Screen instructions on iPhone/iPad. An installed iOS app has **separate storage from Safari**, so profiles must be moved with Backup and restore.
- Icons are generated PNGs (`icons/`: 192, 512, maskable 512, apple-touch 180) plus `favicon.svg`; the design is four tiles with + − × ÷.
- Release rule: if the file list changes, edit `FILES` and bump `VERSION` in `sw.js`.

## Screen-time bank (`store.js`, `menus.js`, `game.js`)
Grade 1–6 only; age levels and guests never earn. Everything is stored per profile as `profile.rewards`, with the parent-adjustable numbers in `settings.rewards` (both travel with Backup and restore). The schema number is unchanged because the fields are additive: missing or damaged reward data is replaced by an empty bank (`cleanRewards`) and defaults (`cleanRewardConfig`).
- **Defaults** (`REWARD_DEFAULTS`, `REWARD_TIER_MINS` in `store.js`): 0.1 min per correct first attempt; accuracy multiplier 1.0 / 1.2 / 1.4 / 1.5 from 80 / 90 / 95 / 100 %; Grade 1–6 multiplier 1.0 … 1.5; minimum 80 % and 20 completed questions per batch.
- **Earning**: `minutes = floor(correct × base × accuracy multiplier × grade multiplier)`, rounded once per batch (`calcReward`). A question counts once, from the player's first tap (`player.answeredThisRound` block in `handleAnswer`), so retries cannot raise the correct count. In 1 vs 1 only questions a player actually answered count for that player; each profile is tracked separately.
- **Progress is saved on every first answer** as `rewards.session`. `settleRewards(profile, sessionId)` (called from `endGame`) folds the session into `rewards.pending[grade]` and pays out when `pending.completed >= minBatch`; a batch under the minimum accuracy pays 0 and is used up. Smaller batches carry forward per grade (grades are never combined). A session left by a closed page is folded (and paid if complete) the next time the store loads. `rewards.settled` holds recent session ids so a session is never counted twice.
- **Bank**: `balance = earned − redeemed` (never negative; `redeem` and `cleanRewards` enforce it); `earnTx` / `redeemTx` keep the last 30 entries.
- **Parent verification** (`parent.js`): the bank opens locked. Balance, earned/redeemed minutes, progress and history stay visible; redeeming and Parent settings need a typed answer to one short random quadratic or probability question (new question after every attempt, never shown with options or hints). Three wrong answers start a 30-second cooldown; the counter and cooldown end time are kept in `sessionStorage` so a refresh cannot skip them. The unlocked state is memory only and is cleared whenever the bank window closes or opens. `Store.setRewardConfig`, `resetRewardConfig`, `redeem`, `applyBackup` (Merge/Replace import) and `restoreBackup` (Undo import) check `MQParent.isUnlocked()` themselves and return `{ denied: true }` otherwise (`restoreBackup` returns `{ restored: false, denied: true }`). Export and backup preview need no verification. In the Profiles window the question appears inline under the import panel; one verification covers one import or undo, then it locks again. `resetRewardConfig` keeps the previous settings and returns `saved: false` when localStorage cannot save. Not strong security: anyone who can edit the code or storage can bypass it.
- **UI**: `#bankModal` ("⏱ Screen time" button), parent redeem (two taps) and Parent settings; the result card shows completed / correct / accuracy / minutes (`rewardSummary`). The game only tracks minutes; it cannot enforce screen time.

## Menus (`menus.js`)
- Settings: `.seg-button[data-setting][data-value]` → `MQStore.setSetting` → `html[data-palette]`, `html[data-text]`, `html[data-read-aloud]`. `readAloud` and `sound` are additive settings (no schema bump; missing/invalid values become `off`). A 🔊 Listen button is built on every board when `speechSynthesis` exists and shown only while read-aloud is on; with read-aloud on, Solo Age 2–6 also reads each new question once. Speech never describes the pictures (it would give away the answer) and never delays the next question.
- Profiles window: list, expandable details (sticker book, best timed scores, last 5 games), two-step delete ("Tap again to delete"), add form with avatar picker. Rebuilds with `textContent` only.
- Escape or a backdrop tap closes a window; `body.modal-open` stops background scrolling.
