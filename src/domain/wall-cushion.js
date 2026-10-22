// THE WALL CUSHION (moved out of src/td-tab.js, refactor round 4, 2026-10-22, as the controller had it): the hull kept off the
// rock faces, the pedestal and the open craters by nudges, never pins. A pure rule over an explicit world: the board's graph and
// tags, the voxel-hash cell lookup, the open-neighbour count, the craters, the pedestal's rim and the hull's heading; the
// controller gathers them per call (td-tab wallCushion / breachBlocked).
import { add3, sub3, scale3, dot3, len3, dist3, norm3 } from '../vec3.js';

// cells beyond a sinkhole's crater the hull keeps off: the ground there is open, not drivable
export const CRATER_PAD = 0.6;

// is the point on (or within `pad` cells of) an open crater; `craters`: [{ p: [3], r: cells }]
export const breachBlocked = (p, craters, cellSide, pad = CRATER_PAD) => craters.some((k) => dist3(p, k.p) < (k.r + pad) * cellSide);

// WALL CUSHION, corridor-safe: adaptive margins (narrow cells skip diagonals), pushes net-summed and applied once (opposing walls
// centre instead of fighting), capped per frame well below drive speed: corrects clipping over a few frames, never pins
// w: { cellIndex(pos), graph: { centers, adj }, dungeon: { tags, heart }, blocked, cellSide, openCount(ci), craters, pedestalRadius, unitScale, smoothDir }
export function wallCushion(pos, w) {
  const { cellIndex, graph, dungeon, blocked, cellSide, openCount, craters, pedestalRadius, unitScale, smoothDir } = w;
  const ci = cellIndex(pos);
  if (ci === -1) return pos;
  // the pedestal and every open crater first: a hard radial push off the pad or the sinkhole's rim, then the wall cushion
  for (const { c, rim } of [{ c: graph.centers[dungeon.heart], rim: pedestalRadius + cellSide * 0.35 }, ...craters.map((k) => ({ c: k.p, rim: (k.r + CRATER_PAD) * cellSide }))]) {
    const d = dist3(pos, c); if (d >= rim) continue;
    const away = sub3(pos, c), n = norm3(pos), tg = sub3(away, scale3(n, dot3(away, n))), l = len3(tg);
    if (l > 1e-9) pos = norm3(add3(pos, scale3(tg, (rim - d) / l)));
  }
  const narrow = openCount(ci) <= 3, margin = cellSide * (narrow ? 0.6 : 0.95);
  let px = 0, py = 0, pz = 0;
  const seen = new Set([ci]);
  const consider = (wc, at = pos, m = margin, k = 1) => {
    const c = graph.centers[wc], d = dist3(at, c); if (d >= m) return;
    const away = sub3(at, c), n = norm3(at), tg = sub3(away, scale3(n, dot3(away, n))), l = len3(tg); if (l < 1e-9) return;
    const f = k * (m - d) / m; px += (tg[0] / l) * f; py += (tg[1] / l) * f; pz += (tg[2] / l) * f;
  };
  for (const nb of graph.adj[ci]) {
    if (seen.has(nb)) continue; seen.add(nb);
    if (dungeon.tags[nb] === blocked) { consider(nb); continue; }
    if (!narrow) for (const nb2 of graph.adj[nb]) { if (seen.has(nb2)) continue; seen.add(nb2); if (dungeon.tags[nb2] === blocked) consider(nb2); }
  }
  // THE HULL HAS A NOSE AND A TAIL (operator, 2026-09-12: the tank clips into walls). Each end is cushioned by the rock it is in or beside,
  // a band of the cell's edge plus the hull's half width, a nudge not a pin: a corner pushes the hull out, a straight lane leaves it
  const half = unitScale * 0.73, band = cellSide * 0.72;
  for (const end of [norm3(add3(pos, scale3(smoothDir, half))), norm3(sub3(pos, scale3(smoothDir, half)))]) {
    const ce = cellIndex(end); if (ce === -1) continue;
    if (dungeon.tags[ce] === blocked) consider(ce, end, band, 0.6);
    for (const nb of graph.adj[ce]) if (dungeon.tags[nb] === blocked) consider(nb, end, band, 0.6);
  }
  const mag = Math.hypot(px, py, pz);
  if (mag < 1e-9) return pos;
  const step = Math.min(mag * cellSide * 0.3, cellSide * 0.035);
  return norm3(add3(pos, scale3([px / mag, py / mag, pz / mag], step)));
}
