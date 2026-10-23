// mech-squad.mjs — the four Ridgebacks as walking batteries (src/fx/mech-squad.js; owner, 2026-10-23: "they are equipped with rotor + lancer + 2x quivers
// at max upgraded specs"): adopted after the drop, each owns four sentry records at the top tier, marked mech (autoTower), following the mech's cell; the
// angles tower-aim leaves on a record's rig reach the model's own pivots; the base mech walks toward the heart and parks; the hunter walks to an enemy.
// And tower-combat fires a record from its second list (host.mechTowers) as it fires a sentry.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createMechSquad } from '../src/fx/mech-squad.js';
import { TOWER_BY_KEY, MAX_TIER } from '../src/towers.js';
import { REINFORCEMENTS } from '../src/content/reinforcements.js';

// a ring of 60 cells round the equator; the heart at 0, the gate at 3; the arena far round at 30
const N = 60, centers = [], adj = [];
for (let i = 0; i < N; i++) { const a = i * 0.02; centers.push([Math.cos(a), Math.sin(a), 0]); adj.push([(i + 1) % N, (i + N - 1) % N]); }
const dist = centers.map((_, i) => Math.min(i, N - i)), cs = 0.02;
const graph = { centers, adj }, dungeon = { tags: new Array(N).fill(1), distToHeart: dist, heart: 0 };
const story = { arena: { cell: 30 }, gateCell: 3 };
const fakeMech = (i) => {
  const root = new THREE.Group(), wrap = new THREE.Group(); wrap.add(root);
  const part = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); part.name = 'HULL_PART';
  for (const n of ['MINIGUN_YAW', 'MINIGUN_PITCH', 'MINIGUN_SPIN', 'LASER_YAW', 'LASER_PITCH', 'MISSILE_ELEVATION', 'SOCKET_MINIGUN_MUZZLE_1', 'SOCKET_LASER_MUZZLE', 'SOCKET_MISSILE_L_1', 'SOCKET_MISSILE_R_1']) { const o = new THREE.Group(); o.name = n; root.add(o); }
  root.getObjectByName('MINIGUN_YAW').add(part.clone());
  wrap.position.fromArray(centers[[22, 23, 21, 24][i]]);
  const far = new THREE.Group(); far.name = 'FAR';
  return { wrap, root, mixer: new THREE.AnimationMixer(root), clips: [], drop: null, index: i, far };
};
let id = 100; const eye = new THREE.Vector3(...centers[22]).multiplyScalar(1.001);   // the camera beside the drop
const enemies = [{ alive: true, cur: 40 }];
const scene = new THREE.Scene();
const squad = createMechSquad({ scene, metres: () => cs / 10, cellSide: () => cs, graph: () => graph, dungeon: () => dungeon, story: () => story, enemies: () => enemies, hull: () => null, towerDef: (k) => TOWER_BY_KEY[k], towerId: () => id++, seed: 7, eye: () => eye });
const frame = { origin: new THREE.Vector3(...centers[22]), up: new THREE.Vector3(...centers[22]), z: new THREE.Vector3(0, 0, 1), x: new THREE.Vector3(1, 0, 0) };
squad.adopt([0, 1, 2, 3].map(fakeMech), frame, 22);

// one InstancedMesh a part for the four, their own meshes hidden and lending their matrices
{ const inst = scene.children.filter((o) => o.isInstancedMesh); assert.equal(squad.parts(), 1); assert.equal(inst.length, 1); assert.equal(inst[0].count, 4, 'four instances');
  squad.tick(0, 0); const mt = new THREE.Matrix4(); inst[0].getMatrixAt(2, mt); const p = new THREE.Vector3().setFromMatrixPosition(mt);
  assert.ok(p.distanceTo(new THREE.Vector3(...centers[21])) < 1e-6, 'mech 2\'s part where mech 2 stands'); }
const recs = squad.towers();
assert.equal(recs.length, 16, 'sixteen records');
assert.deepEqual([...new Set(recs.map((r) => r.key))].sort(), ['lancer', 'quiver', 'rotor'], 'rotor, lancer, quivers');
assert.ok(recs.every((r) => r.tier === MAX_TIER && r.mech === true && r.def === TOWER_BY_KEY[r.key]), 'the sentry defs at the top tier, marked mech');
assert.equal(new Set(recs.map((r) => r.id)).size, 16, 'their own ids');
assert.ok(recs.every((r) => r.obj.userData.head && r.obj.userData.headFacing === 0 && r.obj.userData.pitchNode && r.obj.userData.muzzles.length === 1), 'a rig with a head, a pitch and the model\'s muzzle');
assert.deepEqual(squad.state().map((m) => m.role), REINFORCEMENTS.roles);

// the aim reaches the model: a rig's head turned 0.3 rad and pitched, the model's pivots follow (clamped at the sector)
const rotor = recs.find((r) => r.key === 'rotor' && r.mechIndex === 0);
rotor.obj.userData.head.rotation.y = 0.3; rotor.obj.userData.pitchNode.rotation.x = -0.2;
squad.tick(0, 0);
const m0root = rotor.obj.userData.muzzles[0].parent;
assert.ok(Math.abs(m0root.getObjectByName('MINIGUN_YAW').rotation.y - 0.3) < 1e-9 && Math.abs(m0root.getObjectByName('MINIGUN_PITCH').rotation.x + 0.2) < 1e-9, 'the minigun follows its rig');
rotor.obj.userData.head.rotation.y = 2; squad.tick(0, 0);
assert.ok(Math.abs(m0root.getObjectByName('MINIGUN_YAW').rotation.y - Math.PI / 5) < 1e-9, 'within the model\'s sector');

// the far tier: near the eye the game tier shows; 200 m off the far one; back inside 120 m the game tier again (20 m of hysteresis under 140)
squad.tick(1 / 30, 0); assert.ok(squad.state().every((m) => m.far === false), 'near: the game tier');
eye.copy(new THREE.Vector3(...centers[22])).multiplyScalar(1 + 200 * cs / 10); squad.tick(1 / 30, 0); assert.ok(squad.state().every((m) => m.far === true), '200 m: the far tier');
eye.copy(new THREE.Vector3(...centers[22])).multiplyScalar(1 + 130 * cs / 10); squad.tick(1 / 30, 0); assert.ok(squad.state().every((m) => m.far === true), '130 m: still far (hysteresis)');
eye.copy(new THREE.Vector3(...centers[22])).multiplyScalar(1.001); squad.tick(1 / 30, 0); assert.ok(squad.state().every((m) => m.far === false), 'near again');
// the walk: 60 game seconds at 30 Hz
for (let k = 0; k < 1800; k++) squad.tick(1 / 30, k / 30);
const st = squad.state(), base = st.find((m) => m.role === 'base'), hunt = st.find((m) => m.role === 'hunt'), arena = st.filter((m) => m.role === 'arena');
assert.ok(base.heartDist < base.startDist, `the base mech walks toward the heart (${base.startDist} -> ${base.heartDist})`);
assert.ok(hunt.cell > 24 && hunt.cell <= 40, `the hunter walks to the enemy at 40 (${hunt.cell})`);
assert.ok(arena.every((m) => m.onPlain), 'the arena pair on the plain');
assert.ok(recs.every((r) => r.ci === st[r.mechIndex].cell || adj[st[r.mechIndex].cell].includes(r.ci)), 'the records follow their mech');
const want = REINFORCEMENTS.pace * 10 / (0.27778 * REINFORCEMENTS.scale);   // the heavy gait (round 2): ground speed / (the demo's walk x scale), ~3.84
assert.ok(st.every((m) => (m.walking ? Math.abs(m.rate - want) < 0.01 : m.rate === 0) && m.gait.rate === m.rate), `the gait's rate at the pace (${st.map((m) => m.rate)} vs ${want.toFixed(2)})`);
assert.ok(st.filter((m) => m.walking).every((m) => Math.abs(m.gait.speed - REINFORCEMENTS.pace * 10) < 0.05), `the measured ground speed (${st.map((m) => m.gait.speed)} m/s)`);
squad.restore(); assert.equal(squad.towers().length, 0, 'restored'); assert.equal(scene.children.filter((o) => o.isInstancedMesh).length, 0, 'the parts gone');
console.log(`mech-squad: sixteen top-tier records on four mechs, the aim on the model's pivots, the base mech ${base.startDist} -> ${base.heartDist} hops from the heart, the hunter at ${hunt.cell}`);
