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
assert.deepEqual(guardExits({ exits: [2, 3], centers: far, guard, cur: 0, hull: null, aggro: 3 }), [0], 'no exit homeward and no trail: it stands (never a wanderer)');
// THE WAY BACK: a chase out of the nest leaves a trail, and the hull gone the guard walks it back cell by cell
{ const g = { c: [0, 0, 0], r: 1.5 }, cs = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0], [4, 0, 0]], adj = { 0: [1], 1: [0, 2], 2: [1, 3], 3: [2, 4], 4: [3] };
  const step = (cur, hull) => guardExits({ exits: adj[cur], centers: cs, guard: g, cur, hull, aggro: 3 });
  assert.deepEqual(step(0, [4, 0, 0]), [1]); assert.deepEqual(step(1, [4, 0, 0]), [2]); assert.deepEqual(step(2, [4, 0, 0]), [3], 'the chase out, toward the hull');
  assert.deepEqual(g.trail, [1, 2], 'the cells walked out of the nest, in order');
  assert.deepEqual(step(3, null), [2]); assert.deepEqual(step(2, null), [1], 'the hull gone: the trail back'); assert.deepEqual(step(1, null), [0], 'home: the nest\'s own exits'); assert.deepEqual(g.trail, [], 'the trail spent'); }
assert.deepEqual(guardExits({ exits: [3], centers: [[1.4, 0, 0], [0, 0, 0], [0, 0, 0], [3, 0, 0]], guard, cur: 0, hull: null, aggro: 3 }), [0], 'on the nest\'s edge with the only exit outside (a pocket): it stands, in sight of the nest');
assert.deepEqual(guardExits({ exits: [], centers: far, guard, cur: 0, hull: null, aggro: 3 }), [0], 'no exit: its own cell');
assert.deepEqual(guardExits({ exits: [2, 3], centers: far, guard, cur: 0, hull: [6.5, 0, 0], aggro: 3 }), [0], 'chasing into a dead end with no trail: it holds there');
assert.deepEqual(guardExits({ exits: [2, 3], centers: far, guard: { ...guard, trail: [5, 3] }, cur: 0, hull: [6.5, 0, 0], aggro: 3 }), [3], 'with a trail: back along it (the trail cut to the neighbour)');
console.log('guard-aggro: the nests keep home until the hull comes, then chase it, and a guard never stands still where it has an exit.');
// NEVER UNDER THE LANDER (2026-10-07): a cell the base calls solid is struck off the exits, unless every exit is
{ const g = { c: [0, 0, 0], r: 1.5, avoid: (p) => p[0] < 0 };
  assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard: g, cur: 0, hull: null, aggro: 3 }), [1], 'the cell under the lander is not an exit');
  assert.deepEqual(guardExits({ exits: [2], centers, guard: g, cur: 0, hull: null, aggro: 3 }), [2], 'unless it is the only one');
  assert.deepEqual(guardExits({ exits: [1, 2, 3], centers, guard: g, cur: 0, hull: [-4, 0, 0], aggro: 3 }), [1], 'nor a way to chase the hull: it keeps to the nest\'s open cells');
}
