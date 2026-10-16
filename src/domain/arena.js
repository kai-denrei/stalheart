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

// THE ROAD SOL CUTS (owner, 2026-10-16: "have SOL shoot ahead of it here and there to open the maze ... a cleaner faster road"), second version
// (2026-10-16, measured on the shipped planet along the open route from the base to the arena): the first version asked for the first rock within `ahead`
// cells on the cheapest rock-weighted walk, and on this maze of one-cell corridors that walk crosses rock once or twice in 214 cells, so the road fired
// at 2% of the route's cells, all of them at the arena's own rim where the drive out is over. Now: THE SHORTCUT first, every open cell within `ahead`
// hops of the hull, every rock beside one of them crossed through up to `through` rock cells to open ground on the far side, and the saving on the open
// walk to the arena (the hull's own distance, less the hops to the rock, the rocks crossed and the far side's distance); the best saving of at least
// `saves` cells names the rock. None worth it and `flank` on: the first rock bordering the open route within `ahead` cells of the hull, the wall beside
// the corridor ahead, so SOL opens the maze here and there as the hull drives. Nothing close to the hull (`far(cell)`, the caller's chord test, else `clear` hops): the beam keeps its safe distance from a
// friend and a rock beside the hull would be asked for and never burned (the hops are no measure round a bend: a rock four hops down the corridor can lie
// two cells from the hull by the chord). `field` is the open-ground distance to the arena from every cell (the
// lure's arenaField; computed from `to` when not handed in). -1: no way, there already, or nothing within reach.
//   roadAhead({ adj, tags, blocked, from, to, field, ahead, saves, through, flank, clear, far }) -> cell | -1
export function roadAhead({ adj, tags, blocked = 0, from, to, field = null, ahead = 12, saves = 4, through = 2, flank = true, clear = 4, far = null }) {
  if (!(from >= 0) || !(to >= 0) || from === to) return -1;
  const n = adj.length, open = (ci) => tags[ci] !== blocked;
  if (!field) { field = new Int32Array(n).fill(-1); const q = [to]; field[to] = 0; for (let i = 0; i < q.length; i++) { const c = q[i]; for (const nb of adj[c]) if (field[nb] < 0 && open(nb)) { field[nb] = field[c] + 1; q.push(nb); } } }
  if (!(field[from] > 0)) return -1;
  // the hull's reach: open cells within `ahead` hops, in order of hops
  const near = new Int32Array(n).fill(-1), q = [from]; near[from] = 0;
  for (let i = 0; i < q.length; i++) { const c = q[i]; if (near[c] >= ahead) continue; for (const nb of adj[c]) if (near[nb] < 0 && open(nb)) { near[nb] = near[c] + 1; q.push(nb); } }
  let best = null;
  for (const u of q) for (const r of adj[u]) {
    if (open(r) || (far ? !far(r) : near[u] < clear)) continue;   // never a rock close to the hull (`far`: by the chord; else by hops): SOL's beam keeps LASER_AUTO.safeMetres off a friend and would not burn it
    // through the rock: the cells behind it, up to `through` deep, to open ground that has a way on to the arena
    const seen = new Map([[r, 1]]), rq = [r]; let beyond = Infinity;
    for (let i = 0; i < rq.length; i++) { const x = rq[i], k = seen.get(x); for (const w of adj[x]) { if (open(w)) { if (w !== u && field[w] >= 0) beyond = Math.min(beyond, k + field[w]); } else if (k < through && !seen.has(w)) { seen.set(w, k + 1); rq.push(w); } } }
    if (beyond === Infinity) continue;
    const saving = field[from] - (near[u] + 1 + beyond);
    if (saving >= saves && (!best || saving > best.saving || (saving === best.saving && near[u] < best.hops))) best = { cell: r, saving, hops: near[u] };
  }
  if (best) return best.cell;
  if (!flank) return -1;
  // the flank: down the open route from the hull (the field falling by one a step), the first rock beside it within `ahead` cells
  for (let c = from, i = 0; i <= ahead && c >= 0; i++) {
    if (far || i >= clear) for (const r of adj[c]) if (!open(r) && (!far || far(r))) return r;
    let next = -1; for (const nb of adj[c]) if (open(nb) && field[nb] === field[c] - 1) { next = nb; break; }
    c = next;
  }
  return -1;
}
