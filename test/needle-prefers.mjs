// The Needle takes the hard cores first (owner, 2026-10-02): the nearest solid-core body in range before the nearest soft one.
import assert from 'node:assert/strict';
import { pickTarget, TOWER_BY_KEY } from '../src/towers.js';
const dist = (a, b) => Math.abs(a - b);
const soft = { alive: true, pos: 1, spec: { rammable: true } }, hard = { alive: true, pos: 5, spec: { rammable: false } }, far = { alive: true, pos: 50, spec: { rammable: false } };
assert.equal(TOWER_BY_KEY.needle.prefers, 'hard');
assert.equal(pickTarget(0, 10, [soft, hard, far], dist, TOWER_BY_KEY.needle.prefers), hard, 'the hard core in range, though the soft body is nearer');
assert.equal(pickTarget(0, 10, [soft, far], dist, 'hard'), soft, 'no hard core in range: the nearest');
assert.equal(pickTarget(0, 10, [soft, hard], dist), soft, 'every other sentry: the nearest');
console.log('needle-prefers: the Needle shoots hard cores first, the rest shoot the nearest.');
