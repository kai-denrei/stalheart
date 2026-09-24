// --- THE PULL-OUT ---------------------------------------------------------
//
// The camera leaves. It starts wherever the player was watching from —
// third person, orbit, whatever — and climbs away from the hull until the
// planet is a marble against the galaxy the sky is already made of, holds
// there a beat, and hands over to the debrief. Its path is src/domain/victory-pull.js, its numbers
// src/content/victory-pull.js; the controller hands in its camera, its scratch camera, its shot runner and what the end does.
//
// It rides camShot rather than owning a clock, for the reason written on
// that function: every timed camera takeover that owned its own teardown
// eventually got one wrong, and one of them ate every key in the game
// permanently. One shot at a time, one teardown, and the latch is the shot
// itself.
//
// SKIPPABLE, like every other shot here. A player who has seen it four
// times should not be held, and the skip path already exists and is tested.
import * as THREE from '../../vendor/three.module.js';
import { pullOutPath } from '../domain/victory-pull.js';
import { VICTORY_PULL } from '../content/victory-pull.js';

export function startVictoryPull({ camera, tmpCam, startShot, setView, debrief }, pull = VICTORY_PULL) {
  // where the camera IS, so the move starts from the player's own view
  // rather than snapping to a canonical one first — a cut before a pull-out
  // throws away the only thing that makes it read as leaving
  const from = camera.position.clone();
  const camR = from.length();
  const dir0 = from.clone().normalize();
  const ref = Math.abs(dir0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(dir0, ref).normalize();
  // THE INSTRUMENTS GO. A wide shot of a planet with a score, a throttle and
  // a radar over it is a level with the camera pulled back; the same shot
  // with the glass cleared is an ending. This is most of what "markedly
  // different" costs.
  document.body.classList.add('td-victory');
  startShot({
    id: 'victory',
    dur: pull.seconds,
    poseAt: (u, out) => {
      const { r, spin } = pullOutPath(u, camR, pull);
      const axis = new THREE.Vector3(0, 1, 0);
      const d = dir0.clone().applyAxisAngle(axis, spin).multiplyScalar(r);
      out.pos.copy(d);
      tmpCam.position.copy(out.pos);
      tmpCam.up.copy(up);
      tmpCam.lookAt(0, 0, 0);
      out.quat.copy(tmpCam.quaternion);
    },
    onEnd: () => {
      // STAY WIDE. When the shot released the camera it snapped straight
      // back to the hull — measured, 5.20 to 1.23 in one frame — and the
      // debrief then opened over a close-up of a tank standing in an empty
      // sector, which is the opposite of what the pull-out just said. Orbit
      // is the view that keeps the planet in shot, and it is what the
      // reveal shot hands back to for the same reason.
      setView('orbit');
      document.body.classList.remove('td-victory');
      debrief();
    },
  });
}
