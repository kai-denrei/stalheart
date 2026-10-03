// THE SEAT GLIDE (owner, 2026-09-30, third playtest: "2) switch between rotor and quiver is too abrupt"). A seat's camera sits exactly
// on its optic every frame, so a scripted hand-over (the story's pilot: the Rotor at the first wave, the Quiver at the hard cores)
// was a cut from one optic to the next. Now the camera leaves from wherever it is and eases into the new optic along a raised arc,
// over `seconds`; the optic's chrome (the pilot panel and the scope) fades in as it lands (styles.css body.seat-gliding). The aim is
// live the whole time: the glide only moves the picture toward the pose the seat already computes.
//
// `begin(camera)` captures the start before the seat is entered; `place(camera, goal, dt)` puts the camera on the seat's goal, or on
// the blend while a glide runs. `cancel()` ends it at once (a seat left mid-glide). `hold()` true (the game paused): no glide starts.
import * as THREE from '../../vendor/three.module.js';

// `wait()` true (the scripted hand-over shot is flying): the glide holds, the seat's chrome stays hidden and the camera follows the goal,
// so the next optic's HUD only shows once the eye is on it (owner, 2026-10-03: "we only ever see the HUD of what we commandeer")
export function createSeatGlide({ seconds = 1.4, far = 3.2, lift = 0.35, hold = () => false, wait = () => false, body = globalThis.document?.body ?? null } = {}) {
  const fromPos = new THREE.Vector3(), fromQuat = new THREE.Quaternion(), up = new THREE.Vector3(), dir = new THREE.Vector3(), to = new THREE.Vector3(), side = new THREE.Vector3();
  let age = -1, n = 0, span = seconds;   // span: this glide's seconds, decided on its first frame   // n: glides begun, for the harness
  const mark = (on) => body?.classList.toggle('seat-gliding', on);
  return {
    begin(camera) { if (hold()) return;   /* a paused game does not run the frame that would carry it: the seat's own snap stands */
      fromPos.copy(camera.position); fromQuat.copy(camera.quaternion); age = 0; n++; span = 0; mark(true); },
    cancel() { if (age >= 0) { age = -1; mark(false); } },
    active: () => age >= 0,
    place(camera, goal, dt) {
      if (age < 0 || wait()) { camera.position.copy(goal.pos); camera.quaternion.copy(goal.quat); return; }
      if (!span) span = fromPos.dot(goal.pos) / ((fromPos.length() * goal.pos.length()) || 1) < 0.5 ? far : seconds;   // a trip round the planet takes `far` seconds
      age += dt;
      const u = Math.min(1, age / span), e = u * u * (3 - 2 * u);
      // the arc rises off the planet between the two eyes by `lift` of their distance, so the move reads as leaving one post for another.
      // FAR APART (SOL-82's seat over the antipode, 2026-10-01) the straight line would pass through the planet and the sum of the two
      // eyes has no direction: the camera travels round the sphere instead, its direction slerped and its height lifted
      const ra = fromPos.length(), rb = goal.pos.length();
      if (ra > 0 && rb > 0 && fromPos.dot(goal.pos) / (ra * rb) < 0.5) {
        dir.copy(fromPos).normalize(); to.copy(goal.pos).normalize();
        const om = Math.acos(Math.max(-1, Math.min(1, dir.dot(to))));
        if (om > 1e-4 && Math.PI - om > 1e-3) { const s0 = Math.sin((1 - e) * om) / Math.sin(om), s1 = Math.sin(e * om) / Math.sin(om); dir.multiplyScalar(s0).addScaledVector(to, s1); }
        else { side.set(1, 0, 0).cross(dir); if (side.lengthSq() < 1e-6) side.set(0, 1, 0).cross(dir); side.normalize(); dir.applyAxisAngle(side, e * om); }   // exactly opposite: any great circle
        camera.position.copy(dir.normalize()).multiplyScalar(ra + (rb - ra) * e + Math.sin(Math.PI * e) * lift * Math.max(ra, rb));
      } else {
        up.copy(fromPos).add(goal.pos).normalize();
        camera.position.lerpVectors(fromPos, goal.pos, e).addScaledVector(up, Math.sin(Math.PI * e) * lift * fromPos.distanceTo(goal.pos));
      }
      camera.quaternion.copy(fromQuat).slerp(goal.quat, e);
      if (u >= 1) { age = -1; mark(false); }
    },
    state: () => ({ n, active: age >= 0, u: age >= 0 && span ? +Math.min(1, age / span).toFixed(2) : null }),
  };
}
