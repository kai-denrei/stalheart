// THE GUNSHIP'S GROUND TRACK (docs/superpowers/specs/2026-09-15-v1-session-design.md, "The gunship creeps toward the
// breaches"; owner, 2026-09-15: the gunship feels too static, it should move slowly towards the breaches).
//
// The platform flies over a GROUND POINT with a HEADING. The ground point creeps along the sphere toward a target (the
// live breach with the most enemies near it, else the base) with inertia: its velocity changes at most `accelCells`
// per second, so it eases in from rest and brakes on the curve sqrt(2 * accel * distance). It does not stop on the
// target: it brakes onto a LOITER CIRCLE `loiterCells` round it and circles anticlockwise seen from above, the slow left
// pylon turn of a side-firing gunship. The heading follows the velocity at a capped yaw rate, so the hull never snaps
// round. The same slew-with-inertia idea as the orbital laser's contact (src/domain/orbital-laser.js aimLaser).
//
// UNITS. The game's planet is a UNIT sphere centred on the origin (graph.centers have length 1) and a cell is `cellSide`
// long in those units, so one cell of ground is an arc of `cellSide` radians. The track keeps its ground point as a unit
// vector and its heading as a unit tangent there; `tune` speaks CELLS (distances), cells/s (speeds), cells/s² (accel)
// and degrees/s (yaw), and `cellSide` converts. Velocity is kept in cells/s as a tangent vector at the ground point.
//
// Pure: no Three.js, no DOM, no content import. Tunables come in as `tune` (src/content/gunship.js GUNSHIP_TRACK).
import { norm3, dot3, cross3, len3 } from '../vec3.js';

const clamp1 = (x) => Math.max(-1, Math.min(1, x));
/* the arc between two directions, in radians (the vectors need not be unit); atan2 keeps it exact near zero */
export function arcBetween(a, b) { return Math.atan2(len3(cross3(a, b)), dot3(a, b)); }
/* `v` flattened into the tangent plane at unit `p` and normalised, or null when it has no tangent part */
function tangentOf(p, v) {
  const k = dot3(v, p), t = [v[0] - p[0] * k, v[1] - p[1] * k, v[2] - p[2] * k], l = len3(t);
  return l > 1e-9 ? [t[0] / l, t[1] / l, t[2] / l] : null;
}
/* any unit tangent at `p`, for a heading that has no tangent part */
function anyTangent(p) { return norm3(cross3(p, Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); }

// A track over `start` (any non-zero vector; its direction is the ground point) facing `heading` (flattened onto the
// ground there; a heading with no tangent part picks one). At rest.
export function makeTrack(start, heading) {
  const pos = norm3(start);
  return { pos, heading: tangentOf(pos, heading ?? [0, 0, 0]) ?? anyTangent(pos), vel: [0, 0, 0], speed: 0, target: null };
}

// Signed radians the heading turned from `prev` to `now` about the up direction `up` (anticlockwise seen from above is
// positive). `prev` is flattened onto the ground at `up` first, so a ground point that moved does not read as a turn.
export function headingTurn(prev, now, up) {
  const u = norm3(up), a = tangentOf(u, prev), b = tangentOf(u, now);
  if (!a || !b) return 0;
  return Math.atan2(dot3(cross3(a, b), u), clamp1(dot3(a, b)));
}

// Per breach, how many bodies stand within `radius` (sphere units, i.e. cells * cellSide) of it, measured between
// directions so a body's height off the ground does not count. points: [[x, y, z]]; bodies: [{ pos, alive }] (a body
// with alive === false is skipped, so the host can pass its whole list).
export function breachLoads(points, bodies, radius) {
  return points.map((p) => {
    const pl = len3(p) || 1;
    let n = 0;
    for (const b of bodies) {
      if (b.alive === false) continue;
      const q = b.pos, ql = len3(q) || 1;
      const dx = p[0] / pl - q[0] / ql, dy = p[1] / pl - q[1] / ql, dz = p[2] / pl - q[2] / ql;
      if (dx * dx + dy * dy + dz * dz < radius * radius) n++;
    }
    return { pos: p, enemies: n };
  });
}

// Where the track goes: the breach with the most enemies near it; ties go to the one nearest `from` (the ground point).
// No breach: `home` (over the base). `prev` (the last pick) is kept unless another breach has at least `margin` more
// enemies than it, so two breaches trading a body back and forth do not make the ship dither between them.
// breaches: [{ pos, enemies }]. Returns { pos (unit), enemies, home }.
export function pickTarget(breaches, from, home, { prev = null, margin = 0 } = {}) {
  let best = null, bestArc = Infinity;
  for (const b of breaches) {
    const d = arcBetween(from, b.pos);
    if (!best || b.enemies > best.enemies || (b.enemies === best.enemies && d < bestArc)) { best = b; bestArc = d; }
  }
  if (!best) return { pos: norm3(home), enemies: 0, home: true };
  if (prev && !prev.home && margin > 0) {
    const kept = breaches.find((b) => arcBetween(b.pos, prev.pos) < 1e-6);
    if (kept && kept !== best && best.enemies < kept.enemies + margin) return { pos: norm3(kept.pos), enemies: kept.enemies, home: false };
  }
  return { pos: norm3(best.pos), enemies: best.enemies, home: false };
}

// The host's per-frame call: pick among `breaches` ([{ pos, enemies }], see breachLoads) with the last pick kept by
// tune.switchMargin, remember the pick on the track, and step toward it. `home` is the base's ground point.
export function steerTrack(track, breaches, home, dt, tune, cellSide) {
  track.pick = pickTarget(breaches, track.pos, home, { prev: track.pick ?? null, margin: tune.switchMargin ?? 0 });
  return stepTrack(track, track.pick.pos, dt, tune, cellSide);
}

// Off station the ship is away: it keeps its place and heading for the next pass and comes back from rest.
export function parkTrack(track) { track.vel[0] = track.vel[1] = track.vel[2] = 0; track.speed = 0; return track; }

// One step of `dt` seconds toward `target` (any non-zero vector). Mutates and returns `track`.
// tune: { speedCells, accelCells, loiterCells, loiterSpeedCells, yawRateDeg }.
export function stepTrack(track, target, dt, tune, cellSide) {
  if (!(dt > 0) || !(cellSide > 0)) return track;
  const p = track.pos, g = norm3(target), top = tune.speedCells, acc = tune.accelCells, ring = Math.max(0, tune.loiterCells);
  track.target = g;
  const e = arcBetween(p, g) / cellSide - ring;   // cells to the loiter circle: + outside it, - inside
  // the local frame: `inward` along the great circle to the target (on top of it: back along the heading, so the ship
  // flies on out), `round` the orbit's way, anticlockwise seen from above
  const inward = tangentOf(p, g) ?? [-track.heading[0], -track.heading[1], -track.heading[2]];
  const round = cross3(inward, p);
  // the velocity it wants: onto the circle on the braking curve, and round it once near it
  // (the braking curve in its stepped form, a·dt·(sqrt(1/4 + 2|e|/(a·dt²)) - 1/2), which stops on the circle in whole
  // steps; it tends to sqrt(2·a·|e|) as dt shrinks)
  const vr = Math.sign(e) * Math.min(top, acc * dt * (Math.sqrt(0.25 + 2 * Math.abs(e) / (acc * dt * dt)) - 0.5));
  const vt = (tune.loiterSpeedCells ?? 0) * Math.max(0, 1 - Math.abs(e) / Math.max(1e-6, ring || 1));
  const want = [inward[0] * vr + round[0] * vt, inward[1] * vr + round[1] * vt, inward[2] * vr + round[2] * vt];
  const wl = len3(want); if (wl > top) for (let k = 0; k < 3; k++) want[k] *= top / wl;
  // inertia: the velocity moves toward the wanted one by at most accel * dt (convex, so it never exceeds the top speed)
  const v = track.vel, dv = [want[0] - v[0], want[1] - v[1], want[2] - v[2]], dl = len3(dv), cap = acc * dt;
  const f = dl > cap ? cap / dl : 1;
  for (let k = 0; k < 3; k++) v[k] += dv[k] * f;
  // NEVER THROUGH THE CIRCLE: the radial part of this step stops on it, from either side
  const along = dot3(v, inward) * dt;
  if ((e > 0 && along > e) || (e < 0 && along < e)) {
    const cut = (along - e) / dt;
    for (let k = 0; k < 3; k++) v[k] -= inward[k] * cut;
  }
  // move along the great circle by the step, carrying the velocity and the heading onto the new ground
  const sl = len3(v) * dt;
  if (sl > 1e-12) {
    const dir = [v[0] * dt / sl, v[1] * dt / sl, v[2] * dt / sl], th = sl * cellSide, c = Math.cos(th), s = Math.sin(th);
    const carry = (w) => { const a = dot3(w, dir); return [w[0] + dir[0] * (c - 1) * a - p[0] * s * a, w[1] + dir[1] * (c - 1) * a - p[1] * s * a, w[2] + dir[2] * (c - 1) * a - p[2] * s * a]; };
    const np = norm3([p[0] * c + dir[0] * s, p[1] * c + dir[1] * s, p[2] * c + dir[2] * s]);
    const nv = carry(v), nh = carry(track.heading);
    track.pos = np;
    const vt2 = tangentOf(np, nv), vl = len3(v);
    track.vel = vt2 ? [vt2[0] * vl, vt2[1] * vl, vt2[2] * vl] : [0, 0, 0];
    track.heading = tangentOf(np, nh) ?? anyTangent(np);
  }
  track.speed = len3(track.vel);
  // the heading turns toward the travel at no more than the yaw rate
  if (track.speed > 1e-3) {
    const up = track.pos, h = track.heading, w = norm3(track.vel);
    const ang = Math.atan2(dot3(cross3(h, w), up), clamp1(dot3(h, w)));
    const lim = (tune.yawRateDeg * Math.PI / 180) * dt, st = Math.max(-lim, Math.min(lim, ang));
    const ph = cross3(up, h), c = Math.cos(st), s = Math.sin(st);
    track.heading = norm3([h[0] * c + ph[0] * s, h[1] * c + ph[1] * s, h[2] * c + ph[2] * s]);
  }
  return track;
}
