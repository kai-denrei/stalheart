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
// ROUND FOUR (owner, 2026-10-13: "enemies clipping through walls when there are too many"): the rock and the walls are DRAWN as the board's quads
// (src/fx/board-surface.js extrudes each BLOCKED cell's quad), not as the nearest-centre regions the records walk by; on Stalberg's irregular quads
// the two differ by a metre or two in places, and a crowd presses its bodies against the walls where the drawn quad reaches past the region. With the
// board's `quads` and `vertices` (createReachQuery's optional arguments) a point is blocked when it is on a BLOCKED cell's region OR inside a
// BLOCKED cell's drawn quad (the quad that holds it: its nearest cell's, else one sharing a corner with it), and the clearance's distance to a
// BLOCKED cell is the nearer of its region's and its quad's (the quad's exact, in the plane through the mapping's derivative at the point).
//   quadOf(cell, p)                                 the cell whose drawn quad holds the unit point p, looked for from `cell` (-1 when none is found)

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

export function createReachQuery({ adj, centers, blocked, step, quads = null, vertices = null }) {
  const drawn = quads && vertices ? createQuads(quads, vertices, adj) : null;
  // round four: on the rock by the region or by the drawn quad
  const blockedAt = drawn ? (cell, p) => { if (blocked(cell)) return true; const q = drawn.quadOf(cell, p); return q >= 0 && q !== cell && blocked(q); } : (cell) => blocked(cell);
  const query = (toSphere, x, z, dx, dz, max, hint = query.cell) => {
    let cur = hint ?? 0;
    const free = freeReach(x, z, dx, dz, max, step, (sx, sz) => { const p = toSphere(sx, sz); cur = nearestCellFrom(adj, centers, cur, p); return blockedAt(cur, p); });
    query.cell = cur;
    return free;
  };
  query.cell = 0;
  query.at = (toSphere, x, z, hint = query.cell) => { const p = toSphere(x, z); query.cell = nearestCellFrom(adj, centers, hint ?? 0, p); return blockedAt(query.cell, p); };
  query.quadOf = drawn ? drawn.quadOf : () => -1;
  query.clearance = createClearance(adj, centers, blocked, query, drawn);
  return query;
}

// round four: the board's drawn quads. Each cell's quad (its four vertices' unit directions, oriented so the inside is to the left of every edge seen
// from outside the sphere) and its edges' planes through the sphere's centre, made on first use; a vertex's cells, for the quads sharing a corner;
// the cell across each edge (`across`: the neighbour sharing the edge's two vertices, -1 at none).
function createQuads(quads, vertices, adj) {
  const n = quads.length, edge = new Float64Array(n * 12), vert = new Float64Array(n * 12), done = new Uint8Array(n), over = new Int32Array(n * 4);
  let corner = null;
  function make(c) {
    if (done[c]) return c * 12;
    const q = quads[c], k = c * 12;
    for (let i = 0; i < 4; i++) { const v = vertices[q[i]], l = Math.hypot(v[0], v[1], v[2]) || 1; vert[k + i * 3] = v[0] / l; vert[k + i * 3 + 1] = v[1] / l; vert[k + i * 3 + 2] = v[2] / l; }
    // the quad's winding: its normal (the sum of its edges' crosses) against its centre's direction
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < 4; i++) { const a = k + i * 3, b = k + ((i + 1) % 4) * 3; sx += vert[a + 1] * vert[b + 2] - vert[a + 2] * vert[b + 1]; sy += vert[a + 2] * vert[b] - vert[a] * vert[b + 2]; sz += vert[a] * vert[b + 1] - vert[a + 1] * vert[b]; }
    const sign = sx * vert[k] + sy * vert[k + 1] + sz * vert[k + 2] >= 0 ? 1 : -1;
    for (let i = 0; i < 4; i++) { const a = k + i * 3, b = k + ((i + 1) % 4) * 3; edge[k + i * 3] = sign * (vert[a + 1] * vert[b + 2] - vert[a + 2] * vert[b + 1]); edge[k + i * 3 + 1] = sign * (vert[a + 2] * vert[b] - vert[a] * vert[b + 2]); edge[k + i * 3 + 2] = sign * (vert[a] * vert[b + 1] - vert[a + 1] * vert[b]); }
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; over[c * 4 + i] = -1; for (const nb of adj[c]) { const r = quads[nb]; if (r.includes(a) && r.includes(b)) { over[c * 4 + i] = nb; break; } } }
    done[c] = 1;
    return k;
  }
  const across = (c, i) => over[c * 4 + i];
  const holds = (c, p) => { const k = make(c); for (let i = 0; i < 4; i++) if (edge[k + i * 3] * p[0] + edge[k + i * 3 + 1] * p[1] + edge[k + i * 3 + 2] * p[2] < 0) return false; return true; };
  function quadOf(cell, p) {
    if (cell < 0 || cell >= n) return -1;
    if (holds(cell, p)) return cell;
    if (!corner) { corner = new Map(); for (let c = 0; c < n; c++) for (const v of quads[c]) { const a = corner.get(v); if (a) a.push(c); else corner.set(v, [c]); } }
    for (const v of quads[cell]) for (const c of corner.get(v)) if (c !== cell && holds(c, p)) return c;
    return -1;
  }
  return { make, vert, quadOf, holds, across };
}

// round three: the clearance of a plane point against the BLOCKED region (see the header). `q` is the reach query whose last cell it shares.
const JE = 0.25;   // metres: the plane step of the mapping's derivative
function createClearance(adj, centers, blocked, q, drawn = null) {
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
  // round four: the signed plane distance from P to cell b's drawn quad (negative inside it, that far from its nearest edge) and the unit plane
  // direction away from it into W: its corners carried into the plane at P through the mapping's derivative (the 2x2 inverse of [JX JZ])
  const QX = new Float64Array(4), QZ = new Float64Array(4);
  function quadDistance(b) {
    // the mapping as unit directions: P's and its derivative's (the tangent part over |P|)
    const k = drawn.make(b), V = drawn.vert, pl = Math.hypot(P[0], P[1], P[2]) || 1, ux = P[0] / pl, uy = P[1] / pl, uz = P[2] / pl;
    const jx = (JX[0] * ux + JX[1] * uy + JX[2] * uz), jz = (JZ[0] * ux + JZ[1] * uy + JZ[2] * uz);
    const X0 = (JX[0] - ux * jx) / pl, X1 = (JX[1] - uy * jx) / pl, X2 = (JX[2] - uz * jx) / pl, Z0 = (JZ[0] - ux * jz) / pl, Z1 = (JZ[1] - uy * jz) / pl, Z2 = (JZ[2] - uz * jz) / pl;
    const a11 = X0 * X0 + X1 * X1 + X2 * X2, a12 = X0 * Z0 + X1 * Z1 + X2 * Z2, a22 = Z0 * Z0 + Z1 * Z1 + Z2 * Z2, det = a11 * a22 - a12 * a12;
    if (!(det > 0)) return Infinity;
    for (let i = 0; i < 4; i++) {
      const wx = V[k + i * 3] - ux, wy = V[k + i * 3 + 1] - uy, wz = V[k + i * 3 + 2] - uz, r1 = wx * X0 + wy * X1 + wz * X2, r2 = wx * Z0 + wy * Z1 + wz * Z2;
      QX[i] = (a22 * r1 - a12 * r2) / det; QZ[i] = (a11 * r2 - a12 * r1) / det;
    }
    // the plane quad's winding, so an edge's inward side is known; the point (the origin) inside every edge is inside the quad
    let area = 0; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; area += QX[i] * QZ[j] - QX[j] * QZ[i]; }
    const sg = area >= 0 ? 1 : -1;
    let best = Infinity, bx = 1, bz = 0, inside = true, deep = Infinity, ox = 1, oz = 0, deepAny = Infinity, ax = 1, az = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, ex = QX[j] - QX[i], ez = QZ[j] - QZ[i], el = Math.hypot(ex, ez) || 1e-12;
      // the origin's side of the edge (positive: inward) and its outward normal; the way out of a quad the point is in is through an edge into open
      // ground (an edge shared with another BLOCKED quad leads into more rock), any edge when none is
      const side = sg * (ex * -QZ[i] - ez * -QX[i]) / el, nx = sg * ez / el, nz = -sg * ex / el, nb = drawn.across(b, i);
      if (side < 0) inside = false;
      if (side < deepAny) { deepAny = side; ax = nx; az = nz; }
      if ((nb < 0 || !blocked(nb)) && side < deep) { deep = side; ox = nx; oz = nz; }
      // the segment's nearest point to the origin
      const t = Math.max(0, Math.min(1, -(QX[i] * ex + QZ[i] * ez) / (el * el))), cx = QX[i] + ex * t, cz = QZ[i] + ez * t, d = Math.hypot(cx, cz);
      if (d < best) { best = d; bx = d > 1e-9 ? -cx / d : nx; bz = d > 1e-9 ? -cz / d : nz; }
    }
    if (inside) { if (deep === Infinity) { deep = deepAny; ox = ax; oz = az; } W[0] = ox; W[1] = oz; return -deep; }
    W[0] = bx; W[1] = bz; return best;
  }
  // a BLOCKED cell's distance: its region's lower bound, or its drawn quad's when that is nearer (W the way away from the nearer one)
  function blockDistance(b) {
    const d = regionDistance(b);
    if (!drawn || q.clearQuads === false) return d;   // (the harness may compare without: q.clearQuads false)
    const wx = W[0], wz = W[1], dq = quadDistance(b);
    if (dq < Math.max(0, d)) return dq;
    W[0] = wx; W[1] = wz; return d;
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
      // round four: a drawn quad may hold the point (a negative distance: the move out is that much longer)
      for (const c of ring) { if (!blocked(c) || m >= DIST.length) continue; DIST[m] = blockDistance(c); WX[m] = W[0]; WZ[m] = W[1]; m++; }
      for (let k = 0; k < m; k++) if (DIST[k] < d1) { d1 = drawn ? DIST[k] : Math.max(0, DIST[k]); n1x = WX[k]; n1z = WZ[k]; }
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
