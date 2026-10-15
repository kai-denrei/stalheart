// arena.mjs — the arena's cell: reachable, outside, unblocked, the farthest band, the farthest first
import assert from 'node:assert/strict';
import { pickArenaCell } from '../src/domain/arena.js';
const dist = [0, 1, 2, 3, 4, 5, 6, 7, 8, Infinity, 9, 9];
assert.equal(pickArenaCell({ dist }), 10, 'the farthest, the lowest index among equals');
assert.equal(pickArenaCell({ dist, blocked: (i) => i === 10 }), 11, 'a blocked cell is skipped');
assert.equal(pickArenaCell({ dist, blocked: (i) => i >= 10 }), 8, 'the farthest left');
assert.equal(pickArenaCell({ dist, inside: (i) => i >= 8, farHops: 0 }), 7, 'inside the clearing is not the arena');
assert.equal(pickArenaCell({ dist: [Infinity, Infinity] }), -1, 'nothing reachable');
assert.equal(pickArenaCell({ dist: [] }), -1);
assert.equal(pickArenaCell({ dist, blocked: (i) => i === 11, farHops: 4 }), 10);
console.log('Arena: the farthest reachable cell outside the walls.');
