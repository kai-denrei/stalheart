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
// Imports only the domain: ./gunship.js's falloff (`splashDamage`) and the fight's `lineOf`.

import { splashDamage } from './gunship.js';
import { lineOf } from './boss-fight.js';

const AHEAD = 0.5;         // seconds of travel round the circle the wanted point leads him by
const PULL = 3;            // metres of radial pull per metre the keep distance is out
const RADIAL_MAX = 24;     // ...at most this many
const FLEE_STEP = 10;      // metres the wanted point sits beyond him while he backs off
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
  return { pos: [at[0], at[1]], heading: 0, hp: B.health, max: B.health, fleeing: false, held: 0, flight };
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
// reaches `caughtFor`
export function baitCaught(bait, creature, dt, tune) {
  const B = tune.bait;
  bait.held = nearestOf(creature.contacts, bait.pos).d < B.caught ? bait.held + dt : 0;
  return bait.held >= B.caughtFor - 1e-9;
}
