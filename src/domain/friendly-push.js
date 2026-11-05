// THE HULL PUSHES THE FRIENDLIES ASIDE (owner, 2026-11-05, round 8 note 3: "collision between friendly units: the tank bumping into mechs,
// cheetah, etc. should push them aside"). Pure: the hull is an oriented box on the tangent plane at its point (centre `hull.pos`, its facing
// `hull.dir`, `halfLength` along it, `halfWidth` across), and a friendly point inside that box grown by `pad` is moved out of it by the least
// move (src/domain/hull-bodies.js boxContact, the same oriented test the Pearl bodies get), or, when the caller's `free(p)` refuses that place
// (a building, off the roam), by the next shortest of the box's four sides; when no side is free the least move stands (never inside the hull).
// The point keeps its length (a unit point stays on the unit sphere). The hull is not slowed or turned by what it pushes.
//   pushOut(p, hull, { halfLength, halfWidth, pad = 0, free = null }) -> null (p is clear of the box) or { pos: [x, y, z], depth } (depth: how far it moved)
//   inHull(p, hull, { halfLength, halfWidth, pad = 0 }) -> the point's depth inside the grown box (0: outside), the harness's measure
import { boxContact } from './hull-bodies.js';

const XS = new Float64Array(1), ZS = new Float64Array(1), OUT = [0, 0, 0], OVER = 1.001;

// the tangent frame at the hull: n up, f its facing laid on the plane, r across; p's local (x across, z along) about the hull's point
function frame(p, hull) {
  const [hx, hy, hz] = hull.pos, hl = Math.hypot(hx, hy, hz) || 1, n = [hx / hl, hy / hl, hz / hl];
  let [fx, fy, fz] = hull.dir; const fn = fx * n[0] + fy * n[1] + fz * n[2]; fx -= fn * n[0]; fy -= fn * n[1]; fz -= fn * n[2];
  const fl = Math.hypot(fx, fy, fz); if (!(fl > 1e-12)) return null;
  fx /= fl; fy /= fl; fz /= fl;
  const r = [n[1] * fz - n[2] * fy, n[2] * fx - n[0] * fz, n[0] * fy - n[1] * fx];   // n x f
  const dx = p[0] - hx, dy = p[1] - hy, dz = p[2] - hz;
  return { f: [fx, fy, fz], r, x: dx * r[0] + dy * r[1] + dz * r[2], z: dx * fx + dy * fy + dz * fz };
}

export function inHull(p, hull, { halfLength, halfWidth, pad = 0 }) {
  const fr = hull?.pos && hull?.dir ? frame(p, hull) : null; if (!fr) return 0;
  return Math.max(0, Math.min(halfWidth + pad - Math.abs(fr.x), halfLength + pad - Math.abs(fr.z)));
}

export function pushOut(p, hull, { halfLength, halfWidth, pad = 0, free = null }) {
  const fr = hull?.pos && hull?.dir ? frame(p, hull) : null; if (!fr) return null;
  const hw = halfWidth + pad, hl = halfLength + pad;
  XS[0] = fr.x; ZS[0] = fr.z;
  boxContact({ x: 0, z: 0, ux: 0, uz: 1, hl, hw }, XS, ZS, 1, OUT);
  if (!(OUT[0] > 0)) return null;
  const l = Math.hypot(p[0], p[1], p[2]) || 1;
  const at = (mx, mz) => { const q = [p[0] + fr.r[0] * mx + fr.f[0] * mz, p[1] + fr.r[1] * mx + fr.f[1] * mz, p[2] + fr.r[2] * mx + fr.f[2] * mz], k = l / (Math.hypot(q[0], q[1], q[2]) || 1); return [q[0] * k, q[1] * k, q[2] * k]; };
  // boxContact's axes are (ux, uz) = (0, 1) the length and (-uz, ux) = (-1, 0) across: its (nx, nz) are the plane's own x and z here
  // OVER = 1.001: laying the moved point back on the sphere shortens its tangent offset by a few parts in 1e5 at the hull's size, which left it a
  // hair inside the box; a thousandth over the least move clears it (0.3 mm on a 0.3 m push)
  const least = { pos: at(OUT[1] * OUT[0] * OVER, OUT[2] * OUT[0] * OVER), depth: OUT[0] };
  if (!free || free(least.pos)) return least;
  const sides = [[hw - fr.x, 1, 0], [hw + fr.x, -1, 0], [hl - fr.z, 0, 1], [hl + fr.z, 0, -1]].sort((a, b) => a[0] - b[0]);
  for (const [d, sx, sz] of sides) { const pos = at(sx * d * OVER, sz * d * OVER); if (free(pos)) return { pos, depth: d }; }
  return least;
}
