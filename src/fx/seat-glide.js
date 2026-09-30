// THE SEAT GLIDE (owner, 2026-09-30, third playtest: "2) switch between rotor and quiver is too abrupt"). A seat's camera sits exactly
// on its optic every frame, so a scripted hand-over (the story's pilot: the Rotor at the first wave, the Quiver at the hard cores)
// was a cut from one optic to the next. Now the camera leaves from wherever it is and eases into the new optic along a raised arc,
// over `seconds`; the optic's chrome (the pilot panel and the scope) fades in as it lands (styles.css body.seat-gliding). The aim is
// live the whole time: the glide only moves the picture toward the pose the seat already computes.
//
// `begin(camera)` captures the start before the seat is entered; `place(camera, goal, dt)` puts the camera on the seat's goal, or on
// the blend while a glide runs. `cancel()` ends it at once (a seat left mid-glide).
import * as THREE from '../../vendor/three.module.js';

export function createSeatGlide({ seconds = 1.4, lift = 0.35, body = globalThis.document?.body ?? null } = {}) {
  const fromPos = new THREE.Vector3(), fromQuat = new THREE.Quaternion(), up = new THREE.Vector3();
  let age = -1, n = 0;   // n: glides begun, for the harness
  const mark = (on) => body?.classList.toggle('seat-gliding', on);
  return {
    begin(camera) { fromPos.copy(camera.position); fromQuat.copy(camera.quaternion); age = 0; n++; mark(true); },
    cancel() { if (age >= 0) { age = -1; mark(false); } },
    active: () => age >= 0,
    place(camera, goal, dt) {
      if (age < 0) { camera.position.copy(goal.pos); camera.quaternion.copy(goal.quat); return; }
      age += dt;
      const u = Math.min(1, age / seconds), e = u * u * (3 - 2 * u);
      // the arc rises off the planet between the two eyes by `lift` of their distance, so the move reads as leaving one post for another
      up.copy(fromPos).add(goal.pos).normalize();
      camera.position.lerpVectors(fromPos, goal.pos, e).addScaledVector(up, Math.sin(Math.PI * e) * lift * fromPos.distanceTo(goal.pos));
      camera.quaternion.copy(fromQuat).slerp(goal.quat, e);
      if (u >= 1) { age = -1; mark(false); }
    },
    state: () => ({ n, active: age >= 0, u: age >= 0 ? +Math.min(1, age / seconds).toFixed(2) : null }),
  };
}
