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
// body swings from side to side and he dithers. `underBait` says he is under it: his ground point within `underCore` of its half-width from its centre ('core'),
// or two floor contacts within `underNear` of him more than 120 degrees apart round him ('arms'; wave B: at 15 m the predator's long sweeping arms had him
// escaping 54 to 85 per cent of a run, so the contacts must be really round him, 8 m, and held `underFor` seconds, `bait.underT`, reset when he is not under).
// Then he escapes (`why` 'under', the cooldown and the chance ignored, panicking or not), at once under the core, after `underFor` on the arms: he climbs and
// flies out together, through the near side (from the centre through him, toward the bound's centre when he is on the centre), to `keep` beyond the edge
// there, and comes down.
//
// THE REACH ENVELOPE (owner's predator, 2026-10-09: its arms sweep out to about 90 m, and a keep from the floor contacts' front edge had him under them
// all the time). When the lab gives the creature's body nodes (`creature.nodes`, [x, z, height] in local metres, every node: the reaching arms with
// the feet), `envelopeBait` measures the creature's reach toward him: the outermost node (or held contact) projected on the line from its centre to him,
// smoothed over `envelopeTime` seconds so a sweeping arm does not yank him back and forth (`bait.reach`: `e` smoothed, `now` this frame's). The planner then
// keeps `keep` beyond that envelope, not beyond the floor contacts' front edge, and his panic counts every node under `panicHeight` (an arm near the ground)
// with the floor contacts. Without nodes (`bait.reach` null) both are the floor contacts' as before, bit for bit.
//
// NUKE ZONES (owner, 2026-10-10: "Have Isao more actively avoid where the Nuke will fall. A user mistake leading to friendly fire is fine, but Isao actively
// changing direction to enter the radius of the incoming nuke feels wrong"): `planBait`, `moveBait`, `stepBait` and `hopBait` take a list of DANGER ZONES
// `[{ at: [x, z], radius, until }]`, one for every MK-9 in flight (from its release to its landing; `until` is the landing's time on the lab's clock, the
// lab's to filter by), each kept out to `radius + bait.nukeMargin` (the ring below). (1) His wanted point is never inside a ring: it is moved out to the ring's
// edge (`ZONE_PAD` beyond) on the side nearer him, and a path to it that would cross a ring is routed round the ring's tangent (`bait.zoneSide`, the way round
// kept while the detour lasts; the jink is dropped on it); whatever the jink or the lab's routing does, a step that would take him from outside a ring to
// inside it is held on its edge. (2) Inside a ring he flies straight out, away from its centre, at `flee`, the keep, the jinks and the creature's panic
// overridden, until clear (`bait.zoneFlee`). (3) A hop's goal moved out the same way, its crossing routed round the rings, and a hop that is not forced
// (not 'under', not 'forced') to a goal its straight path to which crosses a ring tries the other side and else waits; in a ring in the middle of a hop he flies
// straight out at `flee`, the hop's phases going on. (4) His panic picks, of the directions away from the arm, the nearest to straight away that leaves every
// ring clear. A nuke he cannot outrun is the player's to answer for. With no zones every path is the one before, bit for bit.
//
// HIS FLIGHT IS A BODY'S (owner, 2026-10-10: "often when Isao is too close to the enemy, his camera shakes violently, like the 3d model is stuck repeatedly on a
// wrong path ... it breaks the immersion by looking like physically impossible motion"). The trace (.superpowers/sdd/isao-shake-report.md): the mover stepped him
// straight at the wanted point at the wanted speed every frame, so every jump of that point was a jump of his velocity, and close to the creature the panic's point
// (straight away from the NEAREST low arm) swung between two arms nearly as near frame by frame, a zigzag at 32 m/s (with the creature held close, over half the
// frames above 60 m/s2, the p90 3,600, the panic starting 44 times in 20 s). Now (1) he carries a velocity (`bait.vel`, m/s on the plane) and every mode steers it
// toward the wanted one by at most `accel` m/s2 cruising and `panicAccel` fleeing a ring or an arm or escaping from under it, his ground point moving by the
// frame's mean velocity; on a point he is to stop on (`moveBait`'s `stop`) he brakes to arrive (no faster than a stop at that limit allows); (2) his
// panic flees the sum of every low arm within `panic + panicExit`, each weighted by how far inside that ring it is, with a tenth of the way out from the
// creature's centre (an arm crossing the ring fades in and out, two arms nearly as near no longer trade places, arms all round him send him out); (3) the panic
// has hysteresis and a dwell: it starts with an arm inside `panic`, and ends only once every arm is beyond `panic + panicExit` and it has lasted `panicDwell`
// seconds; (4) a hop's climb and descent ease at `climbAccel` m/s2 (`bait.hop.vy`), its ground velocity at `accel` (out from under the creature or a ring at
// `panicAccel`), and to stay as quick as the jump it was the phases overlap: he sets off across half way up from the reach to `hopAlt`, and comes down as he
// brakes onto the far point, flying off round the creature at the cruise as he lands (the autopilot takes him moving, not from a hover). A constraint that moves his ground point (a ring's edge, the lab's bound:
// `constrainBait`) drops the part of his velocity that pushed into it, so he slides along it. The limits are finite: without `accel`, `panicAccel`, `climbAccel`
// (a tune without the keys) the steering is immediate, as before.
//
// Imports only the domain: ./gunship.js's falloff (`splashDamage`) and the fight's `lineOf`.

import { splashDamage } from './gunship.js';
import { lineOf } from './boss-fight.js';

const AHEAD = 0.5;         // seconds of travel round the circle the wanted point leads him by
const PULL = 3;            // metres of radial pull per metre the keep distance is out
const RADIAL_MAX = 24;     // ...at most this many
const FLEE_STEP = 10;      // metres the wanted point sits beyond him while he backs off
const ARRIVE = 2;          // metres from the far point at which the hop's cross ends
const ALT_NEAR = 0.01;     // metres: a hop's climb or descent this near its altitude, at a vertical speed a frame's ease stops, is there
const ZONE_PAD = 0.5;      // metres beyond a ring's edge at which a wanted point is put, and the tangent a detour flies
const PANIC_TURNS = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4, 2.8, -2.8, Math.PI];   // radians off straight away from the arm a panic tries, nearest first
const ZONE_EDGE = 0.25;    // metres: this close to a detour's circle he flies its tangent
const OUTWARD = 0.1;       // the panic's weight on the way out from the creature's centre, against an arm's 1 at its contact (HIS FLIGHT IS A BODY'S, above)
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
  // the fly-over's state: the hop in progress ({ phase, why, dir, alt, t, cross }) or null, the hops so far, the seconds trapped, the cooldown left, the seconds he has been under it
  const hops = { hop: null, hops: 0, trapT: 0, hopWait: 0, underT: 0, zoneSide: 0, zoneFlee: false, hopRng: { rng: Math.imul(seed >>> 0, 0x9E3779B1) >>> 0 } };
  // `vel` his ground velocity (m/s), `panicT` the seconds the panic (or its absence) has lasted (HIS FLIGHT IS A BODY'S, above)
  return { pos: [at[0], at[1]], vel: [0, 0], heading: 0, hp: B.health, max: B.health, fleeing: false, panicT: 0, held: 0, reach: null, flight, ...hops };
}

// the nearest floor contact to a point (null and Infinity with none)
function nearestOf(contacts, at) {
  let best = null, far = Infinity;
  for (const p of contacts ?? []) { const d = dist(p, at); if (d < far) { far = d; best = p; } }
  return { at: best, d: far };
}

// ---- the nuke zones (above). A zone is `{ at, radius, until }`; its ring is `radius + margin` (`bait.nukeMargin`) ----
const ringOf = (z, margin) => z.radius + margin;
// the zone he is deepest inside (his ground point within its ring), or null
function zoneOf(pos, zones, margin) {
  let best = null, deep = 0;
  for (const z of zones) { const k = ringOf(z, margin) - dist(pos, z.at); if (k > deep) { deep = k; best = z; } }
  return best;
}
// the unit from `a` toward `b`; `fallback` when they are one point
function unitOf(a, b, fallback = [0, 1]) {
  const d = dist(a, b);
  return d < 1e-9 ? fallback : [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
}
// ---- his flight's body (HIS FLIGHT IS A BODY'S, above) ----
// the speed toward a point `d` metres off: `speed`, braked so that `accel` m/s2 stops him on it in frames of `dt` (the discrete stop: d = v^2 / 2a + v dt / 2,
// so the last frame's speed is under accel x dt and the stop itself is within the limit), and never past it in a frame
const arrive = (d, speed, accel, dt) => {
  const h = accel * dt / 2;
  return Math.min(speed, Number.isFinite(accel) ? Math.sqrt(h * h + 2 * accel * d) - h : Infinity, d / dt);
};
// his velocity steered toward `target` ([vx, vz] m/s) by at most `accel` x dt (any `accel` not finite: at once), and his ground point moved by the frame's
// mean velocity (the old and the new: exact for a constant acceleration, so the path is smooth whatever the frames' lengths)
function steerVel(bait, target, accel, dt) {
  const v = bait.vel, vx = v[0], vz = v[1], dx = target[0] - vx, dz = target[1] - vz, d = Math.hypot(dx, dz), most = accel * dt;
  const k = Number.isFinite(most) && d > most ? most / d : 1;
  v[0] += dx * k; v[1] += dz * k;
  bait.pos[0] += (vx + v[0]) / 2 * dt; bait.pos[1] += (vz + v[1]) / 2 * dt;
}
// his ground point moved to `at` by a constraint (a ring's edge, the lab's bound): the part of his velocity that pushed into the correction is dropped, so he
// slides along it instead of pressing on it frame after frame
export function constrainBait(bait, at) {
  const cx = at[0] - bait.pos[0], cz = at[1] - bait.pos[1], c = Math.hypot(cx, cz);
  bait.pos[0] = at[0]; bait.pos[1] = at[1];
  if (c < 1e-9 || !bait.vel) return;
  const nx = cx / c, nz = cz / c, into = bait.vel[0] * nx + bait.vel[1] * nz;
  if (into < 0) { bait.vel[0] -= nx * into; bait.vel[1] -= nz * into; }
}

// a point moved out of every ring it is in, to the ring's edge plus ZONE_PAD on the side of `from` (his position)
export function pushOut(point, from, zones, margin) {
  let p = point;
  for (let pass = 0; pass <= zones.length; pass++) {
    let moved = false;
    for (const z of zones) {
      if (dist(p, z.at) >= ringOf(z, margin)) continue;
      const u = unitOf(z.at, from, unitOf(z.at, p));
      p = [z.at[0] + u[0] * (ringOf(z, margin) + ZONE_PAD), z.at[1] + u[1] * (ringOf(z, margin) + ZONE_PAD)]; moved = true;
    }
    if (!moved) break;
  }
  return p === point ? point : p;
}
// the first ring (nearest along the path) the straight path from `from` to `to` enters, or null
function crossing(from, to, zones, margin) {
  const sx = to[0] - from[0], sz = to[1] - from[1], len2 = sx * sx + sz * sz;
  let best = null, tBest = Infinity;
  if (len2 < 1e-12) return null;
  for (const z of zones) {
    const t = Math.max(0, Math.min(1, ((z.at[0] - from[0]) * sx + (z.at[1] - from[1]) * sz) / len2));
    if (Math.hypot(from[0] + sx * t - z.at[0], from[1] + sz * t - z.at[1]) < ringOf(z, margin) && t < tBest) { tBest = t; best = z; }
  }
  return best;
}
// where to steer for `to`: itself when the straight path clears every ring, else a point along the tangent to the ring in the way (the way round kept in
// `bait.zoneSide` while a detour lasts: +1 round the ring counter-clockwise, -1 clockwise)
function detour(bait, to, zones, margin) {
  const from = bait.pos, z = crossing(from, to, zones, margin);
  if (!z) { bait.zoneSide = 0; return to; }
  const R = ringOf(z, margin) + ZONE_PAD, r = unitOf(z.at, from), d = dist(from, z.at), a = Math.atan2(r[1], r[0]);
  const dirOf = (s) => {   // the heading along the tangent from `from` round the ring on side s
    if (d <= R + ZONE_EDGE) return [-s * r[1], s * r[0]];
    const th = a + s * Math.acos(R / d);
    return unitOf(from, [z.at[0] + R * Math.cos(th), z.at[1] + R * Math.sin(th)]);
  };
  if (!bait.zoneSide) {
    const sx = to[0] - from[0], sz = to[1] - from[1], pa = dirOf(1), pb = dirOf(-1);
    bait.zoneSide = pa[0] * sx + pa[1] * sz >= pb[0] * sx + pb[1] * sz ? 1 : -1;
  }
  const u = dirOf(bait.zoneSide), reach = d > R + ZONE_EDGE ? Math.max(FLEE_STEP, Math.sqrt(d * d - R * R)) : FLEE_STEP;
  return [from[0] + u[0] * reach, from[1] + u[1] * reach];
}
// a step that took him from outside a ring to inside it is held on the ring's edge (`was` his position before the step); true when one did
function holdOut(bait, was, zones, margin) {
  let held = false;
  for (const z of zones) {
    const R = ringOf(z, margin);
    if (dist(was, z.at) < R - 1e-9) continue;   // he began inside this one: he is flying out of it
    const d = dist(bait.pos, z.at);
    if (d >= R) continue;
    const u = unitOf(z.at, bait.pos, unitOf(z.at, was));
    constrainBait(bait, [z.at[0] + u[0] * R, z.at[1] + u[1] * R]); held = true;
  }
  return held;
}
// the point straight out of the ring he is in: ahead of him, away from its centre (`toward` picks the way when he is on the centre)
function outOf(pos, z, toward) {
  const u = unitOf(z.at, pos, unitOf(pos, toward));
  return [pos[0] + u[0] * FLEE_STEP, pos[1] + u[1] * FLEE_STEP];
}

// what his panic counts: the floor contacts, and with the body's nodes every node under `panicHeight` (an arm near the ground)
function lowOf(creature, B) {
  if (!creature.nodes?.length) return creature.contacts;
  const low = [...(creature.contacts ?? [])];
  for (const p of creature.nodes) if (p[2] < B.panicHeight) low.push(p);
  return low;
}

// the creature's reach toward `at` now: the outermost body node or floor contact projected on the line from its centre to `at` (`lineOf`'s unit `u`); with
// no nodes, the floor contacts' front edge (`lineOf`'s `e`)
export function reachOf(creature, at) {
  const here = lineOf(creature, { pos: at }), c = here.c, u = here.u;
  let e = here.e;
  for (const p of creature.nodes ?? []) e = Math.max(e, (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
  return { u, e };
}

// the envelope he keeps from, each frame before the planner: this frame's reach toward him (`now`) and its smoothing over `envelopeTime` seconds (`e`, the
// first frame's own). Null, and `bait.reach` null, when the creature carries no nodes (the planner keeps the floor contacts' front edge)
export function envelopeBait(bait, creature, dt, tune) {
  if (!creature.nodes?.length) { bait.reach = null; return null; }
  const now = reachOf(creature, bait.pos).e;
  if (!bait.reach) bait.reach = { e: now, now };
  else { bait.reach.e += (now - bait.reach.e) * (1 - Math.exp(-dt / tune.bait.envelopeTime)); bait.reach.now = now; }
  return bait.reach;
}

// the point he wants now: the one `keep` metres outside the reach envelope (`bait.reach`, else the floor contacts' front edge), a short way ahead round the
// circle; or, with an arm inside `panic` (a floor contact, or a body node under `panicHeight`), a point straight away from it. Sets `bait.fleeing` for
// `moveBait` (the cruise or the flee speed)
// the panic's way out: the sum of the unit vectors away from every low arm within `ring` metres, each weighted by how far inside the ring it is (1 at his
// ground point, 0 at the ring), plus OUTWARD of the way out from the creature's centre; a unit, continuous as the arms move (`toward` the fallback)
function panicAway(pos, low, centre, ring) {
  let x = 0, z = 0;
  for (const p of low ?? []) {
    const dx = pos[0] - p[0], dz = pos[1] - p[1], d = Math.hypot(dx, dz);
    if (d >= ring || d < 1e-9) continue;
    const w = (ring - d) / ring;
    x += dx / d * w; z += dz / d * w;
  }
  const out = centre ? unitOf(centre, pos, [0, 1]) : [0, 1];
  x += out[0] * OUTWARD; z += out[1] * OUTWARD;
  const d = Math.hypot(x, z);
  return d < 1e-9 ? out : [x / d, z / d];
}

export function planBait(bait, creature, tune, zones = null) {
  const B = tune.bait, low = lowOf(creature, B), near = nearestOf(low, bait.pos), Z = zones?.length ? zones : null, margin = B.nukeMargin ?? 0;
  // the panic's hysteresis and dwell (HIS FLIGHT IS A BODY'S, above): in at `panic`, out beyond `panic + panicExit` once it has lasted `panicDwell` s
  // (`bait.panicT`, the mover's clock of it)
  const exit = B.panic + (B.panicExit ?? 0), was = bait.fleeing;
  bait.fleeing = was ? near.d < exit || bait.panicT < (B.panicDwell ?? 0) : near.d < B.panic;
  if (bait.fleeing !== was) bait.panicT = 0;
  if (bait.fleeing) {
    const away = panicAway(bait.pos, low, creature.centre, exit);
    if (Z) {   // the direction nearest straight away from the arm that leaves every ring clear (a panic never drives him into one)
      for (const turn of PANIC_TURNS) {
        const c = Math.cos(turn), s = Math.sin(turn), u = [away[0] * c - away[1] * s, away[0] * s + away[1] * c], p = [bait.pos[0] + u[0] * FLEE_STEP, bait.pos[1] + u[1] * FLEE_STEP];
        if (!crossing(bait.pos, p, Z, margin) && !zoneOf(p, Z, margin)) return p;
      }
    }
    return [bait.pos[0] + away[0] * FLEE_STEP, bait.pos[1] + away[1] * FLEE_STEP];
  }
  const c = creature.centre, here = lineOf(creature, bait), rho = Math.hypot(bait.pos[0] - c[0], bait.pos[1] - c[1]);
  const lead = B.speed * AHEAD, err = (bait.reach?.e ?? here.e) + B.keep - rho, radial = Math.max(-RADIAL_MAX, Math.min(RADIAL_MAX, err * PULL));
  // counter-clockwise: the tangent is the unit rotated a quarter turn the way the angle grows; the radial pull closes the keep error
  const want = [bait.pos[0] - here.u[1] * lead + here.u[0] * radial, bait.pos[1] + here.u[0] * lead + here.u[1] * radial];
  return Z ? pushOut(want, bait.pos, Z, margin) : want;
}

// moves him toward `want` for dt seconds at the cruise or the flee speed (stopping on a point nearer than a step) and eases his
// heading toward the way he moved; returns { want, heading, bob } (`bob` is the altitude offset in metres, 0 at erratic 0). The planner's points are carrots
// ahead of him; `stop` true says `want` is a place to stop on (a point pushed out of a ring is one, or the lab's point moved by something other than the
// bound): he brakes to arrive on it at his limit instead of overshooting and swinging back round it. `wall` ({ at, radius }, local metres, or null) is the
// bound the lab holds his wanted point inside: his speed OUT toward it is braked so his limit stops him on it, his speed along it is not (a point held on
// the bound is still a carrot sliding along it: braking onto it had him crawl along the bound, pinned, the creature closing)
export function moveBait(bait, dt, want, tune, zones = null, stop = false, wall = null) {
  const B = tune.bait, erratic = B.erratic > 0, f = bait.flight, Z = zones?.length ? zones : null, margin = B.nukeMargin ?? 0;
  // inside a ring: straight out of it at the flee speed (the keep, the jinks and the panic overridden); else the wanted point is moved out of the rings and the
  // path to it routed round them (the nuke zones, above)
  const inside = Z ? zoneOf(bait.pos, Z, margin) : null, was = Z ? [bait.pos[0], bait.pos[1]] : null;
  let detoured = false;
  if (Z) {
    bait.zoneFlee = !!inside;
    if (inside) { want = outOf(bait.pos, inside, want); bait.zoneSide = 0; }
    else { const to = pushOut(want, bait.pos, Z, margin); stop = stop || to !== want; want = detour(bait, to, Z, margin); detoured = bait.zoneSide !== 0; }
  } else bait.zoneFlee = false;
  const flee = bait.fleeing || bait.zoneFlee, accel = (flee ? B.panicAccel : B.accel) ?? Infinity;
  bait.panicT = (bait.panicT ?? 0) + dt;   // the panic's dwell (planBait)
  let speed = flee ? B.flee : B.speed, jink = 0;
  if (erratic) {
    const E = Math.min(1, B.erratic);
    f.t += dt;
    if ((f.surgeIn -= dt) <= 0) {      // a burst or a brake: a new target in the band, E of the way from the cruise to its edges
      const lo = B.speed + (B.speedMin - B.speed) * E, hi = B.speed + (B.speedMax - B.speed) * E;
      f.speedTarget = lo + (hi - lo) * draw(f); f.surgeIn = B.surgeMin + (B.surgeMax - B.surgeMin) * draw(f);
    }
    if ((f.jinkIn -= dt) <= 0) { f.jinkTarget = (draw(f) * 2 - 1) * B.jink * E; f.jinkIn = B.jinkMin + (B.jinkMax - B.jinkMin) * draw(f); }
    if (flee) { f.speed = B.flee; f.jink = 0; }
    else {
      const dv = f.speedTarget - f.speed, dj = f.jinkTarget - f.jink;
      f.speed += Math.max(-B.accel * dt, Math.min(B.accel * dt, dv));
      f.jink += Math.max(-B.turn * dt, Math.min(B.turn * dt, dj));
      jink = detoured ? 0 : f.jink;
    }
    speed = f.speed;
  }
  // the velocity he wants: toward the point at the speed, braked to arrive on it, turned by the jink; his own steered to it within the mode's limit
  const dx = want[0] - bait.pos[0], dz = want[1] - bait.pos[1], d = Math.hypot(dx, dz);
  let tx = 0, tz = 0;
  if (d > 1e-9 && dt > 0) {
    const s = stop ? arrive(d, speed, accel, dt) : Math.min(speed, d / dt);
    tx = dx / d * s; tz = dz / d * s;
    if (jink) { const c = Math.cos(jink), sn = Math.sin(jink); [tx, tz] = [tx * c - tz * sn, tx * sn + tz * c]; }
  }
  if (wall && dt > 0) {   // the outward part braked to stop on the wall
    const n = unitOf(wall.at, bait.pos, [0, 0]), out = tx * n[0] + tz * n[1], room = Math.max(0, wall.radius - dist(bait.pos, wall.at));
    const most = arrive(room, Infinity, accel, dt);
    if (out > most) { tx -= n[0] * (out - most); tz -= n[1] * (out - most); }
  }
  if (!bait.vel) bait.vel = [0, 0];
  steerVel(bait, [tx, tz], accel, dt);
  if (Z) holdOut(bait, was, Z, margin);   // a step into a ring is held on its edge
  if (Math.hypot(bait.vel[0], bait.vel[1]) > 1e-6) {   // the heading eases toward the way he flies
    let turn = Math.atan2(bait.vel[1], bait.vel[0]) - bait.heading;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    const max = B.turn * dt;
    bait.heading += Math.max(-max, Math.min(max, turn));
  }
  return { want, heading: bait.heading, bob: bobOf(bait, B) };
}

// the altitude bob now (metres; 0 at erratic 0): two sines on the erratic flight's clock, which runs through the hops too (the lab fades the bob out over a hop,
// and a bob frozen at the hop's start would jump his vertical speed)
function bobOf(bait, B) {
  const f = bait.flight;
  if (!(B.erratic > 0) || !f) return 0;
  return B.bob * Math.min(1, B.erratic) * (0.6 * Math.sin(2 * Math.PI * f.t / B.bobPeriod[0] + f.phase[0]) + 0.4 * Math.sin(2 * Math.PI * f.t / B.bobPeriod[1] + f.phase[1]));
}

// the envelope, the plan and the move in one: the autopilot without routing
export function stepBait(bait, dt, creature, tune, zones = null) {
  envelopeBait(bait, creature, dt, tune);
  return moveBait(bait, dt, planBait(bait, creature, tune, zones), tune, zones);
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

// under the creature now: 'core' (his ground point within `underCore` of its half-width from its centre), 'arms' (two floor contacts within `underNear` more
// than 120 degrees apart round him) or null; the persistence (`underFor`) is `hopBait`'s
export function underBait(bait, creature, tune) {
  const B = tune.bait, c = creature.centre;
  if (creature.radius > 0 && Math.hypot(bait.pos[0] - c[0], bait.pos[1] - c[1]) < creature.radius * B.underCore) return 'core';
  const near = [];
  for (const p of creature.contacts ?? []) {
    const dx = p[0] - bait.pos[0], dz = p[1] - bait.pos[1], d = Math.hypot(dx, dz);
    if (d < B.underNear && d > 1e-6) near.push([dx / d, dz / d]);
  }
  for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) if (near[i][0] * near[j][0] + near[i][1] * near[j][1] < -0.5) return 'arms';
  return null;
}

// the hop's goal: `keep` metres beyond the creature's edge on the side `side` x `dir` (`dir` the unit from its centre toward where he started; side -1
// the far side, 1 the near side), held `bound.inset + trapBound` metres inside the bound. The edge is the reach envelope's when the creature carries its
// nodes (the outermost node that way, arms included), else the floor contacts'
function farPoint(creature, dir, tune, bound, side = -1) {
  const c = creature.centre, u = [side * dir[0], side * dir[1]];
  let e = 0;
  for (const p of creature.contacts ?? []) e = Math.max(e, (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
  for (const p of creature.nodes ?? []) e = Math.max(e, (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1]);
  let x = c[0] + u[0] * (e + tune.bait.keep), z = c[1] + u[1] * (e + tune.bait.keep);
  if (bound) {
    const r = Math.max(0, bound.radius - (bound.inset ?? 0) - tune.bait.trapBound), dx = x - bound.at[0], dz = z - bound.at[1], d = Math.hypot(dx, dz);
    if (d > r) { x = bound.at[0] + dx * r / d; z = bound.at[1] + dz * r / d; }
  }
  return [x, z];
}

// a hop starts now from altitude `alt` (`why`: 'trapped', 'random', 'under' or the caller's own, e.g. 'forced'); the jink is dropped. 'under' flies out
// through the near side (toward the bound's centre when he is on the creature's centre), the others to the far side. AN ESCAPE THE BOUND HEMS IN goes over
// (wave A, 2026-10-09: with the creature on him at the bound the near side's goal was held inside the bound, still under the body; he landed there, was under it
// again and hopped again, 100 % of a run): when the near side's goal, held inside the bound, is less than `keep` beyond the creature's edge that way, and the
// far side's is farther from its centre, he escapes over the creature to the far side
export function startHop(bait, creature, tune, why, alt, bound = null, zones = null) {
  const c = creature.centre, dx = bait.pos[0] - c[0], dz = bait.pos[1] - c[1], d = Math.hypot(dx, dz);
  let dir = d < 1e-6 ? [0, 1] : [dx / d, dz / d];
  if (d < 1 && bound) { const bx = bound.at[0] - c[0], bz = bound.at[1] - c[1], b = Math.hypot(bx, bz); if (b > 1e-6) dir = [bx / b, bz / b]; }
  let side = why === 'under' ? 1 : -1;
  if (side === 1 && bound) {
    const free = farPoint(creature, dir, tune, null, 1), near = farPoint(creature, dir, tune, bound, 1), far = farPoint(creature, dir, tune, bound, -1);
    const out = (p) => Math.hypot(p[0] - c[0], p[1] - c[1]);
    if (out(free) - out(near) > tune.bait.keep / 2 && out(far) > out(near)) side = -1;   // the bound took more than half his keep off the near side's goal
  }
  const Z = zones?.length ? zones : null;
  if (Z) {   // a goal in a ring, or a straight path to it across one, takes the other side; neither clear: a forced hop (under it, the caller's) goes on, the rest wait (null)
    const margin = tune.bait.nukeMargin ?? 0, clear = (sd) => { const g = farPoint(creature, dir, tune, bound, sd); return !zoneOf(g, Z, margin) && !crossing(bait.pos, g, Z, margin); };
    if (!clear(side)) { if (clear(-side)) side = -side; else if (why !== 'under' && why !== 'forced') return null; }
  }
  bait.hop = { phase: 'climb', why, dir, side, alt, vy: 0, t: 0, cross: 0 };
  bait.hops++; bait.trapT = 0; bait.underT = 0; bait.fleeing = false; bait.panicT = 0;
  if (bait.flight) { bait.flight.jink = 0; bait.flight.jinkTarget = 0; }
  return bait.hop;
}

// one frame of the fly-over, before the autopilot: starts a hop when he has been trapped `trapFor` seconds or the chance falls (after the cooldown),
// and flies the hop in progress. `bound` { at, radius, inset } or null, `alt` his altitude now, `base` the altitude he flies at. Returns null when no
// hop is flying (the autopilot flies him), else { phase, alt, vy, bob, heading, started, ended } (`phase` the one he was in this frame, `vy` his vertical
// speed, `bob` the erratic flight's bob running on)
export function hopBait(bait, dt, creature, tune, { bound = null, alt = 0, base = 0, zones = null } = {}) {
  const B = tune.bait, Z = zones?.length ? zones : null, margin = B.nukeMargin ?? 0;
  let started = false, ended = false;
  if (!bait.hop) {   // under its core: out at once; its arms round him: after `underFor` seconds of it without a break
    const under = underBait(bait, creature, tune);
    bait.underT = under ? bait.underT + dt : 0;
    if (under === 'core' || bait.underT >= B.underFor - 1e-9) { startHop(bait, creature, tune, 'under', alt, bound, Z); started = true; }
  }
  if (!bait.hop) {
    bait.hopWait = Math.max(0, bait.hopWait - dt);
    bait.trapT = trappedBait(bait, creature, tune, bound) ? bait.trapT + dt : 0;
    if (bait.hopWait > 0) return null;
    const trapped = bait.trapT >= B.trapFor - 1e-9;
    const lucky = !trapped && !bait.fleeing && B.hopChance > 0 && draw(bait.hopRng) < 1 - Math.exp(-B.hopChance * dt);
    if (!trapped && !lucky) return null;
    if (!startHop(bait, creature, tune, trapped ? 'trapped' : 'random', alt, null, Z)) return null;   // every way across leads through a ring: it waits
    started = true;
  }
  const h = bait.hop, phase = h.phase, rate = B.hopClimb * dt;
  if (B.erratic > 0 && bait.flight) bait.flight.t += dt;   // the bob's clock runs on (bobOf)
  let to = farPoint(creature, h.dir, tune, bound, h.side);
  h.t += dt; bait.fleeing = false;
  const inside = Z ? zoneOf(bait.pos, Z, margin) : null, was = Z ? [bait.pos[0], bait.pos[1]] : null;
  let steer = to;   // the point he steers for: the goal itself, or with the rings about, the goal moved out of them and the way round them
  if (Z) {
    bait.zoneFlee = !!inside;
    if (inside) { steer = outOf(bait.pos, inside, to); bait.zoneSide = 0; }   // in a ring in the middle of a hop: straight out at the flee speed, the phases going on
    else { to = pushOut(to, bait.pos, Z, margin); steer = detour(bait, to, Z, margin); }
  } else bait.zoneFlee = false;
  // the escape from under it and a flight out of a ring steer at `panicAccel`; the other hops (trapped, random, forced) at the cruise's `accel`, their climb's
  // braking to a hover and its vertical ease together staying a cruise's push
  const dx = to[0] - bait.pos[0], dz = to[1] - bait.pos[1], d = Math.hypot(dx, dz), accel = (h.why === 'under' || inside ? B.panicAccel : B.accel) ?? Infinity;
  let tx = 0, tz = 0;   // the velocity he wants: across (and on the way down; out from under it, on the way up too), no faster than `hopSpeed`; else a hover
  // (once the climb is half way from the reach to the hop's altitude he sets off across: the eased climb and cross overlap, the hop no slower than a jump's)
  if ((phase !== 'climb' || h.why === 'under' || inside || h.alt >= (B.reachHeight + B.hopAlt) / 2) && d > 1e-9 && dt > 0) {
    const sx = steer[0] - bait.pos[0], sz = steer[1] - bait.pos[1], sd = Math.hypot(sx, sz);
    if (sd > 1e-9) { const s = Math.min(arrive(d, inside ? B.flee : B.hopSpeed, accel, dt), sd / dt); tx = sx / sd * s; tz = sz / sd * s; }
    // coming down onto the far point he flies off round the creature the way the keep does at the cruise, so he lands moving and the autopilot takes him
    // from there (braked to a hover on the point, he set off again from nothing)
    if (phase === 'descend' && !inside && steer === to) {
      if (h.off || d <= ARRIVE) {
        h.off = true;   // held for the rest of the descent
        // the keep's own carrot round the creature (a lead along the circle, the radial pull holding the far point's distance from its centre)
        const c = creature.centre, u = unitOf(c, bait.pos), lead = B.speed * AHEAD;
        const radial = Math.max(-RADIAL_MAX, Math.min(RADIAL_MAX, (dist(to, c) - dist(bait.pos, c)) * PULL));
        const cx = -u[1] * lead + u[0] * radial, cz = u[0] * lead + u[1] * radial, cl = Math.hypot(cx, cz) || 1;
        tx = cx / cl * B.speed; tz = cz / cl * B.speed;
      }
    }
  }
  if (!bait.vel) bait.vel = [0, 0];
  steerVel(bait, [tx, tz], accel, dt);
  if (Z) holdOut(bait, was, Z, margin);
  if (d > 1e-9) {   // the heading eases toward the far point, the way he goes
    let turn = Math.atan2(dz, dx) - bait.heading;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    bait.heading += Math.max(-B.turn * dt, Math.min(B.turn * dt, turn));
  }
  // the altitude: toward the hop's (the climb and the cross) or his own (the descent) at no more than `hopClimb` m/s, the vertical speed eased at `climbAccel`
  const climbTo = (target) => {
    const err = target - h.alt, ca = B.climbAccel ?? Infinity;
    if (!Number.isFinite(ca)) { h.alt += Math.max(-rate, Math.min(rate, err)); return; }
    const want = dt > 0 ? Math.sign(err) * arrive(Math.abs(err), B.hopClimb, ca, dt) : 0, vy = h.vy ?? 0;
    h.vy = vy + Math.max(-ca * dt, Math.min(ca * dt, want - vy));
    h.alt += (vy + h.vy) / 2 * dt;   // the frame's mean vertical speed, as the ground's
  };
  const there = (target) => Math.abs(h.alt - target) < ALT_NEAR && Math.abs(h.vy ?? 0) <= (B.climbAccel ?? Infinity) * dt + 1e-9;
  if (phase === 'climb') {
    climbTo(B.hopAlt);
    if (Math.abs(h.alt - B.hopAlt) < 1e-6 || there(B.hopAlt)) { h.alt = B.hopAlt; h.phase = 'cross'; }   // the last speed is under climbAccel x dt: the cross stops it
  } else if (phase === 'cross') {
    h.vy = 0;
    h.cross += dt;
    // down once he is within ARRIVE of the far point, or as near as his braking to it takes (the descent and the braking overlap), or after `hopCross` s
    const sp = Math.hypot(bait.vel[0], bait.vel[1]), brake = Number.isFinite(accel) ? sp * sp / (2 * accel) : 0;
    if (Math.hypot(to[0] - bait.pos[0], to[1] - bait.pos[1]) <= ARRIVE + brake || h.cross >= B.hopCross) h.phase = 'descend';
  } else {
    climbTo(base);
    if (Math.abs(h.alt - base) < 1e-6 || there(base)) { h.alt = base; bait.hop = null; bait.hopWait = B.hopCooldown; bait.trapT = 0; ended = true; }
  }
  return { phase, alt: h.alt, vy: h.vy ?? 0, bob: bobOf(bait, B), heading: bait.heading, started, ended };
}
