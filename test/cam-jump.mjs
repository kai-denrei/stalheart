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
// THE SKY METER (round 6 note 3, 2026-11-05): a seated frame whose forward has a component along its own radial faces above the horizon; counted
// with the host's info, the first eight kept and the latest eight; frames off the seat are not the seat's; clear() starts it over
{
  let k = 0;
  const sky = createCamJump({ info: () => ({ k: ++k, hole: 3.6 }) }), c = new THREE.PerspectiveCamera();
  c.position.set(0, 1.5, 0); c.up.set(0, 0, -1); c.lookAt(0, 0, 0); sky.sample(c, 0, true);   // straight down, the seat's own look
  assert.deepEqual([sky.sky().frames, sky.sky().up, sky.sky().top], [1, 0, -1], 'a look down is seated and not the sky, the first sample included');
  c.up.set(0, 1, 0); c.lookAt(1, 1.5 + Math.tan(0.3), 0); sky.sample(c, 0.1, true);   // 0.3 rad over the horizon
  const s = sky.sky();
  assert.deepEqual([s.frames, s.up, s.top], [2, 1, +Math.sin(0.3).toFixed(3)], 'a look over the horizon counts, its dot the sine of its elevation');
  assert.deepEqual([s.first.length, s.first[0].hole, s.first[0].dot], [1, 3.6, +Math.sin(0.3).toFixed(3)], 'with the host info of that frame (the hull from the hole)');
  sky.sample(c, 0.2, false);
  assert.equal(sky.sky().frames, 2, 'a frame off the seat is not counted');
  for (let i = 0; i < 20; i++) sky.sample(c, 0.3 + i * 0.01, true);
  assert.deepEqual([sky.sky().up, sky.sky().first.length, sky.sky().last.length], [21, 8, 8], 'the first eight and the latest eight kept');
  sky.clear();
  assert.deepEqual([sky.sky().frames, sky.sky().up, sky.sky().first.length], [0, 0, 0], 'clear() starts the sky meter over too');
}
console.log('Camera jump meter measures metres and degrees a frame, the seated worst and the log; the sky meter counts seated frames over the horizon.');
