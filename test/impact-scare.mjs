import assert from 'node:assert/strict';
import { applyScare, awayExits, isScared, scarePace, stampScare, towardScare } from '../src/domain/impact-scare.js';
import { EXPLOSION_SCARE, EXPLOSION_USES, SCARE_FREEZE_S } from '../src/content/explosions.js';

const near = { alive: true, pos: [0, 1, 0] }, edge = { alive: true, pos: [0.05, 0.9987, 0] }, far = { alive: true, pos: [1, 0, 0] }, dead = { alive: false, pos: [0, 1, 0] };
assert.equal(applyScare([near, edge, far, dead], [0, 1, 0], { radius: 0.06, seconds: 2 }), 2, 'only live bodies inside the radius');
assert.deepEqual(near.scareFrom, [0, 1, 0]);
assert.equal(far.scareFrom, undefined);
assert.equal(dead.scareFrom, undefined, 'the dead are not scared');
assert.equal(isScared(near, 10), false, 'not running until the step stamps it');

stampScare(near, 10);
assert.equal(near.scareUntil, 12);
stampScare(near, 11);
assert.equal(near.scareUntil, 12, 'a running scare is not restarted by later steps');
stampScare(far, 10);
assert.equal(far.scareAt, undefined, 'an unscared body is left alone');

assert.equal(isScared(near, 11.9), true);
assert.equal(isScared(near, 12), false, 'the scare runs out');
assert.equal(scarePace(near, 10.1, 0.35), 0, 'frozen first');
assert.equal(scarePace(near, 10.5, 0.35), 1.35, 'then hurrying away');
assert.equal(scarePace(near, 12.5, 0.35), 1, 'then back to its pace');
assert.equal(scarePace(far, 10.1, 0.35), 1);

applyScare([near], [0, 1, 0], { radius: 0.06, seconds: 3 });
stampScare(near, 20);
assert.equal(near.scareUntil, 23, 'a new impact starts a new scare');

const centers = [[0, 1, 0], [0.1, 0.995, 0], [-0.1, 0.995, 0], [0, 0.995, 0.1]];
const blast = [0.2, 0.98, 0];
assert.equal(towardScare(centers[0], centers[1], blast), true, 'stepping toward the blast');
assert.equal(towardScare(centers[0], centers[2], blast), false);
assert.deepEqual(awayExits([1, 2, 3], centers, 0, blast), [2, 3], 'only exits leading away');
assert.deepEqual(awayExits([1], centers, 0, blast), [], 'none, and the caller keeps its own exits');

// every use that lands scares; the MK-9's ignition is the one burst in the air (300 m up), and it has no ground to scare
const AIRBORNE = new Set(['gunship.ignite']);
assert.deepEqual(Object.keys(EXPLOSION_SCARE).sort(), Object.keys(EXPLOSION_USES).filter((u) => !AIRBORNE.has(u)).sort(), 'every explosion use that lands scares');
for (const [use, s] of Object.entries(EXPLOSION_SCARE)) assert.ok(s.cells > 0 && s.seconds > SCARE_FREEZE_S, `${use}: a radius and a scare longer than the freeze`);
console.log('Impact scare: radius, stamped on the step clock, freeze then flight, turn from the blast, exits away, every use scares.');
