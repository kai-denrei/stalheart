import assert from 'node:assert/strict';
import { huntersDue, huntExits } from '../src/domain/hunters.js';
import { HUNTERS, CREATURE_TIERS } from '../src/content/creature-enemies.js';
import { ENEMY_SPEC } from '../src/enemyspec.js';

// THE HUNTERS (owner, 2026-10-15): a few Reeds hunting the tank from sector HUNTERS.from, every HUNTERS.every-th pulse of a breach
const tune = { from: 5, every: 3, count: 1, alive: 2 };
assert.equal(huntersDue({ n: 4, pulse: 3, alive: 0 }, tune), 0, 'not before the sector');
assert.equal(huntersDue({ n: 5, pulse: 1, alive: 0 }, tune), 0, 'not on the first pulse');
assert.equal(huntersDue({ n: 5, pulse: 3, alive: 0 }, tune), 1, 'the third pulse sends one');
assert.equal(huntersDue({ n: 9, pulse: 6, alive: 1 }, tune), 1, 'the sixth too, one more while under the cap');
assert.equal(huntersDue({ n: 9, pulse: 6, alive: 2 }, tune), 0, 'none over the cap');
assert.equal(huntersDue({ n: 9, pulse: 6, alive: 0 }, { ...tune, count: 3 }), 2, 'count held to what the cap allows');
assert.equal(huntersDue({ n: 9, pulse: 6, alive: 0 }, { ...tune, count: 0 }), 0, 'count 0: off');
assert.equal(huntersDue({ n: 9, pulse: 6, alive: 0 }, null), 0);

const hunt = [3, 2, 2, 1, 0, -1];
assert.deepEqual(huntExits([1, 2, 5], hunt, 0), [1, 2], 'the exits nearer the tank');
assert.deepEqual(huntExits([3, 4], hunt, 1), [3, 4], 'both nearer');
assert.deepEqual(huntExits([0, 5], hunt, 1), [0, 5], 'none nearer: every exit (the walk\'s own rule)');
assert.deepEqual(huntExits([3], hunt, 4), [3], 'at the tank\'s cell: every exit');
assert.deepEqual(huntExits([3], hunt, 5), [3], 'unreachable: every exit');
assert.deepEqual(huntExits([3], null, 1), [3], 'no field: every exit');

// the table names a tier that exists, cored (the tank cannot ram it) and small
assert.ok(CREATURE_TIERS[HUNTERS.family]?.[HUNTERS.tier], 'the hunters\' tier exists');
assert.equal(ENEMY_SPEC[HUNTERS.family].rammable, false, 'non rammable');
assert.ok(HUNTERS.from >= 2 && HUNTERS.every >= 1 && HUNTERS.alive >= HUNTERS.count, 'a handful, once in a while');
console.log('Hunters: due from the sector on every n-th pulse under a cap; a hunter takes the exits nearer the tank.');
