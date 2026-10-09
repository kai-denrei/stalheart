// boss-bait.mjs — the bait mode's rules (spec 2026-10-09-boss-bait-mode-design.md, Task 1): Isao's autopilot keeps its distance
// from the creature's front edge and backs off when an arm closes, his twelve hit points take the creature's falloff, a hold
// within three metres takes him, and the player's shots make the fight's own plans (the schedule's shapes, the MK-9's reload).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { BOSS_FIGHT as T_FIGHT } from '../src/content/boss-fight.js';
import { makeFight, startFight, schedule, aimNow, lineOf, resolveLanding, playerShot, holdStream } from '../src/domain/boss-fight.js';
import { makeBait, planBait, moveBait, stepBait, hurtBait, baitCaught } from '../src/domain/boss-bait.js';

// the autopilot checks below are the smooth flight of the first round: `erratic` 0; the erratic flight has its own section at the end
const T = { ...T_FIGHT, bait: { ...T_FIGHT.bait, erratic: 0 } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const feet = [[-7.7, -12.9], [-6.5, -11.7], [6, -12.9], [7.3, -11.6], [13.6, -0.3], [14.8, 1], [-14.1, -0.4], [-12.9, 1], [-6.6, 11], [7.4, 11], [-7.8, 12.2], [6, 12.2], [8.6, 13.7]];
const bodyAt = (x, z) => ({ centre: [x, z], velocity: [0, 0], radius: 15, contacts: feet.map((p) => [p[0] + x, p[1] + z]) });
const B = T.bait, E = T_FIGHT.bait, DT = 1 / 60;
const KEEP_BOUND = 3;        // metres: the keep distance holds within this over a run
const PANIC_BACK = 6;        // metres: a panic of one second leaves him at least this much farther from the arm
const EPS = 1e-9;

// the content: the bait's numbers, deep-frozen, with Isao's altitude from the game (3.4 wall-heights x 0.03 + half a cell, at 125 m a world unit)
assert.ok(Object.isFrozen(E), 'the bait content is frozen');
assert.deepEqual(Object.keys(E).sort(), ['accel', 'altitude', 'bob', 'bobPeriod', 'caught', 'caughtFor', 'erratic', 'flee', 'health', 'jink', 'jinkMax', 'jinkMin', 'keep', 'panic', 'speed', 'speedMax', 'speedMin', 'surgeMax', 'surgeMin', 'turn']);
assert.ok(Math.abs(B.altitude - (3.4 * 0.03 + 0.08 / 2) * 125) < 1e-9, `Isao's altitude is the game's 3.4 wall-heights above the surface plus half a cell, in metres: ${B.altitude}`);
assert.ok(E.erratic === 1 && E.speedMin === 8 && E.speedMax === 26 && E.accel === 30 && E.jinkMin === 0.6 && E.jinkMax === 2 && E.bob === 1.5 && Math.abs(E.jink - 40 * Math.PI / 180) < 1e-12, 'the erratic numbers: on by default, 8-26 m/s, 30 m/s2, jinks of 40 degrees (radians) every 0.6-2 s, a 1.5 m bob');
assert.ok(E.speedMin < E.speed && E.speed < E.speedMax && E.flee <= E.speedMax, 'the cruise and the flee lie inside the speed band');
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

// the erratic flight (spec 2026-10-09-boss-bait-arena-and-feel-design.md, item 3)
const hashOf = (calm) => {                   // the recorded run: two scenarios of the first round plus a panic, hashed bit for bit
  const out = [];
  for (const walk of [0, 2]) { const b = makeBait([0, 60], calm); for (let i = 0; i < 1800; i++) { stepBait(b, DT, bodyAt(walk * i * DT * 0.6, walk * i * DT * 0.8), calm); out.push(b.pos[0], b.pos[1], b.heading); } }
  const b = makeBait([0, 30], calm);
  for (let i = 0; i < 600; i++) { const body = bodyAt(0, 0); if (i > 120 && i < 300) body.contacts.push([b.pos[0] + 6, b.pos[1] - 5]); stepBait(b, DT, body, calm); out.push(b.pos[0], b.pos[1], b.heading); }
  return createHash('sha256').update(Buffer.from(new Float64Array(out).buffer)).digest('hex');
};
const RECORDED = '0e7ec4edc33f159f5623a25d10528b19a4cea5390d34bed72babc0b148e5d4f5';   // sha256 of that run, recorded on the commit before the erratic flight
assert.equal(hashOf(T), RECORDED, 'erratic 0 reproduces the smooth flight bit for bit');
const noKey = { ...T, bait: Object.fromEntries(Object.entries(B).filter(([k]) => k !== 'erratic')) };
assert.equal(hashOf(noKey), RECORDED, 'and so does a tune with no erratic key');
const wild = { ...T, bait: { ...E, erratic: 1 } };

const KEEP_MEDIAN = 4;       // metres: the median keep error with erratic 1 over 30 s
const SPEED_SLACK = 1e-6;    // m/s: frame arithmetic on a displacement
const ACCEL_SLACK = 1e-4;    // m/s2
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const median = (a) => { const v = [...a].sort((x, y) => x - y), m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const flyWild = (seed, walk, tune = wild, seconds = 30) => {
  const bait = makeBait([0, 60], tune, seed), log = { err: [], speed: [], accel: [], jinkAt: [], bob: [], jink: [], heading: [], pos: [], fleeFrames: 0, minContact: Infinity };
  let last = bait.pos.slice(), lastSpeed = null, lastTarget = null, fleeing = [false, false];
  for (let i = 0; i < seconds * 60; i++) {
    const body = bodyAt(walk * i * DT * 0.6, walk * i * DT * 0.8);
    const out = stepBait(bait, DT, body, tune);
    assert.ok(Number.isFinite(out.bob), 'stepBait returns the altitude bob too');
    const speed = dist(bait.pos, last) / DT, calm = !bait.fleeing && !fleeing[0] && !fleeing[1];
    fleeing = [bait.fleeing, fleeing[0]];
    if (bait.fleeing) log.fleeFrames++;
    if (i > 5 * 60) log.err.push(Math.abs(edgeGap(bait, body) - tune.bait.keep));
    if (calm) { log.speed.push(speed); if (lastSpeed !== null) log.accel.push(Math.abs(speed - lastSpeed) / DT); }
    lastSpeed = speed; last = bait.pos.slice();
    if (bait.flight.jinkTarget !== lastTarget) { log.jinkAt.push(i * DT); lastTarget = bait.flight.jinkTarget; }
    log.bob.push(out.bob); log.jink.push(bait.flight.jink); log.heading.push(bait.heading); log.pos.push(bait.pos[0], bait.pos[1]);
    log.minContact = Math.min(log.minContact, Math.min(...body.contacts.map((p) => dist(p, bait.pos))));
  }
  return log;
};
const medians = [], speedLow = [], speedHigh = [], accelWorst = [], gapLow = [], gapHigh = [], jinkWorst = [], bobWorst = [], jinkCount = [];
for (const walk of [0, 2]) for (const seed of SEEDS) {
  const r = flyWild(seed, walk);
  medians.push(median(r.err));
  assert.ok(median(r.err) <= KEEP_MEDIAN, `seed ${seed}${walk ? ' (walking)' : ''}: the median keep error stays within ${KEEP_MEDIAN} m: ${median(r.err).toFixed(2)}`);
  speedLow.push(Math.min(...r.speed)); speedHigh.push(Math.max(...r.speed));
  assert.ok(Math.min(...r.speed) >= E.speedMin - SPEED_SLACK && Math.max(...r.speed) <= E.speedMax + SPEED_SLACK, `seed ${seed}: speed stays in [${E.speedMin}, ${E.speedMax}] off panic: ${Math.min(...r.speed).toFixed(2)}..${Math.max(...r.speed).toFixed(2)}`);
  accelWorst.push(Math.max(...r.accel));
  assert.ok(Math.max(...r.accel) <= E.accel + ACCEL_SLACK, `seed ${seed}: |acceleration| <= ${E.accel} m/s2 off panic: ${Math.max(...r.accel).toFixed(2)}`);
  const gaps = r.jinkAt.slice(1).map((t, k) => t - r.jinkAt[k]);
  gapLow.push(Math.min(...gaps)); gapHigh.push(Math.max(...gaps)); jinkCount.push(gaps.length);
  assert.ok(Math.min(...gaps) >= E.jinkMin - DT && Math.max(...gaps) <= E.jinkMax + DT, `seed ${seed}: a new jink every ${E.jinkMin}-${E.jinkMax} s: ${Math.min(...gaps).toFixed(2)}..${Math.max(...gaps).toFixed(2)}`);
  jinkWorst.push(Math.max(...r.jink.map(Math.abs)));
  assert.ok(Math.max(...r.jink.map(Math.abs)) <= E.jink + 1e-12, `seed ${seed}: the jink stays within ${E.jink.toFixed(3)} rad`);
  bobWorst.push(Math.max(...r.bob.map(Math.abs)));
  assert.ok(Math.max(...r.bob.map(Math.abs)) <= E.bob + 1e-12 && Math.max(...r.bob.map(Math.abs)) > 0.7 * E.bob, `seed ${seed}: the bob reaches most of +-${E.bob} m and never beyond: ${Math.max(...r.bob.map(Math.abs)).toFixed(2)}`);
  assert.ok(r.minContact > E.panic - 1 || r.fleeFrames > 0, 'no arm reaches him unless he fled');
}
const swing = (a) => Math.min(...a), spread = (a) => Math.max(...a);
assert.ok(swing(speedLow) < E.speedMin + 2 && spread(speedHigh) > E.speedMax - 2, `bursts and brakes are real: speeds span ${swing(speedLow).toFixed(1)}..${spread(speedHigh).toFixed(1)} m/s`);
assert.ok(spread(accelWorst) > 0.8 * E.accel, `the acceleration limit is used (a burst or a brake takes the full ${E.accel}): ${spread(accelWorst).toFixed(1)}`);

// deterministic for a seed; seeds differ; erratic scales the swing
{
  assert.deepEqual(flyWild(3, 0).pos, flyWild(3, 0).pos, 'one seed gives one flight');
  assert.notDeepEqual(flyWild(3, 0).pos, flyWild(4, 0).pos, 'another seed flies another way');
  assert.deepEqual(flyWild(1, 0).pos, (() => { const b = makeBait([0, 60], wild); const p = []; for (let i = 0; i < 1800; i++) { stepBait(b, DT, bodyAt(0, 0), wild); p.push(b.pos[0], b.pos[1]); } return p; })(), 'the default seed is 1');
  const half = flyWild(2, 0, { ...T, bait: { ...E, erratic: 0.5 } });
  assert.ok(Math.max(...half.jink.map(Math.abs)) <= 0.5 * E.jink + 1e-12 && Math.max(...half.speed) < E.speed + 0.5 * (E.speedMax - E.speed) + SPEED_SLACK, 'erratic 0.5 halves the swing of the jink and the speed band above the cruise');
}

// panic wins: an arm inside the panic ring overrides the jink, the dash is the flee speed straight away from the arm
{
  const bait = makeBait([0, 60], wild, 5);
  for (let i = 0; i < 6 * 60; i++) stepBait(bait, DT, bodyAt(0, 0), wild);
  Object.assign(bait.flight, { jink: 0.6, jinkTarget: 0.6, jinkIn: 5 });   // a hard jink is in play when the arm comes
  const arm = [bait.pos[0] + 5, bait.pos[1] - 4], body = bodyAt(0, 0); body.contacts.push(arm);
  const before = bait.pos.slice(), away = [(before[0] - arm[0]) / dist(before, arm), (before[1] - arm[1]) / dist(before, arm)];
  stepBait(bait, DT, body, wild);
  const dx = bait.pos[0] - before[0], dz = bait.pos[1] - before[1];
  assert.ok(bait.fleeing && Math.abs(Math.hypot(dx, dz) - E.flee * DT) < 1e-9, `panic moves him ${E.flee} m/s at once`);
  assert.ok(Math.abs((dx * away[0] + dz * away[1]) / Math.hypot(dx, dz) - 1) < 1e-9, 'straight away from the arm, the jink overridden');
  for (let i = 0; i < 59; i++) stepBait(bait, DT, body, wild);
  assert.ok(dist(bait.pos, arm) > dist(before, arm) + 6, `a second of panic backs him off by at least 6 m: ${(dist(bait.pos, arm) - dist(before, arm)).toFixed(1)}`);
}

// moveBait with a routed point keeps working with the flight: it follows `want`, no faster than the band's top
{
  const bait = makeBait([0, 0], wild, 2); let far = 0;
  for (let i = 0; i < 120; i++) { const was = bait.pos.slice(); moveBait(bait, DT, [1000, 0], wild); far = Math.max(far, dist(bait.pos, was) / DT); }
  assert.ok(far <= E.speedMax + SPEED_SLACK && bait.pos[0] > 10, `routed flight stays inside the band: ${far.toFixed(1)} m/s`);
}

console.log(`Boss bait: Isao keeps ${B.keep} m within ${worst.toFixed(2)} m (bound ${KEEP_BOUND}) over 30 s and circles ${swept.toFixed(1)} rad, panic backs off, a 40 mm costs ${T.bofors.damage}, a stream dps x dt, the MK-9 ${T.nuke.damage} of his ${B.health}, a ${B.caughtFor} s hold within ${B.caught} m takes him, the player's three guns make the schedule's plans at the MK-9's reload; erratic 1 over ${SEEDS.length * 2} runs: median keep error ${median(medians).toFixed(2)} m (worst ${Math.max(...medians).toFixed(2)}, bound ${KEEP_MEDIAN}), speed ${swing(speedLow).toFixed(1)}..${spread(speedHigh).toFixed(1)} m/s in [${E.speedMin}, ${E.speedMax}], acceleration at most ${spread(accelWorst).toFixed(1)} of ${E.accel} m/s2, jink gaps ${swing(gapLow).toFixed(2)}..${spread(gapHigh).toFixed(2)} s in [${E.jinkMin}, ${E.jinkMax}], erratic 0 bit-identical to the recorded run.`);
