// The boss lab's bait mode: Isao the drone flies on autopilot as the creature's prey while the player fires the gunship
// (docs/superpowers/specs/2026-10-09-boss-bait-mode-design.md, Task 1). Pure: arrays and plain objects in and out, time in seconds,
// positions in local metres on the plane [x, z]; the numbers come in as `tune` (src/content/boss-fight.js, `tune.bait`).
//
// The autopilot: Isao keeps `keep` metres outside the creature's front edge toward himself (`lineOf`'s `e`, from his side) and
// circles it counter-clockwise (the angle atan2(z, x) round the centre grows) at `speed`, backing straight off at `flee` while
// any floor contact is within `panic`. The planner (`planBait`) names the point he wants, the mover (`moveBait`) takes him there,
// so the lab can route the point round obstacles in between; `stepBait` is the two in a row. His heading eases at `turn` rad/s
// toward the way he moves. With `bait.erratic` above 0 the mover flies the erratic flight (below); at 0 it is the smooth flight above,
// bit for bit. His health takes the creature's falloff (`hurtBait`); a hold within `caught` of a contact takes him.
//
// The erratic flight (docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, item 3), `erratic` E in 0..1 scaling every
// swing: his speed target is redrawn every `surgeMin`..`surgeMax` s from the band between the cruise and speedMin/speedMax (E of the
// way), and his speed slews to it at no more than `accel` m/s2, so he bursts and brakes; his course is turned off the wanted point by
// a jink, redrawn every `jinkMin`..`jinkMax` s within +-`jink` x E and eased at `turn`; his altitude bobs +-`bob` x E (the lab adds
// the returned `bob` to his altitude). Everything is drawn from a seeded sequence kept in `bait.flight` (makeBait's third argument,
// default 1), so a seed flies one way. The planner's keep distance stays the anchor: the jink bends the course, the radial pull still
// closes the error. Panic wins: while any arm is inside `panic` he dashes straight away at `flee`, the jink dropped and the
// acceleration limit waived, and the speed he leaves the dash at is slewed back down at `accel`.
//
// THE FLY-OVER (owner, 2026-10-09: "Isao gets stuck between an invisible wall (the boundaries) and the creature too often. once in a while have Isao
// fly OVER it"). `hopBait` runs before the autopilot each frame: he is trapped while
// the bound (`bound`, the lab's arena disc) is within `trapBound` metres of him and a floor contact within `trapNear` lies on the inside (toward the
// bound's centre from him); trapped for `trapFor` seconds, or on a seeded chance of `hopChance` a second while he is not panicking, he hops. The hop:
// he climbs on the spot at `hopClimb` m/s to `hopAlt` metres, crosses at `hopSpeed` to the creature's far side (the point `keep` beyond its edge
// opposite where he started, round its centre as it moves now, held `inset` inside the bound), at most `hopCross` seconds, and comes down at
// `hopClimb` to the altitude he flies at (`base`); no panic and no jink on the way. The next hop waits `hopCooldown` seconds after the landing. The
// hold that takes him (`baitCaught`) does not count while the hop has him above `reachHeight`. The chance has its own seeded sequence
// (`bait.hopRng`), so the erratic flight's draws are the same with or without hops. The far point is held `trapBound` farther inside the bound than the
// wanted point's inset, so he does not land trapped again.
// UNDER THE CREATURE (owner, 2026-10-09: "Isao gets stuck too easily under the creature"): his panic backs him off the nearest contact, which under the
// body swings from side to side and he dithers. `underBait` says he is under it: his ground point within `underCore` of its half-width from its centre,
// or two floor contacts within `underNear` of him more than 120 degrees apart round him. Then he escapes at once (`why` 'under', the cooldown and the
// chance ignored, panicking or not): he climbs and flies out together, through the near side (from the centre through him, toward the bound's centre
// when he is on the centre), to `keep` beyond the edge there, and comes down.
//
// Imports only the domain: ./gunship.js's falloff (`splashDamage`) and the fight's `lineOf`.

import { splashDamage } from './gunship.js';
import { lineOf } from './boss-fight.js';

const AHEAD = 0.5;         // seconds of travel round the circle the wanted point leads him by
const PULL = 3;            // metres of radial pull per metre the keep distance is out
const RADIAL_MAX = 24;     // ...at most this many
const FLEE_STEP = 10;      // metres the wanted point sits beyond him while he backs off
const ARRIVE = 2;          // metres from the far point at which the hop's cross ends
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// a small seeded generator (mulberry32): `flight.rng` is its 32-bit state; each draw is a number in [0, 1)
function draw(flight) {
  flight.rng = (flight.rng + 0x6D2B79F5) >>> 0;
  let t = flight.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// `seed` picks the erratic flight's sequence (an integer; default 1). The flight state is kept even at erratic 0, where it is unused
export function makeBait(at, tune, seed = 1) {
  const B = tune.bait, flight = { rng: seed >>> 0, t: 0, speed: B.speed, speedTarget: B.speed, surgeIn: 0, jink: 0, jinkTarget: 0, jinkIn: 0, phase: [0, 0] };
  flight.phase = [draw(flight) * 2 * Math.PI, draw(flight) * 2 * Math.PI];
  // the fly-over's state: the hop in progress ({ phase, why, dir, alt, t, cross }) or null, the hops so far, the seconds trapped, the cooldown left
  const hops = { hop: null, hops: 0, trapT: 0, hopWait: 0, hopRng: { rng: Math.imul(seed >>> 0, 0x9E3779B1) >>> 0 } };
  return { pos: [at[0], at[1]], heading: 0, hp: B.health, max: B.health, fleeing: false, held: 0, flight, ...hops };
}

// the nearest floor contact to a point (null and Infinity with none)
function nearestOf(contacts, at) {
  let best = null, far = Infinity;
  for (const p of contacts ?? []) { const d = dist(p, at); if (d < far) { far = d; best = p; } }
  return { at: best, d: far };
}

// the point he wants now: the one `keep` metres outside the front edge, a short way ahead round the circle; or, with an arm inside
// `panic`, a point straight away from it. Sets `bait.fleeing` for `moveBait` (the cruise or the flee speed)
export function planBait(bait, creature, tune) {
  const B = tune.bait, near = nearestOf(creature.contacts, bait.pos);
  bait.fleeing = near.d < B.panic;
  if (bait.fleeing) {
    const away = near.d < 1e-6 ? [0, 1] : [(bait.pos[0] - near.at[0]) / near.d, (bait.pos[1] - near.at[1]) / near.d];
    return [bait.pos[0] + away[0] * FLEE_STEP, bait.pos[1] + away[1] * FLEE_STEP];
  }
  const c = creature.centre, here = lineOf(creature, bait), rho = Math.hypot(bait.pos[0] - c[0], bait.pos[1] - c[1]);
  const lead = B.speed * AHEAD, err = here.e + B.keep - rho, radial = Math.max(-RADIAL_MAX, Math.min(RADIAL_MAX, err * PULL));
  // counter-clockwise: the tangent is the unit rotated a quarter turn the way the angle grows; the radial pull closes the keep error
  return [bait.pos[0] - here.u[1] * lead + here.u[0] * radial, bait.pos[1] + here.u[0] * lead + here.u[1] * radial];
}

// moves him toward `want` for dt seconds at the cruise or the flee speed (stopping on a point nearer than a step) and eases his
// heading toward the way he moved; returns { want, heading, bob } (`bob` is the altitude offset in metres, 0 at erratic 0)
export function moveBait(bait, dt, want, tune) {
  const B = tune.bait, erratic = B.erratic > 0, f = bait.flight;
  let speed = bait.fleeing ? B.flee : B.speed, jink = 0;
  if (erratic) {
    const E = Math.min(1, B.erratic);
    f.t += dt;
    if ((f.surgeIn -= dt) <= 0) {      // a burst or a brake: a new target in the band, E of the way from the cruise to its edges
      const lo = B.speed + (B.speedMin - B.speed) * E, hi = B.speed + (B.speedMax - B.speed) * E;
      f.speedTarget = lo + (hi - lo) * draw(f); f.surgeIn = B.surgeMin + (B.surgeMax - B.surgeMin) * draw(f);
    }
    if ((f.jinkIn -= dt) <= 0) { f.jinkTarget = (draw(f) * 2 - 1) * B.jink * E; f.jinkIn = B.jinkMin + (B.jinkMax - B.jinkMin) * draw(f); }
    if (bait.fleeing) { f.speed = B.flee; f.jink = 0; }
    else {
      const dv = f.speedTarget - f.speed, dj = f.jinkTarget - f.jink;
      f.speed += Math.max(-B.accel * dt, Math.min(B.accel * dt, dv));
      f.jink += Math.max(-B.turn * dt, Math.min(B.turn * dt, dj));
      jink = f.jink;
    }
    speed = f.speed;
  }
  const dx = want[0] - bait.pos[0], dz = want[1] - bait.pos[1], d = Math.hypot(dx, dz), step = speed * dt;
  if (d > 1e-9) {
    const k = Math.min(step, d) / d;
    let mx = dx * k, mz = dz * k;
    if (jink) { const c = Math.cos(jink), s = Math.sin(jink); [mx, mz] = [mx * c - mz * s, mx * s + mz * c]; }
    bait.pos[0] += mx; bait.pos[1] += mz;
    let turn = (jink ? Math.atan2(mz, mx) : Math.atan2(dz, dx)) - bait.heading;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    const max = B.turn * dt;
    bait.heading += Math.max(-max, Math.min(max, turn));
  }
  const bob = erratic ? B.bob * Math.min(1, B.erratic) * (0.6 * Math.sin(2 * Math.PI * f.t / B.bobPeriod[0] + f.phase[0]) + 0.4 * Math.sin(2 * Math.PI * f.t / B.bobPeriod[1] + f.phase[1])) : 0;
  return { want, heading: bait.heading, bob };
}

// plan and move in one: the autopilot without routing
export function stepBait(bait, dt, creature, tune) {
  return moveBait(bait, dt, planBait(bait, creature, tune), tune);
}

// a landing or a stream's burn on him: a round (once, at landing; the caller decides when) takes the game's splash falloff on his
// distance to the landing, a stream (`moving`) its dps for dt seconds while he is inside its ring, as the creature's `burn` does.
// Returns the damage the plan did to him (the MK-9's 60 reads as 60); his hit points stop at zero
export function hurtBait(bait, plan, dt) {
  const d = dist(bait.pos, plan.at);
  const dealt = Math.max(0, plan.moving ? (d < plan.radius ? plan.damage * dt : 0) : splashDamage(d, plan.radius, plan.damage));
  bait.hp = Math.max(0, bait.hp - dealt);
  return dealt;
}

// accumulates the time any floor contact is within `caught` metres of his ground point (a broken hold starts over); true once it
// reaches `caughtFor`. A hop above `reachHeight` is out of reach: no hold
export function baitCaught(bait, creature, dt, tune) {
  const B = tune.bait;
  if (bait.hop && bait.hop.alt > B.reachHeight) { bait.held = 0; return false; }
  bait.held = nearestOf(creature.contacts, bait.pos).d < B.caught ? bait.held + dt : 0;
  return bait.held >= B.caughtFor - 1e-9;
}

// trapped now: the bound (`{ at, radius }`, local metres; null is no bound) within `trapBound` of him and a floor contact within `trapNear` on the
// inside of him (its offset from him has a part toward the bound's centre)
export function trappedBait(bait, creature, tune, bound) {
  if (!bound) return false;
  const B = tune.bait, ox = bound.at[0] - bait.pos[0], oz = bound.at[1] - bait.pos[1], out = Math.hypot(ox, oz);
  if (bound.radius - out > B.trapBound) return false;
  for (const p of creature.contacts ?? []) {
    const dx = p[0] - bait.pos[0], dz = p[1] - bait.pos[1];
    if (Math.hypot(dx, dz) < B.trapNear && (out < 1e-6 || dx * ox + dz * oz > 0)) return true;
  }
  return false;
}

// under the creature now: his ground point within `underCore` of its half-width from its centre, or two floor contacts within `underNear` more than
// 120 degrees apart round him
export function underBait(bait, creature, tune) {
  const B = tune.bait, c = creature.centre;
  if (creature.radius > 0 && Math.hypot(bait.pos[0] - c[0], bait.pos[1] - c[1]) < creature.radius * B.underCore) return true;
  const near = [];
  for (const p of creature.contacts ?? []) {
    const dx = p[0] - bait.pos[0], dz = p[1] - bait.pos[1], d = Math.hypot(dx, dz);
    if (d < B.underNear && d > 1e-6) near.push([dx / d, dz / d]);
  }
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) if (near[i][0] * near[j][0] + near[i][1] * near[j][1] < -0.5) return true;
  return false;
}

// the hop's goal: `keep` metres beyond the creature's edge on the side `side` x `dir` (`dir` the unit from its centre toward where he started; side -1
// the far side, 1 the near side), held `bound.inset + trapBound` metres inside the bound
function farPoint(creature, dir, tune, bound, side = -1) {
  const c = creature.centre, u = [side * dir[0], side * dir[1]];
  let e = 0;
  for (const p of creature.contacts ?? []) e = Math.max(e, (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
  let x = c[0] + u[0] * (e + tune.bait.keep), z = c[1] + u[1] * (e + tune.bait.keep);
  if (bound) {
    const r = Math.max(0, bound.radius - (bound.inset ?? 0) - tune.bait.trapBound), dx = x - bound.at[0], dz = z - bound.at[1], d = Math.hypot(dx, dz);
    if (d > r) { x = bound.at[0] + dx * r / d; z = bound.at[1] + dz * r / d; }
  }
  return [x, z];
}

// a hop starts now from altitude `alt` (`why`: 'trapped', 'random', 'under' or the caller's own, e.g. 'forced'); the jink is dropped. 'under' flies out
// through the near side (toward the bound's centre when he is on the creature's centre), the others to the far side
export function startHop(bait, creature, tune, why, alt, bound = null) {
  const c = creature.centre, dx = bait.pos[0] - c[0], dz = bait.pos[1] - c[1], d = Math.hypot(dx, dz);
  let dir = d < 1e-6 ? [0, 1] : [dx / d, dz / d];
  if (d < 1 && bound) { const bx = bound.at[0] - c[0], bz = bound.at[1] - c[1], b = Math.hypot(bx, bz); if (b > 1e-6) dir = [bx / b, bz / b]; }
  bait.hop = { phase: 'climb', why, dir, side: why === 'under' ? 1 : -1, alt, t: 0, cross: 0 };
  bait.hops++; bait.trapT = 0; bait.fleeing = false;
  if (bait.flight) { bait.flight.jink = 0; bait.flight.jinkTarget = 0; }
  return bait.hop;
}

// one frame of the fly-over, before the autopilot: starts a hop when he has been trapped `trapFor` seconds or the chance falls (after the cooldown),
// and flies the hop in progress. `bound` { at, radius, inset } or null, `alt` his altitude now, `base` the altitude he flies at. Returns null when no
// hop is flying (the autopilot flies him), else { phase, alt, heading, started, ended } (`phase` the one he was in this frame)
export function hopBait(bait, dt, creature, tune, { bound = null, alt = 0, base = 0 } = {}) {
  const B = tune.bait;
  let started = false, ended = false;
  if (!bait.hop && underBait(bait, creature, tune)) { startHop(bait, creature, tune, 'under', alt, bound); started = true; }   // under it: out at once
  if (!bait.hop) {
    bait.hopWait = Math.max(0, bait.hopWait - dt);
    bait.trapT = trappedBait(bait, creature, tune, bound) ? bait.trapT + dt : 0;
    if (bait.hopWait > 0) return null;
    const trapped = bait.trapT >= B.trapFor - 1e-9;
    const lucky = !trapped && !bait.fleeing && B.hopChance > 0 && draw(bait.hopRng) < 1 - Math.exp(-B.hopChance * dt);
    if (!trapped && !lucky) return null;
    startHop(bait, creature, tune, trapped ? 'trapped' : 'random', alt);
    started = true;
  }
  const h = bait.hop, phase = h.phase, to = farPoint(creature, h.dir, tune, bound, h.side), rate = B.hopClimb * dt;
  h.t += dt; bait.fleeing = false;
  const dx = to[0] - bait.pos[0], dz = to[1] - bait.pos[1], d = Math.hypot(dx, dz);
  if ((phase !== 'climb' || h.why === 'under') && d > 1e-9) {   // across (and on the way down; out from under it, on the way up too), no faster than `hopSpeed`
    const k = Math.min(B.hopSpeed * dt, d) / d;
    bait.pos[0] += dx * k; bait.pos[1] += dz * k;
  }
  if (d > 1e-9) {   // the heading eases toward the far point, the way he goes
    let turn = Math.atan2(dz, dx) - bait.heading;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    bait.heading += Math.max(-B.turn * dt, Math.min(B.turn * dt, turn));
  }
  if (phase === 'climb') {
    h.alt += Math.max(-rate, Math.min(rate, B.hopAlt - h.alt));
    if (Math.abs(h.alt - B.hopAlt) < 1e-9) { h.alt = B.hopAlt; h.phase = 'cross'; }
  } else if (phase === 'cross') {
    h.cross += dt;
    if (Math.hypot(to[0] - bait.pos[0], to[1] - bait.pos[1]) <= ARRIVE || h.cross >= B.hopCross) h.phase = 'descend';
  } else {
    h.alt += Math.max(-rate, Math.min(rate, base - h.alt));
    if (Math.abs(h.alt - base) < 1e-9) { h.alt = base; bait.hop = null; bait.hopWait = B.hopCooldown; bait.trapT = 0; ended = true; }
  }
  return { phase, alt: h.alt, heading: bait.heading, started, ended };
}
