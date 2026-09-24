// tower-perch.mjs — where a sentry stands on its wall cell (src/domain/tower-perch.js): on the centre when no open cell borders it;
// otherwise slid toward the upstream lane (or the cell the story's socket faces) until its pedestal's far edge meets the rock's
// edge (the quad edge the two cells share; half the centre distance without one); a wider pedestal stops short; always on the
// unit sphere.
import assert from 'node:assert/strict';
import { towerPerch } from '../src/domain/tower-perch.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
import { norm3, dist3, len3, dot3, sub3, scale3, add3 } from '../src/vec3.js';

const centers = [[1, 0, 0], norm3([1, 0.2, 0]), norm3([1, -0.2, 0])];
const graph = { centers, adj: [[1, 2], [0], [0]] };
const open = { tags: [BLOCKED, PATH, PATH], distToHeart: [-1, 3, 5] };
const walled = { tags: [BLOCKED, BLOCKED, BLOCKED], distToHeart: [-1, -1, -1] };
const mesh = { vertices: [[0, 0, 0], [1, -0.1, 0.1], [1, -0.1, -0.1], [0, 0, 0], [0, 0, 0], [0, 0, 0]], quads: [[0, 1, 2, 3], [0, 3, 4, 5], [1, 2, 4, 5]] };
const tower = (r) => ({ ci: 0, obj: { userData: { footprintR: r } } });
const close = (a, b, eps = 1e-12) => a.every((v, i) => Math.abs(v - b[i]) < eps);

assert.equal(towerPerch(tower(0), graph, walled, mesh, undefined), centers[0], 'no open neighbour: the centre itself');
const up = towerPerch({ ci: 0 }, graph, open, null, undefined);
assert.ok(close(up, norm3(scale3(add3(centers[0], centers[2]), 0.5))), 'no mesh: half way to the upstream lane (the larger distance to the heart)');
assert.ok(close(towerPerch({ ci: 0 }, graph, open, null, { 0: 1 }), norm3(scale3(add3(centers[0], centers[1]), 0.5))), 'the story\'s socket names the other cell');
// the shared quad edge: the pedestal's far edge on the rock's edge
const t = centers[2], d = dist3(centers[0], t), face = dot3(sub3([1, -0.1, 0], centers[0]), sub3(t, centers[0])) / d;
for (const r of [0, 0.02, 0.05]) {
  const p = towerPerch(tower(r), graph, open, mesh, undefined);
  assert.ok(Math.abs(len3(p) - 1) < 1e-12, 'on the unit sphere');
  assert.ok(close(p, norm3(add3(centers[0], scale3(sub3(t, centers[0]), (face - r) / d)))), `slid ${face - r} along the lane for a pedestal of ${r}`);
}
assert.ok(dist3(towerPerch(tower(0.05), graph, open, mesh), centers[0]) < dist3(towerPerch(tower(0.02), graph, open, mesh), centers[0]), 'a wider pedestal stops short');
assert.ok(close(towerPerch(tower(1), graph, open, mesh), centers[0]), 'a pedestal wider than the ledge stays on the centre');
console.log('Tower perch: the centre with no open neighbour, the upstream lane or the socket\'s cell, the rock\'s edge, a wider pedestal short of it.');
