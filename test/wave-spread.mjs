// wave-spread.mjs — a wave's spread (src/domain/wave-spread.js): the body count of a plan, and the gap that brings a whole
// wave through in `spread` seconds but never slower than `max` a body; an empty wave divides by one, not zero.
import assert from 'node:assert/strict';
import { waveCount, waveGap } from '../src/domain/wave-spread.js';
import { computeWavePlan } from '../src/enemyspec.js';

assert.equal(waveCount([]), 0);
assert.equal(waveCount([{ type: 'a', count: 7 }, { type: 'b', count: 13 }]), 20);
assert.equal(waveGap([{ type: 'a', count: 20 }], 3.2, 0.45), 3.2 / 20, 'a big wave comes through in its spread');
assert.equal(waveGap([{ type: 'a', count: 2 }], 3.2, 0.45), 0.45, 'a small one no slower than the cap');
assert.equal(waveGap([], 3.2, 0.45), 0.45, 'nothing to send: the cap, never a division by zero');
const plan = computeWavePlan(12, 2, 1.6, 1);
assert.ok(waveGap(plan.entries, 3.2, 0.45) * (waveCount(plan.entries) - 1) < 3.2, 'the last body leaves inside the spread');
console.log('Wave spread: a plan\'s body count, and a whole wave through in its spread, never slower than the cap.');
