// gunship-seat-pitch.mjs — THE SEAT'S FLOOR IS SHORT OF THE POLE (round 3, 2026-10-26; the owner: "sometimes the view from the Gunship does a
// jump-cut"). The seat's camera is a look-at along the aim with the planet's up (td-tab cameraPose; src/sentry-pilot.js pose); its pitch is clamped
// to GUNSHIP_PLATFORM's range. The old floor, -1.5708, was a hair past straight down (-pi/2 = -1.5707963): dragging the aim to the floor carried the
// look direction across the pole and the look-at's roll flipped 180 degrees in one frame, and back on the way up. Swept over the whole range in
// steps a drag makes, the orientation never moves more than a step's worth.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { GUNSHIP_PLATFORM } from '../src/content/gunship.js';

const cam = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1);
const look = (pitch) => { const d = fwd.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize(); cam.up.copy(up); cam.lookAt(d); return cam.quaternion.clone(); };
const deg = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;

assert.ok(GUNSHIP_PLATFORM.pitchMin > -Math.PI / 2 + 1e-3, `the floor ${GUNSHIP_PLATFORM.pitchMin} is short of straight down`);
assert.ok(deg(look(-1.5707), look(-1.5708)) > 170, 'the old floor flipped the roll (the cause, kept as a check of this test)');
const step = 0.002;   // 1 px of drag at the seat's 2x zoom (src/sentry-pilot.js: 0.004 / zoom)
let worst = 0;
for (let p = GUNSHIP_PLATFORM.pitchMax; p > GUNSHIP_PLATFORM.pitchMin; p -= step) worst = Math.max(worst, deg(look(p), look(Math.max(GUNSHIP_PLATFORM.pitchMin, p - step))));
assert.ok(worst < 1, `a pixel of drag turns the view under a degree over the whole range (worst ${worst.toFixed(3)})`);
console.log(`Gunship seat pitch stops short of the pole; a pixel of drag turns the view at most ${worst.toFixed(3)} degrees.`);
