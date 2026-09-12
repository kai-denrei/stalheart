import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STORY_RECIPE, STORY_CLEARING, STORY_SANITY } from '../src/content/story-defaults.js';
import { decodePlanetBake, encodePlanetBake, bakeKey } from '../src/core/planet-bake.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
// the shipped bake is a bake of the shipped recipe
const bytes = new Uint8Array(readFileSync(new URL('../assets/story/planet.bin', import.meta.url)));
const bake = decodePlanetBake(bytes, STORY_RECIPE);
assert.ok(bake, 'assets/story/planet.bin decodes for STORY_RECIPE (run npm run bake after changing the recipe or the kernel)');
assert.equal(decodePlanetBake(bytes, { ...STORY_RECIPE, seed: STORY_RECIPE.seed + 1 }), null, 'another recipe refuses the bake');
assert.equal(decodePlanetBake(new Uint8Array([1, 2, 3]), STORY_RECIPE), null, 'garbage is refused');
// and it reproduces the live build: same carve, same landmarks, vertices to float precision
let t = performance.now(); const baked = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, bake); const bakedMs = performance.now() - t;
t = performance.now(); const live = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING); const liveMs = performance.now() - t;
assert.equal(baked.dungeon.tags.length, STORY_SANITY.cells); assert.equal(baked.dungeon.heart, live.dungeon.heart); assert.equal(baked.dungeon.spawn, live.dungeon.spawn);
assert.deepEqual(Array.from(baked.dungeon.tags), Array.from(live.dungeon.tags), 'same carve');
assert.deepEqual(Array.from(baked.dungeon.distToHeart), Array.from(live.dungeon.distToHeart)); assert.deepEqual(baked.dungeon.seeds, live.dungeon.seeds);
assert.equal(baked.dungeon.tags.constructor, live.dungeon.tags.constructor); assert.equal(baked.dungeon.distToHeart.constructor, live.dungeon.distToHeart.constructor);
let worst = 0; for (let i = 0; i < live.mesh.vertices.length; i++) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(live.mesh.vertices[i][k] - baked.mesh.vertices[i][k]));
assert.ok(worst < 1e-6, `vertices agree to float precision (worst ${worst})`);
assert.deepEqual([...baked.clearing.cells].sort(), [...live.clearing.cells].sort(), 'same clearing'); assert.deepEqual(baked.clearing.openMouth.cells, live.clearing.openMouth.cells, 'same open mouth');
assert.ok(Math.abs(baked.clearing.yaw - live.clearing.yaw) < 1e-6); assert.equal(baked.cellSide, live.cellSide);
assert.deepEqual(baked.graph.adj, live.graph.adj, 'same lattice');
// round trip of the encoder itself
const again = decodePlanetBake(encodePlanetBake(STORY_RECIPE, live.mesh, live.dungeon), STORY_RECIPE); assert.equal(again.key, bakeKey(STORY_RECIPE)); assert.equal(again.heart, live.dungeon.heart);
assert.ok(bakedMs * 3 < liveMs, `the bake is faster: ${bakedMs.toFixed(0)} ms vs ${liveMs.toFixed(0)} ms live`);
console.log(`Planet bake: ${(bytes.length / 1e6).toFixed(2)} MB reproduces the live build; ${bakedMs.toFixed(0)} ms baked vs ${liveMs.toFixed(0)} ms live.`);
