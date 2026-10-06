import assert from 'node:assert/strict';
import { guardExits } from '../src/domain/guard-aggro.js';
const centers = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [5, 0, 0]], guard = { c: [0, 0, 0], r: 1.5 };
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard, cur: 0, hull: null, aggro: 3 }), [1, 2], 'no hull: they keep to the nest');
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard, cur: 0, hull: [4, 0, 0], aggro: 3 }), [1, 3], 'the hull near: the exits toward it, out of the nest');
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard, cur: 0, hull: [40, 0, 0], aggro: 3 }), [1, 2], 'the hull far: home');
// A GUARD NEVER STANDS STILL (2026-10-06): stranded outside the nest after a chase, it heads home; on the nest's edge with every exit
// outside, it takes any exit rather than its own cell; only a cell with no exit at all holds it
const far = [[6, 0, 0], [5, 0, 0], [7, 0, 0], [6, 1, 0]];   // cell 0 at 6 from the nest, 1 nearer, 2 farther, 3 sideways
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers: far, guard, cur: 0, hull: null, aggro: 3 }), [1], 'stranded after a chase: the exits that bring it home');
assert.deepEqual(guardExits({ exits: [2, 3], centers: far, guard, cur: 0, hull: null, aggro: 3 }), [2, 3], 'no exit homeward: any exit, never its own cell');
assert.deepEqual(guardExits({ exits: [3], centers: [[1.4, 0, 0], [0, 0, 0], [0, 0, 0], [3, 0, 0]], guard, cur: 0, hull: null, aggro: 3 }), [3], 'on the nest\'s edge with the only exit outside: it goes, and comes back');
assert.deepEqual(guardExits({ exits: [], centers: far, guard, cur: 0, hull: null, aggro: 3 }), [0], 'no exit: its own cell');
assert.deepEqual(guardExits({ exits: [2, 3], centers: far, guard, cur: 0, hull: [6.5, 0, 0], aggro: 3 }), [2, 3], 'chasing into a dead end: it keeps moving');
console.log('guard-aggro: the nests keep home until the hull comes, then chase it, and a guard never stands still where it has an exit.');
