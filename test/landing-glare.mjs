// THE LANDING's glare: the exposure ramp is pure and lives apart from the WebGL path (src/fx/landing-glare.js).
import assert from 'node:assert/strict';
import { glareExposure } from '../src/fx/landing-glare.js';
import { LANDING_GAME } from '../src/content/landing-game.js';

const { dim, peak, seconds } = LANDING_GAME.override.glare;
assert.ok(Object.isFrozen(LANDING_GAME.override.glare));
assert.ok(peak < dim && seconds > 0, 'smaller is brighter: the peak is under the dim');
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const at = (u) => glareExposure(u, { dim, peak });
assert.ok(near(at(0), dim));
assert.ok(near(at(0.4), peak));
assert.ok(near(at(0.7), peak));
assert.ok(near(at(1), dim));
assert.ok(near(at(0.55), peak), 'held between 40 % and 70 %');
for (let i = 0; i < 40; i++) assert.ok(at((i + 1) / 100) < at(i / 100), `down at ${i}`);
for (let i = 70; i < 100; i++) assert.ok(at((i + 1) / 100) > at(i / 100), `up at ${i}`);
assert.ok(near(at(0.2), Math.sqrt(dim * peak)), 'log space: the midpoint is the geometric mean');
console.log('landing-glare: ok');
