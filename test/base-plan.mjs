import assert from 'node:assert/strict';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../src/content/base-layout.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
const layout = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
// islands never overlap and stay inside the clearing
for (const a of ISLANDS) {
  for (const b of ISLANDS) if (a !== b) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 4 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 + 4, `${a.id} overlaps ${b.id}`);
  assert.ok(Math.hypot(Math.abs(a.x) + a.w / 2, Math.abs(a.z) + a.d / 2) < STORY_CLEARING.radiusMetres - 8, `${a.id} inside the clearing`);
}
for (const s of STRUCTURES) assert.ok(ISLANDS.some((i) => i.id === s.island), `${s.id} has an island`);
// stages are monotonic: everything at stage n is still there at n + 1
let prev = planBase(planet, layout, 0);
assert.equal(prev.islands.length, 0); assert.equal(prev.structures.length, 0); assert.equal(prev.walls.length, 0); assert.equal(prev.gate, null);
for (let n = 1; n < STAGES.length; n++) {
  const plan = planBase(planet, layout, n);
  for (const key of ['islands', 'structures', 'walls']) assert.ok(plan[key].length >= prev[key].length, `${key} keep growing at stage ${n}`);
  prev = plan;
}
const one = planBase(planet, layout, 1);
assert.deepEqual(one.structures.map((s) => s.id), ['sh02']); assert.equal(one.islands.length, 0, 'rocket lands on natural ground');
const full = planBase(planet, layout, 7);
assert.equal(full.islands.length, ISLANDS.length); assert.equal(full.structures.length, STRUCTURES.length);
assert.equal(full.walls.length, KIT.wallsPerSide * 2);
// islands are tangent at their centre; on the real planet the corner sag stays under the 1.2 m skirt
for (const i of full.islands) assert.equal(i.top, 0);
{ const real = { radius: 753.3, clearing: planet.clearing, graph: planet.graph, worldToFrame: planet.worldToFrame }; for (const i of planBase(real, layout, 7).islands) assert.ok(i.sag > 0 && i.sag <= 1.2, `${i.id} sag ${i.sag.toFixed(2)} m under the skirt`); }
// the gate sits on the open mouth, road axis toward the pole; walls flank it along the rim
const mouth = planet.clearing.openMouth;
const c = mouth.cells.map((ci) => planet.graph.centers[ci]).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]).map((v) => v / mouth.cells.length);
const m = planet.worldToFrame([c[0] * planet.radius, c[1] * planet.radius - planet.radius, c[2] * planet.radius]);
assert.ok(Math.hypot(full.gate.x - m[0], full.gate.z - m[2]) < planet.cellMetres, 'gate at the mouth');
assert.ok(full.gate.heading[1] > 0.9, 'gate faces the pole');
const rg = Math.hypot(full.gate.x, full.gate.z);
for (const w of full.walls) { assert.ok(Math.abs(Math.hypot(w.x, w.z) - (rg - KIT.wallInset)) < 0.5, 'wall on the rim'); assert.ok(Math.hypot(w.x - full.gate.x, w.z - full.gate.z) > KIT.gatePlot[0] / 2, 'wall clears the gate'); }
// structures stand on their island top with the island's frame
for (const s of full.structures) assert.equal(s.y, 0);
assert.equal(one.structures[0].y, 0, 'the rocket stands on natural ground');
console.log(`Base plan: ${full.islands.length} islands, ${full.structures.length} structures, ${full.walls.length} walls, gate at ${full.gate.x.toFixed(0)},${full.gate.z.toFixed(0)}.`);
