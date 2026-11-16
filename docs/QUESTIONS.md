# Questions

All in `public/questions.js` (pure, testable in Node: `require('./public/questions.js')`).

## Public API (`MQQuestions`)
`DIFFICULTIES`, `TOPICS`, `isGrade(level)`, `gradeOf(level)`, `difficultyLabel`, `topicLabel`, `topicsFor(level)` (empty for age levels), `DEFAULT_TOPIC` (`'all'`), `normaliseTopic(level, topic)` (falls back to `'all'` if a topic is not allowed for the selected difficulty, e.g. an old saved `compare` selection), `generateQuestion(difficulty, topic)`, `questionKey()`, `buildQuestionBank()`, `createQuestionDeck()`.

## Question object
```js
{
  question: 'What is 7 × 8?',
  answers: ['54','55','56','57','58'],   // already ordered for display
  correct: 2,                            // index into answers (after ordering)
  simple: true,                          // optional: big centred number buttons, no A/B/C prefix (age levels)
  visual: ['🍎', …], visualLabel, rowsOfFive: true,       // optional counting objects (age 2–4)
  stage: { base:{emoji,name}, baseCount, op:'add'|'remove', change, added?:{emoji,name} },  // age 6
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
`buildQuestionBank` makes up to 500 distinct questions per level/topic (identity = `questionKey`: wording + figure + correct answer; capped attempts, so small pools such as Age 4 simply give a smaller bank).

## Levels
| Level | Generator | Notes |
|---|---|---|
| `toddler` | `makeToddlerQuestion` | Random mix of two types, both `simple`: `makeCountingQuestion` (1–5 objects in a row of 5, 3 options) and `makeCompareGroupsQuestion` ("Which group has more?": two groups of different objects, 1–5 each, counts differ by ≥ 2; the answers are the two groups themselves, tapped directly, `groups: true`, `answerLabels` for screen readers/read-aloud). Never asks for "fewer". Checked by `npm run test:toddler` |
| `age4` | `makeAge4Question` | Random mix of exactly five `simple` picture types, all within 10: `makeCounting10Question` ("How many?", 1–10 objects in a varied layout from `COUNT_LAYOUTS` or an occasional irregular one), `makeCompare10Question` ("Which group has more?", tap a group, closer pairs are harder), `makeAddition10Question` (`3 + 2 = ?`, two kinds of object in one frame), `makeSubtraction10Question` (`7 − 3 = ?`, all objects shown, remainder first, removed ones crossed out), `makeMissingNumberQuestion` (`3 + ? = 5` / `? + 2 = 5`, one frame of the total with dashed empty slots). Add, subtract and missing-number pictures share `pictureLayout()`: if every number in the equation (answer included) is in {3, 6, 9} → 3 per row; else if all in {2, 4, 6, 8} → two rows filled column by column; else 5 per row. Pictures are `picture` = groups of cell rows (`X` object, `x` crossed out, `O` empty slot, `.` blank), rendered by `createPicture()` in `game.js`; the arrangement is fixed per question and is part of `questionKey`. Each question has a `tier` (1–3); `createQuestionDeck` deals easier tiers first in the first round (allowed tier +1 every 6 questions). Checked by `npm run test:age4` |
| `age5` | `makeAge5Question` | ONE pool, ten weighted topics, no stages. Each question has `topic`, `kind` and `tier` (1–3; `createQuestionDeck` raises the allowed tier every 6 questions in the first round): counting 1–20 (`makeCounting20Question`, grouped 10+n / 6+6 / 10+10 layouts), compare more/fewer ("fewer" only from tier 2, gap ≥ 2), addition (picture → "How many altogether?" → notation; bonds, make 10, doubles, missing addend, beyond 10 without carrying), subtraction (picture, within 20, crossing 10 at tier 3 only, missing subtrahend/minuend, inverse), place value (rectangle marked 10 = one ten, circle marked 1 = one one; never money, no "tens/ones" wording), counting sequences (`numbers`, step ±1, 2, 5, 10, one gap), visual patterns (`pattern`, AB/AAB/ABB/ABC, `answerVisuals`), equal grouping ("How many groups?"), equal sharing ("How many each?", `lead` child per group), 2D shapes (circle/square/triangle/rectangle, `figure.type:'shape'`). Excluded: money, time, measurement, 3D shapes, number patterns, skip counting by 3, × ÷ symbols. Checked by `npm run test:age5` and `npm run test:age5ui` |
| `age6` | `makeAge6Question` | ONE pool, no stages; every question has `topic`, `kind`, `tier` (1–3, easier tiers dealt first) and `simple`. Topics: counting 1–20 and quick-look 1–5 (subitising); before/after and missing numbers (±1, up to 20); add/subtract within 10 with objects (`stage`) or symbols; number bonds, splitting, missing parts (`3 + ? = 7`, also as pictures); equal grouping and sharing; AB/AAB/ABB/ABC patterns; action sequences; Australian coins only (5c, 10c, 20c, 50c, $1, $2; no 1c/2c); practical measurement (length, size, mass, capacity); days of the week, routines and duration; 2D shapes, sides, corners; position and direction; picture graphs. No × or ÷. Number comparison (more/fewer, `< = >`) is **not** part of this pool; practical measurement comparisons ("Which one is longer?") are |
| `grade1`–`grade6` | topic generators | below. Grade 1 is one pool with `tier`s (no stages): numbers to 120, place value, add/subtract within 20 (never negative, never above 20), halves only, Australian coins, hour/half-hour clock, shapes, position, measurement, data |

## Topics (Grade 1–6 only)
`TOPICS[].grades` is the source of truth for availability.

| Topic | Grades | Generator and notes |
|---|---|---|
| `mixed` | 1–6 | `arithmeticQuestion`: Grade 1 `makeGrade1ArithmeticQuestion` (+ − within 20: plain, doubles/near doubles, bonds to 10/20, missing number in either position, simple stories; `mixed` also sharing, grouping and repeated addition as a picture, never × ÷); + − × ÷ from Grade 2. Ranges grow each grade. |
| `all` (Mixed All Questions, first in the list and the default) | 1–6 | `generateRawQuestion` picks one of `ALL_MIX_TOPICS` (`mixed`, `numbers`, `tables`, `fractions`, `money`, `clock`, `shapes`) and keeps the grade's allowed set. Decimal-versus-fraction comparisons (Grades 5–6) come in through `fractions`. |
| `numbers` | 1 | `makeGrade1NumbersQuestion`: number words (both ways), before/after and missing numbers up to 120, 10 more/less, skip counting in 2s/5s/10s forwards and backwards, place value with `promptVisual` blocks (tens and ones, digit value, partitioning) |
| `add`, `sub` | 1–6 | same generator, one operator |
| `mul`, `div` | 2–6 | same generator, one operator (division is always exact) |
| `tables` | 2–4 | `makeTablesQuestion`: × and ÷ facts and `a × ? = p`. G2 tables of 2/5/10; G3 up to 10×10; G4 12×12 emphasis |
| ~~`compare`~~ | none | Removed. Standalone number comparison is no longer asked at Grades 1–4 and there is no general Comparing-numbers topic. The `TOPICS` entry (no grades) only keeps old history/reports labelled; an old saved selection normalises to `all`. Age 2–6 behaviour is untouched |
| `fractions` | 1–6 | `makeFractionsQuestion`: G1 halves only (half of an even number, 2 halves = 1 whole, naming halves, equal vs unequal parts); G2 1/2,1/3,1/4 of N; G3 fraction of an amount; G4 equivalent, add/subtract like denominators, amount; G5 add/subtract unlike denominators, amount, **compare one decimal with one fraction**; G6 multiply/divide fractions, “How many 1/ds are in w?”, decimal-versus-fraction comparison. `makeDecimalFractionCompare`: `Compare: 0.75 ? 2/3` (either order, fraction below 1), `<`, `=`, `>` chosen evenly |
| `money` | 1–4 | `makeMoneyQuestion`: coins/totals/change/price × quantity; all answers in cents to avoid decimals. Australian coins only (5c, 10c, 20c, 50c, $1, $2): never 1c or 2c. Grade 1: totals, “How many cents is $1?”, “Which coins make 20c?” |
| `clock` | 1–4 | `makeClockQuestion`: SVG clock (`figure`); minutes on a 30 / 15 / 5 / 1 minute grid; answers `h:mm` sorted by time; includes a "hands swapped" distractor when sensible |
| `shapes` | 1–6 | `makeShapesQuestion`: G1 sides/corners of a drawn polygon plus position and direction, practical measurement (which is longer/heavier…, measuring tools) and simple data (picture graphs, tally marks); G2 sides/corners of a drawn polygon; G3 polygon names and 3D solids (faces/edges/vertices); G4 missing triangle angle, rectangle perimeter; G5 rectangle area, square area; G6 quadrilateral missing angle, triangle/parallelogram area |

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
