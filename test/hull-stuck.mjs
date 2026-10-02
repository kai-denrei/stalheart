import assert from 'node:assert/strict';
import { makeStuck, stepStuck, unstick } from '../src/domain/hull-stuck.js';
import { HULL_STUCK } from '../src/content/tank.js';

const st = makeStuck(), tune = HULL_STUCK;
assert.equal(stepStuck(st, { driving: true, moved: 1, expected: 1, dt: 0.1 }, tune), 0, 'a hull that moves is not stuck');
let k = 0; for (let t = 0; t < tune.after - 0.05; t += 0.05) k = stepStuck(st, { driving: true, moved: 0, expected: 0.1, dt: 0.05 }, tune);
assert.equal(k, 0, 'no correction before the wait');
for (let t = 0; t < tune.ramp + 0.2; t += 0.05) k = stepStuck(st, { driving: true, moved: 0, expected: 0.1, dt: 0.05 }, tune);
assert.equal(k, 1, 'full correction after the ramp');
assert.equal(stepStuck(st, { driving: true, moved: 0.1, expected: 0.1, dt: 0.05 }, tune), 0, 'moving again lets go');
assert.equal(stepStuck(makeStuck(), { driving: false, moved: 0, expected: 0, dt: 1 }, tune), 0, 'not driving is not stuck');
const pos = [0, 0, 1], home = [Math.sin(0.01), 0, Math.cos(0.01)];
const p = unstick(pos, home, 0.004);
assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-9 && p[0] > 0 && p[0] < home[0], 'eased toward home along the sphere, not past it');
assert.deepEqual(unstick(pos, pos, 0.1), pos, 'at home: nothing');
console.log('Hull stuck: driving that goes nowhere eases the hull to its cell centre after a wait, and lets go when it moves.');
