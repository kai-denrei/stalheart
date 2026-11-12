// THE TANK'S GROUND (src/domain/drive-ground.js): the free drive's first tests, in the tank's order, shared with the Yushi Rover (2026-11-12)
import assert from 'node:assert/strict';
import { groundBlock, driveBlock } from '../src/domain/drive-ground.js';

const w = { rock: (ci) => ci === 1, container: (ci) => ci === 2, breach: (p) => p[0] === 3, pedestal: (p) => p[0] >= 3, solid: (p, pad) => (p[1] + pad >= 5 ? 'dome-a' : null), unit: (p) => p[2] === 9 };
assert.equal(groundBlock([0, 0, 0], -1, w), 'off');
assert.equal(groundBlock([0, 0, 0], 1, w), 'rock');
assert.equal(groundBlock([0, 0, 0], 2, w), 'container');
assert.equal(groundBlock([3, 0, 0], 0, w), 'breach', 'a sinkhole on the pad is named the sinkhole (the tank\'s hullWhy)');
assert.equal(groundBlock([4, 0, 0], 0, w), 'pedestal');
assert.equal(groundBlock([0, 9, 9], 0, w), '', 'the buildings and the units are not the ground\'s');
assert.equal(driveBlock([0, 0, 0], 0, w), '');
assert.equal(driveBlock([0, 5, 0], 0, w), 'solid dome-a');
assert.equal(driveBlock([0, 4, 0], 0, w), '');
assert.equal(driveBlock([0, 4, 0], 0, w, 1), 'solid dome-a', 'the pad reaches out');
assert.equal(driveBlock([0, 0, 9], 0, w), 'unit');
assert.equal(driveBlock([0, 9, 0], 1, w), 'rock', 'the ground first');
assert.equal(driveBlock([0, 0, 0], 0, { rock: () => false }), '', 'a test left out never blocks');
console.log('Drive ground: off, rock, container, breach, pedestal; then solid (padded) and unit.');
