import assert from 'node:assert/strict';
import { gateHops, spawnBand, sentryCells } from '../src/domain/probe-ground.js';
import { bfsDist } from '../src/dungeon.js';
import { CREATURE_PROBE } from '../src/content/creature-enemies.js';
// THE CREATURE PROBE'S GROUND (src/domain/probe-ground.js): a 41 x 41 grid, a walled base round the heart at (20, 20) (inside 15..25,
// the wall ring at 14 and 26), the gate at (20, 14) in the south wall, a rock ridge west of the gate, and a second opening in the north
// wall (a back mouth) so some of the outside ground's shortest way in is not the gate
const W = 41, id = (x, y) => y * W + x, xy = (c) => [c % W, Math.floor(c / W)];
const adj = [], centers = [];
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
  const n = [];
  if (x > 0) n.push(id(x - 1, y)); if (x < W - 1) n.push(id(x + 1, y)); if (y > 0) n.push(id(x, y - 1)); if (y < W - 1) n.push(id(x, y + 1));
  adj.push(n); centers.push([x * 0.01, y * 0.01, 0]);
}
const gate = id(20, 14), back = id(20, 26), heart = id(20, 20);
const inside = (c) => { const [x, y] = xy(c); return x >= 15 && x <= 25 && y >= 15 && y <= 25; };
const wall = (c) => { const [x, y] = xy(c); return (x >= 14 && x <= 26 && (y === 14 || y === 26)) || (y >= 14 && y <= 26 && (x === 14 || x === 26)); };
const ridge = (c) => { const [x, y] = xy(c); return x === 12 && y >= 4 && y <= 13; };
const blocked = (c) => (wall(c) && c !== gate && c !== back) || ridge(c);
const open = (c) => !blocked(c);
const distToHeart = bfsDist(adj, [heart], open);

{
  const h = gateHops({ adj, gates: [gate], open, inside });
  assert.equal(h[gate], 0); assert.equal(h[id(20, 13)], 1, 'one hop out of the gate');
  assert.equal(h[heart], -1, 'never through the base'); assert.equal(h[id(20, 25)], -1);
  assert.equal(h[id(14, 20)], -1, 'not into the wall'); assert.equal(h[id(12, 8)], -1, 'not into the ridge');
  assert.ok(h[id(20, 27)] > 0, 'the north ground is reachable round the walls');
}
{
  const b = spawnBand({ adj, centers, gates: [gate], open, inside, distToHeart, lo: 6, hi: 12, slack: 1, want: 10, apart: 0.02 });
  const h = gateHops({ adj, gates: [gate], open, inside });
  assert.equal(b.cells.length, 10); assert.ok(b.candidates > 30); assert.equal(b.gateToHeart, distToHeart[gate]);
  for (const c of b.cells) {
    assert.ok(!inside(c) && open(c), `outside the walls, on open ground (${xy(c)})`);
    assert.ok(h[c] >= 6 && h[c] <= 12, `within the band (${h[c]})`);
    assert.ok(distToHeart[c] >= distToHeart[gate] + h[c] - 1, `its way in is the gate (${xy(c)})`);
    assert.ok(xy(c)[1] < 20, `on the gate's side, not round the back (${xy(c)})`);
  }
  assert.deepEqual(b.hops, b.cells.map((c) => h[c]));
  for (let i = 0; i < b.cells.length; i++) for (let j = i + 1; j < b.cells.length; j++) assert.ok(Math.hypot(centers[b.cells[i]][0] - centers[b.cells[j]][0], centers[b.cells[i]][1] - centers[b.cells[j]][1]) >= 0.02, 'spread, not a stack');
  assert.deepEqual(spawnBand({ adj, centers, gates: [gate], open, inside, distToHeart, lo: 6, hi: 12, slack: 1, want: 10, apart: 0.02 }).cells, b.cells, 'deterministic');
  // no gate: nothing
  assert.equal(spawnBand({ adj, centers, gates: [], open, inside, distToHeart, lo: 6, hi: 12 }).cells.length, 0);
  // a huge spacing stops early rather than stacking
  assert.ok(spawnBand({ adj, centers, gates: [gate], open, inside, distToHeart, lo: 6, hi: 12, want: 10, apart: 0.5 }).cells.length < 3);
}
{
  const h = gateHops({ adj, gates: [gate], open, inside });
  const canBuild = (c) => blocked(c) && adj[c].some(open);
  const s = sentryCells({ adj, centers, hops: h, canBuild, sockets: [id(17, 14)], want: 6, reach: 4, apart: 0.02 });
  assert.equal(s.length, 6); assert.equal(s[0].cell, id(17, 14), 'the story socket first'); assert.equal(s[0].socket, true);
  for (const x of s) { assert.ok(canBuild(x.cell)); assert.ok(x.near <= 4, `near the gate (${x.near})`); assert.ok(adj[x.cell].some((nb) => h[nb] >= 0 && h[nb] <= 4), 'touching the approach'); }
  assert.ok(s.some((x) => x.cell === id(19, 14)) && s.some((x) => x.cell === id(21, 14)), 'the wall either side of the gate');
  assert.deepEqual(s.slice(1, 3).map((x) => x.near), [0, 4], 'spaced first, nearest the gate first: (21, 14), then (23, 14) two cells on');
  assert.equal(new Set(s.map((x) => x.cell)).size, 6, 'one sentry a cell');
  // more than the spaced wall holds: closer together rather than fewer
  assert.equal(sentryCells({ adj, centers, hops: h, canBuild, want: 8, reach: 6, apart: 0.5 }).length, 8);
}
// the content's knobs are sane
{
  const g = CREATURE_PROBE.ground, s = CREATURE_PROBE.sentries;
  assert.ok(g.lo > s.reach && g.hi > g.lo, 'the band starts beyond the sentries\' wall');
  assert.ok(s.count >= 1 && s.mix.length >= 1 && s.count <= 10, 'a few sentries, within the story\'s cap of ten');
}
console.log('probe-ground tests passed');
