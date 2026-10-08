// boss-fight.mjs — the boss fight's rules (spec 2026-10-08-boss-fight-prototype-design.md, section 8): the strike schedule
// and its warnings, the landings' falloff, SOL's burn, the round's cards, the seeded scatter, and the balance claim that a
// creature standing in both shooters dies in about thirty seconds.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeFight, startFight, schedule, resolveLanding, burn, capture, kill, tick, readout } from '../src/domain/boss-fight.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const disc = Array.from({ length: 60 }, (_, i) => {   // 60 contacts spread evenly over a 15 m disc
  const r = 15 * Math.sqrt((i + 0.5) / 60), a = i * 2.399963;
  return [r * Math.cos(a), r * Math.sin(a)];
});
const creature = { centre: [0, 0], velocity: [0, 0], radius: 15, contacts: disc };
const far = { pos: [500, 0], radius: T.hull.radius };
const fight = () => { const s = makeFight(T); startFight(s); return s; };
const run = (s, secs) => { const plans = []; for (let i = 0; i <= secs * 60; i++) plans.push(...schedule(s, i / 60, creature, T)); return plans; };

assert.ok(Object.isFrozen(T) && Object.isFrozen(T.bofors) && Object.isFrozen(T.sol) && Object.isFrozen(T.hull), 'the content is deep-frozen');
const idle = makeFight(T);
assert.equal(idle.phase, 'idle'); assert.equal(idle.hp, T.health); assert.equal(idle.max, T.health);
assert.deepEqual(schedule(idle, 0, creature, T), [], 'no strikes before the fight starts');

// the schedule over 30 s
const s1 = fight(), plans = run(s1, 30);
const bofors = plans.filter((p) => p.kind === 'bofors'), sol = plans.filter((p) => p.kind === 'sol');
const perBurst = Math.round(T.bofors.burst * T.bofors.rate);
const expected = Math.floor(30 / (T.bofors.burst + T.bofors.rest)) * perBurst;
assert.ok(Math.abs(bofors.length - expected) <= perBurst, `bofors plans ${bofors.length} vs ${expected}`);
assert.ok(sol.length === Math.floor(30 / T.sol.every) || sol.length === Math.floor(30 / T.sol.every) + 1, `sol plans ${sol.length}`);
assert.equal(s1.strikes.length, plans.length, 'the state keeps every plan made this fight');
for (const p of bofors) {
  assert.equal(p.showAt, p.land - T.warn); assert.equal(p.fireAt, p.land - T.bofors.travel); assert.equal(p.until, p.land);
  assert.equal(p.radius, T.bofors.radius);
  assert.ok(dist(p.at, creature.centre) <= T.scatter * T.bofors.radius + 1e-9, 'a round lands within the scatter of the centre');
}
for (const p of sol) {
  assert.equal(p.showAt, p.land - T.sol.aim); assert.equal(p.until, p.land + T.sol.burn); assert.equal(p.radius, T.sol.radius);
  assert.ok(dist(p.at, creature.centre) <= T.scatter * T.sol.radius + 1e-9, 'a strike lands within the scatter of the centre');
}

// the lead: a moving creature is aimed ahead by its velocity over the time to landing
{
  const s = fight(), moving = { ...creature, velocity: [3, 0] };
  const p = schedule(s, 0, moving, T)[0], ahead = 3 * T.lead * (p.land - 0);
  assert.ok(dist(p.at, [ahead, 0]) <= T.scatter * T.bofors.radius + 1e-9, 'the aim leads the creature');
}

// the shooters' switches
{
  const s = fight(), tune = { ...T, sol: { ...T.sol, enabled: false } }, out = [];
  for (let i = 0; i <= 1800; i++) out.push(...schedule(s, i / 60, creature, tune));
  assert.ok(out.length > 0 && out.every((p) => p.kind === 'bofors'), 'SOL off: Bofors only');
  const s2 = fight(), tune2 = { ...T, bofors: { ...T.bofors, enabled: false } }, out2 = [];
  for (let i = 0; i <= 1800; i++) out2.push(...schedule(s2, i / 60, creature, tune2));
  assert.ok(out2.length > 0 && out2.every((p) => p.kind === 'sol'), 'Bofors off: SOL only');
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
  assert.ok(Math.abs(r.damage - T.sol.dps * 0.5) < 1e-12 && r.tankHit, 'SOL burns dps x dt and takes the tank in the footprint');
  assert.equal(burn(b, q, 0.5, { contacts: [[q.at[0] + q.radius + 1, q.at[1]]] }, far).damage, 0, 'nothing outside the footprint');
}

// the balance: a creature standing in both shooters
const s2 = fight(), pending = [];
let killedAt = null;
for (let i = 0; i <= 40 * 60 && killedAt === null; i++) {
  const now = i / 60, dt = 1 / 60;
  pending.push(...schedule(s2, now, creature, T));
  for (let k = pending.length - 1; k >= 0; k--) {
    const p = pending[k];
    if (p.kind === 'bofors' && p.land <= now) { resolveLanding(s2, p, creature, far); pending.splice(k, 1); }
    else if (p.kind === 'sol' && p.land <= now) { if (now < p.until) burn(s2, p, dt, creature, far); else pending.splice(k, 1); }
  }
  tick(s2, dt);
  if (s2.hp <= 0) killedAt = now;
}
assert.ok(killedAt !== null && killedAt >= 24 && killedAt <= 36, `time to kill ${killedAt}`);
const ro = readout(s2);
assert.ok(ro.hp === 0 && ro.hits > 0 && ro.hpPerSecond > 0 && Math.abs(ro.clock - killedAt - 1 / 60) < 1e-6, 'the readout');
assert.equal(readout(fight()).timeToKill, Infinity, 'no projection before any damage');
kill(s2);
assert.equal(s2.phase, 'killed');

// the round's cards
{
  const s = fight();
  capture(s, 'caught');
  assert.equal(s.phase, 'lost'); assert.equal(s.reason, 'caught');
  assert.equal(tick(s, T.card - 0.01), null, 'the card still showing');
  assert.equal(tick(s, 0.02), 'reset', 'the reset once the card expires');
  assert.equal(s.phase, 'idle'); assert.equal(s.hp, T.health); assert.equal(s.strikes.length, 0); assert.equal(s.clock, 0);
  const k = fight(); kill(k);
  assert.equal(tick(k, T.card + 0.01), 'reset', 'killed resets after the card too');
}

// the seeded scatter is repeatable
assert.deepEqual(run(fight(), 30), plans, 'two fights from one seed make identical plans');
const scattered = new Set(bofors.map((p) => p.at.join(','))).size;
assert.ok(scattered > 1, 'the rounds are scattered');

console.log(`Boss fight: ${bofors.length} Bofors and ${sol.length} SOL plans in 30 s with their warnings; landings, burn, cards and seed hold; a standing creature dies in ${killedAt.toFixed(2)} s.`);
