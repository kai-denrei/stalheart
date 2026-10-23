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

// THE PLANNED ROAD (owner, 2026-10-18, note 6: "I'd like the road there to be clear, we can clear via nukes and SOL ... there is a clear fast path (cleared by
// nukes and SOL) to the investigation"). Measured on the shipped planet (probe r2-d, tools/probes): the open route from the base to the arena is 282 cells,
// the walk that may cross rock at two cells a rock is 214 with three rock cells on it, twelve cells out of the base; the second version's shortcut and flank
// asks widened the corridor but never shortened the drive (a simulated drive took 265 cells with or without them: a shortcut two rocks deep is named by its
// first rock only). So the road is planned once, from the arena: `roadField` is the walking cost to the arena from every cell, a rock cell costing `rockCost`
// (Dijkstra over the lattice, about 20 ms on the planet), and the road from any cell runs down it (`roadPath`); SOL takes its rock cells in order
// (`roadRock`), the first one far enough from the hull (`far`, the caller's chord and beam-safety test) within `max` cells of road.
//   roadField({ adj, tags, blocked, to, rockCost }) -> Float64Array (Infinity: no way)
export function roadField({ adj, tags, blocked = 0, to, rockCost = 2 }) {
  const n = adj.length, d = new Float64Array(n).fill(Infinity);
  if (!(to >= 0) || to >= n) return d;
  d[to] = 0;
  const h = [[0, to]];
  const push = (x) => { h.push(x); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const top = h[0], last = h.pop(); if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return top; };
  while (h.length) {
    const [dd, c] = pop(); if (dd > d[c]) continue;
    const step = tags[c] === blocked ? rockCost : 1;   // the walk from nb steps INTO c and pays c's price: every rock entered on the way to the arena
    for (const nb of adj[c]) { const nd = dd + step; if (nd < d[nb]) { d[nb] = nd; push([nd, nb]); } }
  }
  return d;
}
// the road from `from`: the cells down the field to the arena, at most `max` of them (the arena's cell last when it is reached)
//   roadPath({ adj, field, from, max }) -> [cell, ...]
export function roadPath({ adj, field, from, max = Infinity }) {
  const out = [];
  if (!(from >= 0) || !Number.isFinite(field[from])) return out;
  for (let c = from; out.length < max && field[c] > 0;) {
    let next = -1, best = field[c];
    for (const nb of adj[c]) if (field[nb] < best) { best = field[nb]; next = nb; }
    if (next < 0) break;
    out.push(next); c = next;
  }
  return out;
}
// SOL's next cut on the planned road: the first rock cell on it within `max` cells of the hull that `far` allows (none of them: -1); `path` the road ahead when
// the caller keeps one (roadKept), else the descent from `from`
//   roadRock({ adj, tags, blocked, field, from, max, far, path }) -> cell | -1
export function roadRock({ adj, tags, blocked = 0, field, from, max = Infinity, far = () => true, path = null }) {
  for (const c of path ? path.slice(0, max) : roadPath({ adj, field, from, max })) if (tags[c] === blocked && far(c)) return c;
  return -1;
}
// THE ROAD KEPT (r4-b, 2026-10-19, the merged --arena-drive: a planned rock first asked 3.09 cells off, its burn held off, the hull past it): the field has many
// equal-cost ways (a rock costs `rockCost` 2, a one-cell detour the same), so the descent from the hull's own cell changed as the hull drifted a cell off it, and a
// rock no road from the start came within 12 cells of (cell 26948 on the shipped planet) joined the road ahead 3 cells from the hull, then left it again. The
// road is kept instead: the descent from the hull when it was laid, the rest of it from the hull's cell or from the farthest road cell beside it (a cell off), and
// laid again from the hull only when the hull is further off than that
//   roadKept({ adj, field, from, route }) -> { route, ahead }   (route: the kept road, from its first cell; ahead: its cells after the hull's place on it)
export function roadKept({ adj, field, from, route = null }) {
  if (!(from >= 0) || !Number.isFinite(field[from])) return { route: null, ahead: [] };
  let i = route ? route.indexOf(from) : -1;
  if (i < 0 && route) for (const nb of adj[from]) { const j = route.indexOf(nb); if (j > i) i = j; }
  if (i < 0) { route = [from, ...roadPath({ adj, field, from })]; i = 0; }
  return { route, ahead: route.slice(i + 1) };
}

// THE ROAD CLEARED WIDE (owner, 2026-10-23, note 2: "we clear a path ... to destroy a large path at least 2 cells wide for the tank to speed up to full speed
// without being impeded"; spec docs/superpowers/specs/2026-10-23-arena-road-and-blob-design.md decision 1): the road SOL cuts is a swath. For every road cell in
// `path` (road order), the cell when it is rock, then its rock flanks: the cells within `width` hops of it that are not on the road (width 1: the neighbours one
// cell either side, so the corridor is three cells wide). A road cell whose flanks are all rock (a one-cell corridor) has its first flank rock first and marked
// `need`: one of them gone makes the corridor two wide there. Each rock once, at its first road cell.
//   roadSwath({ path, adj, tags, blocked, width }) -> [{ cell, road, need }]   (road: the road's own rock; need: road rocks and a narrow cell's first flank)
export function roadSwath({ path, adj, tags, blocked = 0, width = 1 }) {
  const on = new Set(path), seen = new Set(), out = [];
  for (const c of path) {
    if (tags[c] === blocked && !seen.has(c)) { seen.add(c); out.push({ cell: c, road: true, need: true }); }
    if (!(width > 0)) continue;
    // the flanks: off the road within `width` hops of c (hops through any cell), the nearest first
    const hop = new Map([[c, 0]]), q = [c], side = [];
    for (let i = 0; i < q.length; i++) { const x = q[i], k = hop.get(x); if (k >= width) continue; for (const nb of adj[x]) if (!hop.has(nb) && !on.has(nb)) { hop.set(nb, k + 1); q.push(nb); side.push(nb); } }
    const rocks = side.filter((x) => tags[x] === blocked), narrow = side.length > 0 && !adj[c].some((x) => !on.has(x) && tags[x] !== blocked);
    rocks.forEach((r, i) => { if (seen.has(r)) return; seen.add(r); out.push({ cell: r, road: false, need: narrow && i === 0 }); });
  }
  return out;
}
