
// WHERE THE OPENING GARRISON GOES.
//
// Forward of the heart, not on top of it. Towers mount on WALL cells, so a
// candidate is a blocked cell with an open neighbour — and "forward" is
// that neighbour sitting a few cells out from the heart rather than one.
// Among those, prefer the sites nearest a live gate, because forward only
// means anything in the direction the wave actually comes from.
//
// The two are also kept apart: the first pass of this put both on the same
// stretch of wall, which is two towers covering one lane and none covering
// the other.
//
// Moved out of src/td-tab.js (refactor round 3, 2026-10-16) as the controller had it: the world comes in as w (spawnPoints, dungeon,
// graph, cellSide, placeError) and the two tunables as w.band (cells from the heart, inclusive) and w.apart (cells between two sites).
import { BLOCKED } from '../dungeon.js';
import { dist3 } from '../vec3.js';

export function garrisonSites(want, w) {
  const gates = w.spawnPoints.filter((sp) => sp.alive).map((sp) => sp.ci);
  const cand = [];
  for (let i = 0; i < w.dungeon.tags.length; i++) {
    if (w.dungeon.tags[i] !== BLOCKED || w.placeError(i)) continue;
    let best = Infinity;
    for (const nb of w.graph.adj[i]) {
      const d = w.dungeon.tags[nb] !== BLOCKED ? w.dungeon.distToHeart[nb] : -1;
      if (d >= w.band[0] && d <= w.band[1]) best = Math.min(best, d);
    }
    if (best === Infinity) continue;
    // nearest gate, as a straight distance on the sphere in cells
    let toGate = Infinity;
    for (const g of gates) {
      toGate = Math.min(toGate, dist3(w.graph.centers[i], w.graph.centers[g]) / w.cellSide);
    }
    cand.push({ ci: i, toGate: Number.isFinite(toGate) ? toGate : 0, fromHeart: best });
  }
  cand.sort((a, b) => a.toGate - b.toGate);
  const out = [];
  for (const c of cand) {
    if (out.length >= want) break;
    const clear = out.every((o2) =>
      dist3(w.graph.centers[o2], w.graph.centers[c.ci]) / w.cellSide >= w.apart);
    if (clear) out.push(c.ci);
  }
  // ...and if the band or the spacing could not be satisfied on this board,
  // fall back to ANY legal wall rather than opening with no garrison at all
  if (out.length < want) {
    for (let i = 0; i < w.dungeon.tags.length && out.length < want; i++) {
      if (w.dungeon.tags[i] !== BLOCKED || w.placeError(i) || out.includes(i)) continue;
      if (w.graph.adj[i].some((nb) => w.dungeon.tags[nb] !== BLOCKED)) out.push(i);
    }
  }
  return out;
}
