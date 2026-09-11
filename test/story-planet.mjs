import assert from 'node:assert/strict';
import { STORY_RECIPE, STORY_CLEARING, STORY_SANITY } from '../src/content/story-defaults.js';
import { buildStoryPlanet, frameToWorld } from '../src/domain/story-planet.js';
import { BLOCKED } from '../src/dungeon.js';
import { drop } from '../src/core/terrace-profile.js';

// Structure on a small recipe: fast, and the rules must hold at any density.
const small = { ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 };
const clearing = { ...STORY_CLEARING };
const p = buildStoryPlanet(small, clearing);
assert.ok(p.radius > 100 && p.cellSide > 0, 'radius derived from metres per cell');
assert.ok(p.clearing.cells.size > 10, 'clearing has cells');
for (const ci of p.clearing.cells) assert.notEqual(p.dungeon.tags[ci], BLOCKED, `clearing cell ${ci} is open`);
assert.equal(p.clearing.mouths.filter(m => m.open).length, 1, 'exactly one mouth open');
for (const m of p.clearing.mouths) if (!m.open) for (const ci of m.cells) assert.equal(p.dungeon.tags[ci], BLOCKED, 'sealed mouth is rock');
const open = p.clearing.mouths.find(m => m.open);
assert.ok(open.cells.length <= clearing.mouthMaxCells, 'open mouth is gate sized');
// yaw puts the open mouth on the frame's -Z axis
const c = p.graph.centers[open.cells[0]];
const local = p.worldToFrame([c[0] * p.radius, c[1] * p.radius - p.radius, c[2] * p.radius]);
assert.ok(local[2] < 0 && Math.abs(local[0]) < p.cellSide * p.radius * 1.5, `open mouth on -Z: ${local}`);
// the open mouth is the only way out: seal it and nothing outside the clearing is reachable
{
  const tags = Array.from(p.dungeon.tags); for (const ci of open.cells) tags[ci] = BLOCKED;
  const seen = new Set(p.clearing.cells), stack = [...p.clearing.cells];
  while (stack.length) { const c = stack.pop(); for (const nb of p.graph.adj[c]) if (!seen.has(nb) && tags[nb] !== BLOCKED) { seen.add(nb); stack.push(nb); } }
  for (const ci of seen) assert.ok(p.clearing.cells.has(ci) || p.arcOfCell(ci) < clearing.radiusMetres + 3 * p.cellMetres, `no second exit through cell ${ci}`);
}
// ...and with it open, the world beyond is reachable from the clearing
{
  const seen = new Set(p.clearing.cells), stack = [...p.clearing.cells];
  while (stack.length) { const c = stack.pop(); for (const nb of p.graph.adj[c]) if (!seen.has(nb) && p.dungeon.tags[nb] !== BLOCKED) { seen.add(nb); stack.push(nb); } }
  const outside = [...seen].filter((ci) => !p.clearing.cells.has(ci)).length;
  assert.ok(outside > p.dungeon.tags.length * 0.1, `the open mouth leads out: ${outside} cells beyond the clearing`);
  assert.ok(open.touches && open.reach > 0, 'open mouth touches the clearing and leads somewhere');
}
// determinism
const q = buildStoryPlanet(small, clearing);
assert.deepEqual(Array.from(q.dungeon.tags), Array.from(p.dungeon.tags));
assert.equal(q.clearing.yaw, p.clearing.yaw);
// altitude: pad vertices are near the pad plane, far vertices untouched
let pole = 0; for (let i = 1; i < p.mesh.vertices.length; i++) if (p.mesh.vertices[i][1] > p.mesh.vertices[pole][1]) pole = i;
const poleArc = Math.acos(p.mesh.vertices[pole][1]) * p.radius;
assert.ok(poleArc < clearing.padRadius, 'highest vertex is on the pad');
assert.ok(Math.abs(p.altitudeOf(pole) - (drop(poleArc, p.radius) + p.padFloor)) < 1e-6, 'pad vertex is lifted onto the pad plane');
assert.equal(p.altitudeOf(p.mesh.vertices.findIndex(v => v[1] < -0.9)), 0, 'south pole untouched');
// frame mapping: origin at the pole, -Z arc lands on the sphere at radius
const w = frameToWorld([0, 0, 0], p.radius, p.clearing.yaw);
assert.deepEqual(w.map(v => +v.toFixed(6)), [0, 0, 0]);
const far = frameToWorld([0, 0, -100], p.radius, 0);
assert.ok(Math.abs(Math.hypot(far[0], far[1] + p.radius, far[2]) - p.radius) < 1e-6, 'frame point lies on the sphere');
// full pinned recipe once: the sanity record
const full = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING);
assert.equal(full.dungeon.tags.length, STORY_SANITY.cells);
assert.equal(full.dungeon.heart, STORY_SANITY.heart);
assert.ok(Math.abs(full.mesh.defaultSide - STORY_SANITY.cellSide) < 1e-12);
assert.equal(full.clearing.mouths.filter(m => m.open).length, 1);
console.log(`Story planet: ${full.dungeon.tags.length} cells, ${full.clearing.cells.size} clearing cells, ${full.clearing.mouths.length} mouths, one open, yaw ${full.clearing.yaw.toFixed(3)}.`);
