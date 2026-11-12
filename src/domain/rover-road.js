// THE ROVER'S DRAWN ROAD (owner, 2026-11-12: "yushi-rover must have the same collision logic as the tank; walls, rocks, etc."). The trip is a
// cell path over the tank's ground (src/domain/drive-ground.js, routed by src/fx/rover-glue.js); this turns the path's cell centres into the
// line the rover is drawn along, so it neither snaps from centre to centre nor cuts a corner across a rock:
//   buildRoad(points, clear, o) -> { pts, cum, length }
//     1. PULL THE STRING: from each kept point, the farthest point further on whose straight run is clear (at most `o.pull` points ahead);
//        the run between two neighbours on the path is always kept (the path itself is the floor of what it may do)
//     2. ROUND THE CORNERS: each kept corner becomes a short curve from `r` before it to `r` after it (r at most `o.radius`, under half
//        of either side), the curve tried at r, r/2, r/4; none clear and the corner stays sharp (the rover turns on it)
//     CLEAR: every sample `o.step` apart along a run, and the two points `o.half` to either side of it, pass clear(p) (the ground test)
//   roadAt(road, s) -> { point, dir }  the point `s` along it (clamped) and the unit direction of the run it is on
//   o: { step, half, radius, pull = 12, surface(p) = identity (the sphere's projection), up(p) (the local up, for the sides; default +Y) }
// Points are [x, y, z]; distances are in the points' own units. Pure.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function clearRun(a, b, clear, o) {
  const surface = o.surface ?? ((p) => p), up = o.up ?? (() => [0, 1, 0]), d = sub(b, a), n = Math.max(1, Math.ceil(len(d) / o.step));
  for (let k = 0; k <= n; k++) {
    const q = surface(add(a, mul(d, k / n)));
    if (!clear(q)) return false;
    if (o.half > 0) { const side = mul(unit(cross(up(q), d)), o.half); if (!clear(surface(add(q, side))) || !clear(surface(sub(q, side)))) return false; }
  }
  return true;
}
// a quadratic curve from a through the corner's pull at c to b, `k` pieces (its first point a left out)
const curve = (a, c, b, k, surface) => { const out = []; for (let i = 1; i <= k; i++) { const t = i / k, u = 1 - t; out.push(surface(add(add(mul(a, u * u), mul(c, 2 * u * t)), mul(b, t * t)))); } return out; };

export function buildRoad(points, clear, o) {
  const surface = o.surface ?? ((p) => p), pull = o.pull ?? 12;
  if (!points.length) return { pts: [], cum: [], length: 0 };
  // 1. the string pulled
  const kept = [points[0]];
  for (let i = 0; i < points.length - 1;) {
    let j = i + 1;
    while (j + 1 < points.length && j + 1 - i <= pull && clearRun(points[i], points[j + 1], clear, o)) j++;
    kept.push(points[j]); i = j;
  }
  // 2. the corners rounded
  const pts = [kept[0]];
  for (let i = 1; i < kept.length; i++) {
    const p = kept[i];
    if (i === kept.length - 1 || !(o.radius > 0)) { pts.push(p); continue; }
    const prev = pts.at(-1), next = kept[i + 1], din = sub(p, prev), dout = sub(next, p), li = len(din), lo = len(dout);
    const turn = li > 0 && lo > 0 ? 1 - (din[0] * dout[0] + din[1] * dout[1] + din[2] * dout[2]) / (li * lo) : 0;
    if (turn < 1e-4) { pts.push(p); continue; }   // straight on: nothing to round
    let done = false;
    for (let r = Math.min(o.radius, li * 0.45, lo * 0.45), tries = 0; tries < 3 && r > o.step * 0.25; tries++, r /= 2) {
      const a = surface(sub(p, mul(unit(din), r))), b = surface(add(p, mul(unit(dout), r))), arc = curve(a, p, b, 6, surface);
      let ok = clearRun(prev, a, clear, o), from = a;
      for (const q of arc) { if (!ok) break; ok = clearRun(from, q, clear, o); from = q; }
      if (ok) { pts.push(a, ...arc); done = true; break; }
    }
    if (!done) pts.push(p);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  return { pts, cum, length: cum.at(-1) };
}

export function roadAt(road, s) {
  const { pts, cum } = road;
  if (pts.length < 2) return { point: pts[0] ?? null, dir: null };
  const x = Math.max(0, Math.min(road.length, s));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= x) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], d = sub(b, a), l = cum[hi] - cum[lo], u = l > 0 ? (x - cum[lo]) / l : 0;
  return { point: add(a, mul(d, u)), dir: l > 0 ? unit(d) : null };
}
