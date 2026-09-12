import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { swingClip, nodeNamed } from '../src/fx/story-base.js';
import { STRUCTURES, KIT } from '../src/content/base-layout.js';
// a sealed bay 01 next to an open bay 02, named the way the loader names them (dots dropped)
const root = new THREE.Group();
const sealedRamp = new THREE.Quaternion(-0.736, 0, 0, 0.677).normalize(), openL = new THREE.Quaternion(0, -0.819, 0, 0.574).normalize(), openR = new THREE.Quaternion(0, 0.819, 0, 0.574).normalize();
for (const [name, q] of [['DOOR_01_L001', new THREE.Quaternion()], ['DOOR_01_R001', new THREE.Quaternion()], ['RAMP_01001', sealedRamp], ['DOOR_02_L001', openL], ['DOOR_02_R001', openR], ['RAMP_02001', new THREE.Quaternion()], ['VEHICLE_02001', new THREE.Quaternion()]]) {
  const o = new THREE.Object3D(); o.name = name; o.quaternion.copy(q); root.add(o);
}
const clip = swingClip(root, '01', '02', KIT.bay.doorSeconds);
assert.equal(clip.duration, KIT.bay.doorSeconds);
assert.deepEqual(clip.tracks.map((t) => t.name).sort(), ['DOOR_01_L001.quaternion', 'DOOR_01_R001.quaternion', 'RAMP_01001.quaternion'], 'every door and ramp of bay 01 swings');
const left = clip.tracks.find((t) => t.name.startsWith('DOOR_01_L'));
assert.deepEqual(Array.from(left.values.slice(0, 4)), [0, 0, 0, 1], 'starts sealed');
assert.ok(Math.abs(left.values[5] - openL.y) < 1e-6 && Math.abs(left.values[7] - openL.w) < 1e-6, 'ends at the open twin');
// played to the end on a mixer, bay 01 stands exactly like bay 02
const mixer = new THREE.AnimationMixer(root); const a = mixer.clipAction(clip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); mixer.update(KIT.bay.doorSeconds + 1);
assert.ok(root.getObjectByName('RAMP_01001').quaternion.angleTo(new THREE.Quaternion()) < 1e-6, 'ramp down');
assert.ok(root.getObjectByName('DOOR_01_R001').quaternion.angleTo(openR) < 1e-6, 'right door open');
assert.equal(nodeNamed(root, 'VEHICLE_02').name, 'VEHICLE_02001', 'authored names match as prefixes');
assert.equal(nodeNamed(root, 'VEHICLE_03'), null);
const bays = STRUCTURES.find((s) => s.id === 'bays');
assert.deepEqual(bays.bays.map((b) => b.n), [1, 2, 3]); assert.equal(bays.pose.Tank_Roll_Out, 0, 'every hull starts inside');
// the roll-out clip in the pinned diorama carries the hull exactly as far, and as long, as the content says
{ const { readFileSync } = await import('node:fs'); const b = readFileSync(new URL('../assets/models/kit/mork_container_low_diorama.glb', import.meta.url));
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = b.subarray(20 + len + 8);
  const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView]; return new Float32Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * ({ SCALAR: 1, VEC3: 3 }[a.type])); };
  const clip = j.animations.find((a) => a.name === bays.bays[2].rollout); assert.ok(clip, 'bay 3 names a clip in the diorama');
  const t = acc(clip.samplers[0].input), v = acc(clip.samplers[0].output);
  assert.equal(t[t.length - 1], KIT.bay.rollOutSeconds); assert.ok(Math.abs((v[v.length - 1] - v[2]) - KIT.bay.rollOutMetres) < 0.05, 'roll-out travel matches the content'); }
console.log('Story bays: sealed bay 01 swings open like bay 02 in ' + KIT.bay.doorSeconds + ' s.');
