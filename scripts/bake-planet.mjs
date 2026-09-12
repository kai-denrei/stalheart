// Bake the story planet: relax and carve once here, ship the result.
//   node scripts/bake-planet.mjs            writes assets/story/planet.bin
// Re-run whenever STORY_RECIPE or the pinned kernel changes; test/planet-bake.mjs
// fails until the bake matches a fresh build again.
import { writeFileSync, mkdirSync } from 'node:fs';
import { STORY_RECIPE } from '../src/content/story-defaults.js';
import { generateSphereMesh, relax } from '../src/grid.js';
import { generateDungeon } from '../src/dungeon.js';
import { encodePlanetBake } from '../src/core/planet-bake.js';
const t0 = performance.now();
const mesh = generateSphereMesh({ seed: STORY_RECIPE.seed >>> 0, n: STORY_RECIPE.points, k: STORY_RECIPE.k });
relax(mesh, { n_iters: STORY_RECIPE.relaxIters, PULL_RATE: STORY_RECIPE.pullRate });
const dungeon = generateDungeon(mesh, { seed: STORY_RECIPE.seed, rooms: STORY_RECIPE.rooms, roomRadius: STORY_RECIPE.roomRadius, extraCorridors: STORY_RECIPE.extraCorridors, corridorWidth: STORY_RECIPE.corridorWidth });
const bytes = encodePlanetBake(STORY_RECIPE, mesh, dungeon);
mkdirSync('assets/story', { recursive: true });
writeFileSync('assets/story/planet.bin', bytes);
console.log(`Baked the story planet: ${mesh.vertices.length} vertices, ${dungeon.tags.length} cells, heart ${dungeon.heart}, ${(bytes.length / 1e6).toFixed(2)} MB in ${((performance.now() - t0) / 1000).toFixed(1)} s -> assets/story/planet.bin`);
