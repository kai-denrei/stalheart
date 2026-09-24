// gunship-lanes.mjs — the gunship's lane queries (src/domain/gunship-lanes.js): the far breach a minute's walk out, clear of
// sealed mouths and nearest the lane end, falling back on the lane end; and where the bodies come from.
import assert from 'node:assert/strict';
import { farCell, laneCell } from '../src/domain/gunship-lanes.js';
import { GUNSHIP_FAR } from '../src/content/gunship.js';
import { bfsDist, BLOCKED, PATH } from '../src/dungeon.js';
import { dist3 } from '../src/vec3.js';

// a ladder of two rows of cells round the equator: cell i and L + i side by side, the heart at 0
function ladder(L, walls = []) {
  const centers = [], adj = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < L; i++) { const a = (2 * Math.PI * i) / L; centers.push([Math.cos(a), Math.sin(a), r ? 0.02 : -0.02]); }
  for (let r = 0; r < 2; r++) for (let i = 0; i < L; i++) adj[r * L + i] = [r * L + ((i + 1) % L), r * L + ((i - 1 + L) % L), (1 - r) * L + i];
  const tags = new Uint8Array(2 * L).fill(PATH); for (const w of walls) tags[w] = BLOCKED;
  return { graph: { adj, centers }, cellSide: dist3(centers[0], centers[1]), tags };
}
const hopsFrom = (g, dungeon) => bfsDist(g.graph.adj, [dungeon.heart], (ci) => dungeon.tags[ci] !== BLOCKED);

assert.equal(GUNSHIP_FAR.hops, 69, 'a minute out: the ring the sectors cap their breaches at too');

// A BIG PLANET: the far cell stands on the ring, within the slack, and is the ring cell nearest the lane end
{
  const g = ladder(300), dungeon = { heart: 0, spawn: 150, tags: g.tags }, d = hopsFrom(g, dungeon);
  const far = farCell(g.graph, dungeon, new Set(), g.cellSide, GUNSHIP_FAR);
  assert.ok(Math.abs(d[far] - GUNSHIP_FAR.hops) <= GUNSHIP_FAR.slack, `on the ring (${d[far]} hops)`);
  const ring = [...d.keys()].filter((i) => Math.abs(d[i] - GUNSHIP_FAR.hops) <= GUNSHIP_FAR.slack);
  const nearest = Math.min(...ring.map((i) => dist3(g.graph.centers[i], g.graph.centers[dungeon.spawn])));
  assert.equal(dist3(g.graph.centers[far], g.graph.centers[dungeon.spawn]), nearest, 'the ring cell nearest the lane end');
  // a sealed mouth pushes it along the ring: nothing within clearCells of it
  const sealed = new Set([far]), next = farCell(g.graph, dungeon, sealed, g.cellSide, GUNSHIP_FAR);
  assert.notEqual(next, far);
  assert.ok(dist3(g.graph.centers[next], g.graph.centers[far]) >= g.cellSide * GUNSHIP_FAR.clearCells, 'clear of the sealed breach');
  // every ring cell sealed: the lane end itself
  assert.equal(farCell(g.graph, dungeon, new Set(ring), g.cellSide, GUNSHIP_FAR), dungeon.spawn);
}
// A SMALL PLANET: the farthest open ring stands in for the minute out
{
  const g = ladder(60), dungeon = { heart: 0, spawn: 20, tags: g.tags }, d = hopsFrom(g, dungeon), deepest = Math.max(...d);
  assert.ok(deepest < GUNSHIP_FAR.hops);
  const far = farCell(g.graph, dungeon, new Set(), g.cellSide, GUNSHIP_FAR);
  assert.ok(d[far] >= deepest - GUNSHIP_FAR.slack, 'the other side of the map');
}
// ROCK: walled-off cells are never the far breach (their hop count is -1)
{
  const walls = []; for (let i = 100; i < 110; i++) walls.push(i, 300 + i);
  const g = ladder(300, walls), dungeon = { heart: 0, spawn: 200, tags: g.tags }, d = hopsFrom(g, dungeon);
  const far = farCell(g.graph, dungeon, new Set(), g.cellSide, GUNSHIP_FAR);
  assert.notEqual(g.tags[far], BLOCKED); assert.ok(d[far] >= 0);
}
// WHERE THEY COME FROM: the live breach, else the lane outside the gate, else the lane end
{
  const dungeon = { spawn: 42 };
  assert.equal(laneCell(null, dungeon), 42);
  assert.equal(laneCell({ source: { alive: true, ci: 5 }, ring: new Set([7]) }, dungeon), 5);
  assert.equal(laneCell({ source: { alive: false, ci: 5 }, ring: new Set([7, 9]) }, dungeon), 7);
  assert.equal(laneCell({ source: null, ring: new Set() }, dungeon), 42);
  assert.equal(laneCell({ source: { alive: true, ci: 3 } }, null), 3, 'the lane end is only read when it is the answer');
}
console.log('Gunship lanes: the far breach stands a minute out, clear of sealed mouths and nearest the lane end; the lane follows the live breach.');
