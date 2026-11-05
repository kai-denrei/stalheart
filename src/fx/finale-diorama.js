// THE DIORAMA (owner, 2026-10-06: "a feel-good diorama of the MÖRK and Isao together looking at the diegetic scoreboard"). When the
// colony holds, a copy of the player's hull (its livery with it) and a copy of Isao are set down on the slab in front of the two rivalry
// boards, facing them, the boards celebrate, and the camera eases in from behind the pair. The world is still under the shot (it is
// not one of the live shots); the copies go when it ends, skipped or not, and `done` runs.
//
// THE DAY 42 REPLAY (owner, 2026-10-26, round 3 note 8: "we re-do a brief animation of the 42 days celebration, while the scoreboard also displays"):
// with c.party (the disco party, src/fx/disco-party.js replay) the party's short form runs while the boards are read, and the diorama holds as long
// as it (DAY_42.replay.seconds, 20 s, against DIORAMA_SECONDS alone); the ball hangs from the Stålheart's tip when that is in the shot's view,
// over the boards otherwise; the party is ticked from the shot (the world's dt is 0 under it) and stopped when the shot ends, skipped or not.
// THE COMPANIONS IN THE FRAME (owner, 2026-11-02, round 4 note 14: the final scene's frame has the K9 and the feline too): with c.pets (src/fx/
// companions.js) each printed companion is staged too, a copy of its drawn body (cloneFixture: its own skeleton, the wireframe's materials shared)
// at its true size, sat (its sit clip once, held) to either side of the hull and a little toward the camera, facing the boards; its mixer is
// ticked from the shot (the world's dt is 0 under it) and the copies go with the others.
// c: the programme host's bag (story, startShot, cellSide, hull, isao, spawnIsao, scene, party, pets). Returns false, and does nothing, when there is
// nothing to stage (no boards printed, no camera shots).
import * as THREE from '../../vendor/three.module.js';
import { cloneFixture, modelClips } from './model-fixture.js';
import { DAY_42 } from '../content/day-42.js';
import { COMPANIONS } from '../content/companions.js';

// the companions' places in the diorama, in the hull's measure T: `side` along the boards from the hull (C-07 on the camera's side), `front`
// toward the camera (round 4, note 14); K0-TECH (round 6) the third place, in front of the hull's camera-side corner, nearer the lens (a 0.41 m cat);
// the Nih-Dairia mech (round 6) the fourth, past the dog's side and back toward the boards, standing in its last pose (no sit: no clips)
export const DIORAMA_PETS = Object.freeze([Object.freeze({ side: -0.85, front: 0.45 }), Object.freeze({ side: 0.8, front: 0.3 }), Object.freeze({ side: -0.4, front: 0.85 }), Object.freeze({ side: 1.7, front: -0.5 })]);
// the last staging, for the harness (src/fx/showcase-hooks.js diorama): who stood in it and where each lands on the screen at both ends of its rail (NDC)
let lastCast = null;
export const dioramaCast = () => lastCast;

export const DIORAMA_SECONDS = 8;

// an object standing at `at` on the planet, +Y along `up`, +Z (its front) along `fwd`
function stand(obj, at, up, fwd) {
  const u = up.clone().normalize(), f = fwd.clone().addScaledVector(u, -fwd.dot(u)).normalize(), r = new THREE.Vector3().crossVectors(u, f);
  obj.matrixAutoUpdate = true; obj.position.copy(at); obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f)); obj.visible = true;
}

export function playDiorama(c, done) {
  const s = c.story?.(), boards = s?.boards;
  if (!boards?.length || !c.startShot || !c.scene) return false;
  const a = boards[0].group.getWorldPosition(new THREE.Vector3()), b = (boards[1] ?? boards[0]).group.getWorldPosition(new THREE.Vector3());
  const mid = a.clone().add(b).multiplyScalar(0.5), up = mid.clone().normalize(), m = c.cellSide() / 10;   // a metre on the planet
  const face = new THREE.Vector3(0, 0, 1).applyQuaternion(boards[0].group.getWorldQuaternion(new THREE.Quaternion()));
  face.addScaledVector(up, -face.dot(up)).normalize();
  const along = b.clone().sub(a); along.addScaledVector(up, -along.dot(up));
  if (along.lengthSq() < 1e-12) along.crossVectors(up, face);
  along.normalize();
  // sized from the things themselves: the hull's length and the boards' span set every distance (a game metre is not the hull's)
  const hull = c.hull?.(), size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).length();
  const T = Math.max(hull ? size(hull) * 0.6 : 0, 8 * m), span = Math.max(a.distanceTo(b) + size(boards[0].group) * 0.5, T * 2);
  const spot = mid.clone().addScaledVector(face, span * 0.7), toBoards = face.clone().negate(), cast = [];
  // the player's MÖRK, its paint and all, before the middle of the two boards
  if (hull) { const tank = cloneFixture(hull); tank.scale.copy(hull.scale); stand(tank, spot.clone(), up, toBoards); tank.userData.dioramaRole = 'hull'; c.scene.add(tank); cast.push(tank); }
  // Isao off the left end of the boards, up at his working height, turned in toward them and the tank
  if (!c.isao?.()) c.spawnIsao?.();
  const drone = c.isao?.()?.obj;
  if (drone) { const copy = cloneFixture(drone); copy.scale.copy(drone.scale); stand(copy, mid.clone().addScaledVector(face, span * 0.35).addScaledVector(along, -2.3 * T).addScaledVector(up, 0.9 * T), up, toBoards.clone().addScaledVector(along, 0.5)); copy.userData.dioramaRole = 'isao'; c.scene.add(copy); cast.push(copy); }
  // the printed companions beside the hull, sat, facing the boards (round 4, note 14)
  const pets = c.pets?.() ?? null, born = pets?.born?.() ?? [], mixers = [];
  if (pets) COMPANIONS.units.forEach((u, i) => {
    const root = pets.roots?.()[i], at = DIORAMA_PETS[i]; if (!born.includes(u.id) || !root || !at) return;
    const copy = cloneFixture(root); copy.scale.copy(root.getWorldScale(new THREE.Vector3()));
    stand(copy, spot.clone().addScaledVector(along, at.side * T).addScaledVector(face, at.front * T), up, toBoards); copy.userData.dioramaRole = u.id; c.scene.add(copy); cast.push(copy);
    const clip = modelClips(u.model).find((x) => x.name === u.sit);
    if (clip) { const mx = new THREE.AnimationMixer(copy), a = mx.clipAction(clip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); mx.update(0); mixers.push(mx); }
  });
  // behind and above the pair, easing in and down toward the boards' faces
  const from = spot.clone().addScaledVector(face, 3.0 * T).addScaledVector(up, 1.4 * T).addScaledVector(along, -2.2 * T);
  const to = spot.clone().addScaledVector(face, 2.0 * T).addScaledVector(up, 0.9 * T).addScaledVector(along, -1.5 * T);
  const look = mid.clone().addScaledVector(face, span * 0.3).addScaledVector(along, -0.4 * T).addScaledVector(up, 0.45 * T), cam = new THREE.PerspectiveCamera();
  // where each one lands on the screen at both ends of the rail, NDC (in frame within +-1), through the game camera's default lens (68 degrees, 16:10)
  const probe = new THREE.PerspectiveCamera(68, 1.6, 0.0001, 100), ndc = (o, eye) => { probe.position.copy(eye); probe.up.copy(up); probe.lookAt(look); probe.updateMatrixWorld(true); const p = o.position.clone().project(probe); return [+p.x.toFixed(2), +p.y.toFixed(2)]; };
  lastCast = { secs: 0, cast: cast.map((o, k) => ({ name: o.userData.dioramaRole ?? `cast${k}`, from: ndc(o, from), to: ndc(o, to) })) };
  // the replay: the ball in view from both ends of the shot's rail (within cone of the line to `look`), or over the boards' top
  const party = c.party?.() ?? null, cone = DAY_42.replay.cone, seen = (p, eye) => p.clone().sub(eye).angleTo(look.clone().sub(eye)) < cone;
  const top = new THREE.Box3(); for (const bd of boards) top.expandByObject(bd.group);
  const over = mid.clone().addScaledVector(up, Math.max(0, top.isEmpty() ? 0 : top.max.clone().sub(mid).dot(up)));
  const rep = party?.replay?.({ inView: (p) => seen(p, from) && seen(p, to), over, up }) ?? null, secs = rep?.seconds ?? DIORAMA_SECONDS;
  for (const bd of boards) bd.celebrate?.(secs);
  lastCast.secs = secs;
  let lastU = 0;
  c.startShot({ id: 'diorama', dur: secs, poseAt: (u, out) => {
    const k = u * u * (3 - 2 * u), dt = Math.max(0, u - lastU) * secs; lastU = u;
    for (const bd of boards) bd.tick?.(dt);   // the world is still under the shot: the boards' party is driven from here
    if (rep) party.replayTick(dt);   // and the disco party's replay
    for (const mx of mixers) mx.update(dt);   // and the companions' sit (round 4)
    out.pos.lerpVectors(from, to, k); cam.position.copy(out.pos); cam.up.copy(up); cam.lookAt(look); out.quat.copy(cam.quaternion);
  }, onEnd: () => { if (rep) party.replayStop(); for (const o of cast) { c.scene.remove(o); o.visible = false; } done?.(); } });
  return true;
}
