# Questions

All in `public/questions.js` (pure, testable in Node: `require('./public/questions.js')`).

## Public API (`MQQuestions`)
`DIFFICULTIES`, `TOPICS`, `isGrade(level)`, `gradeOf(level)`, `difficultyLabel`, `topicLabel`, `topicsFor(level)` (empty for age levels), `DEFAULT_TOPIC` (`'all'`), `normaliseTopic(level, topic)` (falls back to `DEFAULT_TOPIC`), `generateQuestion(level, topic=DEFAULT_TOPIC)`, plus `shuffledCopy`, `intBetween`, `choose`.

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
Generators return answers with `correct: 0` and the wrapper `generateQuestion` orders them. Generators may also return `keys` (numeric sort keys parallel to `answers`, used for fractions and clock times); the wrapper deletes `keys` after sorting.

## Ordering rule (`generateQuestion`)
- If `keys` exist → sort by `keys`.
- Else if every answer is numeric → sort by number.
- Else keep the given order (only the `< (less than)`, `= (equal to)`, `> (greater than)` choices).

## Keeping the correct answer's position random
Sorting ascending makes the right answer land in the middle if wrong answers are picked symmetrically. So:
- `pickWrongAnswers(correct, pool, count, must, preferredBelow)` chooses **how many wrong answers sit below the correct one** (uniformly at random, within what the pool allows), then picks that many from below and the rest from above, preferring values near the correct answer.
- `makeQuestion` (arithmetic) decides the target position first and places the required same-last-digit wrong answer on a compatible side.
- `pickWithMistake` does the same for a "typical mistake" distractor (e.g. adding instead of multiplying) used by `makeNumericQuestion`, fractions and clock questions.
- `tests/questions.check.js` prints the position distribution per level/topic; it should be roughly even (see `docs/TESTING.md`). Limits that are unavoidable: when the correct answer is the smallest possible value (e.g. a count of 1) it must be first; fixed `< = >` choices have fixed positions.

## No repeats within a game
`buildQuestionBank` makes up to 500 *distinct* questions per level/topic (identity = `questionKey`: wording + figure + correct answer; capped attempts, so tiny pools such as Age 5 simply give a smaller bank). `createQuestionDeck` deals each once in random order, then reshuffles (never stopping, never the same question twice in a row). `game.js` creates one deck per player per game, which is what resets tracking. Checked by `npm run test:norepeat`.

## Levels
| Level | Generator | Notes |
|---|---|---|
| `toddler` | `makeCountingQuestion` | 1–5 objects in a row of 5, 3 options, `simple` |
| `age4` | `makeCounting10Question` | 1–10 objects in rows of 5 (6 = 5 + 1), 4 options, `simple` |
| `age5` | `makeBondsTo10Question` | `3 + ? = 10`; `stage` shows 3 objects, correct answer adds 7 of a different type |
| `age6` | `makeWithin10Question` | sums ≤ 10; subtraction starts ≤ 10; `stage` adds a different object type or removes the last ones |
| `grade1`–`grade6` | topic generators | below |

## Topics (Grade 1–6 only)
`TOPICS[].grades` is the source of truth for availability.

| Topic | Grades | Generator and notes |
|---|---|---|
| `mixed` | 1–6 | `arithmeticQuestion`: + − (Grade 1), + − × ÷ from Grade 2. Ranges grow each grade. |
| `all` (Mixed All Questions, first in the list and the default) | 1–6 | `generateRawQuestion` picks one of `ALL_MIX_TOPICS` (`mixed`, `tables`, `compare`, `fractions`, `money`, `clock`, `shapes`) that the grade offers, then uses that generator unchanged. Add new topics to `ALL_MIX_TOPICS` too. |
| `add`, `sub` | 1–6 | same generator, one operator |
| `mul`, `div` | 2–6 | same generator, one operator (division is always exact) |
| `tables` | 2–4 | `makeTablesQuestion`: × and ÷ facts and `a × ? = p`. G2 tables of 2/5/10; G3 up to 10×10; G4 12×12 emphasis |
| `compare` | 1–4 | `makeCompareNumbersQuestion`: choose `<`, `=`, `>` (0–20, 10–99, 100–999, 1000–9999) |
| `fractions` | 1–6 | `makeFractionsQuestion`: G1 half of N; G2 1/2,1/3,1/4 of N; G3 fraction of an amount + compare unit fractions; G4 equivalent, add/subtract like denominators, compare, amounts; G5 add/subtract unlike denominators (one a multiple of the other), compare, amounts; G6 multiply, fraction ÷ whole, "how many 1/d in w", add unlike. Fraction results are shown in simplest form (questions say so) and sorted by value. |
| `money` | 1–4 | `makeMoneyQuestion`: coins/totals/change/price × quantity; **all answers in cents** (question says "cents") to avoid decimals |
| `clock` | 1–4 | `makeClockQuestion`: SVG clock (`figure`); minutes on a 30 / 15 / 5 / 1 minute grid; answers `h:mm` sorted by time; includes a "hands swapped" distractor when sensible |
| `shapes` | 1–6 | `makeShapesQuestion`: G1–2 sides/corners of a drawn polygon; G3 polygon names and 3D solids (faces/edges/vertices); G4 missing triangle angle, rectangle perimeter; G5 rectangle/square area; G6 triangle/parallelogram area, quadrilateral angle |

Arithmetic questions (`mixed`, `add`, `sub`, `mul`, `div`, `tables`) at Grade 4+ pass `sameLastDigit = true` to `makeQuestion`, so at least one wrong option shares the correct answer's last digit. The other topics use 4 options; arithmetic uses 5.

## Question banks
`game.js` builds 500 questions per `(level, topic)` when a game starts (`loadQuestionSet`) and reshuffles when exhausted. Repeats are possible for small domains (e.g. Age 5 has only 9 distinct questions).

## Adding a topic
1. Add it to `TOPICS` with the grades it suits. Do **not** add topics for age levels.
2. Write `makeXxxQuestion(grade)` returning `{ question, answers, correct: 0 }` using `makeNumericQuestion`, `makeFractionQuestion` or `makeQuestion` so distractors and position randomisation come for free. Use `keys` if the answers are not plain numbers but have an order.
3. Add a `case` in `generateRawQuestion`.
4. If a drawing is needed, add a `figure` type and render it in `createFigure()` in `game.js`, with CSS that reserves a fixed square (see `docs/UI-AND-LAYOUT.md`).
5. Extend `tests/questions.check.js` with an independent check that recomputes the answer from the question text (never trust the generator's own answer).
6. Update the table above and `README.md`.
