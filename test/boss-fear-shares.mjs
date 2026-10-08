// boss-fear-shares.mjs — the lab's fear keeps the round's seconds (src/labs/boss/fear.js): the share of live-fear time spent fleeing
// and stunned, which the count of fresh episodes cannot say (a beam always in reach is one fright for seconds). Counted only while the
// fear is live, restarted by reset, and the episode counts stay the run's record.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { createFear } from '../src/labs/boss/fear.js';

let phase = 'fight', locked = false, disturbs = 0, clock = 0;
const kit = { motion: { feeding: { get locked() { return locked; } }, disturb: () => { disturbs++; } } };
const creature = { centre: [0, 0], contacts: [[10, 0]] };
const fear = createFear({
  tune: () => T, creature: () => creature, tank: () => ({ pos: [60, 0], radius: T.hull.radius }), fight: () => ({ phase }), now: () => clock, kit: () => kit,
});
const run = (from, to, dt = 0.05) => { for (let t = from; t < to - 1e-9; t += dt) { clock = t; fear.step(t); } };
const beamPlan = { radius: T.sol.radius }, nukePlan = { kind: 'nuke', radius: T.nuke.radius };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.02, `${msg}: ${a} vs ${b}`);

assert.deepEqual(fear.counts(), { frights: 0, stuns: 0, fleeShare: 0, stunShare: 0 }, 'a calm round has no shares');

// 0 to 2 s hunting, a beam (SOL, in reach) from 2 s keeps it running to 6 s plus the after-time, then a stun from 8 s for 1.5 s
run(0, 2);
for (let t = 2; t < 6 - 1e-9; t += 0.05) { clock = t; fear.beam(beamPlan, [12, 0]); fear.step(t); }
run(6, 8);
clock = 8; fear.landed(nukePlan, [0, 0]);
run(8, 10);
const c = fear.counts();
assert.equal(c.frights, 1, 'one fright episode for the whole beam');
assert.equal(c.stuns, 1, 'one stun');
// fleeing: 2 s to 6.8 s (the beam's last frame plus fear.after), then hunting to 8; stunned 8 to 9.5
near(c.fleeShare, (6.8 - 2) / 10 * 1, 'the flee share is the seconds fleeing of the ten');
near(c.stunShare, T.nuke.stun / 10, 'the stun share is the stun of the ten');
assert.ok(c.fleeShare > 0.4 && c.fleeShare < 0.6 && disturbs >= 2, 'the shares are the time, the kit was disturbed');

// not live (a capture playing, the fight over): no seconds
locked = true; run(10, 14);
assert.deepEqual([fear.counts().fleeShare, fear.counts().stunShare], [c.fleeShare, c.stunShare], 'a locked feeding adds nothing');
locked = false; phase = 'killed'; run(14, 18);
assert.deepEqual([fear.counts().fleeShare, fear.counts().stunShare], [c.fleeShare, c.stunShare], 'a finished fight adds nothing');

// the round's reset restarts the shares, not the episodes
fear.reset(); phase = 'fight';
assert.deepEqual(fear.counts(), { frights: 1, stuns: 1, fleeShare: 0, stunShare: 0 }, 'the reset clears the shares and keeps the counts');
run(30, 31);
assert.deepEqual([fear.counts().fleeShare, fear.counts().stunShare], [0, 0], 'a hunting second is neither');

console.log('boss-fear-shares.mjs: the flee and stun shares of the round, held while not live, restarted by the reset');
