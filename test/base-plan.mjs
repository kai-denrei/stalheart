import assert from 'node:assert/strict';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../src/content/base-layout.js';
import { buildStoryPlanet, frameToWorld } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { BLOCKED } from '../src/dungeon.js';
const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
const layout = { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES };
// islands never overlap and stay inside the clearing
for (const a of ISLANDS) {
  for (const b of ISLANDS) if (a !== b) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 4 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 + 4, `${a.id} overlaps ${b.id}`);
  if (!a.anchor) assert.ok(Math.hypot(Math.abs(a.x) + a.w / 2, Math.abs(a.z) + a.d / 2) < STORY_CLEARING.radiusMetres - 8, `${a.id} inside the clearing`);
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
{ const real = { ...planet, radius: 753.3, frameToWorld: (p) => frameToWorld(p, 753.3, planet.clearing.yaw) }; for (const i of planBase(real, layout, 7).islands) assert.ok(i.sag > 0 && i.sag <= 1.2, `${i.id} sag ${i.sag.toFixed(2)} m under the skirt`); }
// the gate sits on the open mouth, road axis toward the pole; walls flank it along the rim
const mouth = planet.clearing.openMouth;
const c = mouth.cells.map((ci) => planet.graph.centers[ci]).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]).map((v) => v / mouth.cells.length);
const m = planet.worldToFrame([c[0] * planet.radius, c[1] * planet.radius - planet.radius, c[2] * planet.radius]);
assert.ok(Math.hypot(full.gate.x - m[0], full.gate.z - m[2]) < planet.cellMetres, 'gate at the mouth');
assert.ok(full.gate.heading[1] > 0.9, 'gate faces the pole');
const rg = Math.hypot(full.gate.x, full.gate.z);
for (const w of full.walls) { assert.ok(Math.abs(Math.hypot(w.x, w.z) - (rg - KIT.wallInset)) < 0.5, 'wall on the rim'); assert.ok(Math.hypot(w.x - full.gate.x, w.z - full.gate.z) > KIT.gatePlot[0] / 2, 'wall clears the gate'); }
// structures stand on their island top with the island's frame
for (const s of full.structures) if (s.id !== 'sh02') assert.ok(s.y > 0 && s.y < 0.1, `${s.id} rides a hair above its slab`);
assert.equal(one.structures[0].y, 0, 'the rocket stands on natural ground');
// walls map to distinct lattice cells that are open floor today; the gate keeps its own cell
{ const cells = full.walls.map((w) => w.cell).filter((c) => c >= 0); assert.ok(cells.length >= 2 && new Set(cells).size >= 2, 'walls block cells on both sides'); for (const c of cells) assert.notEqual(planet.dungeon.tags[c], BLOCKED, 'wall stands on floor'); assert.ok(full.gate.cell >= 0 && !cells.includes(full.gate.cell), 'gate cell is not a wall cell'); assert.ok(full.gate.openRadius > 10); }
// the Rotor's socket is the lane cell one step past the gate: outside the clearing, touching the mouth
{ const rc = full.cells.rotor; assert.ok(rc >= 0 && !planet.clearing.cells.has(rc), 'rotor socket outside the clearing'); assert.ok(mouth.cells.some((ci) => planet.graph.adj[ci].includes(rc)), 'rotor socket touches the mouth'); assert.ok(planet.arcOfCell(rc) > planet.arcOfCell(mouth.cells[0]) - 1e-9, 'rotor socket is outward of the mouth'); const ri = full.islands.find((i) => i.id === 'rotor'); assert.equal(ri.cell, rc); }
console.log(`Base plan: ${full.islands.length} islands, ${full.structures.length} structures, ${full.walls.length} walls, gate at ${full.gate.x.toFixed(0)},${full.gate.z.toFixed(0)}.`);
