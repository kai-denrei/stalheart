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

export function createReachQuery({ adj, centers, blocked, step }) {
  const query = (toSphere, x, z, dx, dz, max, hint = query.cell) => {
    let cur = hint ?? 0;
    const free = freeReach(x, z, dx, dz, max, step, (sx, sz) => { cur = nearestCellFrom(adj, centers, cur, toSphere(sx, sz)); return blocked(cur); });
    query.cell = cur;
    return free;
  };
  query.cell = 0;
  query.at = (toSphere, x, z, hint = query.cell) => { query.cell = nearestCellFrom(adj, centers, hint ?? 0, toSphere(x, z)); return blocked(query.cell); };
  return query;
}
