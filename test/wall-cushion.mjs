// wall-cushion.mjs — the wall cushion (src/domain/wall-cushion.js, moved out of src/td-tab.js in refactor round 4): a hull inside a
// rock's margin is nudged away from it, by at most 3.5% of a cell a frame; opposing rocks net to nothing; a narrow cell (three open
// neighbours or fewer) uses the tighter margin and skips the diagonals; the pedestal's rim and an open crater push radially; the nose
// and the tail feel the rock at the hull's ends; off the board nothing moves; breachBlocked reads the craters with the pad.
import assert from 'node:assert/strict';
import { dist3, norm3 } from '../src/vec3.js';
import { wallCushion, breachBlocked, CRATER_PAD } from '../src/domain/wall-cushion.js';

// a 5 x 5 patch of cells near the pole [0,0,1], one cell per 0.01 along x and y (cellSide 0.01); cell (i, j) -> index i * 5 + j
const N = 5, S = 0.01, centers = [], adj = [], at = (i, j) => i * N + j;
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { centers.push(norm3([(i - 2) * S, (j - 2) * S, 1])); adj.push([]); }
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && a < N && b >= 0 && b < N) adj[at(i, j)].push(at(a, b)); }
const cellIndex = (p) => { let best = -1, bd = Infinity; centers.forEach((c, k) => { const d = dist3(p, c); if (d < bd) { bd = d; best = k; } }); return bd < S * 0.75 ? best : -1; };
const world = (tags, over = {}) => ({
  cellIndex, graph: { centers, adj }, dungeon: { tags, heart: at(4, 4) }, blocked: 0, cellSide: S,
  openCount: (ci) => adj[ci].filter((nb) => tags[nb] !== 0).length,
  craters: [], pedestalRadius: 0, unitScale: 0.004, smoothDir: [1, 0, 0], ...over,
});
const open = () => new Int8Array(N * N).fill(1);
const near = (a, b, eps = 1e-12) => dist3(a, b) < eps;

console.log('the cushion:');
{
  const w = world(open());
  const p = centers[at(2, 2)];
  assert.ok(near(wallCushion(p, w), p), 'no rock about: the point stands');
  assert.ok(near(wallCushion([0, 0.3, 1], w), [0, 0.3, 1]), 'off the board: nothing moves');
}
{
  const tags = open(); tags[at(3, 2)] = 0;   // a rock to +x of the centre cell
  const w = world(tags), rock = centers[at(3, 2)];
  const p = norm3([0.004, 0, 1]);   // 0.006 from the rock: inside the 0.95-cell margin
  const q = wallCushion(p, w);
  assert.ok(dist3(q, rock) > dist3(p, rock), 'pushed away from the rock');
  assert.ok(dist3(p, q) <= S * 0.035 + 1e-12, 'by at most 3.5% of a cell a frame');
  assert.ok(Math.abs(q[1]) < 1e-9, 'straight away from it');
  const far = norm3([-0.0035, 0, 1]);   // 0.0135 from the rock: outside the margin, no diagonal rock either
  assert.ok(near(wallCushion(far, w), far), 'outside the margin the rock is not felt');
}
{
  const tags = open(); tags[at(3, 2)] = 0; tags[at(1, 2)] = 0;   // rocks either side
  const w = world(tags), p = centers[at(2, 2)];
  assert.ok(near(wallCushion(p, w), p, 1e-9), 'opposing rocks net to nothing: the hull centres');
}
{
  // a corridor: the row j=2 open, everything else rock, so the centre cell has two open neighbours (narrow: the 0.6 margin, no diagonals)
  const tags = new Int8Array(N * N); for (let i = 0; i < N; i++) tags[at(i, 2)] = 1;
  const w = world(tags), p = norm3([0, 0.0045, 1]);   // 0.0055 from the rock above, inside 0.6 cells
  const q = wallCushion(p, w);
  assert.ok(q[1] < p[1], 'the corridor wall above pushes the hull down the lane');
  const p2 = norm3([0, 0.003, 1]);   // 0.007 from the rock above: outside the narrow margin (0.006), inside the wide one
  assert.ok(near(wallCushion(p2, w), p2, 1e-9), 'narrow cells use the tighter margin');
}
{
  const tags = open(); tags[at(3, 3)] = 0;   // a rock on the diagonal only
  const w = world(tags), p = norm3([0.004, 0.004, 1]);   // 0.85 cells from the diagonal rock: inside the wide margin, nearest the centre cell
  const q = wallCushion(p, w);
  assert.ok(dist3(q, centers[at(3, 3)]) > dist3(p, centers[at(3, 3)]), 'an open cell feels its diagonal rock');
}
console.log('the pedestal and the craters:');
{
  const w = world(open(), { pedestalRadius: S * 1.2 });
  const p = norm3([0.015, 0.015, 1]), heart = centers[at(4, 4)];   // inside rim = 1.2 + 0.35 cells of the heart at (4,4)
  const q = wallCushion(p, w);
  assert.ok(dist3(q, heart) > S * 1.5 && dist3(q, heart) > dist3(p, heart), 'pushed out to the pedestal rim at once (the chord a hair under the rim once back on the sphere)');
}
{
  const crater = { p: centers[at(2, 2)], r: 0.5 };
  const w = world(open(), { craters: [crater] });
  const p = norm3([0.006, 0, 1]);
  const q = wallCushion(p, w);
  assert.ok(dist3(q, crater.p) >= (0.5 + CRATER_PAD) * S - 1e-4 && dist3(q, crater.p) > dist3(p, crater.p), 'pushed off the crater rim, pad included');
  assert.equal(breachBlocked(p, [crater], S), true, 'on the crater: blocked');
  assert.equal(breachBlocked(norm3([0.012, 0, 1]), [crater], S), false, 'past the pad: free');
  assert.equal(breachBlocked(norm3([0.012, 0, 1]), [crater], S, 1.0), true, 'a wider pad reaches it');
}
console.log('the nose and the tail:');
{
  const tags = open(); tags[at(3, 2)] = 0;
  const w = world(tags, { unitScale: 0.008, smoothDir: [1, 0, 0] });   // half = 0.00584: the nose reaches into the rock cell at +x
  const p = norm3([-0.0025, 0, 1]);   // the centre 0.0125 from the rock: beyond the centre's margin; only the nose feels it
  const q = wallCushion(p, w);
  assert.ok(q[0] < p[0], 'the nose in the rock pushes the hull back');
  const w2 = world(tags, { unitScale: 0.008, smoothDir: [0, 1, 0] });
  assert.ok(near(wallCushion(p, w2), p, 1e-9), 'turned along the wall, neither end touches it');
}
console.log('Wall cushion: the nudge and its cap, opposing rocks, the narrow margin, the diagonal, the pedestal, the crater, the nose and the tail.');
