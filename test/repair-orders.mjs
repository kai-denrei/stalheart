import assert from 'node:assert/strict';
import { nextRepair, repairsPending, repairCost } from '../src/domain/repair-orders.js';
import { BASE_REPAIR } from '../src/content/base-programme.js';
import { BRIEFS } from '../src/isaobriefs.js';

const T = BASE_REPAIR;
const whole = { hp: 60, max: 60, broken: false };
const worn = { hp: 20, max: 60, broken: false };
const down = { hp: 0, max: 60, broken: true };
const quiet = { quiet: true, busy: false };

// the shipped tunables
assert.ok(T.gateAt > 0 && T.gateAt <= 1, 'the gate is worth a trip below a share of its hp');
assert.ok(T.gate.seconds > 0 && T.wall.seconds > 0 && T.gate.metres > 0 && T.wall.metres > 0);
assert.ok(BRIEFS[T.brief] && BRIEFS[T.brief].lines.length <= 2, "Isao's repair line exists, two lines at most");
assert.equal(BRIEFS[T.brief].once, true, 'he says it the first time only');

// ONLY WHEN QUIET: a print in the middle of a wave is Isao hovering over a lane full of bodies
assert.equal(nextRepair({ gate: down, walls: [7], quiet: false }, T), null, 'nothing while a wave is running');
assert.equal(nextRepair({ gate: down, walls: [7], quiet: true, busy: true }, T), null, "nothing while the player's order waits");
assert.deepEqual(nextRepair({ gate: down, walls: [7], ...quiet }, T), { kind: 'gate' }, 'quiet and free: he goes');

// THE GATE FIRST, then the walls in the caller's order
assert.deepEqual(nextRepair({ gate: down, walls: [4, 9], ...quiet }, T), { kind: 'gate' }, 'a broken gate outranks a hole in the wall');
assert.deepEqual(nextRepair({ gate: worn, walls: [4, 9], ...quiet }, T), { kind: 'gate' }, 'so does a worn one');
assert.deepEqual(nextRepair({ gate: whole, walls: [4, 9], ...quiet }, T), { kind: 'wall', ci: 4 }, 'a whole gate leaves the walls next');
assert.deepEqual(nextRepair({ gate: whole, walls: [9], ...quiet }, T), { kind: 'wall', ci: 9 }, 'one wall at a time, in the rim order');
assert.equal(nextRepair({ gate: whole, walls: [], ...quiet }, T), null, 'a whole base needs nothing');
assert.equal(nextRepair({ ...quiet }, T), null, 'no gate and no walls');
assert.equal(nextRepair(), null, 'no argument at all');

// a world with no gate still mends its walls
assert.deepEqual(nextRepair({ gate: null, walls: [3], ...quiet }, T), { kind: 'wall', ci: 3 });

// junk cells are skipped rather than flown to
assert.deepEqual(nextRepair({ gate: whole, walls: [-1, 2.5, 8], ...quiet }, T), { kind: 'wall', ci: 8 }, 'only real cells');

// the gate threshold is the tunable's, not a hard-coded share
{
  const barely = { hp: 59, max: 60, broken: false };
  assert.equal(nextRepair({ gate: barely, walls: [], ...quiet }, { gateAt: 0.5 }), null, 'a scratch is not worth the trip at 0.5');
  assert.deepEqual(nextRepair({ gate: barely, walls: [], ...quiet }, { gateAt: 1 }), { kind: 'gate' }, '...but it is at 1');
  assert.deepEqual(nextRepair({ gate: { hp: 0, max: 0, broken: true }, walls: [], ...quiet }, T), { kind: 'gate' }, 'a broken gate goes whatever its max');
}

// the whole queue, gate first
assert.deepEqual(repairsPending({ gate: down, walls: [4, 9] }, T), [{ kind: 'gate' }, { kind: 'wall', ci: 4 }, { kind: 'wall', ci: 9 }]);
assert.deepEqual(repairsPending({ gate: whole, walls: [] }, T), [], 'nothing pending on a whole base');
assert.deepEqual(repairsPending(), [], 'no argument at all');
// the queue's head is exactly what nextRepair picks
for (const st of [{ gate: down, walls: [4, 9] }, { gate: whole, walls: [4] }, { gate: worn, walls: [] }]) {
  assert.deepEqual(nextRepair({ ...st, ...quiet }, T), repairsPending(st, T)[0] ?? null, 'the pick is the head of the queue');
}

// what each print costs
assert.deepEqual(repairCost({ kind: 'gate' }, T), { seconds: T.gate.seconds, metres: T.gate.metres });
assert.deepEqual(repairCost({ kind: 'wall', ci: 3 }, T), { seconds: T.wall.seconds, metres: T.wall.metres });
assert.ok(repairCost({ kind: 'gate' }, T).seconds > repairCost({ kind: 'wall', ci: 1 }, T).seconds, 'the gate is the bigger print');
assert.deepEqual(repairCost({ kind: 'wall', ci: 1 }, {}), { seconds: 6, metres: 4 }, 'a missing tunable still prints something');
console.log(`Repair orders: the gate first below ${T.gateAt} of its hp, then the walls in rim order, only between waves and never ahead of the player.`);
