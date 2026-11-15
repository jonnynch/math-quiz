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
// The harder question used only to adjust the bank by hand: "Solve 2x² - 7x + 3 = 0. Type both ...". Returns "3, 1/2".
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function solveHard(text) {
  const m = text.match(/^(?:Solve|Find the roots of) (\d*)x²(?: ([+-]) (\d*)x)?(?: ([+-]) (\d+))? = 0/);
  if (!m) throw new Error('cannot solve hard question: ' + text);
  const A = m[1] ? Number(m[1]) : 1;
  const B = m[2] ? (m[2] === '-' ? -1 : 1) * (m[3] ? Number(m[3]) : 1) : 0;
  const C = m[4] ? (m[4] === '-' ? -1 : 1) * Number(m[5]) : 0;
  const D = B * B - 4 * A * C;
  const r = Math.round(Math.sqrt(D));
  if (r * r !== D) throw new Error('roots are not rational: ' + text);
  return [-B + r, -B - r].map(n => { const g = gcd(n, 2 * A); const d = (2 * A) / g; return d === 1 ? String(n / g) : `${n / g}/${d}`; }).join(', ');
}
module.exports = { solveParent, solveHard };
