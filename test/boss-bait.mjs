// boss-bait.mjs — the bait mode's rules (spec 2026-10-09-boss-bait-mode-design.md, Task 1): Isao's autopilot keeps its distance
// from the creature's front edge and backs off when an arm closes, his twelve hit points take the creature's falloff, a hold
// within three metres takes him, and the player's shots make the fight's own plans (the schedule's shapes, the MK-9's reload).
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeFight, startFight, schedule, aimNow, lineOf, resolveLanding, playerShot, holdStream } from '../src/domain/boss-fight.js';
import { makeBait, planBait, moveBait, stepBait, hurtBait, baitCaught } from '../src/domain/boss-bait.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const feet = [[-7.7, -12.9], [-6.5, -11.7], [6, -12.9], [7.3, -11.6], [13.6, -0.3], [14.8, 1], [-14.1, -0.4], [-12.9, 1], [-6.6, 11], [7.4, 11], [-7.8, 12.2], [6, 12.2], [8.6, 13.7]];
const bodyAt = (x, z) => ({ centre: [x, z], velocity: [0, 0], radius: 15, contacts: feet.map((p) => [p[0] + x, p[1] + z]) });
const B = T.bait, DT = 1 / 60;
const KEEP_BOUND = 3;        // metres: the keep distance holds within this over a run
const PANIC_BACK = 6;        // metres: a panic of one second leaves him at least this much farther from the arm
const EPS = 1e-9;

// the content: the bait's numbers, deep-frozen, with Isao's altitude from the game (3.4 wall-heights x 0.03 + half a cell, at 125 m a world unit)
assert.ok(Object.isFrozen(B), 'the bait content is frozen');
assert.deepEqual(Object.keys(B).sort(), ['altitude', 'caught', 'caughtFor', 'flee', 'health', 'keep', 'panic', 'speed', 'turn']);
assert.ok(Math.abs(B.altitude - (3.4 * 0.03 + 0.08 / 2) * 125) < 1e-9, `Isao's altitude is the game's 3.4 wall-heights above the surface plus half a cell, in metres: ${B.altitude}`);
assert.ok(B.keep > B.panic, 'the keep distance is outside the panic ring');

// the autopilot: 30 s round a static creature and round a walking one, the front edge toward him stays `keep` away within KEEP_BOUND
const edgeGap = (bait, body) => { const { c, u, e } = lineOf(body, bait); return (bait.pos[0] - c[0]) * u[0] + (bait.pos[1] - c[1]) * u[1] - e; };
let worst = 0, swept = 0, minContact = Infinity, previous = null;
for (const walk of [0, 2]) {
  const bait = makeBait([0, 60], T), start = Math.atan2(bait.pos[1], bait.pos[0]);
  let turned = 0, last = start;
  for (let i = 0; i < 30 * 60; i++) {
    const body = bodyAt(walk * i * DT * 0.6, walk * i * DT * 0.8);
    const out = stepBait(bait, DT, body, T);
    assert.ok(Array.isArray(out.want) && Number.isFinite(out.heading), 'stepBait returns { want, heading }');
    if (i > 5 * 60) worst = Math.max(worst, Math.abs(edgeGap(bait, body) - B.keep));
    minContact = Math.min(minContact, Math.min(...body.contacts.map((p) => dist(p, bait.pos))));
    const a = Math.atan2(bait.pos[1] - body.centre[1], bait.pos[0] - body.centre[0]); let d = a - last; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; turned += d; last = a;
  }
  if (!walk) swept = turned;
}
assert.ok(worst < KEEP_BOUND, `the keep distance holds within ${KEEP_BOUND} m over 30 s: worst error ${worst.toFixed(2)} m`);
assert.ok(swept > 1, `he circles the creature counter-clockwise (the angle grows): ${swept.toFixed(2)} rad in 30 s`);
assert.ok(minContact > B.panic, `no contact ever comes inside the panic ring on a clear run: ${minContact.toFixed(1)} m`);

// the stepper is deterministic
{ const run = () => { const b = makeBait([10, 50], T); for (let i = 0; i < 600; i++) stepBait(b, DT, bodyAt(0, 0), T); return [b.pos, b.heading]; };
  assert.deepEqual(run(), run(), 'two runs from one start are identical'); }

// panic: an arm within `panic` makes him back straight off at `flee`, faster than he cruises
{
  const bait = makeBait([0, 30], T), body = bodyAt(0, 0);
  body.contacts.push([0, 30 - (B.panic - 2)]);          // an arm reaches out to ten metres from him
  const before = dist(bait.pos, [0, 30 - (B.panic - 2)]);
  const arm = [0, 30 - (B.panic - 2)], want = planBait(bait, body, T), x0 = bait.pos.slice();
  assert.ok(bait.fleeing, 'an arm inside the panic ring sets him fleeing');
  assert.ok(dist(want, arm) > before, 'the wanted point is farther from the arm');
  moveBait(bait, DT, want, T);
  assert.ok(Math.abs(dist(bait.pos, x0) - B.flee * DT) < EPS && dist(bait.pos, arm) > before, `a frame of panic moves him ${B.flee} m/s straight away from the arm: ${dist(bait.pos, x0)}`);
  assert.ok(B.flee > B.speed, 'he flees faster than he cruises');
  for (let i = 1; i < 60; i++) moveBait(bait, DT, planBait(bait, body, T), T);
  assert.ok(dist(bait.pos, arm) - before >= PANIC_BACK, `a second of panic backs him off by at least ${PANIC_BACK} m: ${(dist(bait.pos, arm) - before).toFixed(1)}`);
  const calm = makeBait([0, 60], T); planBait(calm, bodyAt(0, 0), T); assert.ok(!calm.fleeing, 'far from every arm he is not fleeing');
  // routing: the lab may replace `want`; moveBait follows what it is given, at the cruise speed
  const routed = makeBait([0, 60], T); moveBait(routed, 1, [60, 60], T);
  assert.ok(Math.abs(dist(routed.pos, [0, 60]) - B.speed) < EPS && routed.pos[1] === 60, `moveBait follows the given point at ${B.speed} m/s: ${routed.pos}`);
  const near = makeBait([0, 0], T); moveBait(near, 1, [1, 0], T); assert.deepEqual(near.pos, [1, 0], 'he stops on a point nearer than a step');
  // the heading eases at `turn` rad/s: a quarter turn needs more than a frame
  const turn = makeBait([0, 0], T); turn.heading = 0; moveBait(turn, DT, [0, 100], T);
  assert.ok(Math.abs(turn.heading - B.turn * DT) < EPS, `the heading eases ${B.turn} rad/s: ${turn.heading}`);
}

// his health: the creature's falloff on his distance to the landing; the 40 mm direct costs 4, a stream dps x dt, the MK-9 kills
const gun = (kind, at) => { const s = makeFight(T); startFight(s); return playerShot(s, kind, at, 0, T); };
{
  const bait = makeBait([0, 0], T);
  assert.equal(bait.hp, B.health); assert.equal(bait.max, B.health);
  const hit = hurtBait(bait, gun('bofors', [0, 0]), 0, T);
  assert.ok(Math.abs(hit - T.bofors.damage) < EPS && Math.abs(bait.hp - (B.health - T.bofors.damage)) < EPS, `a direct 40 mm costs ${T.bofors.damage}: ${hit}`);
  const half = makeBait([T.bofors.radius / 2, 0], T), edge = hurtBait(half, gun('bofors', [0, 0]), 0, T);
  assert.ok(Math.abs(edge - T.bofors.damage * 0.75) < EPS, `at half the ring the falloff leaves three quarters: ${edge}`);
  assert.equal(hurtBait(makeBait([T.bofors.radius + 1, 0], T), gun('bofors', [0, 0]), 0, T), 0, 'outside the ring costs nothing');
  const stream = makeBait([3, 0], T), cost = hurtBait(stream, gun('rotary', [0, 0]), 0.5, T);
  assert.ok(Math.abs(cost - T.rotary.dps * 0.5) < EPS && Math.abs(stream.hp - (B.health - cost)) < EPS, `a stream costs dps x dt inside its ring: ${cost}`);
  assert.equal(hurtBait(makeBait([T.rotary.radius + 0.5, 0], T), gun('rotary', [0, 0]), 1, T), 0, 'outside the stream\'s ring costs nothing');
  const doomed = makeBait([0, 0], T), dealt = hurtBait(doomed, gun('nuke', [0, 0]), 0, T);
  assert.equal(doomed.hp, 0, 'the MK-9 kills him'); assert.ok(dealt >= B.health && dealt === T.nuke.damage, `the MK-9 deals its ${T.nuke.damage}: ${dealt}`);
  hurtBait(doomed, gun('nuke', [0, 0]), 0, T); assert.equal(doomed.hp, 0, 'his health does not go below zero');
}

// caught: a contact within `caught` metres for `caughtFor` seconds takes him; not before; stepping away resets the hold
{
  const body = bodyAt(0, 0), c = body.contacts[0], bait = makeBait([c[0] + B.caught - 0.5, c[1]], T);
  let got = false, t = 0;
  while (t < B.caughtFor - 2 * DT) { got = baitCaught(bait, body, DT, T); t += DT; }
  assert.ok(!got, `not caught before ${B.caughtFor} s (${t.toFixed(2)} s held)`);
  for (let i = 0; i < 4 && !got; i++) got = baitCaught(bait, body, DT, T);
  assert.ok(got, `caught once ${B.caughtFor} s have passed`);
  const brief = makeBait([c[0] + B.caught - 0.5, c[1]], T);
  for (let i = 0; i < 20; i++) baitCaught(brief, body, DT, T);
  brief.pos = [c[0] + 2 * B.caught, c[1] - 40]; baitCaught(brief, body, DT, T);
  brief.pos = [c[0] + B.caught - 0.5, c[1]];
  for (let i = 0; i < 20; i++) assert.ok(!baitCaught(brief, body, DT, T), 'a hold that was broken starts over');
  const outside = makeBait([c[0] + B.caught + 0.5, c[1]], T); let any = false;
  for (let i = 0; i < 120; i++) any = baitCaught(outside, body, DT, T) || any;
  assert.ok(!any || body.contacts.some((p) => dist(p, outside.pos) < B.caught), 'beyond three metres of every contact he is never caught');
}

// the player's shots make the schedule's shapes (the same fields and numbers) and the fight's strikes keep them
const sched = (() => { const s = makeFight(T); startFight(s); const plans = []; for (let i = 0; i <= 30 * 60; i++) plans.push(...schedule(s, i / 60, bodyAt(0, 0), T)); return plans; })();
const keys = (p) => Object.keys(p).filter((k) => k !== 'player').sort().join();
const first = (kind) => sched.find((p) => p.kind === kind);
{
  const s = makeFight(T); startFight(s);
  const round = playerShot(s, 'bofors', [3, 4], 5, T);
  assert.equal(keys(round), keys(first('bofors')), 'a 40 mm round has the schedule\'s fields');
  assert.deepEqual([round.kind, round.at, round.radius, round.damage], ['bofors', [3, 4], T.bofors.radius, T.bofors.damage]);
  assert.deepEqual([round.showAt, round.fireAt, round.land, round.until], [5, 5, 5 + T.bofors.travel, 5 + T.bofors.travel], 'the ring is the round\'s flight');
  assert.ok(!round.moving && round.player === true, 'a round is fixed and the player\'s');
  assert.equal(s.strikes.at(-1), round, 'the plan is pushed to the fight\'s strikes');
  assert.equal(playerShot(s, 'bofors', [3, 4], 5 + 1 / T.bofors.rate - 0.01, T), null, 'the 40 mm cools to its rate');
  assert.ok(playerShot(s, 'bofors', [3, 4], 5 + 1 / T.bofors.rate, T), 'and fires again when the rate has passed');
  assert.equal(s.strikes.length, 2);
  assert.ok(resolveLanding(s, round, bodyAt(3, 4), { pos: [500, 0], radius: 0 }).damage > 0, 'the fight resolves the player\'s round like its own');

  const bomb = playerShot(s, 'nuke', [0, -15], 7, T);
  assert.equal(keys(bomb), keys(first('nuke')), 'an MK-9 has the schedule\'s fields');
  assert.deepEqual([bomb.kind, bomb.radius, bomb.damage, bomb.showAt, bomb.fireAt, bomb.land, bomb.until], ['nuke', T.nuke.radius, T.nuke.damage, 7, 7, 7 + T.nuke.travel, 7 + T.nuke.travel]);
  assert.equal(playerShot(s, 'nuke', [0, 0], 7 + T.nuke.every - 0.01, T), null, 'the MK-9 waits for its reload');
  assert.ok(playerShot(s, 'nuke', [0, 0], 7 + T.nuke.every, T), 'and drops again when it has passed');

  const stream = playerShot(s, 'rotary', [1, 2], 9, T);
  assert.equal(keys(stream), keys(first('rotary')), 'a stream has the schedule\'s fields');
  assert.deepEqual([stream.kind, stream.radius, stream.damage, stream.moving, stream.player, stream.showAt, stream.fireAt, stream.land, stream.until], ['rotary', T.rotary.radius, T.rotary.dps, true, true, 9, 9, 9, 9.1]);
  assert.deepEqual(aimNow(stream, bodyAt(0, 0), { pos: [500, 0], radius: 0 }, T), [1, 2], 'a player\'s stream is not re-aimed: aimNow returns its point');
  assert.equal(playerShot(s, 'rotary', [1, 2], 9.05, T), null, 'a stream still alive is held, not doubled');
  holdStream(stream, 9.05); assert.ok(Math.abs(stream.until - 9.15) < EPS, 'holdStream extends the stream 0.1 s past now');
  const next = playerShot(s, 'rotary', [5, 5], 9.5, T);
  assert.ok(next && next !== stream && next.land === 9.5, 'after it lapses a new press starts a new stream');
  assert.equal(playerShot(s, 'plasma', [0, 0], 10, T), null, 'an unknown gun makes nothing');
  assert.equal(playerShot(makeFight(T), 'bofors', [0, 0], 0, T), null, 'nothing before the fight starts');
}

console.log(`Boss bait: Isao keeps ${B.keep} m within ${worst.toFixed(2)} m (bound ${KEEP_BOUND}) over 30 s and circles ${swept.toFixed(1)} rad, panic backs off, a 40 mm costs ${T.bofors.damage}, a stream dps x dt, the MK-9 ${T.nuke.damage} of his ${B.health}, a ${B.caughtFor} s hold within ${B.caught} m takes him, the player's three guns make the schedule's plans at the MK-9's reload.`);
