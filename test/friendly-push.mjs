// friendly-push.mjs — THE HULL PUSHES THE FRIENDLIES ASIDE (owner, 2026-11-05, round 8 note 3). src/domain/friendly-push.js pushOut: a point
// inside the hull's box (grown by the pad) leaves it by the least move on each of the four sides and at a corner, a point outside is left
// alone, the caller's `free` sends it out another side, the point keeps its length; inHull is the measure.
import assert from 'node:assert/strict';
import { pushOut, inHull } from '../src/domain/friendly-push.js';

const R = 753, m = 1 / R;   // a unit sphere, 753 m to the unit; the hull at the pole facing +z
const hull = { pos: [0, 1, 0], dir: [0, 0, 1] }, box = { halfLength: 5 * m, halfWidth: 2.5 * m, pad: 0.8 * m };
const at = (x, z) => { const l = Math.hypot(x * m, 1, z * m); return [(x * m) / l, 1 / l, (z * m) / l]; };   // metres across (x) and along (z)
// the tangent frame: r = n x f = (0,1,0) x (0,0,1) = (1,0,0), so local x is world x
const local = (p) => [p[0] / p[1] * R, p[2] / p[1] * R];
const near = (a, b, eps = 0.02) => Math.abs(a - b) < eps;

assert.equal(pushOut(at(5, 0), hull, box), null, 'outside the side: left alone');
assert.equal(pushOut(at(0, 7), hull, box), null, 'outside the nose: left alone');
assert.equal(inHull(at(5, 0), hull, box), 0);
// each side: the least way out, plus the pad
{ const o = pushOut(at(2, 0), hull, box), [x, z] = local(o.pos); assert.ok(near(x, 3.3) && near(z, 0), `the right side: out to halfWidth + pad (${x.toFixed(3)}, ${z.toFixed(3)})`); assert.ok(near(o.depth * R, 1.3)); }
{ const o = pushOut(at(-1, 1), hull, box), [x, z] = local(o.pos); assert.ok(near(x, -3.3) && near(z, 1), `the left side (${x.toFixed(3)}, ${z.toFixed(3)})`); }
{ const o = pushOut(at(0.5, 4.5), hull, box), [x, z] = local(o.pos); assert.ok(near(x, 0.5) && near(z, 5.8), `the nose (${x.toFixed(3)}, ${z.toFixed(3)})`); }
{ const o = pushOut(at(-0.2, -5), hull, box), [x, z] = local(o.pos); assert.ok(near(x, -0.2) && near(z, -5.8), `the tail (${x.toFixed(3)}, ${z.toFixed(3)})`); }
// a corner: out of the box (no axis left inside), by no more than the shorter side's way
{ const p = at(3, 5.5), o = pushOut(p, hull, box); assert.ok(o && o.depth * R <= 0.31, `the corner: a short way out (${(o?.depth * R).toFixed(3)} m)`); assert.equal(pushOut(o.pos, hull, box), null, 'and clear after it'); }
// every push leaves the point clear, on the sphere
for (const [x, z] of [[0, 0], [1, -3], [-2.9, 5.2], [3.2, -5.7], [0.01, 0.01]]) {
  const o = pushOut(at(x, z), hull, box); assert.ok(o, `inside at (${x}, ${z})`);
  assert.ok(Math.abs(Math.hypot(...o.pos) - 1) < 1e-12, 'the point keeps its length');
  assert.ok(inHull(o.pos, hull, box) < 1e-9 * R, `clear after the push from (${x}, ${z})`);
}
assert.ok(near(inHull(at(2, 0), hull, box) * R, 1.3), 'inHull: the depth to the nearest side');
// the heading turns the box: facing +x, a point 2 m to the +x side is in its nose
{ const o = pushOut(at(4, 0), { pos: [0, 1, 0], dir: [1, 0, 0] }, box), [x, z] = local(o.pos); assert.ok(near(x, 5.8) && near(z, 0), `the box turns with the heading (${x.toFixed(3)}, ${z.toFixed(3)})`); }
// free(p) refuses the least way: the next shortest side that is free
{ const free = (p) => local(p)[0] < 0, o = pushOut(at(2, 0), hull, { ...box, free }), [x, z] = local(o.pos); assert.ok(near(x, 2) && (near(z, 5.8) || near(z, -5.8)) || near(x, -3.3), `another side (${x.toFixed(3)}, ${z.toFixed(3)})`); assert.equal(pushOut(o.pos, hull, box), null); }
{ const o = pushOut(at(2, 0), hull, { ...box, free: () => false }), [x] = local(o.pos); assert.ok(near(x, 3.3), 'nothing free: the least move stands'); }
// no hull or no heading: nothing
assert.equal(pushOut(at(0, 0), null, box), null);
assert.equal(pushOut(at(0, 0), { pos: [0, 1, 0], dir: [0, 1, 0] }, box), null, 'a heading straight up is no heading');
console.log('friendly-push: four sides, a corner, clear after every push, the heading turns the box, free() picks another side');
