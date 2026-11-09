// Test helper: answers a parent verification question from its text, so tests can unlock through the public API
// (MQParent never exposes the answer). Throws on an unknown question shape.
function solveParent(text) {
  let m = text.match(/^What is the positive value of x if x² = (\d+)\?$/);
  if (m) return String(Math.sqrt(Number(m[1])));
  m = text.match(/^A bag contains (\d+) (\w+) balls? and (\d+) (\w+) balls?\. What is the probability of picking (\w+)\?$/);
  if (m) {
    const [a, colourA, b, colourB, asked] = [Number(m[1]), m[2], Number(m[3]), m[4], m[5]];
    if (asked !== colourA && asked !== colourB) throw new Error('unknown colour in ' + text);
    return `${asked === colourA ? a : b}/${a + b}`;
  }
  throw new Error('cannot solve parent question: ' + text);
}
module.exports = { solveParent };
