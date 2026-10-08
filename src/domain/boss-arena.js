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

// the tangent point from c to the circle (o, R) on the shorter side toward the target, or the point pushed out radially when
// c is already inside it (R here is the waypoint's radius, already past the clearance)
function around(c, target, o, R) {
  const ox = c[0] - o[0], oz = c[1] - o[1], dc = Math.hypot(ox, oz);
  if (dc <= R) {
    if (dc < 1e-12) return [o[0] + R, o[1]];
    return [o[0] + ox / dc * R, o[1] + oz / dc * R];
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
// its length, both inflated by `clear` to R) that the segment c -> target crosses. One waypoint at a time. A centre inside R counts
// as crossing only while the target lies behind the shape, (target - c) . (c - o) < 0; a target leading outward leaves it uncrossed.
// A shape whose R already holds the target is never routed round (the creature must reach a tank parked by a rock; pushOut keeps
// the body out of the rock itself). The waypoint, the radial push-out or the tangent point, stands at R * 1.02, two percent past the
// edge, so the creature passes it rather than converging to it and stalling there
export function route(c, target, shapes, clear) {
  const sx = target[0] - c[0], sz = target[1] - c[1], len2 = sx * sx + sz * sz;
  let pick = null, pickDist = Infinity;
  for (const sh of live(shapes)) {
    const R = (sh.kind === 'rock' ? sh.radius : sh.size[0] / 2) + clear;
    const ox = sh.at[0] - c[0], oz = sh.at[1] - c[1], dc = Math.hypot(ox, oz);
    if (Math.hypot(target[0] - sh.at[0], target[1] - sh.at[1]) < R) continue;   // the target is inside the clearance: approach it
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
