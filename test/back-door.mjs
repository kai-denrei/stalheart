// The second front (src/domain/back-door.js) on the baked story planet with the stage-8 base's walls: the sealed mouth
// behind the bays, its flanking rock, and the lane cells a back breach opens on, each routing in through the mouth.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePlanetBake } from '../src/core/planet-bake.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_BACK_DOOR } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES } from '../src/content/base-layout.js';
import { buildWorld } from '../src/domain/world-recipe.js';
import { planBase } from '../src/domain/base-plan.js';
import { findBackMouth, backBreachCells, mouthFlank } from '../src/domain/back-door.js';
import { bfsDist, BLOCKED, PATH } from '../src/dungeon.js';

const bake = decodePlanetBake(new Uint8Array(readFileSync(new URL('../assets/story/planet.bin', import.meta.url))), STORY_RECIPE);
const { planet, dungeon } = buildWorld({ world: 'story', params: {}, story: { recipe: STORY_RECIPE, clearing: STORY_CLEARING, bake } });
const { graph } = planet;
// the game's board at stage 8, as src/platform/story-world.js lays it
const plan = planBase(planet, { islands: ISLANDS, structures: STRUCTURES, kit: KIT, stages: STAGES }, 8);
for (const ci of plan.open) dungeon.tags[ci] = PATH;
for (const w of plan.walls) if (w.cell >= 0) dungeon.tags[w.cell] = BLOCKED;
const tags = Uint8Array.from(dungeon.tags), heart = dungeon.heart;

// 1. the mouth: two rock cells at bearing ~12 deg from +Z, frame [32, 154], with open lane just beyond
const mouth = findBackMouth(planet, STORY_BACK_DOOR);
assert.ok(mouth, 'a sealed back mouth exists');
assert.deepEqual(mouth.cells, [1086, 34817], 'the pinned back mouth');
assert.deepEqual(mouth.beyond, [1257, 34816], 'the open cells beyond it');
assert.ok(Math.abs(mouth.azimuth * 180 / Math.PI - 11.6) < 1, `bearing ${(mouth.azimuth * 180 / Math.PI).toFixed(1)} deg`);
assert.ok(Math.abs(mouth.frame[0] - 32) < 2 && Math.abs(mouth.frame[1] - 154) < 2, `frame ${mouth.frame.map((v) => v.toFixed(0))}`);
assert.ok(Math.abs(Math.hypot(...mouth.dir) - 1) < 1e-9, 'unit direction');
for (const ci of mouth.cells) assert.equal(tags[ci], BLOCKED, 'the mouth is rock until it collapses');
assert.ok(!mouth.cells.some((ci) => planet.clearing.openMouth.cells.includes(ci)), 'not the gate mouth');
assert.equal(findBackMouth(planet, { ...STORY_BACK_DOOR, maxCells: 0 }), null, 'no mouth fits zero cells');
assert.deepEqual(findBackMouth(planet, STORY_BACK_DOOR), mouth, 'deterministic');

// 2. the collapse: the flank is rock outside the clearing, and opening the mouth brings the back lanes from ~110 hops to 17
const flank = mouth.flank;
assert.deepEqual(mouthFlank(planet, tags, mouth, STORY_BACK_DOOR.flank), flank, 'the mouth carries its flank');
assert.ok(flank.length >= 2 && flank.length <= STORY_BACK_DOOR.flank, `flank ${flank}`);
for (const ci of flank) assert.ok(tags[ci] === BLOCKED && !planet.clearing.cells.has(ci) && !mouth.cells.includes(ci), `flank cell ${ci} is outer rock`);
const gateOnly = bfsDist(graph.adj, [heart], (i) => tags[i] !== BLOCKED);
const opened = Uint8Array.from(tags); for (const ci of [...mouth.cells, ...flank]) opened[ci] = PATH;
const withBack = bfsDist(graph.adj, [heart], (i) => opened[i] !== BLOCKED);
assert.deepEqual(mouth.beyond.map((ci) => gateOnly[ci]), [111, 109], 'through the gate the lane beyond is ~110 hops');
assert.ok(mouth.beyond.every((ci) => withBack[ci] <= 17), `through the back it is ${mouth.beyond.map((ci) => withBack[ci])}`);
let shortened = 0; for (let i = 0; i < tags.length; i++) if (withBack[i] >= 0 && withBack[i] < gateOnly[i]) shortened++;
assert.ok(shortened > 13000, `the back door shortens ${shortened} routes`);

// 3. back breach candidates: the same answer before and after the collapse, 41-51 hops from the heart
const cands = backBreachCells(planet, tags, heart, mouth, STORY_BACK_DOOR);
assert.equal(cands.length, 272, `candidates ${cands.length}`);
assert.deepEqual([cands[0].hops, cands.at(-1).hops], [40, 51], 'hop range');
assert.deepEqual(flank, [1084, 34814, 45955, 34815], 'the pinned flank');
assert.deepEqual(backBreachCells(planet, opened, heart, mouth, STORY_BACK_DOOR).map((c) => c.cell), cands.map((c) => c.cell), 'same cells with the mouth already open');
const collapsed = new Set([...mouth.cells, ...flank]);
for (const c of cands) {
  assert.ok(c.ring >= STORY_BACK_DOOR.hops[0] && c.ring <= STORY_BACK_DOOR.hops[1] && !planet.clearing.cells.has(c.cell) && tags[c.cell] !== BLOCKED, `candidate ${c.cell} is lane`);
  assert.ok(c.hops < 60 && c.gateHops - c.hops >= STORY_BACK_DOOR.margin, `candidate ${c.cell}: ${c.hops} back vs ${c.gateHops} gate`);
  // walk the game's route field down from the candidate after the collapse: the swarm comes in through the fallen rock
  let at = c.cell, through = false;
  for (let guard = 0; at !== heart && guard < 200; guard++) { at = graph.adj[at].find((nb) => withBack[nb] === withBack[at] - 1); if (collapsed.has(at)) through = true; }
  assert.ok(at === heart && through, `candidate ${c.cell} walks in through the back`);
}
assert.ok(!cands.some((c) => c.cell === dungeon.spawn), 'the lane end outside the gate is not a back cell');
console.log(`Back door: mouth ${mouth.cells} at ${(mouth.azimuth * 180 / Math.PI).toFixed(1)} deg, flank ${flank}, ${cands.length} breach cells ${cands[0].hops}-${cands.at(-1).hops} hops (gate ${Math.min(...cands.map((c) => c.gateHops))}+), ${shortened} routes shortened.`);
