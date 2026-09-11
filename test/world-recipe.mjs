import assert from 'node:assert/strict';
import { buildWorld } from '../src/domain/world-recipe.js';
import { STORY_RECIPE, STORY_CLEARING, STORY_SANITY } from '../src/content/story-defaults.js';
import { BLOCKED } from '../src/dungeon.js';
// the default world is the game's pinned recipe (docs/ROCKET-PLANET.md sanity)
const params = { seed: 7, points: 500, relaxIters: 80, rooms: 16, roomRadius: 4, extraCorridors: 8, corridorWidth: 1 };
const d = buildWorld({ world: 'default', params });
assert.equal(d.world, 'default'); assert.equal(d.dungeon.tags.length, 2236); assert.equal(d.dungeon.heart, 700); assert.equal(d.wallHeight, null); assert.equal(d.planet, null);
// the story world: the pinned planet, heart at the pole, walls 4 m
const s = buildWorld({ world: 'story', params, story: { recipe: STORY_RECIPE, clearing: STORY_CLEARING } });
assert.equal(s.world, 'story'); assert.equal(s.dungeon.tags.length, STORY_SANITY.cells);
const { centers } = s.dungeon.graph; let top = 0; for (let i = 1; i < centers.length; i++) if (centers[i][1] > centers[top][1]) top = i;
assert.equal(s.dungeon.heart, top, 'heart is the pole cell');
assert.notEqual(s.dungeon.tags[s.dungeon.heart], BLOCKED);
assert.equal(s.dungeon.distToHeart[s.dungeon.heart], 0);
for (const ci of s.planet.clearing.cells) assert.ok(s.dungeon.distToHeart[ci] >= 0, `clearing cell ${ci} reaches the heart`);
assert.ok(s.dungeon.distToHeart[s.dungeon.spawn] > 50, 'spawn is far from the heart');
assert.ok(Math.abs(s.wallHeight - STORY_RECIPE.wallMetres / s.planet.radius) < 1e-12, 'wall height is 4 m on the story sphere');
// unknown world falls back to the default recipe
assert.equal(buildWorld({ world: 'nope', params }).world, 'default');
console.log(`World recipe: default ${d.dungeon.tags.length} cells; story ${s.dungeon.tags.length} cells, heart ${s.dungeon.heart} at the pole, spawn ${s.dungeon.distToHeart[s.dungeon.spawn]} hops out.`);
// the game-side composition blocks the wall cells at stage 4 without touching the gate cell
import { buildGameWorld } from '../src/platform/story-world.js';
{
  const fake = { add() {}, remove() {} };
  const g4 = buildGameWorld({ world: 'story', params, stage: 4, scene: fake });
  const g1 = buildGameWorld({ world: 'story', params, stage: 1, scene: fake });
  const rock = (w) => w.dungeon.tags.filter((t) => t === BLOCKED).length;
  assert.ok(rock(g4) > rock(g1), 'walls add rock');
  assert.ok(rock(g4) - rock(g1) <= g4.plan.walls.length, 'at most one cell per wall');
  assert.notEqual(g4.dungeon.tags[g4.plan.gate.cell], BLOCKED, 'gate cell stays open');
  g4.base?.dispose(); g1.base?.dispose();
}
console.log('Story world composition blocks wall cells and keeps the gate open.');
