// boss-fight.mjs — the boss fight's rules (spec 2026-10-08-boss-fight-prototype-design.md, section 8): the strike schedule
// and its warnings, the landings' falloff, SOL's burn, the round's cards, the seeded scatter, and the balance claim that a
// creature standing in both shooters dies in about thirty seconds.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { GUNSHIP_GUNS, GUNSHIP_AUTO } from '../src/content/gunship.js';
import { makeFight, startFight, schedule, resolveLanding, burn, capture, kill, tick, readout, lineOf, aimNow } from '../src/domain/boss-fight.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the standing body's floor contacts as the lab measured them (2026-10-08, Task 5: `__bossLab.fight().contacts` with the
// instinct off, relative to the centre, in local metres): 44 nodes, six feet of seven or eight at 12.5 to 16.2 m out, none
// under the middle; the 60-point disc it replaces was denser and closer than the real body (44 s in the lab against 30.6)
const feet = [
  [-7.73, -12.8], [-6.55, -12.87], [-6.41, -12.92], [-7.8, -12.99], [-7.89, -11.84], [-6.61, -11.75], [-6.5, -11.59], [-7.86, -11.6],
  [5.93, -12.83], [7.22, -12.78], [5.94, -12.97], [7.3, -11.73], [7.31, -11.52], [6.01, -11.61], [13.65, -0.28], [13.49, -0.37],
  [14.76, -0.29], [14.77, -0.41], [-14.08, -0.37], [-12.85, -0.35], [13.47, 1], [14.79, 1.01], [-14.15, 1.04], [-12.87, 1.08],
  [-6.51, 11], [7.45, 11.04], [-7.83, 11.02], [-6.64, 11.09], [-7.77, 12.14], [-6.63, 12.32], [-6.45, 12.25], [-7.82, 12.21],
  [6, 12.24], [7.34, 12.21], [-6.54, 13.62], [8.65, 12.34], [6.1, 10.97], [7.4, 11.1], [5.99, 12.18], [7.28, 12.18],
  [-13.97, -0.24], [8.62, 13.72], [7.29, 13.65], [-15.55, -0.35],
];
const creature = { centre: [0, 0], velocity: [0, 0], radius: 15, contacts: feet };
const far = { pos: [500, 0], radius: T.hull.radius };
const harmless = (s) => resolveLanding(s, { at: [0, 0], radius: 22, damage: 4 }, { contacts: [[0, 0]] }, far).damage + burn(s, { at: [0, 0], radius: 8, damage: 10 }, 1, { contacts: [[0, 0]] }, far).damage;
const fight = () => { const s = makeFight(T); startFight(s); return s; };
const run = (s, secs, tank = far, tune = T, body = creature) => { const plans = []; for (let i = 0; i <= secs * 60; i++) plans.push(...schedule(s, i / 60, body, tune, tank)); return plans; };

assert.ok(Object.isFrozen(T) && Object.isFrozen(T.bofors) && Object.isFrozen(T.sol) && Object.isFrozen(T.hull) && Object.isFrozen(T.rotary) && Object.isFrozen(T.nuke), 'the content is deep-frozen');
// the fight's copies of the guns' numbers stay the game's (the domain takes them as `tune`, so they are copied, not imported):
// the auto pattern's burst and rest, the 40 mm's rate and travel, its blast in metres at ten a cell; the 25 mm's danger ring
// and its rounds a second times a round's damage; the MK-9's blast, travel and reload. `damage` is the fight's own knob (the
// boss's health is tuned against it), so it is free to leave the gun's
{
  const gun = GUNSHIP_GUNS.bofors, rot = GUNSHIP_GUNS.rotary, heavy = GUNSHIP_GUNS.heavy;
  assert.equal(T.bofors.burst, GUNSHIP_AUTO.burst, 'the burst is the game\'s auto pattern'); assert.equal(T.bofors.rest, GUNSHIP_AUTO.rest, 'the rest is the game\'s auto pattern');
  assert.equal(T.bofors.rate, gun.rate, 'the rate is the 40 mm\'s'); assert.equal(T.bofors.travel, gun.travel, 'the travel is the 40 mm\'s');
  assert.equal(T.bofors.radius, gun.blastCells * 10, 'the radius is the 40 mm\'s blast at ten metres a cell');
  assert.equal(T.rotary.radius, rot.dangerCells * 10, 'the rotary\'s ring is the 25 mm\'s danger ring');
  assert.ok(Math.abs(T.rotary.dps - rot.rate * rot.damage) < 1e-9, 'the rotary\'s dps is rounds a second times a round');
  assert.equal(T.nuke.radius, heavy.blastCells * 10, 'the nuke\'s ring is the MK-9\'s blast'); assert.equal(T.nuke.travel, heavy.travel, 'the nuke\'s travel is the MK-9\'s');
  assert.equal(T.nuke.every, heavy.reload, 'the nuke comes every MK-9 reload');
}
const idle = makeFight(T);
assert.equal(idle.phase, 'idle'); assert.equal(idle.hp, T.health); assert.equal(idle.max, T.health);
assert.deepEqual(schedule(idle, 0, creature, T), [], 'no strikes before the fight starts');

// the cadence over 30 s, the tank far: the rotary's burst on the even slots, the Bofors on the odd ones, the MK-9 and SOL on their clocks
const s1 = fight(), plans = run(s1, 30);
const rotary = plans.filter((p) => p.kind === 'rotary'), bofors = plans.filter((p) => p.kind === 'bofors');
const sol = plans.filter((p) => p.kind === 'sol'), nuke = plans.filter((p) => p.kind === 'nuke');
const B = T.bofors, perBurst = Math.round(B.burst * B.rate), cycle = B.burst + B.rest;
assert.equal(rotary.length, 4, `rotary bursts at 0, 8, 16, 24: ${rotary.length}`);
rotary.forEach((p, k) => {
  const t = k * 2 * cycle;
  assert.ok(Math.abs(p.land - (t + T.warn)) < 1e-9, `rotary ${k} lands at ${t + T.warn}: ${p.land}`);
  assert.ok(Math.abs(p.showAt - t) < 1e-9 && Math.abs(p.fireAt - p.land) < 1e-9 && Math.abs(p.until - (p.land + B.burst)) < 1e-9, 'the ring shows from the burst\'s start, the stream runs a burst');
  assert.equal(p.radius, T.rotary.radius); assert.equal(p.damage, T.rotary.dps); assert.equal(p.moving, true); assert.ok(!p.spares);
  assert.deepEqual(p.at, [-15.55, -0.35], 'the stream starts on the foot farthest from the tank');
});
const odd = [cycle, 3 * cycle, 5 * cycle, 7 * cycle], expected = [];
for (const b of odd) for (let j = 0; j < perBurst; j++) if (b + j / B.rate <= 30 + 1e-9) expected.push(b + j / B.rate + Math.max(T.warn, B.travel));
assert.equal(bofors.length, expected.length, `bofors plans ${bofors.length} vs ${expected.length}`);
bofors.forEach((p, i) => assert.ok(Math.abs(p.land - expected[i]) < 1e-9, `bofors ${i} lands at ${expected[i]}: ${p.land}`));
for (let i = 1; i < bofors.length; i++) {
  const gap = bofors[i].land - bofors[i - 1].land;
  // inside a burst: 1 / rate. Between bursts: the next Bofors burst starts two cycles after the last, and the last round fired
  // (perBurst - 1) / rate into its own burst
  const want = i % perBurst === 0 ? 2 * cycle - (perBurst - 1) / B.rate : 1 / B.rate;
  assert.ok(Math.abs(gap - want) < 1e-9, `bofors gap ${i}: ${gap} vs ${want}`);
}
assert.equal(nuke.length, 1, 'one MK-9 in 30 s');
assert.ok(Math.abs(nuke[0].land - (T.nuke.every + T.nuke.travel)) < 1e-9, 'the MK-9 lands every + travel in');
assert.ok(Math.abs(nuke[0].showAt - T.nuke.every) < 1e-9 && Math.abs(nuke[0].fireAt - T.nuke.every) < 1e-9 && nuke[0].until === nuke[0].land, 'the nuke\'s ring shows from the release');
assert.equal(nuke[0].radius, T.nuke.radius); assert.equal(nuke[0].damage, T.nuke.damage);
assert.equal(sol.length, 3, `sol plans ${sol.length}`);
assert.ok(Math.abs(sol[0].land - (T.sol.every + T.sol.aim)) < 1e-9, 'SOL\'s first land is every + aim');
assert.ok(Math.abs(sol[1].land - (2 * T.sol.every + T.sol.aim)) < 1e-9, 'SOL\'s second land is 2 * every + aim');
assert.equal(s1.strikes.length, plans.length, 'the state keeps every plan made this fight');
for (const p of bofors) {
  assert.equal(p.showAt, p.land - T.warn); assert.equal(p.fireAt, p.land - T.bofors.travel); assert.equal(p.until, p.land);
  assert.equal(p.radius, T.bofors.radius); assert.equal(p.damage, T.bofors.damage); assert.ok(!p.moving);
}
for (const p of sol) {
  assert.ok(Math.abs(p.land - p.showAt - T.sol.aim) < 1e-9); assert.equal(p.until, p.land + T.sol.burn); assert.equal(p.radius, T.sol.radius);
  assert.equal(T.sol.burn, 6); assert.equal(p.moving, true); assert.equal(p.spares, true); assert.equal(p.damage, T.sol.dps);
}

// the line: from the centre toward the tank, the front edge's projection
{
  assert.deepEqual(lineOf(creature, { pos: [0, 0.5], radius: 0 }).u, [0, 1], 'under a metre: the line is +z');
  assert.equal(lineOf({ centre: [0, 0], contacts: [] }, far).e, 0, 'no contacts: the front edge is the centre');
  const l = lineOf(creature, { pos: [0, 60], radius: 0 });
  assert.deepEqual(l.u, [0, 1]); assert.equal(l.e, Math.max(...feet.map((f) => f[1])));
}

// the front aim: a round lands `front` beyond the front edge, scattered across the line only
{
  const tank = { pos: [0, 60], radius: T.hull.radius }, e = lineOf(creature, tank).e;
  const out = run(fight(), 30, tank).filter((p) => p.kind === 'bofors');
  assert.ok(out.length > 0);
  for (const p of out) {
    assert.ok(Math.abs(p.at[1] - (e + T.front)) < 1e-9, `a round lands front beyond the edge: ${p.at}`);
    assert.ok(Math.abs(p.at[0]) <= T.scatter * T.bofors.radius + 1e-9, 'the scatter is across the line');
  }
  assert.ok(new Set(out.map((p) => p.at[0])).size > 1, 'the rounds are scattered');
  // the tank close in front: a round slides back along the line until it clears the ring plus the hull and the margin, or lands at the centre
  const near = { pos: [0, 30], radius: T.hull.radius }, keep = T.bofors.radius + T.hull.radius + T.margin;
  const slid = run(fight(), 30, near).filter((p) => p.kind === 'bofors');
  assert.ok(slid.length > 0 && slid.every((p) => dist(p.at, near.pos) >= keep - 1e-9 || p.at[1] === 0), 'a round clears the tank or lands at the centre');
  assert.ok(slid.some((p) => p.at[1] < e + T.front - 1), 'a round did slide back');
  const crowd = { pos: [0, 10], radius: T.hull.radius };
  assert.ok(run(fight(), 30, crowd).filter((p) => p.kind === 'bofors').every((p) => p.at[1] === 0), 'the tank at the creature: every round at the centre');
}

// the lead: a moving creature is aimed ahead by its velocity over the time to landing (Bofors, the tank far along +x)
{
  const moving = { ...creature, velocity: [3, 0] };
  const p = run(fight(), 10, far, T, moving).find((q) => q.kind === 'bofors'), ahead = 3 * T.lead * (p.land - (p.land - Math.max(T.warn, B.travel)));
  const e = lineOf(creature, far).e;
  assert.ok(Math.abs(p.at[0] - (ahead + e + T.front)) < 1e-9 && Math.abs(p.at[1]) <= T.scatter * B.radius + 1e-9, 'the aim leads the creature');
}

// the MK-9: behind the creature on the line, no tank clamp
{
  const behind = (tank) => run(fight(), 30, tank).find((p) => p.kind === 'nuke');
  const p = behind({ pos: [0, 60], radius: T.hull.radius });
  assert.ok(dist(p.at, [0, -T.behind]) < 1e-9, `the MK-9 lands behind: ${p.at}`);
  const q = behind({ pos: [0, 20], radius: T.hull.radius });
  assert.ok(dist(q.at, [0, -T.behind]) < 1e-9, 'a tank close in front does not move it');
  assert.equal(resolveLanding(fight(), q, { contacts: [] }, { pos: [0, 20], radius: T.hull.radius }).tankHit, true, 'and its ring takes the tank');
}

// aimNow: the stream and the beam re-solve each frame
{
  const stream = rotary[0];
  assert.deepEqual(aimNow(stream, creature, { pos: [100, 0], radius: 0 }, T), [-15.55, -0.35], 'the rotary takes the foot farthest from a tank at +x');
  assert.deepEqual(aimNow(stream, creature, { pos: [-100, 0], radius: 0 }, T), [14.79, 1.01], 'and the other foot once the tank crosses over');
  assert.deepEqual(aimNow(stream, { centre: [3, 4], contacts: [] }, far, T), [3, 4], 'no contacts: the centre');
  const e = lineOf(creature, { pos: [0, 60], radius: 0 }).e, beam = sol[0];
  const p = aimNow(beam, creature, { pos: [0, 60], radius: T.hull.radius }, T);
  assert.ok(dist(p, [0, e + T.front]) < 1e-9, 'SOL burns front beyond the edge');
  const hug = aimNow(beam, creature, { pos: [0, e + 12], radius: T.hull.radius }, T);
  assert.ok(dist(hug, [0, e]) < 1e-9, `with no room SOL hugs the front edge: ${hug}`);
  const tank = { pos: [0, e + 12], radius: T.hull.radius }, plan = { ...beam, at: hug };
  const r = burn(fight(), plan, 0.5, creature, tank);
  assert.equal(r.tankHit, false, 'SOL never takes the tank'); assert.ok(r.damage > 0, 'but it burns the creature at the edge');
}

// the shooters' switches: a gun off keeps its cadence and drops its plans
{
  const off = (key) => run(fight(), 30, far, { ...T, [key]: { ...T[key], enabled: false } });
  const kinds = (out) => new Set(out.map((p) => p.kind));
  assert.deepEqual([...kinds(off('sol'))].sort(), ['bofors', 'nuke', 'rotary'], 'SOL off');
  assert.deepEqual([...kinds(off('rotary'))].sort(), ['bofors', 'nuke', 'sol'], 'rotary off');
  assert.deepEqual([...kinds(off('nuke'))].sort(), ['bofors', 'rotary', 'sol'], 'nuke off');
  const b = off('bofors'); assert.deepEqual([...kinds(b)].sort(), ['nuke', 'rotary', 'sol'], 'Bofors off');
  assert.deepEqual(off('rotary').filter((p) => p.kind === 'bofors').map((p) => p.land), bofors.map((p) => p.land), 'with the rotary off the Bofors still fire on the odd slots');
  assert.deepEqual(b.filter((p) => p.kind === 'rotary').map((p) => p.land), rotary.map((p) => p.land), 'with the Bofors off the rotary keeps its slots');
}

// a landing
{
  const p = bofors[0];
  let s = fight();
  assert.equal(resolveLanding(s, p, { contacts: [p.at] }, far).damage, T.bofors.damage, 'a contact at the landing: full damage');
  assert.equal(s.hp, T.health - T.bofors.damage); assert.equal(s.hits, 1);
  s = fight();
  assert.equal(resolveLanding(s, p, { contacts: [[p.at[0] + p.radius, p.at[1]]] }, far).damage, 0, 'at the ring\'s edge: nothing');
  assert.equal(s.hp, T.health); assert.equal(s.hits, 0);
  const edge = (off) => ({ pos: [p.at[0], p.at[1] + p.radius + T.hull.radius + off], radius: T.hull.radius });
  assert.equal(resolveLanding(fight(), p, { contacts: [] }, edge(0.01)).tankHit, false, 'the tank just outside is not hit');
  assert.equal(resolveLanding(fight(), p, { contacts: [] }, edge(-1)).tankHit, true, 'the tank a metre inside is hit');
  const q = sol[0], b = fight();
  const r = burn(b, q, 0.5, { contacts: [q.at] }, { pos: q.at, radius: T.hull.radius });
  assert.ok(Math.abs(r.damage - T.sol.dps * 0.5) < 1e-12 && !r.tankHit, 'SOL burns dps x dt and spares the tank in the footprint');
  assert.equal(burn(fight(), rotary[0], 0.5, { contacts: [] }, { pos: rotary[0].at, radius: T.hull.radius }).tankHit, true, 'the stream takes a tank inside its ring');
  assert.equal(burn(b, q, 0.5, { contacts: [[q.at[0] + q.radius + 1, q.at[1]]] }, far).damage, 0, 'nothing outside the footprint');
}

// the balance: a creature held still, the tank far; every gun at its own schedule
const s2 = fight(), pending = [];
let killedAt = null;
for (let i = 0; i <= 60 * 60 && killedAt === null; i++) {
  const now = i / 60, dt = 1 / 60;
  pending.push(...schedule(s2, now, creature, T, far));
  for (let k = pending.length - 1; k >= 0; k--) {
    const p = pending[k];
    if (p.land > now) continue;
    if (p.kind === 'bofors' || p.kind === 'nuke') { resolveLanding(s2, p, creature, far); pending.splice(k, 1); }
    else if (now < p.until) { p.at = aimNow(p, creature, far, T); burn(s2, p, dt, creature, far); }
    else pending.splice(k, 1);
  }
  tick(s2, dt);
  if (s2.hp <= 0) killedAt = now;
}
// a wide guard: the final health is set from a survival run (Task 7), which tightens this bound to the measured time +- 20 %
assert.ok(killedAt !== null && killedAt >= 15 && killedAt <= 40, `time to kill ${killedAt}`);
const ro = readout(s2);
assert.ok(ro.hp === 0 && ro.hits > 0 && ro.hpPerSecond > 0 && Math.abs(ro.clock - killedAt - 1 / 60) < 1e-6, 'the readout');
assert.equal(readout(fight()).timeToKill, Infinity, 'no projection before any damage');
assert.ok(Math.abs(Object.values(ro.byKind).reduce((a, v) => a + v, 0) - s2.damage) < 1e-9, 'damage per shooter sums to the total');
assert.ok(ro.byKind.rotary > 0 && ro.byKind.bofors > 0 && ro.byKind.nuke > 0, 'the rotary, the Bofors and the MK-9 all hurt a held creature');
kill(s2);
assert.equal(s2.phase, 'killed');

// the guards
{
  const s = makeFight(T);
  assert.equal(harmless(s), 0, 'damage outside the fight phase is zero');
  assert.equal(s.hp, T.health);
  startFight(s); const strikes = s.strikes, clock = s.clock; s.hp -= 1; startFight(s);
  assert.equal(s.hp, T.health - 1, 'startFight is a no-op unless idle'); assert.equal(s.strikes, strikes); assert.equal(s.clock, clock);
  schedule(s, 0, creature, T); capture(s, 'caught');
  assert.deepEqual(schedule(s, 5, creature, T), [], 'no strikes after capture');
  assert.equal(makeFight({ ...T, seed: -3.7 }).seed, 4, 'the seed is a positive integer'); assert.equal(makeFight({ ...T, seed: 0 }).seed, 1);
}

// the round's cards
{
  const s = fight();
  capture(s, 'caught');
  assert.equal(s.phase, 'lost'); assert.equal(s.reason, 'caught');
  assert.equal(tick(s, T.card - 0.01), null, 'the card still showing');
  assert.equal(tick(s, 0.02), 'reset', 'the reset once the card expires');
  assert.equal(s.phase, 'idle'); assert.equal(s.hp, T.health); assert.equal(s.strikes.length, 0); assert.equal(s.clock, 0);
  assert.equal(s.gun, null); assert.equal(s.nuke, null); assert.deepEqual(Object.values(s.byKind), [0, 0, 0, 0], 'the reset clears the cadence and the per-shooter tally');
  const k = fight(); kill(k);
  assert.equal(tick(k, T.card + 0.01), 'reset', 'killed resets after the card too');
}

// the seeded scatter is repeatable
assert.deepEqual(run(fight(), 30), plans, 'two fights from one seed make identical plans');

console.log(`Boss fight: ${rotary.length} rotary, ${bofors.length} Bofors, ${nuke.length} MK-9 and ${sol.length} SOL plans in 30 s with their warnings; the line, the clamps, the aims, the switches, landings, burn, cards and seed hold; a held creature dies in ${killedAt.toFixed(2)} s.`);
