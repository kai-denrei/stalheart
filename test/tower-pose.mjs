// tower-pose.mjs — a tower's pose (src/fx/tower-pose.js, moved out of src/td-tab.js in refactor round 3) over a three-cell board:
// the scale is the model's base scale x cell x 0.62 x ?towerscale= (0.72 unless a sane number) x 1.12 per tier; the pedestal's
// footprint is measured once at unit scale; a mounted Sentry stands on its wall's roof slid toward the open cell (towerPerch); a
// walker stands where it has walked, on the roof only on its own cell, facing its heading; a story socket lifts it by socketLift.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { norm3, dot3, len3 } from '../src/vec3.js';
import { BLOCKED } from '../src/dungeon.js';
import { towerPerch } from '../src/domain/tower-perch.js';
import { createTowerPose } from '../src/fx/tower-pose.js';

const centers = [norm3([0, 0, 1]), norm3([0.05, 0, 1]), norm3([0.1, 0, 1])];
const graph = { centers, normals: centers, adj: [[1], [0, 2], [1]] };
const dungeon = { tags: [BLOCKED, 2, 2], distToHeart: [0, 1, 2] };
let story = null;
const make = (flags) => createTowerPose({
  flags, params: { wallHeight: 0.05 }, tmpN: new THREE.Vector3(), Y_AXIS: new THREE.Vector3(0, 1, 0),
  graph: () => graph, dungeon: () => dungeon, mesh: () => null, story: () => story, cellSide: () => 0.05,
  cellIndex: () => (p) => centers.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < 0.01),
});
const towerAt = (tier, extra = {}) => {
  const obj = new THREE.Group();
  obj.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.6)));
  return { ci: 0, tier, def: { color: 0xff0000 }, obj, ...extra };
};
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

// ---- scale and footprint; ?towerscale= only when sane
for (const [flags, k] of [[{}, 0.72], [{ towerscale: '1.5' }, 1.5], [{ towerscale: '9' }, 0.72], [{ towerscale: 'x' }, 0.72]]) {
  const tw = towerAt(2);
  make(flags).placeTowerObj(tw);
  close(tw.obj.scale.x, 0.05 * 0.62 * k * 1.12 ** 2, `scale for ${JSON.stringify(flags)}`);
  close(tw.obj.userData.footprintUnit, 0.2, 'the pedestal half width, the short horizontal axis');
  close(tw.obj.userData.footprintR, 0.2 * tw.obj.scale.x, 'footprint at play scale');
}

// ---- a mounted Sentry: on the roof, slid toward the open neighbour, upright on the cell's normal
const pose = make({});
const tw = towerAt(0);
pose.placeTowerObj(tw);
const perch = pose.perchOf(tw);
assert.deepEqual(perch, towerPerch(tw, graph, dungeon, null, undefined), 'perchOf is towerPerch over the board');
const p = tw.obj.position.toArray();
close(len3(p), 1.05, 'on the wall roof');
assert.ok(p[0] / len3(p) > 0, 'slid toward the open cell');
const up = new THREE.Vector3(0, 1, 0).applyQuaternion(tw.obj.quaternion);
close(up.dot(new THREE.Vector3(...centers[0])), 1, 'upright on the cell normal');

// ---- a story socket lifts by socketLift instead of the wall height
story = { sockets: new Set([0]), socketLift: 0.01 };
pose.placeTowerObj(tw);
close(len3(tw.obj.position.toArray()), 1.01, 'on its socket');
story = null;

// ---- a walker: where it walked, on the ground off its cell, facing its heading, its gait set
const gaits = [];
const wk = towerAt(1, { a6: { pos: centers[2], moving: true, head: [1, 0, 0] } });
wk.obj.userData.setGait = (on) => gaits.push(on);
pose.placeTowerObj(wk);
close(len3(wk.obj.position.toArray()), 1, 'a walker off its cell stands on the ground');
assert.deepEqual(gaits, [true]);
const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(wk.obj.quaternion);
assert.ok(fwd.x > 0.99, 'facing its heading');
wk.a6.pos = centers[0]; wk.a6.head = null;
pose.placeTowerObj(wk);
close(len3(wk.obj.position.toArray()), 1.05, 'on its own (wall) cell it stands on the roof');
close(dot3([0, 1, 0].map((v, i) => new THREE.Vector3(0, 1, 0).applyQuaternion(wk.obj.quaternion).toArray()[i]), centers[0]), 1, 'no heading: upright');
console.log('Tower pose: scale with tier and ?towerscale=, the footprint, the perch, a socket, a walker facing its way.');
