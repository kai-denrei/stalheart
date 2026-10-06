import assert from 'node:assert/strict';
import { makeStuck, stepStuck, unstick } from '../src/domain/hull-stuck.js';
import { HULL_STUCK } from '../src/content/tank.js';

const st = makeStuck(), tune = HULL_STUCK;
assert.equal(stepStuck(st, { driving: true, moved: 1, expected: 1, dt: 0.1 }, tune), 0, 'a hull that moves is not stuck');
let k = 0; for (let t = 0; t < tune.after - 0.05; t += 0.05) k = stepStuck(st, { driving: true, moved: 0, expected: 0.1, dt: 0.05 }, tune);
assert.equal(k, 0, 'no correction before the wait');
for (let t = 0; t < tune.ramp + 0.2 + (tune.span ?? 0); t += 0.05) k = stepStuck(st, { driving: true, moved: 0, expected: 0.1, dt: 0.05 }, tune);
assert.equal(k, 1, 'full correction after the ramp');
for (let t = 0; t < (tune.span ?? 0) + 0.1; t += 0.05) k = stepStuck(st, { driving: true, moved: 0.1, expected: 0.1, dt: 0.05 }, tune);
assert.equal(k, 0, 'moving again lets go, within a window');
assert.equal(stepStuck(makeStuck(), { driving: false, moved: 0, expected: 0, dt: 1 }, tune), 0, 'not driving is not stuck');
// ROCKING IS STUCK (2026-10-06): a step forward one frame and a creep back the next, judged over the window, goes nowhere
{ const r = makeStuck(); let k = 0, f = 0; for (let t = 0; t < tune.after + tune.ramp + 0.3; t += 1 / 60) k = stepStuck(r, { driving: true, moved: (f++ % 2 ? 0.1 : -0.1), expected: 0.1, dt: 1 / 60 }, tune); assert.equal(k, 1, 'a hull rocking in place (a step on, a creep back) is fully corrected'); }
{ const r = makeStuck(); let k = 0; for (let t = 0; t < 1; t += 1 / 60) k = stepStuck(r, { driving: true, moved: 0.1, expected: 0.1, dt: 1 / 60 }, tune); assert.equal(k, 0, 'a hull driving on is never corrected'); }
const pos = [0, 0, 1], home = [Math.sin(0.01), 0, Math.cos(0.01)];
const p = unstick(pos, home, 0.004);
assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-9 && p[0] > 0 && p[0] < home[0], 'eased toward home along the sphere, not past it');
assert.deepEqual(unstick(pos, pos, 0.1), pos, 'at home: nothing');
console.log('Hull stuck: driving that goes nowhere eases the hull to its cell centre after a wait, and lets go when it moves.');
