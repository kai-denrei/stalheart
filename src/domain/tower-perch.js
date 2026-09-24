// WHERE A SENTRY STANDS ON ITS WALL CELL. EVERY TOWER STANDS AT ITS WALL'S EDGE, NEVER OVER IT (operator, 2026-09-12): the mount
// slides from the cell centre toward the open cell it covers (the story names it; otherwise the upstream lane) until the far edge
// of its pedestal meets the rock's edge. TO THE ROCK'S REAL EDGE (owner, 2026-09-13: touching it, not cantilevered): the shared
// quad edge, not half the centre distance.
//
// Pure: the controller's perchOf (src/td-tab.js) hands in the board (graph, dungeon, mesh) and the story's socketToward map; the
// muzzle, the lines of sight, the build burst and the take-control shot all start from this point.
import { add3, sub3, scale3, dot3, dist3, norm3 } from '../vec3.js';
import { BLOCKED } from '../dungeon.js';

export function towerPerch(tower, graph, dungeon, mesh, socketToward) {
  const ci = tower.ci, c = graph.centers[ci];
  let nb = socketToward?.[ci] ?? -1;
  if (nb < 0) for (const k of graph.adj[ci]) if (dungeon.tags[k] !== BLOCKED && (nb < 0 || dungeon.distToHeart[k] > dungeon.distToHeart[nb])) nb = k;
  if (nb < 0) return c;
  const t = graph.centers[nb], d = dist3(c, t), qa = mesh?.quads?.[ci], qb = mesh?.quads?.[nb], shared = qa && qb ? qa.filter((v) => qb.includes(v)) : [],
    face = shared.length === 2 ? dot3(sub3(scale3(add3(mesh.vertices[shared[0]], mesh.vertices[shared[1]]), 0.5), c), sub3(t, c)) / d : d * 0.5,
    slide = Math.max(0, face - (tower.obj?.userData.footprintR ?? 0)) / d;
  return norm3(c.map((v, i) => v + (t[i] - v) * slide));
}
