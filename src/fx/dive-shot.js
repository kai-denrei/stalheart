// The establishing dive: the whole planet from orbit through a pre-roll, a fast dive to a close view over a point on the
// ground, a hold, then a short blend back to where the camera was. Taken out of the controller's sinkhole shot so the back
// door's rock collapse frames the same way. Poses are host units on the unit sphere; the controller owns the shot latch.
import * as THREE from '../../vendor/three.module.js';

const tmpCam = new THREE.PerspectiveCamera();
const ease = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };

// hooks: { camera, startShot, cellSide }. `direction` is a unit THREE.Vector3 on the ground point. `dive` is
// { height, back, diveSeconds } (STORY_BREACH: cells above the point, pulled toward the pole by `back`) or null for the
// orbit-only shot. The pose leaves orbit after `preRoll`, holds `hold` seconds, blends home over `tail`. Returns the length.
export function startDiveShot({ camera, startShot, cellSide }, direction, { id = 'breach', preRoll = 0, hold = 0, tail = 1.8, dive = null, onEnd = null } = {}) {
  const returnPos = camera.position.clone(), returnQuat = camera.quaternion.clone(), far = direction.clone().multiplyScalar(3.3), up = camera.up.clone();
  const dur = preRoll + tail + hold;
  const toBase = new THREE.Vector3(0, 1, 0).sub(direction.clone().multiplyScalar(direction.y)).normalize();
  const near = direction.clone().multiplyScalar(1 + cellSide * (dive?.height ?? 5)).addScaledVector(toBase, cellSide * (dive?.back ?? 4)), nearQ = new THREE.Quaternion();
  tmpCam.position.copy(near); tmpCam.up.copy(direction); tmpCam.lookAt(direction); nearQ.copy(tmpCam.quaternion);
  startShot({ id, dur, onEnd, poseAt: (u, out) => {
    const s = u * dur, blend = ease((s - preRoll - hold) / tail);
    tmpCam.position.copy(far); tmpCam.up.copy(up); tmpCam.lookAt(0, 0, 0);
    if (dive) { const k = ease((s - preRoll) / (dive.diveSeconds ?? 1.4)); out.pos.copy(far).lerp(near, k); out.quat.copy(tmpCam.quaternion).slerp(nearQ, k); } else { out.pos.copy(far); out.quat.copy(tmpCam.quaternion); }
    out.pos.lerp(returnPos, blend); out.quat.slerp(returnQuat, blend);
  } });
  return dur;
}
