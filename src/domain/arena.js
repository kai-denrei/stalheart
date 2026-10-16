// THE ARENA'S PLACE (owner, 2026-10-16: "a giant opening very far from the base"; spec docs/superpowers/specs/2026-10-16-arena-design.md).
// Pure: the cell the arena's opening stands on, chosen once with the world: of the cells reachable from the heart (a finite `dist`), outside
// the clearing and not blocked, those within `farHops` hops of the farthest; the farthest first, the lowest index among equals (deterministic
// for a deterministic world). -1 when nothing is reachable.
//   pickArenaCell({ dist, blocked, inside, farHops }) -> cell | -1
export function pickArenaCell({ dist, blocked = () => false, inside = () => false, farHops = 4 }) {
  let far = -Infinity;
  for (let i = 0; i < dist.length; i++) if (Number.isFinite(dist[i]) && !blocked(i) && !inside(i) && dist[i] > far) far = dist[i];
  if (!Number.isFinite(far)) return -1;
  let best = -1, bd = -Infinity;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (!Number.isFinite(d) || d < far - farHops || blocked(i) || inside(i)) continue;
    if (d > bd) { bd = d; best = i; }
  }
  return best;
}

// THE ARENA IS ENORMOUS (owner, 2026-10-16: "the ARENA where we land must be MUCH MUCH LARGER, like in the lab... room for the tank to run around and
// avoid/lure the creatures away, so that SOL and the Gunship can fire... make it an enormous arena"): every cell within `radiusCells` of the arena's
// cell (the chord on the unit sphere against `cellArc` radians a cell), outside the clearing, is the arena's floor; the world carves them to ground
// when it is built (src/platform/story-world.js). The lab's bound was 120 m: 12 cells of 10 m; `radiusCells` 14 is a 280 m plain.
//   arenaFloor({ centers, cell, cellArc, radiusCells, inside }) -> [cell indices]
export function arenaFloor({ centers, cell, cellArc, radiusCells = 14, inside = () => false }) {
  if (!(cell >= 0) || !centers[cell]) return [];
  const c = centers[cell], reach = 2 * Math.sin(Math.min(Math.PI, radiusCells * cellArc) / 2), r2 = reach * reach * (1 + 1e-6), out = [];   // a hair over: the cell exactly radiusCells out is in
  for (let i = 0; i < centers.length; i++) {
    const p = centers[i], dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
    if (dx * dx + dy * dy + dz * dz <= r2 && !inside(i)) out.push(i);
  }
  return out;
}

// THE ROAD SOL CUTS (owner, 2026-10-16: "when the tank needs to go to the Arena, have SOL shoot ahead of it here and there to open the maze, making it a
// cleaner faster road"): the cheapest walk from the hull's cell to the arena where a rock cell costs `rockCost` steps and ground one (Dial's buckets over
// the lattice), then the first rock cell on it within `ahead` steps of the hull: SOL's next target, or -1 (no rock ahead, no way, or there already)
//   roadAhead({ adj, tags, blocked, from, to, rockCost, ahead }) -> cell | -1
export function roadAhead({ adj, tags, blocked = 0, from, to, rockCost = 4, ahead = 7, limit = 300000 }) {
  if (!(from >= 0) || !(to >= 0) || from === to) return -1;
  const n = adj.length, dist = new Int32Array(n).fill(-1), prev = new Int32Array(n).fill(-1), buckets = [[from]];
  dist[from] = 0;
  let settled = 0, found = false;
  for (let d = 0; d < buckets.length && !found && settled < limit; d++) {
    const b = buckets[d]; if (!b) continue;
    for (const ci of b) {
      if (dist[ci] !== d) continue;   // a stale entry, relaxed since
      settled++;
      if (ci === to) { found = true; break; }
      for (const nb of adj[ci]) { const nd = d + (tags[nb] === blocked ? rockCost : 1); if (dist[nb] < 0 || nd < dist[nb]) { dist[nb] = nd; prev[nb] = ci; (buckets[nd] ??= []).push(nb); } }
    }
  }
  if (!found) return -1;
  const path = []; for (let ci = to; ci !== -1 && ci !== from; ci = prev[ci]) path.push(ci); path.reverse();
  for (let i = 0; i < Math.min(ahead, path.length); i++) if (tags[path[i]] === blocked) return path[i];
  return -1;
}
