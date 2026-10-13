// THE BODIES' REACH AGAINST ROCK AND WALL (owner, 2026-10-13, the Pearl set in the story: "the cutis animation clips through walls, that's not good, we
// need a method to have their feeling/scouting appendage be constrained by the rocks/walls"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md,
// "Round 2"). A Cutis body plans its hop in a flat plane (src/fx/cutis-maku/swarm.js: each seeking stalk a direction and a reach from the body's origin,
// the anchor at the chosen stalk's end, the transfer the straight line to it); the board is a cell graph whose BLOCKED cells are ROCK and WALL. These
// are the plane's queries against it. Pure: the graph, the blocked test and the plane-to-sphere mapping come in as arguments.
//   freeReach(x, z, dx, dz, max, step, blocked)   the distance along (dx, dz) from (x, z) to the first blocked point, `max` if the segment is clear:
//                                                  sampled at whole multiples of `step` and at `max` (the start itself is not tested; the grid does not
//                                                  depend on `max`, so a shorter look along the same ray samples a subset of a longer one's points), the
//                                                  boundary refined by bisection
//   nearestCellFrom(adj, centers, start, p)       the cell whose centre is nearest the unit point p, by greedy descent over the graph from `start`,
//                                                  the neighbours' neighbours looked at before it stops (the samples along a stalk are a step or two apart)
//   createReachQuery({ adj, centers, blocked, step })  -> query(toSphere, x, z, dx, dz, max, hint): freeReach in a plane whose points map onto the
//                                                  sphere through toSphere(x, z) -> unit point, `hint` a cell near (x, z) (the body's record's); the
//                                                  query keeps the last cell it found as the next walk's start (query.cell);
//                                                  query.at(toSphere, x, z, hint) is whether the plane point itself is on a blocked cell
// ROUND THREE (owner, 2026-10-13: "not bad. there is still some clipping of the Cutis-Pearl through the walls"; the spec's "Round 3"): the stalks were
// held off the rock, the bodies were not (a body ~1.2 radii wide settling on an anchor held 0.6 radii clear, a re-placed or knocked body, a puddle).
//   query.clearance(toSphere, x, z, max, hint, out)  how far the plane point is from the BLOCKED region, and which way is away from it, written into
//                                                  out [d1, n1x, n1z, d2, n2x, n2z]: d1 the plane metres to the nearest blocked cell (negative: the point is
//                                                  on one, that far from open ground), (n1x, n1z) the unit plane direction away from it; d2, n2 the
//                                                  same for the nearest blocked cell facing it (its direction within ~45 degrees of -n1: a corridor's far
//                                                  wall; Infinity and -n1 when there is none). d1 at most `max`, itself at most 2.2 cell spacings. The
//                                                  cells looked at are those whose centres are within max + 1.5 spacings, walked over the graph from the
//                                                  point's cell (the board's quads meet up to six at a corner, so a cell touching the point's corner can
//                                                  be three steps round it). A cell's region is the set of points nearer its centre than any other's (the
//                                                  board's own blocked test, nearestCellFrom), so its distance is at least that of the wedge of any two of
//                                                  its faces' half-planes (the bisectors with its neighbours): a lower bound, exact off its corners (the
//                                                  body keeps a little more room near one). No allocation: the cells' unit centres and a visit stamp are
//                                                  kept per query.
//   clearPush(c, rho, out)                         one step from a clearance c (as above) for a body's footprint radius rho: out [dx, dz, room, ax, az],
//                                                  the move along n1 that puts rho of open ground on the near wall's side, or, where the facing wall is
//                                                  closer than 2 rho across (a corridor narrower than the body), the move that centres it, `room` (< rho)
//                                                  the radius that fits there and (ax, az) the axis across it
//   clearOf(clearance, x, z, rho, steps, out)      clearPush repeated where each move lands (a corner's second wall is the nearest one after the
//                                                  first move), then the clearance where it ended measured: out [dx, dz, room, ax, az, clear, first]

const BISECT = 4;

export function freeReach(x, z, dx, dz, max, step, blocked) {
  const l = Math.hypot(dx, dz);
  if (!(max > 0)) return 0;
  if (!(l > 0) || !(step > 0)) return max;
  const ux = dx / l, uz = dz / l;
  for (let k = 1, prev = 0; ; k++) {
    const d = Math.min(k * step, max);
    if (blocked(x + ux * d, z + uz * d)) {
      // the boundary between the last clear sample and this one
      let lo = prev, hi = d;
      for (let b = 0; b < BISECT; b++) { const m = (lo + hi) / 2; if (blocked(x + ux * m, z + uz * m)) hi = m; else lo = m; }
      return lo;
    }
    if (d >= max) return max;
    prev = d;
  }
}

const dotN = (c, p) => (c[0] * p[0] + c[1] * p[1] + c[2] * p[2]) / (Math.hypot(c[0], c[1], c[2]) || 1);

export function nearestCellFrom(adj, centers, start, p) {
  let cur = start >= 0 && start < centers.length ? start : 0, best = dotN(centers[cur], p);
  for (let guard = 0; guard < 512; guard++) {
    let next = cur;
    for (const nb of adj[cur]) { const d = dotN(centers[nb], p); if (d > best) { best = d; next = nb; } }
    // a local best of the graph's irregular cells is not always the nearest: the neighbours' neighbours get a look before the walk stops
    if (next === cur) for (const nb of adj[cur]) for (const nn of adj[nb]) { const d = dotN(centers[nn], p); if (d > best) { best = d; next = nn; } }
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

export function createReachQuery({ adj, centers, blocked, step }) {
  const query = (toSphere, x, z, dx, dz, max, hint = query.cell) => {
    let cur = hint ?? 0;
    const free = freeReach(x, z, dx, dz, max, step, (sx, sz) => { cur = nearestCellFrom(adj, centers, cur, toSphere(sx, sz)); return blocked(cur); });
    query.cell = cur;
    return free;
  };
  query.cell = 0;
  query.at = (toSphere, x, z, hint = query.cell) => { query.cell = nearestCellFrom(adj, centers, hint ?? 0, toSphere(x, z)); return blocked(query.cell); };
  query.clearance = createClearance(adj, centers, blocked, query);
  return query;
}

// round three: the clearance of a plane point against the BLOCKED region (see the header). `q` is the reach query whose last cell it shares.
const JE = 0.25;   // metres: the plane step of the mapping's derivative
function createClearance(adj, centers, blocked, q) {
  const n = centers.length, unit = new Float64Array(n * 3), done = new Uint8Array(n), seen = new Uint32Array(n), ring = [];
  let stamp = 0;
  const P = [0, 0, 0], JX = [0, 0, 0], JZ = [0, 0, 0];
  function u(c) { if (!done[c]) { const v = centers[c], l = Math.hypot(v[0], v[1], v[2]) || 1; unit[c * 3] = v[0] / l; unit[c * 3 + 1] = v[1] / l; unit[c * 3 + 2] = v[2] / l; done[c] = 1; } return c * 3; }
  // the signed plane distance of P from the bisector of cells a and b, positive on b's side, and its plane gradient's direction into G (unit)
  const G = [0, 0];
  function face(a, b) {
    const ia = u(a), ib = u(b);
    let nx = unit[ib] - unit[ia], ny = unit[ib + 1] - unit[ia + 1], nz = unit[ib + 2] - unit[ia + 2];
    const gx = JX[0] * nx + JX[1] * ny + JX[2] * nz, gz = JZ[0] * nx + JZ[1] * ny + JZ[2] * nz, gl = Math.hypot(gx, gz);
    if (!(gl > 0)) { G[0] = 1; G[1] = 0; return -Infinity; }
    G[0] = gx / gl; G[1] = gz / gl;
    return (P[0] * nx + P[1] * ny + P[2] * nz) / gl;
  }
  // a lower bound of the distance from P to cell b's region (> 0 outside it) and the unit plane direction from its nearest point toward P into W: the
  // distance to the wedge of its two farthest faces' half-planes (the region lies inside every one of them)
  const W = [0, 0], DIST = new Float64Array(128), WX = new Float64Array(128), WZ = new Float64Array(128);
  function regionDistance(b) {
    let da = -Infinity, db = -Infinity, ax = 1, az = 0, bx = 1, bz = 0;
    for (const x of adj[b]) { const d = face(b, x); if (d > da) { db = da; bx = ax; bz = az; da = d; ax = G[0]; az = G[1]; } else if (d > db) { db = d; bx = G[0]; bz = G[1]; } }
    W[0] = ax; W[1] = az;
    // the region lies inside both faces' half-planes (the wedge): its distance is the first face's when that face's foot is in the wedge (or the
    // second's, when its foot is in the first's half-plane: then both are the same), else the wedge's corner
    if (!(da > 0) || !(db > 0) || bx * -da * ax + bz * -da * az <= -db + 1e-9 || ax * -db * bx + az * -db * bz <= -da + 1e-9) return da;
    const det = ax * bz - az * bx;
    if (Math.abs(det) < 1e-6) return da;
    const vx = (-da * bz + az * db) / det, vz = (-ax * db + da * bx) / det, l = Math.hypot(vx, vz);
    if (!(l > 0)) return da;
    W[0] = -vx / l; W[1] = -vz / l;
    return l;
  }
  return function clearance(toSphere, x, z, max, hint, out) {
    let s = toSphere(x, z); P[0] = s[0]; P[1] = s[1]; P[2] = s[2];
    s = toSphere(x + JE, z); JX[0] = (s[0] - P[0]) / JE; JX[1] = (s[1] - P[1]) / JE; JX[2] = (s[2] - P[2]) / JE;
    s = toSphere(x, z + JE); JZ[0] = (s[0] - P[0]) / JE; JZ[1] = (s[1] - P[1]) / JE; JZ[2] = (s[2] - P[2]) / JE;
    const a = nearestCellFrom(adj, centers, hint ?? q.cell ?? 0, P);
    q.cell = a;
    // the cells round the point: a walk over the graph (at most five rings) through cells whose centres are within `max` and a cell and a half of
    // it (a blocked region within `max` has its centre there; the board's quads meet up to six at a corner, so a cell touching the point's corner
    // can be three steps round it); `max` itself at most 2.2 cell spacings (in plane metres: the angle between centres over the mapping's metre)
    const jl = Math.hypot(JX[0], JX[1], JX[2]) || 1, pl = Math.hypot(P[0], P[1], P[2]) || 1, metre = pl / jl, ia = u(a), ib = u(adj[a][0]);
    const spacing = metre * Math.hypot(unit[ib] - unit[ia], unit[ib + 1] - unit[ia + 1], unit[ib + 2] - unit[ia + 2]);
    max = Math.min(max, 2.2 * spacing);
    const reachM = max + 1.5 * spacing, px = P[0] / pl, py = P[1] / pl, pz = P[2] / pl;
    if (++stamp === 0xffffffff) { seen.fill(0); stamp = 1; }
    ring.length = 0; ring.push(a); seen[a] = stamp;
    for (let k = 0, from = 0; k < 5 && from < ring.length; k++) {
      const e = ring.length;
      for (let j = from; j < e; j++) for (const c of adj[ring[j]]) {
        if (seen[c] === stamp) continue;
        seen[c] = stamp;
        const ic = u(c);
        if (metre * Math.hypot(unit[ic] - px, unit[ic + 1] - py, unit[ic + 2] - pz) <= reachM) ring.push(c);
      }
      from = e;
    }
    let d1 = max, n1x = 1, n1z = 0, d2 = Infinity, n2x = -1, n2z = 0;
    if (blocked(a)) {
      // on the rock: the way out is into the nearest open cell's region (the distance negative)
      let exit = Infinity;
      for (const c of ring) { if (blocked(c)) continue; const d = regionDistance(c); if (d < exit) { exit = d; n1x = -W[0]; n1z = -W[1]; } }
      d1 = exit === Infinity ? -max : -Math.max(0, exit); n2x = -n1x; n2z = -n1z;
    } else {
      let m = 0;
      for (const c of ring) { if (!blocked(c) || m >= DIST.length) continue; DIST[m] = regionDistance(c); WX[m] = W[0]; WZ[m] = W[1]; m++; }
      for (let k = 0; k < m; k++) if (DIST[k] < d1) { d1 = Math.max(0, DIST[k]); n1x = WX[k]; n1z = WZ[k]; }
      n2x = -n1x; n2z = -n1z;
      for (let k = 0; k < m; k++) if (DIST[k] < d2 && WX[k] * n1x + WZ[k] * n1z < -0.7) { d2 = Math.max(0, DIST[k]); n2x = WX[k]; n2z = WZ[k]; }
    }
    out[0] = Math.min(max, d1); out[1] = n1x; out[2] = n1z; out[3] = d2; out[4] = n2x; out[5] = n2z;
    return out;
  };
}

export function clearPush(c, rho, out = [0, 0, 0, 0, 0]) {
  const d1 = c[0], n1x = c[1], n1z = c[2], d2 = c[3], dot = n1x * c[4] + n1z * c[5];
  out[0] = 0; out[1] = 0; out[2] = rho; out[3] = n1x; out[4] = n1z;
  if (d1 >= rho) return out;
  // the far wall facing the near one: the corridor's width across n1
  const w = dot < -0.7 ? d1 + d2 * -dot : Infinity;
  const m = w < 2 * rho ? w / 2 - d1 : rho - d1;
  out[0] = n1x * m; out[1] = n1z * m; out[2] = w < 2 * rho ? Math.max(0, w / 2) : rho;
  return out;
}

// round three: at most `steps` moves of clearPush, each from a fresh `clearance(x, z, max, out)`: out [dx, dz, room, ax, az, clear, first] the whole
// move, the radius that fits where it ends, the squeeze axis (the nearest wall's direction at the start), the clearance where the move ends (as far
// as it was looked: up to 2 rho) and at the start
const PUSH = [0, 0, 0, 0, 0], CLR = [0, 0, 0, 0, 0, 0];
export function clearOf(clearance, x, z, rho, steps = 3, out = [0, 0, 0, 0, 0, 0, 0]) {
  let px = x, pz = z, room = rho, clear = rho, moved = false;
  for (let k = 0; k < steps; k++) {
    clearance(px, pz, rho * 2, CLR);
    if (k === 0) { out[3] = CLR[1]; out[4] = CLR[2]; out[6] = CLR[0]; }
    clear = CLR[0]; moved = false;
    if (CLR[0] >= rho - 1e-6) { room = rho; break; }
    clearPush(CLR, rho, PUSH);
    px += PUSH[0]; pz += PUSH[1]; room = PUSH[2]; moved = true;
    if (PUSH[2] < rho) break;   // a corridor narrower than the body: centred, nothing better to find
  }
  // the clearance where the move ended, measured (a third wall, a funnel's sides not parallel), and the room no more than it
  if (moved) { clearance(px, pz, rho * 2, CLR); clear = CLR[0]; room = Math.min(room, clear); }
  out[0] = px - x; out[1] = pz - z; out[2] = room; out[5] = clear;
  return out;
}
