// The boss lab's bait mode: Isao the drone flies on autopilot as the creature's prey while the player fires the gunship
// (docs/superpowers/specs/2026-10-09-boss-bait-mode-design.md, Task 1). Pure: arrays and plain objects in and out, time in seconds,
// positions in local metres on the plane [x, z]; the numbers come in as `tune` (src/content/boss-fight.js, `tune.bait`).
//
// The autopilot: Isao keeps `keep` metres outside the creature's front edge toward himself (`lineOf`'s `e`, from his side) and
// circles it counter-clockwise (the angle atan2(z, x) round the centre grows) at `speed`, backing straight off at `flee` while
// any floor contact is within `panic`. The planner (`planBait`) names the point he wants, the mover (`moveBait`) takes him there,
// so the lab can route the point round obstacles in between; `stepBait` is the two in a row. His heading eases at `turn` rad/s
// toward the way he moves. His health takes the creature's falloff (`hurtBait`); a hold within `caught` of a contact takes him.
//
// Imports only the domain: ./gunship.js's falloff (`splashDamage`) and the fight's `lineOf`.

import { splashDamage } from './gunship.js';
import { lineOf } from './boss-fight.js';

const AHEAD = 0.5;         // seconds of travel round the circle the wanted point leads him by
const PULL = 3;            // metres of radial pull per metre the keep distance is out
const RADIAL_MAX = 24;     // ...at most this many
const FLEE_STEP = 10;      // metres the wanted point sits beyond him while he backs off
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function makeBait(at, tune) {
  const B = tune.bait;
  return { pos: [at[0], at[1]], heading: 0, hp: B.health, max: B.health, fleeing: false, held: 0 };
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
// heading toward the way he moved; returns { want, heading }
export function moveBait(bait, dt, want, tune) {
  const B = tune.bait, dx = want[0] - bait.pos[0], dz = want[1] - bait.pos[1], d = Math.hypot(dx, dz), step = (bait.fleeing ? B.flee : B.speed) * dt;
  if (d > 1e-9) {
    const k = Math.min(step, d) / d;
    bait.pos[0] += dx * k; bait.pos[1] += dz * k;
    let turn = Math.atan2(dz, dx) - bait.heading;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    const max = B.turn * dt;
    bait.heading += Math.max(-max, Math.min(max, turn));
  }
  return { want, heading: bait.heading };
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
