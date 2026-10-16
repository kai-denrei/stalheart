// ammo-orbs.mjs — the ammo pickups (src/fx/ammo-orbs.js, moved out of src/td-tab.js in refactor round 3) on a six-cell board:
// spawnOrbs clears and stands params.orbs triads on open cells (never a wall, the spawn, the heart, the hull's cell or a taken cell),
// three shells each upright on the cell's normal; a triad spins about that normal only; the hull absorbs one on contact for three
// shells (capped at AMMO_MAX) with the shells' sound and a HUD repaint; nearestOrb reports the closest.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { norm3 } from '../src/vec3.js';
import { BLOCKED } from '../src/dungeon.js';
import { createAmmoOrbs } from '../src/fx/ammo-orbs.js';

const log = [];
const centers = [0, 1, 2, 3, 4, 5].map((i) => norm3([i * 0.05, 0, 1]));
const S = { ammo: 7, unitScale: 0.02, seq: 0 };
const orbMeshes = new Map();
const player = { cur: 1, pos: centers[1] };
const host = {
  scene: { add: (o) => log.push(['add', o.children.length]), remove: () => log.push(['remove']) }, sfx: { play: (s) => log.push(['sfx', s]) },
  params: { orbs: 2 }, player, orbMeshes, AMMO_MAX: 9, Y_AXIS: new THREE.Vector3(0, 1, 0), tmpN: new THREE.Vector3(),
  disposeObj: () => log.push(['dispose']), updateHud: () => log.push(['hud', S.ammo]), look: () => ({ orb: { color: 0x33ff99 } }),
  orbRng: () => ((S.seq = (S.seq + 0.37) % 1)), graph: () => ({ centers, normals: centers }),
  dungeon: () => ({ tags: [2, 2, BLOCKED, 2, 2, 2], spawn: 5, heart: 0 }), cellSide: () => 0.05, unitScale: () => S.unitScale,
  ammo: () => S.ammo, setAmmo: (v) => (S.ammo = v),
};
const o = createAmmoOrbs(host);

o.spawnOrbs();
assert.equal(orbMeshes.size, 2, 'params.orbs triads');
for (const ci of orbMeshes.keys()) assert.ok(ci === 3 || ci === 4, `only open, free cells (got ${ci})`);
for (const g of orbMeshes.values()) assert.equal(g.children.length, 3, 'a triad of shells');
assert.equal(o.spawnOneOrb(), false, 'no open cell left');
assert.equal(o.spawnOrbAt(3), false, 'a taken cell is refused');

const [ci3, g] = [...orbMeshes][0];
const n = new THREE.Vector3(...centers[ci3]);
g.userData.tick(1.3);
assert.ok(Math.abs(new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion).dot(n) - 1) < 1e-9, 'spins about its normal, never tilted');

player.pos = centers[ci3];
const near = o.nearestOrb();
assert.equal(near.ci, ci3); assert.ok(near.d < 1e-9);
log.length = 0;
o.checkAbsorb();
assert.equal(orbMeshes.has(ci3), false, 'absorbed on contact');
assert.equal(S.ammo, 9, 'three shells, capped at AMMO_MAX');
assert.deepEqual(log, [['remove'], ['dispose'], ['sfx', 'tank_shells'], ['hud', 9]]);
player.pos = centers[0];
log.length = 0; o.checkAbsorb();
assert.deepEqual(log, [], 'nothing within reach, nothing absorbed');
o.clearOrbs();
assert.equal(orbMeshes.size, 0);
console.log('Ammo orbs: open free cells only, a triad upright on its normal, absorbed on contact for three shells capped.');
