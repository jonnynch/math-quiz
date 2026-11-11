# Owner requirements and decisions

The owner built this game with an AI assistant over many iterations. These are their requests in order, with the reasoning, so future changes stay consistent. "Must keep" items are also summarised in `AGENTS.md`.

## Original game
Solo and 1 vs 1 maths quiz for a shared touch screen on a home network (Nginx + Docker, `docker-compose.yml`, port 8080). Questions are generated in the browser (no JSON files/API). Grade 1–6 with increasing complexity.

## Iteration log
1. **Counting level for ages 2–3** – show objects, ask how many. *(Now lays them out in a row of 5.)*
2. **Both players tapping at once froze the answers.** Fixed by handling `pointerdown` (multi-touch safe) instead of `click`. **Must keep.**
3. **1 vs 1 rules**: a wrong answer locks that player out for the question; both wrong → nobody scores, move on. Solo still allows retrying. **Must keep.**
4. **Grade 4+**: the answer could be guessed from the last digit, so at least one wrong option must share it. **Must keep.**
5. **More levels**: Age 4 (five picture question types within 10: counting in varied subitising arrangements, "Which group has more?", picture addition, picture subtraction, missing-number addition), Age 5 (making 10, e.g. 3 → select 7), Age 6 (add/subtract within 10; sums ≤ 10, subtraction starts ≤ 10). **Adult level removed** (decimal division was unreasonable).
6. **Answers sorted smallest → largest.** Then: "the correct answer is always third" → randomise its position while keeping the order (see `docs/QUESTIONS.md`). **Must keep both.**
7. **Remove "both players use this iPad"** (they may not use an iPad) and **show answers one by one** (single column) because tiles were slower to read. **Must keep.**
8. **Stop Game summary** shows, per player, score, **average time** and **correct percentage**.
9. **Timed game** for Solo and 1 vs 1: selectable duration, default 60 s; the default mode stays Endless; the game ends and summarises at zero.
10. **Object stage** for Age 5/6: first number as objects above the equation; correct answer adds objects of a *different* type (or removes some for subtraction); **reserve the height** so nothing moves. **Must keep.**
11. **Phone landscape**: question and answers visible in Solo and 1 vs 1. **Must keep.**
12. **Enhancements chosen by the owner**: rewards (streaks, confetti, stars, stickers), more topics **for Grade 1–6 only (not the age levels)**, saved profiles, settings (colour-blind friendly palette, larger text).

13. **Profile backup/restore** (after an independent review): export/import with preview, merge or replace, Undo, schema version, and clear messages when the browser cannot save. Reason: profiles are per browser/device/web address and iOS can clear Safari storage after a period of non-use.

14. **Installable and offline** (PWA): manifest, icons, service worker, update notice, install help in Settings. Reason: reload and play without internet once loaded, and run full screen from the home screen.

## Product decisions made along the way (and why)
- Score = number of correct answers. Streaks/stickers/stars are celebration only, so 1 vs 1 fairness is unaffected.
- Accuracy counts every tapped answer; average time is first tap per question.
- Empty slots in the object stage are invisible (outlines would let a child count the gaps to get the answer).
- Money answers are in cents and there are no decimals anywhere (decimal division was rejected earlier).
- Profiles live in `localStorage` (this device/browser only) because the server is static; there is no backend by design. Moving them between devices is done with Export/Import, not a cloud account (avoids storing children's data online).
- Topics are filtered per grade so a Grade 1 child never sees times tables, etc.
- Long-press/double-tap/selection are suppressed on buttons (`touch-action: manipulation`, `user-select: none`) for kids tapping quickly.
- Text-size scaling is capped slightly on very short landscape screens so all answers still fit.

## Ideas not done (from the owner's suggestion list)
Read-aloud / sound effects for young children, automatic level-up, review of missed questions / mistake history, avoiding repeated questions within a game, keyboard shortcuts for laptops, wake lock, parent CSV export, focus trapping in windows, GitHub Actions CI + lockfile, security headers, race-to-N / best-of-N for 1 vs 1.
