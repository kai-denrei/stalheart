// The boss arena's geometry (the Nih-Dairia lab's next round, spec 2026-10-08-boss-fight-next-round-design.md, section 3):
// six obstacles, rocks (vertical cylinders) and walls (boxes), on the frame's ground plane [x, z] in local metres. Pure: arrays
// and plain objects in and out, nothing imported. The tank's blocker (`blockAt`), the creature's tangent routing (`route`), the
// push-out of the soft body's nodes (`pushOut`), the nuke's destruction (`destroyIn`, `restore`) and a respawn that turns clear
// of them (`clearSpawn`). The layout comes from BOSS_FIGHT.arena (src/content/boss-fight.js); `makeArena` copies it.
const RAD = Math.PI / 180;
const live = (shapes) => shapes.filter((s) => s.live);

// the working copy of the layout: every entry (and its arrays) copied, `live: true`; the frozen content is never touched
export const makeArena = (layout) => layout.map((s) => ({ ...s, at: [...s.at], ...(s.size ? { size: [...s.size] } : {}), live: true }));

// the signed distance from p to the shape's footprint (negative inside) and the outward normal at the nearest boundary point
export function footprint(shape, p) {
  const dx = p[0] - shape.at[0], dz = p[1] - shape.at[1];
  if (shape.kind === 'rock') {
    const len = Math.hypot(dx, dz);
    return { d: len - shape.radius, n: len > 1e-12 ? [dx / len, dz / len] : [1, 0] };
  }
  // a wall: the box centred on `at`, its length along (cos yaw, sin yaw); work in its own axes u (along) and v (across)
  const c = Math.cos(shape.yaw * RAD), s = Math.sin(shape.yaw * RAD);
  const u = dx * c + dz * s, v = -dx * s + dz * c;
  const qu = Math.abs(u) - shape.size[0] / 2, qv = Math.abs(v) - shape.size[1] / 2;
  const su = u < 0 ? -1 : 1, sv = v < 0 ? -1 : 1;
  let d, nu, nv;
  if (qu > 0 && qv > 0) { d = Math.hypot(qu, qv); nu = su * qu / d; nv = sv * qv / d; }   // off a corner
  else if (qu > qv) { d = qu; nu = su; nv = 0; }                                          // nearest face is an end (inside or beside it)
  else { d = qv; nu = 0; nv = sv; }                                                       // nearest face is a side
  return { d, n: [nu * c - nv * s, nu * s + nv * c] };
}

// the live shape a circle of radius r at (x, z) sinks deepest into: the push to take it out along the normal, or null
export function blockAt(x, z, r, shapes) {
  let best = null;
  for (const sh of live(shapes)) {
    const f = footprint(sh, [x, z]), depth = r - f.d;
    if (depth > 0 && (!best || depth > best.depth)) best = { nx: f.n[0], nz: f.n[1], depth };
  }
  return best;
}

// the waypoint's radius is the clearance plus this margin, so the creature passes the edge instead of converging to it
const PASS = 1.02;

// how far round the waypoint circle a centre already on it is sent, in radians: a few metres of arc, so the point is ahead of c
// (never c itself, where clamped or proportional steering would stall) and the next call finds c near the circle again
const AHEAD = 0.3;

// the tangent point from c to the circle (o, R) on the shorter side toward the target, or, when c is already inside it (R here is
// the waypoint's radius, already past the clearance), the point AHEAD radians round that circle from c's own bearing, on the side
// whose point lies nearer the target
function around(c, target, o, R) {
  const ox = c[0] - o[0], oz = c[1] - o[1], dc = Math.hypot(ox, oz);
  if (dc <= R) {
    const th0 = Math.atan2(oz, ox);   // dc > 0: a centre at the shape's own centre is never crossed (its dot product is zero)
    let best = null, bestLen = Infinity;
    for (const k of [1, -1]) {
      const w = [o[0] + R * Math.cos(th0 + k * AHEAD), o[1] + R * Math.sin(th0 + k * AHEAD)];
      const len = Math.hypot(w[0] - target[0], w[1] - target[1]);
      if (len < bestLen) { bestLen = len; best = w; }
    }
    return best;
  }
  const th = Math.atan2(oz, ox), a = Math.acos(R / dc);
  let best = null, bestLen = Infinity;
  for (const k of [-1, 1]) {
    const w = [o[0] + R * Math.cos(th + k * a), o[1] + R * Math.sin(th + k * a)];
    const len = Math.hypot(c[0] - w[0], c[1] - w[1]) + Math.hypot(w[0] - target[0], w[1] - target[1]);
    if (len < bestLen) { bestLen = len; best = w; }
  }
  return best;
}

// where the creature should head: the target, or the waypoint round the nearest live shape (a rock by its radius, a wall by half
// its length, both inflated by `clear` to R) that the segment c -> target crosses. One waypoint at a time. Two rules:
// (1) a centre inside R counts as crossing only while the target lies behind the shape, (target - c) . (c - o) < 0; a target
// leading outward leaves it uncrossed, and a centre already inside R is sent AHEAD round the waypoint circle,
// not to the point under it. The waypoint stands at R * 1.02, two percent past the edge, so the creature passes it rather than
// converging to it. (2) A shape is skipped for a target that stands within `clear` of its real footprint (footprint(...).d < clear):
// the creature must reach a tank parked by a rock (pushOut keeps the body out of the shape itself). The bounding circle does not
// decide this: a tank 10 m behind a wall's face is outside the clearance and is routed round, though inside the wall's R
export function route(c, target, shapes, clear) {
  const sx = target[0] - c[0], sz = target[1] - c[1], len2 = sx * sx + sz * sz;
  let pick = null, pickDist = Infinity;
  for (const sh of live(shapes)) {
    const R = (sh.kind === 'rock' ? sh.radius : sh.size[0] / 2) + clear;
    const ox = sh.at[0] - c[0], oz = sh.at[1] - c[1], dc = Math.hypot(ox, oz);
    if (footprint(sh, target).d < clear) continue;           // the target is within the clearance of the real footprint: approach it
    let crosses = false;
    if (dc < R) crosses = sx * ox + sz * oz > 0;             // c inside the inflated circle: crossed only while the target lies behind the shape
    else if (len2 > 1e-12) {
      const t = (ox * sx + oz * sz) / len2;                  // the closest point must lie between the ends
      crosses = t > 0 && t < 1 && Math.hypot(ox - t * sx, oz - t * sz) < R;
    }
    if (crosses && dc < pickDist) { pickDist = dc; pick = { sh, R: R * PASS }; }
  }
  return pick ? around(c, target, pick.sh.at, pick.R) : [target[0], target[1]];
}

// the moves that take the body's nodes out of the live shapes: `pos` is flat [x, y, z, ...] in local metres; a node under a
// shape's height and inside its footprint goes to the boundary along the outward normal (one move per node, the deepest shape)
export function pushOut(pos, shapes) {
  const moves = [], ls = live(shapes);
  for (let i = 0; i * 3 + 2 < pos.length; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let best = null;
    for (const sh of ls) {
      if (y >= sh.height) continue;
      const f = footprint(sh, [x, z]);
      if (f.d < 0 && (!best || f.d < best.d)) best = f;
    }
    if (best) moves.push({ i, x: x - best.n[0] * best.d, z: z - best.n[1] * best.d, nx: best.n[0], nz: best.n[1] });
  }
  return moves;
}

// the nuke lands at `at` with `radius`: every live breakable whose footprint comes within it is gone; the ids
export function destroyIn(shapes, at, radius) {
  const ids = [];
  for (const sh of live(shapes)) if (sh.breakable && footprint(sh, at).d < radius) { sh.live = false; ids.push(sh.id); }
  return ids;
}

export function restore(shapes) { for (const sh of shapes) sh.live = true; }

// IN PLACE. A round's reset puts every shape back at once; a reset that leaves the creature and the tank where they stand must not stand a
// shape up inside either. `occupants` are circles { at: [x, z], radius }; a shape is clear of one when its footprint lies at least
// `radius` from the centre.
const clearOf = (sh, occupants) => occupants.every((o) => footprint(sh, o.at).d >= o.radius);
// stands up the dead shapes that are clear of every occupant; the ids still dead (they come back at the next round's restore)
export function restoreClear(shapes, occupants) {
  const left = [];
  for (const sh of shapes) if (!sh.live) { if (clearOf(sh, occupants)) sh.live = true; else left.push(sh.id); }
  return left;
}
// takes down the standing shapes that are not clear of an occupant (the obstacles switch coming on over a creature that moved while
// it was off); the ids taken down, which come back at the next round's restore
export function withdrawFrom(shapes, occupants) {
  const gone = [];
  for (const sh of shapes) if (sh.live && !clearOf(sh, occupants)) { sh.live = false; gone.push(sh.id); }
  return gone;
}

// a respawn point clear of the shapes by the hull: the point, or turned about the origin by +10, -10, +20, ... degrees to the
// first clear bearing (at most 36 steps; the original point when none is clear)
export function clearSpawn(point, shapes, r) {
  if (!blockAt(point[0], point[1], r, shapes)) return [point[0], point[1]];
  for (let k = 1; k <= 36; k++) {
    const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10 * RAD, c = Math.cos(a), s = Math.sin(a);
    const x = point[0] * c - point[1] * s, z = point[0] * s + point[1] * c;
    if (!blockAt(x, z, r, shapes)) return [x, z];
  }
  return [point[0], point[1]];
}
