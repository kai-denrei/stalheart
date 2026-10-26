// THE CAMERA'S JUMP METER (round 3, 2026-10-26; the owner: "sometimes the view from the Gunship does a jump-cut, we need to smooth the circling
// motion and ensure the camera never jumps wildly from one view to another"; spec docs/superpowers/specs/2026-10-26-round-3-gunship-view-and-radar-design.md,
// decision 1). The controller samples the camera once a painted frame, after it is placed and before the frame is drawn: the move since the last
// sample in metres (camera.position) and degrees (the angle between the two quaternions). state() is the harness's state().camJump: the largest
// move over the last `span` seconds, the worst while seated (the gunship's seat taken, not its map) and a ring of the frames over the watch
// thresholds with what the host's info() says then (the gunship's phase and clock, the seat, the shot). Cheap: two copies and a dot a frame.
//   createCamJump({ metres() (world units a metre), info() -> {}, watchM, watchDeg, span, keep }) -> { sample(camera, t, seated), reset(), state() }
import * as THREE from '../../vendor/three.module.js';

const DEG = 180 / Math.PI;

export function createCamJump({ metres = () => 1, info = () => ({}), watchM = 8, watchDeg = 6, span = 1, keep = 60 } = {}) {
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), recent = [], log = [];
  let have = false, frames = 0;
  const seated = { frames: 0, m: 0, deg: 0, mAt: null, degAt: null };
  const round = (x, k = 1) => +x.toFixed(k);
  return {
    // t: seconds on any steady clock (the controller passes the wall clock: headless barely advances the game's)
    sample(camera, t, isSeated = false) {
      frames++;
      if (!have) { pos.copy(camera.position); quat.copy(camera.quaternion); have = true; return; }
      const m = camera.position.distanceTo(pos) / (metres() || 1), deg = 2 * Math.acos(Math.min(1, Math.abs(quat.dot(camera.quaternion)))) * DEG;
      pos.copy(camera.position); quat.copy(camera.quaternion);
      recent.push([t, m, deg]); while (recent.length && t - recent[0][0] > span) recent.shift();
      if (isSeated) {
        seated.frames++;
        if (m > seated.m) { seated.m = m; seated.mAt = frames; }
        if (deg > seated.deg) { seated.deg = deg; seated.degAt = frames; }
      }
      if (m > watchM || deg > watchDeg) { log.push({ frame: frames, t: round(t, 2), m: round(m), deg: round(deg), seated: !!isSeated, ...info() }); if (log.length > keep) log.shift(); }
    },
    // a new world, a teleport the harness asks for: the next sample starts afresh
    reset() { have = false; },
    state: () => ({
      m: round(recent.reduce((a, r) => Math.max(a, r[1]), 0), 2), deg: round(recent.reduce((a, r) => Math.max(a, r[2]), 0), 2), frames,
      seated: { frames: seated.frames, m: round(seated.m, 2), deg: round(seated.deg, 2), mAt: seated.mAt, degAt: seated.degAt },
      log: log.slice(),
    }),
    // the harness's fresh window (the fight's, after the seat is taken): the worst and the log start over
    clear() { seated.frames = 0; seated.m = seated.deg = 0; seated.mAt = seated.degAt = null; log.length = 0; },
  };
}
