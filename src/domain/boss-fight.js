// The boss fight's rules (the Nih-Dairia lab's prototype): the fight state, the strike schedule and its warnings, landing
// resolution and damage, SOL's burn, the round's cards and the readout. Pure: arrays and plain objects in and out, time in
// seconds, positions in local metres on the plane [x, z]; the numbers come in as `tune` (src/content/boss-fight.js).
// Design: docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, sections 4 to 6.
//
// The scatter: plan n of a fight takes k = seed + n of the golden-angle sequence, r = scatter * radius * sqrt((k % 8 + 0.5)
// / 8) at a = k * 2.399963 rad, so eight plans fill the disc evenly and two fights from one seed make identical plans.
//
// Contracts with the lab (the caller): `now` is monotonic (the lab's own clock); the domain never ends the fight on its own:
// the lab calls `kill` when `readout(state).hp` reaches 0 and `capture` when the creature takes the tank or a landing does;
// `tankHit` is meaningful only while `phase === 'fight'` (it is computed regardless, `capture` is guarded).
//
// Imports only ./gunship.js's falloff (`splashDamage`), so a landing hurts exactly as the game's splash does.

import { splashDamage } from './gunship.js';

const GOLDEN = 2.399963, SPREAD = 8;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (contacts, at) => contacts.reduce((m, c) => Math.min(m, dist(c, at)), Infinity);

export function makeFight(tune) {
  return {
    phase: 'idle', hp: tune.health, max: tune.health, clock: 0, card: 0, cardSeconds: tune.card, reason: null,
    hits: 0, damage: 0, strikes: [], seed: Math.abs(Math.floor(tune.seed ?? 1)) || 1,
    at: null, bofors: null, sol: null, burning: null,
  };
}

// idle to fight: the clock, the health and the schedule start afresh
export function startFight(state) {
  if (state.phase !== 'idle') return;
  Object.assign(state, { phase: 'fight', hp: state.max, clock: 0, card: 0, reason: null, hits: 0, damage: 0,
    strikes: [], at: null, bofors: null, sol: null, burning: null });
}

function aim(state, creature, lead, ahead, reach) {
  const k = state.seed + state.strikes.length, r = reach * Math.sqrt(((k % SPREAD) + 0.5) / SPREAD), a = k * GOLDEN;
  const v = creature.velocity ?? [0, 0];
  return [creature.centre[0] + v[0] * lead * ahead + r * Math.cos(a), creature.centre[1] + v[1] * lead * ahead + r * Math.sin(a)];
}

// Advances the Bofors cycle { phase: 'burst' | 'rest', left, nextRound, rounds } and SOL's clock from the last call to `now`
// and returns the plans made in between, each made at its own moment t. A burst fires round(burst * rate) rounds 1 / rate
// apart from its start; SOL's first strike comes `every` seconds into the fight. A shooter switched off (`enabled: false`)
// keeps its cadence and drops its plans.
export function schedule(state, now, creature, tune) {
  if (state.phase !== 'fight') return [];
  const B = tune.bofors, S = tune.sol, made = [];
  if (state.at === null) {
    state.at = now;
    state.bofors = { phase: 'burst', left: B.burst, nextRound: 0, rounds: Math.round(B.burst * B.rate) };
    state.sol = { next: S.every };
  }
  const plan = (kind, t, p) => {
    const at = aim(state, creature, tune.lead, p.land - t, tune.scatter * p.radius);
    const one = { kind, at, ...p };
    state.strikes.push(one); made.push(one);
  };
  const boforsOn = B.enabled !== false, solOn = S.enabled !== false;
  let t = state.at;
  const c = state.bofors;
  for (;;) {
    if (c.phase === 'burst') {
      if (c.rounds > 0 && c.nextRound <= c.left && t + c.nextRound <= now) {
        t += c.nextRound; c.left -= c.nextRound; c.nextRound = 1 / B.rate; c.rounds--;
        const land = t + Math.max(tune.warn, B.travel);
        if (boforsOn) plan('bofors', t, { radius: B.radius, damage: B.damage, showAt: land - tune.warn, fireAt: land - B.travel, land, until: land });
      } else if (t + c.left <= now) {
        t += c.left; Object.assign(c, { phase: 'rest', left: B.rest, nextRound: 0, rounds: 0 });
      } else { c.left -= now - t; c.nextRound = Math.max(0, c.nextRound - (now - t)); break; }
    } else if (t + c.left <= now) {
      t += c.left; Object.assign(c, { phase: 'burst', left: B.burst, nextRound: 0, rounds: Math.round(B.burst * B.rate) });
    } else { c.left -= now - t; break; }
  }
  const sol = state.sol;
  sol.next -= now - state.at;
  while (sol.next <= 0) {
    const t0 = now + sol.next, land = t0 + S.aim;
    if (solOn) plan('sol', t0, { radius: S.radius, damage: S.dps, showAt: land - S.aim, fireAt: land, land, until: land + S.burn });
    sol.next += S.every;
  }
  state.at = now;
  return made;
}

function harm(state, dmg) {
  if (state.phase !== 'fight' || dmg <= 0) return 0;
  const dealt = Math.min(dmg, state.hp);
  state.hp -= dealt; state.damage += dealt;
  return dealt;
}

// a landing: the game's splashDamage (1 - (d / r)^2, zero outside the ring) on the nearest contact; the tank inside the ring
// plus its hull is a lost hull
export function resolveLanding(state, plan, creature, tank) {
  const damage = harm(state, splashDamage(nearest(creature.contacts, plan.at), plan.radius, plan.damage));
  if (damage > 0) state.hits++;
  return { damage, tankHit: dist(tank.pos, plan.at) < plan.radius + tank.radius };
}

// SOL's footprint for dt seconds of its burn (the caller runs it while now < plan.until): the plan's dps while any contact is
// inside the footprint; a strike that touches counts one hit
export function burn(state, plan, dt, creature, tank) {
  const damage = harm(state, nearest(creature.contacts, plan.at) < plan.radius ? plan.damage * dt : 0);
  if (damage > 0 && state.burning !== plan) { state.burning = plan; state.hits++; }
  return { damage, tankHit: dist(tank.pos, plan.at) < plan.radius + tank.radius };
}

export function capture(state, reason) {
  if (state.phase !== 'fight') return;
  Object.assign(state, { phase: 'lost', reason, card: state.cardSeconds });
}

export function kill(state) {
  if (state.phase !== 'fight') return;
  Object.assign(state, { phase: 'killed', card: state.cardSeconds });
}

// the fight's clock while fighting; the card's countdown while lost or killed, then the fight back to idle and 'reset'
export function tick(state, dt) {
  if (state.phase === 'fight') { state.clock += dt; return null; }
  if (state.phase !== 'lost' && state.phase !== 'killed') return null;
  state.card -= dt;
  if (state.card > 0) return null;
  Object.assign(state, { phase: 'idle', hp: state.max, clock: 0, card: 0, reason: null, hits: 0, damage: 0,
    strikes: [], at: null, bofors: null, sol: null, burning: null });
  return 'reset';
}

// the rate over the fight so far and the projected time to kill (Infinity before any damage)
export function readout(state) {
  const hpPerSecond = state.clock > 0 ? (state.max - state.hp) / state.clock : 0;
  return { hp: state.hp, max: state.max, clock: state.clock, hits: state.hits, hpPerSecond,
    timeToKill: hpPerSecond > 0 ? state.hp / hpPerSecond : Infinity };
}
