import assert from 'node:assert/strict';
import { createSkyRig } from '../src/fx/sky-rig.js';
// THE SKY RIG (src/fx/sky-rig.js, out of the programme host in the refactor run): no scene, nothing hung; a scene without a
// renderable sky (node has no canvas) gets nothing and nothing throws; tick() waits for the Stålheart before it aims
assert.doesNotThrow(() => createSkyRig({ scene: null, storyBase: () => null, dungeon: () => null, graph: () => null }).tick());
const added = [];
const rig = createSkyRig({ scene: { getObjectByName: () => null, add: (g) => added.push(g) }, storyBase: () => null, dungeon: () => ({ heart: 0 }), graph: () => ({ normals: [[0, 1, 0]] }) });
rig.tick();
assert.deepEqual(added, [], 'no canvas in node: the shaders refuse and nothing is hung');
console.log('Sky rig: hung once at creation when a scene can draw it, aimed only once the Stålheart stands.');
