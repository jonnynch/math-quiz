# Questions

All in `public/questions.js` (pure, testable in Node: `require('./public/questions.js')`).

## Public API (`MQQuestions`)
`DIFFICULTIES`, `TOPICS`, `isGrade(level)`, `gradeOf(level)`, `difficultyLabel`, `topicLabel`, `topicsFor(level)` (empty for age levels), `DEFAULT_TOPIC` (`'all'`), `normaliseTopic(level, topic)` (falls back to `'all'` if a topic is not allowed for the selected difficulty, e.g. an old saved `compare` selection), `generateQuestion(difficulty, topic)`, `questionKey()`, `buildQuestionBank()`, `createQuestionDeck()`.

## Question object
```js
{
  question: '7 × 8 = ?',
  answers: ['54','55','56','57'],       // already ordered for display
  correct: 2,                            // index into answers (after ordering)
  simple: true,                          // optional: big centred number buttons, no A/B/C prefix (age levels)
  visual: ['🍎', …], visualLabel, rowsOfFive: true,       // optional counting objects (age 2–4)
  stage: { base:{emoji,name}, baseCount, op:'add'|'remove', change, added?:{emoji,name} },  // age 6
  resultText: '3 + 7 = 10',              // optional: replaces the question text after a correct answer
  figure: { type:'clock', hour, minute } | { type:'polygon', sides },  // optional SVG drawn by game.js
  coins: [10, 20, 100]                   // optional Australian coins in cents (5, 10, 20, 50, 100, 200) drawn by game.js
}
```
**Layout rule (all levels):** any illustration (`stage`, `figure`, `pattern`, `promptVisual`, `picture`, `coins`, `visual`) is drawn ABOVE the question sentence; a number strip (`numbers`) stays under it. Questions without an illustration get no empty container (`createQuestionBoard` in `game.js`, checked by `tests/illustration-layout.check.js`).
Generators return answers with `correct: 0` and the wrapper `generateQuestion` orders them. Generators may also return `keys` (numeric sort keys parallel to `answers`, used for fractions and clock questions) and `groups`/`picture`, handled by `game.js` for Age 2–4.

## Ordering rule (`generateQuestion`)
- If `keys` exist → sort by `keys`.
- Else if every answer is numeric → sort by number.
- Else keep the given order (only the `< (less than)`, `= (equal to)`, `> (greater than)` choices).

## Presentation and answer-choice conventions
- Standalone arithmetic uses an equation prompt such as `7 × 8 = ?`; missing values stay in the equation, such as `3 + ? = 8`. Fraction amounts use `1/2 of 12 = ?`, with operators shown symbolically where that is clear to the learner.
- Clock questions use `Read the time.` and keep the clock illustration above the prompt. Counting and diagram questions retain short age-appropriate prompts and their teaching aids.
- Geometry prompts name the target quantity briefly (`How many sides?`, `faces of a cube = ?`) and show measurement units in the question (`Perimeter of 8 cm × 4 cm rectangle = ? cm`, `Area = ? cm²`).
- Standard multiple-choice questions have four distinct answers at Age 4 through Grade 6. Age 2–3 counting uses three numeric choices. Intentional exceptions keep only meaningful options: group-comparison activities let the child tap one of two pictured groups; comparisons use the fixed `<`, `=`, `>` set; Grade 2 chart questions can offer three categories because the chart has three categories. These are checked by `tests/questions.check.js`.
- Numeric answer choices remain in ascending order. Illustrations and answer-choice interactions are unchanged by wording conventions.

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
| `age5` | `makeAge5Question` | ONE pool, ten weighted topics, no stages. Each question has `topic`, `kind` and `tier` (1–3; `createQuestionDeck` raises the allowed tier every 6 questions in the first round): counting 1–20 (`makeCounting20Question`, grouped 10+n / 6+6 / 10+10 layouts), compare more/fewer ("fewer" only from tier 2, gap ≥ 2), addition (picture with equation prompt; bonds, make 10, doubles, missing addend, beyond 10 without carrying), subtraction (picture with equation prompt, within 20, crossing 10 at tier 3 only, missing subtrahend/minuend, inverse), place value (rectangle marked 10 = one ten, circle marked 1 = one one; never money, no "tens/ones" wording), counting sequences (`numbers`, step ±1, 2, 5, 10, one gap), visual patterns (`pattern`, AB/AAB/ABB/ABC, `answerVisuals`), equal grouping ("How many groups?"), equal sharing ("How many each?", `lead` child per group), 2D shapes (circle/square/triangle/rectangle, `figure.type:'shape'`). Excluded: money, time, measurement, 3D shapes, number patterns, skip counting by 3, × ÷ symbols. Checked by `npm run test:age5` and `npm run test:age5ui` |
| `age6` | `makeAge6Question` | ONE pool; every question has `topic`, `kind`, `tier` (1–3, easier tiers dealt first) and `simple`. Included: counting 1–20 and quick-look 1–5; sequence gaps (±1, up to 20); addition and subtraction within 10; symbolic arithmetic; number bonds, equation-form splitting (`4 = 1 + ?`) and missing parts; AB/AAB/ABB/ABC patterns; Australian coins; 2D shapes, sides and corners; picture-graph totals. Addition starts with the first addend visible and reveals the second after the shared 1.2 s teaching-aid delay. Subtraction starts with every object uncrossed and crosses out the removed objects after the same delay. Neither illustration shows a numeric answer before answering. Excluded: standalone before/after questions, row-position and arrow-direction questions, cube-bar measurement/comparison, equal grouping and equal sharing. Removed: days, routines, action sequences, vague “which is heavier” and everyday-knowledge questions. No × or ÷ or number-comparison questions |
| `grade1`–`grade6` | topic generators | below. Grade 1 is one pool with `tier`s (no stages): numbers to 120, place value, add/subtract within 20 (never negative, never above 20; every operation has an operand from 10 to 19), numeric halves, Australian coins, hour/half-hour clock, shape identification, measurement and data |

### Age 6 and Grade 1 scope

- **Age 6 included:** counting, subitising, number-sequence gaps, addition, subtraction, symbolic arithmetic, number bonds and equation-form splitting, visual patterns, Australian coins, 2D shapes and picture-graph totals. Addition pictures reveal the second addend after the shared 1.2 second teaching-aid delay. Subtraction pictures show all objects first, then cross out the removed objects after that same delay. The numeric result appears only after the child answers.
- **Age 6 excluded:** standalone before/after questions, position-in-a-row questions, arrow-direction questions, measurement/comparison questions, equal grouping and equal sharing. Number sequences cover the before/after skill. No ×, ÷ or standalone number comparisons.
- **Grade 1 included:** concise equation arithmetic, missing numbers, ten-more/ten-less equations, skip-counting and sequence gaps, place value, halves of numbers / halves in a whole, Australian money, hour/half-hour clocks, shape identification, cube-bar measurement and picture-graph totals.
- **Grade 1 excluded:** standalone before/after questions, number-word identification, English-based object-counting prompts, mixed-object counting questions, arrow-direction identification, English-comprehension halves questions, equal grouping and equal sharing. Sequence questions cover the next-number skill. Grade 1 addition and subtraction (including missing-number equations in Mixed arithmetic, Addition only and Subtraction only) always use at least one 10–19 operand; answers stay within 0–20 and subtraction is non-negative.

## Topics (Grade 1–6 only)
`TOPICS[].grades` is the source of truth for availability.

| Topic | Grades | Generator and notes |
|---|---|---|
| `mixed` | 1–6 | `arithmeticQuestion`: Grade 1 `makeGrade1ArithmeticQuestion` (+ − within 20 as short equations: plain, double/near-double, bonds to 20, missing number in either position; every operation has an operand from 10 to 19; no stories, grouping or sharing). Grade 2 uses two-digit calculations, friendly hundreds/tens, missing values and inverse facts; multiplication/division stay within the 2, 5 and 10 tables. Grade 3 adds friendly three-digit addition/subtraction, missing/inverse equations, tables through 10×10 and manageable two-digit-by-one-digit multiplication. Grade 4 uses three-digit addition/subtraction, missing/inverse equations, two-digit-by-one-digit multiplication and exact one-digit division. Grade 5 keeps all four operations mentally manageable, with two-digit-by-one-digit multiplication and exact one-digit division. Grade 6 continues with moderate whole numbers, negative integer addition/subtraction and missing-value equations. |
| `all` (Mixed All Questions, first in the list and the default) | 1–6 | `generateRawQuestion` picks from `ALL_MIX_TOPICS` and keeps the grade's allowed set. Grades 2–3 include number work, patterns and data; Grade 4 includes decimals; Grade 5 includes numbers, decimals, percentages, ratios and probability; Grade 6 adds algebra and statistics. Decimal-versus-fraction comparisons in Grades 5–6 come through `fractions`. |
| `numbers` | 1–6 | Grade 1 `makeGrade1NumbersQuestion`: missing numbers and sequences up to 120, ten more/less **as equations**, skip counting in 2s/5s/10s, and tens-and-ones place value. Grade 2 `makeGrade2NumbersQuestion`: two-/three-digit numbers, hundreds/tens/ones, expanded form, missing place values, `<` / `=` / `>` comparisons, ordering and number sequences. Grade 3 adds three-/four-digit place value and expanded notation, missing places, ordering, comparison, rounding to 10/100, and interval sequences. Grade 4 adds four-digit place value, expanded notation, rounding/estimation, factor lists, multiples and introductory prime/composite questions. Grade 5 adds rounding/estimation, factors/multiples, divisibility, missing factors and order of operations with small numbers. Grade 6 adds negative numbers and number-line comparisons, factors/multiples, divisibility, rounding/estimation, missing equations and order of operations. |
| `add`, `sub` | 1–6 | same generator, one operator |
| `mul`, `div` | 2–6 | same generator, one operator (division is always exact) |
| `tables` | 2–4 | Grade 2 uses 2, 5 and 10 facts, exact division, missing factors/divisors and small array illustrations. Grade 3 uses facts through 10×10, multiplication by 10, exact division and missing factors/divisors; manageable two-digit multiplication is also in the arithmetic pool. Grade 4 keeps table facts through 10×10 with exact division and missing factors. |
| `patterns` | 2–4 | Grade 2 repeats the visual AB/AAB/ABB/ABC pattern tasks using shapes and colours; Grade 3 uses multiplication sequences with a missing term; Grade 4 uses interval and multiplication sequences with missing terms |
| `data` | 2–3 | Grade 2 bar charts: read a category, find the most, compare the difference or find a total. Grade 3 uses four-category bar charts and the same concise interpretation tasks |
| ~~`compare`~~ | none | No standalone Comparing-numbers topic. Grade 2 comparisons are embedded in Numbers, Fractions and Measurement; Grade 4 compares decimals and angles inside their topics; Grades 5–6 compare one decimal with one fraction inside Fractions. The `TOPICS` entry (no grades) keeps old history/reports labelled; an old saved selection normalises to `all`. Age 2–6 behaviour is untouched |
| `fractions` | 1–6 | `makeFractionsQuestion`: G1 numeric halves only; G2 halves, quarters and eighths (amounts, equal-part shape diagrams, equivalent halves/quarters and simple fraction comparisons); Grade 3 adds unit fractions and fractions of amounts, equal-part shape diagrams, simple equivalents and comparisons; Grade 4 includes equivalent and compared/ordered fractions, same-denominator addition/subtraction, fractions of quantities, fraction bars and simple mixed-number equivalence; Grade 5 adds equivalent and simplified fractions, compatible unlike denominators, fraction × whole number, quantities and fraction comparisons, plus **compare one decimal with one fraction**; Grade 6 adds fraction simplification, comparison, addition/subtraction with compatible denominators, multiplication/division and fractions × whole numbers. |
| `decimals` | 4–6 | Grade 4: tenths and hundredths place value, comparisons, simple addition/subtraction and fraction-to-decimal equivalences. Grade 5 adds thousandths, ordering, short addition/subtraction, decimal multiplication/division and fraction/decimal conversions. Grade 6 continues decimal calculations and adds terminating decimal-to-fraction conversion. Decimal choices are ordered numerically. |
| `percentages` | 5–6 | Grade 5 common percentages, conversions to/from simple fractions and decimals, percentages of quantities and comparisons. Grade 6 adds percentages of quantities, simple percentage increase/decrease, and fraction/decimal/percentage conversions. |
| `ratio` | 5–6 | Grade 5 simplifying and equivalent ratios, missing values and parts of a total. Grade 6 adds sharing a quantity in a ratio. |
| `probability` | 5–6 | Grade 5 simple bag, coin and die outcomes as fractions and comparisons of likelihood. Grade 6 adds sample spaces, complementary probability, probability as fractions/decimals/percentages, simple experimental probability and likelihood comparisons. |
| `algebra` | 6 | Symbolic substitution, simplifying like terms, sequence rules, and one-step/two-step linear equations. No quadratic expressions or equations. |
| `statistics` | 6 | Find the mean, median, mode and range of short lists of small whole numbers. |
| `money` | 1–4 | `makeMoneyQuestion`: coins/totals/change/price × quantity; numeric answers are in cents. Australian coins only (5c, 10c, 20c, 50c, $1, $2): never 1c or 2c. Money questions show a shared illustration above the sentence: coins use the same scale and design through `createCoins` in `game.js`, and $5/$10 payments use consistently sized, denomination-coloured banknotes. Grade 1 totals ask “How much money is there altogether?” and choices use currency labels (for example, `$1.25` or `75c`); single-coin questions ask its value. |
| `clock` | 1–4 | `makeClockQuestion`: SVG clock (`figure`); minutes on a 30 / 5 / 5 / 1 minute grid; answers `h:mm` sorted by time; includes a "hands swapped" distractor when sensible. Grade 4 duration conversions are in Shapes & measures. |
| `shapes` | 1–6 | `makeShapesQuestion`: G1 sides/corners, cube-bar measurement and picture-graph totals; G2 2D/3D identification, length/mass/capacity comparisons, visual rectangle perimeter and symmetry; G3 polygon names and 3D solids (faces/edges/vertices), rectangle perimeter, area by counting unit squares, angle recognition and metric conversion; Grade 4 distinct rectangle area and perimeter calculations, angle identification/comparison, metric conversion, duration, symmetry and shape properties; Grade 5 rectangle/composite area, perimeter, unit-cube volume, straight-line angles, metric conversion, coordinates and time calculations; Grade 6 rectangle and triangle area/perimeter, rectangular-prism volume, angle relationships, coordinate-grid points, metric conversion and simple map scale. |

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
