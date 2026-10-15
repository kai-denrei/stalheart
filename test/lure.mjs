// lure.mjs — the lure's modes by the quarry's distance, and the danger test
import assert from 'node:assert/strict';
import { lureMode, nearDanger } from '../src/domain/lure.js';
import { LURE } from '../src/content/tank.js';
assert.equal(lureMode({ quarryHops: null }), 'arena', 'no quarry: the arena');
assert.equal(lureMode({ quarryHops: -1 }), 'arena', 'an unreachable quarry: the arena');
assert.equal(lureMode({ quarryHops: 2, near: 5, far: 10 }), 'away'); assert.equal(lureMode({ quarryHops: 5, near: 5, far: 10 }), 'tangent');
assert.equal(lureMode({ quarryHops: 10, near: 5, far: 10 }), 'tangent'); assert.equal(lureMode({ quarryHops: 11, near: 5, far: 10 }), 'toward');
assert.equal(lureMode({ quarryHops: LURE.near - 1, ...LURE }), 'away'); assert.equal(lureMode({ quarryHops: LURE.far + 1, ...LURE }), 'toward');
assert.ok(LURE.near < LURE.far && LURE.blast > 0, 'the content: a band and a blast');
assert.equal(nearDanger([0, 0, 0], [[0.5, 0, 0]], 1), true); assert.equal(nearDanger([0, 0, 0], [[2, 0, 0]], 1), false);
assert.equal(nearDanger([0, 0, 0], [], 1), false); assert.equal(nearDanger([0, 0, 0], [[0, 0, 0]], 0), false); assert.equal(nearDanger([0, 0, 0], [null, [0.1, 0, 0]], 1), true);
console.log('Lure: the arena with no quarry, away under near, toward past far, the tangent between; a danger point keeps an exit off.');
