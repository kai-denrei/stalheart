import assert from 'node:assert/strict';
import { makeDriveRamp, rampMultiplier, stepDriveRamp, scrubDriveRamp } from '../src/domain/drive-ramp.js';
import { TANK_DRIVE } from '../src/content/tank.js';
const T = TANK_DRIVE;
assert.ok(T.base > 1 && T.top > T.base, 'faster than the old pace at once, and faster still with a run-up');
assert.equal(rampMultiplier(0, T), T.base);
// it keeps ramping for a while: every second of the first several still adds pace, and it never passes top
let r = makeDriveRamp(), last = stepDriveRamp(r, 0, 1, false, T);
for (let s = 1; s <= Math.round(T.tau * 2); s++) { let m = 0; for (let k = 0; k < 60; k++) m = stepDriveRamp(r, 1 / 60, 1, false, T); assert.ok(m > last, `still gaining at ${s} s`); last = m; }
for (let k = 0; k < 6000; k++) last = stepDriveRamp(r, 1 / 60, 1, false, T);
assert.ok(last <= T.top + 1e-9 && last > T.top * 0.97, `settles at top (${last})`);
// a head-on wall spends it all, a graze keeps a share, steering and stopping bleed it
const full = r.t; scrubDriveRamp(r, 0.2, T); assert.ok(r.t < full && r.t > 0, 'a graze keeps some');
scrubDriveRamp(r, 1, T); assert.ok(r.t < full * T.keep + 1e-9, 'head-on spends the run-up down to its keep');
r = { t: 5 }; stepDriveRamp(r, 1, 1, true, T); assert.ok(r.t < 6, 'steering hard gains less');
r = { t: 5 }; assert.equal(stepDriveRamp(r, 1, 0, false, T), T.base); assert.ok(r.t < 5, 'idle bleeds');
r = { t: 5 }; assert.equal(stepDriveRamp(r, 1, -0.55, false, T), T.base, 'reverse never ramps');
console.log(`Drive ramp: x${T.base} at once, x${rampMultiplier(T.tau, T).toFixed(2)} after ${T.tau} s, toward x${T.top}.`);
