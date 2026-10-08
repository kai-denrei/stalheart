// The boss fight's rules (the Nih-Dairia lab's prototype): the fight state, the strike schedule and its warnings, landing
// resolution and damage, SOL's burn, the round's cards and the readout. Pure: arrays and plain objects in and out, time in
// seconds, positions in local metres on the plane [x, z]; the numbers come in as `tune` (src/content/boss-fight.js).
// Design: docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, sections 4 to 6, and
// docs/superpowers/specs/2026-10-08-boss-fight-next-round-design.md, section 1.
//
// The four guns (the kinds of plan): the rotary's stream at the floor contact farthest from the tank, the Bofors' rounds in
// front of the creature, the MK-9 behind it, SOL's tracking beam in front. Every aim works on the line from the creature's
// centre `c` toward the tank (`lineOf`: the unit `u`, and `e` the front edge's projection on it). The Bofors' round and SOL's
// beam aim `front` beyond the front edge and slide back along the line, in half-metre steps, until their ring clears the tank
// by its hull and `margin`; a round that cannot clear lands at the centre, the beam hugs the front edge, and SOL never takes
// the tank (`spares`). The MK-9 lands `behind` the centre with no clamp. A stream and a beam are `moving` plans: the caller
// asks `aimNow` for their point each frame; the rest carry a fixed `at`.
//
// The cadence: the guns share the auto pattern's burst and rest; the first burst is the rotary's, then the gun flips after
// every rest. The MK-9 and SOL run their own clocks. A gun switched off (`enabled: false`) keeps its cadence and drops its plans.
//
// The scatter: plan n of a fight takes k = seed + n of the golden-angle sequence, a Bofors round's offset across the line is
// scatter * radius * sqrt((k % 8 + 0.5) / 8) * cos(k * 2.399963), so eight plans fill the band evenly and two fights from one
// seed make identical plans.
//
// Contracts with the lab (the caller): `now` is monotonic (the lab's own clock); the domain never ends the fight on its own:
// the lab calls `kill` when `readout(state).hp` reaches 0 and `capture` when the creature takes the tank or a landing does;
// `tankHit` is meaningful only while `phase === 'fight'` (it is computed regardless, `capture` is guarded).
//
// Imports only ./gunship.js's falloff (`splashDamage`), so a landing hurts exactly as the game's splash does.

import { splashDamage } from './gunship.js';

const GOLDEN = 2.399963, SPREAD = 8, KINDS = ['rotary', 'bofors', 'nuke', 'sol'], FAR = { pos: [1e6, 0], radius: 0 };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const nearest = (contacts, at) => contacts.reduce((m, c) => Math.min(m, dist(c, at)), Infinity);
const tally = () => Object.fromEntries(KINDS.map((k) => [k, 0]));

export function makeFight(tune) {
  return {
    phase: 'idle', hp: tune.health, max: tune.health, clock: 0, card: 0, cardSeconds: tune.card, reason: null,
    hits: 0, damage: 0, byKind: tally(), strikes: [], seed: Math.abs(Math.floor(tune.seed ?? 1)) || 1,
    at: null, gun: null, nuke: null, sol: null, burning: null,
  };
}

// idle to fight: the clock, the health and the schedule start afresh
export function startFight(state) {
  if (state.phase !== 'idle') return;
  Object.assign(state, { phase: 'fight', hp: state.max, clock: 0, card: 0, reason: null, hits: 0, damage: 0, byKind: tally(),
    strikes: [], at: null, gun: null, nuke: null, sol: null, burning: null });
}

// the line from the creature's centre toward the tank: `u` the unit (+z under a metre), `e` the front edge's projection on it
// (the largest of (contact - c) . u; 0 with no contacts)
export function lineOf(creature, tank) {
  const c = creature.centre, dx = tank.pos[0] - c[0], dz = tank.pos[1] - c[1], d = Math.hypot(dx, dz);
  const u = d < 1 ? [0, 1] : [dx / d, dz / d];
  let e = 0;
  for (const p of creature.contacts ?? []) e = Math.max(e, (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
  return { c, u, e };
}

// the point `s` metres along the line, slid back toward the centre in 0.5 m steps until it is `keep` metres from the tank;
// null when even the centre is too close
function clearAlong(c, u, s, side, tank, keep) {
  for (let k = s; k >= 0; k -= 0.5) {
    const p = [c[0] + u[0] * k + side[0], c[1] + u[1] * k + side[1]];
    if (dist(p, tank.pos) >= keep) return p;
  }
  return null;
}

// SOL's point: `front` beyond the front edge, clear of the tank; the front edge itself when there is no room
function solPoint(creature, tank, tune) {
  const { c, u, e } = lineOf(creature, tank);
  const p = clearAlong(c, u, e + tune.front, [0, 0], tank, tune.sol.radius + tank.radius + tune.margin);
  return p && (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1] >= e ? p : [c[0] + u[0] * e, c[1] + u[1] * e];
}

// the point of a `moving` plan now: the rotary's the floor contact farthest from the tank (the centre with none), SOL's the
// tracking point
export function aimNow(plan, creature, tank, tune) {
  if (plan.kind === 'sol') return solPoint(creature, tank, tune);
  let best = null, far = -1;
  for (const p of creature.contacts ?? []) { const d = dist(p, tank.pos); if (d > far) { far = d; best = p; } }
  return best ? [best[0], best[1]] : [creature.centre[0], creature.centre[1]];
}

// the Bofors' round: the line's front point, slid back to clear the tank, the golden-angle jitter across the line; the lead
// moves the centre ahead of the creature's velocity
function boforsAt(state, creature, tank, tune, ahead) {
  const B = tune.bofors, k = state.seed + state.strikes.length, v = creature.velocity ?? [0, 0];
  const j = tune.scatter * B.radius * Math.sqrt(((k % SPREAD) + 0.5) / SPREAD) * Math.cos(k * GOLDEN);
  const c = [creature.centre[0] + v[0] * tune.lead * ahead, creature.centre[1] + v[1] * tune.lead * ahead];
  const { u, e } = lineOf(creature, tank), side = [-u[1] * j, u[0] * j];
  return clearAlong(c, u, e + tune.front, side, tank, B.radius + tank.radius + tune.margin) ?? [c[0] + side[0], c[1] + side[1]];
}

// the MK-9's point: behind the centre on the line, no clamp
function nukeAt(creature, tank, tune, ahead) {
  const v = creature.velocity ?? [0, 0], { u } = lineOf(creature, tank);
  return [creature.centre[0] + v[0] * tune.lead * ahead - u[0] * tune.behind, creature.centre[1] + v[1] * tune.lead * ahead - u[1] * tune.behind];
}

// Advances the gun cycle { phase: 'burst' | 'rest', gun: 'rotary' | 'bofors', left, nextRound, rounds }, the MK-9's and SOL's
// clocks from the last call to `now` and returns the plans made in between, each made at its own moment t. A burst lasts
// `burst` and a rest `rest`; the first burst is the rotary's, the gun flips after each rest. A rotary burst makes its one
// stream plan at its start; a Bofors burst fires round(burst * rate) rounds 1 / rate apart from its start. The MK-9's first
// release and SOL's first strike come `every` seconds into the fight. `tank` ({ pos, radius }) defaults to far away.
export function schedule(state, now, creature, tune, tank = FAR) {
  if (state.phase !== 'fight') return [];
  const R = tune.rotary, B = tune.bofors, N = tune.nuke, S = tune.sol, made = [];
  const plan = (kind, p, at) => {
    const one = { kind, at, ...p };
    state.strikes.push(one); made.push(one);
  };
  const begin = (t, gun) => {
    const c = state.gun, bofors = gun === 'bofors';
    Object.assign(c, { phase: 'burst', gun, left: B.burst, nextRound: 0, rounds: bofors ? Math.round(B.burst * B.rate) : 0 });
    if (bofors || R.enabled === false) return;
    const land = t + tune.warn;
    plan('rotary', { radius: R.radius, damage: R.dps, showAt: t, fireAt: land, land, until: land + B.burst, moving: true }, aimNow({ kind: 'rotary' }, creature, tank, tune));
  };
  if (state.at === null) {
    state.at = now;
    state.gun = { phase: 'burst', gun: 'rotary', left: 0, nextRound: 0, rounds: 0 };
    state.nuke = { next: N.every };
    state.sol = { next: S.every };
    begin(now, 'rotary');
  }
  let t = state.at;
  const c = state.gun;
  for (;;) {
    if (c.phase === 'burst') {
      if (c.rounds > 0 && c.nextRound <= c.left && t + c.nextRound <= now) {
        t += c.nextRound; c.left -= c.nextRound; c.nextRound = 1 / B.rate; c.rounds--;
        const land = t + Math.max(tune.warn, B.travel);
        if (B.enabled !== false) plan('bofors', { radius: B.radius, damage: B.damage, showAt: land - tune.warn, fireAt: land - B.travel, land, until: land }, boforsAt(state, creature, tank, tune, land - t));
      } else if (t + c.left <= now) {
        t += c.left; Object.assign(c, { phase: 'rest', left: B.rest, nextRound: 0, rounds: 0 });
      } else { c.left -= now - t; c.nextRound = Math.max(0, c.nextRound - (now - t)); break; }
    } else if (t + c.left <= now) {
      t += c.left; begin(t, c.gun === 'rotary' ? 'bofors' : 'rotary');
    } else { c.left -= now - t; break; }
  }
  const nuke = state.nuke, sol = state.sol;
  nuke.next -= now - state.at; sol.next -= now - state.at;
  while (nuke.next <= 0) {
    const t0 = now + nuke.next, land = t0 + N.travel;
    if (N.enabled !== false) plan('nuke', { radius: N.radius, damage: N.damage, showAt: t0, fireAt: t0, land, until: land }, nukeAt(creature, tank, tune, land - t0));
    nuke.next += N.every;
  }
  while (sol.next <= 0) {
    const t0 = now + sol.next, land = t0 + S.aim;
    if (S.enabled !== false) plan('sol', { radius: S.radius, damage: S.dps, showAt: t0, fireAt: land, land, until: land + S.burn, moving: true, spares: true }, solPoint(creature, tank, tune));
    sol.next += S.every;
  }
  state.at = now;
  return made;
}

function harm(state, dmg, kind) {
  if (state.phase !== 'fight' || dmg <= 0) return 0;
  const dealt = Math.min(dmg, state.hp);
  state.hp -= dealt; state.damage += dealt;
  if (kind in state.byKind) state.byKind[kind] += dealt;
  return dealt;
}

// a landing: the game's splashDamage (1 - (d / r)^2, zero outside the ring) on the nearest contact; the tank inside the ring
// plus its hull is a lost hull
export function resolveLanding(state, plan, creature, tank) {
  const damage = harm(state, splashDamage(nearest(creature.contacts, plan.at), plan.radius, plan.damage), plan.kind);
  if (damage > 0) state.hits++;
  return { damage, tankHit: dist(tank.pos, plan.at) < plan.radius + tank.radius };
}

// a footprint's burn for dt seconds (SOL's, or the rotary's stream; the caller runs it between plan.land and plan.until): the
// plan's dps while any contact is inside the footprint; a plan that touches counts one hit. A plan that `spares` (SOL) never
// reports the tank hit
export function burn(state, plan, dt, creature, tank) {
  const damage = harm(state, nearest(creature.contacts, plan.at) < plan.radius ? plan.damage * dt : 0, plan.kind);
  if (damage > 0 && state.burning !== plan) { state.burning = plan; state.hits++; }
  return { damage, tankHit: !plan.spares && dist(tank.pos, plan.at) < plan.radius + tank.radius };
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
  Object.assign(state, { phase: 'idle', hp: state.max, clock: 0, card: 0, reason: null, hits: 0, damage: 0, byKind: tally(),
    strikes: [], at: null, gun: null, nuke: null, sol: null, burning: null });
  return 'reset';
}

// the rate over the fight so far and the projected time to kill (Infinity before any damage)
export function readout(state) {
  const hpPerSecond = state.clock > 0 ? (state.max - state.hp) / state.clock : 0;
  return { hp: state.hp, max: state.max, clock: state.clock, hits: state.hits, byKind: { ...state.byKind }, hpPerSecond,
    timeToKill: hpPerSecond > 0 ? state.hp / hpPerSecond : Infinity };
}
