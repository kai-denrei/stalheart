// cam-jump.mjs — the camera's jump meter (round 3, 2026-10-26, src/fx/cam-jump.js): the move a frame in metres and degrees, the worst while
// seated, the last second's largest, the log of frames over the watch thresholds with the host's info, a fresh window on clear().
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createCamJump } from '../src/fx/cam-jump.js';

const cam = new THREE.PerspectiveCamera();
let n = 0;
const meter = createCamJump({ metres: () => 0.5, info: () => ({ n: ++n }) });   // 0.5 world units a metre
meter.sample(cam, 0, true);
assert.deepEqual([meter.state().seated.frames, meter.state().log.length], [0, 0], 'the first sample only seeds');
cam.position.set(1, 0, 0); meter.sample(cam, 0.1, true);   // 1 unit = 2 m
assert.equal(meter.state().seated.m, 2, 'metres through metres()');
cam.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(30)); meter.sample(cam, 0.2, true);
assert.equal(meter.state().seated.deg, 30, 'the angle between the two orientations');
assert.equal(meter.state().log.length, 1, 'the 30-degree frame is logged');
assert.deepEqual([meter.state().log[0].seated, meter.state().log[0].n], [true, 1], 'with the seat and the host info');
cam.position.set(100, 0, 0); meter.sample(cam, 0.3, false);   // 198 m, not seated
assert.equal(meter.state().seated.m, 2, 'a move off the seat is not the seat\'s');
assert.equal(meter.state().m, 198, 'the last second\'s largest counts every frame');
meter.sample(cam, 2, true);
assert.deepEqual([meter.state().m, meter.state().deg], [0, 0], 'a second later the window is clear');
meter.clear();
assert.deepEqual([meter.state().seated.m, meter.state().seated.deg, meter.state().log.length], [0, 0, 0], 'clear() starts the window over');
console.log('Camera jump meter measures metres and degrees a frame, the seated worst and the log.');
