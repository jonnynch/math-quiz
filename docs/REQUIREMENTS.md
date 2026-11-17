# Owner requirements and decisions

The owner built this game with an AI assistant over many iterations. These are their requests in order, with the reasoning, so future changes stay consistent. "Must keep" items are also summarised in `AGENTS.md`.

## Original game
Solo and 1 vs 1 maths quiz for a shared touch screen on a home network. The static application is served by Cloudflare Workers; questions are generated in the browser (no JSON files/API). Grade 1–6 with increasing complexity.

## Iteration log
1. **Counting level for ages 2–3** – show objects, ask how many. *(Now lays them out in a row of 5.)*
2. **Both players tapping at once froze the answers.** Fixed by handling `pointerdown` (multi-touch safe) instead of `click`. **Must keep.**
3. **1 vs 1 rules**: a wrong answer locks that player out for the question; both wrong → nobody scores, move on. Solo still allows retrying. **Must keep.**
4. **Grade 4+**: the answer could be guessed from the last digit, so at least one wrong option must share it. **Must keep.**
5. **More levels**: Age 4 (five picture question types within 10: counting in varied subitising arrangements, "Which group has more?", picture addition, picture subtraction, missing-number addition), Age 5 (originally making 10; now one unified pool of ten topics, see `docs/QUESTIONS.md`), Age 6 (add/subtract within 10; sums ≤ 10, subtraction starts ≤ 10). **Adult level removed** (decimal division was unreasonable).
6. **Answers sorted smallest → largest.** Then: "the correct answer is always third" → randomise its position while keeping the order (see `docs/QUESTIONS.md`). **Must keep both.**
7. **Remove "both players use this iPad"** (they may not use an iPad) and **show answers one by one** (single column) because tiles were slower to read. **Must keep.**
8. **Stop Game summary** shows, per player, score, **average time** and **correct percentage**.
9. **Timed game** for Solo and 1 vs 1: selectable duration, default 60 s; the default mode stays Endless; the game ends and summarises at zero.
10. **Object stage** for Age 6 (Age 5 now uses pictures instead): first number as objects above the equation; correct answer adds objects of a *different* type (or removes some for subtraction); **reserve the height** so nothing moves. **Must keep.**
11. **Phone landscape**: question and answers visible in Solo and 1 vs 1. **Must keep.**
12. **Enhancements chosen by the owner**: rewards (streaks, confetti, stars, stickers), more topics **for Grade 1–6 only (not the age levels)**, saved profiles, settings (colour-blind friendly palette, larger text).

13. **Profile backup/restore** (after an independent review): export/import with preview, merge or replace, Undo, schema version, and clear messages when the browser cannot save. Reason: profiles are per browser/device/web address and iOS can clear Safari storage after a period of non-use.

14. **Installable and offline** (PWA): manifest, icons, service worker, update notice, install help in Settings. Reason: reload and play without internet once loaded, and run full screen from the home screen.

## Product decisions made along the way (and why)
- Score = number of correct answers. Streaks/stickers/stars are celebration only, so 1 vs 1 fairness is unaffected.
- Accuracy counts every tapped answer; average time is first tap per question.
- Empty slots in the object stage are invisible (outlines would let a child count the gaps to get the answer).
- Money values are represented in cents internally. Decimal questions are excluded from Age 2–6 and Grades 1–3; Grade 4 onwards may include decimals according to the curriculum. Decimal division was rejected for the removed Adult level.
- Profiles live in `localStorage` (this device/browser only) because the server is static; there is no backend by design. Moving them between devices is done with Export/Import, not a cloud account (avoids storing children's data online).
- Topics are filtered per grade so a Grade 1 child never sees times tables, etc.
- Long-press/double-tap/selection are suppressed on buttons (`touch-action: manipulation`, `user-select: none`) for kids tapping quickly.
- Text-size scaling is capped slightly on very short landscape screens so all answers still fit.

## Ideas not done (from the owner's suggestion list)
Automatic level-up, review of missed questions / mistake history, keyboard shortcuts for laptops, wake lock, focus trapping in windows, security headers, and race-to-N / best-of-N for 1 vs 1.

Implemented and verified in the current project: optional read-aloud and sound effects (`audio.js` / `tests/audio.check.js`); no-repeat question decks (`questions.js` / `tests/no-repeat.check.js`); parent-gated CSV export (`report.js` / `tests/report.check.js`); and GitHub Actions CI with a lockfile (`.github/workflows/ci.yml`, `package-lock.json`).


## Playzone usage tracking and Screen-time page adjustment
- Playzone personal bests (Reaction Battle best ms, lower is better; Balloon Pop best score) are also listed in each player's Profile Details ("Not played yet" when empty).
- Games are charged by actual time: `Math.ceil(seconds / 60)` whole minutes per session (at least 1), charged when the session ends, never up front. The balance may be negative (also after a parent deduction); a balance of 0 or less only blocks starting a NEW game.
- Parent minute adjustment moved from Playzone to the Screen-time page; it still needs the hard quadratic question.

## Balloon Pop progression
- Endless levels (no cap, 4 pops per level), combo bonus points (score only), changing skies at levels 8/15/25/40 with real gameplay effects, and ten Balloon Pop trophies in the existing trophy system. No special balloons or power-ups. Screen-time charging is unchanged.
