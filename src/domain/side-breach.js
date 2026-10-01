// THE SIDE BREACH (owner, 2026-10-01: "a « side breach ». Problem, but still within range of some of the existing towers so easier to
// manage. This is a chekov's gun of sorts, it reveals that the walls can be breached"). Where it can come up and what it breaks.
//
// Pure. Cells are lattice indices; `centers` are unit vectors; `cellArc` is one cell's angular size, so distances are in cells.
// The numbers come in from src/content/sectors.js SIDE_BREACH.
const arc = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

// candidates: [{ cell, wall, carve }] for every open cell outside the clearing that stands between tune.minWall and tune.maxWall cells
// from the nearest wall cell, within tune.reach of a socket and at least tune.gateClear from the gate. `wall` is the wall cell it goes
// for; `carve` is what it breaks: the cells of a lane walked from it to that wall (one cell wide, each step the neighbour nearest the
// wall), then the wall cell and the next tune.gap - 1 wall cells nearest it. A lane through the gate or a socket is no candidate.
// Sorted nearest a socket first.
export function sideBreachCandidates({ centers, adj, blocked, inside, walls, sockets, gate, cellArc, tune }) {
  const out = [], d = (a, b) => arc(centers[a], centers[b]) / cellArc;
  if (!walls.length || !sockets.length) return out;
  for (let ci = 0; ci < centers.length; ci++) {
    if (blocked(ci) || inside(ci) || walls.includes(ci)) continue;
    let wall = -1, dw = Infinity;
    for (const w of walls) { const x = d(ci, w); if (x < dw) { dw = x; wall = w; } }
    if (dw < tune.minWall || dw > tune.maxWall) continue;
    const ds = Math.min(...sockets.map((s) => d(ci, s)));
    if (ds > tune.reach || (gate >= 0 && d(ci, gate) < tune.gateClear)) continue;
    const carve = carveTo(ci, wall, { centers, adj, walls, gap: tune.gap ?? 1, d });
    if (carve.some((c) => c === gate || sockets.includes(c))) continue;   // never through the gate's mouth or a sentry's own rock
    out.push({ cell: ci, wall, socket: ds, carve });
  }
  return out.sort((a, b) => a.socket - b.socket || a.cell - b.cell);
}

// the lane from `from` to the wall cell `to`, then the gap: every cell it passes (the caller breaks the rock and walls among them)
function carveTo(from, to, { adj, walls, gap, d }) {
  const lane = [];
  for (let at = from, guard = 0; at !== to && guard < 64; guard++) {
    let next = -1, best = Infinity;
    for (const n of adj[at]) { const x = d(n, to); if (x < best) { best = x; next = n; } }
    if (next < 0 || best >= d(at, to)) break;   // no neighbour is nearer: the lane ends here
    at = next; lane.push(at);
  }
  const more = walls.filter((w) => w !== to).sort((a, b) => d(a, to) - d(b, to)).slice(0, Math.max(0, gap - 1));
  return [...new Set([...lane, to, ...more])];
}
