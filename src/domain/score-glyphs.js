// THE SCOREBOARD'S DIGITS (owner, 2026-10-02: a diegetic kill count in the base, "perhaps using the suji-galore Base16 quarter-circle
// logic"). sūji-galore's Quarter-Circle B16: one base-16 digit is four quarter-circle arcs round a centre, upper left = 1, upper right
// = 2, lower left = 4, lower right = 8; the active arcs add up, so 3 is the upper semicircle, 12 the lower one and 15 a full ring.
// Several digits nest concentrically, the units place OUTERMOST, each ring `step` smaller. Zero alone is a centre dot. Pure: the
// canvas draws what this says. Arcs are { r, from, to } in radians, counter-clockwise from +x with y up (the drawer flips y).
export const hexDigits = (n) => { n = Math.max(0, Math.floor(n)); const d = []; do { d.push(n & 15); n >>= 4; } while (n > 0); return d; };   // units first

// the four quadrants by bit: UL, UR, LL, LR, as [from, to] angles (y up)
const QUAD = [[Math.PI / 2, Math.PI], [0, Math.PI / 2], [Math.PI, 1.5 * Math.PI], [1.5 * Math.PI, 2 * Math.PI]];

export function glyphArcs(n, { radius = 1, step = 0.18 } = {}) {
  const digits = hexDigits(n);
  if (digits.length === 1 && digits[0] === 0) return { arcs: [], dot: true, rings: 1 };
  const arcs = [];
  digits.forEach((d, i) => { const r = radius - i * step * radius; for (let b = 0; b < 4; b++) if (d & (1 << b)) arcs.push({ r, from: QUAD[b][0], to: QUAD[b][1], digit: i }); });
  return { arcs, dot: false, rings: digits.length };
}

// the glyph read back: the sum over digits of 16^i times its lit bits (a test of the encoding)
export const glyphValue = (arcs) => arcs.reduce((n, a) => n + 16 ** a.digit * (1 << QUAD.findIndex((q) => q[0] === a.from && q[1] === a.to)), 0);
