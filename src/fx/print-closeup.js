// THE PRINT CLOSE-UP (round 4, 2026-11-02, note 4: the antenna printed on screen as the companions are): the live cut round something Isao prints,
// through timed angles in the subject's own metres (src/domain/pet-print.js printCamera: x right of its facing, y up, z its facing; each eye and
// look eased over its span, scaled by `size`), lifted out of src/fx/pet-print.js so the antenna's print (src/fx/antenna-print.js) runs the same
// rail. A lock of `shot.lock` seconds nothing skips, then only `shot.skipKey` (src/fx/camera-shot.js lockFor / skipKey, the FEIDS-26 drop's rule),
// its `shot.hint` line from the lock's end to the cut's end; the camera's near plane lowered to `shot.near` and each angle's fov while the cut runs,
// both put back at its end; a change of angle is a cut (snapCamera), not the game camera's glide.
//   host: camera, startShot, endShot, snapCamera
//   createPrintCloseup(host, shot { id, lock, skipKey, hint, near, hintId }) -> { begin(rig), tick(dt), end(), active(), angle(), lens(), hint(), restore() }
//   rig: { origin, x, up, z (world vectors; x, up, z unit), m (world units a metre), angles, size, dur (s), clock() (the scene's seconds), done()? (true:
//         hold the last pose), onEnd()? (the cut over: its end, a skip or end()) }
//   framePoint(rig, p, out) -> the rig-metre point p in world units
import * as THREE from '../../vendor/three.module.js';
import { printCamera } from '../domain/pet-print.js';

export const framePoint = (r, p, out) => out.copy(r.origin).addScaledVector(r.x, p[0] * r.m).addScaledVector(r.up, p[1] * r.m).addScaledVector(r.z, p[2] * r.m);

export function createPrintCloseup(h, S) {
  let rig = null, hintEl = null, lens = null, angle = -1;
  function hintOn() { if (hintEl || typeof document === 'undefined') return; hintEl = document.createElement('div'); hintEl.id = S.hintId; hintEl.innerHTML = `<footer><span>${S.hint}</span></footer>`; document.body.append(hintEl); }
  function hintOff() { hintEl?.remove(); hintEl = null; }
  function lensOn(fov) { if (!lens) lens = { fov: h.camera.fov, near: h.camera.near }; h.camera.near = S.near; h.camera.fov = fov; h.camera.updateProjectionMatrix(); }
  function lensOff() { if (!lens) return; h.camera.near = lens.near; h.camera.fov = lens.fov; h.camera.updateProjectionMatrix(); lens = null; }
  function begin(r) {
    rig = r; angle = -1;
    const eye = new THREE.Vector3(), look = new THREE.Vector3(), m4 = new THREE.Matrix4();
    h.startShot({ id: S.id, dur: r.dur, skippable: true, lockFor: S.lock, skipKey: S.skipKey, onEnd: () => { const was = rig; rig = null; hintOff(); lensOff(); was?.onEnd?.(); h.snapCamera(); }, poseAt(u, out) {
      if (!rig || rig.done?.()) return;
      const cam = printCamera(rig.clock(), rig.angles, rig.size);
      framePoint(rig, cam.eye, eye); framePoint(rig, cam.look, look); m4.lookAt(eye, look, rig.up);
      out.pos.copy(eye); out.quat.setFromRotationMatrix(m4);
    } });
  }
  function tick(dt) {
    if (!rig) return;
    const t = rig.clock(), a = printCamera(t, rig.angles, rig.size).angle;
    lensOn(rig.angles[a].fov); if (t >= S.lock) hintOn();
    if (a !== angle) { angle = a; if (dt > 0) h.snapCamera(); }
  }
  return {
    begin, tick,
    end() { if (rig) h.endShot(); },   // the shot's own teardown runs onEnd
    active: () => !!rig, angle: () => angle, lens: () => (lens ? { near: h.camera.near, fov: h.camera.fov } : null), hint: () => !!hintEl,
    restore() { rig = null; hintOff(); lensOff(); },
  };
}
