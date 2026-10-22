// board-actors.mjs — the board's actors (src/fx/board-actors.js, moved out of src/td-tab.js in refactor round 3) over a host of
// plain state: buildActors puts the heart (the dot cloud while a model loads, the model once it lands), the hull at its play size
// and the map marker in the scene, the cloud creature with its buffers; placeActors stands the heart at the pole with its size and
// health, the hull on the ground facing its smoothed direction, the shield shell over it only while the shield is up.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { norm3 } from '../src/vec3.js';
import { createBoardActors } from '../src/fx/board-actors.js';

const log = [];
const centers = [norm3([0, 0, 1]), norm3([0.05, 0, 1]), norm3([0.1, 0, 1])];
let heartModel = null;
const S = {
  heartSprite: null, playerMesh: null, markerMesh: null, shieldObj: null, lifeContainers: [{ obj: Object.assign(new THREE.Object3D(), { name: 'bay' }) }], creatureBase: null, creatureGeo: null, creaturePos: null, heartGen: 0, containerGen: 0,
  shieldUp: false, rf: 0, t: 1,
};
const params = { creature: 'mork', heartLook: 'model', wallHeight: 0.05, recoil: 1 };
const player = { pos: centers[1], smoothDir: norm3([1, 0, 0]) };
const hl = { lift: 0.5, scale: 2, make: () => heartModel, preload: () => Promise.resolve().then(() => { heartModel = Object.assign(new THREE.Object3D(), { name: 'heart-model' }); heartModel.userData.setHealth = (h) => log.push(['health', h]); }) };
const host = {
  scene: { add: (o) => log.push(['add', o.name || o.type]), remove: (o) => log.push(['remove', o.name || o.type]) },
  params, player, look: () => ({ heart: '#ff2200', walker: 0x00ff00, walkerHi: 0xffffff, marker: 0x123456 }), heartLook: () => hl, feel: {},
  shield: { t: 1 }, shieldTune: { cap: 2 }, shieldUp: () => S.shieldUp, hullHealth: () => 1, runContext: { time: 0 }, tmpObj: new THREE.Object3D(), tmpN: new THREE.Vector3(),
  Y_AXIS: new THREE.Vector3(0, 1, 0), MAP_LAYER: 1, MOVES: {}, HEART_MAX: 10,
  dressMetal: (o) => o, buildStationRing: () => log.push(['stationRing']), syncLifeContainers: () => {}, recoilFactor: () => S.rf,
  ramJolt: () => ({ hull: () => {} }), storyMode: () => true, graph: () => ({ centers, normals: centers }), dungeon: () => ({ heart: 0 }), cellSide: () => 0.05, unitScale: () => 0.02,
  berths: () => [], heartHP: () => 5, playerHP: () => 3, recoilLeft: () => 0, t: () => S.t, floorMesh: () => null, wallMesh: () => null, edgeMesh: () => null, topMesh: () => null,
};
for (const k of ['heartSprite', 'playerMesh', 'markerMesh', 'shieldObj', 'lifeContainers', 'creatureBase', 'creatureGeo', 'creaturePos', 'heartGen', 'containerGen']) {
  host[k] = () => S[k];
  host['set' + k[0].toUpperCase() + k.slice(1)] = (v) => (S[k] = v);
}
const a = createBoardActors(host);

// ---- build: the heart is the dot cloud while its model loads; the hull at its play size; the marker on the map layer only
a.buildActors();
assert.equal(S.heartSprite.type, 'Points', 'the dot-cloud heart stands in while the model loads');
assert.equal(S.heartGen, 1, 'a load generation is taken');
assert.equal(S.lifeContainers[0].obj.name, 'bay', "the story's bays outlive an actor rebuild");
assert.ok(S.playerMesh.isObject3D && S.creatureBase === null && S.creatureGeo === null, 'a mesh hull, no cloud buffers');
assert.ok(Math.abs(S.playerMesh.scale.x - 0.02 * (S.playerMesh.userData.baseScale ?? 1)) < 1e-12, 'the play size from the first frame');
assert.equal(S.markerMesh.layers.mask, 2, 'the marker is parked on the map layer');
assert.ok(log.some((e) => e[0] === 'stationRing'));
await new Promise((r) => setTimeout(r, 0));
assert.equal(S.heartSprite, heartModel, 'the model replaces the cloud when its bytes land');
assert.ok(S.heartSprite.layers.isEnabled(1), 'the landed model is drawn on the map too');
assert.ok(log.some((e) => e[0] === 'health' && e[1] === 0.5), 'placed at once: its health from heartHP / HEART_MAX');

// ---- place: the heart at the pole with its size; the shield shell only while the shield is up
a.placeActors();
assert.ok(Math.abs(S.heartSprite.userData.sizeScale - 0.05 * 2) < 1e-12, 'heart size from the cell');
assert.equal(S.shieldObj, null, 'no shield shell while the shield is down');
S.shieldUp = true; a.placeActors();
assert.ok(S.shieldObj && S.shieldObj.visible, 'the shell rides the hull while the shield is up');
assert.ok(Math.abs(S.shieldObj.scale.x - 0.05 * 0.85) < 1e-12, 'sized off the cell');
S.shieldUp = false; a.placeActors();
assert.equal(S.shieldObj.visible, false, 'hidden, not dropped, when it runs out');
const n = norm3(player.pos);
const along = S.playerMesh.position.x * n[0] + S.playerMesh.position.y * n[1] + S.playerMesh.position.z * n[2];
assert.ok(along > 1, 'the hull stands above the ground');

// ---- a cloud creature carries its own buffers
params.creature = 'amoeba'; params.heartLook = 'cloud'; heartModel = null;
a.buildActors();
assert.ok(S.creatureBase && S.creaturePos.length === S.creatureBase.length * 3 && S.creatureGeo.isBufferGeometry, 'the cloud buffers');
assert.equal(S.playerMesh.type, 'Points');
console.log('Board actors: heart cloud then model, hull at play size, marker on the map layer, shield shell, cloud creature.');
