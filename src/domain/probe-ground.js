// THE CREATURE PROBE'S GROUND (owner, 2026-10-12: "don't spawn the enemies straight into the base without defense, it should be tested
// against sentries. spawn them beyond the gate, not inside the base, with some sentries already built"). Where the probe's bodies come
// up and where its sentries stand, from the cell graph alone:
//   gateHops     hops from the gate over the ground OUTSIDE the base (a BFS seeded at the gate's cells through open cells that are not
//                inside the walls); -1 where the outside ground does not reach
//   spawnBand    the cells `lo`..`hi` hops out from the gate whose shortest way to the heart runs through the gate (the approach the
//                sector's own bodies walk: distToHeart(c) >= distToHeart(gate) + hops(c) - `slack`; a cell nearer the heart round the
//                back is someone else's approach), spread over the band: up to `want` of them, each at least `apart` (a chord on the
//                unit sphere) from the others, the farthest-point way, deterministic
//   sentryCells  up to `want` buildable cells (rock beside open ground, the caller's `canBuild`) that touch outside ground at most
//                `reach` hops from the gate: the story's own sockets first (they face the lane), then the nearest to the gate, at
//                least `apart` from each other where the wall allows it
// Pure: arrays and predicates in, cells out. The knobs come from src/content/creature-enemies.js CREATURE_PROBE.

export function gateHops({ adj, gates, open, inside }) {
  const hops = new Int32Array(adj.length).fill(-1), queue = [];
  for (const g of gates) if (g >= 0 && g < adj.length && hops[g] < 0) { hops[g] = 0; queue.push(g); }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    for (const nb of adj[c]) if (hops[nb] < 0 && open(nb) && !inside(nb)) { hops[nb] = hops[c] + 1; queue.push(nb); }
  }
  return hops;
}

const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// { cells, hops (of each picked cell), candidates (the band's size), gateToHeart, lo, hi }
export function spawnBand({ adj, centers, gates, open, inside, distToHeart, lo, hi, slack = 2, want = 24, apart = 0, hops = null }) {
  const h = hops ?? gateHops({ adj, gates, open, inside });
  let gateToHeart = Infinity;
  for (const g of gates) if (g >= 0 && distToHeart[g] >= 0) gateToHeart = Math.min(gateToHeart, distToHeart[g]);
  const band = [];
  for (let c = 0; c < h.length; c++) {
    if (h[c] < lo || h[c] > hi || inside(c) || !open(c)) continue;
    if (Number.isFinite(gateToHeart) && !(distToHeart[c] >= gateToHeart + h[c] - slack)) continue;   // its way in is not the gate
    band.push(c);
  }
  // farthest-point picks: the deepest cell of the band first (lowest index on a tie), then each time the cell farthest from every pick
  const picks = [];
  if (band.length) {
    let first = band[0];
    for (const c of band) if (h[c] > h[first]) first = c;
    picks.push(first);
    const near = new Float64Array(band.length).fill(Infinity);
    while (picks.length < Math.min(want, band.length)) {
      const last = centers[picks[picks.length - 1]];
      let best = -1, bd = -1;
      for (let i = 0; i < band.length; i++) { const d = Math.min(near[i], chord(centers[band[i]], last)); near[i] = d; if (d > bd) { bd = d; best = i; } }
      if (best < 0 || bd <= 0 || bd < apart) break;
      picks.push(band[best]);
    }
  }
  return { cells: picks, hops: picks.map((c) => h[c]), candidates: band.length, gateToHeart: Number.isFinite(gateToHeart) ? gateToHeart : null, lo, hi };
}

// [{ cell, near (hops from the gate of the outside ground it touches), socket }]
export function sentryCells({ adj, centers, hops, canBuild, sockets = [], want, reach, apart = 0 }) {
  const near = new Map(), socket = new Set(sockets);
  for (let c = 0; c < hops.length; c++) {
    if (hops[c] < 0 || hops[c] > reach) continue;
    for (const nb of adj[c]) if (!near.has(nb) || near.get(nb) > hops[c]) near.set(nb, hops[c]);
  }
  const cand = [...near.entries()].filter(([c]) => hops[c] < 0 && canBuild(c)).map(([cell, n]) => ({ cell, near: n, socket: socket.has(cell) }));
  cand.sort((a, b) => (b.socket - a.socket) || (a.near - b.near) || (a.cell - b.cell));
  const out = [];
  const clear = (c) => out.every((o) => chord(centers[o.cell], centers[c.cell]) >= apart);
  for (const c of cand) { if (out.length >= want) break; if (c.socket || clear(c)) out.push(c); }
  // the wall near the gate too short for the spacing: the nearest left, closer together, rather than fewer sentries
  for (const c of cand) { if (out.length >= want) break; if (!out.includes(c)) out.push(c); }
  return out;
}
