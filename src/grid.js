// grid.js — Stålberg organic quad grid, ported from the 2D plane
// (~/Dev/oskar-procedure/src/grid.js) to the surface of a sphere.
// Pure logic, NO DOM — unit-tests in Node. Deterministic via mulberry32(seed).
//
// Pipeline:
//   1. best-candidate blue-noise sample on S²        (src/sample.js)
//   2. spherical Delaunay = 3D convex hull           (src/hull.js)
//      NOTE: the 2D sliver filter is GONE. Dropping faces on a closed
//      surface would tear holes; the 2D version could trim its boundary,
//      a sphere has none. Slivers must be tolerated and relaxed away.
//   3. dissolve edges: merge legal triangle pairs into quads (random, tabu)
//   4. subdivide every face into quads; new vertices projected to the sphere
//   4b. normalize winding: quad's Newell normal must point outward
//   5. relax toward squareness, per-quad, in each quad's tangent plane,
//      then reproject vertices onto the sphere
//
// Geometry vs topology split: stages 3–4b touch positions only through
// legitQuad/midpoints/centroids. Those are the only places that know the
// domain is a sphere (tangent-plane projection + reprojection). The merge
// and subdivision bookkeeping is identical to the 2D version.

import { mulberry32 } from './rng.js';
import { bestCandidateSphere } from './sample.js';
import { sphericalDelaunay } from './hull.js';
import {
  sub3, add3, scale3, dot3, cross3, len3, norm3, mean3, tangentBasis,
} from './vec3.js';

const QUAD_ANGLE_MIN = 0.2 * Math.PI; // 36°  (same limits as the 2D version)
const QUAD_ANGLE_MAX = 0.9 * Math.PI; // 162°

const edgeKey = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);

// --- tangent-plane projection ----------------------------------------------
// Project 3D corners onto the tangent plane at their (normalized) centroid.
// Sphere is centered at the origin, so the surface normal at any point is
// just the normalized point. Returns { c, u, v, pts2 }.
function projectToTangent(corners) {
  const c = mean3(corners);
  const n = norm3(c);
  const [u, v] = tangentBasis(n);
  const pts2 = corners.map((p) => {
    const d = sub3(p, c);
    return [dot3(d, u), dot3(d, v)];
  });
  return { c, u, v, pts2 };
}

// --- stage 3: merge triangle pairs into quads ------------------------------
// legitQuad: same convexity + angle-range test as 2D, run in the tangent
// plane of the candidate quad's centroid.
function legitQuad(points, quad) {
  const { pts2 } = projectToTangent(quad.map((vi) => points[vi]));
  const signs = new Set();
  let minAng = Infinity;
  let maxAng = -Infinity;
  for (let i = 0; i < 4; i++) {
    const prev = pts2[(i - 1 + 4) % 4];
    const cur = pts2[i];
    const next = pts2[(i + 1) % 4];
    const d1 = [cur[0] - prev[0], cur[1] - prev[1]];
    const d2 = [next[0] - cur[0], next[1] - cur[1]];
    signs.add(Math.sign(d1[0] * d2[1] - d1[1] * d2[0]));
    const l1 = Math.hypot(d1[0], d1[1]);
    const l2 = Math.hypot(d2[0], d2[1]);
    if (l1 < 1e-12 || l2 < 1e-12) return false;
    let cos = (d1[0] * d2[0] + d1[1] * d2[1]) / (l1 * l2);
    cos = Math.max(-1, Math.min(1, cos));
    const ang = Math.acos(cos);
    if (ang < minAng) minAng = ang;
    if (ang > maxAng) maxAng = ang;
  }
  return signs.size === 1 && maxAng <= QUAD_ANGLE_MAX && minAng >= QUAD_ANGLE_MIN;
}

// Tabu-driven random merge, INCREMENTAL version. Semantics match the 2D
// original — pick a uniformly random mergeable edge, merge if the quad is
// legit (and passes quadBias), else tabu it forever — but instead of
// rebuilding edge counts and rescanning the triangle list per merge
// (≈O(n²) total, 92% of generation time at n=8000), it maintains an
// edge→incident-triangles map and a candidate pool with O(1) swap-remove
// random picks. When a pair merges, only the 5 edges of the two dead
// triangles change state. Total ≈O(n). Note: consumes the rng stream
// differently than the old implementation, so the same seed produces a
// different (equally valid) board than pre-incremental builds.
function mergeToQuads(points, triangles, rng, quadBias = 1) {
  const alive = new Uint8Array(triangles.length).fill(1);

  // edge key -> indices of incident triangles (exactly 2 on a closed mesh)
  const edgeTris = new Map();
  for (let ti = 0; ti < triangles.length; ti++) {
    const t = triangles[ti];
    for (let i = 0; i < 3; i++) {
      const key = edgeKey(t[i], t[(i + 1) % 3]);
      let list = edgeTris.get(key);
      if (list === undefined) { list = []; edgeTris.set(key, list); }
      list.push(ti);
    }
  }

  // candidate pool: every edge with exactly 2 live triangles. Array with a
  // key->position index for O(1) uniform pick and O(1) removal.
  const pool = [];
  const poolPos = new Map();
  const poolAdd = (key) => {
    if (!poolPos.has(key)) { poolPos.set(key, pool.length); pool.push(key); }
  };
  const poolRemove = (key) => {
    const pos = poolPos.get(key);
    if (pos === undefined) return;
    const last = pool.pop();
    poolPos.delete(key);
    if (pos < pool.length) { pool[pos] = last; poolPos.set(last, pos); }
  };
  for (const [key, list] of edgeTris) {
    if (list.length === 2) poolAdd(key);
  }

  const prequads = [];
  while (pool.length > 0) {
    const key = pool[Math.floor(rng() * pool.length)];
    const [ea, eb] = key.split('-').map(Number);
    const [ta, tb] = edgeTris.get(key);

    const opp = [];
    for (const ti of [ta, tb]) {
      for (const v of triangles[ti]) if (v !== ea && v !== eb) opp.push(v);
    }
    const candQuad = [ea, opp[0], eb, opp[1]];

    if (legitQuad(points, candQuad) && rng() < quadBias) {
      prequads.push(candQuad);
      alive[ta] = 0;
      alive[tb] = 0;
      // every edge of the dead pair leaves the pool: the shared edge is
      // consumed, the other four now border at most one live triangle
      for (const ti of [ta, tb]) {
        const t = triangles[ti];
        for (let i = 0; i < 3; i++) poolRemove(edgeKey(t[i], t[(i + 1) % 3]));
      }
    } else {
      poolRemove(key); // tabu
    }
  }

  const leftover = [];
  for (let ti = 0; ti < triangles.length; ti++) {
    if (alive[ti]) leftover.push(triangles[ti].slice());
  }
  return { triangles: leftover, prequads };
}

// --- stage 4: subdivide every face into quads ------------------------------
// Identical bookkeeping to 2D; midpoints and centroids are computed as 3D
// means, then pushed out onto the sphere so every vertex stays on-surface.
function subdivide(points, faces, radius) {
  const vertices = points.map((p) => p.slice());
  const midCache = new Map();

  const onSphere = (p) => scale3(norm3(p), radius);

  const midpointIndex = (a, b) => {
    const key = edgeKey(a, b);
    let mi = midCache.get(key);
    if (mi === undefined) {
      const m = onSphere(mean3([vertices[a], vertices[b]]));
      mi = vertices.length;
      vertices.push(m);
      midCache.set(key, mi);
    }
    return mi;
  };

  const quads = [];
  for (const face of faces) {
    const n = face.length; // 3 or 4
    const centroid = onSphere(mean3(face.map((vi) => vertices[vi])));
    const ci = vertices.length;
    vertices.push(centroid);

    const edges = [];
    for (let i = 0; i < n; i++) edges.push([face[i], face[(i + 1) % n]]);

    for (let j = 0; j < n; j++) {
      const e1 = edges[j];
      const e2 = edges[(j + 1) % n];
      const m1 = midpointIndex(e1[0], e1[1]);
      const m2 = midpointIndex(e2[0], e2[1]);
      let corner = e1[0];
      if (!e2.includes(corner)) corner = e1[1];
      quads.push([corner, m1, ci, m2]);
    }
  }

  return { vertices, quads };
}

// --- stage 4b: normalize winding -------------------------------------------
// 2D used signed area (+ = CCW). The spherical equivalent: the quad's Newell
// normal must point away from the sphere center (outward). Guarantees a
// consistent orientation for rendering and for the relax step's CW-read.
function normalizeWinding(vertices, quads) {
  for (const q of quads) {
    const n = [0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const a = vertices[q[i]];
      const b = vertices[q[(i + 1) % 4]];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const c = mean3(q.map((vi) => vertices[vi]));
    if (dot3(n, c) < 0) q.reverse();
  }
}

// --- public: generateSphereMesh --------------------------------------------
// -> { vertices: [x,y,z][] on sphere, quads: [i0..i3][] outward-CCW,
//      radius, seed, defaultSide }
export function generateSphereMesh({
  seed = 0, n = 600, k = 12, radius = 1, quadBias = 1,
} = {}) {
  const rng = mulberry32(seed);
  const points = bestCandidateSphere(rng, { n, k }).map((p) => scale3(p, radius));
  const triangles = sphericalDelaunay(points);
  const { triangles: leftover, prequads } = mergeToQuads(points, triangles, rng, quadBias);
  const faces = [...leftover, ...prequads];
  const { vertices, quads } = subdivide(points, faces, radius);
  normalizeWinding(vertices, quads);

  // Equal-area estimate of the target cell side: 4πR² spread over quadCount.
  const defaultSide = Math.sqrt((4 * Math.PI * radius * radius) / quads.length);

  return { vertices, quads, radius, seed, defaultSide };
}

// --- stage 5: relaxation ---------------------------------------------------
// The 2D closed-form closest-square fit, run per quad in its own tangent
// plane. The alpha formula expects corners ordered CLOCKWISE in the frame it
// operates in (RISK 1 of the 2D port). Winding is outward-CCW in 3D, but the
// projected 2D orientation depends on the tangent basis handedness — so we
// check the projected signed area and reverse when needed rather than assume.
//
// After forces apply, every vertex is reprojected onto the sphere. The relax
// therefore optimizes squareness *of the tangent-plane shadow*, subject to
// the on-sphere constraint — "squareness of a spherical quad" made concrete.
export function relaxStep(mesh, { SIDE_LENGTH = null, PULL_RATE = 0.3 } = {}) {
  const { vertices, quads, radius } = mesh;
  const side = SIDE_LENGTH ?? mesh.defaultSide;
  const r = side / Math.SQRT2;

  const forces = vertices.map(() => [0, 0, 0]);

  for (const quad of quads) {
    const corners3 = quad.map((vi) => vertices[vi]);
    const { c, u, v, pts2 } = projectToTangent(corners3);

    // signed area of the projected quad in the (u,v) frame
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const a = pts2[i];
      const b = pts2[(i + 1) % 4];
      area += a[0] * b[1] - b[0] * a[1];
    }
    // order for the formula: clockwise in the (u,v) frame
    const order = area > 0 ? [quad[0], quad[3], quad[2], quad[1]] : quad.slice();
    const q2 = (area > 0 ? [pts2[0], pts2[3], pts2[2], pts2[1]] : pts2.slice());

    let denom = q2[0][0] - q2[1][1] - q2[2][0] + q2[3][1];
    const num = q2[0][1] + q2[1][0] - q2[2][1] - q2[3][0];
    const s = Math.sign(denom) || 1;
    denom = s * Math.max(1e-10, Math.abs(denom));

    let alpha = Math.atan(num / denom);
    if (Math.cos(alpha) * denom + Math.sin(alpha) * num < 0) alpha += Math.PI;

    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    const target = [
      [r * ca, r * sa],
      [r * sa, -r * ca],
      [-r * ca, -r * sa],
      [-r * sa, r * ca],
    ];

    for (let i = 0; i < 4; i++) {
      const fx = target[i][0] - q2[i][0];
      const fy = target[i][1] - q2[i][1];
      // back to 3D: force lives in the tangent plane
      const f3 = add3(scale3(u, fx), scale3(v, fy));
      const vi = order[i];
      forces[vi][0] += f3[0];
      forces[vi][1] += f3[1];
      forces[vi][2] += f3[2];
    }
  }

  let totalDisp = 0;
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i];
    const before = [p[0], p[1], p[2]];
    p[0] += forces[i][0] * PULL_RATE;
    p[1] += forces[i][1] * PULL_RATE;
    p[2] += forces[i][2] * PULL_RATE;
    // constraint: back onto the sphere
    const l = len3(p) || 1;
    const f = radius / l;
    p[0] *= f; p[1] *= f; p[2] *= f;
    totalDisp += Math.hypot(p[0] - before[0], p[1] - before[1], p[2] - before[2]);
  }
  return totalDisp;
}

export function relax(mesh, { n_iters = 100, ...params } = {}) {
  let disp = 0;
  for (let i = 0; i < n_iters; i++) disp = relaxStep(mesh, params);
  return disp;
}

// --- diagnostics -----------------------------------------------------------
// Per-quad RMS distance of the projected corners from their closest-square
// fit (same alpha formula), normalized by the target side. 0 = perfect grid.
export function quadErrors(mesh, { SIDE_LENGTH = null } = {}) {
  const { vertices, quads } = mesh;
  const side = SIDE_LENGTH ?? mesh.defaultSide;
  const r = side / Math.SQRT2;
  const errs = new Float64Array(quads.length);

  for (let qi = 0; qi < quads.length; qi++) {
    const quad = quads[qi];
    const { pts2 } = projectToTangent(quad.map((vi) => vertices[vi]));
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const a = pts2[i];
      const b = pts2[(i + 1) % 4];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const q2 = area > 0 ? [pts2[0], pts2[3], pts2[2], pts2[1]] : pts2.slice();

    let denom = q2[0][0] - q2[1][1] - q2[2][0] + q2[3][1];
    const num = q2[0][1] + q2[1][0] - q2[2][1] - q2[3][0];
    const s = Math.sign(denom) || 1;
    denom = s * Math.max(1e-10, Math.abs(denom));
    let alpha = Math.atan(num / denom);
    if (Math.cos(alpha) * denom + Math.sin(alpha) * num < 0) alpha += Math.PI;
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    const target = [
      [r * ca, r * sa],
      [r * sa, -r * ca],
      [-r * ca, -r * sa],
      [-r * sa, r * ca],
    ];
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += (target[i][0] - q2[i][0]) ** 2 + (target[i][1] - q2[i][1]) ** 2;
    }
    errs[qi] = Math.sqrt(sum / 4) / side;
  }
  return errs;
}

export function squarenessError(mesh, opts = {}) {
  const errs = quadErrors(mesh, opts);
  let total = 0;
  for (const e of errs) total += e;
  return total / errs.length;
}

// Valence of every vertex (number of incident quads == incident edges on a
// closed all-quad mesh). Defects (valence ≠ 4) are topologically forced:
// Σ(4 − valence) = 8 on a sphere.
export function valences(mesh) {
  const val = new Array(mesh.vertices.length).fill(0);
  for (const q of mesh.quads) for (const vi of q) val[vi]++;
  return val;
}
