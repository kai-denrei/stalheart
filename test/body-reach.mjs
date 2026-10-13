// body-reach.mjs — round two of the Pearl set (owner, 2026-10-13: "the cutis animation clips through walls, that's not good, we need a method to have their
// feeling/scouting appendage be constrained by the rocks/walls"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 2"): the pure reach
// query (src/domain/body-reach.js), the cell walk, and a Cutis swarm planning in a synthetic corridor never putting a stalk, its cup or its anchor in the rock.
import assert from 'node:assert/strict';
import { freeReach, nearestCellFrom, createReachQuery } from '../src/domain/body-reach.js';
import { CutisSwarm, STEP, REACH_MARGIN } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG } from '../src/fx/cutis-maku/config.js';
import { PEARL_TIERS } from '../src/content/pearl-enemies.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- freeReach ----
{
  const wall = (x) => x > 10;
  close(freeReach(0, 0, 1, 0, 30, 2.5, (x) => wall(x)), 10, 2.5 / 16 + 1e-9, 'the first blocked point, bisected');
  assert.equal(freeReach(0, 0, -1, 0, 30, 2.5, (x) => wall(x)), 30, 'a clear way: the whole reach');
  close(freeReach(0, 0, 3, 4, 50, 2.5, (x, z) => z > 20), 25, 2.5 / 16 + 1e-9, 'along a slanted, unnormalised direction (z = 20 at 25 m)');
  assert.equal(freeReach(0, 0, 1, 0, 0, 2.5, () => true), 0); assert.equal(freeReach(0, 0, 0, 0, 7, 2.5, () => true), 7, 'no direction: nothing to test');
  let calls = 0; freeReach(0, 0, 1, 0, 30, 2.5, () => (calls++, false)); assert.equal(calls, 12, 'sampled every step, not at the start');
  const at = []; freeReach(0, 0, 1, 0, 6.2, 2.5, (x) => (at.push(+x.toFixed(6)), false)); assert.deepEqual(at, [2.5, 5, 6.2], 'whole steps, then the end');
  // a wall thinner than the step is still found when a sample lands in it; the step is the caller's resolution
  close(freeReach(0, 0, 1, 0, 30, 2, (x) => x > 9.5 && x < 10.5), 9.5, 2 / 16 + 1e-9, 'a thin wall');
}
console.log('PASS freeReach: the first blocked distance along a direction, bisected; a clear way is the whole reach');

// ---- the cell walk, on a planar grid of cells (centres far above the origin, so directions order as distances) ----
const N = 30, SIDE = 10, H = 1e5;
const centers = [], adj = [];
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  centers.push([(c - N / 2 + 0.5) * SIDE, H, (r - N / 2 + 0.5) * SIDE]);
  const n = []; if (c > 0) n.push(r * N + c - 1); if (c < N - 1) n.push(r * N + c + 1); if (r > 0) n.push((r - 1) * N + c); if (r < N - 1) n.push((r + 1) * N + c); adj.push(n);
}
const cellAt = (x, z) => { let best = -1, bd = Infinity; centers.forEach((c, i) => { const d = (c[0] - x) ** 2 + (c[2] - z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
const toSphere = (x, z) => [x, H, z];
{
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 300; k++) {
    const x = (rnd() - 0.5) * N * SIDE * 0.98, z = (rnd() - 0.5) * N * SIDE * 0.98, start = Math.floor(rnd() * N * N);
    assert.equal(nearestCellFrom(adj, centers, start, toSphere(x, z)), cellAt(x, z), 'the walk finds the nearest cell');
  }
}
console.log('PASS nearestCellFrom: greedy descent over the graph finds the nearest cell from anywhere');

// ---- the query over the graph: a corridor of open cells (two rows, |z| < 10 m), rock either side ----
const open = new Set(); centers.forEach((c, i) => { if (Math.abs(c[2]) < 15) open.add(i); });
const blocked = (ci) => !open.has(ci);
{
  const q = createReachQuery({ adj, centers, blocked, step: 2.5 });
  const from = cellAt(0, 0);
  assert.equal(q(toSphere, 0, 0, 1, 0, 80, from), 80, 'along the corridor: clear');
  close(q(toSphere, 0, 0, 0, 1, 80, from), 10, 2.5 / 16 + 1e-9, 'across it: the rock at the cells\' boundary');
  close(q(toSphere, 0, 0, 1, 1, 80, from), 10 * Math.SQRT2, 2.5 / 16 * Math.SQRT2 + 1e-9, 'diagonally');
  assert(q.cell >= 0, 'the query keeps its last cell');
}
console.log('PASS createReachQuery: a plane direction walked over the cell graph, stopped at the first BLOCKED cell');

// ---- a swarm in the corridor: no stalk, cup or anchor in the rock, over hundreds of hops and every Pearl tier's stalk count ----
const rock = (x, z) => blocked(nearestCellFrom(adj, centers, cellAt(x, z), toSphere(x, z)));
for (const t of PEARL_TIERS) {
  const r0 = 2.2, cfg = { ...DEFAULT_CONFIG, ...t.values, r0, separation: 0.5 }, sw = new CutisSwarm(cfg, { capacity: 12 });
  sw.reachLimit = (i, x, z, dx, dz, max) => freeReach(x, z, dx, dz, max, 2.5, rock);
  for (let i = 0; i < 6; i++) { sw.setTarget(i, 120, (i - 2.5) * 4); sw.place(i, -100 + i * 6, (i - 2.5) * 3, 0); sw.pace[i] = 0.4; }
  let plans = 0, checked = 0;
  const check = (i) => {
    const k = i * 3, x = sw.offset[k], z = sw.offset[k + 2], margin = r0 * sw.scale[i] * REACH_MARGIN;
    for (const a of sw.getSeekingAnchors(i)) {
      // the stalk's whole length and its cup (the margin past its tip) on open ground
      const d = Math.hypot(a.x - x, a.z - z), ux = d > 1e-9 ? (a.x - x) / d : 0, uz = d > 1e-9 ? (a.z - z) / d : 0;
      for (let s = 0.5; s <= d + margin; s += 0.5) assert(!rock(x + ux * s, z + uz * s), `${t.id}: a stalk crosses the rock (hop ${plans}, ${s.toFixed(1)} of ${d.toFixed(1)} m)`);
      checked++;
    }
    assert(!rock(sw.anchor[k], sw.anchor[k + 2]), `${t.id}: the anchor on the rock`);
  };
  // targets that swing across the corridor: the planned heading points into the rock half the time
  for (let n = 0; n < 60 * 120; n++) {
    if (n % 240 === 0) for (let i = 0; i < 6; i++) sw.setTarget(i, sw.offset[i * 3] + 40, ((n / 240) % 2 ? 1 : -1) * 60);
    const before = Array.from(sw.cycles.slice(0, 6));
    sw.step(STEP);
    for (let i = 0; i < 6; i++) if (sw.cycles[i] !== before[i]) { plans++; check(i); }
  }
  for (let i = 0; i < 6; i++) assert(!rock(sw.offset[i * 3], sw.offset[i * 3 + 2]), `${t.id}: a body in the rock`);
  assert(plans > 40 && checked >= plans, `${t.id}: ${plans} hops checked (${checked} stalks)`);
  // turned to clear ground, the bodies still make their way along the corridor
  const gone = [0, 1, 2, 3, 4, 5].reduce((a, i) => a + sw.offset[i * 3] - (-100 + i * 6), 0) / 6;
  assert(gone > 100, `${t.id}: the bodies make their way along the corridor (${gone.toFixed(1)} m)`)
}
console.log('PASS the swarm in a corridor: every Pearl tier, hundreds of hops toward targets in the rock, no stalk, cup or anchor ever on a blocked cell, the heading turned to clear ground');
// without a reachLimit the kit is the open plane it was (the boss lab, the creature probe)
{ const sw = new CutisSwarm({ ...DEFAULT_CONFIG }, { capacity: 2 }); assert.equal(sw.reachLimit, null); }
