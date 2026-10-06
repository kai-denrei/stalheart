// THE DIORAMA (owner, 2026-10-06: "a feel-good diorama of the MÖRK and Isao together looking at the diegetic scoreboard"). When the
// colony holds, a copy of the player's hull (its livery with it) and a copy of Isao are set down on the slab in front of the two rivalry
// boards, facing them, the boards celebrate, and the camera eases in from behind the pair. The world is still under the shot (it is
// not one of the live shots); the copies go when it ends, skipped or not, and `done` runs.
//
// c: the programme host's bag (story, startShot, cellSide, hull, isao, spawnIsao, scene). Returns false, and does nothing, when there is
// nothing to stage (no boards printed, no camera shots).
import * as THREE from '../../vendor/three.module.js';
import { cloneFixture } from './model-fixture.js';

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
  if (hull) { const tank = cloneFixture(hull); tank.scale.copy(hull.scale); stand(tank, spot.clone(), up, toBoards); c.scene.add(tank); cast.push(tank); }
  // Isao off the left end of the boards, up at his working height, turned in toward them and the tank
  if (!c.isao?.()) c.spawnIsao?.();
  const drone = c.isao?.()?.obj;
  if (drone) { const copy = cloneFixture(drone); copy.scale.copy(drone.scale); stand(copy, mid.clone().addScaledVector(face, span * 0.35).addScaledVector(along, -2.3 * T).addScaledVector(up, 0.9 * T), up, toBoards.clone().addScaledVector(along, 0.5)); c.scene.add(copy); cast.push(copy); }
  for (const bd of boards) bd.celebrate?.(DIORAMA_SECONDS);
  // behind and above the pair, easing in and down toward the boards' faces
  const from = spot.clone().addScaledVector(face, 3.0 * T).addScaledVector(up, 1.4 * T).addScaledVector(along, -2.2 * T);
  const to = spot.clone().addScaledVector(face, 2.0 * T).addScaledVector(up, 0.9 * T).addScaledVector(along, -1.5 * T);
  const look = mid.clone().addScaledVector(face, span * 0.3).addScaledVector(along, -0.4 * T).addScaledVector(up, 0.45 * T), cam = new THREE.PerspectiveCamera();
  let lastU = 0;
  c.startShot({ id: 'diorama', dur: DIORAMA_SECONDS, poseAt: (u, out) => {
    const k = u * u * (3 - 2 * u), dt = Math.max(0, u - lastU) * DIORAMA_SECONDS; lastU = u;
    for (const bd of boards) bd.tick?.(dt);   // the world is still under the shot: the boards' party is driven from here
    out.pos.lerpVectors(from, to, k); cam.position.copy(out.pos); cam.up.copy(up); cam.lookAt(look); out.quat.copy(cam.quaternion);
  }, onEnd: () => { for (const o of cast) { c.scene.remove(o); o.visible = false; } done?.(); } });
  return true;
}
