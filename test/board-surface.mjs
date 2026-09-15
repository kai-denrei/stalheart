// The patchable board surface (src/fx/board-surface.js): a breach patched in place must be byte for byte the board a
// fresh build of the same tags draws, in every buffer, in the black mode (frontier tops) and a bright one; and the
// patch must cost a small fraction of the build. Runs on the baked story planet, the 71k-cell board the hitch was on.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePlanetBake } from '../src/core/planet-bake.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
import { createBoardSurface } from '../src/fx/board-surface.js';

const bake = decodePlanetBake(new Uint8Array(readFileSync(new URL('../assets/story/planet.bin', import.meta.url))), STORY_RECIPE);
const planet = buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, bake);
const { mesh, dungeon, graph } = planet;
const tags0 = Uint8Array.from(dungeon.tags);

const board = (mode) => ({
  vertices: mesh.vertices, quads: mesh.quads, graph, dungeon, H: 1.004, mode, seed: 7, jitter: 1,
  wallTop: [0.01, 0.016, 0.034], wallSide: [0.004, 0.007, 0.018], edgeColor: [0, 0.9, 1],
  floorColorOf: (ci) => (ci === dungeon.heart ? [1, 1, 1] : dungeon.tags[ci] === 2 ? [0.05, 0.06, 0.08] : [0.03, 0.04, 0.05]),
});

const rockCells = [];
for (let ci = 0; ci < dungeon.tags.length && rockCells.length < 3; ci++) {
  if (dungeon.tags[ci] !== BLOCKED) continue;
  const openNb = graph.adj[ci].some((nb) => dungeon.tags[nb] !== BLOCKED);
  if (rockCells.length === 0 && openNb) rockCells.push(ci);                                      /* a rim rock */
  else if (rockCells.length === 1 && !openNb) rockCells.push(ci);                                /* an interior rock */
  else if (rockCells.length === 2 && graph.adj[ci].includes(rockCells[1])) rockCells.push(ci);   /* its neighbour */
}
assert.equal(rockCells.length, 3, 'the planet has a rim rock, an interior rock and its neighbour');

for (const mode of ['black', 'bright']) {
  dungeon.tags.set(tags0);
  let t = performance.now();
  const patched = createBoardSurface(board(mode));
  const buildMs = performance.now() - t;
  for (const ci of rockCells) dungeon.tags[ci] = PATH;
  t = performance.now();
  patched.refreshCells(rockCells);
  const patchMs = performance.now() - t;
  const fresh = createBoardSurface(board(mode));
  for (const name of ['floor', 'wall', 'edge', 'top']) {
    for (const [attr, a] of Object.entries(patched[name].attributes)) {
      const b = fresh[name].attributes[attr];
      assert.ok(a.array.length === b.array.length && a.array.every((v, i) => v === b.array[i]), `${mode}: ${name}.${attr} patched equals a fresh build`);
    }
  }
  assert.deepEqual([...patched.floorOffsets.keys()].sort((x, y) => x - y), [...fresh.floorOffsets.keys()].sort((x, y) => x - y), `${mode}: the open cells`);
  assert.ok(patchMs < buildMs / 50, `${mode}: a patch (${patchMs.toFixed(2)} ms) is a small fraction of a build (${buildMs.toFixed(0)} ms)`);
  console.log(`  ok   ${mode}: three breached cells patch to a fresh build; build ${buildMs.toFixed(0)} ms, patch ${patchMs.toFixed(3)} ms`);
}
dungeon.tags.set(tags0);
console.log('Board surface: a breach patches in place and matches a fresh build.');
