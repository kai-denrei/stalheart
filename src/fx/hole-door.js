// THE HOLE IS THE DOOR (owner, 2026-10-26, note 7: "both the entrance to the Cave and when coming out should read as exactly the same sinkhole where the
// Boss fight took place"; spec docs/superpowers/specs/2026-10-26-round-3-the-hole-and-the-cave-design.md, decisions 2 and 3). The camera's three shots on
// the arena's hole, all on one cell and one axis (the hole's centre on the unit sphere, its normal the radial):
//   look(ci)    the rim view while Isao's brief is read: from where the camera is to a point just over the rim, looking into the hole
//   dive(ci, s) over `s` seconds, from the rim view up over the hole's axis and down it to just under the lip (DESCENT.door.under cells below the
//               surface along -normal), the view narrowing into the dark (the camera's fov to DESCENT.door.fov of its own); the cave's page then shows
//   rise(ci)    as the cave's page goes: from under the lip, looking up at the sky, up the axis to the rim view over DESCENT.door.rise seconds (the dive
//               reversed), held there for the ending; the fov back
// measure(ci) -> { fromCentre, fromRim (cells), along (the view's dot with -normal) }: the harness's check of the hand-over and the return.
// Hooks: { camera, startShot, cellSide() (host units), centers() (graph.centers) }. The shots hold (DESCENT.door.hold s) until the next shot replaces them.
import * as THREE from '../../vendor/three.module.js';
import { DESCENT } from '../content/descent.js';
import { ARENA } from '../content/sectors.js';

const ease = (x) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };
const look = new THREE.PerspectiveCamera(), FWD = new THREE.Vector3(0, 0, -1);
const quatAt = (pos, target, up, out = new THREE.Quaternion()) => { look.position.copy(pos); look.up.copy(up); look.lookAt(target); return out.copy(look.quaternion); };

// the hole's frame and the four poses on it; `from` (the camera's position) picks the rim's side
export function holeFrame(center, cellSide, from, tune = DESCENT.door) {
  const c = new THREE.Vector3(...center).normalize(), n = c.clone(), rimR = (ARENA.craterCells / 2) * cellSide;
  const t = from ? from.clone().sub(c).projectOnPlane(n) : new THREE.Vector3();
  if (t.lengthSq() < 1e-12) t.set(0, 1, 0).projectOnPlane(n); if (t.lengthSq() < 1e-12) t.set(1, 0, 0).projectOnPlane(n); t.normalize();
  const rimPos = c.clone().addScaledVector(t, rimR + tune.rimOut * cellSide).addScaledVector(n, tune.rimUp * cellSide), into = c.clone().addScaledVector(n, -0.5 * cellSide);
  const topPos = c.clone().addScaledVector(n, tune.top * cellSide), underPos = c.clone().addScaledVector(n, -tune.under * cellSide);
  const down = c.clone().addScaledVector(n, -10 * cellSide), sky = c.clone().addScaledVector(n, 10 * cellSide), outward = t.clone().negate();
  return { c, n, t, rimR, cellSide,
    rim: { pos: rimPos, quat: quatAt(rimPos, into, n) },
    top: { pos: topPos, quat: quatAt(topPos, down, outward) },
    under: { pos: underPos, quat: quatAt(underPos, down, outward) },
    up: { pos: underPos, quat: quatAt(underPos, sky, t) } };   // under the lip looking up at the sky: where the rise starts
}
// the dive at `s` seconds of `seconds`: rim -> over the axis (the first `turn` of it) -> down the axis to under the lip; and the fov's factor
export function divePose(f, s, seconds, out, tune = DESCENT.door) {
  const u = Math.max(0, Math.min(1, s / seconds)), a = ease(u / tune.turn), b = ease((u - tune.turn) / (1 - tune.turn));
  if (u < tune.turn) { out.pos.copy(f.rim.pos).lerp(f.top.pos, a); out.quat.copy(f.rim.quat).slerp(f.top.quat, a); }
  else { out.pos.copy(f.top.pos).lerp(f.under.pos, b); out.quat.copy(f.top.quat); }
  return 1 + (tune.fov - 1) * b;
}
// the rise at `s` seconds: under the lip looking up -> up the axis to the top (half) -> to the rim view
export function risePose(f, s, out, tune = DESCENT.door) {
  const u = Math.max(0, Math.min(1, s / tune.rise)), a = ease(u / 0.5), b = ease((u - 0.5) / 0.5);
  if (u < 0.5) { out.pos.copy(f.up.pos).lerp(f.top.pos, a); out.quat.copy(f.up.quat); }
  else { out.pos.copy(f.top.pos).lerp(f.rim.pos, b); out.quat.copy(f.up.quat).slerp(f.rim.quat, b); }
  return out;
}
export function measureDoor(f, pos, quat) {
  const d = pos.clone().sub(f.c), h = d.dot(f.n), side = d.clone().addScaledVector(f.n, -h).length(), fwd = FWD.clone().applyQuaternion(quat);
  return { fromCentre: +(d.length() / f.cellSide).toFixed(3), fromRim: +(Math.hypot(side - f.rimR, h) / f.cellSide).toFixed(3), along: +(-fwd.dot(f.n)).toFixed(3) };
}

export function createHoleDoor({ camera, startShot, cellSide, centers }) {
  let fov0 = null, frame = null, phase = null;
  const tune = DESCENT.door, frameOf = (ci) => holeFrame(centers()[ci], cellSide(), camera.position, tune);
  const setFov = (k) => { if (fov0 == null) fov0 = camera.fov; const f = fov0 * k; if (Math.abs(camera.fov - f) > 1e-6) { camera.fov = f; camera.updateProjectionMatrix(); } };
  const restoreFov = () => { if (fov0 != null) { camera.fov = fov0; camera.updateProjectionMatrix(); fov0 = null; } };
  return {
    look(ci) {
      frame = frameOf(ci); phase = 'look'; const from = { pos: camera.position.clone(), quat: camera.quaternion.clone() }, f = frame;
      startShot({ id: 'descentLook', dur: tune.hold, onEnd: () => { if (phase === 'look') phase = null; }, poseAt: (u, out) => { const k = ease((u * tune.hold) / tune.glide); out.pos.copy(from.pos).lerp(f.rim.pos, k); out.quat.copy(from.quat).slerp(f.rim.quat, k); } });
    },
    dive(ci, seconds) {
      frame ??= frameOf(ci); phase = 'dive'; const f = frame, dur = seconds + tune.hold;
      startShot({ id: 'descentLook', dur, onEnd: () => { restoreFov(); if (phase === 'dive') phase = null; }, poseAt: (u, out) => setFov(divePose(f, u * dur, seconds, out, tune)) });
    },
    rise(ci) {
      frame ??= frameOf(ci); restoreFov(); phase = 'rise'; const f = frame, dur = tune.rise + tune.hold;
      startShot({ id: 'descentLook', dur, onEnd: () => { if (phase === 'rise') phase = null; }, poseAt: (u, out) => risePose(f, u * dur, out, tune) });
    },
    measure: (ci) => { if (ci < 0) return null; const f = frame ?? frameOf(ci); return { phase, ...measureDoor(f, camera.position, camera.quaternion) }; },
    reset: () => { restoreFov(); frame = null; phase = null; },
  };
}
