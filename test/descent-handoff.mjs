// THE DESCENT'S HANDOFF IN HOLE UNITS (owner, 2026-11-05, round 5 note 10; src/domain/descent-handoff.js): the arena breach's own frame as src/game-breaches.js builds
// it (the same axes Three.js composes there), world points and camera poses into hole units and back, the world-to-hole matrix, the handoff BELOW is answered with
// (the dive's last pose half a hole radius down, the carcass taken to hole units), and the outcome's pose
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import { HOLE_TURN, holeFrame, toHole, fromHole, poseToHole, poseFromHole, holeMatrix, mul4, apply4, handoffOf, outcomePose } from '../src/domain/descent-handoff.js';
import { DESCENT } from '../src/content/descent.js';
import { ARENA } from '../src/content/sectors.js';

const near = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);
const center = [0.31, 0.82, -0.48], heart = [0, 1, 0], cellSide = 0.0133, s = cellSide * ARENA.craterCells;

// the frame is the breach group's: src/game-breaches.js create(normal, forward = heart - n, scale) composed with Three.js
const up = new THREE.Vector3(...center).normalize(), n = up.toArray(), zz = new THREE.Vector3(...heart).sub(up).projectOnPlane(up).normalize();
const xx = new THREE.Vector3().crossVectors(up, zz).normalize(); zz.crossVectors(xx, up);
const obj = new THREE.Object3D(); obj.position.copy(up); obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, up, zz)); obj.rotateY(1 - Math.PI / 2); obj.scale.setScalar(s); obj.updateMatrixWorld(true);
const f = holeFrame(center, heart, s);
assert.equal(HOLE_TURN, 1 - Math.PI / 2);
for (const local of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.7, -0.55, 0.2], [-1.3, 0.1, 2]]) {
  const w = obj.localToWorld(new THREE.Vector3(...local)).toArray();
  assert.ok(near(fromHole(f, local), w, 1e-12), `hole ${local} is the breach group's local point (${fromHole(f, local)} vs ${w})`);
  assert.ok(near(toHole(f, w), local, 1e-9), 'and back');
}
assert.ok(near(f.o, n, 1e-12) && Math.abs(Math.hypot(...f.x) - 1) < 1e-12 && Math.abs(Math.hypot(...f.z) - 1) < 1e-12, 'the origin on the unit sphere, unit axes');
// a heart straight overhead: the fallback axis, still a right-handed frame
{ const g = holeFrame([0, 1, 0], [0, 2, 0], 1); assert.ok(Math.abs(g.x[0] * g.y[0] + g.x[1] * g.y[1] + g.x[2] * g.y[2]) < 1e-12 && Math.hypot(...g.z) > 0.99, 'the fallback axis'); }

// poses: the round trip; the matrix agrees with the points and composes
const pose = { pos: fromHole(f, [0.2, 0.4, -0.3]), fwd: [0, -0.6, 0.8], up: [0.8, 0, 0.6], fov: 33 };
const h = poseToHole(f, pose), back = poseFromHole(f, h);
assert.ok(near(back.pos, pose.pos, 1e-12) && near(back.fwd, pose.fwd, 1e-12) && near(back.up, pose.up, 1e-12) && back.fov === 33, 'a pose to hole units and back');
const M = holeMatrix(f), p = fromHole(f, [0.5, -0.25, 1.5]);
assert.ok(near(apply4(M, p), [0.5, -0.25, 1.5], 1e-9), 'the matrix: world to hole units');
const T = new THREE.Matrix4().makeTranslation(0.1, 0.2, 0.3).multiply(new THREE.Matrix4().makeRotationY(0.7)).toArray();
assert.ok(near(mul4(M, T), new THREE.Matrix4().fromArray(M).multiply(new THREE.Matrix4().fromArray(T)).toArray(), 1e-12), 'mul4 is Three.js\'s a x b');

// the dive's last pose (src/fx/hole-door.js divePose at its end: DESCENT.door.under cells down the axis, looking down it) is half a hole radius under the surface
const under = fromHole(f, [0, 0, 0]).map((v, i) => v - n[i] * DESCENT.door.under * cellSide), dive = poseToHole(f, { pos: under, fwd: n.map((v) => -v), up: f.x, fov: 30 });
assert.ok(near(dive.pos, [0, -DESCENT.door.under / ARENA.craterCells, 0], 1e-9), `the dive ends ${DESCENT.door.under / ARENA.craterCells} of a hole radius down the axis (${dive.pos})`);
assert.ok(near(dive.fwd, [0, -1, 0], 1e-12) && near(dive.up, [1, 0, 0], 1e-12), 'looking straight down, its top along the hole\'s x');

// the handoff: the pose in hole units, the carcass's world matrix taken to hole units (toWorld dropped), the rest as handed
const carcass = { chain: { core: [0, 0, 0], coreRadii: [1, 1, 1], limbs: [] }, C: { chain: {} }, toWorld: T, tone: 0.3, moved: [], char: [], gone: [] };
const msg = handoffOf({ pose: { pos: under, fwd: n.map((v) => -v), up: f.x, fov: 30 }, sky: { daylight: 0.4, bg: 0x0b1524 }, carcass, radius: 30 }, f);
assert.ok(near(msg.pose.pos, dive.pos) && msg.sky.daylight === 0.4 && msg.radius === 30 && msg.v === 1);
assert.ok(near(msg.carcass.toHole, mul4(M, T), 1e-15) && !('toWorld' in msg.carcass) && msg.carcass.tone === 0.3 && carcass.toWorld === T, 'the carcass to hole units, the caller\'s left alone');
assert.equal(handoffOf({ pose }, f).carcass, null, 'no carcass: null');
// the cave's outcome: its climb's last pose, or nothing
assert.equal(outcomePose({ below: 'rescued' }), null); assert.equal(outcomePose({ below: 'rescued', pose: { pos: [0, 1], fwd: [0, 1, 0], up: [0, 0, -1] } }), null);
assert.deepEqual(outcomePose({ below: 'rescued', pose: { pos: [0, -0.55, 0], fwd: [0, 1, 0], up: [0, 0, -1], fov: 72 } }).pos, [0, -0.55, 0]);
// THE SAME BODY (note 10b): BELOW builds the carcass with this game's tube builder, vendored as below/src/stalheart/carcass-tube.js: the same file but its three.js import
{ const ours = readFileSync(new URL('../src/fx/boss-carcass/tube.js', import.meta.url), 'utf8').split('\n'), theirs = readFileSync(new URL('../below/src/stalheart/carcass-tube.js', import.meta.url), 'utf8').split('\n');
  const differ = ours.map((l, i) => (l === theirs[i] ? null : i)).filter((i) => i != null);
  assert.equal(ours.length, theirs.length, 'the vendored tube builder has the same lines'); assert.deepEqual(differ.map((i) => /^import \* as THREE from /.test(ours[i]) && /^import \* as THREE from /.test(theirs[i])), differ.map(() => true), `only the three.js import differs (lines ${differ})`); }
console.log(`descent-handoff.mjs: the breach's frame (Three.js agrees to 1e-12), poses and the matrix round-trip; the dive ends ${(DESCENT.door.under / ARENA.craterCells).toFixed(2)} hole radii down; the carcass in hole units`);
