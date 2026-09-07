// THE CAMP — where the three life containers stand, and which way each faces.
//
// This used to be chosen INSIDE the container model's async callback, which
// meant the game did not know where the berths were at reset time: it placed
// the tank beside the Heart and teleported it into a berth once the bytes
// landed. That teleport was the jump cut. Worse, the teleport was gated on
// `t < 6` where `t` is page-lifetime, so a retry three minutes in was never
// staged at a berth at all — every reset produced a different opening state.
//
// None of this needs the model. It is graph maths over cells, so it runs
// synchronously with the board and the model merely decorates the answer.
import { dot3, tangentDir, dist3, norm3 } from './vec3.js';
import { BLOCKED } from './dungeon.js';

const tangentDirTo = (graph, from, to) =>
  tangentDir(graph.normals[from], graph.centers[from], graph.centers[to]);

// Which container this hull drives out of. The operator's rule: the FIRST
// tank leaves Container #3, the second #2, the last #1 — so a full hull count
// takes the highest berth and they count down as the run wears on.
// berths[2] IS Container #3: the array is 0-based, the paint is 1-based.
export function berthIndexFor(hp, max = 3) {
  return Math.min(max - 1, Math.max(0, hp - 1));
}

// A chain of three adjacent cells, normally at distToHeart 3-4; a physical
// footprint may move it out to 7. Prefer nearby wall-side ground. Returns them in painted order (#1, #2, #3) with each one's exit lane,
// or [] when the board has no chain that satisfies the escape rule.
export function computeBerths(dungeon, graph, { footprintRadius = 0, cellSide = 0 } = {}) {
  // Reserve physical space for the box, hull and steering after handover.
  // Resolve this before GLBs load, using the selected asset's footprint.
  const center = graph.centers[dungeon.heart];
  const clear = ci => !footprintRadius || dist3(graph.centers[ci], center) >= footprintRadius + cellSide * 1.2;
  const laneClear = (from, to) => {
    if (!clear(to)) return false;
    if (!footprintRadius) return true;
    const a = graph.centers[from], b = graph.centers[to];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const p = norm3(a.map((v, k) => v + (b[k] - v) * t));
      if (dist3(p, center) < footprintRadius + cellSide * 0.7) return false;
    }
    return true;
  };
  const inRange = (c2) => dungeon.tags[c2] !== BLOCKED && c2 !== dungeon.spawn
    && dungeon.distToHeart[c2] >= 3 && dungeon.distToHeart[c2] <= (footprintRadius ? 7 : 4)
    && clear(c2);
  const open = (c2) => graph.adj[c2].filter((k2) => dungeon.tags[k2] !== BLOCKED).length;
  // EVERY BERTH KEEPS A LANE. Scoring for minimum openness alone was doing its
  // job too well — a berth whose only open neighbours are its two sibling
  // berths is a sealed garage, and each of the three gets used as the spawn as
  // lives run down. An escape lane is a HARD requirement; openness only breaks
  // ties among chains that have one. It still hugs a wall; it can no longer
  // wall itself in.
  const escapes = (c2, chain) => graph.adj[c2]
    .filter((k2) => dungeon.tags[k2] !== BLOCKED && !chain.includes(k2) && laneClear(c2, k2)).length;

  let best = null, bestScore = Infinity;
  for (let j = 0; j < dungeon.tags.length; j++) {
    if (!inRange(j)) continue;
    const nbs = graph.adj[j].filter(inRange);
    for (let a = 0; a < nbs.length; a++) {
      for (let b = a + 1; b < nbs.length; b++) {
        const chain = [nbs[a], j, nbs[b]];
        if (chain.some((c2) => escapes(c2, chain) === 0)) continue;
        const sc = open(nbs[a]) + open(j) + open(nbs[b])
          + (footprintRadius ? chain.reduce((n, ci) => n + dungeon.distToHeart[ci], 0) : 0);
        if (sc < bestScore) { bestScore = sc; best = chain; }
      }
    }
  }
  if (!best) return [];

  // THE DOORS FACE THE LANE THE HULL LEAVES BY. They used to face the Heart,
  // which is only ever approximately the way out: the exit is a graph
  // neighbour and can sit 40-odd degrees off that bearing, so the hull drove
  // out on a diagonal and clipped its own door frame. Aim the box at the
  // actual exit and the two are the same line by construction. Most-heartward
  // escape wins, so the row still faces home.
  const escapeOf = (c2) => {
    const toHeart = tangentDirTo(graph, c2, dungeon.heart);
    let bestE = -1, bestD = -Infinity;
    for (const nb of graph.adj[c2]) {
      if (dungeon.tags[nb] === BLOCKED || best.includes(nb) || !laneClear(c2, nb)) continue;
      const d = dot3(tangentDirTo(graph, c2, nb), toHeart);
      if (d > bestD) { bestD = d; bestE = nb; }
    }
    return bestE;
  };

  const out = best.map((ci) => ({ ci, exit: escapeOf(ci) }));
  // the escape rule above should prevent this; if it ever fails, no camp is
  // better than a camp with a door onto a wall
  return out.some((b) => b.exit < 0) ? [] : out;
}
