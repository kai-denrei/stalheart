// life-bays.mjs — the life containers (src/fx/life-bays.js): the story's bays become containers on their berths, a holder whose
// "stocked" call opens the bay once its hull has left, the bay's vehicle as the racked hull; a repaint racks the spares (the hull
// driven is not one), keeps a hull mid roll-out on show, lights a number per life, and leaves fewer than three containers alone.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { bayContainers, syncBays } from '../src/fx/life-bays.js';

const opened = [];
const bays = [0, 1, 2].map((k) => ({ vehicle: k < 2 ? { name: `v${k}`, visible: true, userData: {} } : null, rollout: k * 0.5, roll: `r${k}`, open: () => opened.push(k) }));
const berths = [{ ci: 10, exit: 20 }, { ci: 11, exit: 21 }, { ci: 12, exit: 22 }];
const cs = bayContainers(bays, berths);
assert.deepEqual(cs.map((c) => [c.ci, c.exit, c.rollout, c.roll, c.tanks.length]), [[10, 20, 0, 'r0', 1], [11, 21, 0.5, 'r1', 1], [12, 22, 1, 'r2', 0]]);
assert.ok(cs.every((c) => c.obj instanceof THREE.Object3D && c.obj.userData.asset === 'bay'));
assert.equal(cs[0].tanks[0], bays[0].vehicle, 'the bay\'s own vehicle is the racked hull');
assert.equal(cs[0].tanks[0].userData.asset, 'mork');
cs[0].obj.userData.setStocked(true); cs[1].obj.userData.setStocked(false);
assert.deepEqual(opened, [1], 'a container whose hull has left opens its bay');

const lit = [];
const three = () => [0, 1, 2].map((i) => ({ tanks: [{ visible: null }], obj: { userData: { setStocked: () => {}, setAlive: (on) => lit.push([i, on]) } } }));
const a = three(); syncBays(a, 3);
assert.deepEqual(a.map((c) => c.tanks[0].visible), [true, true, false], 'three hulls: two spares racked, the third is the one driven');
assert.deepEqual(lit, [[0, true], [1, true], [2, true]], 'three lit numbers');
const b = three(); b[1].rolling = true; lit.length = 0; syncBays(b, 1);
assert.deepEqual([b.map((c) => c.tanks[0].visible), lit.map((l) => l[1])], [[false, true, false], [true, false, false]], 'a hull mid roll-out stays on show');
const two = three().slice(0, 2); syncBays(two, 3); assert.deepEqual(two.map((c) => c.tanks[0].visible), [null, null], 'fewer than three: untouched');
console.log('Life bays: the story\'s bays as containers on their berths, the bay opened as its hull leaves, spares racked, lives lit.');
