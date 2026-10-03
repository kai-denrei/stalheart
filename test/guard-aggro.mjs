import assert from 'node:assert/strict';
import { guardExits } from '../src/domain/guard-aggro.js';
const centers = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [5, 0, 0]], guard = { c: [0, 0, 0], r: 1.5 };
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard, cur: 0, hull: null, aggro: 3 }), [1, 2], 'no hull: they keep to the nest');
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard, cur: 0, hull: [4, 0, 0], aggro: 3 }), [1, 3], 'the hull near: the exits toward it, out of the nest');
assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard, cur: 0, hull: [40, 0, 0], aggro: 3 }), [1, 2], 'the hull far: home');
console.log('guard-aggro: the nests keep home until the hull comes, then chase it.');
