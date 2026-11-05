// THE CAMERA'S JUMP METER (round 3, 2026-10-26; the owner: "sometimes the view from the Gunship does a jump-cut, we need to smooth the circling
// motion and ensure the camera never jumps wildly from one view to another"; spec docs/superpowers/specs/2026-10-26-round-3-gunship-view-and-radar-design.md,
// decision 1). The controller samples the camera once a painted frame, after it is placed and before the frame is drawn: the move since the last
// sample in metres (camera.position) and degrees (the angle between the two quaternions). state() is the harness's state().camJump: the largest
// move over the last `span` seconds, the worst while seated (the gunship's seat taken, not its map) and a ring of the frames over the watch
// thresholds with what the host's info() says then (the gunship's phase and clock, the seat, the shot). Cheap: two copies and a dot a frame.
//   createCamJump({ metres() (world units a metre), info() -> {}, watchM, watchDeg, span, keep }) -> { sample(camera, t, seated), reset(), state(), sky() }
// THE SKY METER (owner, 2026-11-05, round 6 note 3: "controlling the gunship while Isao is close to the boss sinkhole makes the gunship face the sky"; not reproduced
// headless, spec 2026-11-05-round-6-five-notes-design.md stream C): the same sample also reads the camera's forward against its own radial (the seat's `up`, the
// platform's normal: src/sentry-pilot.js pose()); a seated frame with forward . up > 0 looks above the horizon, which the seat's own pose never can (its pitch is
// held in [pitchMin, pitchMax], both down). sky() is the harness's state().camSky: the seated frames, how many faced the sky, the highest dot, and a ring of the
// first and the latest such frames with the host's info() then (the seat, the glide, the shot, the hull's distance to the arena's hole).
import * as THREE from '../../vendor/three.module.js';

const DEG = 180 / Math.PI, FWD = new THREE.Vector3();

export function createCamJump({ metres = () => 1, info = () => ({}), watchM = 8, watchDeg = 6, span = 1, keep = 60 } = {}) {
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), recent = [], log = [];
  let have = false, frames = 0;
  const seated = { frames: 0, m: 0, deg: 0, mAt: null, degAt: null }, skyLog = { frames: 0, up: 0, top: -1, first: [], last: [] };
  const round = (x, k = 1) => +x.toFixed(k);
  return {
    // t: seconds on any steady clock (the controller passes the wall clock: headless barely advances the game's)
    sample(camera, t, isSeated = false) {
      frames++;
      if (isSeated) {   // the sky meter: forward . radial, every seated frame, the first one included
        const r = camera.position.length(), d = r > 0 ? FWD.set(0, 0, -1).applyQuaternion(camera.quaternion).dot(camera.position) / r : -1;
        skyLog.frames++; skyLog.top = Math.max(skyLog.top, d);
        if (d > 0) { skyLog.up++; const e = { frame: frames, t: round(t, 2), dot: round(d, 3), ...info() }; if (skyLog.first.length < 8) skyLog.first.push(e); else { skyLog.last.push(e); if (skyLog.last.length > 8) skyLog.last.shift(); } }
      }
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
    sky: () => ({ frames: skyLog.frames, up: skyLog.up, top: round(skyLog.top, 3), first: skyLog.first.slice(), last: skyLog.last.slice() }),
    // a new world, a teleport the harness asks for: the next sample starts afresh
    reset() { have = false; },
    state: () => ({
      m: round(recent.reduce((a, r) => Math.max(a, r[1]), 0), 2), deg: round(recent.reduce((a, r) => Math.max(a, r[2]), 0), 2), frames,
      seated: { frames: seated.frames, m: round(seated.m, 2), deg: round(seated.deg, 2), mAt: seated.mAt, degAt: seated.degAt },
      log: log.slice(),
    }),
    // the harness's fresh window (the fight's, after the seat is taken): the worst and the log start over
    clear() { seated.frames = 0; seated.m = seated.deg = 0; seated.mAt = seated.degAt = null; log.length = 0; Object.assign(skyLog, { frames: 0, up: 0, top: -1, first: [], last: [] }); },
  };
}
