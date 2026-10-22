// lure.mjs — the lure's modes by the quarry's distance, and the danger test
import assert from 'node:assert/strict';
import { lureMode, nearDanger, insideArena, keepInside } from '../src/domain/lure.js';
import { LURE } from '../src/content/tank.js';
assert.equal(lureMode({ quarryHops: null }), 'arena', 'no quarry: the arena');
assert.equal(lureMode({ quarryHops: -1 }), 'arena', 'an unreachable quarry: the arena');
assert.equal(lureMode({ quarryHops: 2, near: 5, far: 10 }), 'away'); assert.equal(lureMode({ quarryHops: 5, near: 5, far: 10 }), 'tangent');
assert.equal(lureMode({ quarryHops: 10, near: 5, far: 10 }), 'tangent'); assert.equal(lureMode({ quarryHops: 11, near: 5, far: 10 }), 'toward');
assert.equal(lureMode({ quarryHops: LURE.near - 1, ...LURE }), 'away'); assert.equal(lureMode({ quarryHops: LURE.far + 1, ...LURE }), 'toward');
assert.ok(LURE.near < LURE.far && LURE.blast > 0, 'the content: a band and a blast');
assert.equal(nearDanger([0, 0, 0], [[0.5, 0, 0]], 1), true); assert.equal(nearDanger([0, 0, 0], [[2, 0, 0]], 1), false);
assert.equal(nearDanger([0, 0, 0], [], 1), false); assert.equal(nearDanger([0, 0, 0], [[0, 0, 0]], 0), false); assert.equal(nearDanger([0, 0, 0], [null, [0.1, 0, 0]], 1), true);
// THE BOUND (owner, 2026-10-23, d: "it should stay in the arena"; spec 2026-10-23-arena-lab-fight-design.md, decision 2): the hull inside the disc keeps to exits inside it;
// outside it, the lure drives in (the 'arena' mode) whatever the quarry
{ const c = [0, 0, 1], u = (x, y) => { const l = Math.hypot(x, y, 1); return [x / l, y / l, 1 / l]; };
  assert.equal(insideArena(u(0.05, 0), c, 0.1), true); assert.equal(insideArena(u(0.2, 0), c, 0.1), false, 'beyond the radius');
  assert.equal(insideArena(c, c, 0.1), true, 'the centre'); assert.equal(insideArena(u(0.05, 0), null, 0.1), true, 'no disc: everywhere is inside');
  assert.equal(insideArena(u(0.05, 0), c, 0), true, 'no radius: no bound');
  const centers = [u(0.09, 0), u(0.11, 0), u(0, 0.05), u(0.3, 0)];
  assert.deepEqual(keepInside([0, 1, 2], centers, c, 0.1), [0, 2], 'the exits outside go');
  assert.deepEqual(keepInside([1, 3], centers, c, 0.1), [1, 3], 'none inside: all kept (the caller drives in)');
  assert.deepEqual(keepInside([0, 1], centers, null, 0.1), [0, 1], 'no disc: all kept');
  assert.equal(lureMode({ quarryHops: 2, near: 5, far: 10, inArena: false }), 'arena', 'outside the disc: drive in, whatever the quarry');
  assert.equal(lureMode({ quarryHops: 2, near: 5, far: 10, inArena: true }), 'away', 'inside: the kite as before'); }
console.log('Lure: the bound (inside the disc, exits kept inside, outside it the arena mode); the arena with no quarry, away under near, toward past far, the tangent between; a danger point keeps an exit off.');
