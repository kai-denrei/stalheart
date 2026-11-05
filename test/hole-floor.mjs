// hole-floor.mjs — THE SINKHOLE IS A HOLE (owner, 2026-11-05, round 5, note 6a: "nothing hovers over it"; src/domain/hole-floor.js): the ground's height
// under a point over the open holes is the bowl's own (src/core/sinkhole-shape.js sinkholeGroundHeight, the floor's discard and the bowl mesh's contract),
// 0 off them and over a closed one, the deepest of two, continuous into the throat (no 20-radius cliff), in the hole's own frame; the lip's wall depth
import assert from 'node:assert/strict';
import { holeFloor, holeFloorLocal, lipDepth, THROAT } from '../src/domain/hole-floor.js';
import { sinkholeGroundHeight, bowlHeight, rimRadius, SINKHOLE_INNER } from '../src/core/sinkhole-shape.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
// the bowl's own height wherever the floor is a bowl, for a hole opening and open
for (const open of [0.4, 1]) for (let k = 0; k < 400; k++) {
  const a = k * 0.37, r = (k % 97) / 97 * 1.4 * open, lx = Math.cos(a) * r, lz = Math.sin(a) * r, rr = r / (open * rimRadius(a));
  if (rr >= SINKHOLE_INNER) close(holeFloorLocal(lx, lz, open), sinkholeGroundHeight(lx, lz, open), 1e-12, `the bowl at ${rr.toFixed(2)} of the rim`);
}
assert.equal(holeFloorLocal(5, 0, 1), 0, 'off the hole'); assert.equal(holeFloorLocal(0.1, 0, 0), 0, 'a closed hole is ground');
// the throat: on down from the inner ring, continuous there, deepest at the centre, never the floor's -20 well
for (const a of [0, 1, 2.5, 4]) {
  const at = (r) => holeFloorLocal(Math.cos(a) * r * rimRadius(a), Math.sin(a) * r * rimRadius(a), 1);
  close(at(SINKHOLE_INNER - 1e-9), at(SINKHOLE_INNER + 1e-9), 1e-6, 'continuous at the inner ring');
  assert(at(0) < at(SINKHOLE_INNER / 2) && at(SINKHOLE_INNER / 2) < at(SINKHOLE_INNER), 'down the throat');
  close(at(0), bowlHeight(a, SINKHOLE_INNER) - THROAT * SINKHOLE_INNER, 1e-9, 'the centre'); assert(at(0) > -2, 'no cliff');
}
// on the sphere, in the hole's frame (its +X and +Z, s world units a local unit)
const c = [0, 0, 1], s = 0.02, hole = { c, x: [0, 1, 0], z: [-1, 0, 0], s, open: 1 }, on = (x, z) => { const p = [x * s, z * s, 1]; const l = Math.hypot(...p); return p.map((v) => v / l); };
for (const [lx, lz] of [[0.5, 0], [0, 0.6], [-0.3, -0.4], [0.05, 0.02]]) {
  // the point's local (x, z): p . X / s and p . Z / s (the axes rotate the plane: world +Y is local +X, world -X local +Z)
  const p = on(lx, lz), wx = (p[0] - c[0]) / s, wy = (p[1] - c[1]) / s, ux = wy, uz = -wx;
  close(holeFloor(p, [hole]), holeFloorLocal(ux, uz, 1) * s, 1e-9, 'the hole\'s frame');
  assert(holeFloor(p, [hole]) < 0, 'below the surface inside the rim');
}
assert.equal(holeFloor(on(3, 0), [hole]), 0, 'off the hole'); assert.equal(holeFloor(on(0.2, 0), []), 0, 'no holes, flat'); assert.equal(holeFloor(on(0.2, 0), [{ ...hole, open: 0 }]), 0, 'closed');
const near = { ...hole, c: on(0.6, 0) }; close(holeFloor(on(0.3, 0), [hole, near]), Math.min(holeFloor(on(0.3, 0), [hole]), holeFloor(on(0.3, 0), [near])), 1e-12, 'the deeper of two');
// the lip: the bowl's wall `rim` of the way to the rim at the bearing, whatever the rim's wave there
for (const a of [0, 1, 2, 3, 4, 5]) {
  const dir = [hole.x[0] * Math.cos(a) + hole.z[0] * Math.sin(a), hole.x[1] * Math.cos(a) + hole.z[1] * Math.sin(a), 0];
  const d = lipDepth([hole], c, dir, 0.95); close(d, bowlHeight(a, 0.95) * s, 1e-12, 'the wall under the lip'); assert(d < 0 && d > -0.2 * s, 'shallow, lit: not the throat\'s -0.55');
}
assert.equal(lipDepth([hole], on(9, 0), [1, 0, 0], 0.95), 0, 'no hole there');
console.log('hole-floor: the bowl\'s own depth in the hole\'s frame, 0 off and over a closed hole, the deeper of two, on down the throat with no cliff; the lip\'s wall');
