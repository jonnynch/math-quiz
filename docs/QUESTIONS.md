# Questions

All in `public/questions.js` (pure, testable in Node: `require('./public/questions.js')`).

## Public API (`MQQuestions`)
`DIFFICULTIES`, `TOPICS`, `isGrade(level)`, `gradeOf(level)`, `difficultyLabel`, `topicLabel`, `topicsFor(level)` (empty for age levels), `DEFAULT_TOPIC` (`'all'`), `normaliseTopic(level, topic)` (falls back to `'all'` if a topic is not allowed for the selected difficulty), `generateQuestion(difficulty, topic)`, `questionKey()`, `buildQuestionBank()`, `createQuestionDeck()`.

## Question object
```js
{
  question: 'What is 7 × 8?',
  answers: ['54','55','56','57','58'],   // already ordered for display
  correct: 2,                            // index into answers (after ordering)
  simple: true,                          // optional: big centred number buttons, no A/B/C prefix (age levels)
  visual: ['🍎', …], visualLabel, rowsOfFive: true,       // optional counting objects (age 2–4)
  stage: { base:{emoji,name}, baseCount, op:'add'|'remove', change, added?:{emoji,name} },  // age 5/6
  resultText: '3 + 7 = 10',              // optional: replaces the question text after a correct answer
  figure: { type:'clock', hour, minute } | { type:'polygon', sides }   // optional SVG drawn by game.js
}
```
Generators return answers with `correct: 0` and the wrapper `generateQuestion` orders them. Generators may also return `keys` (numeric sort keys parallel to `answers`, used for fractions and clock questions) and `groups`/`picture`, handled by `game.js` for Age 2–4.

## Ordering rule (`generateQuestion`)
- If `keys` exist → sort by `keys`.
- Else if every answer is numeric → sort by number.
- Else keep the given order (only the `< (less than)`, `= (equal to)`, `> (greater than)` choices).

## Keeping the correct answer's position random
Sorting ascending makes the right answer land in the middle if wrong answers are picked symmetrically. So:
- `pickWrongAnswers(correct, pool, count, must, preferredBelow)` chooses how many wrong answers sit below the correct one (uniformly at random, within what the pool allows), then picks that many from the lower side and the rest from the upper side.
- `makeQuestion` (arithmetic) decides the target position first and places the required same-last-digit wrong answer on a compatible side.
- `pickWithMistake` does the same for a "typical mistake" distractor (e.g. adding instead of multiplying) used by `makeNumericQuestion`, fractions and clock questions.
- `tests/questions.check.js` prints the position distribution per level/topic; it should be roughly even (see `docs/TESTING.md`). Limits that are unavoidable: when the correct answer is the smallest or largest possible, the randomisation is constrained.

## No repeats within a game
`buildQuestionBank` makes up to 500 distinct questions per level/topic (identity = `questionKey`: wording + figure + correct answer; capped attempts, so tiny pools such as Age 5 simply give a smaller bank).

## Levels
| Level | Generator | Notes |
|---|---|---|
| `toddler` | `makeToddlerQuestion` | Random mix of two types, both `simple`: `makeCountingQuestion` (1–5 objects in a row of 5, 3 options) and `makeCompareGroupsQuestion` ("Which group has more?": two groups of different objects, 1–5 each, counts differ by ≥ 2; the answers are the two groups themselves, tapped directly, `groups: true`, `answerLabels` for screen readers/read-aloud). Never asks for "fewer". Checked by `npm run test:toddler` |
| `age4` | `makeAge4Question` | Random mix of exactly five `simple` picture types, all within 10: `makeCounting10Question` ("How many?", 1–10 objects in a varied layout from `COUNT_LAYOUTS` or an occasional irregular one), `makeCompare10Question` ("Which group has more?", tap a group, closer pairs are harder), `makeAddition10Question` (`3 + 2 = ?`, two kinds of object in one frame), `makeSubtraction10Question` (`7 − 3 = ?`, all objects shown, remainder first, removed ones crossed out), `makeMissingNumberQuestion` (`3 + ? = 5` / `? + 2 = 5`, one frame of the total with dashed empty slots). Add, subtract and missing-number pictures share `pictureLayout()`: if every number in the equation (answer included) is in {3, 6, 9} → 3 per row; else if all in {2, 4, 6, 8} → two rows filled column by column; else 5 per row. Pictures are `picture` = groups of cell rows (`X` object, `x` crossed out, `O` empty slot, `.` blank), rendered by `createPicture()` in `game.js`; the arrangement is fixed per question and is part of `questionKey`. Each question has a `tier` (1–3); `createQuestionDeck` deals easier tiers first in the first round (allowed tier +1 every 6 questions). Checked by `npm run test:age4` |
| `age5` | `makeBondsTo10Question` | `3 + ? = 10`; `stage` shows 3 objects, correct answer adds 7 of a different type |
| `age6` | `makeWithin10Question` | sums ≤ 10; subtraction starts ≤ 10; `stage` adds a different object type or removes the last ones |
| `grade1`–`grade6` | topic generators | below |

## Topics (Grade 1–6 only)
`TOPICS[].grades` is the source of truth for availability.

| Topic | Grades | Generator and notes |
|---|---|---|
| `mixed` | 1–6 | `arithmeticQuestion`: + − (Grade 1), + − × ÷ from Grade 2. Ranges grow each grade. |
| `all` (Mixed All Questions, first in the list and the default) | 1–6 | `generateRawQuestion` picks one of `ALL_MIX_TOPICS` (`mixed`, `tables`, `compare`, `fractions`, `money`, `clock`, `shapes`) and keeps the grade's allowed set. |
| `add`, `sub` | 1–6 | same generator, one operator |
| `mul`, `div` | 2–6 | same generator, one operator (division is always exact) |
| `tables` | 2–4 | `makeTablesQuestion`: × and ÷ facts and `a × ? = p`. G2 tables of 2/5/10; G3 up to 10×10; G4 12×12 emphasis |
| `compare` | 1–4 | `makeCompareNumbersQuestion`: choose `<`, `=`, `>` (0–20, 10–99, 100–999, 1000–9999) |
| `fractions` | 1–6 | `makeFractionsQuestion`: G1 half of N; G2 1/2,1/3,1/4 of N; G3 fraction of an amount + compare unit fractions; G4 equivalent, add/subtract like denominators, compare, amount; G5 add/subtract unlike denominators; G6 multiply/divide fractions, questions like “How many 1/ds are in w?” |
| `money` | 1–4 | `makeMoneyQuestion`: coins/totals/change/price × quantity; all answers in cents to avoid decimals |
| `clock` | 1–4 | `makeClockQuestion`: SVG clock (`figure`); minutes on a 30 / 15 / 5 / 1 minute grid; answers `h:mm` sorted by time; includes a "hands swapped" distractor when sensible |
| `shapes` | 1–6 | `makeShapesQuestion`: G1–2 sides/corners of a drawn polygon; G3 polygon names and 3D solids (faces/edges/vertices); G4 missing triangle angle, rectangle perimeter; G5 rectangle area, square area; G6 quadrilateral missing angle, triangle/parallelogram area |

Arithmetic questions (`mixed`, `add`, `sub`, `mul`, `div`, `tables`) at Grade 4+ pass `sameLastDigit = true` to `makeQuestion`, so at least one wrong option shares the correct answer's last digit.

## Question banks
`game.js` builds 500 questions per `(level, topic)` when a game starts (`loadQuestionSet`) and reshuffles when exhausted. Repeats are possible for small domains (e.g. Age 5 has only 9 distinct questions).

## Adding a topic
1. Add it to `TOPICS` with the grades it suits. Do not add topics for age levels.
2. Write `makeXxxQuestion(grade)` returning `{ question, answers, correct: 0 }` using `makeNumericQuestion`, `makeFractionQuestion` or `makeQuestion` so distractors and position randomisation come from the shared helpers.
3. Add a `case` in `generateRawQuestion`.
4. If a drawing is needed, add a `figure` type and render it in `createFigure()` in `game.js`, with CSS that reserves a fixed square.
5. Extend `tests/questions.check.js` with an independent check that recomputes the answer from the question text (never trust the generator's own answer).
6. Update the table above and `README.md`.
