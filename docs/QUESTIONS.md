# Questions

All in `public/questions.js` (pure, testable in Node: `require('./public/questions.js')`).

## Public API (`MQQuestions`)
`DIFFICULTIES`, `TOPICS`, `isGrade(level)`, `gradeOf(level)`, `difficultyLabel`, `topicLabel`, `topicsFor(level)` (every level has topics), `DEFAULT_TOPIC` (`'all'`), `normaliseTopic(level, topic)` (falls back to `DEFAULT_TOPIC`), `generateQuestion(level, topic=DEFAULT_TOPIC)`, plus `shuffledCopy`, `intBetween`, `choose`.

## Question object
```js
{
  question: 'What is 7 × 8?',
  answers: ['54','55','56','57','58'],   // already ordered for display
  correct: 2,                            // index into answers (after ordering)
  simple: true,                          // optional: big centred number buttons, no A/B/C prefix (age levels)
  visual: ['🍎', …], visualLabel, rowsOfFive: true,       // optional objects in rows of 5; blank '' cells keep positions (groups, dice layouts, patterns)
  stage: { base:{emoji,name}, baseCount, op:'add'|'remove', change, added?:{emoji,name} },  // age 5/6
  resultText: '3 + 7 = 10',              // optional: replaces the question text after a correct answer
  figure: { type:'clock', hour, minute } | { type:'polygon', sides } | { type:'circle' } | { type:'rect' } | { type:'position', rel } | { type:'tally', count }   // optional SVG drawn by game.js
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
`buildQuestionBank` makes up to 500 *distinct* questions per level/topic (identity = `questionKey`: wording + figure + correct answer; capped attempts, so tiny pools simply give a smaller bank). `createQuestionDeck` deals each once in random order, then reshuffles (never stopping, never the same question twice in a row). `game.js` creates one deck per player per game, which is what resets tracking. Checked by `npm run test:norepeat`.

## Levels
Age 2–3 to Grade 1 use the topic generators below (`makeXxxQuestion(level)`); every level offers *Mixed All Questions* (default) plus its own topics. Mixed picks uniformly from the level's topics (Grade 1 counts `mixed` arithmetic twice). Grade 2–6 use `ALL_MIX_TOPICS` exactly as before.

| Topic | Offered by | Notes |
|---|---|---|
| `count` | Age 2–3, 4, 5, 6 | objects (1–5, some 6–10 at Age 2–3; ≤10 at 4–6), count on/back, before/after/between (to 10–20) |
| `match` | Age 2–3, 4 | numeral → group of objects (≤5) |
| `subitise` | Age 2–3 (≤4), 4 and 6 (≤5) | dice-style layouts; no timed flash |
| `combine` | Age 2–3 | put together/take apart, totals ≤5, object `stage` |
| `addsub`, `partition` | Age 4 (within 5, some to 10), 5, 6 | word/object stories, `a + ? = n`; Age 6 also symbolic within 10 |
| `missing` | Age 5 (within 10), Grade 1 (within 20) | `a + ? = c`, `? + b = c`, `c − ? = b`, `? − b = c` |
| `sharing` | Age 5, 6, Grade 1 | equal sharing and grouping with objects |
| `patterns` | Age 2–3 to 6 | AB (Age 2–3), AAB/ABB/ABC, instruction (“do 👏 then 🦶, repeat; 5th action?”) from Age 6 |
| `compare` | Age 2–3 to 6; Grade 1–4 | Age levels: more/fewer/same, bigger/smaller, ordering (to 10/20); Grade 1 now 0–120 |
| `sort` | Age 2–3, 4 | goes-with, odd-one-out, which group |
| `numbers`, `skip`, `place`, `word`, `groups` | Grade 1 | to 120; skip counting by 2/5/10; tens and ones/partition; word problems within 20; equal groups |
| `money` / `coins` | Grade 1 / Age 5, 6 | Australian coins only (5c–$2): recognise, order, totals, enough/change |
| `measure` | Age 2–3 to Grade 1 | length bars, size, mass, capacity, duration (Age 6+); Grade 1 informal units |
| `time` | Age 5, 6, Grade 1 | days, sequences, time of day; days/weeks/months/hours |
| `shape2d` / `shapes` | Age 2–3 to 6 / Grade 1 | named 2D shapes; sides/corners |
| `position` | Age 2–3 to Grade 1 | in/on/under/beside (SVG), left/right, between, arrows, steps along a row |
| `data` | Age 5, 6, Grade 1 | picture displays, compare categories, tally marks (SVG) |

Answers that are not numbers (emoji, names, words) are shuffled by the generator (`choiceQuestion`) so the correct position stays random. `questionKey` includes `visual` and `keyExtra` so different pictures count as different questions.

### Victorian Curriculum F–10 v2.0 alignment
Verified from the VCAA site: **VC2MFN01** (Foundation: name, represent and order numbers including zero to at least 20) and **VC2M1N01** (Level 1: numbers to at least 120). All other topics are mapped by content description only; codes were not verified and are deliberately not listed. Known gaps: no timed flash for subitising; objects shown only up to 10 (numbers to 20 are covered by numerals, not pictures); “simple instructions” are covered by repeating action sequences and row steps only; Age 2–3 picture shapes rely on read-aloud.

## Topics (Grade 1–6)
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
| `money` | 1–4 | Grade 1: `makeMoneyEarly` (see above). Grades 2–4 `makeMoneyQuestion`: coins/totals/change/price × quantity; **all answers in cents** (question says "cents") to avoid decimals |
| `clock` | 1–4 | `makeClockQuestion`: SVG clock (`figure`); minutes on a 30 / 15 / 5 / 1 minute grid; answers `h:mm` sorted by time; includes a "hands swapped" distractor when sensible |
| `shapes` | 1–6 | `makeShapesQuestion`: G1–2 sides/corners of a drawn polygon; G3 polygon names and 3D solids (faces/edges/vertices); G4 missing triangle angle, rectangle perimeter; G5 rectangle/square area; G6 triangle/parallelogram area, quadrilateral angle |

Arithmetic questions (`mixed`, `add`, `sub`, `mul`, `div`, `tables`) at Grade 4+ pass `sameLastDigit = true` to `makeQuestion`, so at least one wrong option shares the correct answer's last digit. The other topics use 4 options; arithmetic uses 5.

## Question banks
`game.js` builds 500 questions per `(level, topic)` when a game starts (`loadQuestionSet`) and reshuffles when exhausted. Repeats are possible for small domains (e.g. Age 2–3 quick look).

## Adding a topic
1. Add it to `TOPICS` with the grades and/or age levels it suits.
2. Write `makeXxxQuestion(grade)` returning `{ question, answers, correct: 0 }` using `makeNumericQuestion`, `makeFractionQuestion` or `makeQuestion` so distractors and position randomisation come for free. Use `keys` if the answers are not plain numbers but have an order.
3. Add a `case` in `generateRawQuestion`.
4. If a drawing is needed, add a `figure` type and render it in `createFigure()` in `game.js`, with CSS that reserves a fixed square (see `docs/UI-AND-LAYOUT.md`).
5. Extend `tests/questions.check.js` with an independent check that recomputes the answer from the question text (never trust the generator's own answer).
6. Update the table above and `README.md`.
